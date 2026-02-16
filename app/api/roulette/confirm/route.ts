import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { verifyNfcAccess } from "@/lib/nfc";

async function requireCoachOrAdmin() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false as const, error: error?.message || "Not logged in" };

  const { data: roles, error: rErr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id);

  if (rErr) return { ok: false as const, error: rErr.message };
  const allowed = (roles ?? []).some((r: any) => ["admin", "coach"].includes(String(r.role ?? "").toLowerCase()));
  if (!allowed) return { ok: false as const, error: "Coach access required" };

  return { ok: true as const, supabase, userId: data.user.id };
}

async function hashPin(pin: string) {
  const data = new TextEncoder().encode(pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(req: Request) {
  const gate = await requireCoachOrAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const spin_id = String(body?.spin_id ?? "").trim();
  const pin = String(body?.pin ?? "").trim();
  const nfcCode = String(body?.nfc_code ?? "").trim();
  let nfcVerified = false;
  if (!spin_id) return NextResponse.json({ ok: false, error: "Missing spin_id" }, { status: 400 });
  if (!pin && !nfcCode) return NextResponse.json({ ok: false, error: "PIN or NFC required" }, { status: 400 });

  const supabase = gate.supabase;
  if (nfcCode) {
    const nfc = await verifyNfcAccess({ code: nfcCode, permissionKey: "roulette_confirm" });
    if (!nfc.ok) {
      if (!pin) return NextResponse.json({ ok: false, error: nfc.error }, { status: 403 });
    } else {
      // NFC verified, skip PIN check.
      nfcVerified = true;
    }
  }

  if (!nfcVerified) {
    const { data: settings, error: sErr } = await supabase
      .from("skill_tracker_settings")
      .select("admin_pin_hash")
      .eq("id", "default")
      .maybeSingle();

    if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });
    if (!settings?.admin_pin_hash) {
      return NextResponse.json({ ok: false, error: "Admin PIN not set" }, { status: 400 });
    }

    const pinHash = await hashPin(pin);
    if (pinHash !== settings.admin_pin_hash) {
      return NextResponse.json({ ok: false, error: "Invalid PIN" }, { status: 403 });
    }
  }

  const { data: spin, error: spinErr } = await supabase
    .from("roulette_spins")
    .select("id,student_id,wheel_id,segment_id,result_type,points_delta,prize_text,item_key,confirmed_at")
    .eq("id", spin_id)
    .maybeSingle();

  if (spinErr) return NextResponse.json({ ok: false, error: spinErr.message }, { status: 500 });
  if (!spin) return NextResponse.json({ ok: false, error: "Spin not found" }, { status: 404 });
  if (spin.confirmed_at) return NextResponse.json({ ok: false, error: "Spin already confirmed" }, { status: 400 });

  const markRes = await supabase
    .from("roulette_spins")
    .update({ confirmed_at: new Date().toISOString() })
    .eq("id", spin.id)
    .is("confirmed_at", null)
    .select("id")
    .maybeSingle();
  if (markRes.error) return NextResponse.json({ ok: false, error: markRes.error.message }, { status: 500 });
  if (!markRes.data) {
    return NextResponse.json({ ok: false, error: "Spin already confirmed" }, { status: 400 });
  }

  const [{ data: wheelRow }, { data: segmentRow }] = await Promise.all([
    supabase.from("roulette_wheels").select("name").eq("id", spin.wheel_id).maybeSingle(),
    supabase
      .from("roulette_segments")
      .select("label,segment_type,points_value,prize_text,item_key")
      .eq("id", spin.segment_id)
      .maybeSingle(),
  ]);
  const wheelName = String(wheelRow?.name ?? "Prize Wheel");
  const rawSegmentLabel = String(segmentRow?.label ?? spin.prize_text ?? "Wheel Prize");
  const segmentLabel =
    !rawSegmentLabel.trim() || rawSegmentLabel.trim().toLowerCase() === "new segment"
      ? "Spin Result"
      : rawSegmentLabel;
  const pointsDelta = Number(spin.points_delta ?? 0);

  if (pointsDelta !== 0) {
    const existingGrant = await supabase
      .from("ledger")
      .select("id")
      .eq("source_type", "roulette_spin")
      .eq("source_id", spin.id)
      .limit(1)
      .maybeSingle();
    if (existingGrant.error) return NextResponse.json({ ok: false, error: existingGrant.error.message }, { status: 500 });
    if (!existingGrant.data) {
    const note = `Prize Wheel • ${wheelName} • ${segmentLabel}`;
    const { error: ledErr } = await supabase.from("ledger").insert({
      student_id: spin.student_id,
      points: pointsDelta,
      note: note.slice(0, 200),
      category: "roulette_spin",
      source_id: spin.id,
      source_type: "roulette_spin",
      created_by: gate.userId,
    });
    if (ledErr) {
      const code = String((ledErr as any)?.code ?? "");
      // If a concurrent request already wrote this roulette grant, treat as idempotent success.
      if (code !== "23505") {
        return NextResponse.json({ ok: false, error: ledErr.message }, { status: 500 });
      }
    }
    }

    const rpc = await supabase.rpc("recompute_student_points", { p_student_id: spin.student_id });
    if (rpc.error) return NextResponse.json({ ok: false, error: rpc.error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    confirmed: true,
    wheel_name: wheelName,
    segment_label: segmentLabel,
    points_delta: pointsDelta,
    prize_text: spin.prize_text ?? null,
    item_key: spin.item_key ?? null,
  });
}

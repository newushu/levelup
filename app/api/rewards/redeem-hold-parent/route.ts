import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const gate = await requireUser();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const reward_id = String(body?.reward_id ?? "").trim();
  const student_id = String(body?.student_id ?? "").trim();

  if (!reward_id || !student_id) {
    return NextResponse.json({ ok: false, error: "reward_id and student_id are required" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: parent, error: pErr } = await admin
    .from("parents")
    .select("id")
    .eq("auth_user_id", gate.user.id)
    .maybeSingle();
  if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });
  if (!parent?.id) return NextResponse.json({ ok: false, error: "Not a parent account" }, { status: 403 });

  const { data: link, error: lErr } = await admin
    .from("parent_students")
    .select("student_id")
    .eq("parent_id", parent.id)
    .eq("student_id", student_id)
    .maybeSingle();
  if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });
  if (!link?.student_id) return NextResponse.json({ ok: false, error: "Not linked to this student" }, { status: 403 });

  const { data: reward, error: rErr } = await admin
    .from("rewards")
    .select("id,name,cost,category")
    .eq("id", reward_id)
    .single();
  if (rErr) return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 });

  const { data: student, error: sErr } = await admin
    .from("students")
    .select("id,points_total,points_balance")
    .eq("id", student_id)
    .single();
  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });

  const available = Number(student.points_balance ?? student.points_total ?? 0);
  if (available < Number(reward.cost ?? 0)) {
    return NextResponse.json({ ok: false, error: "Not enough points" }, { status: 400 });
  }

  const holdUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();

  const { data: redemption, error: redErr } = await admin
    .from("reward_redemptions")
    .insert({
      student_id,
      reward_id,
      cost: reward.cost,
      qty: 1,
      status: "pending",
      mode: "hold",
      requested_at: nowIso,
      hold_until: holdUntil,
    })
    .select("id")
    .single();
  if (redErr) return NextResponse.json({ ok: false, error: redErr.message }, { status: 500 });

  const { error: ledErr } = await admin.from("ledger").insert({
    student_id,
    points: -Math.abs(Number(reward.cost ?? 0)),
    note: `Hold Request: ${reward.name}`,
    category: "redeem_hold",
  });
  if (ledErr) return NextResponse.json({ ok: false, error: ledErr.message }, { status: 500 });

  const { error: rpcErr } = await admin.rpc("recompute_student_points", { p_student_id: student_id });
  if (rpcErr) return NextResponse.json({ ok: false, error: rpcErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, redemption_id: redemption?.id ?? null });
}

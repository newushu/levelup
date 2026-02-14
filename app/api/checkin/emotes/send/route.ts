import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function normalizeName(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const admin = supabaseAdmin();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const { data: roles, error: roleErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id);
  if (roleErr) return NextResponse.json({ ok: false, error: roleErr.message }, { status: 500 });
  const roleList = (roles ?? []).map((r: any) => String(r.role ?? "").toLowerCase());
  if (!roleList.some((r) => ["admin", "coach", "classroom"].includes(r))) {
    return NextResponse.json({ ok: false, error: "Not allowed" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const instanceId = String(body?.instance_id ?? "").trim();
  const senderName = String(body?.sender_name ?? "").trim();
  const recipientName = String(body?.recipient_name ?? "").trim();
  const emoteId = String(body?.emote_id ?? "").trim();
  if (!instanceId || !senderName || !recipientName || !emoteId) {
    return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
  }

  const { data: emote, error: emErr } = await admin
    .from("class_emotes")
    .select("id,label,points_cost,unlock_level,enabled")
    .eq("id", emoteId)
    .maybeSingle();
  if (emErr) return NextResponse.json({ ok: false, error: emErr.message }, { status: 500 });
  if (!emote || emote.enabled === false) return NextResponse.json({ ok: false, error: "Emote unavailable" }, { status: 400 });

  const cost = Math.max(0, Number((emote as any)?.points_cost ?? 0));
  const unlockLevel = Math.max(1, Number((emote as any)?.unlock_level ?? 1));

  const { data: senderStudent, error: sErr } = await admin
    .from("students")
    .select("id,name,level,points_total")
    .ilike("name", senderName)
    .limit(2);
  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });
  const senderRow = (senderStudent ?? []).length === 1 ? senderStudent![0] : null;

  if (cost > 0 || unlockLevel > 1) {
    if (!senderRow) {
      return NextResponse.json({ ok: false, error: "Sender must match a student for locked emotes" }, { status: 400 });
    }
    if (Number(senderRow.level ?? 1) < unlockLevel) {
      return NextResponse.json({ ok: false, error: `Requires level ${unlockLevel}` }, { status: 400 });
    }
    if (Number(senderRow.points_total ?? 0) < cost) {
      return NextResponse.json({ ok: false, error: "Not enough points" }, { status: 400 });
    }
    if (cost > 0) {
      const note = `Class emote purchase: ${String((emote as any)?.label ?? "Emote")} (-${cost})`;
      const { error: lErr } = await admin.from("ledger").insert({
        student_id: senderRow.id,
        points: -cost,
        points_base: -cost,
        points_multiplier: 1,
        category: "emote_purchase",
        note,
      });
      if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });
      await admin.rpc("recompute_student_points", { p_student_id: senderRow.id });
    }
  }

  const recipientSearch = normalizeName(recipientName);
  const { error: qErr } = await admin.from("class_emote_messages").insert({
    instance_id: instanceId,
    sender_name: senderName,
    recipient_name: recipientName,
    recipient_search: recipientSearch,
    emote_id: emoteId,
  });
  if (qErr) return NextResponse.json({ ok: false, error: qErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

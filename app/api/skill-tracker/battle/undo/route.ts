import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const battle_id = String(body?.battle_id ?? "").trim();
  const student_id = String(body?.student_id ?? "").trim();

  if (!battle_id || !student_id) {
    return NextResponse.json({ ok: false, error: "Missing battle/student" }, { status: 400 });
  }

  const { data: battle, error: bErr } = await supabase
    .from("battle_trackers")
    .select("id,left_student_id,right_student_id,participant_ids,settled_at")
    .eq("id", battle_id)
    .single();
  if (bErr) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 });
  if (battle?.settled_at) return NextResponse.json({ ok: false, error: "Battle already settled" }, { status: 400 });

  const participants = (() => {
    const list = Array.isArray(battle?.participant_ids) ? battle.participant_ids : [];
    const ids = list.map((id: any) => String(id ?? "").trim()).filter(Boolean);
    if (ids.length) return Array.from(new Set(ids));
    return [battle.left_student_id, battle.right_student_id].map((id: any) => String(id ?? "").trim()).filter(Boolean);
  })();

  if (!participants.includes(student_id)) {
    return NextResponse.json({ ok: false, error: "Student not in battle" }, { status: 400 });
  }

  const { data: logs, error: lErr } = await supabase
    .from("battle_tracker_logs")
    .select("id,created_at")
    .eq("battle_id", battle_id)
    .eq("student_id", student_id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1);
  if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });

  const latest = (logs ?? [])[0];
  if (!latest?.id) return NextResponse.json({ ok: true, removed: false });

  const { error: dErr } = await supabase.from("battle_tracker_logs").delete().eq("id", latest.id);
  if (dErr) return NextResponse.json({ ok: false, error: dErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, removed: true });
}

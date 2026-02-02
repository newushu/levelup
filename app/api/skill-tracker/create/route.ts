import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  const skill_id = String(body?.skill_id ?? "").trim();
  const repetitions_target = Math.max(1, Math.min(20, Number(body?.repetitions_target ?? 1)));
  const requestedSource = String(body?.created_source ?? "").trim().toLowerCase();
  const created_source = requestedSource === "skill_pulse" ? "skill_pulse" : "admin";

  if (!student_id || !skill_id) {
    return NextResponse.json({ ok: false, error: "Missing student_id/skill_id" }, { status: 400 });
  }

  const { data: settings } = await supabase
    .from("leaderboard_bonus_settings")
    .select("skill_tracker_points_per_rep")
    .eq("id", 1)
    .maybeSingle();
  const points_per_rep = Math.max(0, Math.floor(Number(settings?.skill_tracker_points_per_rep ?? 2)));

  const { data, error } = await supabase
    .from("skill_trackers")
    .insert({
      student_id,
      skill_id,
      repetitions_target,
      points_per_rep,
      created_by: u.user.id,
      created_source,
    })
    .select("id,student_id,skill_id,repetitions_target,created_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, tracker: data });
}

import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { randomUUID } from "crypto";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const skill_id = String(body?.skill_id ?? "").trim();
  const repetitions_target = Math.max(1, Math.min(20, Number(body?.repetitions_target ?? 1)));
  const student_ids = Array.isArray(body?.student_ids) ? body.student_ids.map((id: any) => String(id)) : [];
  const uniqueStudentIds = Array.from(new Set(student_ids)).filter(Boolean);
  const requestedSource = String(body?.created_source ?? "").trim().toLowerCase();
  const created_source = requestedSource === "skill_pulse" ? "skill_pulse" : "admin";

  if (!skill_id || uniqueStudentIds.length === 0) {
    return NextResponse.json({ ok: false, error: "Missing skill_id/student_ids" }, { status: 400 });
  }
  const { data: settings } = await supabase
    .from("leaderboard_bonus_settings")
    .select("skill_tracker_points_per_rep")
    .eq("id", 1)
    .maybeSingle();
  const points_per_rep = Math.max(0, Math.floor(Number(settings?.skill_tracker_points_per_rep ?? 2)));

  const group_id = randomUUID();
  const payload = uniqueStudentIds.map((student_id) => ({
    student_id,
    skill_id,
    repetitions_target,
    points_per_rep,
    created_by: u.user.id,
    group_id,
    created_source,
  }));

  const { data, error } = await supabase.from("skill_trackers").insert(payload).select("id,student_id,skill_id,repetitions_target,created_at,group_id");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, group_id, trackers: data });
}

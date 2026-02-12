import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

const DEFAULT_FEATURES = {
  games: true,
  home_tracker: true,
  daily_checkin: true,
  quiz: true,
};

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  const skill_name = String(body?.skill_name ?? "").trim();
  const target_reps = Math.max(1, Number(body?.target_reps ?? 1));

  if (!student_id || !skill_name) {
    return NextResponse.json({ ok: false, error: "Missing student_id or skill_name" }, { status: 400 });
  }

  const { data: settings } = await supabase
    .from("home_quest_settings")
    .select("features")
    .eq("id", "default")
    .maybeSingle();
  const features = { ...DEFAULT_FEATURES, ...(settings?.features ?? {}) };
  if (!features.home_tracker) {
    return NextResponse.json({ ok: false, error: "Home Tracker disabled" }, { status: 403 });
  }

  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const { data: todayRows, error: tErr } = await supabase
    .from("home_quest_trackers")
    .select("id,created_at")
    .eq("student_id", student_id)
    .gte("created_at", startOfDay.toISOString())
    .limit(1);
  if (tErr) return NextResponse.json({ ok: false, error: tErr.message }, { status: 500 });
  if (todayRows?.length) {
    return NextResponse.json({ ok: false, error: "Daily tracker already used for today." }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("home_quest_trackers")
    .select("id")
    .eq("student_id", student_id)
    .is("completed_at", null)
    .limit(1);
  if (existing?.length) {
    return NextResponse.json({ ok: false, error: "Tracker already active" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("home_quest_trackers")
    .insert({
      student_id,
      skill_name,
      target_reps,
    })
    .select("id,student_id,skill_name,target_reps,created_at,completed_at")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, tracker: data });
}

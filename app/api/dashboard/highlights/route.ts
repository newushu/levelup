import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

function getWeekStartUTC(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const offset = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  if (!student_id) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });

  const weekStart = getWeekStartUTC(new Date());
  const weekStartIso = weekStart.toISOString();

  const { data: ledgerRows, error: lErr } = await supabase
    .from("ledger")
    .select("points,category,note,created_at")
    .eq("student_id", student_id)
    .gte("created_at", weekStartIso);
  if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });

  let pointsEarned = 0;
  let ruleBreakerCount = 0;
  let ruleBreakerPoints = 0;
  (ledgerRows ?? []).forEach((row: any) => {
    const points = Number(row.points ?? 0);
    const category = String(row.category ?? "").toLowerCase();
    const note = String(row.note ?? "").toLowerCase();
    if (points > 0) pointsEarned += points;
    if (category === "rule_breaker" || note.includes("rule breaker")) {
      ruleBreakerCount += 1;
      ruleBreakerPoints += points;
    }
  });

  const { count: checkinsCount, error: cErr } = await supabase
    .from("attendance_checkins")
    .select("id", { count: "exact", head: true })
    .eq("student_id", student_id)
    .gte("checked_in_at", weekStartIso);
  if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });

  const { data: taoluSessions, error: tErr } = await supabase
    .from("taolu_sessions")
    .select("id,created_at,ended_at")
    .eq("student_id", student_id)
    .gte("created_at", weekStartIso);
  if (tErr) return NextResponse.json({ ok: false, error: tErr.message }, { status: 500 });
  const taoluCompleted = (taoluSessions ?? []).filter((s: any) => s.ended_at || s.created_at).length;

  const { data: trackers, error: sErr } = await supabase
    .from("skill_trackers")
    .select("id,repetitions_target")
    .eq("student_id", student_id);
  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });

  let skillCompleted = 0;
  const trackerIds = (trackers ?? []).map((t: any) => t.id);
  if (trackerIds.length) {
    const { data: logs, error: slErr } = await supabase
      .from("skill_tracker_logs")
      .select("tracker_id,created_at")
      .in("tracker_id", trackerIds);
    if (slErr) return NextResponse.json({ ok: false, error: slErr.message }, { status: 500 });

    const attemptsByTracker = new Map<string, { attempts: number; last_at: string }>();
    (logs ?? []).forEach((row: any) => {
      const id = String(row.tracker_id ?? "");
      if (!id) return;
      const prev = attemptsByTracker.get(id) ?? { attempts: 0, last_at: "" };
      const createdAt = String(row.created_at ?? "");
      const next = {
        attempts: prev.attempts + 1,
        last_at: createdAt && createdAt > prev.last_at ? createdAt : prev.last_at,
      };
      attemptsByTracker.set(id, next);
    });

    (trackers ?? []).forEach((t: any) => {
      const meta = attemptsByTracker.get(String(t.id));
      if (!meta) return;
      const target = Number(t.repetitions_target ?? 1);
      if (meta.attempts >= target && meta.last_at >= weekStartIso) {
        skillCompleted += 1;
      }
    });
  }

  const { count: battleCompleted, error: bErr } = await supabase
    .from("battle_trackers")
    .select("id", { count: "exact", head: true })
    .or(`left_student_id.eq.${student_id},right_student_id.eq.${student_id}`)
    .gte("settled_at", weekStartIso);
  if (bErr) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    week_start: weekStartIso,
    summary: {
      points_earned: pointsEarned,
      rule_breaker_count: ruleBreakerCount,
      rule_breaker_points: ruleBreakerPoints,
      checkins: checkinsCount ?? 0,
      taolu_completed: taoluCompleted,
      skill_completed: skillCompleted,
      battle_completed: battleCompleted ?? 0,
    },
  });
}

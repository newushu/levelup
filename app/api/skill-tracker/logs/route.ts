import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

type TrackerRow = { id: string; student_id: string; skill_id: string; repetitions_target: number; created_at: string };

export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const url = new URL(req.url);
  const tracker_id = String(url.searchParams.get("tracker_id") ?? "").trim();
  const limit = Math.max(1, Math.min(20, Number(url.searchParams.get("limit") ?? 7)));

  if (!tracker_id) return NextResponse.json({ ok: false, error: "Missing tracker_id" }, { status: 400 });

  const { data: base, error: bErr } = await supabase
    .from("skill_trackers")
    .select("id,student_id,skill_id,repetitions_target,created_at")
    .eq("id", tracker_id)
    .single();
  if (bErr) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 });

  const { data: trackers, error: tErr } = await supabase
    .from("skill_trackers")
    .select("id,student_id,skill_id,repetitions_target,created_at")
    .eq("student_id", (base as any).student_id)
    .eq("skill_id", (base as any).skill_id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (tErr) return NextResponse.json({ ok: false, error: tErr.message }, { status: 500 });

  const rows = (trackers ?? []) as TrackerRow[];
  const ids = rows.map((r) => r.id);
  if (!ids.length) return NextResponse.json({ ok: true, logs: [] });

  const { data: logs, error: lErr } = await supabase
    .from("skill_tracker_logs")
    .select("tracker_id,success,created_at")
    .in("tracker_id", ids);
  if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });

  const logMap = new Map<string, { successes: number; attempts: number; last_at: string }>();
  for (const row of logs ?? []) {
    const tid = String((row as any)?.tracker_id ?? "");
    if (!tid) continue;
    const prev = logMap.get(tid) ?? { successes: 0, attempts: 0, last_at: "" };
    const createdAt = String((row as any)?.created_at ?? "");
    const nextLastAt = prev.last_at && createdAt && prev.last_at.localeCompare(createdAt) > 0 ? prev.last_at : createdAt;
    const next = {
      successes: prev.successes + ((row as any)?.success ? 1 : 0),
      attempts: prev.attempts + 1,
      last_at: nextLastAt || prev.last_at,
    };
    logMap.set(tid, next);
  }

  const sessions = rows
    .map((r) => {
      const counts = logMap.get(r.id) ?? { successes: 0, attempts: 0, last_at: "" };
      const attempts = counts.attempts;
      const rate = attempts ? Math.round((counts.successes / attempts) * 100) : 0;
      return {
        id: r.id,
        successes: counts.successes,
        attempts,
        target: Number(r.repetitions_target ?? 1),
        rate,
        created_at: counts.last_at || r.created_at,
        is_battle: false,
        vs_name: null,
      };
    })
    .filter((s) => s.attempts > 0)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

  const studentId = String((base as any).student_id ?? "");
  const skillId = String((base as any).skill_id ?? "");

  const { data: duelBattles, error: battleErr } = await supabase
    .from("battle_trackers")
    .select(
      "id,left_student_id,right_student_id,battle_mode,participant_ids,skill_id,repetitions_target,created_at,left:students!battle_trackers_left_student_id_fkey(id,name),right:students!battle_trackers_right_student_id_fkey(id,name)"
    )
    .eq("skill_id", skillId)
    .or(`left_student_id.eq.${studentId},right_student_id.eq.${studentId}`);
  if (battleErr) return NextResponse.json({ ok: false, error: battleErr.message }, { status: 500 });

  const { data: arrayBattles, error: aErr } = await supabase
    .from("battle_trackers")
    .select(
      "id,left_student_id,right_student_id,battle_mode,participant_ids,skill_id,repetitions_target,created_at,left:students!battle_trackers_left_student_id_fkey(id,name),right:students!battle_trackers_right_student_id_fkey(id,name)"
    )
    .eq("skill_id", skillId)
    .contains("participant_ids", [studentId]);
  if (aErr) return NextResponse.json({ ok: false, error: aErr.message }, { status: 500 });

  const battleRows = Array.from(
    new Map([...(duelBattles ?? []), ...(arrayBattles ?? [])].map((b: any) => [String(b.id), b])).values()
  ) as any[];
  const battleIds = battleRows.map((b) => b.id);
  const battleSessions: any[] = [];
  if (battleIds.length) {
    const { data: bLogs, error: blErr } = await supabase
      .from("battle_tracker_logs")
      .select("battle_id,student_id,success,created_at")
      .in("battle_id", battleIds);
    if (blErr) return NextResponse.json({ ok: false, error: blErr.message }, { status: 500 });

    for (const b of battleRows) {
      const logsForStudent = (bLogs ?? []).filter((l: any) => l.battle_id === b.id && l.student_id === studentId);
      if (!logsForStudent.length) continue;
      const attempts = logsForStudent.length;
      const successes = logsForStudent.filter((l: any) => l.success).length;
      const lastAt = logsForStudent
        .map((l: any) => String(l.created_at ?? ""))
        .sort()
        .slice(-1)[0];
      const rate = attempts ? Math.round((successes / attempts) * 100) : 0;
      const isDuel = (b.battle_mode ?? "duel") === "duel";
      const vsName = isDuel
        ? b.left_student_id === studentId
          ? b.right?.name ?? "Opponent"
          : b.left?.name ?? "Opponent"
        : "Battle Pulse";
      battleSessions.push({
        id: b.id,
        successes,
        attempts,
        target: Number(b.repetitions_target ?? 1),
        rate,
        created_at: lastAt || b.created_at,
        is_battle: true,
        vs_name: vsName,
      });
    }
  }

  const merged = [...sessions, ...battleSessions]
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
    .slice(-limit);

  return NextResponse.json({ ok: true, logs: merged });
}

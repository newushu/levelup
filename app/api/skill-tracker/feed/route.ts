import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const url = new URL(req.url);
  const source = String(url.searchParams.get("source") ?? "").trim().toLowerCase();

  const limit = 10;

  let trackerQuery = supabase
    .from("skill_trackers")
    .select("id,student_id,skill_id,repetitions_target,created_at,archived_at,created_source,students(id,name),tracker_skills(id,name)")
    .order("created_at", { ascending: false })
    .limit(50);
  if (source) trackerQuery = trackerQuery.eq("created_source", source);
  const { data: trackers, error: tErr } = await trackerQuery;
  if (tErr) return NextResponse.json({ ok: false, error: tErr.message }, { status: 500 });

  const trackerRows = trackers ?? [];
  const trackerIds = trackerRows.map((t: any) => t.id);

  const { data: logs, error: lErr } = await supabase
    .from("skill_tracker_logs")
    .select("tracker_id,success,created_at")
    .in("tracker_id", trackerIds);
  if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });

  const tMap = new Map<string, { successes: number; attempts: number; last_at: string }>();
  for (const row of logs ?? []) {
    const tid = String((row as any)?.tracker_id ?? "");
    if (!tid) continue;
    const prev = tMap.get(tid) ?? { successes: 0, attempts: 0, last_at: "" };
    const next = {
      successes: prev.successes + ((row as any)?.success ? 1 : 0),
      attempts: prev.attempts + 1,
      last_at: String((row as any)?.created_at ?? prev.last_at),
    };
    tMap.set(tid, next);
  }

  const trackerFeed = trackerRows.map((t: any) => {
    const counts = tMap.get(t.id) ?? { successes: 0, attempts: 0, last_at: "" };
    const rate = counts.attempts ? Math.round((counts.successes / counts.attempts) * 100) : 0;
    return {
      type: "tracker",
      created_at: counts.last_at || t.created_at,
      title: `${t.students?.name ?? "Student"} • ${t.tracker_skills?.name ?? "Skill"}`,
      subtitle: `${rate}% (${counts.successes}/${counts.attempts})`,
    };
  });

  let battleQuery = supabase
    .from("battle_trackers")
    .select("id,left_student_id,right_student_id,battle_mode,participant_ids,skill_id,created_at,settled_at,archived_at,winner_id,created_source,left:students!battle_trackers_left_student_id_fkey(id,name),right:students!battle_trackers_right_student_id_fkey(id,name),tracker_skills(id,name)")
    .order("created_at", { ascending: false })
    .limit(30);
  if (source) battleQuery = battleQuery.eq("created_source", source);
  const { data: battles, error: bErr } = await battleQuery;
  if (bErr) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 });

  const battleRows = battles ?? [];
  const battleIds = battleRows.map((b: any) => b.id);

  const { data: bLogs, error: blErr } = await supabase
    .from("battle_tracker_logs")
    .select("battle_id,student_id,success,created_at")
    .in("battle_id", battleIds);
  if (blErr) return NextResponse.json({ ok: false, error: blErr.message }, { status: 500 });

  const bMap = new Map<string, { leftS: number; leftA: number; rightS: number; rightA: number; last_at: string }>();
  for (const row of bLogs ?? []) {
    const bid = String((row as any)?.battle_id ?? "");
    if (!bid) continue;
    const battle = battleRows.find((b: any) => b.id === bid);
    if (!battle) continue;
    const prev = bMap.get(bid) ?? { leftS: 0, leftA: 0, rightS: 0, rightA: 0, last_at: "" };
    if (String(battle.battle_mode ?? "duel") !== "duel") {
      prev.last_at = String((row as any)?.created_at ?? prev.last_at);
      bMap.set(bid, prev);
      continue;
    }
    const studentId = String((row as any)?.student_id ?? "");
    const success = !!(row as any)?.success;
    if (studentId === battle.left_student_id) {
      prev.leftA += 1;
      if (success) prev.leftS += 1;
    }
    if (studentId === battle.right_student_id) {
      prev.rightA += 1;
      if (success) prev.rightS += 1;
    }
    prev.last_at = String((row as any)?.created_at ?? prev.last_at);
    bMap.set(bid, prev);
  }

  const battleFeed = battleRows.map((b: any) => {
    const counts = bMap.get(b.id) ?? { leftS: 0, leftA: 0, rightS: 0, rightA: 0, last_at: "" };
    const isDuel = String(b.battle_mode ?? "duel") === "duel";
    const leftName = b.left?.name ?? "Left";
    const rightName = b.right?.name ?? "Right";
    const title = isDuel
      ? `${leftName} vs ${rightName} • ${b.tracker_skills?.name ?? "Skill"}`
      : `Battle Pulse • ${b.tracker_skills?.name ?? "Skill"}`;
    const winner =
      b.winner_id === b.left_student_id
        ? leftName
        : b.winner_id === b.right_student_id
        ? rightName
        : null;
    const participantCount = Array.isArray(b.participant_ids) ? b.participant_ids.length : 0;
    const subtitle = isDuel
      ? `${counts.leftS}/${counts.leftA} vs ${counts.rightS}/${counts.rightA}${winner ? ` • Winner: ${winner}` : ""}`
      : `${participantCount || 0} participants${winner ? ` • Winner: ${winner}` : ""}`;
    return {
      type: "battle",
      created_at: counts.last_at || b.settled_at || b.created_at,
      title,
      subtitle,
    };
  });

  const merged = [...trackerFeed, ...battleFeed]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, limit);

  return NextResponse.json({ ok: true, feed: merged });
}

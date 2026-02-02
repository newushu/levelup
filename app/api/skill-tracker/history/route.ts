import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

type TrackerRow = { id: string; skill_id: string; repetitions_target: number; created_at: string };
type BattleRow = {
  id: string;
  left_student_id: string;
  right_student_id: string;
  battle_mode?: string | null;
  participant_ids?: string[] | null;
  skill_id: string;
  repetitions_target: number;
  created_at: string;
  left?: { id: string; name: string } | null;
  right?: { id: string; name: string } | null;
};

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  const limit = Math.max(1, Math.min(50, Number(body?.limit ?? 12)));

  if (!student_id) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });

  const { data: trackers, error: tErr } = await supabase
    .from("skill_trackers")
    .select("id,skill_id,repetitions_target,created_at")
    .eq("student_id", student_id);
  if (tErr) return NextResponse.json({ ok: false, error: tErr.message }, { status: 500 });

  const trackerRows = (trackers ?? []) as TrackerRow[];
  const ids = trackerRows.map((t) => t.id);
  const logs: any[] = [];
  if (ids.length) {
    const { data: lData, error: lErr } = await supabase
      .from("skill_tracker_logs")
      .select("tracker_id,success,created_at")
      .in("tracker_id", ids)
      .order("created_at", { ascending: false });
    if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });
    logs.push(...(lData ?? []));
  }

  const trackerSkillMap = new Map<string, string>();
  trackerRows.forEach((t) => trackerSkillMap.set(t.id, t.skill_id));

  const trackerMeta = new Map<string, { skill_id: string; target: number; created_at: string }>();
  trackerRows.forEach((t) =>
    trackerMeta.set(t.id, {
      skill_id: t.skill_id,
      target: Number(t.repetitions_target ?? 1),
      created_at: t.created_at,
    })
  );

  const counts = new Map<string, { successes: number; attempts: number; last_at: string }>();
  for (const row of logs ?? []) {
    const tid = String((row as any)?.tracker_id ?? "");
    if (!tid) continue;
    const prev = counts.get(tid) ?? { successes: 0, attempts: 0, last_at: "" };
    const createdAt = String((row as any)?.created_at ?? prev.last_at);
    const next = {
      successes: prev.successes + ((row as any)?.success ? 1 : 0),
      attempts: prev.attempts + 1,
      last_at: createdAt,
    };
    counts.set(tid, next);

  }

  const { data: duelBattles, error: bErr } = await supabase
    .from("battle_trackers")
    .select(
      "id,left_student_id,right_student_id,battle_mode,participant_ids,skill_id,repetitions_target,created_at,left:students!battle_trackers_left_student_id_fkey(id,name),right:students!battle_trackers_right_student_id_fkey(id,name)"
    )
    .or(`left_student_id.eq.${student_id},right_student_id.eq.${student_id}`);
  if (bErr) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 });

  const { data: arrayBattles, error: aErr } = await supabase
    .from("battle_trackers")
    .select(
      "id,left_student_id,right_student_id,battle_mode,participant_ids,skill_id,repetitions_target,created_at,left:students!battle_trackers_left_student_id_fkey(id,name),right:students!battle_trackers_right_student_id_fkey(id,name)"
    )
    .contains("participant_ids", [student_id]);
  if (aErr) return NextResponse.json({ ok: false, error: aErr.message }, { status: 500 });

  const battleRows = Array.from(
    new Map([...(duelBattles ?? []), ...(arrayBattles ?? [])].map((b: any) => [String(b.id), b])).values()
  ) as BattleRow[];
  const skillIds = Array.from(new Set([...trackerRows.map((t) => t.skill_id), ...battleRows.map((b) => b.skill_id)]));
  const skillMap = new Map<string, { name: string; category?: string | null }>();
  if (skillIds.length) {
    const { data: skills, error: sErr } = await supabase
      .from("tracker_skills")
      .select("id,name,category")
      .in("id", skillIds);
    if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });
    (skills ?? []).forEach((s: any) => skillMap.set(String(s.id), { name: s.name, category: s.category }));
  }

  const trackerHistory: any[] = [];
  trackerRows
    .slice()
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .forEach((t) => {
      const stat = counts.get(t.id);
      if (!stat || !stat.attempts) return;
      const skillMeta = skillMap.get(t.skill_id);
      const rate = stat.attempts ? Math.round((stat.successes / stat.attempts) * 100) : 0;
      trackerHistory.push({
        id: t.id,
        tracker_id: t.id,
        skill_id: t.skill_id,
        skill_name: skillMeta?.name ?? "Skill",
        skill_category: skillMeta?.category ?? "",
        successes: stat.successes,
        attempts: stat.attempts,
        target: Number(t.repetitions_target ?? 1),
        rate,
        created_at: stat.last_at || t.created_at,
        is_battle: false,
        vs_name: null,
      });
    });

  const battleIds = battleRows.map((b) => b.id);

  const battleHistory: any[] = [];
  if (battleIds.length) {
    const { data: bLogs, error: blErr } = await supabase
      .from("battle_tracker_logs")
      .select("battle_id,student_id,success,created_at")
      .in("battle_id", battleIds);
    if (blErr) return NextResponse.json({ ok: false, error: blErr.message }, { status: 500 });

    const logMap = new Map<string, { successes: number; attempts: number; last_at: string }>();
    for (const row of bLogs ?? []) {
      const bid = String((row as any)?.battle_id ?? "");
      const sid = String((row as any)?.student_id ?? "");
      if (!bid || sid !== student_id) continue;
      const prev = logMap.get(bid) ?? { successes: 0, attempts: 0, last_at: "" };
      const next = {
        successes: prev.successes + ((row as any)?.success ? 1 : 0),
        attempts: prev.attempts + 1,
        last_at: String((row as any)?.created_at ?? prev.last_at),
      };
      logMap.set(bid, next);
    }

    for (const b of battleRows) {
      const counts = logMap.get(b.id) ?? { successes: 0, attempts: 0, last_at: "" };
      if (!counts.attempts) continue;
      const target = Number(b.repetitions_target ?? 1);
      const rate = counts.attempts ? Math.round((counts.successes / counts.attempts) * 100) : 0;
      const skillMeta = skillMap.get(b.skill_id);
      const isDuel = (b.battle_mode ?? "duel") === "duel";
      const vsName = isDuel
        ? b.left_student_id === student_id
          ? b.right?.name ?? "Opponent"
          : b.left?.name ?? "Opponent"
        : "Battle Pulse";
      battleHistory.push({
        id: b.id,
        tracker_id: b.id,
        skill_id: b.skill_id,
        skill_name: skillMeta?.name ?? "Skill",
        skill_category: skillMeta?.category ?? "",
        successes: counts.successes,
        attempts: counts.attempts,
        target,
        rate,
        created_at: counts.last_at || b.created_at,
        is_battle: true,
        vs_name: vsName,
      });

    }
  }

  const merged = [...trackerHistory, ...battleHistory]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, limit);

  return NextResponse.json({ ok: true, history: merged });
}

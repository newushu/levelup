import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseServer } from "@/lib/supabase/server";

type SkillRow = { id: string; set_id: string };
type CompletionRow = { student_id: string; skill_id: string };
type LevelRow = { level: number; min_lifetime_points: number };

const MAX_LEVEL = 99;

function computeThresholds(baseJump: number, difficultyPct: number) {
  const levels: LevelRow[] = [];
  let total = 0;
  for (let level = 1; level <= MAX_LEVEL; level += 1) {
    if (level === 1) {
      levels.push({ level, min_lifetime_points: 0 });
      continue;
    }
    const exponent = level - 1;
    const factor = Math.pow(1 + difficultyPct / 100, exponent);
    total += baseJump * factor;
    const rounded = Math.round(total / 10) * 10;
    levels.push({ level, min_lifetime_points: Math.max(0, Math.floor(rounded)) });
  }
  return levels;
}

function buildSetCompletionCount(skillRows: SkillRow[], completionRows: CompletionRow[]) {
  const totalBySet = new Map<string, number>();
  skillRows.forEach((s) => totalBySet.set(s.set_id, (totalBySet.get(s.set_id) ?? 0) + 1));

  const skillToSet = new Map(skillRows.map((s) => [s.id, s.set_id]));
  const byStudent = new Map<string, Map<string, Set<string>>>();
  for (const row of completionRows) {
    const setId = skillToSet.get(row.skill_id);
    if (!setId) continue;
    const studentId = row.student_id;
    const sMap = byStudent.get(studentId) ?? new Map<string, Set<string>>();
    const set = sMap.get(setId) ?? new Set<string>();
    set.add(row.skill_id);
    sMap.set(setId, set);
    byStudent.set(studentId, sMap);
  }

  const completedSetsByStudent = new Map<string, number>();
  byStudent.forEach((setsMap, studentId) => {
    let done = 0;
    setsMap.forEach((skillsSet, setId) => {
      const total = totalBySet.get(setId) ?? 0;
      if (total > 0 && skillsSet.size === total) done += 1;
    });
    completedSetsByStudent.set(studentId, done);
  });

  return completedSetsByStudent;
}

function progressNumber(current: number, target: number) {
  if (target <= 0) return 1;
  return Math.min(1, Math.max(0, current / target));
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  const supabase = await supabaseServer();
  const body = await req.json().catch(() => ({}));
  const studentId = String(body?.student_id ?? "").trim();
  if (!studentId) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });

  const { data: student, error: sErr } = await supabase
    .from("students")
    .select("id,level,lifetime_points,is_competition_team")
    .eq("id", studentId)
    .maybeSingle();
  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });
  if (!student) return NextResponse.json({ ok: false, error: "Student not found" }, { status: 404 });

  const { data: badges, error: bErr } = await supabase
    .from("achievement_badges")
    .select("id,criteria_type,criteria_json,category")
    .eq("enabled", true)
    .eq("category", "prestige");
  if (bErr) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 });

  const [{ data: thresholds }, { data: settings }] = await Promise.all([
    supabase.from("avatar_level_thresholds").select("level,min_lifetime_points").order("level", { ascending: true }),
    supabase.from("avatar_level_settings").select("base_jump,difficulty_pct").limit(1).maybeSingle(),
  ]);

  const baseJump = Number(settings?.base_jump ?? 50);
  const difficultyPct = Number(settings?.difficulty_pct ?? 8);
  const levelRows: LevelRow[] =
    thresholds && thresholds.length ? (thresholds as LevelRow[]) : computeThresholds(baseJump, difficultyPct);
  const sortedLevels = levelRows.slice().sort((a, b) => a.level - b.level);
  const lifetimePoints = Number(student.lifetime_points ?? 0);
  let effectiveLevel = Number(student.level ?? 1);
  if (sortedLevels.length) {
    let lvl = 1;
    for (const row of sortedLevels) {
      if (lifetimePoints >= Number(row.min_lifetime_points ?? 0)) lvl = Number(row.level);
    }
    effectiveLevel = Math.max(lvl, 1);
  }

  const [
    { data: checkins, error: cErr },
    { data: challenges, error: chErr },
    { data: battles, error: bwErr },
    { data: awards, error: aErr },
    { data: medals, error: mErr },
    { data: taoluSessions, error: tErr },
  ] = await Promise.all([
    supabase.from("attendance_checkins").select("id,session_id").eq("student_id", studentId),
    supabase.from("student_challenges").select("id").eq("student_id", studentId).eq("completed", true),
    supabase.from("battle_trackers").select("id").eq("winner_id", studentId),
    supabase.from("class_awards").select("id").eq("student_id", studentId),
    supabase.from("student_medals").select("id").eq("student_id", studentId).eq("medal_type", "gold"),
    supabase.from("taolu_sessions").select("id").eq("student_id", studentId),
  ]);
  if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });
  if (chErr) return NextResponse.json({ ok: false, error: chErr.message }, { status: 500 });
  if (bwErr) return NextResponse.json({ ok: false, error: bwErr.message }, { status: 500 });
  if (aErr) return NextResponse.json({ ok: false, error: aErr.message }, { status: 500 });
  if (mErr) return NextResponse.json({ ok: false, error: mErr.message }, { status: 500 });
  if (tErr) return NextResponse.json({ ok: false, error: tErr.message }, { status: 500 });

  const { data: sets, error: setsErr } = await supabase.from("skill_sets").select("id,category,name");
  if (setsErr) return NextResponse.json({ ok: false, error: setsErr.message }, { status: 500 });

  const setIds = (sets ?? []).map((s: any) => String(s.id));
  let completedAllSets = new Map<string, number>();
  let completedTumbleSets = new Map<string, number>();
  let completedTaoluSets = new Map<string, number>();

  if (setIds.length) {
    const { data: skills, error: skErr } = await supabase.from("skills").select("id,set_id").in("set_id", setIds);
    if (skErr) return NextResponse.json({ ok: false, error: skErr.message }, { status: 500 });

    const { data: comps, error: compsErr } = await supabase
      .from("student_skills")
      .select("student_id,skill_id")
      .eq("student_id", studentId);
    if (compsErr) return NextResponse.json({ ok: false, error: compsErr.message }, { status: 500 });

    const skillRows = (skills ?? []) as SkillRow[];
    const completionRows = (comps ?? []) as CompletionRow[];
    completedAllSets = buildSetCompletionCount(skillRows, completionRows);

    const isTumbleSet = new Set(
      (sets ?? [])
        .filter((s: any) => String(s.category ?? "").toLowerCase().includes("tumble") || String(s.name ?? "").toLowerCase().includes("tumble"))
        .map((s: any) => String(s.id))
    );
    const isTaoluSet = new Set(
      (sets ?? [])
        .filter((s: any) => String(s.category ?? "").toLowerCase().includes("taolu") || String(s.name ?? "").toLowerCase().includes("taolu"))
        .map((s: any) => String(s.id))
    );

    const tumbleSkillRows = skillRows.filter((s) => isTumbleSet.has(s.set_id));
    const taoluSkillRows = skillRows.filter((s) => isTaoluSet.has(s.set_id));
    completedTumbleSets = buildSetCompletionCount(tumbleSkillRows, completionRows);
    completedTaoluSets = buildSetCompletionCount(taoluSkillRows, completionRows);
  }

  const progress: Record<
    string,
    { progress: number; current: number; target: number; detail?: string }
  > = {};

  const checkinRows = (checkins ?? []) as Array<{ id: string; session_id?: string | null }>;
  const checkinCount = checkinRows.length;
  let campCheckinCount = 0;

  const sessionIds = Array.from(
    new Set(checkinRows.map((row) => String(row.session_id ?? "").trim()).filter(Boolean))
  );
  if (sessionIds.length) {
    const { data: sessions, error: sErr } = await supabase
      .from("class_sessions")
      .select("id,instance_id")
      .in("id", sessionIds);
    if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });

    const instanceIds = Array.from(
      new Set((sessions ?? []).map((row: any) => String(row.instance_id ?? "").trim()).filter(Boolean))
    );
    if (instanceIds.length) {
      let { data: instances, error: iErr } = await supabase
        .from("class_schedule_instances")
        .select("id,entry_type")
        .in("id", instanceIds);
      if (iErr && String(iErr.message || "").includes("entry_type")) {
        const retry = await supabase
          .from("class_schedule_instances")
          .select("id")
          .in("id", instanceIds);
        instances = (retry.data ?? []).map((row: any) => ({ ...row, entry_type: null }));
        iErr = retry.error;
      }
      if (iErr) return NextResponse.json({ ok: false, error: iErr.message }, { status: 500 });

      const instanceType = new Map<string, string>();
      (instances ?? []).forEach((row: any) => {
        const id = String(row.id ?? "").trim();
        if (!id) return;
        instanceType.set(id, String(row.entry_type ?? ""));
      });

      const sessionType = new Map<string, string>();
      (sessions ?? []).forEach((row: any) => {
        const id = String(row.id ?? "").trim();
        const instanceId = String(row.instance_id ?? "").trim();
        if (!id || !instanceId) return;
        sessionType.set(id, instanceType.get(instanceId) ?? "");
      });

      campCheckinCount = checkinRows.reduce((acc, row) => {
        const entryType = sessionType.get(String(row.session_id ?? "").trim()) ?? "";
        if (entryType.toLowerCase() === "camp") return acc + 1;
        return acc;
      }, 0);
    }
  }
  const challengesCount = (challenges ?? []).length;
  const battleWins = (battles ?? []).length;
  const spotlightCount = (awards ?? []).length;
  const goldCount = (medals ?? []).length;
  const taoluTrackerCount = (taoluSessions ?? []).length;
  const allTreeCount = completedAllSets.get(studentId) ?? 0;
  const tumbleTreeCount = completedTumbleSets.get(studentId) ?? 0;
  const taoluTreeCount = completedTaoluSets.get(studentId) ?? 0;

  (badges ?? []).forEach((badge: any) => {
    const criteriaType = String(badge.criteria_type ?? "").trim().toLowerCase();
    const criteria = badge.criteria_json ?? {};
    const id = String(badge.id ?? "");
    if (!id) return;

    if (criteriaType === "comp_team") {
      const current = student.is_competition_team ? 1 : 0;
      progress[id] = { current, target: 1, progress: current ? 1 : 0, detail: current ? "Unlocked" : "Not on comp team" };
      return;
    }

    if (criteriaType === "lifetime_points") {
      const target = Number(criteria.min_points ?? criteria.min ?? 0);
      const current = Number(student.lifetime_points ?? 0);
      progress[id] = { current, target, progress: progressNumber(current, target) };
      return;
    }

    if (criteriaType === "level") {
      const target = Number(criteria.min ?? 0);
      const current = Number(effectiveLevel ?? 0);
      progress[id] = { current, target, progress: progressNumber(current, target) };
      return;
    }

    if (criteriaType === "checkins") {
      const target = Number(criteria.min ?? 0);
      progress[id] = { current: checkinCount, target, progress: progressNumber(checkinCount, target) };
      return;
    }

    if (criteriaType === "camp_checkins") {
      const target = Number(criteria.min ?? 0);
      progress[id] = { current: campCheckinCount, target, progress: progressNumber(campCheckinCount, target) };
      return;
    }

    if (criteriaType === "challenges_completed") {
      const target = Number(criteria.min ?? 0);
      progress[id] = { current: challengesCount, target, progress: progressNumber(challengesCount, target) };
      return;
    }

    if (criteriaType === "battle_pulse_wins") {
      const target = Number(criteria.min ?? 0);
      progress[id] = { current: battleWins, target, progress: progressNumber(battleWins, target) };
      return;
    }

    if (criteriaType === "spotlight_stars") {
      const target = Number(criteria.min ?? 0);
      progress[id] = { current: spotlightCount, target, progress: progressNumber(spotlightCount, target) };
      return;
    }

    if (criteriaType === "gold_medals") {
      const target = Number(criteria.min ?? 0);
      progress[id] = { current: goldCount, target, progress: progressNumber(goldCount, target) };
      return;
    }

    if (criteriaType === "skill_trees_completed") {
      const target = Number(criteria.min ?? 0);
      progress[id] = { current: allTreeCount, target, progress: progressNumber(allTreeCount, target) };
      return;
    }

    if (criteriaType === "tumble_skill_trees_completed" || criteriaType === "tumble_sets_completed") {
      const target = Number(criteria.min ?? criteria.min_sets ?? 0);
      progress[id] = { current: tumbleTreeCount, target, progress: progressNumber(tumbleTreeCount, target) };
      return;
    }

    if (criteriaType === "taolu_trackers_completed") {
      const target = Number(criteria.min ?? criteria.sessions_min ?? 0);
      progress[id] = { current: taoluTrackerCount, target, progress: progressNumber(taoluTrackerCount, target) };
      return;
    }

    if (criteriaType === "taolu_skill_trees_completed") {
      const target = Number(criteria.min ?? criteria.trees_min ?? 0);
      progress[id] = { current: taoluTreeCount, target, progress: progressNumber(taoluTreeCount, target) };
      return;
    }

    if (criteriaType === "taolu_master") {
      const trackerTarget = Number(criteria.trackers_min ?? criteria.sessions_min ?? 0);
      const treeTarget = Number(criteria.trees_min ?? 0);
      const trackerProgress = progressNumber(taoluTrackerCount, trackerTarget);
      const treeProgress = progressNumber(taoluTreeCount, treeTarget);
      const progressValue = Math.min(trackerProgress, treeProgress);
      const detail = `Taolu trackers ${taoluTrackerCount}/${trackerTarget} • Taolu skill trees ${taoluTreeCount}/${treeTarget}`;
      progress[id] = {
        current: Math.min(taoluTrackerCount, taoluTreeCount),
        target: Math.max(trackerTarget, treeTarget, 1),
        progress: progressValue,
        detail,
      };
      return;
    }
  });

  return NextResponse.json({ ok: true, progress });
}

import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase/server";

type StudentRow = {
  id: string;
  name: string | null;
  level: number | null;
  points_total: number | null;
  lifetime_points: number | null;
  is_competition_team: boolean | null;
};
type BoardRow = {
  student_id: string;
  name: string;
  points: number;
  level: number | null;
  is_competition_team: boolean;
  avatar_storage_path: string | null;
  avatar_bg: string | null;
  avatar_effect: string | null;
  rank?: number;
};

function buildThresholdsFromSettings(baseJump: number, difficultyPct: number, maxLevel = 20) {
  const rows: Array<{ level: number; min: number }> = [];
  for (let level = 1; level <= maxLevel; level += 1) {
    if (level === 1) {
      rows.push({ level, min: 0 });
      continue;
    }
    const raw = baseJump * Math.pow(1 + difficultyPct / 100, level - 1);
    const rounded = Math.round(raw / 5) * 5;
    rows.push({ level, min: Math.max(0, Math.floor(rounded)) });
  }
  return rows;
}

function topWithTies(rows: BoardRow[], higherIsBetter = true, limitRank = 10) {
  const sorted = rows.slice().sort((a, b) => {
    if (a.points === b.points) return String(a.name).localeCompare(String(b.name));
    return higherIsBetter ? b.points - a.points : a.points - b.points;
  });
  const out: BoardRow[] = [];
  let prevPoints: number | null = null;
  let prevRank = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    const row = sorted[i];
    const rank = prevPoints !== null && row.points === prevPoints ? prevRank : i + 1;
    prevPoints = row.points;
    prevRank = rank;
    if (rank > limitRank) break;
    out.push({ ...row, rank });
  }
  return out;
}

export async function GET() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const { data: students, error: sErr } = await supabase
    .from("students")
    .select("id,name,level,points_total,lifetime_points,is_competition_team");
  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });

  const rows = (students ?? []) as StudentRow[];
  const studentIds = rows.map((s) => s.id);
  let levelById = new Map(rows.map((s) => [s.id, Number(s.level ?? 1)]));

  const { data: levelRows } = await supabase
    .from("avatar_level_thresholds")
    .select("level,min_lifetime_points")
    .order("level", { ascending: true });
  const { data: levelSettings } = await supabase
    .from("avatar_level_settings")
    .select("base_jump,difficulty_pct")
    .eq("id", 1)
    .maybeSingle();
  const thresholds = (levelRows ?? [])
    .map((row: any) => ({ level: Number(row.level), min: Number(row.min_lifetime_points ?? 0) }))
    .filter((row: any) => Number.isFinite(row.level))
    .sort((a: any, b: any) => a.level - b.level);
  const effectiveThresholds = thresholds.length
    ? thresholds
    : buildThresholdsFromSettings(Number(levelSettings?.base_jump ?? 50), Number(levelSettings?.difficulty_pct ?? 8));
  if (effectiveThresholds.length) {
    levelById = new Map(
      rows.map((s) => {
        const points = Number(s.lifetime_points ?? 0);
        let nextLevel = Number(s.level ?? 1);
        effectiveThresholds.forEach((lvl) => {
          if (points >= lvl.min) nextLevel = lvl.level;
        });
        return [s.id, nextLevel];
      })
    );
  }

  const { data: settings, error: aErr } = await supabase
    .from("student_avatar_settings")
    .select("student_id,avatar_id,bg_color,particle_style")
    .in("student_id", studentIds);
  if (aErr) return NextResponse.json({ ok: false, error: aErr.message }, { status: 500 });

  const avatarIds = Array.from(
    new Set((settings ?? []).map((s: any) => String(s.avatar_id ?? "").trim()).filter(Boolean))
  );
  const avatarMap = new Map<string, { storage_path: string | null }>();
  if (avatarIds.length) {
    const { data: avatars, error: avErr } = await supabase
      .from("avatars")
      .select("id,storage_path")
      .in("id", avatarIds);
    if (avErr) return NextResponse.json({ ok: false, error: avErr.message }, { status: 500 });
    (avatars ?? []).forEach((a: any) => avatarMap.set(String(a.id), { storage_path: a.storage_path ?? null }));
  }

  const effectKeys = Array.from(
    new Set(
      (settings ?? [])
        .map((s: any) => String(s.particle_style ?? "").trim())
        .filter((key: string) => key && key !== "none")
    )
  );
  const effectByKey = new Map<string, { unlock_level: number; unlock_points: number; enabled: boolean }>();
  if (effectKeys.length) {
    const { data: effects, error: efErr } = await supabase
      .from("avatar_effects")
      .select("key,unlock_level,unlock_points,enabled")
      .in("key", effectKeys);
    if (efErr) return NextResponse.json({ ok: false, error: efErr.message }, { status: 500 });
    (effects ?? []).forEach((e: any) =>
      effectByKey.set(String(e.key), {
        unlock_level: Number(e.unlock_level ?? 1),
        unlock_points: Number(e.unlock_points ?? 0),
        enabled: e.enabled !== false,
      })
    );
  }

  const effectUnlocksByStudent = new Map<string, Set<string>>();
  if (studentIds.length) {
    const { data: unlockRows, error: uErr } = await supabase
      .from("student_custom_unlocks")
      .select("student_id,item_type,item_key")
      .in("student_id", studentIds)
      .eq("item_type", "effect");
    if (uErr) return NextResponse.json({ ok: false, error: uErr.message }, { status: 500 });
    (unlockRows ?? []).forEach((row: any) => {
      const sid = String(row.student_id ?? "");
      const key = String(row.item_key ?? "");
      if (!sid || !key) return;
      const set = effectUnlocksByStudent.get(sid) ?? new Set<string>();
      set.add(key);
      effectUnlocksByStudent.set(sid, set);
    });
  }

  const avatarByStudent = new Map<string, { storage_path: string | null; bg_color: string | null; particle_style: string | null }>();
  (settings ?? []).forEach((s: any) => {
    const id = String(s.student_id ?? "");
    const avatarId = String(s.avatar_id ?? "");
    const avatar = avatarMap.get(avatarId) ?? { storage_path: null };
    const effectKey = String(s.particle_style ?? "").trim();
    const effect = effectKey ? effectByKey.get(effectKey) : null;
    const level = levelById.get(id) ?? 1;
    const effectUnlocked = effect && effect.unlock_points > 0
      ? (effectUnlocksByStudent.get(id)?.has(effectKey) ?? false)
      : true;
    const effectOk = effect && effect.enabled && level >= effect.unlock_level && effectUnlocked;
    avatarByStudent.set(id, {
      storage_path: avatar.storage_path ?? null,
      bg_color: s.bg_color ?? null,
      particle_style: effectOk ? effectKey || null : null,
    });
  });

  const weekStart = getWeekStartUTC(new Date()).toISOString();
  const { data: ledger, error: lErr } = await supabase
    .from("ledger")
    .select("student_id,points,created_at,category")
    .gte("created_at", weekStart);
  if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });

  const weekly = new Map<string, number>();
  (ledger ?? []).forEach((row: any) => {
    const id = String(row.student_id ?? "");
    if (!id) return;
    const category = String(row.category ?? "").toLowerCase();
    if (
      category === "redeem_daily" ||
      category === "avatar_daily" ||
      category === "redeem_camp_role" ||
      category === "redeem_event_daily" ||
      category === "roulette_spin" ||
      category === "roulette"
    ) return;
    const points = Number(row.points ?? 0);
    weekly.set(id, (weekly.get(id) ?? 0) + points);
  });

  const pack = rows.map((s) => {
    const avatar = avatarByStudent.get(s.id) ?? { storage_path: null, bg_color: null, particle_style: null };
    return {
      student_id: s.id,
      name: s.name ?? "Student",
      level: levelById.get(s.id) ?? s.level ?? 0,
      points_total: Number(s.points_total ?? 0),
      lifetime_points: Number(s.lifetime_points ?? 0),
      weekly_points: weekly.get(s.id) ?? 0,
      is_competition_team: !!s.is_competition_team,
      avatar_storage_path: avatar.storage_path,
      avatar_bg: avatar.bg_color,
      avatar_effect: avatar.particle_style ?? null,
    };
  });

  const top = (list: typeof pack, key: "points_total" | "lifetime_points" | "weekly_points") =>
    topWithTies(
      list.map((r) => ({
        student_id: r.student_id,
        name: r.name,
        points: r[key],
        level: r.level,
        is_competition_team: r.is_competition_team,
        avatar_storage_path: r.avatar_storage_path,
        avatar_bg: r.avatar_bg,
        avatar_effect: r.avatar_effect ?? null,
      })),
      true,
      10
    );

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const skillPulseRepsToday = new Map<string, number>();
  const skillTrackerLogsRes = await supabase
    .from("skill_tracker_logs")
    .select("tracker_id,created_at,success")
    .gte("created_at", todayStart.toISOString());
  if (skillTrackerLogsRes.error) {
    return NextResponse.json({ ok: false, error: skillTrackerLogsRes.error.message }, { status: 500 });
  }
  const trackerIds = Array.from(
    new Set((skillTrackerLogsRes.data ?? []).map((row: any) => String(row?.tracker_id ?? "")).filter(Boolean))
  );
  const trackerToStudent = new Map<string, string>();
  if (trackerIds.length) {
    const trackerRes = await supabase
      .from("skill_trackers")
      .select("id,student_id")
      .in("id", trackerIds);
    if (trackerRes.error) return NextResponse.json({ ok: false, error: trackerRes.error.message }, { status: 500 });
    (trackerRes.data ?? []).forEach((row: any) => {
      const tid = String(row?.id ?? "");
      const sid = String(row?.student_id ?? "");
      if (!tid || !sid) return;
      trackerToStudent.set(tid, sid);
    });
  }
  (skillTrackerLogsRes.data ?? []).forEach((row: any) => {
    if (row?.success !== true) return;
    const sid = trackerToStudent.get(String(row?.tracker_id ?? "")) ?? "";
    if (!sid) return;
    skillPulseRepsToday.set(sid, (skillPulseRepsToday.get(sid) ?? 0) + 1);
  });

  const battleLogsRes = await supabase
    .from("battle_tracker_logs")
    .select("student_id,created_at,success")
    .gte("created_at", todayStart.toISOString());
  if (battleLogsRes.error) {
    return NextResponse.json({ ok: false, error: battleLogsRes.error.message }, { status: 500 });
  }
  (battleLogsRes.data ?? []).forEach((row: any) => {
    if (row?.success !== true) return;
    const sid = String(row?.student_id ?? "");
    if (!sid) return;
    skillPulseRepsToday.set(sid, (skillPulseRepsToday.get(sid) ?? 0) + 1);
  });

  const topSkillPulseRepsToday = topWithTies(
    [...pack]
    .map((r) => ({
      student_id: r.student_id,
      name: r.name,
      points: skillPulseRepsToday.get(r.student_id) ?? 0,
      level: r.level,
      is_competition_team: r.is_competition_team,
      avatar_storage_path: r.avatar_storage_path,
      avatar_bg: r.avatar_bg,
      avatar_effect: r.avatar_effect ?? null,
    }))
    .filter((row) => Number(row.points ?? 0) > 0),
    true,
    10
  );

  const taoluTodayByStudent = new Map<string, number>();
  const taoluRes = await supabase
    .from("taolu_sessions")
    .select("student_id,created_at")
    .gte("created_at", todayStart.toISOString());
  if (!taoluRes.error) {
    (taoluRes.data ?? []).forEach((row: any) => {
      const sid = String(row?.student_id ?? "");
      if (!sid) return;
      taoluTodayByStudent.set(sid, (taoluTodayByStudent.get(sid) ?? 0) + 1);
    });
  }

  const refinementRes = await supabase
    .from("taolu_refinement_rounds")
    .select("student_id,created_at")
    .gte("created_at", todayStart.toISOString());
  if (!refinementRes.error) {
    (refinementRes.data ?? []).forEach((row: any) => {
      const sid = String(row?.student_id ?? "");
      if (!sid) return;
      taoluTodayByStudent.set(sid, (taoluTodayByStudent.get(sid) ?? 0) + 1);
    });
  }

  const prepsRefinementRes = await supabase
    .from("preps_remediations")
    .select("student_id,completed_at")
    .gte("completed_at", todayStart.toISOString());
  if (!prepsRefinementRes.error) {
    (prepsRefinementRes.data ?? []).forEach((row: any) => {
      const sid = String(row?.student_id ?? "");
      if (!sid) return;
      taoluTodayByStudent.set(sid, (taoluTodayByStudent.get(sid) ?? 0) + 1);
    });
  }

  const topTaoluToday = topWithTies(
    [...pack]
      .map((r) => ({
        student_id: r.student_id,
        name: r.name,
        points: taoluTodayByStudent.get(r.student_id) ?? 0,
        level: r.level,
        is_competition_team: r.is_competition_team,
        avatar_storage_path: r.avatar_storage_path,
        avatar_bg: r.avatar_bg,
        avatar_effect: r.avatar_effect ?? null,
      }))
      .filter((row) => Number(row.points ?? 0) > 0),
    true,
    10
  );

  const { data: mvpRows, error: mvpErr } = await supabase
    .from("battle_mvp_awards")
    .select("student_id");
  if (mvpErr) return NextResponse.json({ ok: false, error: mvpErr.message }, { status: 500 });
  const mvpCounts = new Map<string, number>();
  (mvpRows ?? []).forEach((row: any) => {
    const id = String(row.student_id ?? "");
    if (!id) return;
    mvpCounts.set(id, (mvpCounts.get(id) ?? 0) + 1);
  });
  const topMvp = topWithTies(
    [...pack]
    .map((r) => ({
      student_id: r.student_id,
      name: r.name,
      points: mvpCounts.get(r.student_id) ?? 0,
      level: r.level,
      is_competition_team: r.is_competition_team,
      avatar_storage_path: r.avatar_storage_path,
      avatar_bg: r.avatar_bg,
      avatar_effect: r.avatar_effect ?? null,
    })),
    true,
    10
  );

  const leaderboards: Record<string, BoardRow[]> = {
    total: top(pack, "points_total"),
    weekly: top(pack, "weekly_points"),
    lifetime: top(pack, "lifetime_points"),
    skill_pulse_today: topSkillPulseRepsToday,
    skill_pulse_reps_today: topSkillPulseRepsToday,
    taolu_today: topTaoluToday,
    mvp: topMvp,
  };
  const leaderboard_labels: Record<string, string> = {
    total: "Total Points",
    weekly: "Weekly Points",
    lifetime: "Lifetime Points",
    skill_pulse_today: "Skill Pulse Successes Today",
    skill_pulse_reps_today: "Skill Pulse Successes Today",
    taolu_today: "Taolu Tracker Sessions Today",
    mvp: "Battle MVP",
  };
  const leaderboard_minimums: Record<string, number> = {
    total: 0,
    weekly: 0,
    lifetime: 0,
    skill_pulse_today: 0,
    skill_pulse_reps_today: 0,
    taolu_today: 0,
    mvp: 0,
  };

  const { data: stats, error: statsErr } = await supabase
    .from("stats")
    .select("id,name,higher_is_better,minimum_value_for_ranking");
  if (statsErr) return NextResponse.json({ ok: false, error: statsErr.message }, { status: 500 });

  const packMap = new Map(pack.map((p) => [p.student_id, p]));
  for (const stat of stats ?? []) {
    const statId = String((stat as any)?.id ?? "").trim();
    if (!statId) continue;
    const higherIsBetter = (stat as any)?.higher_is_better !== false;
    const minValue = Math.max(0, Number((stat as any)?.minimum_value_for_ranking ?? 0) || 0);
    const { data: statRows, error: statRowsErr } = await supabase
      .from("student_stats")
      .select("student_id,value,recorded_at")
      .eq("stat_id", statId);
    if (statRowsErr) continue;

    const bestByStudent = new Map<string, { value: number; recorded_at: string }>();
    (statRows ?? []).forEach((row: any) => {
      const studentId = String(row?.student_id ?? "");
      if (!studentId) return;
      const value = Number(row?.value ?? 0);
      const recordedAt = String(row?.recorded_at ?? "");
      const existing = bestByStudent.get(studentId);
      if (!existing) {
        bestByStudent.set(studentId, { value, recorded_at: recordedAt });
        return;
      }
      const isBetter = higherIsBetter ? value > existing.value : value < existing.value;
      const isTieNewer = value === existing.value && recordedAt > existing.recorded_at;
      if (isBetter || isTieNewer) bestByStudent.set(studentId, { value, recorded_at: recordedAt });
    });

    const boardKey = `performance_stat:${statId}`;
    leaderboard_labels[boardKey] = String((stat as any)?.name ?? "Performance Stat");
    leaderboard_minimums[boardKey] = minValue;
    leaderboards[boardKey] = topWithTies(
      Array.from(bestByStudent.entries())
      .map(([studentId, best]) => {
        const base = packMap.get(studentId);
        return {
          student_id: studentId,
          name: base?.name ?? "Student",
          points: Number(best.value ?? 0),
          level: base?.level ?? 1,
          is_competition_team: !!base?.is_competition_team,
          avatar_storage_path: base?.avatar_storage_path ?? null,
          avatar_bg: base?.avatar_bg ?? null,
          avatar_effect: base?.avatar_effect ?? null,
        };
      }).filter((row) => Number(row.points ?? 0) > 0 && Number(row.points ?? 0) >= minValue),
      higherIsBetter,
      10
    );
  }

  return NextResponse.json({
    ok: true,
    leaderboards,
    leaderboard_labels,
    leaderboard_minimums,
  });
}

function getWeekStartUTC(now: Date) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

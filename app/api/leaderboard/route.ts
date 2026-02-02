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
  const levelById = new Map(rows.map((s) => [s.id, Number(s.level ?? 1)]));

  const { data: settings, error: aErr } = await supabase
    .from("student_avatar_settings")
    .select("student_id,avatar_id,bg_color,particle_style")
    .in("student_id", studentIds);
  if (aErr) return NextResponse.json({ ok: false, error: aErr.message }, { status: 500 });

  const avatarIds = Array.from(
    new Set((settings ?? []).map((s: any) => String(s.avatar_id ?? "").trim()).filter(Boolean))
  );
  let avatarMap = new Map<string, { storage_path: string | null }>();
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
    .select("student_id,points,created_at")
    .gte("created_at", weekStart);
  if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });

  const weekly = new Map<string, number>();
  (ledger ?? []).forEach((row: any) => {
    const id = String(row.student_id ?? "");
    if (!id) return;
    const points = Number(row.points ?? 0);
    weekly.set(id, (weekly.get(id) ?? 0) + points);
  });

  const pack = rows.map((s) => {
    const avatar = avatarByStudent.get(s.id) ?? { storage_path: null, bg_color: null, particle_style: null };
    return {
      student_id: s.id,
      name: s.name ?? "Student",
      level: s.level ?? 0,
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
    [...list]
      .sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0))
      .slice(0, 10)
      .map((r) => ({
        student_id: r.student_id,
        name: r.name,
        points: r[key],
        level: r.level,
      is_competition_team: r.is_competition_team,
      avatar_storage_path: r.avatar_storage_path,
      avatar_bg: r.avatar_bg,
      avatar_effect: r.avatar_effect ?? null,
    }));

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { data: skillPulseLedger, error: spErr } = await supabase
    .from("ledger")
    .select("student_id,points,category,note")
    .gte("created_at", todayStart.toISOString())
    .or("category.eq.skill_pulse,note.ilike.Battle Pulse win%");
  if (spErr) return NextResponse.json({ ok: false, error: spErr.message }, { status: 500 });

  const skillPulseToday = new Map<string, number>();
  (skillPulseLedger ?? []).forEach((row: any) => {
    const id = String(row.student_id ?? "");
    const pts = Number(row.points ?? 0);
    if (!id || pts <= 0) return;
    skillPulseToday.set(id, (skillPulseToday.get(id) ?? 0) + pts);
  });

  const topSkillPulseToday = [...pack]
    .map((r) => ({
      student_id: r.student_id,
      name: r.name,
      points: skillPulseToday.get(r.student_id) ?? 0,
      level: r.level,
      is_competition_team: r.is_competition_team,
      avatar_storage_path: r.avatar_storage_path,
      avatar_bg: r.avatar_bg,
      avatar_effect: r.avatar_effect ?? null,
    }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 10);

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
  const topMvp = [...pack]
    .map((r) => ({
      student_id: r.student_id,
      name: r.name,
      points: mvpCounts.get(r.student_id) ?? 0,
      level: r.level,
      is_competition_team: r.is_competition_team,
      avatar_storage_path: r.avatar_storage_path,
      avatar_bg: r.avatar_bg,
      avatar_effect: r.avatar_effect ?? null,
    }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 10);

  return NextResponse.json({
    ok: true,
    leaderboards: {
      total: top(pack, "points_total"),
      weekly: top(pack, "weekly_points"),
      lifetime: top(pack, "lifetime_points"),
      skill_pulse_today: topSkillPulseToday,
      mvp: topMvp,
    },
  });
}

function getWeekStartUTC(now: Date) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

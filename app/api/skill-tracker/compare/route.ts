import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

type TrackerRow = {
  id: string;
  student_id: string;
  repetitions_target: number;
  created_at: string;
};

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const student_ids = Array.isArray(body?.student_ids) ? body.student_ids.map(String) : [];
  const skill_id = String(body?.skill_id ?? "").trim();
  const limit = Math.max(1, Math.min(50, Number(body?.limit ?? 30)));

  if (!student_ids.length || !skill_id) {
    return NextResponse.json({ ok: false, error: "Missing student_ids/skill_id" }, { status: 400 });
  }

  const { data: students, error: sErr } = await supabase
    .from("students")
    .select("id,name,is_competition_team,level")
    .in("id", student_ids);
  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });

  const { data: settings, error: aErr } = await supabase
    .from("student_avatar_settings")
    .select("student_id,avatar_id,bg_color,particle_style")
    .in("student_id", student_ids);
  if (aErr) return NextResponse.json({ ok: false, error: aErr.message }, { status: 500 });

  const avatarIds = Array.from(new Set((settings ?? []).map((s: any) => String(s.avatar_id ?? "").trim()).filter(Boolean)));
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
  if (student_ids.length) {
    const { data: unlockRows, error: uErr } = await supabase
      .from("student_custom_unlocks")
      .select("student_id,item_type,item_key")
      .in("student_id", student_ids)
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
    const level = Number((students ?? []).find((row: any) => String(row.id) === id)?.level ?? 1);
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

  const { data: trackers, error: tErr } = await supabase
    .from("skill_trackers")
    .select("id,student_id,repetitions_target,created_at")
    .in("student_id", student_ids)
    .eq("skill_id", skill_id)
    .order("created_at", { ascending: true });
  if (tErr) return NextResponse.json({ ok: false, error: tErr.message }, { status: 500 });

  const trackerRows = (trackers ?? []) as TrackerRow[];
  const ids = trackerRows.map((t) => t.id);
  if (!ids.length) return NextResponse.json({ ok: true, series: [] });

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
    const next = {
      successes: prev.successes + ((row as any)?.success ? 1 : 0),
      attempts: prev.attempts + 1,
      last_at: String((row as any)?.created_at ?? prev.last_at),
    };
    logMap.set(tid, next);
  }

  const studentMap = new Map<string, { name: string; avatar_storage_path: string | null; avatar_bg: string | null; avatar_effect: string | null; is_competition_team: boolean }>();
  (students ?? []).forEach((s: any) => {
    const id = String(s.id);
    const avatar = avatarByStudent.get(id) ?? { storage_path: null, bg_color: null, particle_style: null };
    studentMap.set(id, {
      name: s.name,
      avatar_storage_path: avatar.storage_path,
      avatar_bg: avatar.bg_color,
      avatar_effect: avatar.particle_style ?? null,
      is_competition_team: !!s.is_competition_team,
    });
  });

  const byStudent = new Map<
    string,
    Array<{ created_at: string; rate: number; successes: number; attempts: number; is_battle?: boolean; vs_name?: string | null }>
  >();
  trackerRows.forEach((t) => {
    const counts = logMap.get(t.id) ?? { successes: 0, attempts: 0, last_at: "" };
    if (!counts.attempts) return;
    const rate = Math.round((counts.successes / counts.attempts) * 100);
    const point = {
      created_at: counts.last_at || t.created_at,
      rate,
      successes: counts.successes,
      attempts: counts.attempts,
      is_battle: false,
      vs_name: null,
    };
    const arr = byStudent.get(t.student_id) ?? [];
    arr.push(point);
    byStudent.set(t.student_id, arr);
  });

  const { data: battles, error: bErr } = await supabase
    .from("battle_trackers")
    .select("id,left_student_id,right_student_id,skill_id,repetitions_target,created_at")
    .eq("skill_id", skill_id)
    .or(`left_student_id.in.(${student_ids.join(",")}),right_student_id.in.(${student_ids.join(",")})`);
  if (bErr) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 });

  const battleRows = (battles ?? []) as any[];
  const battleIds = battleRows.map((b) => b.id);
  if (battleIds.length) {
    const { data: bLogs, error: blErr } = await supabase
      .from("battle_tracker_logs")
      .select("battle_id,student_id,success,created_at")
      .in("battle_id", battleIds);
    if (blErr) return NextResponse.json({ ok: false, error: blErr.message }, { status: 500 });

    const nameById = new Map<string, string>();
    (students ?? []).forEach((s: any) => nameById.set(String(s.id), String(s.name ?? "Opponent")));

    for (const b of battleRows) {
      const leftId = String(b.left_student_id ?? "");
      const rightId = String(b.right_student_id ?? "");
      const leftLogs = (bLogs ?? []).filter((l: any) => l.battle_id === b.id && l.student_id === leftId);
      const rightLogs = (bLogs ?? []).filter((l: any) => l.battle_id === b.id && l.student_id === rightId);

      if (leftLogs.length) {
        const attempts = leftLogs.length;
        const successes = leftLogs.filter((l: any) => l.success).length;
        const lastAt = leftLogs.map((l: any) => String(l.created_at ?? "")).sort().slice(-1)[0];
        const rate = attempts ? Math.round((successes / attempts) * 100) : 0;
        const arr = byStudent.get(leftId) ?? [];
        arr.push({
          created_at: lastAt || b.created_at,
          rate,
          successes,
          attempts,
          is_battle: true,
          vs_name: nameById.get(rightId) ?? "Opponent",
        });
        byStudent.set(leftId, arr);
      }

      if (rightLogs.length) {
        const attempts = rightLogs.length;
        const successes = rightLogs.filter((l: any) => l.success).length;
        const lastAt = rightLogs.map((l: any) => String(l.created_at ?? "")).sort().slice(-1)[0];
        const rate = attempts ? Math.round((successes / attempts) * 100) : 0;
        const arr = byStudent.get(rightId) ?? [];
        arr.push({
          created_at: lastAt || b.created_at,
          rate,
          successes,
          attempts,
          is_battle: true,
          vs_name: nameById.get(leftId) ?? "Opponent",
        });
        byStudent.set(rightId, arr);
      }
    }
  }

  const series = Array.from(byStudent.entries()).map(([student_id, points]) => {
    const sorted = points.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    const meta = studentMap.get(student_id);
    return {
      student_id,
      student_name: meta?.name ?? "Student",
      avatar_storage_path: meta?.avatar_storage_path ?? null,
      avatar_bg: meta?.avatar_bg ?? null,
      avatar_effect: meta?.avatar_effect ?? null,
      is_competition_team: meta?.is_competition_team ?? false,
      points: sorted.slice(-limit),
    };
  });

  return NextResponse.json({ ok: true, series });
}

import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

type TrackerRow = {
  id: string;
  group_id?: string | null;
  student_id: string;
  skill_id: string;
  repetitions_target: number;
  created_at: string;
  created_by?: string | null;
  students?: { id: string; name: string } | null;
  tracker_skills?: { id: string; name: string; category?: string | null } | null;
};

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

export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const url = new URL(req.url);
  const student_id = String(url.searchParams.get("student_id") ?? "").trim();
  const source = String(url.searchParams.get("source") ?? "").trim().toLowerCase();

  let q = supabase
    .from("skill_trackers")
    .select(
      "id,student_id,skill_id,repetitions_target,created_at,archived_at,group_id,created_by,created_source,students(id,name,level,points_total,lifetime_points,is_competition_team),tracker_skills(id,name,category,failure_reasons)"
    )
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (student_id) q = q.eq("student_id", student_id);
  if (source) q = q.eq("created_source", source);

  const { data, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const rows = (data ?? []) as unknown as TrackerRow[];
  const ids = rows.map((r) => r.id);
  const creatorIds = Array.from(new Set(rows.map((r) => String(r.created_by ?? "")).filter(Boolean)));
  const creatorRoleById = new Map<string, string>();
  if (creatorIds.length) {
    const { data: creatorRoles, error: crErr } = await supabase
      .from("user_roles")
      .select("user_id,role")
      .in("user_id", creatorIds);
    if (crErr) return NextResponse.json({ ok: false, error: crErr.message }, { status: 500 });
    const byUser = new Map<string, string[]>();
    (creatorRoles ?? []).forEach((row: any) => {
      const uid = String(row.user_id ?? "");
      const role = String(row.role ?? "").toLowerCase();
      if (!uid || !role) return;
      byUser.set(uid, [...(byUser.get(uid) ?? []), role]);
    });
    creatorIds.forEach((uid) => {
      const roles = byUser.get(uid) ?? [];
      if (roles.includes("skill_user")) return creatorRoleById.set(uid, "skill_user");
      if (roles.includes("skill_pulse")) return creatorRoleById.set(uid, "skill_pulse");
      if (roles.includes("coach")) return creatorRoleById.set(uid, "coach");
      if (roles.includes("admin")) return creatorRoleById.set(uid, "admin");
      if (roles.length) creatorRoleById.set(uid, roles[0]);
    });
  }

  const logMap = new Map<string, { attempts: number; successes: number; events: Array<{ success: boolean; created_at: string }> }>();
  const lifetimeMap = new Map<string, { attempts: number; successes: number }>();
  const last30Map = new Map<string, { attempts: number; successes: number }>();
  const pointsMap = new Map<string, number>();
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  if (ids.length) {
    const { data: logs, error: lErr } = await supabase
      .from("skill_tracker_logs")
      .select("id,tracker_id,success,created_at,failure_reason")
      .in("tracker_id", ids);
    if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });

    for (const row of logs ?? []) {
      const tid = String((row as any)?.tracker_id ?? "");
      if (!tid) continue;
      const prev = logMap.get(tid) ?? { attempts: 0, successes: 0, events: [] };
      const createdAt = String((row as any)?.created_at ?? "");
      const next = {
        attempts: prev.attempts + 1,
        successes: prev.successes + ((row as any)?.success ? 1 : 0),
        events: [
          ...prev.events,
          {
            id: String((row as any)?.id ?? ""),
            success: !!(row as any)?.success,
            created_at: createdAt,
            failure_reason: String((row as any)?.failure_reason ?? ""),
          },
        ],
      };
      logMap.set(tid, next);

    }
  }

  if (ids.length) {
    const { data: ledgerRows } = await supabase
      .from("ledger")
      .select("source_id,points")
      .eq("source_type", "skill_tracker")
      .in("source_id", ids);
    (ledgerRows ?? []).forEach((row: any) => {
      const sid = String(row.source_id ?? "");
      if (!sid) return;
      const prev = pointsMap.get(sid) ?? 0;
      const pts = Number(row.points ?? 0);
      pointsMap.set(sid, prev + (Number.isNaN(pts) ? 0 : pts));
    });
  }

  const studentIds = Array.from(new Set(rows.map((r) => r.student_id)));
  const skillIds = Array.from(new Set(rows.map((r) => r.skill_id)));
  if (studentIds.length && skillIds.length) {
    const { data: allTrackers, error: atErr } = await supabase
      .from("skill_trackers")
      .select("id,student_id,skill_id")
      .in("student_id", studentIds)
      .in("skill_id", skillIds);
    if (atErr) return NextResponse.json({ ok: false, error: atErr.message }, { status: 500 });

    const allTrackerIds = (allTrackers ?? []).map((t: any) => String(t.id)).filter(Boolean);
    const trackerMeta = new Map<string, { student_id: string; skill_id: string }>();
    (allTrackers ?? []).forEach((t: any) => {
      trackerMeta.set(String(t.id), { student_id: String(t.student_id), skill_id: String(t.skill_id) });
    });

    if (allTrackerIds.length) {
      const { data: allLogs, error: alErr } = await supabase
        .from("skill_tracker_logs")
        .select("tracker_id,success,created_at")
        .in("tracker_id", allTrackerIds);
      if (alErr) return NextResponse.json({ ok: false, error: alErr.message }, { status: 500 });

      for (const row of allLogs ?? []) {
        const tid = String((row as any)?.tracker_id ?? "");
        const meta = trackerMeta.get(tid);
        if (!meta) continue;
        const key = `${meta.student_id}::${meta.skill_id}`;
        const lifePrev = lifetimeMap.get(key) ?? { attempts: 0, successes: 0 };
        lifetimeMap.set(key, {
          attempts: lifePrev.attempts + 1,
          successes: lifePrev.successes + ((row as any)?.success ? 1 : 0),
        });
        const createdAt = String((row as any)?.created_at ?? "");
        const createdMs = createdAt ? Date.parse(createdAt) : 0;
        if (createdMs && createdMs >= cutoff) {
          const lastPrev = last30Map.get(key) ?? { attempts: 0, successes: 0 };
          last30Map.set(key, {
            attempts: lastPrev.attempts + 1,
            successes: lastPrev.successes + ((row as any)?.success ? 1 : 0),
          });
        }
      }
    }

    const { data: battles, error: bErr } = await supabase
      .from("battle_trackers")
      .select("id,skill_id,left_student_id,right_student_id,battle_mode")
      .in("skill_id", skillIds);
    if (bErr) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 });

    // Filter server results client-side to avoid constructing an invalid `.or()` string
    // when student IDs are non-numeric/need quoting. This prevents runtime 500s.
    const battleRows = (battles ?? []).filter((b: any) =>
      studentIds.includes(String(b.left_student_id)) || studentIds.includes(String(b.right_student_id))
    ) as any[];
    const battleIds = battleRows.map((b) => String(b.id)).filter(Boolean);
    const battleMeta = new Map<string, { skill_id: string; battle_mode: string }>();
    battleRows.forEach((b) =>
      battleMeta.set(String(b.id), {
        skill_id: String(b.skill_id),
        battle_mode: String(b.battle_mode ?? "duel"),
      })
    );

    if (battleIds.length) {
      const { data: bLogs, error: blErr } = await supabase
        .from("battle_tracker_logs")
        .select("battle_id,student_id,success,created_at")
        .in("battle_id", battleIds);
      if (blErr) return NextResponse.json({ ok: false, error: blErr.message }, { status: 500 });

      for (const row of bLogs ?? []) {
        const bid = String((row as any)?.battle_id ?? "");
        const sid = String((row as any)?.student_id ?? "");
        if (!bid || !sid || !studentIds.includes(sid)) continue;
        const meta = battleMeta.get(bid);
        if (!meta) continue;
        if (meta.battle_mode === "teams") continue;
        const key = `${sid}::${meta.skill_id}`;
        const lifePrev = lifetimeMap.get(key) ?? { attempts: 0, successes: 0 };
        lifetimeMap.set(key, {
          attempts: lifePrev.attempts + 1,
          successes: lifePrev.successes + ((row as any)?.success ? 1 : 0),
        });
        const createdAt = String((row as any)?.created_at ?? "");
        const createdMs = createdAt ? Date.parse(createdAt) : 0;
        if (createdMs && createdMs >= cutoff) {
          const lastPrev = last30Map.get(key) ?? { attempts: 0, successes: 0 };
          last30Map.set(key, {
            attempts: lastPrev.attempts + 1,
            successes: lastPrev.successes + ((row as any)?.success ? 1 : 0),
          });
        }
      }
    }
  }

  const trackersByPair = new Map<string, string[]>();
  for (const row of rows) {
    const key = `${row.student_id}::${row.skill_id}`;
    const prev = trackersByPair.get(key) ?? [];
    prev.push(row.id);
    trackersByPair.set(key, prev);
  }
  const lastRateByTrackerId = new Map<string, number>();
  trackersByPair.forEach((ids) => {
    ids.forEach((trackerId, idx) => {
      let lastRate = 0;
      for (let i = idx + 1; i < ids.length; i += 1) {
        const nextId = ids[i];
        const counts = logMap.get(nextId) ?? { attempts: 0, successes: 0 };
        if (counts.attempts) {
          lastRate = Math.round((counts.successes / counts.attempts) * 100);
          break;
        }
      }
      lastRateByTrackerId.set(trackerId, lastRate);
    });
  });

  const [{ data: thresholds }, { data: settings }] = await Promise.all([
    supabase.from("avatar_level_thresholds").select("level,min_lifetime_points").order("level", { ascending: true }),
    supabase.from("avatar_level_settings").select("base_jump,difficulty_pct").limit(1).maybeSingle(),
  ]);
  const baseJump = Number(settings?.base_jump ?? 50);
  const difficultyPct = Number(settings?.difficulty_pct ?? 8);
  const levelRows: LevelRow[] =
    thresholds && thresholds.length ? (thresholds as LevelRow[]) : computeThresholds(baseJump, difficultyPct);
  const sortedLevels = levelRows.slice().sort((a, b) => a.level - b.level);

  const effectiveLevelByStudent = new Map<string, number>();
  rows.forEach((r) => {
    const sid = String(r.student_id ?? "");
    if (!sid || effectiveLevelByStudent.has(sid)) return;
    const lifetimePoints = Number((r.students as any)?.lifetime_points ?? 0);
    let lvl = Number((r.students as any)?.level ?? 1);
    if (sortedLevels.length) {
      let nextLevel = 1;
      for (const row of sortedLevels) {
        if (lifetimePoints >= Number(row.min_lifetime_points ?? 0)) nextLevel = Number(row.level);
      }
      lvl = Math.max(nextLevel, 1);
    }
    effectiveLevelByStudent.set(sid, lvl);
  });

  const { data: avatarSettings, error: aErr } = await supabase
    .from("student_avatar_settings")
    .select("student_id,avatar_id,bg_color,particle_style,corner_border_key,card_plate_key")
    .in("student_id", studentIds);
  if (aErr) return NextResponse.json({ ok: false, error: aErr.message }, { status: 500 });

  const avatarIds = Array.from(new Set((avatarSettings ?? []).map((s: any) => String(s.avatar_id ?? "").trim()).filter(Boolean)));
  const borderKeys = Array.from(
    new Set((avatarSettings ?? []).map((s: any) => String(s.corner_border_key ?? "").trim()).filter(Boolean))
  );
  const plateKeys = Array.from(
    new Set((avatarSettings ?? []).map((s: any) => String(s.card_plate_key ?? "").trim()).filter(Boolean))
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

  const borderByKey = new Map<string, {
    image_url: string | null;
    render_mode?: string | null;
    html?: string | null;
    css?: string | null;
    js?: string | null;
    offset_x?: number | null;
    offset_y?: number | null;
    offsets_by_context?: Record<string, { x?: number | null; y?: number | null; scale?: number | null }> | null;
    unlock_level: number;
    unlock_points: number;
    enabled: boolean;
  }>();
  if (borderKeys.length) {
    const { data: borders, error: bErr } = await supabase
      .from("ui_corner_borders")
      .select("key,image_url,render_mode,html,css,js,offset_x,offset_y,offsets_by_context,unlock_level,unlock_points,enabled")
      .in("key", borderKeys);
    if (bErr) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 });
    (borders ?? []).forEach((b: any) => {
      borderByKey.set(String(b.key), {
        image_url: b.image_url ?? null,
        render_mode: b.render_mode ?? "image",
        html: b.html ?? "",
        css: b.css ?? "",
        js: b.js ?? "",
        offset_x: Number(b.offset_x ?? 0),
        offset_y: Number(b.offset_y ?? 0),
        offsets_by_context: b.offsets_by_context ?? {},
        unlock_level: Number(b.unlock_level ?? 1),
        unlock_points: Number(b.unlock_points ?? 0),
        enabled: b.enabled !== false,
      });
    });
  }

  const plateByKey = new Map<string, { image_url: string | null; unlock_level: number; unlock_points: number; enabled: boolean }>();
  if (plateKeys.length) {
    const { data: plates, error: pErr } = await supabase
      .from("ui_card_plate_borders")
      .select("key,image_url,unlock_level,unlock_points,enabled")
      .in("key", plateKeys);
    if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });
    (plates ?? []).forEach((p: any) => {
      plateByKey.set(String(p.key), {
        image_url: p.image_url ?? null,
        unlock_level: Number(p.unlock_level ?? 1),
        unlock_points: Number(p.unlock_points ?? 0),
        enabled: p.enabled !== false,
      });
    });
  }

  const effectKeys = Array.from(
    new Set(
      (avatarSettings ?? [])
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
  const borderUnlocksByStudent = new Map<string, Set<string>>();
  const plateUnlocksByStudent = new Map<string, Set<string>>();
  if (studentIds.length) {
    const { data: unlockRows, error: uErr } = await supabase
      .from("student_custom_unlocks")
      .select("student_id,item_type,item_key")
      .in("student_id", studentIds)
      .in("item_type", ["effect", "corner_border", "card_plate"]);
    if (uErr) return NextResponse.json({ ok: false, error: uErr.message }, { status: 500 });
    (unlockRows ?? []).forEach((row: any) => {
      const sid = String(row.student_id ?? "");
      const key = String(row.item_key ?? "");
      const type = String(row.item_type ?? "");
      if (!sid || !key) return;
      if (type === "corner_border") {
        const set = borderUnlocksByStudent.get(sid) ?? new Set<string>();
        set.add(key);
        borderUnlocksByStudent.set(sid, set);
      } else if (type === "card_plate") {
        const set = plateUnlocksByStudent.get(sid) ?? new Set<string>();
        set.add(key);
        plateUnlocksByStudent.set(sid, set);
      } else {
        const set = effectUnlocksByStudent.get(sid) ?? new Set<string>();
        set.add(key);
        effectUnlocksByStudent.set(sid, set);
      }
    });
  }

  const avatarByStudent = new Map<string, {
    storage_path: string | null;
    bg_color: string | null;
    particle_style: string | null;
    corner_border_url: string | null;
    corner_border_render_mode?: string | null;
    corner_border_html?: string | null;
    corner_border_css?: string | null;
    corner_border_js?: string | null;
    corner_border_offset_x?: number | null;
    corner_border_offset_y?: number | null;
    corner_border_offsets_by_context?: Record<string, { x?: number | null; y?: number | null; scale?: number | null }> | null;
    card_plate_url: string | null;
  }>();
  (avatarSettings ?? []).forEach((s: any) => {
    const id = String(s.student_id ?? "");
    const avatarId = String(s.avatar_id ?? "");
    const avatar = avatarMap.get(avatarId) ?? { storage_path: null };
    const effectKey = String(s.particle_style ?? "").trim();
    const effect = effectKey ? effectByKey.get(effectKey) : null;
    const level = effectiveLevelByStudent.get(id) ?? 1;
    const effectUnlocked = effect && effect.unlock_points > 0
      ? (effectUnlocksByStudent.get(id)?.has(effectKey) ?? false)
      : true;
    const effectOk = effect && effect.enabled && level >= effect.unlock_level && effectUnlocked;
    const borderKey = String(s.corner_border_key ?? "").trim();
    const border = borderByKey.get(borderKey);
    const borderUnlocked = border && border.unlock_points > 0
      ? (borderUnlocksByStudent.get(id)?.has(borderKey) ?? false)
      : true;
    const borderOk = border && border.enabled && level >= border.unlock_level && borderUnlocked;
    const plateKey = String(s.card_plate_key ?? "").trim();
    const plate = plateByKey.get(plateKey);
    const plateUnlocked = plate && plate.unlock_points > 0
      ? (plateUnlocksByStudent.get(id)?.has(plateKey) ?? false)
      : true;
    const plateOk = plate && plate.enabled && level >= plate.unlock_level && plateUnlocked;
    avatarByStudent.set(id, {
      storage_path: avatar.storage_path ?? null,
      bg_color: s.bg_color ?? null,
      particle_style: effectOk ? effectKey || null : null,
      corner_border_url: borderOk ? border?.image_url ?? null : null,
      corner_border_render_mode: borderOk ? border?.render_mode ?? "image" : null,
      corner_border_html: borderOk ? border?.html ?? "" : null,
      corner_border_css: borderOk ? border?.css ?? "" : null,
      corner_border_js: borderOk ? border?.js ?? "" : null,
      corner_border_offset_x: borderOk ? Number(border?.offset_x ?? 0) : 0,
      corner_border_offset_y: borderOk ? Number(border?.offset_y ?? 0) : 0,
      corner_border_offsets_by_context: borderOk ? (border?.offsets_by_context ?? {}) : {},
      card_plate_url: plateOk ? plate?.image_url ?? null : null,
    });
  });

  const trackers = rows.map((r) => {
    const pairKey = `${r.student_id}::${r.skill_id}`;
    const counts = logMap.get(r.id) ?? { attempts: 0, successes: 0 };
    const events = (logMap.get(r.id)?.events ?? []).slice().sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    const recent_attempts = events.slice(-Math.max(1, Math.min(20, Number(r.repetitions_target ?? 1))));
    const rate = counts.attempts ? Math.round((counts.successes / counts.attempts) * 100) : 0;
    const lastRate = lastRateByTrackerId.get(r.id) ?? 0;
    const lifetime = lifetimeMap.get(pairKey) ?? { attempts: 0, successes: 0 };
    const last30 = last30Map.get(pairKey) ?? { attempts: 0, successes: 0 };
    const lifetime_rate = lifetime.attempts ? Math.round((lifetime.successes / lifetime.attempts) * 100) : 0;
    const last30_rate = last30.attempts ? Math.round((last30.successes / last30.attempts) * 100) : 0;

    return {
      id: r.id,
      student_id: r.student_id,
      student_name: r.students?.name ?? "Student",
      student_level: effectiveLevelByStudent.get(String(r.student_id ?? "")) ?? 0,
      student_points: (r.students as any)?.points_total ?? 0,
      student_is_competition: (r.students as any)?.is_competition_team ?? false,
      avatar_path: avatarByStudent.get(String(r.student_id ?? ""))?.storage_path ?? null,
      avatar_bg: avatarByStudent.get(String(r.student_id ?? ""))?.bg_color ?? null,
      avatar_effect: avatarByStudent.get(String(r.student_id ?? ""))?.particle_style ?? null,
      corner_border_url: avatarByStudent.get(String(r.student_id ?? ""))?.corner_border_url ?? null,
      corner_border_render_mode: avatarByStudent.get(String(r.student_id ?? ""))?.corner_border_render_mode ?? null,
      corner_border_html: avatarByStudent.get(String(r.student_id ?? ""))?.corner_border_html ?? null,
      corner_border_css: avatarByStudent.get(String(r.student_id ?? ""))?.corner_border_css ?? null,
      corner_border_js: avatarByStudent.get(String(r.student_id ?? ""))?.corner_border_js ?? null,
      corner_border_offset_x: avatarByStudent.get(String(r.student_id ?? ""))?.corner_border_offset_x ?? 0,
      corner_border_offset_y: avatarByStudent.get(String(r.student_id ?? ""))?.corner_border_offset_y ?? 0,
      corner_border_offsets_by_context: avatarByStudent.get(String(r.student_id ?? ""))?.corner_border_offsets_by_context ?? {},
      card_plate_url: avatarByStudent.get(String(r.student_id ?? ""))?.card_plate_url ?? null,
      skill_id: r.skill_id,
      skill_name: r.tracker_skills?.name ?? "Skill",
      skill_category: r.tracker_skills?.category ?? "",
      repetitions_target: r.repetitions_target,
      attempts: counts.attempts,
      successes: counts.successes,
      rate,
      last_rate: lastRate,
      lifetime_attempts: lifetime.attempts,
      lifetime_successes: lifetime.successes,
      lifetime_rate,
      last30_attempts: last30.attempts,
      last30_successes: last30.successes,
      last30_rate,
      points_awarded: pointsMap.get(r.id) ?? 0,
      recent_attempts,
      created_at: r.created_at,
      group_id: (r as any)?.group_id ?? null,
      failure_reasons: (r.tracker_skills as any)?.failure_reasons ?? [],
      created_by: r.created_by ?? null,
      creator_role: creatorRoleById.get(String(r.created_by ?? "")) ?? null,
    };
  });

  return NextResponse.json({ ok: true, trackers });
}

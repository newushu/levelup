import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const DEFAULT_LEADERBOARD_SLOTS = [
  { metric: "lifetime_points", title: "Lifetime Points", rank_window: "top5" },
  { metric: "points_total", title: "Points Balance", rank_window: "top5" },
  { metric: "mvp_count", title: "Total MVPs", rank_window: "top5" },
  { metric: "rule_keeper_total", title: "Rule Keeper Total", rank_window: "top5" },
  { metric: "skill_pulse_today", title: "Skill Pulse Today", rank_window: "top10" },
  { metric: "today_points", title: "Today Points", rank_window: "top10" },
  { metric: "weekly_points", title: "Weekly Points", rank_window: "top10" },
  { metric: "points_total", title: "Points Balance", rank_window: "top10" },
  { metric: "lifetime_points", title: "Lifetime Points", rank_window: "top10" },
  { metric: "mvp_count", title: "Total MVPs", rank_window: "top10" },
];

const DEFAULT_LARGE_ROTATIONS = [
  { slot: 1, rotation: [1, 8, 2] },
  { slot: 2, rotation: [2, 9, 3] },
  { slot: 3, rotation: [3, 10, 4] },
  { slot: 4, rotation: [4, 7, 1] },
  { slot: 5, rotation: [5, 6, 7] },
  { slot: 6, rotation: [8, 9, 10] },
];

const METRIC_LABELS: Record<string, string> = {
  none: "Empty Slot",
  points_total: "Points Balance",
  lifetime_points: "Lifetime Points",
  weekly_points: "Weekly Points",
  today_points: "Today Points",
  skill_pulse_today: "Skill Pulse Today",
  mvp_count: "MVP Awards",
  rule_keeper_total: "Rule Keeper Total",
};

function normalizeLeaderboardSlots(input: any) {
  const raw = Array.isArray(input) ? input : [];
  const normalizeRankWindow = (value: unknown) => {
    const raw = String(value ?? "").trim().toLowerCase();
    if (raw === "top5" || raw === "next5" || raw === "top10") return raw;
    return "top10";
  };
  return DEFAULT_LEADERBOARD_SLOTS.map((fallback, index) => {
    const candidate =
      raw[index] ||
      raw.find((row: any) => Number(row?.slot ?? 0) === index + 1) ||
      {};
    const metric = String(candidate?.metric ?? fallback.metric ?? "").trim() || fallback.metric || "none";
    const title = String(candidate?.title ?? fallback.title ?? "").trim() || fallback.title;
    const rank_window = normalizeRankWindow(candidate?.rank_window ?? (fallback as any).rank_window ?? "top10");
    return { slot: index + 1, metric, title, rank_window };
  });
}

function normalizeLargeRotations(input: any) {
  const raw = Array.isArray(input) ? input : [];
  const clampSlot = (value: any, fallback: number) => {
    const num = Number(value ?? fallback);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(1, Math.min(DEFAULT_LEADERBOARD_SLOTS.length, Math.round(num)));
  };
  return DEFAULT_LARGE_ROTATIONS.map((fallback, idx) => {
    const candidate =
      raw[idx] ||
      raw.find((row: any) => Number(row?.slot ?? 0) === fallback.slot) ||
      {};
    const rotationRaw = Array.isArray(candidate?.rotation) ? candidate.rotation : fallback.rotation;
    const rotation = Array.from({ length: 3 }, (_, rIdx) => clampSlot(rotationRaw[rIdx], fallback.rotation[rIdx]));
    return { slot: fallback.slot, rotation };
  });
}

function getWeekStartUTC(now: Date) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

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

export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const admin = supabaseAdmin();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) return NextResponse.json({ ok: false, error: userErr.message }, { status: 401 });
  if (!userData?.user) return NextResponse.json({ ok: false, error: "No session" }, { status: 401 });

  const { data: roles, error: rErr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);
  if (rErr) return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 });
  const roleList = (roles ?? []).map((r: any) => String(r.role ?? "").toLowerCase());
  const allowed = ["admin", "coach", "classroom", "display", "skill_pulse"];
  if (!roleList.some((r) => allowed.includes(r))) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const limit = Math.max(3, Math.min(15, Number(url.searchParams.get("limit") ?? 8)));

  const { data: settings } = await supabase
    .from("ui_display_settings")
    .select("leaderboard_display_enabled,leaderboard_slots,leaderboard_large_rotations")
    .eq("id", 1)
    .maybeSingle();

  if (settings?.leaderboard_display_enabled === false) {
    return NextResponse.json({ ok: true, slots: [] });
  }

  const slots = normalizeLeaderboardSlots(settings?.leaderboard_slots);
  const largeRotations = normalizeLargeRotations(settings?.leaderboard_large_rotations);
  const metricKeys = slots.map((s) => s.metric);
  const performanceStats = metricKeys
    .filter((key) => key.startsWith("performance_stat:"))
    .map((key) => key.replace("performance_stat:", "").trim())
    .filter(Boolean);
  const uniquePerformanceStats = Array.from(new Set(performanceStats));

  const { data: students, error: sErr } = await admin
    .from("students")
    .select("id,name,level,points_total,lifetime_points,is_competition_team");
  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });

  const studentRows = students ?? [];
  const { data: levelRowsRes } = await admin
    .from("avatar_level_thresholds")
    .select("level,min_lifetime_points")
    .order("level", { ascending: true });
  const { data: levelSettingsRes } = await admin
    .from("avatar_level_settings")
    .select("base_jump,difficulty_pct")
    .eq("id", 1)
    .maybeSingle();
  const thresholdRows =
    (levelRowsRes ?? [])
      .map((row: any) => ({ level: Number(row.level), min: Number(row.min_lifetime_points ?? 0) }))
      .filter((row: any) => Number.isFinite(row.level))
      .sort((a: any, b: any) => a.level - b.level) ||
    [];
  const fallbackThresholds = buildThresholdsFromSettings(
    Number(levelSettingsRes?.base_jump ?? 50),
    Number(levelSettingsRes?.difficulty_pct ?? 8)
  );
  const levelThresholds = thresholdRows.length ? thresholdRows : fallbackThresholds;
  const levelByStudentId = new Map<string, number>(
    studentRows.map((s: any) => {
      const lifetime = Number(s.lifetime_points ?? 0);
      let lvl = 1;
      levelThresholds.forEach((t) => {
        if (lifetime >= Number(t.min ?? 0)) lvl = Number(t.level);
      });
      return [String(s.id ?? ""), lvl];
    })
  );
  const studentIds = studentRows.map((s: any) => String(s.id));
  const studentBase = new Map<
    string,
    {
      student_id: string;
      name: string;
      level: number;
      points_total: number;
      lifetime_points: number;
      is_competition_team: boolean;
      avatar_storage_path: string | null;
      avatar_bg: string | null;
      avatar_zoom_pct?: number | null;
      card_plate_url?: string | null;
      prestige_badges?: string[];
      border?: {
        render_mode?: string | null;
        image_url?: string | null;
        html?: string | null;
        css?: string | null;
        js?: string | null;
        offset_x?: number | null;
        offset_y?: number | null;
        offsets_by_context?: Record<string, { x?: number | null; y?: number | null; scale?: number | null; rotate?: number | null }> | null;
        z_layer?: string | null;
        z_index?: number | null;
      } | null;
      effect?: {
        key?: string | null;
        config?: any;
        render_mode?: string | null;
        html?: string | null;
        css?: string | null;
        js?: string | null;
        z_layer?: string | null;
        z_index?: number | null;
      } | null;
    }
  >();

  const settingsRows = studentIds.length
    ? (
        await admin
          .from("student_avatar_settings")
          .select("student_id,avatar_id,bg_color,particle_style,corner_border_key,card_plate_key")
          .in("student_id", studentIds)
      ).data
    : [];

  const avatarIds = Array.from(
    new Set((settingsRows ?? []).map((s: any) => String(s.avatar_id ?? "").trim()).filter(Boolean))
  );
  const avatarMap = new Map<string, { storage_path: string | null; zoom_pct?: number | null }>();
  if (avatarIds.length) {
    const { data: avatars } = await admin.from("avatars").select("id,storage_path,zoom_pct").in("id", avatarIds);
    (avatars ?? []).forEach((a: any) =>
      avatarMap.set(String(a.id), { storage_path: a.storage_path ?? null, zoom_pct: Number(a.zoom_pct ?? 100) })
    );
  }

  const borderKeys = Array.from(
    new Set((settingsRows ?? []).map((s: any) => String(s.corner_border_key ?? "").trim()).filter(Boolean))
  );
  const borderByKey = new Map<
    string,
    {
      image_url: string | null;
      render_mode?: string | null;
      html?: string | null;
      css?: string | null;
      js?: string | null;
      offset_x?: number | null;
      offset_y?: number | null;
      offsets_by_context?: Record<string, { x?: number | null; y?: number | null; scale?: number | null; rotate?: number | null }> | null;
      unlock_level: number;
      unlock_points: number;
      enabled: boolean;
      z_layer?: string | null;
      z_index?: number | null;
    }
  >();
  if (borderKeys.length) {
    const { data: borders } = await admin
      .from("ui_corner_borders")
      .select("key,image_url,render_mode,html,css,js,offset_x,offset_y,offsets_by_context,unlock_level,unlock_points,enabled,z_layer,z_index")
      .in("key", borderKeys);
    (borders ?? []).forEach((b: any) =>
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
        z_layer: b.z_layer ?? null,
        z_index: Number.isFinite(Number(b.z_index)) ? Number(b.z_index) : null,
      })
    );
  }

  const plateKeys = Array.from(
    new Set((settingsRows ?? []).map((s: any) => String(s.card_plate_key ?? "").trim()).filter(Boolean))
  );
  const plateByKey = new Map<string, { image_url: string | null; unlock_level: number; unlock_points: number; enabled: boolean }>();
  if (plateKeys.length) {
    const { data: plates } = await admin
      .from("ui_card_plate_borders")
      .select("key,image_url,unlock_level,unlock_points,enabled")
      .in("key", plateKeys);
    (plates ?? []).forEach((p: any) =>
      plateByKey.set(String(p.key), {
        image_url: p.image_url ?? null,
        unlock_level: Number(p.unlock_level ?? 1),
        unlock_points: Number(p.unlock_points ?? 0),
        enabled: p.enabled !== false,
      })
    );
  }

  const effectKeys = Array.from(
    new Set(
      (settingsRows ?? [])
        .map((s: any) => String(s.particle_style ?? "").trim())
        .filter((key: string) => key && key !== "none")
    )
  );
  const effectByKey = new Map<
    string,
    {
      config?: any;
      render_mode?: string | null;
      html?: string | null;
      css?: string | null;
      js?: string | null;
      unlock_level: number;
      unlock_points: number;
      enabled: boolean;
      z_layer?: string | null;
      z_index?: number | null;
    }
  >();
  if (effectKeys.length) {
    const { data: effects } = await admin
      .from("avatar_effects")
      .select("key,config,render_mode,html,css,js,unlock_level,unlock_points,enabled,z_layer,z_index")
      .in("key", effectKeys);
    (effects ?? []).forEach((e: any) =>
      effectByKey.set(String(e.key), {
        config: e.config ?? null,
        render_mode: e.render_mode ?? null,
        html: e.html ?? null,
        css: e.css ?? null,
        js: e.js ?? null,
        unlock_level: Number(e.unlock_level ?? 1),
        unlock_points: Number(e.unlock_points ?? 0),
        enabled: e.enabled !== false,
        z_layer: e.z_layer ?? null,
        z_index: Number.isFinite(Number(e.z_index)) ? Number(e.z_index) : null,
      })
    );
  }

  const studentIdsWithSettings = Array.from(
    new Set((settingsRows ?? []).map((s: any) => String(s.student_id ?? "")).filter(Boolean))
  );
  const cornerUnlocksByStudent = new Map<string, Set<string>>();
  const plateUnlocksByStudent = new Map<string, Set<string>>();
  const effectUnlocksByStudent = new Map<string, Set<string>>();
  if (studentIdsWithSettings.length) {
    const { data: unlockRows } = await admin
      .from("student_custom_unlocks")
      .select("student_id,item_type,item_key")
      .in("student_id", studentIdsWithSettings)
      .in("item_type", ["corner_border", "card_plate", "effect"]);
    (unlockRows ?? []).forEach((row: any) => {
      const sid = String(row.student_id ?? "");
      const key = String(row.item_key ?? "");
      const type = String(row.item_type ?? "");
      if (!sid || !key) return;
      if (type === "corner_border") {
        const set = cornerUnlocksByStudent.get(sid) ?? new Set<string>();
        set.add(key);
        cornerUnlocksByStudent.set(sid, set);
      } else if (type === "card_plate") {
        const set = plateUnlocksByStudent.get(sid) ?? new Set<string>();
        set.add(key);
        plateUnlocksByStudent.set(sid, set);
      } else if (type === "effect") {
        const set = effectUnlocksByStudent.get(sid) ?? new Set<string>();
        set.add(key);
        effectUnlocksByStudent.set(sid, set);
      }
    });
  }

  const avatarByStudent = new Map<
    string,
    {
      storage_path: string | null;
      bg_color: string | null;
      avatar_zoom_pct?: number | null;
      prestige_badges?: string[];
      border?: {
        render_mode?: string | null;
        image_url?: string | null;
        html?: string | null;
        css?: string | null;
        js?: string | null;
        offset_x?: number | null;
        offset_y?: number | null;
        offsets_by_context?: Record<string, { x?: number | null; y?: number | null; scale?: number | null; rotate?: number | null }> | null;
        z_layer?: string | null;
        z_index?: number | null;
      } | null;
      effect?: {
        key?: string | null;
        config?: any;
        render_mode?: string | null;
        html?: string | null;
        css?: string | null;
        js?: string | null;
        z_layer?: string | null;
        z_index?: number | null;
      } | null;
      card_plate_url?: string | null;
    }
  >();

  (settingsRows ?? []).forEach((s: any) => {
    const id = String(s.student_id ?? "");
    if (!id) return;
    const avatarId = String(s.avatar_id ?? "");
    const avatar = avatarMap.get(avatarId) ?? { storage_path: null, zoom_pct: 100 };
    const level = Number(levelByStudentId.get(id) ?? 1);

    const borderKey = String(s.corner_border_key ?? "").trim();
    const border = borderKey ? borderByKey.get(borderKey) : null;
    const borderUnlocked = border && border.unlock_points > 0
      ? (cornerUnlocksByStudent.get(id)?.has(borderKey) ?? false)
      : true;
    const borderOk = border && border.enabled && level >= border.unlock_level && borderUnlocked;

    const plateKey = String(s.card_plate_key ?? "").trim();
    const plate = plateKey ? plateByKey.get(plateKey) : null;
    const plateUnlocked = plate && plate.unlock_points > 0
      ? (plateUnlocksByStudent.get(id)?.has(plateKey) ?? false)
      : true;
    const plateOk = plate && plate.enabled && level >= plate.unlock_level && plateUnlocked;

    const effectKey = String(s.particle_style ?? "").trim();
    const effect = effectKey ? effectByKey.get(effectKey) : null;
    const effectUnlocked = effect && effect.unlock_points > 0
      ? (effectUnlocksByStudent.get(id)?.has(effectKey) ?? false)
      : true;
    const effectOk = effect && effect.enabled && level >= effect.unlock_level && effectUnlocked;

    avatarByStudent.set(id, {
      storage_path: avatar.storage_path ?? null,
      bg_color: s.bg_color ?? null,
      avatar_zoom_pct: avatar.zoom_pct ?? 100,
      border: borderOk
        ? {
            render_mode: border?.render_mode ?? null,
            image_url: border?.image_url ?? null,
            html: border?.html ?? null,
            css: border?.css ?? null,
            js: border?.js ?? null,
            offset_x: border?.offset_x ?? null,
            offset_y: border?.offset_y ?? null,
            offsets_by_context: border?.offsets_by_context ?? null,
            z_layer: border?.z_layer ?? null,
            z_index: border?.z_index ?? null,
          }
        : null,
      effect: effectOk
        ? {
            key: effectKey,
            config: effect?.config ?? null,
            render_mode: effect?.render_mode ?? null,
            html: effect?.html ?? null,
            css: effect?.css ?? null,
            js: effect?.js ?? null,
            z_layer: effect?.z_layer ?? null,
            z_index: effect?.z_index ?? null,
          }
        : null,
      card_plate_url: plateOk ? plate?.image_url ?? null : null,
    });
  });

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const prestigeBadgesByStudent = new Map<string, string[]>();
  if (studentIds.length) {
    const { data: badgeRowsInitial, error: badgeErr } = await admin
      .from("student_achievement_badges")
      .select("student_id,achievement_badges:badge_id(id,category,icon_path,badge_library:badge_library_id(image_url))")
      .in("student_id", studentIds);
    let badgeRows = badgeRowsInitial;

    if (badgeErr && (String(badgeErr.message || "").includes("relationship") || String(badgeErr.message || "").includes("column"))) {
      const retry = await admin
        .from("student_achievement_badges")
        .select("student_id,achievement_badges:badge_id(id,category,icon_path)")
        .in("student_id", studentIds);
      badgeRows = (retry.data ?? []).map((row: any) => ({
        ...row,
        achievement_badges: { ...row.achievement_badges, badge_library: [] },
      }));
    }

    (badgeRows ?? []).forEach((row: any) => {
      const sid = String(row.student_id ?? "");
      const category = String(row?.achievement_badges?.category ?? "").toLowerCase();
      if (!sid || category !== "prestige") return;
      const badgeId = String(row?.achievement_badges?.id ?? "").trim();
      const libraryUrl = String(row?.achievement_badges?.badge_library?.image_url ?? "").trim();
      const rawIconPath = String(row?.achievement_badges?.icon_path ?? "").trim();
      const iconPath = rawIconPath || (badgeId === "prestige:comp_team" ? "prestige/compteam.png" : "");
      const clean = iconPath.replace(/^\/+/, "");
      const fullPath = clean && clean.startsWith("badges/") ? clean : clean ? `badges/${clean}` : "";
      const iconUrl = libraryUrl || (baseUrl && fullPath ? `${baseUrl}/storage/v1/object/public/${fullPath}` : "");
      if (!iconUrl) return;
      const next = new Set([...(prestigeBadgesByStudent.get(sid) ?? []), iconUrl]);
      prestigeBadgesByStudent.set(sid, Array.from(next));
    });
  }

  (studentRows ?? []).forEach((s: any) => {
    const id = String(s.id ?? "");
    if (!id) return;
    const avatar = avatarByStudent.get(id) ?? {
      storage_path: null,
      bg_color: null,
      avatar_zoom_pct: 100,
      prestige_badges: [],
      border: null,
      effect: null,
      card_plate_url: null,
    };
    studentBase.set(id, {
      student_id: id,
      name: String(s.name ?? "Student"),
      level: Number(levelByStudentId.get(id) ?? s.level ?? 1),
      points_total: Number(s.points_total ?? 0),
      lifetime_points: Number(s.lifetime_points ?? 0),
      is_competition_team: !!s.is_competition_team,
      avatar_storage_path: avatar.storage_path ?? null,
      avatar_bg: avatar.bg_color ?? null,
      avatar_zoom_pct: avatar.avatar_zoom_pct ?? 100,
      prestige_badges: prestigeBadgesByStudent.get(id) ?? [],
      border: avatar.border ?? null,
      effect: avatar.effect ?? null,
      card_plate_url: avatar.card_plate_url ?? null,
    });
  });

  const weekStart = getWeekStartUTC(new Date()).toISOString();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [weeklyLedger, todayLedger, skillPulseLedger, mvpRows] = await Promise.all([
    admin.from("ledger").select("student_id,points,created_at,category").gte("created_at", weekStart),
    admin.from("ledger").select("student_id,points,created_at,category").gte("created_at", todayStart.toISOString()),
    admin
      .from("ledger")
      .select("student_id,points,category,note")
      .gte("created_at", todayStart.toISOString())
      .or("category.eq.skill_pulse,note.ilike.Battle Pulse win%"),
    admin.from("battle_mvp_awards").select("student_id"),
  ]);

  if (weeklyLedger.error) return NextResponse.json({ ok: false, error: weeklyLedger.error.message }, { status: 500 });
  if (todayLedger.error) return NextResponse.json({ ok: false, error: todayLedger.error.message }, { status: 500 });
  if (skillPulseLedger.error) {
    return NextResponse.json({ ok: false, error: skillPulseLedger.error.message }, { status: 500 });
  }
  if (mvpRows.error) return NextResponse.json({ ok: false, error: mvpRows.error.message }, { status: 500 });

  const weeklyPoints = new Map<string, number>();
  (weeklyLedger.data ?? []).forEach((row: any) => {
    const id = String(row.student_id ?? "");
    if (!id) return;
    const category = String(row.category ?? "").toLowerCase();
    if (category === "redeem_daily" || category === "avatar_daily" || category === "redeem_camp_role" || category === "redeem_event_daily") return;
    weeklyPoints.set(id, (weeklyPoints.get(id) ?? 0) + Number(row.points ?? 0));
  });

  const todayPoints = new Map<string, number>();
  (todayLedger.data ?? []).forEach((row: any) => {
    const id = String(row.student_id ?? "");
    if (!id) return;
    const category = String(row.category ?? "").toLowerCase();
    if (category === "redeem_daily" || category === "avatar_daily" || category === "redeem_camp_role" || category === "redeem_event_daily") return;
    todayPoints.set(id, (todayPoints.get(id) ?? 0) + Number(row.points ?? 0));
  });

  const skillPulseToday = new Map<string, number>();
  (skillPulseLedger.data ?? []).forEach((row: any) => {
    const id = String(row.student_id ?? "");
    const pts = Number(row.points ?? 0);
    if (!id || pts <= 0) return;
    skillPulseToday.set(id, (skillPulseToday.get(id) ?? 0) + pts);
  });

  const mvpCounts = new Map<string, number>();
  (mvpRows.data ?? []).forEach((row: any) => {
    const id = String(row.student_id ?? "");
    if (!id) return;
    mvpCounts.set(id, (mvpCounts.get(id) ?? 0) + 1);
  });

  const ruleKeeperTotals = new Map<string, number>();
  const ruleKeeperRes = await admin
    .from("ledger")
    .select("student_id,category")
    .eq("category", "rule_keeper");
  if (!ruleKeeperRes.error) {
    (ruleKeeperRes.data ?? []).forEach((row: any) => {
      const id = String(row.student_id ?? "");
      if (!id) return;
      ruleKeeperTotals.set(id, (ruleKeeperTotals.get(id) ?? 0) + 1);
    });
  }

  const performanceStatMeta = new Map<string, { name: string; unit: string | null; higher_is_better: boolean }>();
  const performanceLeaderboards = new Map<
    string,
    Array<{ student_id: string; value: number; recorded_at: string }>
  >();

  for (const statId of uniquePerformanceStats) {
    const { data: stat, error: statErr } = await admin
      .from("stats")
      .select("id,name,unit,higher_is_better")
      .eq("id", statId)
      .maybeSingle();
    if (statErr || !stat) continue;
    performanceStatMeta.set(statId, {
      name: String(stat.name ?? "Stat"),
      unit: stat.unit ?? null,
      higher_is_better: !!stat.higher_is_better,
    });
    const { data: statRows, error: rowErr } = await admin
      .from("student_stats")
      .select("student_id,value,recorded_at")
      .eq("stat_id", statId);
    if (rowErr) continue;
    const bestByStudent = new Map<string, { student_id: string; value: number; recorded_at: string }>();
    (statRows ?? []).forEach((row: any) => {
      const id = String(row.student_id ?? "");
      if (!id) return;
      const value = Number(row.value ?? 0);
      const recordedAt = String(row.recorded_at ?? "");
      const existing = bestByStudent.get(id);
      if (!existing) {
        bestByStudent.set(id, { student_id: id, value, recorded_at: recordedAt });
        return;
      }
      const higherIsBetter = !!stat.higher_is_better;
      const isBetter = higherIsBetter ? value > existing.value : value < existing.value;
      const isTie = value === existing.value;
      if (isBetter || (isTie && recordedAt > existing.recorded_at)) {
        bestByStudent.set(id, { student_id: id, value, recorded_at: recordedAt });
      }
    });
    performanceLeaderboards.set(statId, Array.from(bestByStudent.values()));
  }

  const buildRows = (values: Map<string, number>) => {
    const list = Array.from(studentBase.values()).map((s) => ({
      ...s,
      value: values.get(s.student_id) ?? 0,
    }));
    list.sort((a, b) => b.value - a.value);
    return list
      .filter((row) => Number(row.value ?? 0) > 0)
      .slice(0, limit)
      .map((row, idx) => ({
      rank: idx + 1,
      student_id: row.student_id,
      name: row.name,
      value: row.value,
      level: row.level,
      is_competition_team: row.is_competition_team,
      avatar_storage_path: row.avatar_storage_path,
      avatar_bg: row.avatar_bg,
      avatar_zoom_pct: row.avatar_zoom_pct ?? 100,
      prestige_badges: row.prestige_badges ?? [],
      border: row.border ?? null,
      effect: row.effect ?? null,
      card_plate_url: row.card_plate_url ?? null,
    }));
  };

  const fixedLeaderboards = new Map<string, Array<any>>();
  fixedLeaderboards.set(
    "points_total",
    buildRows(new Map(Array.from(studentBase.values()).map((s) => [s.student_id, s.points_total])))
  );
  fixedLeaderboards.set(
    "lifetime_points",
    buildRows(new Map(Array.from(studentBase.values()).map((s) => [s.student_id, s.lifetime_points])))
  );
  fixedLeaderboards.set("weekly_points", buildRows(weeklyPoints));
  fixedLeaderboards.set("today_points", buildRows(todayPoints));
  fixedLeaderboards.set("skill_pulse_today", buildRows(skillPulseToday));
  fixedLeaderboards.set("mvp_count", buildRows(mvpCounts));
  fixedLeaderboards.set("rule_keeper_total", buildRows(ruleKeeperTotals));

  const applyRankWindow = (rows: any[], rankWindow: string) => {
    const list = Array.isArray(rows) ? rows : [];
    if (rankWindow === "top5") return list.slice(0, 5);
    if (rankWindow === "next5") return list.slice(5, 10);
    return list.slice(0, 10);
  };

  const assembledSlots = slots.map((slot) => {
    const metricKey = slot.metric;
    if (metricKey === "none") {
      return {
        slot: slot.slot,
        metric: metricKey,
        title: slot.title || METRIC_LABELS.none,
        unit: null,
        rows: [],
      };
    }
    if (metricKey.startsWith("performance_stat:")) {
      const statId = metricKey.replace("performance_stat:", "").trim();
      const meta = performanceStatMeta.get(statId);
      const rows = performanceLeaderboards.get(statId) ?? [];
      const sorted = rows
        .slice()
        .filter((row) => Number(row.value ?? 0) > 0)
        .sort((a, b) => {
          if (a.value === b.value) return String(b.recorded_at).localeCompare(String(a.recorded_at));
          return (meta?.higher_is_better ?? true) ? b.value - a.value : a.value - b.value;
        })
        .slice(0, limit)
        .map((row, idx) => {
          const base = studentBase.get(row.student_id);
          return {
            rank: idx + 1,
            student_id: row.student_id,
            name: base?.name ?? "Student",
            value: row.value,
            level: base?.level ?? 1,
            is_competition_team: base?.is_competition_team ?? false,
            avatar_storage_path: base?.avatar_storage_path ?? null,
            avatar_bg: base?.avatar_bg ?? null,
            avatar_zoom_pct: base?.avatar_zoom_pct ?? 100,
            prestige_badges: base?.prestige_badges ?? [],
            border: base?.border ?? null,
            effect: base?.effect ?? null,
            card_plate_url: base?.card_plate_url ?? null,
          };
        });
      return {
        slot: slot.slot,
        metric: metricKey,
        title: slot.title || meta?.name || "Performance Stat",
        unit: meta?.unit ?? null,
        rows: applyRankWindow(sorted, String((slot as any).rank_window ?? "top10")),
      };
    }
    const rows = fixedLeaderboards.get(metricKey) ?? [];
    return {
      slot: slot.slot,
      metric: metricKey,
      title: slot.title || METRIC_LABELS[metricKey] || "Leaderboard",
      unit: null,
      rows: applyRankWindow(rows, String((slot as any).rank_window ?? "top10")),
    };
  });

  return NextResponse.json({ ok: true, slots: assembledSlots, large_rotations: largeRotations, rotation_seconds: 10 });
}

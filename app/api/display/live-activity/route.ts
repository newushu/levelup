import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type FeedItem = {
  id: string;
  student_id: string;
  student_name: string;
  is_competition_team: boolean;
  avatar_storage_path: string | null;
  avatar_bg: string | null;
  avatar_effect: string | null;
  avatar_zoom_pct?: number | null;
  corner_border_url?: string | null;
  corner_border_render_mode?: string | null;
  corner_border_html?: string | null;
  corner_border_css?: string | null;
  corner_border_js?: string | null;
  corner_border_offset_x?: number | null;
  corner_border_offset_y?: number | null;
  corner_border_offsets_by_context?: Record<string, { x?: number | null; y?: number | null; scale?: number | null }> | null;
  card_plate_url?: string | null;
  points_total: number | null;
  points?: number | null;
  points_base?: number | null;
  points_multiplier?: number | null;
  title: string;
  detail: string;
  time: string;
  tone: "win" | "loss" | "badge" | "rank" | "skill" | "skilltree" | "redeem" | "unlock" | "roulette";
  event_type?: string;
  challenge_tier?: string | null;
  challenge_medal_url?: string | null;
  challenge_points?: number | null;
};

const LIVE_ACTIVITY_TYPES = [
  "points_gain",
  "points_loss",
  "rule_breaker",
  "skill_pulse",
  "skill_complete",
  "battle_pulse_win",
  "battle_pulse_loss",
  "battle_pulse_mvp",
  "redeem",
  "avatar_unlock",
  "roulette",
  "badge",
  "challenge",
  "skilltree",
  "top3_weekly",
] as const;

function normalizeTypes(input: any) {
  const allowed = new Set(LIVE_ACTIVITY_TYPES);
  const list = Array.isArray(input) ? input : [];
  const next = list
    .map((v) => String(v ?? "").trim())
    .filter((v) => allowed.has(v as (typeof LIVE_ACTIVITY_TYPES)[number]));
  return next.length ? next : [...LIVE_ACTIVITY_TYPES];
}

function getWeekStartUTC(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 Sun
  const offset = (day + 6) % 7; // Monday start
  d.setUTCDate(d.getUTCDate() - offset);
  return d;
}

export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const admin = supabaseAdmin();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) return NextResponse.json({ ok: false, error: userErr.message }, { status: 401 });
  const user = userData?.user;
  if (!user) return NextResponse.json({ ok: false, error: "No session" }, { status: 401 });

  const { data: roles, error: rErr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  if (rErr) return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 });
  let roleList = (roles ?? []).map((r: any) => String(r.role ?? "").toLowerCase());
  if (!roleList.length) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profile?.role) roleList = [String(profile.role).toLowerCase()];
  }
  const allowed = ["admin", "coach", "classroom", "display", "skill_pulse"];
  if (!roleList.some((r) => allowed.includes(r))) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const includeAll = url.searchParams.get("include_all") === "1";
  const limit = Math.max(8, Math.min(60, Number(url.searchParams.get("limit") ?? 40)));

  const { data: displaySettings } = await supabase
    .from("ui_display_settings")
    .select("live_activity_enabled,live_activity_types")
    .eq("id", 1)
    .maybeSingle();
  const liveActivityEnabled = displaySettings?.live_activity_enabled ?? true;
  const liveActivityTypes = new Set(normalizeTypes(displaySettings?.live_activity_types));

  if (!liveActivityEnabled && !includeAll) {
    return NextResponse.json({ ok: true, items: [] });
  }

  const { data: studentRows } = await supabase
    .from("students")
    .select("id,name,first_name,last_name,points_total,level,is_competition_team");
  const nameById = new Map<string, string>();
  const pointsById = new Map<string, number>();
  const compById = new Map<string, boolean>();
  const levelById = new Map<string, number>();
  (studentRows ?? []).forEach((s: any) => {
    const full = String(s.name ?? "").trim();
    const fallback = `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim();
    nameById.set(s.id, full || fallback || "Student");
    pointsById.set(s.id, Number(s.points_total ?? 0));
    compById.set(s.id, Boolean(s.is_competition_team));
    levelById.set(s.id, Number(s.level ?? 1));
  });

  const { data: settings } = await supabase
    .from("student_avatar_settings")
    .select("student_id,avatar_id,bg_color,particle_style,corner_border_key,card_plate_key");
  const avatarIds = Array.from(
    new Set((settings ?? []).map((s: any) => String(s.avatar_id ?? "").trim()).filter(Boolean))
  );
  let avatarMap = new Map<string, { storage_path: string | null }>();
  if (avatarIds.length) {
    const { data: avatars } = await supabase
      .from("avatars")
      .select("id,storage_path,zoom_pct")
      .in("id", avatarIds);
    (avatars ?? []).forEach((a: any) =>
      avatarMap.set(String(a.id), { storage_path: a.storage_path ?? null, zoom_pct: Number(a.zoom_pct ?? 100) })
    );
  }
  const borderKeys = Array.from(
    new Set((settings ?? []).map((s: any) => String(s.corner_border_key ?? "").trim()).filter(Boolean))
  );
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
    const { data: borders } = await supabase
      .from("ui_corner_borders")
      .select("key,image_url,render_mode,html,css,js,offset_x,offset_y,offsets_by_context,unlock_level,unlock_points,enabled")
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
      })
    );
  }
  const plateKeys = Array.from(
    new Set((settings ?? []).map((s: any) => String(s.card_plate_key ?? "").trim()).filter(Boolean))
  );
  const plateByKey = new Map<string, { image_url: string | null; unlock_level: number; unlock_points: number; enabled: boolean }>();
  if (plateKeys.length) {
    const { data: plates } = await supabase
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
      (settings ?? [])
        .map((s: any) => String(s.particle_style ?? "").trim())
        .filter((key: string) => key && key !== "none")
    )
  );
  const effectByKey = new Map<string, { unlock_level: number; unlock_points: number; enabled: boolean }>();
  if (effectKeys.length) {
    const { data: effects } = await supabase
      .from("avatar_effects")
      .select("key,unlock_level,unlock_points,enabled")
      .in("key", effectKeys);
    (effects ?? []).forEach((e: any) =>
      effectByKey.set(String(e.key), {
        unlock_level: Number(e.unlock_level ?? 1),
        unlock_points: Number(e.unlock_points ?? 0),
        enabled: e.enabled !== false,
      })
    );
  }

  const studentIds = Array.from(new Set((settings ?? []).map((s: any) => String(s.student_id ?? "")).filter(Boolean)));
  const cornerUnlocksByStudent = new Map<string, Set<string>>();
  const plateUnlocksByStudent = new Map<string, Set<string>>();
  const effectUnlocksByStudent = new Map<string, Set<string>>();
  if (studentIds.length) {
    const { data: unlockRows } = await admin
      .from("student_custom_unlocks")
      .select("student_id,item_type,item_key")
      .in("student_id", studentIds)
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
      particle_style: string | null;
      corner_border_url: string | null;
      corner_border_render_mode: string | null;
      corner_border_html: string | null;
      corner_border_css: string | null;
      corner_border_js: string | null;
      corner_border_offset_x: number | null;
      corner_border_offset_y: number | null;
      corner_border_offsets_by_context: Record<string, { x?: number | null; y?: number | null }> | null;
      card_plate_url: string | null;
    }
  >();
  (settings ?? []).forEach((s: any) => {
    const id = String(s.student_id ?? "");
    if (!id) return;
    const avatar = avatarMap.get(String(s.avatar_id ?? "")) ?? { storage_path: null, zoom_pct: 100 };
    const borderKey = String(s.corner_border_key ?? "").trim();
    const border = borderKey ? borderByKey.get(borderKey) : null;
    const level = levelById.get(id) ?? 1;
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
      zoom_pct: Number(avatar.zoom_pct ?? 100),
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

  const { data: ledgerRows } = await supabase
    .from("ledger")
    .select("id,student_id,points,points_base,points_multiplier,note,category,created_at,source_id,source_type")
    .order("created_at", { ascending: false })
    .limit(80);

  const { data: rouletteRows } = await supabase
    .from("roulette_spins")
    .select(
      "id,student_id,points_delta,prize_text,item_key,confirmed_at,created_at,roulette_wheels(name),roulette_segments(label,segment_type,prize_text,item_key)"
    )
    .not("confirmed_at", "is", null)
    .order("confirmed_at", { ascending: false })
    .limit(40);

  const { data: badgeRows } = await supabase
    .from("student_achievement_badges")
    .select("id,student_id,earned_at,achievement_badges(name)")
    .order("earned_at", { ascending: false })
    .limit(60);

  const { data: skillSets } = await supabase
    .from("skill_sets")
    .select("id,name,enabled")
    .eq("enabled", true);
  const { data: skills } = await supabase
    .from("skills")
    .select("id,set_id,enabled")
    .eq("enabled", true);
  const { data: completions } = await supabase
    .from("student_skill_completions")
    .select("student_id,skill_id,completed_at")
    .order("completed_at", { ascending: false })
    .limit(240);

  const totalSkillsBySet = new Map<string, number>();
  (skills ?? []).forEach((s: any) => {
    totalSkillsBySet.set(s.set_id, (totalSkillsBySet.get(s.set_id) ?? 0) + 1);
  });
  const setNameById = new Map<string, string>();
  (skillSets ?? []).forEach((s: any) => setNameById.set(s.id, String(s.name ?? "Skill Set")));

  const completedByStudentSet = new Map<string, Set<string>>();
  const latestByStudentSet = new Map<string, string>();

  (completions ?? []).forEach((row: any) => {
    const skillId = String(row.skill_id ?? "");
    const completedAt = String(row.completed_at ?? "");
    const studentId = String(row.student_id ?? "");
    const setId = (skills ?? []).find((s: any) => s.id === skillId)?.set_id;
    if (!skillId || !studentId || !setId) return;
    const key = `${studentId}:${setId}`;
    if (!completedByStudentSet.has(key)) completedByStudentSet.set(key, new Set());
    completedByStudentSet.get(key)!.add(skillId);
    const prev = latestByStudentSet.get(key);
    if (!prev || new Date(completedAt) > new Date(prev)) latestByStudentSet.set(key, completedAt);
  });

  const skillTreeEvents: FeedItem[] = [];
  completedByStudentSet.forEach((set, key) => {
    const [studentId, setId] = key.split(":");
    const total = totalSkillsBySet.get(setId) ?? 0;
    if (total > 0 && set.size === total) {
      const avatar = avatarByStudent.get(studentId) ?? {
        storage_path: null,
        bg_color: null,
        particle_style: null,
        corner_border_url: null,
        card_plate_url: null,
      };
      skillTreeEvents.push({
        id: `skillset-${studentId}-${setId}`,
        student_id: studentId,
        student_name: nameById.get(studentId) ?? "Student",
        is_competition_team: compById.get(studentId) ?? false,
        avatar_storage_path: avatar.storage_path ?? null,
        avatar_zoom_pct: Number(avatar.zoom_pct ?? 100),
        avatar_bg: avatar.bg_color ?? null,
        avatar_effect: avatar.particle_style ?? null,
        corner_border_url: avatar.corner_border_url ?? null,
        corner_border_render_mode: avatar.corner_border_render_mode ?? null,
        corner_border_html: avatar.corner_border_html ?? null,
        corner_border_css: avatar.corner_border_css ?? null,
        corner_border_js: avatar.corner_border_js ?? null,
        corner_border_offset_x: avatar.corner_border_offset_x ?? 0,
        corner_border_offset_y: avatar.corner_border_offset_y ?? 0,
        corner_border_offsets_by_context: avatar.corner_border_offsets_by_context ?? {},
        card_plate_url: avatar.card_plate_url ?? null,
        points_total: pointsById.get(studentId) ?? null,
        title: "Skill Tree Completed",
        detail: setNameById.get(setId) ?? "Skill Tree",
        time: latestByStudentSet.get(key) ?? new Date().toISOString(),
        tone: "skilltree",
        event_type: "skilltree",
      });
    }
  });

  const now = new Date();
  const thisWeekStart = getWeekStartUTC(now);
  const { data: weekLedger } = await supabase
    .from("ledger")
    .select("student_id,points,created_at")
    .gte("created_at", thisWeekStart.toISOString())
    .order("created_at", { ascending: true });

  const rankMap = (totals: Map<string, number>) => {
    const sorted = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
    const map = new Map<string, number>();
    sorted.forEach(([id], idx) => map.set(id, idx + 1));
    return map;
  };

  const totals = new Map<string, number>();
  const top3Events: FeedItem[] = [];
  (weekLedger ?? []).forEach((row: any) => {
    const studentId = String(row.student_id ?? "");
    if (!studentId) return;
    const points = Number(row.points ?? 0);
    const beforeRanks = rankMap(totals);
    const rankBefore = beforeRanks.get(studentId);
    const wasTop3 = rankBefore !== undefined && rankBefore <= 3;

    totals.set(studentId, (totals.get(studentId) ?? 0) + points);

    const afterRanks = rankMap(totals);
    const rankAfter = afterRanks.get(studentId);
    const isTop3 = rankAfter !== undefined && rankAfter <= 3;
    if (points > 0 && isTop3 && !wasTop3) {
      const avatar = avatarByStudent.get(studentId) ?? {
        storage_path: null,
        bg_color: null,
        particle_style: null,
        corner_border_url: null,
        card_plate_url: null,
      };
      const fromLabel = rankBefore ? `#${rankBefore}` : "Unranked";
      top3Events.push({
        id: `top3-${studentId}-${row.created_at}`,
        student_id: studentId,
        student_name: nameById.get(studentId) ?? "Student",
        is_competition_team: compById.get(studentId) ?? false,
        avatar_storage_path: avatar.storage_path ?? null,
        avatar_zoom_pct: Number(avatar.zoom_pct ?? 100),
        avatar_bg: avatar.bg_color ?? null,
        avatar_effect: avatar.particle_style ?? null,
        corner_border_url: avatar.corner_border_url ?? null,
        corner_border_render_mode: avatar.corner_border_render_mode ?? null,
        corner_border_html: avatar.corner_border_html ?? null,
        corner_border_css: avatar.corner_border_css ?? null,
        corner_border_js: avatar.corner_border_js ?? null,
        corner_border_offset_x: avatar.corner_border_offset_x ?? 0,
        corner_border_offset_y: avatar.corner_border_offset_y ?? 0,
        corner_border_offsets_by_context: avatar.corner_border_offsets_by_context ?? {},
        card_plate_url: avatar.card_plate_url ?? null,
        points_total: pointsById.get(studentId) ?? null,
        title: "Top 3 Weekly",
        detail: `${fromLabel} ⬆️ #${rankAfter}`,
        time: String(row.created_at ?? new Date().toISOString()),
        tone: "rank",
        event_type: "top3_weekly",
      });
    }
  });

  const { data: battleRows } = await supabase
    .from("battle_trackers")
    .select("id,winner_id,skill_id,settled_at,wager_amount,participant_ids,team_a_ids,team_b_ids,battle_mode,tracker_skills(name)")
    .not("settled_at", "is", null)
    .order("settled_at", { ascending: false })
    .limit(80);

  const { data: challengeRows } = await admin
    .from("student_challenges")
    .select("student_id,challenge_id,completed_at")
    .order("completed_at", { ascending: false })
    .limit(60);
  const challengeIds = Array.from(new Set((challengeRows ?? []).map((r: any) => String(r.challenge_id ?? "").trim()).filter(Boolean)));
  const { data: challenges } = challengeIds.length
    ? await admin
        .from("challenges")
        .select("id,name,tier,points_awarded")
        .in("id", challengeIds)
    : { data: [] };
  const { data: medalAssets } = await admin
    .from("challenge_medal_assets")
    .select("tier,badge_library_id");
  const medalIds = Array.from(new Set((medalAssets ?? []).map((m: any) => String(m.badge_library_id ?? "").trim()).filter(Boolean)));
  const { data: medalLibrary } = medalIds.length
    ? await admin
        .from("badge_library")
        .select("id,image_url")
        .in("id", medalIds)
    : { data: [] };
  const medalUrlByTier = new Map<string, string | null>();
  (medalAssets ?? []).forEach((m: any) => {
    const tier = String(m.tier ?? "");
    const image = (medalLibrary ?? []).find((b: any) => String(b.id) === String(m.badge_library_id))?.image_url ?? null;
    if (tier) medalUrlByTier.set(tier, image);
  });
  const challengeById = new Map<string, { name: string; tier: string; points: number | null }>();
  (challenges ?? []).forEach((c: any) => {
    challengeById.set(String(c.id), {
      name: String(c.name ?? "Challenge"),
      tier: String(c.tier ?? "bronze"),
      points: c.points_awarded !== undefined && c.points_awarded !== null ? Number(c.points_awarded) : null,
    });
  });

  const battleWinTimesByStudent = new Map<string, number[]>();
  const battleMvpBonusByStudent = new Map<string, Array<{ at: number; bonus: number }>>();
  const battleMvpConsolationByStudent = new Map<string, Array<{ at: number; bonus: number }>>();
  (ledgerRows ?? []).forEach((row: any) => {
    const note = String(row.note ?? "").toLowerCase();
    const studentId = String(row.student_id ?? "");
    const createdAt = String(row.created_at ?? "");
    const createdMs = createdAt ? Date.parse(createdAt) : 0;
    if (!studentId || !createdMs) return;
    if (note.includes("battle pulse mvp bonus")) {
      const list = battleMvpBonusByStudent.get(studentId) ?? [];
      list.push({ at: createdMs, bonus: Math.abs(Number(row.points ?? 0)) });
      battleMvpBonusByStudent.set(studentId, list);
      return;
    }
    if (note.includes("battle pulse mvp consolation")) {
      const list = battleMvpConsolationByStudent.get(studentId) ?? [];
      list.push({ at: createdMs, bonus: Math.abs(Number(row.points ?? 0)) });
      battleMvpConsolationByStudent.set(studentId, list);
      return;
    }
    if (!note.includes("battle pulse") || !note.includes("win")) return;
    const list = battleWinTimesByStudent.get(studentId) ?? [];
    list.push(createdMs);
    battleWinTimesByStudent.set(studentId, list);
  });

  const ledgerEvents: FeedItem[] = (ledgerRows ?? [])
    .filter((row: any) => {
      if (String(row.category ?? "").toLowerCase() === "avatar_daily") return false;
      const note = String(row.note ?? "").toLowerCase();
      if (note.includes("battle pulse mvp bonus") || note.includes("battle pulse mvp consolation")) return false;
      if (!note.includes("battle pulse wager")) return true;
      const studentId = String(row.student_id ?? "");
      const createdAt = String(row.created_at ?? "");
      const createdMs = createdAt ? Date.parse(createdAt) : 0;
      if (!studentId || !createdMs) return true;
      const winTimes = battleWinTimesByStudent.get(studentId) ?? [];
      return !winTimes.some((winMs) => Math.abs(winMs - createdMs) <= 15 * 60 * 1000);
    })
    .map((row: any) => {
    const points = Number(row.points ?? 0);
    const note = String(row.note ?? "");
    const studentId = String(row.student_id ?? "");
    const studentName = nameById.get(studentId) ?? "Student";
    const avatar = avatarByStudent.get(studentId) ?? {
      storage_path: null,
      zoom_pct: 100,
      bg_color: null,
      particle_style: null,
      corner_border_url: null,
      card_plate_url: null,
    };
    const category = String(row.category ?? "").toLowerCase();
    const isRedeem = category === "redeem" || note.toLowerCase().startsWith("redeemed:");
    const isBattle = note.toLowerCase().includes("battle pulse");
    const isSkillComplete =
      category === "skill_complete" || note.toLowerCase().startsWith("skill:");
    const isBattleWin = isBattle && points > 0 && note.toLowerCase().includes("win");
    const isBattleMvp = isBattle && note.toLowerCase().includes("mvp");
    const isSkillPulse = category === "skill_pulse" || note.toLowerCase().includes("skill pulse");
    const isRuleBreaker =
      category === "rule_breaker" || note.toLowerCase().includes("rule breaker");
    const isAvatarUnlock = category === "unlock_avatar";
    const isRoulette = category === "roulette_spin" || note.toLowerCase().includes("prize wheel");
    let title = isSkillPulse
      ? "Skill Pulse Complete"
      : points >= 0
      ? "Points Earned"
      : "Points Lost";
    let detail = `${studentName} ${points >= 0 ? "earned" : "lost"} ${Math.abs(points)} pts.`;
    if (isSkillComplete) {
      const skillName = note.replace(/^skill:\s*/i, "").trim() || "Skill";
      const sourceId = String(row.source_id ?? "");
      const setId = sourceId
        ? (skills ?? []).find((s: any) => String(s.id) === sourceId)?.set_id
        : undefined;
      const setName = setId ? setNameById.get(setId) : undefined;
      title = "Skill Completed";
      detail = `Skill • ${skillName}${setName ? ` • ${setName}` : ""} • +${Math.abs(points)} pts`;
    }

    let eventType = points >= 0 ? "points_gain" : "points_loss";
    if (isRedeem) {
      const rewardName = note.replace(/^redeemed:\s*/i, "").trim();
      title = "Prize Redeemed";
      detail = `Prize: ${rewardName || "Reward"} • ${Math.abs(points)} pts`;
      eventType = "redeem";
    } else if (isAvatarUnlock) {
      const avatarLabel = note.replace(/^unlock avatar:\s*/i, "").replace(/\(\s*-?\d+.*\)$/, "").trim();
      title = "Avatar Unlocked";
      detail = `Avatar • ${avatarLabel || "New Avatar"} • -${Math.abs(points)} pts`;
      eventType = "avatar_unlock";
    } else if (isRuleBreaker) {
      title = "Rule Breaker";
      detail = `Rule Breaker • -${Math.abs(points)} pts`;
      eventType = "rule_breaker";
    } else if (isBattleMvp) {
      title = "Battle Pulse MVP";
      detail = `MVP • ${points >= 0 ? "+" : "-"}${Math.abs(points)} pts`;
      eventType = "battle_pulse_mvp";
    } else if (isBattleWin) {
      title = "Battle Pulse Winner";
      const createdAt = String(row.created_at ?? "");
      const createdMs = createdAt ? Date.parse(createdAt) : 0;
      let skillName = "Battle Pulse";
      let wagerAmount = 0;
      let mvpBonus = 0;
      if (createdMs) {
        const matches = (battleRows ?? []).filter((b: any) => {
          if (!b?.settled_at) return false;
          const within = Math.abs(Date.parse(String(b.settled_at)) - createdMs) <= 15 * 60 * 1000;
          if (!within) return false;
          const participants = (b.participant_ids ?? []).map(String);
          const teamA = (b.team_a_ids ?? []).map(String);
          const teamB = (b.team_b_ids ?? []).map(String);
          const winnerId = String(b.winner_id ?? "");
          return winnerId === studentId || participants.includes(studentId) || teamA.includes(studentId) || teamB.includes(studentId);
        });
        const best =
          matches[0] ??
          (battleRows ?? []).find((b: any) => {
            const participants = (b.participant_ids ?? []).map(String);
            const teamA = (b.team_a_ids ?? []).map(String);
            const teamB = (b.team_b_ids ?? []).map(String);
            return String(b.winner_id ?? "") === studentId || participants.includes(studentId) || teamA.includes(studentId) || teamB.includes(studentId);
          });
        if (best?.tracker_skills?.name) skillName = String(best.tracker_skills.name);
        wagerAmount = Number(best?.wager_amount ?? 0);
      }
      if (createdMs) {
        const bonuses = battleMvpBonusByStudent.get(studentId) ?? [];
        const bonusHit = bonuses.find((b) => Math.abs(b.at - createdMs) <= 15 * 60 * 1000);
        if (bonusHit) mvpBonus = bonusHit.bonus;
      }
      const baseNet = wagerAmount > 0 ? Math.max(0, Math.abs(points) - wagerAmount) : Math.abs(points);
      const net = baseNet + mvpBonus;
      detail = `Battle Pulse • ${skillName} • +${net} pts${mvpBonus ? ` • MVP 2x (+${mvpBonus})` : ""}`;
      eventType = "battle_pulse_win";
    } else if (isBattle) {
      title = "Battle Pulse Result";
      const createdAt = String(row.created_at ?? "");
      const createdMs = createdAt ? Date.parse(createdAt) : 0;
      let consolation = 0;
      if (createdMs) {
        const bonuses = battleMvpConsolationByStudent.get(studentId) ?? [];
        const bonusHit = bonuses.find((b) => Math.abs(b.at - createdMs) <= 15 * 60 * 1000);
        if (bonusHit) consolation = bonusHit.bonus;
      }
      const baseLoss = Math.abs(points);
      const netLoss = consolation ? Math.max(0, baseLoss - consolation) : baseLoss;
      detail = `Battle Pulse • -${baseLoss} pts${consolation ? ` • MVP +${consolation} pts • Net -${netLoss} pts` : ""}`;
      eventType = "battle_pulse_loss";
    }
    if (isRoulette) {
      title = "Prize Wheel";
      detail = note || `Prize Wheel • ${points >= 0 ? "+" : "-"}${Math.abs(points)} pts`;
      eventType = "roulette";
    }
    if (isSkillPulse) eventType = "skill_pulse";
    if (isSkillComplete) eventType = "skill_complete";
    return {
      id: String(row.id ?? `ledger-${row.created_at}`),
      student_id: studentId,
      student_name: studentName,
      is_competition_team: compById.get(studentId) ?? false,
      avatar_storage_path: avatar.storage_path ?? null,
      avatar_zoom_pct: Number(avatar.zoom_pct ?? 100),
      avatar_zoom_pct: Number(avatar.zoom_pct ?? 100),
      avatar_bg: avatar.bg_color ?? null,
      avatar_effect: avatar.particle_style ?? null,
      corner_border_url: avatar.corner_border_url ?? null,
        corner_border_render_mode: avatar.corner_border_render_mode ?? null,
        corner_border_html: avatar.corner_border_html ?? null,
        corner_border_css: avatar.corner_border_css ?? null,
        corner_border_js: avatar.corner_border_js ?? null,
        corner_border_offset_x: avatar.corner_border_offset_x ?? 0,
        corner_border_offset_y: avatar.corner_border_offset_y ?? 0,
        corner_border_offsets_by_context: avatar.corner_border_offsets_by_context ?? {},
      card_plate_url: avatar.card_plate_url ?? null,
      points_total: pointsById.get(studentId) ?? null,
      points: Number(row.points ?? 0),
      points_base: row.points_base !== undefined && row.points_base !== null ? Number(row.points_base ?? 0) : null,
      points_multiplier:
        row.points_multiplier !== undefined && row.points_multiplier !== null ? Number(row.points_multiplier ?? 1) : null,
      title,
      detail,
      time: String(row.created_at ?? new Date().toISOString()),
      tone: isRoulette ? "roulette" : isAvatarUnlock ? "unlock" : isRedeem ? "redeem" : points >= 0 ? "win" : "loss",
      event_type: eventType,
    };
  });

  const badgeEvents: FeedItem[] = (badgeRows ?? []).map((row: any) => {
    const badgeName = String((row.achievement_badges as any)?.name ?? "Badge");
    const studentId = String(row.student_id ?? "");
    const studentName = nameById.get(studentId) ?? "Student";
    const avatar = avatarByStudent.get(studentId) ?? {
      storage_path: null,
      bg_color: null,
      particle_style: null,
      corner_border_url: null,
      card_plate_url: null,
    };
    return {
      id: String(row.id ?? `badge-${row.earned_at}`),
      student_id: studentId,
      student_name: studentName,
      is_competition_team: compById.get(studentId) ?? false,
      avatar_storage_path: avatar.storage_path ?? null,
      avatar_zoom_pct: Number(avatar.zoom_pct ?? 100),
      avatar_bg: avatar.bg_color ?? null,
      avatar_effect: avatar.particle_style ?? null,
      corner_border_url: avatar.corner_border_url ?? null,
        corner_border_render_mode: avatar.corner_border_render_mode ?? null,
        corner_border_html: avatar.corner_border_html ?? null,
        corner_border_css: avatar.corner_border_css ?? null,
        corner_border_js: avatar.corner_border_js ?? null,
        corner_border_offset_x: avatar.corner_border_offset_x ?? 0,
        corner_border_offset_y: avatar.corner_border_offset_y ?? 0,
        corner_border_offsets_by_context: avatar.corner_border_offsets_by_context ?? {},
      card_plate_url: avatar.card_plate_url ?? null,
      points_total: pointsById.get(studentId) ?? null,
      title: "Badge Earned",
      detail: `${studentName} earned ${badgeName}.`,
      time: String(row.earned_at ?? new Date().toISOString()),
      tone: "badge",
      event_type: "badge",
    };
  });

  const challengeEvents: FeedItem[] = (challengeRows ?? [])
    .filter((row: any) => row.completed_at)
    .map((row: any) => {
      const studentId = String(row.student_id ?? "");
      const studentName = nameById.get(studentId) ?? "Student";
      const avatar = avatarByStudent.get(studentId) ?? {
        storage_path: null,
        bg_color: null,
        particle_style: null,
        corner_border_url: null,
        card_plate_url: null,
      };
      const challenge = challengeById.get(String(row.challenge_id ?? ""));
      const tier = challenge?.tier ?? null;
      return {
        id: `challenge-${studentId}-${row.completed_at}`,
        student_id: studentId,
        student_name: studentName,
        is_competition_team: compById.get(studentId) ?? false,
        avatar_storage_path: avatar.storage_path ?? null,
        avatar_zoom_pct: Number(avatar.zoom_pct ?? 100),
        avatar_bg: avatar.bg_color ?? null,
        avatar_effect: avatar.particle_style ?? null,
        corner_border_url: avatar.corner_border_url ?? null,
        corner_border_render_mode: avatar.corner_border_render_mode ?? null,
        corner_border_html: avatar.corner_border_html ?? null,
        corner_border_css: avatar.corner_border_css ?? null,
        corner_border_js: avatar.corner_border_js ?? null,
        corner_border_offset_x: avatar.corner_border_offset_x ?? 0,
        corner_border_offset_y: avatar.corner_border_offset_y ?? 0,
        corner_border_offsets_by_context: avatar.corner_border_offsets_by_context ?? {},
        card_plate_url: avatar.card_plate_url ?? null,
        points_total: pointsById.get(studentId) ?? null,
        title: "Challenge Complete",
        detail: `${studentName} completed ${challenge?.name ?? "a challenge"}.`,
        time: String(row.completed_at ?? new Date().toISOString()),
        tone: "badge",
        event_type: "challenge",
        challenge_tier: tier,
        challenge_medal_url: tier ? medalUrlByTier.get(tier) ?? null : null,
        challenge_points: challenge?.points ?? null,
      };
    });

  const rouletteEvents: FeedItem[] = (rouletteRows ?? [])
    .filter((row: any) => Number(row.points_delta ?? 0) === 0)
    .map((row: any) => {
    const studentId = String(row.student_id ?? "");
    const studentName = nameById.get(studentId) ?? "Student";
    const avatar = avatarByStudent.get(studentId) ?? {
      storage_path: null,
      zoom_pct: 100,
      bg_color: null,
      particle_style: null,
      corner_border_url: null,
      card_plate_url: null,
    };
    const wheelName = String(row.roulette_wheels?.name ?? "Prize Wheel");
    const segLabelRaw = String(row.roulette_segments?.label ?? row.prize_text ?? row.item_key ?? "Spin Result");
    const segLabelLower = segLabelRaw.trim().toLowerCase();
    const segLabel =
      !segLabelRaw.trim() || segLabelLower === "new segment" || segLabelLower === "segment"
        ? "Spin Result"
        : segLabelRaw;
    const segType = String(row.roulette_segments?.segment_type ?? "");
    const prizeText = row.prize_text ?? row.roulette_segments?.prize_text ?? null;
    const itemKey = row.item_key ?? row.roulette_segments?.item_key ?? null;
    let detail = `${wheelName} • ${segLabel}`;
    if (segType === "prize" && prizeText) detail = `Prize Wheel • ${prizeText}`;
    if (segType === "item" && itemKey) detail = `Prize Wheel • ${itemKey}`;
    return {
      id: `roulette-${row.id}`,
      student_id: studentId,
      student_name: studentName,
      is_competition_team: compById.get(studentId) ?? false,
      avatar_storage_path: avatar.storage_path ?? null,
      avatar_zoom_pct: Number(avatar.zoom_pct ?? 100),
      avatar_bg: avatar.bg_color ?? null,
      avatar_effect: avatar.particle_style ?? null,
      corner_border_url: avatar.corner_border_url ?? null,
        corner_border_render_mode: avatar.corner_border_render_mode ?? null,
        corner_border_html: avatar.corner_border_html ?? null,
        corner_border_css: avatar.corner_border_css ?? null,
        corner_border_js: avatar.corner_border_js ?? null,
        corner_border_offset_x: avatar.corner_border_offset_x ?? 0,
        corner_border_offset_y: avatar.corner_border_offset_y ?? 0,
        corner_border_offsets_by_context: avatar.corner_border_offsets_by_context ?? {},
      card_plate_url: avatar.card_plate_url ?? null,
      points_total: pointsById.get(studentId) ?? null,
      title: "Prize Wheel",
      detail,
      time: String(row.confirmed_at ?? row.created_at ?? new Date().toISOString()),
      tone: "roulette",
      event_type: "roulette",
    };
  });

  const items = [
    ...ledgerEvents,
    ...rouletteEvents,
    ...badgeEvents,
    ...challengeEvents,
    ...skillTreeEvents,
    ...top3Events,
  ]
    .filter((item) => !item.event_type || liveActivityTypes.has(item.event_type))
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, limit);

  return NextResponse.json({ ok: true, items });
}

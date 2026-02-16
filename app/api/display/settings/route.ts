import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

const LIVE_ACTIVITY_TYPES = [
  "points_gain",
  "points_loss",
  "rule_keeper",
  "rule_breaker",
  "skill_pulse",
  "skill_complete",
  "battle_pulse_win",
  "battle_pulse_loss",
  "battle_pulse_mvp",
  "level_up",
  "redeem",
  "avatar_unlock",
  "roulette",
  "badge",
  "challenge",
  "skilltree",
  "top3_weekly",
] as const;

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

const DEFAULT_COACH_ACTIVITY_TYPES = ["battle_pulse_mvp", "level_up", "rule_keeper"];

const ALLOWED_DISPLAY_MODULES = new Set([
  "none",
  "live_activity",
  "skill_pulse",
  "battle_pulse",
  "badges",
  "leaderboards",
]);

function normalizeTypes(input: any) {
  const allowed = new Set(LIVE_ACTIVITY_TYPES);
  const list = Array.isArray(input) ? input : [];
  const next = list
    .map((v) => String(v ?? "").trim())
    .filter((v) => allowed.has(v as (typeof LIVE_ACTIVITY_TYPES)[number]));
  return next.length ? next : [...LIVE_ACTIVITY_TYPES];
}

function normalizeCoachTypes(input: any) {
  const allowed = new Set(LIVE_ACTIVITY_TYPES);
  const list = Array.isArray(input) ? input : [];
  return list
    .map((v) => String(v ?? "").trim())
    .filter((v) => allowed.has(v as (typeof LIVE_ACTIVITY_TYPES)[number]));
}

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

function normalizeBlankSlots(input: any) {
  const raw = Array.isArray(input) ? input : [];
  return Array.from({ length: 6 }, (_, idx) => {
    const slot = idx + 1;
    const candidate = raw[idx] || raw.find((row: any) => Number(row?.slot ?? 0) === slot) || {};
    const displayModule = String(candidate?.module ?? "none").trim() || "none";
    return { slot, module: ALLOWED_DISPLAY_MODULES.has(displayModule) ? displayModule : "none" };
  });
}

export async function GET() {
  const supabase = await supabaseServer();
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

  const { data, error } = await supabase
    .from("ui_display_settings")
    .select("id,live_activity_enabled,skill_pulse_enabled,battle_pulse_enabled,badges_enabled,leaderboard_display_enabled,live_activity_types,coach_display_activity_types,leaderboard_slots,leaderboard_large_rotations,display_blank_slots,updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const types = normalizeTypes(data?.live_activity_types);
  const coachTypes =
    data?.coach_display_activity_types == null
      ? DEFAULT_COACH_ACTIVITY_TYPES
      : normalizeCoachTypes(data?.coach_display_activity_types);
  const leaderboardSlots = normalizeLeaderboardSlots(data?.leaderboard_slots);
  const leaderboardLargeRotations = normalizeLargeRotations(data?.leaderboard_large_rotations);
  const blankSlots = normalizeBlankSlots(data?.display_blank_slots);
  return NextResponse.json({
    ok: true,
    settings: {
      id: 1,
      live_activity_enabled: data?.live_activity_enabled ?? true,
      skill_pulse_enabled: data?.skill_pulse_enabled ?? true,
      battle_pulse_enabled: data?.battle_pulse_enabled ?? true,
      badges_enabled: data?.badges_enabled ?? true,
      leaderboard_display_enabled: data?.leaderboard_display_enabled ?? true,
      live_activity_types: types,
      coach_display_activity_types: coachTypes,
      leaderboard_slots: leaderboardSlots,
      leaderboard_large_rotations: leaderboardLargeRotations,
      display_blank_slots: blankSlots,
      updated_at: data?.updated_at ?? null,
    },
  });
}

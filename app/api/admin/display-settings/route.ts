import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
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
  { metric: "rule_keeper_total", title: "Rule Keeper Total", rank_window: "top10" },
  { metric: "skill_pulse_today", title: "Skill Pulse Today", rank_window: "top10" },
];

const DEFAULT_LARGE_ROTATIONS = [
  { slot: 1, rotation: [1, 8, 2] },
  { slot: 2, rotation: [2, 9, 3] },
  { slot: 3, rotation: [3, 10, 4] },
  { slot: 4, rotation: [4, 7, 1] },
  { slot: 5, rotation: [5, 6, 7, 8, 9] },
  { slot: 6, rotation: [10, 11, 12, 5, 6] },
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
    const expectedCount = Array.isArray(fallback.rotation) ? fallback.rotation.length : 3;
    const rotation = Array.from({ length: expectedCount }, (_, rIdx) => clampSlot(rotationRaw[rIdx], fallback.rotation[rIdx]));
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

async function requireAdmin() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { ok: false as const, error: "Not logged in" };

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id)
    .eq("role", "admin")
    .limit(1);

  if (error) return { ok: false as const, error: error.message };
  if (!roles || roles.length === 0) return { ok: false as const, error: "Admin access required" };

  return { ok: true as const };
}

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
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

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const live_activity_enabled = body?.live_activity_enabled !== false;
  const skill_pulse_enabled = body?.skill_pulse_enabled !== false;
  const battle_pulse_enabled = body?.battle_pulse_enabled !== false;
  const badges_enabled = body?.badges_enabled !== false;
  const leaderboard_display_enabled = body?.leaderboard_display_enabled !== false;
  const live_activity_types = normalizeTypes(body?.live_activity_types);
  const coach_display_activity_types = normalizeCoachTypes(body?.coach_display_activity_types);
  const leaderboard_slots = normalizeLeaderboardSlots(body?.leaderboard_slots);
  const leaderboard_large_rotations = normalizeLargeRotations(body?.leaderboard_large_rotations);
  const display_blank_slots = normalizeBlankSlots(body?.display_blank_slots);

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("ui_display_settings")
    .upsert(
      {
        id: 1,
        live_activity_enabled,
        skill_pulse_enabled,
        battle_pulse_enabled,
        badges_enabled,
        leaderboard_display_enabled,
        live_activity_types,
        coach_display_activity_types,
        leaderboard_slots,
        leaderboard_large_rotations,
        display_blank_slots,
      },
      { onConflict: "id" }
    )
    .select("id,live_activity_enabled,skill_pulse_enabled,battle_pulse_enabled,badges_enabled,leaderboard_display_enabled,live_activity_types,coach_display_activity_types,leaderboard_slots,leaderboard_large_rotations,display_blank_slots,updated_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, settings: data });
}

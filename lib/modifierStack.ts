import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ModRow = {
  rule_keeper_multiplier?: number | null;
  rule_breaker_multiplier?: number | null;
  skill_pulse_multiplier?: number | null;
  spotlight_multiplier?: number | null;
  daily_free_points?: number | null;
  challenge_completion_bonus_pct?: number | null;
  mvp_bonus_pct?: number | null;
};

export type ModifierStack = {
  rule_keeper_multiplier: number;
  rule_breaker_multiplier: number;
  skill_pulse_multiplier: number;
  spotlight_multiplier: number;
  daily_free_points: number;
  challenge_completion_bonus_pct: number;
  mvp_bonus_pct: number;
};

const DEFAULTS: ModifierStack = {
  rule_keeper_multiplier: 1,
  rule_breaker_multiplier: 1,
  skill_pulse_multiplier: 1,
  spotlight_multiplier: 1,
  daily_free_points: 0,
  challenge_completion_bonus_pct: 0,
  mvp_bonus_pct: 0,
};

function n(v: unknown, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function delta(m: unknown) {
  return n(m, 1) - 1;
}

function sumPct(...vals: Array<unknown>) {
  return vals.reduce<number>((acc, v) => acc + Math.max(0, n(v, 0)), 0);
}

function sumInt(...vals: Array<unknown>) {
  return vals.reduce<number>((acc, v) => acc + Math.max(0, Math.round(n(v, 0))), 0);
}

function pick(row: any): ModRow {
  return {
    rule_keeper_multiplier: n(row?.rule_keeper_multiplier, 1),
    rule_breaker_multiplier: n(row?.rule_breaker_multiplier, 1),
    skill_pulse_multiplier: n(row?.skill_pulse_multiplier, 1),
    spotlight_multiplier: n(row?.spotlight_multiplier, 1),
    daily_free_points: n(row?.daily_free_points, 0),
    challenge_completion_bonus_pct: n(row?.challenge_completion_bonus_pct, 0),
    mvp_bonus_pct: n(row?.mvp_bonus_pct, 0),
  };
}

export async function getStudentModifierStack(studentId: string): Promise<ModifierStack> {
  const sid = String(studentId ?? "").trim();
  if (!sid) return { ...DEFAULTS };
  const admin = supabaseAdmin();

  const settingsRes = await admin
    .from("student_avatar_settings")
    .select("avatar_id,particle_style,corner_border_key")
    .eq("student_id", sid)
    .maybeSingle();
  if (settingsRes.error) return { ...DEFAULTS };
  const settings: any = settingsRes.data ?? {};
  const avatarId = String(settings.avatar_id ?? "").trim();
  const effectKey = String(settings.particle_style ?? "").trim();
  const borderKey = String(settings.corner_border_key ?? "").trim();

  const [avatarRes, effectRes, borderRes] = await Promise.all([
    avatarId
      ? admin
          .from("avatars")
          .select(
            "rule_keeper_multiplier,rule_breaker_multiplier,skill_pulse_multiplier,spotlight_multiplier,daily_free_points,challenge_completion_bonus_pct,mvp_bonus_pct"
          )
          .eq("id", avatarId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null } as any),
    effectKey
      ? admin
          .from("avatar_effects")
          .select(
            "enabled,rule_keeper_multiplier,rule_breaker_multiplier,skill_pulse_multiplier,spotlight_multiplier,daily_free_points,challenge_completion_bonus_pct,mvp_bonus_pct"
          )
          .eq("key", effectKey)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null } as any),
    borderKey
      ? admin
          .from("ui_corner_borders")
          .select(
            "enabled,rule_keeper_multiplier,rule_breaker_multiplier,skill_pulse_multiplier,spotlight_multiplier,daily_free_points,challenge_completion_bonus_pct,mvp_bonus_pct"
          )
          .eq("key", borderKey)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null } as any),
  ]);

  const avatar = pick(avatarRes?.data);
  const effect = effectRes?.data && effectRes.data.enabled !== false ? pick(effectRes.data) : pick(null);
  const border = borderRes?.data && borderRes.data.enabled !== false ? pick(borderRes.data) : pick(null);

  return {
    rule_keeper_multiplier: Math.max(0, 1 + delta(avatar.rule_keeper_multiplier) + delta(effect.rule_keeper_multiplier) + delta(border.rule_keeper_multiplier)),
    rule_breaker_multiplier: Math.max(0, 1 + delta(avatar.rule_breaker_multiplier) + delta(effect.rule_breaker_multiplier) + delta(border.rule_breaker_multiplier)),
    skill_pulse_multiplier: Math.max(0, 1 + delta(avatar.skill_pulse_multiplier) + delta(effect.skill_pulse_multiplier) + delta(border.skill_pulse_multiplier)),
    spotlight_multiplier: Math.max(0, 1 + delta(avatar.spotlight_multiplier) + delta(effect.spotlight_multiplier) + delta(border.spotlight_multiplier)),
    daily_free_points: sumInt(avatar.daily_free_points, effect.daily_free_points, border.daily_free_points),
    challenge_completion_bonus_pct: sumPct(avatar.challenge_completion_bonus_pct, effect.challenge_completion_bonus_pct, border.challenge_completion_bonus_pct),
    mvp_bonus_pct: sumPct(avatar.mvp_bonus_pct, effect.mvp_bonus_pct, border.mvp_bonus_pct),
  };
}

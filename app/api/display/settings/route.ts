import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

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
    .select("id,live_activity_enabled,skill_pulse_enabled,battle_pulse_enabled,badges_enabled,live_activity_types,updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const types = normalizeTypes(data?.live_activity_types);
  return NextResponse.json({
    ok: true,
    settings: {
      id: 1,
      live_activity_enabled: data?.live_activity_enabled ?? true,
      skill_pulse_enabled: data?.skill_pulse_enabled ?? true,
      battle_pulse_enabled: data?.battle_pulse_enabled ?? true,
      badges_enabled: data?.badges_enabled ?? true,
      live_activity_types: types,
      updated_at: data?.updated_at ?? null,
    },
  });
}

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
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

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const live_activity_enabled = body?.live_activity_enabled !== false;
  const skill_pulse_enabled = body?.skill_pulse_enabled !== false;
  const battle_pulse_enabled = body?.battle_pulse_enabled !== false;
  const badges_enabled = body?.badges_enabled !== false;
  const live_activity_types = normalizeTypes(body?.live_activity_types);

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
        live_activity_types,
      },
      { onConflict: "id" }
    )
    .select("id,live_activity_enabled,skill_pulse_enabled,battle_pulse_enabled,badges_enabled,live_activity_types,updated_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, settings: data });
}

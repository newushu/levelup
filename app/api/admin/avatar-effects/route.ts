import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const SELECT_WITH_LAYER =
  "id,key,name,unlock_level,unlock_points,config,render_mode,z_layer,html,css,js,enabled,rule_keeper_multiplier,rule_breaker_multiplier,skill_pulse_multiplier,spotlight_multiplier,daily_free_points,challenge_completion_bonus_pct,mvp_bonus_pct,limited_event_only,limited_event_name,limited_event_description";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const admin = supabaseAdmin();
  let {
    data,
    error,
  }: {
    data: any[] | null;
    error: { message?: string } | null;
  } = await admin
    .from("avatar_effects")
    .select(SELECT_WITH_LAYER)
    .order("unlock_level", { ascending: true })
    .order("name", { ascending: true });

  if (error && /z_layer|limited_event_|rule_keeper_multiplier|rule_breaker_multiplier|skill_pulse_multiplier|spotlight_multiplier|daily_free_points|challenge_completion_bonus_pct|mvp_bonus_pct/i.test(error.message ?? "")) {
    const fallback = await admin
      .from("avatar_effects")
      .select("id,key,name,unlock_level,unlock_points,config,render_mode,html,css,js,enabled")
      .order("unlock_level", { ascending: true })
      .order("name", { ascending: true });
    data = (fallback.data ?? []).map((row: any) => ({
      ...row,
      z_layer: "behind_avatar",
      rule_keeper_multiplier: 1,
      rule_breaker_multiplier: 1,
      skill_pulse_multiplier: 1,
      spotlight_multiplier: 1,
      daily_free_points: 0,
      challenge_completion_bonus_pct: 0,
      mvp_bonus_pct: 0,
      limited_event_only: false,
      limited_event_name: "",
      limited_event_description: "",
    }));
    error = fallback.error;
  }

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, effects: data ?? [] });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  const key = String(body?.key ?? "").trim();
  const name = String(body?.name ?? "").trim();
  const unlock_level = Math.max(1, Math.floor(Number(body?.unlock_level ?? 1)));
  const unlock_points = Math.max(0, Math.floor(Number(body?.unlock_points ?? 0)));
  const config = typeof body?.config === "object" && body?.config ? body.config : {};
  const render_mode = String(body?.render_mode ?? "particles").trim() || "particles";
  const z_layer = String(body?.z_layer ?? "behind_avatar").trim() || "behind_avatar";
  const html = typeof body?.html === "string" ? body.html : "";
  const css = typeof body?.css === "string" ? body.css : "";
  const js = typeof body?.js === "string" ? body.js : "";
  const enabled = body?.enabled !== false;
  const rule_keeper_multiplier = Number(body?.rule_keeper_multiplier ?? 1);
  const rule_breaker_multiplier = Number(body?.rule_breaker_multiplier ?? 1);
  const skill_pulse_multiplier = Number(body?.skill_pulse_multiplier ?? 1);
  const spotlight_multiplier = Number(body?.spotlight_multiplier ?? 1);
  const daily_free_points = Math.max(0, Math.floor(Number(body?.daily_free_points ?? 0)));
  const challenge_completion_bonus_pct = Math.max(0, Number(body?.challenge_completion_bonus_pct ?? 0));
  const mvp_bonus_pct = Math.max(0, Number(body?.mvp_bonus_pct ?? 0));
  const limited_event_only = body?.limited_event_only === true;
  const limited_event_name = String(body?.limited_event_name ?? "").trim();
  const limited_event_description = String(body?.limited_event_description ?? "").trim();

  if (!key) return NextResponse.json({ ok: false, error: "Key is required" }, { status: 400 });
  if (!name) return NextResponse.json({ ok: false, error: "Name is required" }, { status: 400 });

  const payload: any = {
    key,
    name,
    unlock_level,
    unlock_points,
    config,
    render_mode,
    z_layer,
    html,
    css,
    js,
    enabled,
    rule_keeper_multiplier,
    rule_breaker_multiplier,
    skill_pulse_multiplier,
    spotlight_multiplier,
    daily_free_points,
    challenge_completion_bonus_pct,
    mvp_bonus_pct,
    limited_event_only,
    limited_event_name,
    limited_event_description,
  };

  const admin = supabaseAdmin();
  if (id) {
    let {
      data,
      error,
    }: {
      data: any | null;
      error: { message?: string } | null;
    } = await admin
      .from("avatar_effects")
      .upsert({ id, ...payload }, { onConflict: "id" })
      .select(SELECT_WITH_LAYER)
      .single();
    if (error && /z_layer|limited_event_|rule_keeper_multiplier|rule_breaker_multiplier|skill_pulse_multiplier|spotlight_multiplier|daily_free_points|challenge_completion_bonus_pct|mvp_bonus_pct/i.test(error.message ?? "")) {
      const {
        z_layer: _ignored,
        limited_event_only: _x,
        limited_event_name: _y,
        limited_event_description: _z,
        rule_keeper_multiplier: _a,
        rule_breaker_multiplier: _b,
        skill_pulse_multiplier: _c,
        spotlight_multiplier: _d,
        daily_free_points: _e,
        challenge_completion_bonus_pct: _f,
        mvp_bonus_pct: _g,
        ...legacyPayload
      } = payload;
      const fallback = await admin
        .from("avatar_effects")
        .upsert({ id, ...legacyPayload }, { onConflict: "id" })
        .select("id,key,name,unlock_level,unlock_points,config,render_mode,html,css,js,enabled")
        .single();
      data = fallback.data
        ? {
            ...fallback.data,
            z_layer: "behind_avatar",
            rule_keeper_multiplier: 1,
            rule_breaker_multiplier: 1,
            skill_pulse_multiplier: 1,
            spotlight_multiplier: 1,
            daily_free_points: 0,
            challenge_completion_bonus_pct: 0,
            mvp_bonus_pct: 0,
            limited_event_only: false,
            limited_event_name: "",
            limited_event_description: "",
          }
        : fallback.data;
      error = fallback.error;
    }
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, effect: data });
  }

  let {
    data,
    error,
  }: {
    data: any | null;
    error: { message?: string } | null;
  } = await admin
    .from("avatar_effects")
    .upsert(payload, { onConflict: "key" })
    .select(SELECT_WITH_LAYER)
    .single();
  if (error && /z_layer|limited_event_|rule_keeper_multiplier|rule_breaker_multiplier|skill_pulse_multiplier|spotlight_multiplier|daily_free_points|challenge_completion_bonus_pct|mvp_bonus_pct/i.test(error.message ?? "")) {
    const {
      z_layer: _ignored,
      limited_event_only: _x,
      limited_event_name: _y,
      limited_event_description: _z,
      rule_keeper_multiplier: _a,
      rule_breaker_multiplier: _b,
      skill_pulse_multiplier: _c,
      spotlight_multiplier: _d,
      daily_free_points: _e,
      challenge_completion_bonus_pct: _f,
      mvp_bonus_pct: _g,
      ...legacyPayload
    } = payload;
    const fallback = await admin
      .from("avatar_effects")
      .upsert(legacyPayload, { onConflict: "key" })
      .select("id,key,name,unlock_level,unlock_points,config,render_mode,html,css,js,enabled")
      .single();
    data = fallback.data
      ? {
          ...fallback.data,
          z_layer: "behind_avatar",
          rule_keeper_multiplier: 1,
          rule_breaker_multiplier: 1,
          skill_pulse_multiplier: 1,
          spotlight_multiplier: 1,
          daily_free_points: 0,
          challenge_completion_bonus_pct: 0,
          mvp_bonus_pct: 0,
          limited_event_only: false,
          limited_event_name: "",
          limited_event_description: "",
        }
      : fallback.data;
    error = fallback.error;
  }
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, effect: data });
}

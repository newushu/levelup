import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("avatars")
    .select(
      "id,name,storage_path,enabled,is_secondary,unlock_level,unlock_points,rule_keeper_multiplier,rule_breaker_multiplier,skill_pulse_multiplier,spotlight_multiplier,daily_free_points,challenge_completion_bonus_pct,zoom_pct,competition_only,competition_discount_pct"
    )
    .order("unlock_level", { ascending: true })
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, avatars: data ?? [] });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  const name = String(body?.name ?? "").trim();
  const storage_path = String(body?.storage_path ?? "").trim();
  const enabled = body?.enabled !== false;
  const is_secondary = body?.is_secondary === true;
  const unlock_level = Number(body?.unlock_level ?? 1);
  const unlock_points = Math.max(0, Math.floor(Number(body?.unlock_points ?? 0)));
  const rule_keeper_multiplier = Number(body?.rule_keeper_multiplier ?? 1);
  const rule_breaker_multiplier = Number(body?.rule_breaker_multiplier ?? 1);
  const skill_pulse_multiplier = Number(body?.skill_pulse_multiplier ?? 1);
  const spotlight_multiplier = Number(body?.spotlight_multiplier ?? 1);
  const daily_free_points = Math.max(0, Math.floor(Number(body?.daily_free_points ?? 0)));
  const challenge_completion_bonus_pct = Math.max(0, Number(body?.challenge_completion_bonus_pct ?? 0));
  const zoom_pct = Math.max(50, Math.min(200, Math.floor(Number(body?.zoom_pct ?? 100))));
  const competition_only = body?.competition_only === true;
  const competition_discount_pct = Math.max(0, Math.min(100, Math.floor(Number(body?.competition_discount_pct ?? 0))));

  if (!name) return NextResponse.json({ ok: false, error: "Name is required" }, { status: 400 });
  if (!storage_path) return NextResponse.json({ ok: false, error: "Storage path is required" }, { status: 400 });
  if (!Number.isFinite(unlock_level) || unlock_level < 1) {
    return NextResponse.json({ ok: false, error: "Unlock level must be 1 or higher" }, { status: 400 });
  }

  const payload: any = {
    name,
    storage_path,
    enabled,
    is_secondary,
    unlock_level: Math.floor(unlock_level),
    unlock_points,
    rule_keeper_multiplier,
    rule_breaker_multiplier,
    skill_pulse_multiplier,
    spotlight_multiplier,
    daily_free_points,
    challenge_completion_bonus_pct,
    zoom_pct,
    competition_only,
    competition_discount_pct,
  };

  const admin = supabaseAdmin();
  if (id) {
    const { data, error } = await admin
      .from("avatars")
      .upsert({ id, ...payload }, { onConflict: "id" })
      .select(
        "id,name,storage_path,enabled,is_secondary,unlock_level,unlock_points,rule_keeper_multiplier,rule_breaker_multiplier,skill_pulse_multiplier,spotlight_multiplier,daily_free_points,challenge_completion_bonus_pct,zoom_pct,competition_only,competition_discount_pct"
      )
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, avatar: data });
  }

  const newId = crypto.randomUUID();
  const { data, error } = await admin
    .from("avatars")
    .insert({ id: newId, ...payload })
    .select(
      "id,name,storage_path,enabled,is_secondary,unlock_level,unlock_points,rule_keeper_multiplier,rule_breaker_multiplier,skill_pulse_multiplier,spotlight_multiplier,daily_free_points,challenge_completion_bonus_pct,zoom_pct,competition_only,competition_discount_pct"
    )
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, avatar: data });
}

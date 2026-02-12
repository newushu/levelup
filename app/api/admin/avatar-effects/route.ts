import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const SELECT_WITH_LAYER = "id,key,name,unlock_level,unlock_points,config,render_mode,z_layer,html,css,js,enabled";
const SELECT_NO_LAYER = "id,key,name,unlock_level,unlock_points,config,render_mode,html,css,js,enabled";

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

  if (error && /z_layer/i.test(error.message ?? "")) {
    const fallback = await admin
      .from("avatar_effects")
      .select(SELECT_NO_LAYER)
      .order("unlock_level", { ascending: true })
      .order("name", { ascending: true });
    data = (fallback.data ?? []).map((row: any) => ({ ...row, z_layer: "behind_avatar" }));
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
    if (error && /z_layer/i.test(error.message ?? "")) {
      const { z_layer: _ignored, ...legacyPayload } = payload;
      const fallback = await admin
        .from("avatar_effects")
        .upsert({ id, ...legacyPayload }, { onConflict: "id" })
        .select(SELECT_NO_LAYER)
        .single();
      data = fallback.data ? { ...fallback.data, z_layer: "behind_avatar" } : fallback.data;
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
  if (error && /z_layer/i.test(error.message ?? "")) {
    const { z_layer: _ignored, ...legacyPayload } = payload;
    const fallback = await admin
      .from("avatar_effects")
      .upsert(legacyPayload, { onConflict: "key" })
      .select(SELECT_NO_LAYER)
      .single();
    data = fallback.data ? { ...fallback.data, z_layer: "behind_avatar" } : fallback.data;
    error = fallback.error;
  }
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, effect: data });
}

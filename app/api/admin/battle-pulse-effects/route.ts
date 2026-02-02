import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("battle_pulse_effects")
    .select("id,key,name,effect_type,effect_types,offset_x,offset_y,html,css,js,enabled")
    .order("name", { ascending: true });

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
  const html = typeof body?.html === "string" ? body.html : "";
  const css = typeof body?.css === "string" ? body.css : "";
  const js = typeof body?.js === "string" ? body.js : "";
  const rawTypes = String(body?.effect_types ?? "").trim();
  const legacyType = String(body?.effect_type ?? "attack").trim().toLowerCase() || "attack";
  const effect_types =
    rawTypes
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .join(",") || legacyType;
  const effect_type = effect_types.split(",")[0] || legacyType;
  const offset_x = Number.isFinite(Number(body?.offset_x)) ? Number(body.offset_x) : 0;
  const offset_y = Number.isFinite(Number(body?.offset_y)) ? Number(body.offset_y) : 0;
  const enabled = body?.enabled !== false;

  if (!key) return NextResponse.json({ ok: false, error: "Key is required" }, { status: 400 });
  if (!name) return NextResponse.json({ ok: false, error: "Name is required" }, { status: 400 });

  const payload = { key, name, effect_type, effect_types, offset_x, offset_y, html, css, js, enabled };
  const admin = supabaseAdmin();

  if (id) {
    const { data, error } = await admin
      .from("battle_pulse_effects")
      .upsert({ id, ...payload }, { onConflict: "id" })
      .select("id,key,name,effect_type,effect_types,offset_x,offset_y,html,css,js,enabled")
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, effect: data });
  }

  const { data, error } = await admin
    .from("battle_pulse_effects")
    .upsert(payload, { onConflict: "key" })
    .select("id,key,name,effect_type,effect_types,offset_x,offset_y,html,css,js,enabled")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, effect: data });
}

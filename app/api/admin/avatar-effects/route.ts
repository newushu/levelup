import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("avatar_effects")
    .select("id,key,name,unlock_level,unlock_points,config,render_mode,html,css,js,enabled")
    .order("unlock_level", { ascending: true })
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
  const unlock_level = Math.max(1, Math.floor(Number(body?.unlock_level ?? 1)));
  const unlock_points = Math.max(0, Math.floor(Number(body?.unlock_points ?? 0)));
  const config = typeof body?.config === "object" && body?.config ? body.config : {};
  const render_mode = String(body?.render_mode ?? "particles").trim() || "particles";
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
    html,
    css,
    js,
    enabled,
  };

  const admin = supabaseAdmin();
  if (id) {
    const { data, error } = await admin
      .from("avatar_effects")
      .upsert({ id, ...payload }, { onConflict: "id" })
      .select("id,key,name,unlock_level,unlock_points,config,render_mode,html,css,js,enabled")
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, effect: data });
  }

  const { data, error } = await admin
    .from("avatar_effects")
    .upsert(payload, { onConflict: "key" })
    .select("id,key,name,unlock_level,unlock_points,config,render_mode,html,css,js,enabled")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, effect: data });
}

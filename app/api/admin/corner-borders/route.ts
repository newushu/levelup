import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabase/server";

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
    .from("ui_corner_borders")
    .select("id,key,name,image_url,render_mode,offset_x,offset_y,offsets_by_context,html,css,js,unlock_level,unlock_points,enabled,updated_at")
    .order("unlock_level", { ascending: true })
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, borders: data ?? [] });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const key = String(body?.key ?? "").trim();
  const name = String(body?.name ?? "").trim();
  const image_url = String(body?.image_url ?? "").trim() || null;
  const render_mode = String(body?.render_mode ?? "image").trim() || "image";
  const offset_x = Number.isFinite(Number(body?.offset_x)) ? Math.floor(Number(body?.offset_x)) : 0;
  const offset_y = Number.isFinite(Number(body?.offset_y)) ? Math.floor(Number(body?.offset_y)) : 0;
  const offsets_by_context =
    typeof body?.offsets_by_context === "object" && body.offsets_by_context !== null ? body.offsets_by_context : {};
  const html = typeof body?.html === "string" ? body.html : "";
  const css = typeof body?.css === "string" ? body.css : "";
  const js = typeof body?.js === "string" ? body.js : "";
  const unlock_level_raw = Number(body?.unlock_level ?? 1);
  const unlock_level = Number.isFinite(unlock_level_raw) && unlock_level_raw > 0 ? Math.floor(unlock_level_raw) : 1;
  const unlock_points = Math.max(0, Math.floor(Number(body?.unlock_points ?? 0)));
  const enabled = body?.enabled !== false;

  if (!key || !name) {
    return NextResponse.json({ ok: false, error: "Missing key or name" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("ui_corner_borders")
    .upsert(
      {
        id: body?.id ?? undefined,
        key,
        name,
        image_url,
        render_mode,
        offset_x,
        offset_y,
        offsets_by_context,
        html,
        css,
        js,
        unlock_level,
        unlock_points,
        enabled,
      },
      { onConflict: "key" }
    )
    .select("id,key,name,image_url,render_mode,offset_x,offset_y,offsets_by_context,html,css,js,unlock_level,unlock_points,enabled,updated_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, border: data });
}

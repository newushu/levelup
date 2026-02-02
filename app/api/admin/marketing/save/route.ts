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

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  const title = String(body?.title ?? "").trim();
  const message = String(body?.message ?? "").trim();
  const image_url = String(body?.image_url ?? "").trim();
  const image_scale = Number(body?.image_scale ?? 1);
  const image_x = Number(body?.image_x ?? 0);
  const image_y = Number(body?.image_y ?? 0);
  const image_rotate = Number(body?.image_rotate ?? 0);
  const border_style = String(body?.border_style ?? "none").trim();
  const border_color = String(body?.border_color ?? "").trim();
  const template_key = String(body?.template_key ?? "").trim();
  const template_payload = body?.template_payload ?? null;
  const enabled = body?.enabled !== false;

  if (!title && !message) {
    return NextResponse.json({ ok: false, error: "Title or message is required" }, { status: 400 });
  }

  const payload: any = {
    title: title || null,
    message: message || null,
    image_url: image_url || null,
    enabled,
    image_scale: Number.isFinite(image_scale) ? image_scale : 1,
    image_x: Number.isFinite(image_x) ? image_x : 0,
    image_y: Number.isFinite(image_y) ? image_y : 0,
    image_rotate: Number.isFinite(image_rotate) ? image_rotate : 0,
    border_style: border_style || "none",
    border_color: border_color || null,
    template_key: template_key || null,
    template_payload,
  };

  const admin = supabaseAdmin();
  if (id) {
    const { data, error } = await admin
      .from("marketing_announcements")
      .upsert({ id, ...payload }, { onConflict: "id" })
      .select(
        "id,title,message,image_url,enabled,created_at,image_scale,image_x,image_y,image_rotate,border_style,border_color,template_key,template_payload"
      )
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, announcement: data });
  }

  const { data, error } = await admin
    .from("marketing_announcements")
    .insert(payload)
    .select(
      "id,title,message,image_url,enabled,created_at,image_scale,image_x,image_y,image_rotate,border_style,border_color,template_key,template_payload"
    )
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, announcement: data });
}

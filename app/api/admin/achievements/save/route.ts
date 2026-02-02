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
  const name = String(body?.name ?? "").trim();
  const description = String(body?.description ?? "").trim();
  const category = String(body?.category ?? "").trim();
  const icon_path = String(body?.icon_path ?? "").trim();
  const criteria_type = String(body?.criteria_type ?? "").trim();
  const badge_library_id = String(body?.badge_library_id ?? "").trim();
  const enabled = body?.enabled !== false;
  const points_award = Number(body?.points_award ?? 0);
  const criteria_json = body?.criteria_json ?? null;
  const icon_zoom_raw = Number(body?.icon_zoom ?? 1);
  const icon_zoom = Number.isFinite(icon_zoom_raw) && icon_zoom_raw > 0 ? icon_zoom_raw : 1;

  if (!id) return NextResponse.json({ ok: false, error: "Achievement id is required" }, { status: 400 });
  if (!name) return NextResponse.json({ ok: false, error: "Name is required" }, { status: 400 });

  const payload: any = {
    id,
    name,
    description: description || null,
    category: category || null,
    icon_path: icon_path || null,
    criteria_type: criteria_type || null,
    criteria_json,
    enabled,
    points_award,
    badge_library_id: badge_library_id || null,
    icon_zoom,
  };

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("achievement_badges")
    .upsert(payload, { onConflict: "id" })
    .select("id,name,description,category,icon_path,criteria_type,criteria_json,enabled,points_award,badge_library_id,icon_zoom")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, achievement: data });
}

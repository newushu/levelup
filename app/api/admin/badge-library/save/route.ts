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
  const image_url = String(body?.image_url ?? "").trim();
  const enabled = body?.enabled !== false;

  if (!name) return NextResponse.json({ ok: false, error: "Name is required" }, { status: 400 });

  const payload: any = {
    name,
    description: description || null,
    category: category || null,
    image_url: image_url || null,
    enabled,
  };

  const admin = supabaseAdmin();
  if (id) {
    const { data, error } = await admin
      .from("badge_library")
      .upsert({ id, ...payload }, { onConflict: "id" })
      .select("id,name,description,image_url,enabled,category")
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, badge: data });
  }

  const { data, error } = await admin
    .from("badge_library")
    .insert(payload)
    .select("id,name,description,image_url,enabled,category")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, badge: data });
}

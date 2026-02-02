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

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false, error: "Missing form data" }, { status: 400 });
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "Missing file" }, { status: 400 });

  const safeName = String(file.name || "badge").replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `prestige/${Date.now()}_${safeName}`;

  const admin = supabaseAdmin();
  const { error: upErr } = await admin.storage.from("badges").upload(path, file, {
    upsert: true,
    contentType: file.type || "image/png",
  });
  if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const public_url = base ? `${base}/storage/v1/object/public/badges/${path}` : "";
  const name = safeName.replace(/\.[a-z0-9]+$/i, "");

  const { data: badgeRow, error: bErr } = await admin
    .from("badge_library")
    .insert({
      name,
      description: null,
      image_url: public_url,
      category: "prestige",
      enabled: true,
    })
    .select("id,name,description,image_url,category,enabled")
    .single();

  if (bErr) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, path, public_url, badge: badgeRow });
}

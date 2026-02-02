import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabase/server";

const LOGO_BUCKET = "badges";
const LOGO_PREFIX = "branding";

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

  const safeName = String(file.name || "nav-logo").replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${LOGO_PREFIX}/${Date.now()}_${safeName}`;

  const admin = supabaseAdmin();
  const { error: upErr } = await admin.storage.from(LOGO_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || "image/png",
  });
  if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const public_url = base ? `${base}/storage/v1/object/public/${LOGO_BUCKET}/${path}` : "";

  return NextResponse.json({ ok: true, path, public_url });
}

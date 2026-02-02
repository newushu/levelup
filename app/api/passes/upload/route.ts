import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const PASS_BUCKET = "passes";
const PASS_PREFIX = "images";

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false, error: "Missing form data" }, { status: 400 });
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "Missing file" }, { status: 400 });

  const safeName = String(file.name || "pass-image").replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${PASS_PREFIX}/${Date.now()}_${safeName}`;

  const admin = supabaseAdmin();
  const { error: upErr } = await admin.storage.from(PASS_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || "image/png",
  });
  if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const public_url = base ? `${base}/storage/v1/object/public/${PASS_BUCKET}/${path}` : "";

  return NextResponse.json({ ok: true, path, public_url });
}

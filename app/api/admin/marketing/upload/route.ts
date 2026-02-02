import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const MARKETING_BUCKET = process.env.NEXT_PUBLIC_MARKETING_BUCKET || "marketing";

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ ok: false, error: "Missing form data" }, { status: 400 });

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Missing file upload" }, { status: 400 });
  }

  const rawName = String(file.name || "marketing.png");
  const safeName = rawName.replace(/[^\w.\-]+/g, "_");
  const path = `marketing/${Date.now()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const admin = supabaseAdmin();
  const { error } = await admin.storage.from(MARKETING_BUCKET).upload(path, buffer, {
    upsert: true,
    contentType: file.type || "image/png",
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const { data: signed, error: sErr } = await admin.storage.from(MARKETING_BUCKET).createSignedUrl(path, 3600);
  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, path, signed_url: signed?.signedUrl ?? "" });
}

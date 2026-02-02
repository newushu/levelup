import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const CAMP_BUCKET = process.env.CAMP_MENU_BUCKET || process.env.NEXT_PUBLIC_CAMP_MENU_BUCKET || "camp-menu";
const CAMP_PREFIX = "images";

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false, error: "Missing form data" }, { status: 400 });
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "Missing file" }, { status: 400 });

  const safeName = String(file.name || "camp-image").replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${CAMP_PREFIX}/${Date.now()}_${safeName}`;

  const admin = supabaseAdmin();
  const { data: buckets, error: bErr } = await admin.storage.listBuckets();
  if (bErr) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 });
  const hasBucket = (buckets ?? []).some((b) => String(b.name ?? "") === CAMP_BUCKET);
  if (!hasBucket) {
    const { error: createErr } = await admin.storage.createBucket(CAMP_BUCKET, { public: true });
    if (createErr) {
      return NextResponse.json(
        { ok: false, error: `Bucket not found: ${CAMP_BUCKET}. Create failed: ${createErr.message}` },
        { status: 500 }
      );
    }
  } else {
    await admin.storage.updateBucket(CAMP_BUCKET, { public: true });
  }
  const { error: upErr } = await admin.storage.from(CAMP_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || "image/png",
  });
  if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });

  const public_url = admin.storage.from(CAMP_BUCKET).getPublicUrl(path).data.publicUrl ?? "";

  return NextResponse.json({ ok: true, path, public_url });
}

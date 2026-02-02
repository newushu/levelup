import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const MUSIC_BUCKET = process.env.NEXT_PUBLIC_MUSIC_BUCKET || "music";
const MUSIC_PREFIX = "tracks";

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ ok: false, error: "Missing form data" }, { status: 400 });

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Missing file upload" }, { status: 400 });
  }

  const rawName = String(file.name || "track.mp3");
  const safeName = rawName.replace(/[^\w.\-]+/g, "_");
  const path = `${MUSIC_PREFIX}/${Date.now()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const admin = supabaseAdmin();
  const { data: buckets, error: bErr } = await admin.storage.listBuckets();
  if (bErr) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 });
  const hasBucket = (buckets ?? []).some((b) => String(b.name ?? "") === MUSIC_BUCKET);
  if (!hasBucket) {
    const { error: createErr } = await admin.storage.createBucket(MUSIC_BUCKET, { public: true });
    if (createErr) {
      return NextResponse.json(
        { ok: false, error: `Bucket not found: ${MUSIC_BUCKET}. Create failed: ${createErr.message}` },
        { status: 500 }
      );
    }
  } else {
    await admin.storage.updateBucket(MUSIC_BUCKET, { public: true });
  }

  const { error } = await admin.storage.from(MUSIC_BUCKET).upload(path, buffer, {
    upsert: true,
    contentType: file.type || "audio/mpeg",
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const public_url = admin.storage.from(MUSIC_BUCKET).getPublicUrl(path).data.publicUrl ?? "";
  return NextResponse.json({ ok: true, path, public_url });
}

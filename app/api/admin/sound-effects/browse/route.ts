import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const AUDIO_BUCKET = process.env.NEXT_PUBLIC_AUDIO_BUCKET || "audio";
const SOUND_PREFIX = "sound-effects";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const admin = supabaseAdmin();
  const { data: buckets, error: bErr } = await admin.storage.listBuckets();
  if (bErr) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 });
  const hasBucket = (buckets ?? []).some((b) => String(b.name ?? "") === AUDIO_BUCKET);
  if (!hasBucket) {
    const { error: createErr } = await admin.storage.createBucket(AUDIO_BUCKET, { public: true });
    if (createErr) {
      return NextResponse.json(
        { ok: false, error: `Bucket not found: ${AUDIO_BUCKET}. Create failed: ${createErr.message}` },
        { status: 500 }
      );
    }
  } else {
    await admin.storage.updateBucket(AUDIO_BUCKET, { public: true });
  }

  const { data, error } = await admin.storage.from(AUDIO_BUCKET).list(SOUND_PREFIX, {
    limit: 200,
    sortBy: { column: "name", order: "asc" },
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const items =
    (data ?? [])
      .filter((item) => item.name)
      .map((item) => {
        const path = `${SOUND_PREFIX}/${item.name}`;
        const public_url = admin.storage.from(AUDIO_BUCKET).getPublicUrl(path).data.publicUrl ?? "";
        return { path, public_url };
      });

  return NextResponse.json({ ok: true, items });
}

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const MUSIC_BUCKET = process.env.NEXT_PUBLIC_MUSIC_BUCKET || "music";
const MUSIC_PREFIX = "tracks";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

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

  const { data, error } = await admin.storage.from(MUSIC_BUCKET).list(MUSIC_PREFIX, {
    limit: 200,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const items =
    (data ?? [])
      .filter((item) => item.name)
      .map((item) => {
        const path = `${MUSIC_PREFIX}/${item.name}`;
        const public_url = admin.storage.from(MUSIC_BUCKET).getPublicUrl(path).data.publicUrl ?? "";
        return { path, public_url };
      });

  return NextResponse.json({ ok: true, items });
}

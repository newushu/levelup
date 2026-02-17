import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const GIFT_BUCKET = process.env.GIFT_ASSETS_BUCKET || process.env.NEXT_PUBLIC_GIFT_ASSETS_BUCKET || "gift-assets";

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false, error: "Missing form data" }, { status: 400 });

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "Missing file" }, { status: 400 });

  const scopeRaw = String(form.get("scope") ?? "misc").trim().toLowerCase();
  const scope = ["design", "item", "misc"].includes(scopeRaw) ? scopeRaw : "misc";
  const safeName = String(file.name || "gift-image").replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${scope}/${Date.now()}_${safeName}`;

  const admin = supabaseAdmin();
  const { data: buckets, error: bErr } = await admin.storage.listBuckets();
  if (bErr) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 });
  const hasBucket = (buckets ?? []).some((b) => String(b.name ?? "") === GIFT_BUCKET);
  if (!hasBucket) {
    const { error: createErr } = await admin.storage.createBucket(GIFT_BUCKET, { public: true });
    if (createErr) {
      return NextResponse.json(
        { ok: false, error: `Bucket not found: ${GIFT_BUCKET}. Create failed: ${createErr.message}` },
        { status: 500 }
      );
    }
  } else {
    await admin.storage.updateBucket(GIFT_BUCKET, { public: true });
  }

  const { error: upErr } = await admin.storage.from(GIFT_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || "image/png",
  });
  if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });

  const public_url = admin.storage.from(GIFT_BUCKET).getPublicUrl(path).data.publicUrl ?? "";
  return NextResponse.json({ ok: true, bucket: GIFT_BUCKET, path, public_url });
}

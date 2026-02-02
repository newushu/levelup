import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const AVATAR_BUCKET = process.env.NEXT_PUBLIC_AVATAR_BUCKET || "avatars";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const admin = supabaseAdmin();
  const { data, error } = await admin.storage.from(AVATAR_BUCKET).list("", {
    limit: 200,
    sortBy: { column: "name", order: "asc" },
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const items =
    (data ?? [])
      .filter((item) => item.name)
      .map((item) => {
        const path = item.name;
        const public_url = base
          ? `${base}/storage/v1/object/public/${AVATAR_BUCKET}/${path}`
          : "";
        return { path, public_url };
      });

  return NextResponse.json({ ok: true, items });
}

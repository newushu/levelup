import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const CAMP_BUCKET = process.env.CAMP_MENU_BUCKET || process.env.NEXT_PUBLIC_CAMP_MENU_BUCKET || "camp-menu";
const CAMP_PREFIX = "images";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const admin = supabaseAdmin();
  const { data, error } = await admin.storage.from(CAMP_BUCKET).list(CAMP_PREFIX, { limit: 200 });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const images = (data ?? [])
    .filter((item) => item?.name && !item.name.endsWith("/"))
    .map((item) => {
      const path = `${CAMP_PREFIX}/${item.name}`;
      const url = admin.storage.from(CAMP_BUCKET).getPublicUrl(path).data.publicUrl ?? "";
      return { name: item.name, url };
    })
    .filter((item) => item.url);

  return NextResponse.json({ ok: true, images });
}

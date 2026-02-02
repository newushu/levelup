import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const admin = supabaseAdmin();
  const bucket = process.env.NEXT_PUBLIC_MARKETING_BUCKET || "marketing";
  const { data, error } = await admin
    .from("marketing_announcements")
    .select(
      "id,title,message,image_url,created_at,image_scale,image_x,image_y,image_rotate,border_style,border_color,template_key,template_payload"
    )
    .eq("enabled", true)
    .order("created_at", { ascending: false })
    .limit(6);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const announcements = await Promise.all(
    (data ?? []).map(async (row: any) => {
      const rawUrl = String(row?.image_url ?? "");
      if (!rawUrl) return { ...row, image_url: "" };
      if (rawUrl.startsWith("http")) return row;
      const { data: signed, error: sErr } = await admin.storage.from(bucket).createSignedUrl(rawUrl, 3600);
      if (sErr) return { ...row, image_url: "" };
      return { ...row, image_url: signed?.signedUrl ?? "" };
    })
  );

  return NextResponse.json({ ok: true, announcements });
}

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { ok: false as const, error: "Not logged in" };

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id)
    .eq("role", "admin")
    .limit(1);

  if (error) return { ok: false as const, error: error.message };
  if (!roles || roles.length === 0) return { ok: false as const, error: "Admin access required" };

  return { ok: true as const };
}

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const bucket = process.env.NEXT_PUBLIC_MARKETING_BUCKET || "marketing";
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("marketing_announcements")
    .select(
      "id,title,message,image_url,enabled,created_at,image_scale,image_x,image_y,image_rotate,border_style,border_color,template_key,template_payload"
    )
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const announcements = await Promise.all(
    (data ?? []).map(async (row: any) => {
      const rawUrl = String(row?.image_url ?? "");
      if (!rawUrl) return { ...row, image_preview_url: "" };
      if (rawUrl.startsWith("http")) return { ...row, image_preview_url: rawUrl };
      const { data: signed, error: sErr } = await admin.storage.from(bucket).createSignedUrl(rawUrl, 3600);
      if (sErr) return { ...row, image_preview_url: "" };
      return { ...row, image_preview_url: signed?.signedUrl ?? "" };
    })
  );

  return NextResponse.json({ ok: true, announcements });
}

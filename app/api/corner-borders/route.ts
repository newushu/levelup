import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  let { data, error } = await supabase
    .from("ui_corner_borders")
    .select("id,key,name,image_url,render_mode,z_layer,offset_x,offset_y,offsets_by_context,html,css,js,unlock_level,unlock_points,enabled,limited_event_only,limited_event_name,limited_event_description,updated_at")
    .order("unlock_level", { ascending: true })
    .order("name", { ascending: true });

  if (error && /limited_event_|z_layer/i.test(String(error.message ?? ""))) {
    const fallback = await supabase
      .from("ui_corner_borders")
      .select("id,key,name,image_url,render_mode,offset_x,offset_y,offsets_by_context,html,css,js,unlock_level,unlock_points,enabled,updated_at")
      .order("unlock_level", { ascending: true })
      .order("name", { ascending: true });
    data = (fallback.data ?? []).map((row: any) => ({
      ...row,
      z_layer: "above_avatar",
      limited_event_only: false,
      limited_event_name: "",
      limited_event_description: "",
    }));
    error = fallback.error as any;
  }

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, borders: data ?? [] });
}

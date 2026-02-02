import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const { data, error } = await supabase
    .from("ui_corner_borders")
    .select("id,key,name,image_url,render_mode,offset_x,offset_y,offsets_by_context,html,css,js,unlock_level,unlock_points,enabled,updated_at")
    .order("unlock_level", { ascending: true })
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, borders: data ?? [] });
}

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  let query = supabase.from("ui_sound_effects").select("id,key,label,audio_url,category,volume,enabled,loop").eq("enabled", true);
  if (category) query = query.eq("category", category);
  const { data, error } = await query.order("label", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, effects: data ?? [] });
}

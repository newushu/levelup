import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await supabaseServer();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("badge_library")
    .select("image_url,name,category,enabled")
    .eq("enabled", true)
    .or("category.ilike.%mvp%,name.ilike.%mvp%")
    .order("name", { ascending: true })
    .limit(1);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const first = data?.[0] ?? null;
  return NextResponse.json({ ok: true, badge_url: first?.image_url ?? null });
}

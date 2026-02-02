import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

export async function GET() {
  const supabase = await supabaseServer();

  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const { data, error } = await supabase
    .from("tracker_skills")
    .select("id,name,category,enabled,failure_reasons,base_name,quality,supplement,landing,rotation,combo_key,created_at")
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, skills: data ?? [] });
}

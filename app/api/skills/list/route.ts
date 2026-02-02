import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

export async function GET() {
  const supabase = await supabaseServer();

  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  // IMPORTANT:
  // - We alias sort_order as sort_in_level so frontend can use sort_in_level.
  // - set_id exists in your schema (and skill_set_id too). We'll return set_id.
  const { data, error } = await supabase
    .from("skills")
    .select(
      [
        "id",
        "name",
        "description",
        "category",
        "level",
        "points",
        "enabled",
        "set_id",
        "set_name",
        "sort_in_level:sort_order", // <-- alias
      ].join(",")
    )
    .eq("enabled", true)
    .order("set_name", { ascending: true })
    .order("level", { ascending: true })
    .order("sort_order", { ascending: true }) // <-- REAL column
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, skills: data ?? [] });
}

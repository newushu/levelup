import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const url = new URL(req.url);
  const name = url.searchParams.get("name") || "";

  if (!name) return NextResponse.json({ ok: false, error: "Missing name" }, { status: 400 });

  const { data, error } = await supabase
    .from("students")
    .select("id,name,level,points_total,is_competition_team")
    .ilike("name", name)
    .limit(1);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const student = (data ?? [])[0] ?? null;
  return NextResponse.json({ ok: true, student });
}

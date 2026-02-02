import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  const supabase = supabaseAdmin();
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
        "points_award",
        "enabled",
        "set_id",
        "set_name",
        "sort_order",
      ].join(",")
    )
    .order("set_name", { ascending: true })
    .order("level", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, skills: data ?? [] });
}

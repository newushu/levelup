import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  const supabase = await supabaseServer();
  let { data, error } = await supabase
    .from("challenges")
    .select("id,name,description,category,comp_team_only")
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error && String(error.message || "").includes("comp_team_only")) {
    const retry = await supabase
      .from("challenges")
      .select("id,name,description,category")
      .order("category", { ascending: true })
      .order("name", { ascending: true });
    data = (retry.data ?? []).map((row: any) => ({ ...row, comp_team_only: false }));
    error = retry.error;
  }

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, challenges: data ?? [] });
}

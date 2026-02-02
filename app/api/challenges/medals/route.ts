import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  let { data, error } = await supabase
    .from("challenge_medal_assets")
    .select("tier,badge_library:badge_library_id(image_url)")
    .order("tier", { ascending: true });

  if (error && String(error.message || "").includes("relation")) {
    return NextResponse.json({ ok: true, medals: {} });
  }
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const medals =
    (data ?? []).reduce((acc: Record<string, string | null>, row: any) => {
      acc[String(row.tier)] = row.badge_library?.image_url ?? null;
      return acc;
    }, {}) ?? {};

  return NextResponse.json({ ok: true, medals });
}

import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

export async function GET() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const [{ count: studentCount }, { count: challengeCount }, { count: badgeCount }] = await Promise.all([
    supabase.from("students").select("*", { count: "exact", head: true }),
    supabase.from("challenges").select("*", { count: "exact", head: true }),
    supabase.from("achievement_badges").select("*", { count: "exact", head: true }),
  ]).then((arr) => arr.map((r: any) => ({ count: r.count ?? 0 })));

  return NextResponse.json({
    ok: true,
    studentCount,
    challengeCount,
    badgeCount,
  });
}

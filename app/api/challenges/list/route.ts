import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  const supabase = await supabaseServer();
  let { data, error } = await supabase
    .from("challenges")
    .select("id,name,description,category,comp_team_only,tier,points_awarded,limit_mode,limit_count,limit_window_days,daily_limit_count,enabled")
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error && String(error.message || "").includes("comp_team_only")) {
    const retry = await supabase
      .from("challenges")
      .select("id,name,description,category,tier,points_awarded,limit_mode,limit_count,limit_window_days,daily_limit_count,enabled")
      .order("category", { ascending: true })
      .order("name", { ascending: true });
    data = (retry.data ?? []).map((row: any) => ({ ...row, comp_team_only: false }));
    error = retry.error;
  }
  if (error && String(error.message || "").includes("daily_limit_count")) {
    const retryNoDaily = await supabase
      .from("challenges")
      .select("id,name,description,category,comp_team_only,tier,points_awarded,limit_mode,limit_count,limit_window_days,enabled")
      .order("category", { ascending: true })
      .order("name", { ascending: true });
    data = (retryNoDaily.data ?? []).map((row: any) => ({ ...row, daily_limit_count: null }));
    error = retryNoDaily.error;
  }

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const defaultsMap = new Map<string, number>();
  try {
    const { data: defaults } = await supabase.from("challenge_tier_defaults").select("tier,points");
    (defaults ?? []).forEach((row: any) => {
      const key = String(row.tier ?? "").toLowerCase().trim();
      if (key) defaultsMap.set(key, Number(row.points ?? 0));
    });
  } catch {}

  const enriched = (data ?? []).map((row: any) => {
    const tierKey = String(row.tier ?? "").toLowerCase().trim();
    const fallback = defaultsMap.get(tierKey) ?? 0;
    return {
      ...row,
      points_awarded: row.points_awarded ?? fallback,
    };
  });

  return NextResponse.json({ ok: true, challenges: enriched });
}

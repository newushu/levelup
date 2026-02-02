import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";


export async function GET() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });


  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const startISO = start.toISOString();


  // 1) Total points given today (positive only)
  const { data: ledgerRows, error: lErr } = await supabase
    .from("ledger")
    .select("student_id, points, created_at")
    .gte("created_at", startISO);


  if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });


  let totalPointsGivenToday = 0;
  const byStudent: Record<string, number> = {};


  for (const r of ledgerRows ?? []) {
    const p = Number((r as any).points ?? 0);
    const sid = String((r as any).student_id ?? "");
    if (!sid) continue;
    if (p > 0) {
      totalPointsGivenToday += p;
      byStudent[sid] = (byStudent[sid] ?? 0) + p;
    }
  }


  // 2) Top earner today
  let topStudentId: string | null = null;
  let topPoints = 0;
  for (const sid of Object.keys(byStudent)) {
    if (byStudent[sid] > topPoints) {
      topPoints = byStudent[sid];
      topStudentId = sid;
    }
  }


  let topStudentName: string | null = null;
  if (topStudentId) {
    const { data: s } = await supabase.from("students").select("name").eq("id", topStudentId).maybeSingle();
    topStudentName = (s as any)?.name ?? null;
  }


  // 3) Prizes redeemed today
  // CHANGE this table name if yours differs.
  const { data: red, error: rErr } = await supabase
    .from("reward_redemptions")
    .select("id, created_at")
    .gte("created_at", startISO);


  const prizesRedeemedToday = rErr ? 0 : (red?.length ?? 0);


  return NextResponse.json({
    ok: true,
    stats: {
      total_points_given_today: totalPointsGivenToday,
      prizes_redeemed_today: prizesRedeemedToday,
      top_earner_today: topStudentId ? { student_id: topStudentId, name: topStudentName, points: topPoints } : null,
    },
  });
}

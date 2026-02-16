import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const studentId = String(body?.student_id ?? "");
  if (!studentId) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });

  const weekStart = getWeekStartUTC(new Date()).toISOString();
  const { data, error } = await supabase
    .from("ledger")
    .select("points,created_at,category")
    .eq("student_id", studentId)
    .gte("created_at", weekStart)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const totals = new Map<string, number>();
  (data ?? []).forEach((row: any) => {
    const category = String(row.category ?? "").toLowerCase();
    if (category === "redeem_daily" || category === "avatar_daily") return;
    const date = String(row.created_at ?? "").slice(0, 10);
    if (!date) return;
    const points = Number(row.points ?? 0);
    totals.set(date, (totals.get(date) ?? 0) + points);
  });

  const rows = Array.from(totals.entries())
    .map(([date, points]) => ({ date, points }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return NextResponse.json({ ok: true, rows });
}

function getWeekStartUTC(now: Date) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

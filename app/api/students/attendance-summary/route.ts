import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  if (!student_id) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });

  const { data: checkins, error: cErr } = await supabase
    .from("attendance_checkins")
    .select("id,checked_in_at,class_id,classes(name)")
    .eq("student_id", student_id)
    .order("checked_in_at", { ascending: false })
    .limit(50);
  if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });

  const { data: awards, error: aErr } = await supabase
    .from("class_awards")
    .select("id,award_date,class_id,points_awarded,class_award_types(name)")
    .eq("student_id", student_id)
    .order("award_date", { ascending: false })
    .limit(50);
  if (aErr) return NextResponse.json({ ok: false, error: aErr.message }, { status: 500 });

  const checkinDates = new Map<string, number>();
  (checkins ?? []).forEach((c: any) => {
    const day = String(c.checked_in_at ?? "").slice(0, 10);
    if (!day) return;
    checkinDates.set(day, (checkinDates.get(day) ?? 0) + 1);
  });

  const awardDates = new Map<string, number>();
  (awards ?? []).forEach((a: any) => {
    const day = String(a.award_date ?? "").slice(0, 10);
    if (!day) return;
    awardDates.set(day, (awardDates.get(day) ?? 0) + 1);
  });

  return NextResponse.json({
    ok: true,
    checkins: (checkins ?? []).map((c: any) => ({
      id: c.id,
      checked_in_at: c.checked_in_at,
      class_name: c.classes?.name ?? "Class",
    })),
    checkin_days: Array.from(checkinDates.entries()).map(([date, count]) => ({ date, count })),
    spotlight_days: Array.from(awardDates.entries()).map(([date, count]) => ({ date, count })),
    awards: (awards ?? []).map((a: any) => ({
      id: a.id,
      award_date: a.award_date,
      name: a.class_award_types?.name ?? "Spotlight",
      points_awarded: Number(a.points_awarded ?? 0),
    })),
  });
}

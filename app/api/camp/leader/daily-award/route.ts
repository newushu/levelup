import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export async function POST() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const { data: roles, error: rErr } = await supabase
    .from("user_roles")
    .select("role,student_id")
    .eq("user_id", u.user.id);
  if (rErr) return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 });

  const studentId = String(
    (roles ?? []).find((r) => String(r.role ?? "").toLowerCase() === "student")?.student_id ?? ""
  ).trim();
  if (!studentId) return NextResponse.json({ ok: true, awarded: false });

  const today = todayISO();
  const { data: leader } = await supabase
    .from("camp_leaders")
    .select("id")
    .eq("student_id", studentId)
    .eq("enabled", true)
    .lte("start_date", today)
    .or(`end_date.is.null,end_date.gte.${today}`)
    .maybeSingle();
  if (!leader?.id) return NextResponse.json({ ok: true, awarded: false });

  const { data: existing } = await supabase
    .from("camp_leader_awards")
    .select("id")
    .eq("student_id", studentId)
    .eq("award_date", today)
    .maybeSingle();
  if (existing?.id) return NextResponse.json({ ok: true, awarded: false, already_awarded: true });

  const { data: settings } = await supabase
    .from("camp_settings")
    .select("daily_points")
    .eq("id", "default")
    .maybeSingle();
  const dailyPoints = Number(settings?.daily_points ?? 0);
  if (!dailyPoints) return NextResponse.json({ ok: true, awarded: false });

  const admin = supabaseAdmin();
  const { data: student } = await admin.from("students").select("id,points_total").eq("id", studentId).maybeSingle();
  const balance_points = Number(student?.points_total ?? 0) + dailyPoints;

  const { error: aErr } = await admin.from("students").update({ points_total: balance_points }).eq("id", studentId);
  if (aErr) return NextResponse.json({ ok: false, error: aErr.message }, { status: 500 });

  const { error: lErr } = await admin.from("camp_leader_awards").insert({
    student_id: studentId,
    award_date: today,
  });
  if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, awarded: true, daily_points: dailyPoints, balance_points });
}

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
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
  if (!studentId) return NextResponse.json({ ok: true, active: false });

  const today = todayISO();
  const { data: leader } = await supabase
    .from("camp_leaders")
    .select("id,student_id,start_date,end_date,enabled")
    .eq("student_id", studentId)
    .eq("enabled", true)
    .lte("start_date", today)
    .or(`end_date.is.null,end_date.gte.${today}`)
    .maybeSingle();

  return NextResponse.json({ ok: true, active: !!leader, leader: leader ?? null, student_id: studentId });
}

import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const { query } = await req.json();
  const q = String(query ?? "").trim();
  if (!q) return NextResponse.json({ ok: true, students: [] });

  const { data, error } = await supabase
    .from("students")
    .select("id,name,level,points_total,is_competition_team")
    .ilike("name", `%${q}%`)
    .order("name", { ascending: true })
    .limit(25);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const rows = (data ?? []) as any[];
  const ids = rows.map((r) => r.id);
  if (!ids.length) return NextResponse.json({ ok: true, students: [] });

  const { data: checkins, error: cErr } = await supabase
    .from("attendance_checkins")
    .select("student_id")
    .in("student_id", ids);
  if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });

  const checkinCount: Record<string, number> = {};
  (checkins ?? []).forEach((row: any) => {
    const sid = String(row.student_id ?? "");
    if (!sid) return;
    checkinCount[sid] = (checkinCount[sid] ?? 0) + 1;
  });

  const out = rows.map((r) => ({
    ...r,
    checkin_count: checkinCount[r.id] ?? 0,
  }));

  return NextResponse.json({ ok: true, students: out });
}

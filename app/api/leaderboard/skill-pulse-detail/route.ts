import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  if (!student_id) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("ledger")
    .select("id,points,note,category,created_at")
    .eq("student_id", student_id)
    .gte("created_at", todayStart.toISOString())
    .or("category.eq.skill_pulse,note.ilike.Battle Pulse win%");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const rows = (data ?? []).map((row: any) => ({
    id: row.id,
    points: Number(row.points ?? 0),
    note: String(row.note ?? ""),
    category: String(row.category ?? ""),
    created_at: String(row.created_at ?? ""),
  }));

  return NextResponse.json({ ok: true, rows });
}

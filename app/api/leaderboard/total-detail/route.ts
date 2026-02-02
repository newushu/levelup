import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const studentId = String(body?.student_id ?? "");
  if (!studentId) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });

  const { data: rows, error } = await supabase
    .from("ledger")
    .select("points,note,created_at")
    .eq("student_id", studentId)
    .gt("points", 0)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const normalized = (rows ?? []).map((row: any) => ({
    points: Number(row.points ?? 0),
    note: String(row.note ?? "Points earned"),
    created_at: String(row.created_at ?? ""),
  }));

  return NextResponse.json({ ok: true, rows: normalized });
}

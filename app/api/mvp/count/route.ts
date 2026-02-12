import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  const start_date = String(body?.start_date ?? "").trim();
  const end_date = String(body?.end_date ?? "").trim();
  if (!student_id) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });

  let q = supabase
    .from("battle_mvp_awards")
    .select("*", { count: "exact", head: true })
    .eq("student_id", student_id);
  if (start_date) q = q.gte("created_at", start_date);
  if (end_date) q = q.lte("created_at", end_date);
  const { count, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, count: count ?? 0 });
}

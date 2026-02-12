import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const student_ids = Array.isArray(body?.student_ids) ? body.student_ids.map(String).filter(Boolean) : [];
  if (!student_ids.length) return NextResponse.json({ ok: true, counts: {} });

  const { data, error } = await supabase
    .from("battle_mvp_awards")
    .select("student_id")
    .in("student_id", student_ids);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const counts: Record<string, number> = {};
  student_ids.forEach((id) => {
    counts[id] = 0;
  });
  (data ?? []).forEach((row: any) => {
    const id = String(row.student_id ?? "");
    if (!id) return;
    counts[id] = (counts[id] ?? 0) + 1;
  });

  return NextResponse.json({ ok: true, counts });
}

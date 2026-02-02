import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  const supabase = await supabaseServer();
  const body = await req.json().catch(() => ({}));
  const studentIds = Array.isArray(body?.student_ids) ? body.student_ids.map(String) : [];
  if (!studentIds.length) return NextResponse.json({ ok: true, counts: {} });

  const { data, error } = await supabase
    .from("class_awards")
    .select("student_id,points_awarded")
    .in("student_id", studentIds);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const counts: Record<string, { count: number; points: number }> = {};
  (data ?? []).forEach((row: any) => {
    const id = String(row.student_id);
    const entry = counts[id] ?? { count: 0, points: 0 };
    entry.count += 1;
    entry.points += Number(row.points_awarded ?? 0);
    counts[id] = entry;
  });

  return NextResponse.json({ ok: true, counts });
}

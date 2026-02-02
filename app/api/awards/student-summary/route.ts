import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  const supabase = await supabaseServer();
  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  if (!student_id) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });

  const { data, error } = await supabase
    .from("class_awards")
    .select("award_type_id,points_awarded,class_award_types(name)")
    .eq("student_id", student_id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const { data: awardRows, error: aErr } = await supabase
    .from("class_awards")
    .select("id,points_awarded,award_date,class_id,class_award_types(name)")
    .eq("student_id", student_id)
    .order("award_date", { ascending: false })
    .limit(200);
  if (aErr) return NextResponse.json({ ok: false, error: aErr.message }, { status: 500 });

  const classIds = Array.from(
    new Set((awardRows ?? []).map((row: any) => String(row?.class_id ?? "")).filter(Boolean))
  );
  const classNameById = new Map<string, string>();
  if (classIds.length) {
    const { data: classRows } = await supabase
      .from("classes")
      .select("id,name")
      .in("id", classIds);
    (classRows ?? []).forEach((row: any) => classNameById.set(String(row.id), row.name ?? "Class"));
  }

  const byType = new Map<string, { id: string; name: string; count: number; points: number }>();
  let totalCount = 0;
  let totalPoints = 0;

  (data ?? []).forEach((row: any) => {
    const id = String(row.award_type_id);
    const name = row.class_award_types?.name ?? "Award";
    const entry = byType.get(id) ?? { id, name, count: 0, points: 0 };
    entry.count += 1;
    entry.points += Number(row.points_awarded ?? 0);
    byType.set(id, entry);
    totalCount += 1;
    totalPoints += Number(row.points_awarded ?? 0);
  });

  return NextResponse.json({
    ok: true,
    total_count: totalCount,
    total_points: totalPoints,
    types: Array.from(byType.values()).sort((a, b) => a.name.localeCompare(b.name)),
    awards: (awardRows ?? []).map((row: any) => ({
      id: row.id,
      name: row.class_award_types?.name ?? "Award",
      points_awarded: Number(row.points_awarded ?? 0),
      award_date: row.award_date ?? null,
      created_at: row.award_date ?? null,
      class_name: classNameById.get(String(row.class_id ?? "")) ?? "Class",
    })),
  });
}

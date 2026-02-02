import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const admin = supabaseAdmin();
  const { data: settings, error: sErr } = await admin
    .from("student_avatar_settings")
    .select("student_id,avatar_id");

  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });

  const studentIds = Array.from(
    new Set((settings ?? []).map((s: any) => String(s.student_id ?? "").trim()).filter(Boolean))
  );

  let students: any[] = [];
  if (studentIds.length) {
    const { data, error } = await admin
      .from("students")
      .select("id,name,level")
      .in("id", studentIds);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    students = data ?? [];
  }

  const studentById = new Map(students.map((s: any) => [String(s.id), s]));
  const usage: Record<string, { count: number; students: Array<{ id: string; name: string; level?: number }> }> = {};

  (settings ?? []).forEach((row: any) => {
    const avatarId = String(row.avatar_id ?? "").trim();
    const studentId = String(row.student_id ?? "").trim();
    if (!avatarId || !studentId) return;
    if (!usage[avatarId]) usage[avatarId] = { count: 0, students: [] };
    usage[avatarId].count += 1;
    const student = studentById.get(studentId);
    usage[avatarId].students.push({
      id: studentId,
      name: String(student?.name ?? "Student"),
      level: student?.level ?? null,
    });
  });

  return NextResponse.json({ ok: true, usage });
}

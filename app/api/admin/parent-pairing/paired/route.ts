import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: links, error } = await admin
    .from("parent_students")
    .select(
      "parent_id,student_id,relationship_type,parents(id,auth_user_id,name,email,phone,dob),students(id,name,level,points_total,points_balance,lifetime_points,email,phone,dob)"
    );
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const studentIds = Array.from(
    new Set((links ?? []).map((row: any) => String(row.student_id ?? "")).filter(Boolean))
  );

  const { data: levelRows } = await admin
    .from("avatar_level_thresholds")
    .select("level,min_lifetime_points")
    .order("level", { ascending: true });
  const thresholds = (levelRows ?? [])
    .map((row: any) => ({ level: Number(row.level), min: Number(row.min_lifetime_points ?? 0) }))
    .filter((row: any) => Number.isFinite(row.level))
    .sort((a: any, b: any) => a.level - b.level);

  const { data: settings } = studentIds.length
    ? await admin.from("student_avatar_settings").select("student_id,avatar_id").in("student_id", studentIds)
    : { data: [] };

  const avatarIds = Array.from(
    new Set((settings ?? []).map((s: any) => String(s.avatar_id ?? "").trim()).filter(Boolean))
  );
  const avatarById = new Map<string, { storage_path: string | null; zoom_pct: number }>();
  if (avatarIds.length) {
    const { data: avatars } = await admin
      .from("avatars")
      .select("id,storage_path,zoom_pct")
      .in("id", avatarIds);
    (avatars ?? []).forEach((row: any) => {
      avatarById.set(String(row.id), {
        storage_path: row.storage_path ?? null,
        zoom_pct: Number(row.zoom_pct ?? 100),
      });
    });
  }

  const avatarByStudent = new Map<string, { storage_path: string | null; zoom_pct: number }>();
  (settings ?? []).forEach((row: any) => {
    const studentId = String(row.student_id ?? "");
    const avatarRow = row.avatar_id ? avatarById.get(String(row.avatar_id)) : null;
    if (avatarRow) avatarByStudent.set(studentId, avatarRow);
  });

  const enriched = (links ?? []).map((row: any) => {
    const student = row.students ? { ...row.students } : null;
    if (student && thresholds.length) {
      const points = Number(student.lifetime_points ?? 0);
      let nextLevel = Number(student.level ?? 1);
      thresholds.forEach((lvl) => {
        if (points >= lvl.min) nextLevel = lvl.level;
      });
      student.level = nextLevel;
    }
    if (student) {
      const avatar = avatarByStudent.get(String(student.id));
      student.avatar_storage_path = avatar?.storage_path ?? null;
      student.avatar_zoom_pct = avatar?.zoom_pct ?? 100;
    }

    return {
      parent_id: row.parent_id,
      student_id: row.student_id,
      relationship_type: row.relationship_type ?? "parent",
      parent: row.parents ?? null,
      student,
    };
  });

  return NextResponse.json({ ok: true, links: enriched });
}

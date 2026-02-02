import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: parent, error: pErr } = await admin
    .from("parents")
    .select("id")
    .eq("auth_user_id", gate.user.id)
    .maybeSingle();
  if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });
  if (!parent?.id) return NextResponse.json({ ok: false, error: "Not a parent account" }, { status: 403 });

  const { data: links, error: lErr } = await admin
    .from("parent_students")
    .select("student_id,relationship_type,students(id,name,level,points_total,points_balance,lifetime_points,is_competition_team)")
    .eq("parent_id", parent.id);
  if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });

  const students =
    (links ?? [])
      .map((row: any) => ({ student: row.students, relationship_type: row.relationship_type }))
      .filter((row: any) => row.student)
      .map((row: any) => {
        const s = row.student;
        return {
          id: s.id,
          name: s.name,
          level: s.level,
          points_total: s.points_total,
          points_balance: s.points_balance,
          lifetime_points: s.lifetime_points,
          is_competition_team: s.is_competition_team,
          relationship_type: row.relationship_type ?? "parent",
        };
      }) ?? [];

  const studentIds = students.map((s) => s.id);
  if (!studentIds.length) return NextResponse.json({ ok: true, students: [] });

  const { data: levelRows } = await admin
    .from("avatar_level_thresholds")
    .select("level,min_lifetime_points")
    .order("level", { ascending: true });
  const thresholds = (levelRows ?? [])
    .map((row: any) => ({ level: Number(row.level), min: Number(row.min_lifetime_points ?? 0) }))
    .filter((row: any) => Number.isFinite(row.level))
    .sort((a: any, b: any) => a.level - b.level);

  if (thresholds.length) {
    students.forEach((s) => {
      const points = Number(s.lifetime_points ?? 0);
      let nextLevel = Number(s.level ?? 1);
      thresholds.forEach((lvl) => {
        if (points >= lvl.min) nextLevel = lvl.level;
      });
      s.level = nextLevel;
    });
  }

  const { data: settings, error: sErr } = await admin
    .from("student_avatar_settings")
    .select("student_id,avatar_id")
    .in("student_id", studentIds);
  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });

  const avatarIds = Array.from(
    new Set((settings ?? []).map((s: any) => String(s.avatar_id ?? "").trim()).filter(Boolean))
  );
  const avatarById = new Map<string, { storage_path: string | null; zoom_pct: number }>();
  if (avatarIds.length) {
    const { data: avatars } = await admin
      .from("avatars")
      .select("id,storage_path,zoom_pct")
      .in("id", avatarIds);
    (avatars ?? []).forEach((row: any) =>
      avatarById.set(String(row.id), {
        storage_path: row.storage_path ?? null,
        zoom_pct: Number(row.zoom_pct ?? 100),
      })
    );
  }

  const avatarByStudent = new Map<string, { storage_path: string | null; zoom_pct: number }>();
  (settings ?? []).forEach((row: any) => {
    const studentId = String(row.student_id ?? "");
    const avatarRow = row.avatar_id ? avatarById.get(String(row.avatar_id)) : null;
    if (avatarRow) avatarByStudent.set(studentId, avatarRow);
  });

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const enriched = students.map((s) => {
    const avatar = avatarByStudent.get(String(s.id));
    const path = avatar?.storage_path ?? null;
    const avatar_url = baseUrl && path ? `${baseUrl}/storage/v1/object/public/avatars/${path}` : null;
    return {
      ...s,
      avatar_storage_path: path,
      avatar_zoom_pct: avatar?.zoom_pct ?? 100,
      avatar_url,
    };
  });

  return NextResponse.json({ ok: true, students: enriched });
}

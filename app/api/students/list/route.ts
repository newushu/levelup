import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const { data: roles, error: roleErr } = await supabase
    .from("user_roles")
    .select("role,student_id")
    .eq("user_id", u.user.id);
  if (roleErr) return NextResponse.json({ ok: false, error: roleErr.message }, { status: 500 });

  const roleList = (roles ?? []).map((r) => String(r.role ?? "").toLowerCase());
  const admin = supabaseAdmin();
  const { data: parentRow, error: pErr } = await admin
    .from("parents")
    .select("id")
    .eq("auth_user_id", u.user.id)
    .maybeSingle();
  if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });
  const isParent = roleList.includes("parent") || Boolean(parentRow?.id);
  const effectiveRole = roleList.includes("admin")
    ? "admin"
    : isParent
    ? "parent"
    : roleList.includes("coach")
    ? "coach"
    : roleList.includes("classroom")
    ? "classroom"
    : roleList.includes("student")
    ? "student"
    : "coach";
  const isStudent = effectiveRole === "student";
  const isPrivileged = ["admin", "coach", "classroom"].includes(effectiveRole);
  const studentId = isStudent
    ? String((roles ?? []).find((r) => String(r.role ?? "").toLowerCase() === "student")?.student_id ?? "")
    : "";

  let q = supabase
    .from("students")
    .select(
      [
        "id",
        "name",
        "level",
        "points_total",
        "points_balance",
        "lifetime_points",
        "is_competition_team",
        "first_name",
        "last_name",
        "dob",
        "email",
        "phone",
        "emergency_contact",
        "goals",
        "notes",
        "enrollment_info",
      ].join(",")
    )
    .order("name", { ascending: true });

  if (isStudent && studentId) {
    q = q.eq("id", studentId);
  }

  if (isParent && !isPrivileged) {
    if (!parentRow?.id) return NextResponse.json({ ok: true, students: [] });

    const { data: links, error: lErr } = await admin
      .from("parent_students")
      .select("student_id")
      .eq("parent_id", parentRow.id);
    if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });
    const ids = (links ?? []).map((row: any) => String(row.student_id ?? "")).filter(Boolean);
    if (!ids.length) return NextResponse.json({ ok: true, students: [] });
    q = q.in("id", ids);
  }

  const { data, error } = await q;

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const students = (data ?? []) as Array<{ id: string; level?: number | null; lifetime_points?: number | null }>;
  const ids = students.map((s) => s.id);
  if (!ids.length) return NextResponse.json({ ok: true, students: [] });

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

  const { data: avatarSettings } = await admin
    .from("student_avatar_settings")
    .select("student_id,avatar_id,card_plate_key")
    .in("student_id", ids);

  const avatarIds = Array.from(
    new Set((avatarSettings ?? []).map((row: any) => String(row.avatar_id ?? "").trim()).filter(Boolean))
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

  const plateKeys = Array.from(
    new Set((avatarSettings ?? []).map((row) => String(row.card_plate_key ?? "").trim()).filter(Boolean))
  );
  const plateByKey = new Map<
    string,
    { image_url: string | null; unlock_level: number; unlock_points: number; enabled: boolean }
  >();
  if (plateKeys.length) {
    const { data: plates } = await admin
      .from("ui_card_plate_borders")
      .select("key,image_url,unlock_level,unlock_points,enabled")
      .in("key", plateKeys);
    (plates ?? []).forEach((p: any) => {
      plateByKey.set(String(p.key), {
        image_url: p.image_url ?? null,
        unlock_level: Number(p.unlock_level ?? 1),
        unlock_points: Number(p.unlock_points ?? 0),
        enabled: p.enabled !== false,
      });
    });
  }

  const { data: unlocks } = await admin
    .from("student_custom_unlocks")
    .select("student_id,item_key")
    .eq("item_type", "card_plate")
    .in("student_id", ids);

  const unlocksByStudent = new Map<string, Set<string>>();
  (unlocks ?? []).forEach((row: any) => {
    const sid = String(row.student_id ?? "");
    if (!sid) return;
    if (!unlocksByStudent.has(sid)) unlocksByStudent.set(sid, new Set());
    unlocksByStudent.get(sid)?.add(String(row.item_key ?? ""));
  });

  const cardPlateByStudent = new Map<string, string | null>();
  const avatarByStudent = new Map<string, { storage_path: string | null; zoom_pct: number }>();
  (avatarSettings ?? []).forEach((row: any) => {
    const studentId = String(row.student_id ?? "");
    const key = String(row.card_plate_key ?? "").trim();
    const plate = key ? plateByKey.get(key) : null;
    const level = Number(students.find((s) => s.id === studentId)?.level ?? 1);
    const isUnlockedByLevel = level >= Number(plate?.unlock_level ?? 1);
    const requiresPurchase = Number(plate?.unlock_points ?? 0) > 0;
    const hasPurchase = unlocksByStudent.get(studentId)?.has(key) ?? false;
    const canUse = plate && plate.enabled && isUnlockedByLevel && (!requiresPurchase || hasPurchase);
    cardPlateByStudent.set(studentId, canUse ? plate?.image_url ?? null : null);
    const avatarRow = row.avatar_id ? avatarById.get(String(row.avatar_id)) : null;
    if (avatarRow) avatarByStudent.set(studentId, avatarRow);
  });

  const enriched = (data ?? []).map((row: any) => ({
    ...row,
    card_plate_url: cardPlateByStudent.get(String(row.id ?? "")) ?? null,
    avatar_storage_path: avatarByStudent.get(String(row.id ?? ""))?.storage_path ?? null,
    avatar_zoom_pct: avatarByStudent.get(String(row.id ?? ""))?.zoom_pct ?? 100,
  }));

  return NextResponse.json({ ok: true, students: enriched });
}

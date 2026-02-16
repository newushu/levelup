import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const MAX_LEVEL = 99;

function computeThresholds(baseJump: number, difficultyPct: number) {
  const levels: Array<{ level: number; min_lifetime_points: number }> = [];
  let total = 0;
  for (let level = 1; level <= MAX_LEVEL; level += 1) {
    if (level === 1) {
      levels.push({ level, min_lifetime_points: 0 });
      continue;
    }
    const exponent = level - 1;
    const factor = Math.pow(1 + difficultyPct / 100, exponent);
    total += baseJump * factor;
    const rounded = Math.round(total / 10) * 10;
    levels.push({ level, min_lifetime_points: Math.max(0, Math.floor(rounded)) });
  }
  return levels;
}

function isMissingColumn(err: any, column: string) {
  const msg = String(err?.message ?? "").toLowerCase();
  const key = column.toLowerCase();
  return msg.includes(`column \"${key}\"`) || msg.includes(`.${key}`) || msg.includes(key);
}

export async function POST() {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: roles, error: roleErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", auth.user.id);
  if (roleErr) return NextResponse.json({ ok: false, error: roleErr.message }, { status: 500 });

  const roleList = (roles ?? []).map((r: any) => String(r.role ?? "").toLowerCase());
  if (!roleList.includes("admin")) {
    return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
  }

  let studentsRes = await admin.from("students").select("id,name,lifetime_points,level");
  let hasLevelColumn = true;
  if (studentsRes.error && isMissingColumn(studentsRes.error, "level")) {
    hasLevelColumn = false;
    studentsRes = await admin.from("students").select("id,name,lifetime_points");
  }
  if (studentsRes.error) {
    return NextResponse.json({ ok: false, error: studentsRes.error.message }, { status: 500 });
  }
  const students = (studentsRes.data ?? []) as Array<{ id: string; name?: string | null; lifetime_points?: number | null; level?: number | null }>;

  const [thresholdRowsRes, levelSettingsRes] = await Promise.all([
    admin.from("avatar_level_thresholds").select("level,min_lifetime_points").order("level", { ascending: true }),
    admin.from("avatar_level_settings").select("base_jump,difficulty_pct").limit(1).maybeSingle(),
  ]);
  if (thresholdRowsRes.error) return NextResponse.json({ ok: false, error: thresholdRowsRes.error.message }, { status: 500 });
  if (levelSettingsRes.error) return NextResponse.json({ ok: false, error: levelSettingsRes.error.message }, { status: 500 });

  const thresholdRows = (thresholdRowsRes.data ?? [])
    .map((row: any) => ({ level: Number(row.level), min_lifetime_points: Number(row.min_lifetime_points ?? 0) }))
    .filter((row: any) => Number.isFinite(row.level))
    .sort((a: any, b: any) => a.level - b.level);
  const baseJump = Number(levelSettingsRes.data?.base_jump ?? 50);
  const difficultyPct = Number(levelSettingsRes.data?.difficulty_pct ?? 8);
  const thresholds = thresholdRows.length ? thresholdRows : computeThresholds(baseJump, difficultyPct);

  const computedRows = students.map((s) => {
    const lifetimePoints = Number(s.lifetime_points ?? 0);
    let computedLevel = 1;
    for (const t of thresholds) {
      if (lifetimePoints >= Number(t.min_lifetime_points ?? 0)) computedLevel = Number(t.level);
    }
    const storedLevel = Number(s.level ?? 1);
    return {
      id: String(s.id),
      name: String(s.name ?? "Student"),
      lifetime_points: lifetimePoints,
      stored_level: storedLevel,
      computed_level: Math.max(1, computedLevel),
    };
  });

  const changed = computedRows.filter((row) => row.stored_level !== row.computed_level);

  if (!hasLevelColumn) {
    return NextResponse.json({
      ok: true,
      updated: 0,
      scanned: computedRows.length,
      mismatches: changed.length,
      skipped: "students.level column missing",
      samples: changed.slice(0, 25),
    });
  }

  let updated = 0;
  for (const row of changed) {
    const upd = await admin
      .from("students")
      .update({ level: row.computed_level })
      .eq("id", row.id);
    if (upd.error) {
      return NextResponse.json({ ok: false, error: upd.error.message, failed_student_id: row.id }, { status: 500 });
    }
    updated += 1;
  }

  return NextResponse.json({
    ok: true,
    updated,
    scanned: computedRows.length,
    mismatches_before: changed.length,
    threshold_source: thresholdRows.length ? "avatar_level_thresholds" : "avatar_level_settings_fallback",
  });
}


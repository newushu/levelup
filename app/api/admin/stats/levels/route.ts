import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type LevelRow = { level: number; min_lifetime_points: number };

const MAX_LEVEL = 99;

function computeThresholds(baseJump: number, difficultyPct: number) {
  const levels: LevelRow[] = [];
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

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const admin = supabaseAdmin();
  const [{ data: students, error: sErr }, { data: thresholds, error: tErr }, { data: settings, error: setErr }] =
    await Promise.all([
      admin.from("students").select("id,level,lifetime_points"),
      admin.from("avatar_level_thresholds").select("level,min_lifetime_points").order("level", { ascending: true }),
      admin.from("avatar_level_settings").select("base_jump,difficulty_pct").limit(1).maybeSingle(),
    ]);

  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });
  if (tErr && !String(tErr.message || "").includes("relation")) {
    return NextResponse.json({ ok: false, error: tErr.message }, { status: 500 });
  }
  if (setErr && !String(setErr.message || "").includes("relation")) {
    return NextResponse.json({ ok: false, error: setErr.message }, { status: 500 });
  }

  const baseJump = Number(settings?.base_jump ?? 50);
  const difficultyPct = Number(settings?.difficulty_pct ?? 8);
  const levelRows =
    thresholds && thresholds.length ? (thresholds as LevelRow[]) : computeThresholds(baseJump, difficultyPct);

  const thresholdMap = new Map(levelRows.map((row) => [Number(row.level), Number(row.min_lifetime_points ?? 0)]));
  const sortedLevels = Array.from(thresholdMap.entries()).sort((a, b) => a[0] - b[0]);
  const thresholdMax = sortedLevels.length ? sortedLevels[sortedLevels.length - 1][0] : 1;

  const counts = new Map<number, number>();
  let maxObserved = 1;
  (students ?? []).forEach((row: any) => {
    const lifetimePoints = Number(row?.lifetime_points ?? 0);
    const fallback = Number(row?.level ?? 1);
    if (!sortedLevels.length) {
      counts.set(fallback, (counts.get(fallback) ?? 0) + 1);
      if (fallback > maxObserved) maxObserved = fallback;
      return;
    }
    let level = 1;
    for (const [lvl, min] of sortedLevels) {
      if (lifetimePoints >= Number(min ?? 0)) level = Number(lvl);
    }
    if (level > maxObserved) maxObserved = level;
    counts.set(level, (counts.get(level) ?? 0) + 1);
  });

  const maxLevel = thresholds && thresholds.length ? thresholdMax : maxObserved;
  const levels = Array.from({ length: Math.max(1, maxLevel) }).map((_, idx) => {
    const level = idx + 1;
    return { level, count: counts.get(level) ?? 0 };
  });

  return NextResponse.json({ ok: true, total: (students ?? []).length, levels });
}

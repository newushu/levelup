import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getStudentCriteriaState, matchItemCriteria } from "@/lib/unlockCriteria";

function isMissingColumn(err: any, column: string) {
  const msg = String(err?.message ?? "").toLowerCase();
  const key = column.toLowerCase();
  return msg.includes(`column \"${key}\"`) || msg.includes(`.${key}`) || msg.includes(key);
}

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

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const admin = supabaseAdmin();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  if (!student_id) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });

  const { data: settings, error } = await admin
    .from("student_avatar_settings")
    .select(
      "student_id,avatar_id,bg_color,border_color,glow_color,pattern,particle_style,aura_style,planet_style,corner_border_key,card_plate_key,avatar_set_at,avatar_daily_granted_at,updated_at"
    )
    .eq("student_id", student_id)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const { data: studentRow, error: sErr } = await admin
    .from("students")
    .select("level,lifetime_points")
    .eq("id", student_id)
    .maybeSingle();
  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });

  const [{ data: thresholds }, { data: levelSettings }] = await Promise.all([
    admin.from("avatar_level_thresholds").select("level,min_lifetime_points").order("level", { ascending: true }),
    admin.from("avatar_level_settings").select("base_jump,difficulty_pct").limit(1).maybeSingle(),
  ]);

  const baseJump = Number(levelSettings?.base_jump ?? 50);
  const difficultyPct = Number(levelSettings?.difficulty_pct ?? 8);
  const levelRows: LevelRow[] =
    thresholds && thresholds.length ? (thresholds as LevelRow[]) : computeThresholds(baseJump, difficultyPct);
  const thresholdMap = new Map(levelRows.map((row) => [row.level, row.min_lifetime_points]));
  const sortedLevels = Array.from(thresholdMap.entries()).sort((a, b) => a[0] - b[0]);

  const lifetimePoints = Number(studentRow?.lifetime_points ?? 0);
  let effectiveLevel = Number(studentRow?.level ?? 1);
  if (sortedLevels.length) {
    let lvl = 1;
    for (const [level, min] of sortedLevels) {
      if (lifetimePoints >= Number(min ?? 0)) lvl = Number(level);
    }
    effectiveLevel = Math.max(lvl, 1);
  }

  let avatarQuery = admin
    .from("avatars")
    .select("id,unlock_level,unlock_points,enabled,is_secondary,limited_event_only")
    .order("unlock_level", { ascending: true })
    .order("name", { ascending: true });
  let { data: avatars, error: aErr } = await avatarQuery;
  if (aErr && isMissingColumn(aErr, "limited_event_only")) {
    const fallback = await admin
      .from("avatars")
      .select("id,unlock_level,unlock_points,enabled,is_secondary")
      .order("unlock_level", { ascending: true })
      .order("name", { ascending: true });
    avatars = fallback.data as any;
    aErr = fallback.error as any;
  }
  if (aErr) return NextResponse.json({ ok: false, error: aErr.message }, { status: 500 });

  const enabledAvatars = (avatars ?? []).filter((a: any) => a.enabled !== false);
  const eligible = enabledAvatars.filter((a: any) => Number(a.unlock_level ?? 1) <= effectiveLevel);
  const fallback = eligible.find((a: any) => !a.is_secondary) ?? eligible[0] ?? enabledAvatars[0] ?? null;

  const criteriaState = await getStudentCriteriaState(admin as any, student_id);
  const { data: customUnlocks } = await admin
    .from("student_custom_unlocks")
    .select("item_type,item_key")
    .eq("student_id", student_id);
  const customUnlockSet = new Set((customUnlocks ?? []).map((row: any) => `${String(row.item_type)}:${String(row.item_key)}`));

  const selectedId = String(settings?.avatar_id ?? "").trim();
  const selectedRow = selectedId ? enabledAvatars.find((a: any) => String(a.id) === selectedId) : null;
  const selectedUnlock = Number(selectedRow?.unlock_level ?? 1);
  const selectedPoints = Math.max(0, Number(selectedRow?.unlock_points ?? 0));
  const selectedLimitedOnly = (selectedRow as any)?.limited_event_only === true;
  const selectedCustomUnlock = customUnlockSet.has(`avatar:${selectedId}`);
  const selectedCriteria = matchItemCriteria("avatar", selectedId, criteriaState.fulfilledKeys, criteriaState.requirementMap);
  const selectedCriteriaOk = selectedCriteria.hasRequirements && selectedCriteria.matched;
  const selectedByDefault = !selectedLimitedOnly && selectedUnlock <= effectiveLevel && selectedPoints <= 0;
  const selectedEventAllowed = !selectedLimitedOnly || selectedCriteriaOk;
  const selectedValid =
    !!selectedRow &&
    selectedEventAllowed &&
    (selectedByDefault || selectedCustomUnlock || selectedCriteriaOk);

  let bordersRes = await admin
    .from("ui_corner_borders")
    .select("key,unlock_level,unlock_points,enabled,limited_event_only");
  if (bordersRes.error && isMissingColumn(bordersRes.error, "limited_event_only")) {
    bordersRes = await admin
      .from("ui_corner_borders")
      .select("key,unlock_level,unlock_points,enabled");
  }
  const borders = bordersRes.data;
  const borderByKey = new Map((borders ?? []).map((b: any) => [String(b.key), b]));
  const selectedBorderKey = String(settings?.corner_border_key ?? "").trim();
  const selectedBorder = selectedBorderKey ? borderByKey.get(selectedBorderKey) : null;
  const borderLevelUnlocked = selectedBorder ? Number(selectedBorder.unlock_level ?? 1) <= effectiveLevel : false;
  const borderLimitedOnly = selectedBorder ? (selectedBorder as any).limited_event_only === true : false;
  const borderPoints = Math.max(0, Number((selectedBorder as any)?.unlock_points ?? 0));
  const borderCustomUnlock = customUnlockSet.has(`corner_border:${selectedBorderKey}`);
  const borderCriteria = matchItemCriteria("corner_border", selectedBorderKey, criteriaState.fulfilledKeys, criteriaState.requirementMap);
  const borderCriteriaOk = borderCriteria.hasRequirements && borderCriteria.matched;
  const borderByDefault = !borderLimitedOnly && borderLevelUnlocked && borderPoints <= 0;
  const borderEventAllowed = !borderLimitedOnly || borderCriteriaOk;
  const borderUnlocked = borderEventAllowed && (borderByDefault || borderCustomUnlock || borderCriteriaOk);
  const borderEnabled = selectedBorder ? selectedBorder.enabled !== false : false;
  const borderValid = !!selectedBorder && borderUnlocked && borderEnabled;

  const nextAvatarId = selectedValid ? selectedId : fallback?.id;
  if ((!selectedValid || !borderValid) && nextAvatarId) {
    const { data: updated, error: uErr } = await admin
      .from("student_avatar_settings")
      .upsert(
        {
          student_id,
          avatar_id: nextAvatarId,
          bg_color: settings?.bg_color ?? null,
          border_color: settings?.border_color ?? null,
          glow_color: settings?.glow_color ?? null,
          pattern: settings?.pattern ?? null,
          particle_style: settings?.particle_style ?? null,
          aura_style: settings?.aura_style ?? null,
          planet_style: settings?.planet_style ?? null,
          corner_border_key: borderValid ? selectedBorderKey : null,
          avatar_set_at: new Date().toISOString(),
          avatar_daily_granted_at: null,
        },
        { onConflict: "student_id" }
      )
    .select(
      "student_id,avatar_id,bg_color,border_color,glow_color,pattern,particle_style,aura_style,planet_style,corner_border_key,card_plate_key,avatar_set_at,avatar_daily_granted_at,updated_at"
    )
      .maybeSingle();
    if (uErr) return NextResponse.json({ ok: false, error: uErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, settings: updated ?? null });
  }

  return NextResponse.json({ ok: true, settings: settings ?? null });
}

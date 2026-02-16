import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getStudentCriteriaState, matchItemCriteria } from "@/lib/unlockCriteria";

function isMissingColumn(err: any, column: string) {
  const msg = String(err?.message ?? "").toLowerCase();
  const key = column.toLowerCase();
  return msg.includes(`column \"${key}\"`) || msg.includes(`.${key}`) || msg.includes(key);
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const admin = supabaseAdmin();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  const bg_color = String(body?.bg_color ?? "").trim();
  const particle_style = String(body?.particle_style ?? "").trim();
  const corner_border_key = String(body?.corner_border_key ?? "").trim();
  const card_plate_key = String(body?.card_plate_key ?? "").trim();

  if (!student_id) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });
  if (!bg_color && !particle_style && !corner_border_key && !card_plate_key) {
    return NextResponse.json({ ok: false, error: "Missing bg_color, particle_style, corner_border_key, or card_plate_key" }, { status: 400 });
  }

  const { data: student, error: sErr } = await admin
    .from("students")
    .select("id,level,lifetime_points")
    .eq("id", student_id)
    .maybeSingle();
  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });
  if (!student) return NextResponse.json({ ok: false, error: "Student not found" }, { status: 404 });

  const thresholdsRes = await admin
    .from("avatar_level_thresholds")
    .select("level,min_lifetime_points")
    .order("level", { ascending: true });
  let effectiveLevel = Math.max(1, Number((student as any).level ?? 1));
  if (!thresholdsRes.error && (thresholdsRes.data ?? []).length) {
    const lifetime = Number((student as any).lifetime_points ?? 0);
    for (const row of thresholdsRes.data ?? []) {
      if (lifetime >= Number((row as any).min_lifetime_points ?? 0)) {
        effectiveLevel = Math.max(effectiveLevel, Number((row as any).level ?? effectiveLevel));
      }
    }
  }

  const criteriaState = await getStudentCriteriaState(admin as any, student_id);

  async function canUseItem(itemType: "effect" | "corner_border" | "card_plate", itemKey: string) {
    if (!itemKey || itemKey === "none") return true;
    const table = itemType === "effect" ? "avatar_effects" : itemType === "corner_border" ? "ui_corner_borders" : "ui_card_plate_borders";
    const keyField = itemType === "effect" ? "key" : "key";
    const selectColumns = itemType === "card_plate"
      ? "unlock_level,unlock_points,enabled"
      : "unlock_level,unlock_points,enabled,limited_event_only";
    let itemRes = await admin.from(table).select(selectColumns).eq(keyField, itemKey).maybeSingle();
    if (itemRes.error && isMissingColumn(itemRes.error, "limited_event_only")) {
      itemRes = await admin.from(table).select("unlock_level,unlock_points,enabled").eq(keyField, itemKey).maybeSingle();
    }
    if (itemRes.error) return false;
    const item = itemRes.data as any;
    if (!item || item.enabled === false) return false;
    const unlockLevel = Number(item.unlock_level ?? 1);
    const unlockPoints = Math.max(0, Math.floor(Number(item.unlock_points ?? 0)));
    const limitedEventOnly = item?.limited_event_only === true;
    const levelOk = effectiveLevel >= unlockLevel;
    const unlockedByDefault = !limitedEventOnly && unlockPoints <= 0 && levelOk;
    const custom = await admin
      .from("student_custom_unlocks")
      .select("id")
      .eq("student_id", student_id)
      .eq("item_type", itemType)
      .eq("item_key", itemKey)
      .maybeSingle();
    if (custom.error) return false;
    const criteriaMatch = matchItemCriteria(itemType, itemKey, criteriaState.fulfilledKeys, criteriaState.requirementMap);
    const criteriaEligible = !criteriaMatch.hasRequirements || criteriaMatch.matched;
    if (limitedEventOnly && !criteriaEligible) return false;
    return !!custom.data || unlockedByDefault;
  }

  if (particle_style && particle_style !== "none") {
    const ok = await canUseItem("effect", particle_style);
    if (!ok) return NextResponse.json({ ok: false, error: "Effect is locked for this student" }, { status: 400 });
  }
  if (corner_border_key && corner_border_key !== "none") {
    const ok = await canUseItem("corner_border", corner_border_key);
    if (!ok) return NextResponse.json({ ok: false, error: "Border is locked for this student" }, { status: 400 });
  }
  if (card_plate_key && card_plate_key !== "none") {
    const ok = await canUseItem("card_plate", card_plate_key);
    if (!ok) return NextResponse.json({ ok: false, error: "Card plate is locked for this student" }, { status: 400 });
  }

  const payload: Record<string, any> = {
    student_id,
    updated_at: new Date().toISOString(),
  };
  if (bg_color) payload.bg_color = bg_color;
  if (particle_style) {
    payload.particle_style = particle_style === "none" ? null : particle_style;
  }
  if (corner_border_key) {
    payload.corner_border_key = corner_border_key === "none" ? null : corner_border_key;
  }
  if (card_plate_key) {
    payload.card_plate_key = card_plate_key === "none" ? null : card_plate_key;
  }

  // Upsert style updates
  const up = await supabase
    .from("student_avatar_settings")
    .upsert(
      payload,
      { onConflict: "student_id" }
    )
    .select("student_id, avatar_id, bg_color, border_color, glow_color, pattern, particle_style, aura_style, planet_style, corner_border_key, card_plate_key, updated_at")
    .maybeSingle();

  if (up.error) return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });

  return NextResponse.json({ ok: true, settings: up.data ?? null });
}

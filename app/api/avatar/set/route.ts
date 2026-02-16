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
  const avatar_id = String(body?.avatar_id ?? "").trim();

  if (!student_id) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });
  if (!avatar_id) return NextResponse.json({ ok: false, error: "Missing avatar_id" }, { status: 400 });

  // Validate avatar exists and enabled
  let avQuery = admin
    .from("avatars")
    .select("id,unlock_level,unlock_points,enabled,limited_event_only")
    .eq("id", avatar_id)
    .maybeSingle();
  let { data: av, error: avErr } = await avQuery;
  if (avErr && isMissingColumn(avErr, "limited_event_only")) {
    const fallback = await admin
      .from("avatars")
      .select("id,unlock_level,unlock_points,enabled")
      .eq("id", avatar_id)
      .maybeSingle();
    av = fallback.data as any;
    avErr = fallback.error as any;
  }

  if (avErr) return NextResponse.json({ ok: false, error: avErr.message }, { status: 500 });
  if (!av || av.enabled === false) return NextResponse.json({ ok: false, error: "Avatar not found or disabled" }, { status: 400 });

  const { data: student, error: studentErr } = await admin
    .from("students")
    .select("id,level,lifetime_points")
    .eq("id", student_id)
    .maybeSingle();
  if (studentErr) return NextResponse.json({ ok: false, error: studentErr.message }, { status: 500 });
  if (!student) return NextResponse.json({ ok: false, error: "Student not found" }, { status: 404 });

  const unlockLevel = Number((av as any).unlock_level ?? 1);
  const unlockPoints = Math.max(0, Math.floor(Number((av as any).unlock_points ?? 0)));
  const limitedEventOnly = (av as any)?.limited_event_only === true;

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

  const [customUnlockRes, criteriaState] = await Promise.all([
    admin
      .from("student_custom_unlocks")
      .select("id")
      .eq("student_id", student_id)
      .eq("item_type", "avatar")
      .eq("item_key", avatar_id)
      .maybeSingle(),
    getStudentCriteriaState(admin as any, student_id),
  ]);
  if (customUnlockRes.error) return NextResponse.json({ ok: false, error: customUnlockRes.error.message }, { status: 500 });
  const criteriaMatch = matchItemCriteria("avatar", avatar_id, criteriaState.fulfilledKeys, criteriaState.requirementMap);
  const bypassByCriteria = criteriaMatch.hasRequirements && criteriaMatch.matched;
  const hasCustomUnlock = !!customUnlockRes.data;
  const levelOk = effectiveLevel >= unlockLevel;
  const unlockedByDefault = !limitedEventOnly && unlockPoints <= 0 && levelOk;

  if (limitedEventOnly && !bypassByCriteria) {
    return NextResponse.json({ ok: false, error: "Limited event avatar requires eligibility" }, { status: 400 });
  }

  if (!(bypassByCriteria || hasCustomUnlock || unlockedByDefault)) {
    return NextResponse.json({ ok: false, error: "Avatar is locked for this student" }, { status: 400 });
  }

  // Upsert settings row (avatar_id is the truth)
  const { error } = await supabase
    .from("student_avatar_settings")
    .upsert(
      {
        student_id,
        avatar_id,
        updated_at: new Date().toISOString(),
        avatar_set_at: new Date().toISOString(),
        avatar_daily_granted_at: null,
      },
      { onConflict: "student_id" }
    );

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // Return fresh settings
  const { data: settings, error: sErr } = await supabase
    .from("student_avatar_settings")
    .select(
      "student_id,avatar_id,bg_color,border_color,glow_color,pattern,particle_style,aura_style,planet_style,avatar_set_at,avatar_daily_granted_at,updated_at"
    )
    .eq("student_id", student_id)
    .maybeSingle();

  if (sErr) return NextResponse.json({ ok: true, settings: null }, { status: 200 });
  return NextResponse.json({ ok: true, settings });
}

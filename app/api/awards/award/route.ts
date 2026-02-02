import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseServer } from "@/lib/supabase/server";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  const supabase = await supabaseServer();
  const body = await req.json().catch(() => ({}));
  const class_id = String(body?.class_id ?? "").trim();
  const student_id = String(body?.student_id ?? "").trim();
  const award_type_id = String(body?.award_type_id ?? "").trim();
  const day = String(body?.award_date ?? "").trim() || todayISO();

  if (!class_id || !student_id || !award_type_id) {
    return NextResponse.json({ ok: false, error: "Missing class_id, student_id, or award_type_id" }, { status: 400 });
  }

  const { data: typeRow, error: tErr } = await supabase
    .from("class_award_types")
    .select("id,name,points,enabled")
    .eq("id", award_type_id)
    .maybeSingle();
  if (tErr) return NextResponse.json({ ok: false, error: tErr.message }, { status: 500 });
  if (!typeRow || typeRow.enabled === false) {
    return NextResponse.json({ ok: false, error: "Award type not found or disabled" }, { status: 400 });
  }

  const { data: active, error: sErr } = await supabase
    .from("class_sessions")
    .select("id,ended_at,started_at")
    .eq("class_id", class_id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });
  if (!active?.id) return NextResponse.json({ ok: false, error: "No class session found." }, { status: 400 });
  if (active.ended_at) {
    const lockAt = new Date(active.ended_at).getTime() + 30 * 60 * 1000;
    if (Date.now() > lockAt) {
      return NextResponse.json({ ok: false, error: "Spotlight selections are locked 30 minutes after class ends." }, { status: 400 });
    }
  }

  const { data: existing } = await supabase
    .from("class_awards")
    .select("id")
    .eq("class_id", class_id)
    .eq("award_type_id", award_type_id)
    .eq("student_id", student_id)
    .eq("session_id", active.id)
    .limit(1);
  if (existing?.length) {
    return NextResponse.json({ ok: true, already: true, award_id: existing[0].id });
  }

  const { count, error: countErr } = await supabase
    .from("class_awards")
    .select("id", { count: "exact", head: true })
    .eq("class_id", class_id)
    .eq("award_type_id", award_type_id)
    .eq("session_id", active.id);
  if (countErr) return NextResponse.json({ ok: false, error: countErr.message }, { status: 500 });
  if ((count ?? 0) >= 2) {
    return NextResponse.json({ ok: false, error: "Max 2 students already awarded for this quality." }, { status: 400 });
  }

  const basePoints = Number(typeRow.points ?? 0);
  let adjustedPoints = basePoints;
  let pointsBase: number | null = null;
  let pointsMultiplier: number | null = null;

  const { data: settings } = await supabase
    .from("student_avatar_settings")
    .select("avatar_id")
    .eq("student_id", student_id)
    .maybeSingle();
  const avatarId = String(settings?.avatar_id ?? "").trim();
  if (avatarId) {
    const { data: avatar } = await supabase
      .from("avatars")
      .select("spotlight_multiplier")
      .eq("id", avatarId)
      .maybeSingle();
    const multiplier = Number(avatar?.spotlight_multiplier ?? 1);
    if (Number.isFinite(multiplier) && multiplier !== 1) {
      adjustedPoints = Math.max(0, Math.round(basePoints * multiplier));
      pointsBase = basePoints;
      pointsMultiplier = multiplier;
    }
  }
  const { data: awardRow, error: aErr } = await supabase
    .from("class_awards")
    .insert({
      class_id,
      student_id,
      award_type_id,
      points_awarded: adjustedPoints,
      award_date: day,
      session_id: active.id,
      awarded_by: auth.user.id,
    })
    .select("id")
    .single();

  if (aErr) return NextResponse.json({ ok: false, error: aErr.message }, { status: 500 });

  const note = `Spotlight Stars: ${typeRow.name ?? "Award"}`;
  const { error: lErr } = await supabase.from("ledger").insert({
    student_id,
    points: adjustedPoints,
    points_base: pointsBase,
    points_multiplier: pointsMultiplier,
    note,
    category: "class_award",
    created_by: auth.user.id,
  });
  if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });

  const rpc = await supabase.rpc("recompute_student_points", { p_student_id: student_id });
  if (rpc.error) return NextResponse.json({ ok: false, error: rpc.error.message }, { status: 500 });

  return NextResponse.json({ ok: true, award_id: awardRow?.id ?? null, points_awarded: adjustedPoints });
}

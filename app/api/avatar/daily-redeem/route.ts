import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/authz";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const studentId = String(body?.student_id ?? "").trim();
  if (!studentId) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: settings, error: sErr } = await admin
    .from("student_avatar_settings")
    .select("student_id,avatar_id,avatar_set_at,avatar_daily_granted_at")
    .eq("student_id", studentId)
    .maybeSingle();

  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });
  if (!settings) return NextResponse.json({ ok: false, error: "Avatar settings not found" }, { status: 404 });

  const avatarId = String(settings.avatar_id ?? "").trim();
  if (!avatarId) return NextResponse.json({ ok: false, error: "No avatar selected" }, { status: 400 });

  const { data: avatar, error: aErr } = await admin
    .from("avatars")
    .select("id,name,daily_free_points,enabled")
    .eq("id", avatarId)
    .maybeSingle();

  if (aErr) return NextResponse.json({ ok: false, error: aErr.message }, { status: 500 });
  if (!avatar || avatar.enabled === false) return NextResponse.json({ ok: false, error: "Avatar not eligible" }, { status: 400 });

  const points = Math.max(0, Math.floor(Number(avatar.daily_free_points ?? 0)));
  if (!points) return NextResponse.json({ ok: false, error: "Daily bonus not configured" }, { status: 400 });

  const setAt = settings.avatar_set_at ? new Date(String(settings.avatar_set_at)) : null;
  if (!setAt || Number.isNaN(setAt.getTime())) {
    return NextResponse.json({ ok: false, error: "Avatar start time missing" }, { status: 400 });
  }

  const now = new Date();
  const grantedAt = settings.avatar_daily_granted_at ? new Date(String(settings.avatar_daily_granted_at)) : null;
  const baseAt = grantedAt && !Number.isNaN(grantedAt.getTime()) ? grantedAt : setAt;
  if (now.getTime() - baseAt.getTime() < DAY_MS) {
    return NextResponse.json({ ok: false, error: "Daily bonus not ready" }, { status: 400 });
  }

  const { error: lErr } = await admin.from("ledger").insert({
    student_id: studentId,
    points,
    points_base: points,
    points_multiplier: 1,
    note: `Avatar Aura Daily +${points} (${avatar.name ?? "Avatar"})`,
    category: "avatar_daily",
  });

  if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });

  const { error: uErr } = await admin
    .from("student_avatar_settings")
    .update({ avatar_daily_granted_at: now.toISOString() })
    .eq("student_id", studentId);

  if (uErr) return NextResponse.json({ ok: false, error: uErr.message }, { status: 500 });

  const { error: rpcErr } = await admin.rpc("recompute_student_points", { p_student_id: studentId });
  if (rpcErr) return NextResponse.json({ ok: false, error: rpcErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    points,
    avatar_name: String(avatar.name ?? "Avatar"),
    granted_at: now.toISOString(),
  });
}

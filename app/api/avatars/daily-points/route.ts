import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  const secret = process.env.AVATAR_DAILY_POINTS_SECRET ?? "";
  const header = req.headers.get("x-avatar-daily-secret") ?? "";
  if (!secret || header !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const { data: settings, error } = await admin
    .from("student_avatar_settings")
    .select("student_id,avatar_id,avatar_set_at,avatar_daily_granted_at");

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const avatarIds = Array.from(
    new Set((settings ?? []).map((row: any) => String(row.avatar_id ?? "").trim()).filter(Boolean))
  );
  if (!avatarIds.length) return NextResponse.json({ ok: true, awarded: 0 });

  const { data: avatars, error: aErr } = await admin
    .from("avatars")
    .select("id,name,daily_free_points,enabled")
    .in("id", avatarIds);
  if (aErr) return NextResponse.json({ ok: false, error: aErr.message }, { status: 500 });

  const avatarById = new Map(
    (avatars ?? []).map((row: any) => [
      String(row.id),
      {
        name: String(row.name ?? "Avatar"),
        daily_free_points: Math.max(0, Math.floor(Number(row.daily_free_points ?? 0))),
        enabled: row.enabled !== false,
      },
    ])
  );

  const now = new Date();
  const ledgerRows: Array<{
    student_id: string;
    points: number;
    points_base: number;
    points_multiplier: number;
    note: string;
    category: string;
  }> = [];
  const updates: Array<{ student_id: string; avatar_daily_granted_at: string }> = [];
  const touched = new Set<string>();

  (settings ?? []).forEach((row: any) => {
    const studentId = String(row.student_id ?? "").trim();
    const avatarId = String(row.avatar_id ?? "").trim();
    if (!studentId || !avatarId) return;
    const avatar = avatarById.get(avatarId);
    if (!avatar || !avatar.enabled) return;
    const points = avatar.daily_free_points;
    if (!points) return;
    const setAt = row.avatar_set_at ? new Date(String(row.avatar_set_at)) : null;
    if (!setAt || Number.isNaN(setAt.getTime())) return;
    const elapsed = now.getTime() - setAt.getTime();
    if (elapsed < DAY_MS) return;
    const cycles = Math.floor(elapsed / DAY_MS);
    if (cycles < 1) return;
    const latestEligibleAt = new Date(setAt.getTime() + cycles * DAY_MS);
    const grantedAt = row.avatar_daily_granted_at ? new Date(String(row.avatar_daily_granted_at)) : null;
    if (grantedAt && grantedAt.getTime() >= latestEligibleAt.getTime()) return;

    ledgerRows.push({
      student_id: studentId,
      points,
      points_base: points,
      points_multiplier: 1,
      note: `Avatar Aura Daily +${points} (${avatar.name})`,
      category: "avatar_daily",
    });
    updates.push({ student_id: studentId, avatar_daily_granted_at: latestEligibleAt.toISOString() });
    touched.add(studentId);
  });

  if (!ledgerRows.length) return NextResponse.json({ ok: true, awarded: 0 });

  const { error: lErr } = await admin.from("ledger").insert(ledgerRows);
  if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });

  await Promise.all(
    updates.map((row) =>
      admin.from("student_avatar_settings").update({ avatar_daily_granted_at: row.avatar_daily_granted_at }).eq("student_id", row.student_id)
    )
  );

  await Promise.all(Array.from(touched).map((studentId) => admin.rpc("recompute_student_points", { p_student_id: studentId })));

  return NextResponse.json({ ok: true, awarded: ledgerRows.length });
}

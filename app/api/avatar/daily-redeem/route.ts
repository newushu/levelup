import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/authz";
import { computeDailyRedeemStatus, getLeaderboardBoardMapForDate, getRoleAccess, getSnapshotCycleDateKey } from "@/lib/dailyRedeem";

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const studentId = String(body?.student_id ?? "").trim();
  if (!studentId) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });

  const access = await getRoleAccess(auth.user.id, studentId);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  const admin = supabaseAdmin();
  const snapshotDate = getSnapshotCycleDateKey(new Date());
  const boardRes = await getLeaderboardBoardMapForDate(admin, snapshotDate);
  if (boardRes.ok === false) return NextResponse.json({ ok: false, error: boardRes.error }, { status: 500 });

  const statusRes = await computeDailyRedeemStatus(admin, studentId, boardRes, snapshotDate);
  if (!statusRes.ok) return NextResponse.json({ ok: false, error: statusRes.error }, { status: 500 });
  const status = statusRes.status;
  if (!status.can_redeem) {
    return NextResponse.json(
      {
        ok: false,
        error: status.available_points <= 0 ? "No redeem points available" : "Daily bonus not ready",
        status,
      },
      { status: 400 }
    );
  }

  const now = new Date();
  const points = Math.max(0, Number(status.available_points ?? 0));
  const avatarPoints = Math.max(0, Number(status.avatar_points ?? 0));
  const leaderboardPoints = Math.max(0, Number(status.leaderboard_points ?? 0));
  const campRolePoints = Math.max(0, Number(status.camp_role_points ?? 0));
  const limitedEventDailyPoints = Math.max(0, Number((status as any).limited_event_daily_points ?? 0));
  const regularPoints = Math.max(0, avatarPoints + leaderboardPoints);
  const nowEtDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const ledgerRows: Array<Record<string, any>> = [];
  if (regularPoints > 0) {
    ledgerRows.push({
      student_id: studentId,
      points: regularPoints,
      points_base: avatarPoints,
      points_multiplier: 1,
      note: `Daily Redeem +${regularPoints} (${avatarPoints} avatar + ${leaderboardPoints} leaderboard)`,
      category: "redeem_daily",
    });
  }
  if (campRolePoints > 0) {
    ledgerRows.push({
      student_id: studentId,
      points: campRolePoints,
      points_base: campRolePoints,
      points_multiplier: 1,
      note: `Camp Role Redeem +${campRolePoints} (claim_date=${nowEtDate})`,
      category: "redeem_camp_role",
    });
  }
  if (limitedEventDailyPoints > 0) {
    ledgerRows.push({
      student_id: studentId,
      points: limitedEventDailyPoints,
      points_base: limitedEventDailyPoints,
      points_multiplier: 1,
      note: `Limited Event Daily Redeem +${limitedEventDailyPoints}`,
      category: "redeem_event_daily",
    });
  }
  const { error: lErr } = ledgerRows.length
    ? await admin.from("ledger").insert(ledgerRows)
    : { error: null as any };

  if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });

  if (regularPoints > 0) {
    const { error: avatarErr } = await admin
      .from("student_avatar_settings")
      .upsert(
        {
          student_id: studentId,
          avatar_daily_granted_at: now.toISOString(),
        },
        { onConflict: "student_id" }
      );
    if (avatarErr) return NextResponse.json({ ok: false, error: avatarErr.message }, { status: 500 });

    const { error: gErr } = await admin
      .from("student_leaderboard_bonus_grants")
      .upsert({ student_id: studentId, last_granted_at: now.toISOString() }, { onConflict: "student_id" });
    if (gErr) return NextResponse.json({ ok: false, error: gErr.message }, { status: 500 });
  }

  if (campRolePoints > 0) {
    const claimRes = await admin
      .from("student_camp_role_daily_claims")
      .upsert(
        {
          student_id: studentId,
          claim_date: nowEtDate,
          claimed_at: now.toISOString(),
        },
        { onConflict: "student_id,claim_date" }
      );
    if (claimRes.error && !String(claimRes.error.message ?? "").toLowerCase().includes("relation \"student_camp_role_daily_claims\" does not exist")) {
      return NextResponse.json({ ok: false, error: claimRes.error.message }, { status: 500 });
    }
  }

  const eventKeys = Array.isArray((status as any).claimable_event_keys)
    ? ((status as any).claimable_event_keys as string[]).map((k) => String(k ?? "").trim()).filter(Boolean)
    : [];
  if (eventKeys.length) {
    const todayKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    const claimRows = eventKeys.map((criteria_key) => ({
      student_id: studentId,
      criteria_key,
      claim_date: todayKey,
      claimed_at: now.toISOString(),
    }));
    const claimRes = await admin
      .from("student_event_daily_claims")
      .upsert(claimRows, { onConflict: "student_id,criteria_key,claim_date" });
    if (claimRes.error && !String(claimRes.error.message ?? "").toLowerCase().includes("relation \"student_event_daily_claims\" does not exist")) {
      return NextResponse.json({ ok: false, error: claimRes.error.message }, { status: 500 });
    }
  }

  const { error: rpcErr } = await admin.rpc("recompute_student_points", { p_student_id: studentId });
  if (rpcErr) return NextResponse.json({ ok: false, error: rpcErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    points,
    avatar_name: String(status.avatar_name ?? "Avatar"),
    avatar_points: avatarPoints,
    leaderboard_points: leaderboardPoints,
    camp_role_points: campRolePoints,
    limited_event_daily_points: limitedEventDailyPoints,
    contribution_chips: status.contribution_chips ?? [],
    leaderboard_boards: status.leaderboard_boards ?? [],
    granted_at: now.toISOString(),
  });
}

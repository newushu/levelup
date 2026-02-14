import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { computeDailyRedeemStatus, getLeaderboardBoardMapForDate, getRoleAccess, getSnapshotCycleDateKey } from "@/lib/dailyRedeem";

export async function POST(req: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const studentIds = Array.isArray(body?.student_ids)
      ? body.student_ids.map((id: any) => String(id ?? "").trim()).filter(Boolean)
      : [];

    if (!studentIds.length) return NextResponse.json({ ok: true, statuses: {} });

    const primaryAccess = await getRoleAccess(auth.user.id, studentIds[0]);
    if (!primaryAccess.ok) return NextResponse.json({ ok: false, error: primaryAccess.error }, { status: 403 });
    const privileged = primaryAccess.roles.some((r) => ["admin", "coach", "classroom"].includes(r));
    if (!privileged) return NextResponse.json({ ok: false, error: "Batch status requires admin/coach/classroom" }, { status: 403 });

    const admin = supabaseAdmin();
    const snapshotDate = getSnapshotCycleDateKey(new Date());
    const boardRes = await getLeaderboardBoardMapForDate(admin, snapshotDate);
    if (boardRes.ok === false) return NextResponse.json({ ok: false, error: boardRes.error }, { status: 500 });

    const statuses: Record<string, any> = {};
    for (const studentId of studentIds) {
      const statusRes = await computeDailyRedeemStatus(admin, studentId, boardRes, snapshotDate);
      if (statusRes.ok) statuses[studentId] = statusRes.status;
    }

    return NextResponse.json({ ok: true, statuses });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: String(error?.message ?? "Unexpected error") }, { status: 500 });
  }
}

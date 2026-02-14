import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { computeDailyRedeemStatus, getLeaderboardBoardMapForDate, getRoleAccess, getSnapshotCycleDateKey } from "@/lib/dailyRedeem";

export async function POST(req: Request) {
  try {
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

    return NextResponse.json({ ok: true, ...statusRes });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: String(error?.message ?? "Unexpected error") }, { status: 500 });
  }
}

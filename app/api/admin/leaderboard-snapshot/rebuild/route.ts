import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getEasternDateKey, getLeaderboardBoardMapForDate, getSnapshotCycleDateKey } from "@/lib/dailyRedeem";

export async function POST() {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: roles, error: roleErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", auth.user.id);
  if (roleErr) return NextResponse.json({ ok: false, error: roleErr.message }, { status: 500 });

  const roleList = (roles ?? []).map((r: any) => String(r.role ?? "").toLowerCase());
  if (!roleList.includes("admin")) {
    return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
  }

  const now = new Date();
  const snapshotDate = getSnapshotCycleDateKey(now);
  const easternDate = getEasternDateKey(now);
  const tableName = "leaderboard_bonus_daily_snapshots";
  const datesToRebuild = Array.from(new Set([snapshotDate, easternDate]));

  for (const dateKey of datesToRebuild) {
    const delRes = await admin
      .from(tableName)
      .delete()
      .eq("snapshot_date", dateKey);
    if (delRes.error) return NextResponse.json({ ok: false, error: delRes.error.message }, { status: 500 });
  }

  let rows = 0;
  for (const dateKey of datesToRebuild) {
    const rebuilt = await getLeaderboardBoardMapForDate(admin, dateKey);
    if (rebuilt.ok === false) return NextResponse.json({ ok: false, error: rebuilt.error }, { status: 500 });
    rebuilt.boardMap.forEach((boards) => {
      rows += boards.length;
    });
  }

  return NextResponse.json({ ok: true, snapshot_dates: datesToRebuild, rows });
}

import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

type TrackerRow = {
  id: string;
  repetitions_target: number;
  created_at: string;
};
type BattleRow = {
  id: string;
  left_student_id: string;
  right_student_id: string;
  repetitions_target: number;
  created_at: string;
};

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const clearCompleted = !!body?.clear_completed;
  const clearOld = !!body?.clear_old;
  const clearAll = !!body?.clear_all;

  if (!clearCompleted && !clearOld && !clearAll) {
    return NextResponse.json({ ok: false, error: "No clear option selected." }, { status: 400 });
  }

  const nowIso = new Date().toISOString();

  if (clearAll) {
    const { error } = await supabase.from("skill_trackers").update({ archived_at: nowIso }).is("archived_at", null);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    const { error: bErr } = await supabase.from("battle_trackers").update({ archived_at: nowIso }).is("archived_at", null);
    if (bErr) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, cleared: "all" });
  }

  if (clearOld) {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from("skill_trackers")
      .update({ archived_at: nowIso })
      .is("archived_at", null)
      .lte("created_at", cutoff);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const { error: bErr } = await supabase
      .from("battle_trackers")
      .update({ archived_at: nowIso })
      .is("archived_at", null)
      .lte("created_at", cutoff);
    if (bErr) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 });
  }

  if (clearCompleted) {
    const { data: trackers, error: tErr } = await supabase
      .from("skill_trackers")
      .select("id,repetitions_target,created_at")
      .is("archived_at", null);
    if (tErr) return NextResponse.json({ ok: false, error: tErr.message }, { status: 500 });

    const rows = (trackers ?? []) as TrackerRow[];
    const ids = rows.map((r) => r.id);
    if (ids.length) {
      const { data: logs, error: lErr } = await supabase
        .from("skill_tracker_logs")
        .select("tracker_id")
        .in("tracker_id", ids);
      if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });

      const attemptMap = new Map<string, number>();
      for (const row of logs ?? []) {
        const tid = String((row as any)?.tracker_id ?? "");
        if (!tid) continue;
        attemptMap.set(tid, (attemptMap.get(tid) ?? 0) + 1);
      }

      const completedIds = rows
        .filter((r) => (attemptMap.get(r.id) ?? 0) >= Number(r.repetitions_target ?? 0))
        .map((r) => r.id);

      if (completedIds.length) {
        const { error: cErr } = await supabase.from("skill_trackers").update({ archived_at: nowIso }).in("id", completedIds);
        if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });
      }
    }

    const { data: battles, error: bErr } = await supabase
      .from("battle_trackers")
      .select("id,left_student_id,right_student_id,repetitions_target,created_at")
      .is("archived_at", null);
    if (bErr) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 });

    const battleRows = (battles ?? []) as BattleRow[];
    const battleIds = battleRows.map((b) => b.id);
    if (battleIds.length) {
      const { data: bLogs, error: blErr } = await supabase
        .from("battle_tracker_logs")
        .select("battle_id,student_id")
        .in("battle_id", battleIds);
      if (blErr) return NextResponse.json({ ok: false, error: blErr.message }, { status: 500 });

      const attemptMap = new Map<string, { left: number; right: number }>();
      for (const row of bLogs ?? []) {
        const bid = String((row as any)?.battle_id ?? "");
        const sid = String((row as any)?.student_id ?? "");
        if (!bid || !sid) continue;
        const battle = battleRows.find((b) => b.id === bid);
        if (!battle) continue;
        const prev = attemptMap.get(bid) ?? { left: 0, right: 0 };
        if (sid === battle.left_student_id) prev.left += 1;
        if (sid === battle.right_student_id) prev.right += 1;
        attemptMap.set(bid, prev);
      }

      const completedBattleIds = battleRows
        .filter((b) => {
          const counts = attemptMap.get(b.id) ?? { left: 0, right: 0 };
          return counts.left >= Number(b.repetitions_target ?? 0) && counts.right >= Number(b.repetitions_target ?? 0);
        })
        .map((b) => b.id);

      if (completedBattleIds.length) {
        const { error: cErr } = await supabase.from("battle_trackers").update({ archived_at: nowIso }).in("id", completedBattleIds);
        if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ ok: true });
}

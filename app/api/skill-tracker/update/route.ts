import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const tracker_id = String(body?.tracker_id ?? "").trim();
  const skill_id = String(body?.skill_id ?? "").trim();
  const repetitions_target = Math.max(1, Math.min(20, Number(body?.repetitions_target ?? 1)));

  if (!tracker_id || !skill_id) {
    return NextResponse.json({ ok: false, error: "Missing tracker_id/skill_id" }, { status: 400 });
  }

  const { data: prev, error: prevErr } = await supabase
    .from("skill_trackers")
    .select("id,student_id,repetitions_target")
    .eq("id", tracker_id)
    .single();
  if (prevErr) return NextResponse.json({ ok: false, error: prevErr.message }, { status: 500 });

  const { data, error } = await supabase
    .from("skill_trackers")
    .update({ skill_id, repetitions_target })
    .eq("id", tracker_id)
    .select("id,student_id,skill_id,repetitions_target,created_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const prevTarget = Number(prev?.repetitions_target ?? 0);
  if (prevTarget && repetitions_target > prevTarget) {
    const { data: ledgerRows, error: lErr } = await supabase
      .from("ledger")
      .select("id")
      .eq("source_type", "skill_tracker")
      .eq("source_id", tracker_id);
    if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });
    if (ledgerRows && ledgerRows.length) {
      const { error: dErr } = await supabase
        .from("ledger")
        .delete()
        .eq("source_type", "skill_tracker")
        .eq("source_id", tracker_id);
      if (dErr) return NextResponse.json({ ok: false, error: dErr.message }, { status: 500 });
      const rpc = await supabase.rpc("recompute_student_points", { p_student_id: prev?.student_id ?? null });
      if (rpc.error) return NextResponse.json({ ok: false, error: rpc.error.message }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true, tracker: data });
}

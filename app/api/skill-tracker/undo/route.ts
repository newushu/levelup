import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const tracker_id = String(body?.tracker_id ?? "").trim();

  if (!tracker_id) return NextResponse.json({ ok: false, error: "Missing tracker_id" }, { status: 400 });

  const { data: tracker, error: tErr } = await supabase
    .from("skill_trackers")
    .select("id,student_id,skill_id,repetitions_target,points_per_rep")
    .eq("id", tracker_id)
    .single();
  if (tErr) return NextResponse.json({ ok: false, error: tErr.message }, { status: 500 });

  const { data: logs, error } = await supabase
    .from("skill_tracker_logs")
    .select("id,success,created_at")
    .eq("tracker_id", tracker_id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const latest = (logs ?? [])[0];
  if (!latest?.id) return NextResponse.json({ ok: true, removed: false });

  const attempts = (logs ?? []).length;
  const successes = (logs ?? []).filter((l: any) => l.success).length;
  const target = Number(tracker?.repetitions_target ?? 0);
  const wasComplete = target > 0 && attempts === target;
  const wasPerfect = wasComplete && successes === target;

  const { error: dErr } = await supabase.from("skill_tracker_logs").delete().eq("id", latest.id);
  if (dErr) return NextResponse.json({ ok: false, error: dErr.message }, { status: 500 });

  let points = 0;
  if (wasComplete) {
    const perRep = tracker?.points_per_rep;
    if (perRep !== null && perRep !== undefined) {
      const base = Math.max(0, Math.floor(Number(perRep) || 0));
      const perfectBonus = successes === target ? successes : 0;
      points = successes * base + perfectBonus;
    } else {
      const perSuccess = wasPerfect ? 3 : 2;
      points = successes * perSuccess;
    }
  }

  if (points > 0) {
    let skillName = tracker?.skill_id ?? "Skill";
    const { data: sData } = await supabase
      .from("tracker_skills")
      .select("name")
      .eq("id", tracker?.skill_id ?? "")
      .maybeSingle();
    if (sData?.name) skillName = sData.name;

    const ins = await supabase.from("ledger").insert({
      student_id: tracker?.student_id,
      points: -Math.abs(points),
      note: `Undo Skill Pulse Complete: ${skillName}`,
      category: "skill_pulse_complete_undo",
      source_type: "skill_tracker",
      source_id: tracker_id,
      created_by: u.user.id,
    });
    if (ins.error) return NextResponse.json({ ok: false, error: ins.error.message }, { status: 500 });

    const rpc = await supabase.rpc("recompute_student_points", { p_student_id: tracker?.student_id });
    if (rpc.error) return NextResponse.json({ ok: false, error: rpc.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, removed: true });
}

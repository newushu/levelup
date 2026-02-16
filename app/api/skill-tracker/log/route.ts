import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";
import { getStudentModifierStack } from "@/lib/modifierStack";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const { data: roles, error: roleErr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id);
  if (roleErr) return NextResponse.json({ ok: false, error: roleErr.message }, { status: 500 });
  const roleList = (roles ?? []).map((r: any) => String(r.role ?? "").toLowerCase());
  const isSkillUser = roleList.includes("skill_user") || roleList.includes("skill_pulse");

  const body = await req.json().catch(() => ({}));
  const tracker_id = String(body?.tracker_id ?? "").trim();
  const success = Boolean(body?.success);

  if (!tracker_id) return NextResponse.json({ ok: false, error: "Missing tracker_id" }, { status: 400 });

  const { data: tracker, error: tErr } = await supabase
    .from("skill_trackers")
    .select("id,student_id,skill_id,repetitions_target,points_per_rep")
    .eq("id", tracker_id)
    .single();
  if (tErr) return NextResponse.json({ ok: false, error: tErr.message }, { status: 500 });

  const { count, error: cErr } = await supabase
    .from("skill_tracker_logs")
    .select("id", { count: "exact", head: true })
    .eq("tracker_id", tracker_id);
  if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });

  const existingAttempts = Number(count ?? 0);
  if (existingAttempts >= Number(tracker?.repetitions_target ?? 0)) {
    return NextResponse.json({ ok: true, ignored: true, points_awarded: 0 });
  }

  const { error } = await supabase.from("skill_tracker_logs").insert({
    tracker_id,
    success,
    created_by: u.user.id,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  let pointsAwarded = 0;
  let note = "Skill Pulse Complete";
  let limitReached = false;

  if (isSkillUser) {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: trackerRows, error: trErr } = await supabase
      .from("skill_trackers")
      .select("id")
      .eq("student_id", tracker?.student_id ?? "");
    if (trErr) return NextResponse.json({ ok: false, error: trErr.message }, { status: 500 });
    const trackerIds = (trackerRows ?? []).map((row: any) => String(row.id)).filter(Boolean);
    let skillCount = 0;
    let battleCount = 0;
    if (trackerIds.length) {
      const { count, error: scErr } = await supabase
        .from("skill_tracker_logs")
        .select("id", { count: "exact", head: true })
        .in("tracker_id", trackerIds)
        .eq("created_by", u.user.id)
        .gte("created_at", cutoff);
      if (scErr) return NextResponse.json({ ok: false, error: scErr.message }, { status: 500 });
      skillCount = Number(count ?? 0);
    }
    const { count: bCount, error: bcErr } = await supabase
      .from("battle_tracker_logs")
      .select("id", { count: "exact", head: true })
      .eq("student_id", tracker?.student_id ?? "")
      .eq("created_by", u.user.id)
      .gte("created_at", cutoff);
    if (bcErr) return NextResponse.json({ ok: false, error: bcErr.message }, { status: 500 });
    battleCount = Number(bCount ?? 0);
    limitReached = skillCount + battleCount > 20;
  }

  const { data: logs, error: lErr } = await supabase
    .from("skill_tracker_logs")
    .select("success")
    .eq("tracker_id", tracker_id);
  if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });

  const attempts = (logs ?? []).length;
  const successes = (logs ?? []).filter((l: any) => l.success).length;
  const target = Number(tracker?.repetitions_target ?? 0);

  if (target > 0 && attempts === target) {
    const perRep = tracker?.points_per_rep;
    if (perRep !== null && perRep !== undefined) {
      const base = Math.max(0, Math.floor(Number(perRep) || 0));
      const perfectBonus = successes === target ? successes : 0;
      pointsAwarded = successes * base + perfectBonus;
    } else {
      const perSuccess = successes === target ? 3 : 2;
      pointsAwarded = successes * perSuccess;
      if (successes === target) note = "Skill Pulse Perfect";
    }
  }

  let pointsBase: number | null = null;
  let pointsMultiplier: number | null = null;

  if (limitReached) {
    pointsAwarded = 0;
  }

  if (pointsAwarded > 0) {
    const { data: prior } = await supabase
      .from("ledger")
      .select("id")
      .eq("source_type", "skill_tracker")
      .eq("source_id", tracker_id)
      .limit(1);
    if (prior?.length) {
      return NextResponse.json({ ok: true, points_awarded: 0 });
    }

    let skillName = tracker?.skill_id ?? "Skill";
    const { data: sData } = await supabase
      .from("tracker_skills")
      .select("name")
      .eq("id", tracker?.skill_id ?? "")
      .maybeSingle();
    if (sData?.name) skillName = sData.name;

    const stack = await getStudentModifierStack(String(tracker?.student_id ?? ""));
    const multiplier = Number(stack.skill_pulse_multiplier ?? 1);
    if (Number.isFinite(multiplier) && multiplier !== 1) {
      pointsBase = pointsAwarded;
      pointsMultiplier = multiplier;
      pointsAwarded = Math.max(0, Math.round(pointsAwarded * multiplier));
    }

    const ins = await supabase.from("ledger").insert({
      student_id: tracker?.student_id,
      points: pointsAwarded,
      points_base: pointsBase,
      points_multiplier: pointsMultiplier,
      note: `${note}: ${skillName}`,
      category: "skill_pulse",
      source_type: "skill_tracker",
      source_id: tracker_id,
      created_by: u.user.id,
    });
    if (ins.error) return NextResponse.json({ ok: false, error: ins.error.message }, { status: 500 });

    const rpc = await supabase.rpc("recompute_student_points", { p_student_id: tracker?.student_id });
    if (rpc.error) return NextResponse.json({ ok: false, error: rpc.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, points_awarded: pointsAwarded });
}

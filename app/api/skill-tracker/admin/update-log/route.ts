import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";

async function hashPin(pin: string) {
  const data = new TextEncoder().encode(pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

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
  const isAdmin = roleList.includes("admin");
  const isCoach = roleList.includes("coach");

  const body = await req.json().catch(() => ({}));
  const tracker_id = String(body?.tracker_id ?? "").trim();
  const log_id = String(body?.log_id ?? "").trim();
  const action = String(body?.action ?? "").trim();
  const success = body?.success;
  const pin = String(body?.pin ?? "").trim();

  if (!tracker_id || !log_id || !action) {
    return NextResponse.json({ ok: false, error: "Missing tracker/log/action" }, { status: 400 });
  }

  const { data: tracker, error: tErr } = await supabase
    .from("skill_trackers")
    .select("id,student_id,skill_id,repetitions_target,points_per_rep,created_by")
    .eq("id", tracker_id)
    .single();
  if (tErr) return NextResponse.json({ ok: false, error: tErr.message }, { status: 500 });

  const creatorId = String(tracker?.created_by ?? "");
  let creatorIsSkillUser = false;
  if (creatorId) {
    const { data: creatorRoles, error: crErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", creatorId);
    if (crErr) return NextResponse.json({ ok: false, error: crErr.message }, { status: 500 });
    const creatorRoleList = (creatorRoles ?? []).map((r: any) => String(r.role ?? "").toLowerCase());
    creatorIsSkillUser = creatorRoleList.includes("skill_user") || creatorRoleList.includes("skill_pulse");
  }

  const allowQuickEdit = creatorIsSkillUser && (isAdmin || isCoach);
  if (!allowQuickEdit && !isAdmin) {
    return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
  }

  if (!allowQuickEdit) {
    if (!pin) return NextResponse.json({ ok: false, error: "PIN required" }, { status: 400 });
    const { data: settings, error: sErr } = await supabase
      .from("skill_tracker_settings")
      .select("admin_pin_hash")
      .eq("id", "default")
      .maybeSingle();
    if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });
    if (!settings?.admin_pin_hash) return NextResponse.json({ ok: false, error: "Admin PIN not set" }, { status: 400 });

    const pinHash = await hashPin(pin);
    if (pinHash !== settings.admin_pin_hash) {
      return NextResponse.json({ ok: false, error: "Invalid PIN" }, { status: 403 });
    }
  }

  const { data: beforeLogs, error: bErr } = await supabase
    .from("skill_tracker_logs")
    .select("id,success")
    .eq("tracker_id", tracker_id);
  if (bErr) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 });

  const beforeAttempts = (beforeLogs ?? []).length;
  const beforeSuccesses = (beforeLogs ?? []).filter((l: any) => l.success).length;
  const target = Number(tracker?.repetitions_target ?? 0);
  const beforeComplete = target > 0 && beforeAttempts >= target;
  const beforePerfect = beforeComplete && beforeSuccesses === target;
  const beforePoints = (() => {
    const perRep = tracker?.points_per_rep;
    if (perRep !== null && perRep !== undefined) {
      const base = Math.max(0, Math.floor(Number(perRep) || 0));
      const perfectBonus = beforeSuccesses === target ? beforeSuccesses : 0;
      return beforeComplete ? beforeSuccesses * base + perfectBonus : 0;
    }
    return beforeComplete ? beforeSuccesses * (beforePerfect ? 3 : 2) : 0;
  })();

  if (action === "delete") {
    const { error: dErr } = await supabase.from("skill_tracker_logs").delete().eq("id", log_id);
    if (dErr) return NextResponse.json({ ok: false, error: dErr.message }, { status: 500 });
  } else if (action === "toggle") {
    if (typeof success !== "boolean") {
      return NextResponse.json({ ok: false, error: "Missing success value" }, { status: 400 });
    }
    const { error: uErr } = await supabase.from("skill_tracker_logs").update({ success }).eq("id", log_id);
    if (uErr) return NextResponse.json({ ok: false, error: uErr.message }, { status: 500 });
  } else {
    return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
  }

  const { data: afterLogs, error: aErr } = await supabase
    .from("skill_tracker_logs")
    .select("id,success")
    .eq("tracker_id", tracker_id);
  if (aErr) return NextResponse.json({ ok: false, error: aErr.message }, { status: 500 });

  const afterAttempts = (afterLogs ?? []).length;
  const afterSuccesses = (afterLogs ?? []).filter((l: any) => l.success).length;
  const afterComplete = target > 0 && afterAttempts >= target;
  const afterPerfect = afterComplete && afterSuccesses === target;
  const afterPoints = (() => {
    const perRep = tracker?.points_per_rep;
    if (perRep !== null && perRep !== undefined) {
      const base = Math.max(0, Math.floor(Number(perRep) || 0));
      const perfectBonus = afterSuccesses === target ? afterSuccesses : 0;
      return afterComplete ? afterSuccesses * base + perfectBonus : 0;
    }
    return afterComplete ? afterSuccesses * (afterPerfect ? 3 : 2) : 0;
  })();

  const diff = afterPoints - beforePoints;
  if (diff !== 0) {
    let skillName = tracker?.skill_id ?? "Skill";
    const { data: sData } = await supabase
      .from("tracker_skills")
      .select("name")
      .eq("id", tracker?.skill_id ?? "")
      .maybeSingle();
    if (sData?.name) skillName = sData.name;

    const note = diff > 0 ? `Admin Skill Pulse Adjust +${diff}: ${skillName}` : `Admin Skill Pulse Adjust ${diff}: ${skillName}`;
    const ins = await supabase.from("ledger").insert({
      student_id: tracker?.student_id,
      points: diff,
      note,
      category: "skill_pulse_admin_adjust",
      source_type: "skill_tracker",
      source_id: tracker_id,
      created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    });
    if (ins.error) return NextResponse.json({ ok: false, error: ins.error.message }, { status: 500 });

    const rpc = await supabase.rpc("recompute_student_points", { p_student_id: tracker?.student_id });
    if (rpc.error) return NextResponse.json({ ok: false, error: rpc.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, diff });
}

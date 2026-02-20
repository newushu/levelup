import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { skillSprintPrizeNow } from "@/lib/skillSprintMath";

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const assignmentId = String(body?.assignment_id ?? "").trim();
  if (!assignmentId) return NextResponse.json({ ok: false, error: "Missing assignment_id" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: row, error: getErr } = await admin
    .from("student_skill_countdowns")
    .select("id,student_id,source_label,reward_points,assigned_at,due_at,completed_at,enabled")
    .eq("id", assignmentId)
    .maybeSingle();

  if (getErr) return NextResponse.json({ ok: false, error: getErr.message }, { status: 500 });
  if (!row) return NextResponse.json({ ok: false, error: "Assignment not found" }, { status: 404 });
  if (row.enabled === false) return NextResponse.json({ ok: false, error: "Assignment disabled" }, { status: 400 });
  if (row.completed_at) return NextResponse.json({ ok: true, already_completed: true });

  const rewardPoints = Math.max(
    0,
    Number(skillSprintPrizeNow(Number(row.reward_points ?? 0), String(row.assigned_at ?? ""), String(row.due_at ?? ""), Date.now()) ?? 0)
  );
  const completedAt = new Date().toISOString();

  const { error: upErr } = await admin
    .from("student_skill_countdowns")
    .update({ completed_at: completedAt, completed_by: auth.user.id })
    .eq("id", assignmentId)
    .is("completed_at", null);
  if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });

  if (rewardPoints > 0) {
    const { error: lErr } = await admin.from("ledger").insert({
      student_id: String(row.student_id),
      points: rewardPoints,
      note: `Skill Sprint complete: ${String(row.source_label ?? "Skill")}`,
      category: "skill_sprint_complete",
      created_by: auth.user.id,
    });
    if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });

    const { error: rpcErr } = await admin.rpc("recompute_student_points", { p_student_id: String(row.student_id) });
    if (rpcErr) return NextResponse.json({ ok: false, error: rpcErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, reward_points: rewardPoints, completed_at: completedAt });
}

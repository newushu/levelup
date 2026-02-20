import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const studentId = String(body?.student_id ?? "").trim();
  const sourceType = String(body?.source_type ?? "manual").trim().toLowerCase();
  const sourceKey = String(body?.source_key ?? "").trim() || null;
  const sourceLabel = String(body?.source_label ?? "").trim();
  const dueAtRaw = String(body?.due_at ?? "").trim();
  const dueAtMs = Date.parse(dueAtRaw);
  const penaltyPerDay = Math.max(0, Math.floor(Number(body?.penalty_points_per_day ?? 5)));
  const rewardPoints = Math.max(0, Math.floor(Number(body?.reward_points ?? 10)));
  const note = String(body?.note ?? "").trim() || null;

  if (!studentId) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });
  if (!sourceLabel) return NextResponse.json({ ok: false, error: "Missing source_label" }, { status: 400 });
  if (!Number.isFinite(dueAtMs)) return NextResponse.json({ ok: false, error: "Invalid due_at" }, { status: 400 });
  if (!["skill_tree", "skill_pulse", "manual"].includes(sourceType)) {
    return NextResponse.json({ ok: false, error: "Invalid source_type" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: studentRow, error: studentErr } = await admin
    .from("students")
    .select("points_total,points_balance")
    .eq("id", studentId)
    .maybeSingle();
  if (studentErr) return NextResponse.json({ ok: false, error: studentErr.message }, { status: 500 });
  if (!studentRow) return NextResponse.json({ ok: false, error: "Student not found" }, { status: 404 });

  const pointsBase = Math.max(0, Number(studentRow.points_total ?? studentRow.points_balance ?? 0));
  const maxPenaltyPerDay = Math.max(0, Math.floor(pointsBase * 0.08));
  const effectivePenaltyPerDay = Math.min(penaltyPerDay, maxPenaltyPerDay);

  const { data, error } = await admin
    .from("student_skill_countdowns")
    .insert({
      student_id: studentId,
      source_type: sourceType,
      source_key: sourceKey,
      source_label: sourceLabel,
      due_at: new Date(dueAtMs).toISOString(),
      penalty_points_per_day: effectivePenaltyPerDay,
      reward_points: rewardPoints,
      note,
      assigned_by: auth.user.id,
      enabled: true,
    })
    .select(
      "id,student_id,source_type,source_key,source_label,due_at,penalty_points_per_day,reward_points,charged_days,note,enabled,assigned_by,assigned_at,completed_at,completed_by,last_penalty_at"
    )
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, row: data });
}

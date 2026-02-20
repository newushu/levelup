import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { processSkillCountdownPenalties } from "@/lib/skillCountdown";

function isMissingColumn(error: any, col: string) {
  const msg = String(error?.message ?? "").toLowerCase();
  return msg.includes("column") && msg.includes(col.toLowerCase()) && msg.includes("does not exist");
}

export async function GET(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  const url = new URL(req.url);
  const studentId = String(url.searchParams.get("student_id") ?? "").trim();

  const admin = supabaseAdmin();
  if (studentId) {
    await processSkillCountdownPenalties(studentId, auth.user.id);
  } else {
    const { data: ids } = await admin
      .from("student_skill_countdowns")
      .select("student_id")
      .eq("enabled", true)
      .is("completed_at", null);
    const uniqueIds = Array.from(new Set((ids ?? []).map((r: any) => String(r.student_id ?? "")).filter(Boolean)));
    for (const sid of uniqueIds) {
      await processSkillCountdownPenalties(sid, auth.user.id);
    }
  }

  const baseCols =
    "id,student_id,source_type,source_key,source_label,due_at,penalty_points_per_day,reward_points,charged_days,note,enabled,assigned_by,assigned_at,completed_at,completed_by,last_penalty_at";
  const fullStudentCols = `${baseCols},students(name,avatar_storage_path,avatar_bg,gender)`;
  const fallbackStudentCols = `${baseCols},students(name,gender)`;

  let query = admin.from("student_skill_countdowns").select(fullStudentCols).order("assigned_at", { ascending: false });

  if (studentId) query = query.eq("student_id", studentId);

  let { data, error } = await query;
  if (error && (isMissingColumn(error, "avatar_storage_path") || isMissingColumn(error, "avatar_bg"))) {
    let retry = admin.from("student_skill_countdowns").select(fallbackStudentCols).order("assigned_at", { ascending: false });
    if (studentId) retry = retry.eq("student_id", studentId);
    const retried = await retry;
    data = retried.data as any;
    error = retried.error as any;
  }
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, rows: data ?? [] });
}

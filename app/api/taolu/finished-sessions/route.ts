import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabase/server";

async function getUserScope() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { ok: false as const, error: "Not logged in" };

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id);

  if (error) return { ok: false as const, error: error.message };
  const roleList = (roles ?? []).map((r: any) => String(r.role ?? "").toLowerCase());
  const isAdmin = roleList.includes("admin");
  const isCoach = roleList.includes("coach");

  return { ok: true as const, isAdmin, isCoach };
}

export async function GET(req: Request) {
  const gate = await getUserScope();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  if (!gate.isAdmin && !gate.isCoach) {
    return NextResponse.json({ ok: false, error: "Coach access required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const limitRaw = Number(searchParams.get("limit") ?? 200);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 200;

  const admin = supabaseAdmin();
  const { data: sessions, error: sErr } = await admin
    .from("taolu_sessions")
    .select("id,student_id,taolu_form_id,sections,ended_at")
    .not("ended_at", "is", null)
    .order("ended_at", { ascending: false })
    .limit(limit);

  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });

  const sessionIds = (sessions ?? []).map((s) => String(s.id));
  const studentIds = Array.from(new Set((sessions ?? []).map((s) => String(s.student_id))));
  const formIds = Array.from(new Set((sessions ?? []).map((s) => String(s.taolu_form_id))));

  const [{ data: deductions, error: dErr }, { data: remediations, error: rErr }, { data: students, error: stErr }, { data: forms, error: fErr }] =
    await Promise.all([
      sessionIds.length
        ? admin
          .from("taolu_deductions")
          .select("session_id,voided,code_id")
          .in("session_id", sessionIds)
        : Promise.resolve({ data: [], error: null }),
      sessionIds.length
        ? admin
            .from("taolu_remediations")
            .select("session_id,points_awarded,completed_at")
            .in("session_id", sessionIds)
        : Promise.resolve({ data: [], error: null }),
      studentIds.length
        ? admin.from("students").select("id,name").in("id", studentIds)
        : Promise.resolve({ data: [], error: null }),
      formIds.length
        ? admin.from("iwuf_taolu_forms").select("id,name").in("id", formIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (dErr) return NextResponse.json({ ok: false, error: dErr.message }, { status: 500 });
  if (rErr) return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 });
  if (stErr) return NextResponse.json({ ok: false, error: stErr.message }, { status: 500 });
  if (fErr) return NextResponse.json({ ok: false, error: fErr.message }, { status: 500 });

  const codeIds = Array.from(new Set((deductions ?? []).map((d: any) => String(d.code_id ?? "")).filter(Boolean)));
  const { data: codes, error: cErr } = codeIds.length
    ? await admin.from("iwuf_codes").select("id,code_number").in("id", codeIds)
    : { data: [], error: null };
  if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });
  const codeById = new Map((codes ?? []).map((c: any) => [String(c.id), String(c.code_number)]));

  const deductionsBySession = new Map<string, number>();
  const deductionSamplesBySession = new Map<string, string[]>();
  (deductions ?? []).forEach((row: any) => {
    if (row.voided) return;
    const sid = String(row.session_id ?? "");
    if (!sid) return;
    deductionsBySession.set(sid, (deductionsBySession.get(sid) ?? 0) + 1);
    const sample = deductionSamplesBySession.get(sid) ?? [];
    const codeNumber = codeById.get(String(row.code_id ?? "")) ?? "";
    if (codeNumber && sample.length < 3) {
      sample.push(codeNumber);
      deductionSamplesBySession.set(sid, sample);
    }
  });

  const remediationBySession = new Map<string, any>();
  (remediations ?? []).forEach((row: any) => {
    const sid = String(row.session_id ?? "");
    if (!sid) return;
    remediationBySession.set(sid, row);
  });

  const studentById = new Map((students ?? []).map((s: any) => [String(s.id), s]));
  const formById = new Map((forms ?? []).map((f: any) => [String(f.id), f]));

  const out = (sessions ?? []).map((s: any) => {
    const sid = String(s.id);
    const deductionsCount = deductionsBySession.get(sid) ?? 0;
    const pointsLost = deductionsCount * 4;
    const pointsEarned = 10 - pointsLost;
    const remediation = remediationBySession.get(sid);
    return {
      session_id: sid,
      student_id: String(s.student_id),
      student_name: String(studentById.get(String(s.student_id))?.name ?? "Student"),
      taolu_form_id: String(s.taolu_form_id),
      form_name: String(formById.get(String(s.taolu_form_id))?.name ?? "Taolu"),
      sections: s.sections ?? [],
      ended_at: s.ended_at ?? null,
      deductions_count: deductionsCount,
      deduction_samples: deductionSamplesBySession.get(sid) ?? [],
      points_lost: pointsLost,
      points_earned: pointsEarned,
      remediation_completed: !!remediation,
      remediation_points: remediation?.points_awarded ?? 0,
    };
  });

  return NextResponse.json({ ok: true, sessions: out });
}

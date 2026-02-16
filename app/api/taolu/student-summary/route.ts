import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabase/server";

async function getUserScope() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { ok: false as const, error: "Not logged in" };

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role,student_id")
    .eq("user_id", u.user.id);

  if (error) return { ok: false as const, error: error.message };

  const roleList = (roles ?? []).map((r: any) => String(r.role ?? "").toLowerCase());
  const isAdmin = roleList.includes("admin");
  const isCoach = roleList.includes("coach");
  const isClassroom = roleList.includes("classroom");
  const isCheckin = roleList.includes("checkin");
  const studentId = String((roles ?? []).find((r: any) => String(r.role ?? "").toLowerCase() === "student")?.student_id ?? "");

  return { ok: true as const, isAdmin, isCoach, isClassroom, isCheckin, studentId };
}

export async function GET(req: Request) {
  const gate = await getUserScope();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const requestedId = String(searchParams.get("student_id") ?? "").trim();
  const startParam = String(searchParams.get("start_date") ?? "").trim();
  const endParam = String(searchParams.get("end_date") ?? "").trim();
  const canReadRequestedStudent = gate.isAdmin || gate.isCoach || gate.isClassroom || gate.isCheckin;
  const studentId = canReadRequestedStudent ? (requestedId || gate.studentId) : gate.studentId;
  if (!studentId) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });
  const startMs = startParam ? new Date(startParam).getTime() : Number.NaN;
  const endMs = endParam ? new Date(endParam).getTime() + 24 * 60 * 60 * 1000 - 1 : Number.NaN;
  const hasRange = (!Number.isNaN(startMs) || !Number.isNaN(endMs));

  const admin = supabaseAdmin();
  const [{ data: forms, error: fErr }, { data: codes, error: cErr }, { data: windows, error: wErr }] =
    await Promise.all([
      admin
      .from("iwuf_taolu_forms")
      .select("id,name,sections_count,age_group_id")
      .eq("is_active", true),
      admin
        .from("iwuf_codes")
        .select("id,code_number,name,deduction_amount")
        .eq("event_type", "taolu"),
      admin
        .from("iwuf_report_windows")
        .select("id,label,days,sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("days", { ascending: true }),
    ]);

  if (fErr) return NextResponse.json({ ok: false, error: fErr.message }, { status: 500 });
  if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });
  if (wErr) return NextResponse.json({ ok: false, error: wErr.message }, { status: 500 });

  const { data: sessions, error: sErr } = await admin
    .from("taolu_sessions")
    .select("id,taolu_form_id,sections,created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });

  const { data: prepsSessions, error: psErr } = await admin
    .from("preps_sessions")
    .select("id,taolu_form_id,created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (psErr) return NextResponse.json({ ok: false, error: psErr.message }, { status: 500 });

  const sessionIds = (sessions ?? []).map((s) => s.id);
  let deductions: any[] = [];
  if (sessionIds.length) {
    const { data, error: dErr } = await admin
      .from("taolu_deductions")
      .select("id,session_id,code_id,occurred_at,section_number,note,voided")
      .in("session_id", sessionIds);
    if (dErr) return NextResponse.json({ ok: false, error: dErr.message }, { status: 500 });
    deductions = data ?? [];
  }

  const prepsSessionIds = (prepsSessions ?? []).map((s) => s.id);
  let prepsNotes: any[] = [];
  let prepsRemediations: any[] = [];
  if (prepsSessionIds.length) {
    const [{ data: notesData, error: pnErr }, { data: remData, error: prErr }] = await Promise.all([
      admin
        .from("preps_notes")
        .select("id,session_id,occurred_at,prep_key,note")
        .in("session_id", prepsSessionIds),
      admin
        .from("preps_remediations")
        .select("id,session_id,points_awarded,note_ids,completed_at")
        .in("session_id", prepsSessionIds),
    ]);
    if (pnErr) return NextResponse.json({ ok: false, error: pnErr.message }, { status: 500 });
    if (prErr) return NextResponse.json({ ok: false, error: prErr.message }, { status: 500 });
    prepsNotes = notesData ?? [];
    prepsRemediations = remData ?? [];
  }

  const deductionsBySession = new Map<string, any[]>();
  (deductions ?? []).forEach((d) => {
    const key = String(d.session_id ?? "");
    if (!key) return;
    if (!deductionsBySession.has(key)) deductionsBySession.set(key, []);
    deductionsBySession.get(key)!.push(d);
  });

  const sessionHistory = (sessions ?? []).map((s: any) => {
    const list = (deductionsBySession.get(String(s.id)) ?? []).filter((d) => !d.voided);
    return {
      session_id: s.id,
      taolu_form_id: s.taolu_form_id,
      sections: s.sections ?? [],
      created_at: s.created_at,
      deductions: list,
    };
  });

  const prepsNotesBySession = new Map<string, any[]>();
  (prepsNotes ?? []).forEach((n) => {
    const key = String(n.session_id ?? "");
    if (!key) return;
    if (!prepsNotesBySession.has(key)) prepsNotesBySession.set(key, []);
    prepsNotesBySession.get(key)!.push(n);
  });

  const prepsRemediationBySession = new Map<string, any>();
  (prepsRemediations ?? []).forEach((r) => {
    const key = String(r.session_id ?? "");
    if (!key) return;
    prepsRemediationBySession.set(key, r);
  });

  const prepsSessionHistory = (prepsSessions ?? []).map((s: any) => {
    const rem = prepsRemediationBySession.get(String(s.id));
    return {
      session_id: s.id,
      taolu_form_id: s.taolu_form_id,
      created_at: s.created_at,
      notes: prepsNotesBySession.get(String(s.id)) ?? [],
      remediation_points: rem?.points_awarded ?? 0,
      remediation_completed: !!rem,
    };
  });

  const sessionFormById = new Map<string, string>();
  (sessions ?? []).forEach((s: any) => {
    const sid = String(s.id ?? "");
    const fid = String(s.taolu_form_id ?? "");
    if (sid && fid) sessionFormById.set(sid, fid);
  });

  const prepsSessionFormById = new Map<string, string>();
  (prepsSessions ?? []).forEach((s: any) => {
    const sid = String(s.id ?? "");
    const fid = String(s.taolu_form_id ?? "");
    if (sid && fid) prepsSessionFormById.set(sid, fid);
  });

  const summaryDeductions = hasRange
    ? (deductions ?? []).filter((d) => {
        const t = new Date(d.occurred_at).getTime();
        if (Number.isNaN(t)) return false;
        if (!Number.isNaN(startMs) && t < startMs) return false;
        if (!Number.isNaN(endMs) && t > endMs) return false;
        return !d.voided;
      })
    : (deductions ?? []).filter((d) => !d.voided);

  const summaryPrepsNotes = hasRange
    ? (prepsNotes ?? []).filter((n) => {
        const t = new Date(n.occurred_at).getTime();
        if (Number.isNaN(t)) return false;
        if (!Number.isNaN(startMs) && t < startMs) return false;
        if (!Number.isNaN(endMs) && t > endMs) return false;
        return true;
      })
    : (prepsNotes ?? []);

  const prepsFormTotals: Record<string, Record<string, number>> = {};
  const prepsFormNotes: Record<string, Record<string, string[]>> = {};
  summaryPrepsNotes.forEach((n) => {
    const formId = prepsSessionFormById.get(String(n.session_id ?? ""));
    if (!formId) return;
    const key = String(n.prep_key ?? "unknown");
    if (!prepsFormTotals[formId]) prepsFormTotals[formId] = {};
    prepsFormTotals[formId][key] = (prepsFormTotals[formId][key] ?? 0) + 1;
    if (n.note) {
      if (!prepsFormNotes[formId]) prepsFormNotes[formId] = {};
      if (!prepsFormNotes[formId][key]) prepsFormNotes[formId][key] = [];
      prepsFormNotes[formId][key].push(String(n.note));
    }
  });

  const prepsFormRefinements: Record<string, number> = {};
  (prepsRemediations ?? []).forEach((r) => {
    const t = new Date(r.completed_at).getTime();
    if (hasRange) {
      if (Number.isNaN(t)) return;
      if (!Number.isNaN(startMs) && t < startMs) return;
      if (!Number.isNaN(endMs) && t > endMs) return;
    }
    const formId = prepsSessionFormById.get(String(r.session_id ?? ""));
    if (!formId) return;
    prepsFormRefinements[formId] = (prepsFormRefinements[formId] ?? 0) + Number(r.points_awarded ?? 0);
  });

  const formCodeTotals: Record<string, Record<string, number>> = {};
  const formSectionCodeTotals: Record<string, Record<string, Record<string, number>>> = {};
  const formSectionCodeNotes: Record<string, Record<string, Record<string, string[]>>> = {};
  summaryDeductions.forEach((d) => {
    if (!d.code_id) return;
    const formId = sessionFormById.get(String(d.session_id ?? ""));
    if (!formId) return;
    if (!formCodeTotals[formId]) formCodeTotals[formId] = {};
    const codeId = String(d.code_id);
    formCodeTotals[formId][codeId] = (formCodeTotals[formId][codeId] ?? 0) + 1;
    const sectionKey = String(d.section_number ?? "unknown");
    if (!formSectionCodeTotals[formId]) formSectionCodeTotals[formId] = {};
    if (!formSectionCodeTotals[formId][sectionKey]) formSectionCodeTotals[formId][sectionKey] = {};
    formSectionCodeTotals[formId][sectionKey][codeId] =
      (formSectionCodeTotals[formId][sectionKey][codeId] ?? 0) + 1;
    if (d.note) {
      if (!formSectionCodeNotes[formId]) formSectionCodeNotes[formId] = {};
      if (!formSectionCodeNotes[formId][sectionKey]) formSectionCodeNotes[formId][sectionKey] = {};
      if (!formSectionCodeNotes[formId][sectionKey][codeId]) formSectionCodeNotes[formId][sectionKey][codeId] = [];
      formSectionCodeNotes[formId][sectionKey][codeId].push(String(d.note));
    }
  });

  const recentByForm: Record<string, any[]> = {};
  (sessions ?? []).forEach((s) => {
    const formId = String(s.taolu_form_id ?? "");
    if (!formId) return;
    if (!recentByForm[formId]) recentByForm[formId] = [];
    if (recentByForm[formId].length >= 3) return;
    const list = deductionsBySession.get(String(s.id)) ?? [];
    const codeCounts: Record<string, number> = {};
    list.forEach((d) => {
      if (!d.code_id) return;
      const key = String(d.code_id);
      codeCounts[key] = (codeCounts[key] ?? 0) + 1;
    });
    recentByForm[formId].push({
      session_id: s.id,
      created_at: s.created_at,
      sections: s.sections ?? [],
      total_deductions: list.length,
      code_counts: codeCounts,
    });
  });

  const windowsSummary: Record<string, Record<string, number>> = {};
  const now = Date.now();
  (windows ?? []).forEach((w: any) => {
    const cutoff = now - Number(w.days) * 24 * 60 * 60 * 1000;
    const counts: Record<string, number> = {};
    summaryDeductions.forEach((d) => {
      const t = new Date(d.occurred_at).getTime();
      if (Number.isNaN(t) || t < cutoff) return;
      if (!d.code_id) return;
      const key = String(d.code_id);
      counts[key] = (counts[key] ?? 0) + 1;
    });
    windowsSummary[String(w.id)] = counts;
  });

  const { data: ageGroups, error: agErr } = await admin
    .from("iwuf_age_groups")
    .select("id,name,min_age,max_age")
    .order("min_age", { ascending: true });
  if (agErr) return NextResponse.json({ ok: false, error: agErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    forms: forms ?? [],
    age_groups: ageGroups ?? [],
    codes: codes ?? [],
    windows: windows ?? [],
    recent_by_form: recentByForm,
    windows_summary: windowsSummary,
    form_code_totals: formCodeTotals,
    form_section_code_totals: formSectionCodeTotals,
    form_section_code_notes: formSectionCodeNotes,
    preps_form_totals: prepsFormTotals,
    preps_form_notes: prepsFormNotes,
    preps_form_refinements: prepsFormRefinements,
    session_history: sessionHistory,
    preps_session_history: prepsSessionHistory,
  });
}

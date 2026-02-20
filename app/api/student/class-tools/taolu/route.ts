import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type TaoluCard = {
  session_id: string;
  student_id: string;
  student_name: string;
  form_name: string;
  status: "pending" | "finished";
  refinement_status?: "none" | "awaiting_refinement" | "refined";
  created_at: string | null;
  ended_at: string | null;
  deductions_count: number;
  points_lost: number;
  deductions: Array<{ id: string; code_label: string; section_number: number | null; note: string }>;
};

type CumulativeWindowRow = {
  key: "7d" | "30d" | "90d";
  label: string;
  days: number;
  form_id: string;
  form_name: string;
  session_count: number;
  deductions_count: number;
  points_lost: number;
  latest_at?: string | null;
  on_display?: boolean;
  session_id: string;
};

function buildCard(row: any, studentName: string, formName: string, status: "pending" | "finished", deductions: any[], codeById: Map<string, any>): TaoluCard {
  const list = (deductions ?? []).filter((d: any) => !d?.voided);
  return {
    session_id: String(row.id),
    student_id: String(row.student_id),
    student_name: studentName,
    form_name: formName,
    status,
    refinement_status: status === "finished" ? "awaiting_refinement" : "none",
    created_at: row.created_at ?? null,
    ended_at: row.ended_at ?? null,
    deductions_count: list.length,
    points_lost: list.length * 4,
    deductions: list.map((d: any) => {
      const code = codeById.get(String(d.code_id ?? ""));
      return {
        id: String(d.id ?? ""),
        code_label: code ? `${code.code_number} ${code.name}` : "Unassigned code",
        section_number: d.section_number == null ? null : Number(d.section_number),
        note: String(d.note ?? "").trim(),
      };
    }),
  };
}

function toIsoDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function clampRecentDays(value: number) {
  if (!Number.isFinite(value)) return 90;
  return Math.max(7, Math.min(180, Math.floor(value)));
}

async function getDisplayStateRow(admin: ReturnType<typeof supabaseAdmin>) {
  const taolu = await admin
    .from("coach_display_state")
    .select("coach_user_id,tool_key,tool_payload,updated_at")
    .eq("tool_key", "taolu_tracker")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!taolu.error && taolu.data?.coach_user_id) return taolu.data;

  const fallback = await admin
    .from("coach_display_state")
    .select("coach_user_id,tool_key,tool_payload,updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (fallback.error || !fallback.data?.coach_user_id) return null;
  return fallback.data;
}

export async function GET(req: Request) {
  const gate = await requireUser();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const url = new URL(req.url);
  const studentId = String(url.searchParams.get("student_id") ?? "").trim();
  const otherStudentId = String(url.searchParams.get("other_student_id") ?? "").trim();
  if (!studentId) return NextResponse.json({ ok: false, error: "student_id required" }, { status: 400 });
  const recentDays = clampRecentDays(Number(url.searchParams.get("recent_days") ?? "90"));

  const admin = supabaseAdmin();
  const since24hIso = toIsoDaysAgo(1);
  const sinceRecentIso = toIsoDaysAgo(recentDays);
  const since7dIso = toIsoDaysAgo(7);

  const [pendingRes, finishedRes24h, finishedRecentRes, studentRes, otherSessions7dRes] = await Promise.all([
    admin
      .from("taolu_sessions")
      .select("id,student_id,taolu_form_id,created_at,ended_at")
      .eq("student_id", studentId)
      .is("ended_at", null)
      .order("created_at", { ascending: false }),
    admin
      .from("taolu_sessions")
      .select("id,student_id,taolu_form_id,created_at,ended_at")
      .eq("student_id", studentId)
      .not("ended_at", "is", null)
      .gte("ended_at", since24hIso)
      .order("ended_at", { ascending: false }),
    admin
      .from("taolu_sessions")
      .select("id,student_id,taolu_form_id,created_at,ended_at")
      .eq("student_id", studentId)
      .not("ended_at", "is", null)
      .gte("ended_at", sinceRecentIso)
      .order("ended_at", { ascending: false })
      .limit(240),
    admin
      .from("students")
      .select("id,name")
      .eq("id", studentId)
      .maybeSingle(),
    admin
      .from("taolu_sessions")
      .select("id,student_id,ended_at")
      .neq("student_id", studentId)
      .not("ended_at", "is", null)
      .gte("ended_at", since7dIso)
      .order("ended_at", { ascending: false })
      .limit(800),
  ]);

  if (pendingRes.error) return NextResponse.json({ ok: false, error: pendingRes.error.message }, { status: 500 });
  if (finishedRes24h.error) return NextResponse.json({ ok: false, error: finishedRes24h.error.message }, { status: 500 });
  if (finishedRecentRes.error) return NextResponse.json({ ok: false, error: finishedRecentRes.error.message }, { status: 500 });
  if (otherSessions7dRes.error) return NextResponse.json({ ok: false, error: otherSessions7dRes.error.message }, { status: 500 });

  const allRows = [...(pendingRes.data ?? []), ...(finishedRes24h.data ?? []), ...(finishedRecentRes.data ?? [])];
  const uniqueRows = Array.from(new Map(allRows.map((r: any) => [String(r.id), r])).values());
  const formIds = Array.from(new Set(allRows.map((r: any) => String(r.taolu_form_id ?? "")).filter(Boolean)));
  const sessionIds = uniqueRows.map((r: any) => String(r.id));

  const [formsRes, deductionsRes] = await Promise.all([
    formIds.length
      ? admin.from("iwuf_taolu_forms").select("id,name").in("id", formIds)
      : Promise.resolve({ data: [], error: null } as any),
    sessionIds.length
      ? admin
          .from("taolu_deductions")
          .select("id,session_id,code_id,section_number,note,voided")
          .in("session_id", sessionIds)
          .order("occurred_at", { ascending: true })
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  if (formsRes.error) return NextResponse.json({ ok: false, error: formsRes.error.message }, { status: 500 });
  if (deductionsRes.error) return NextResponse.json({ ok: false, error: deductionsRes.error.message }, { status: 500 });

  const codeIds = Array.from(new Set((deductionsRes.data ?? []).map((d: any) => String(d.code_id ?? "")).filter(Boolean)));
  const codesRes = codeIds.length
    ? await admin.from("iwuf_codes").select("id,code_number,name").in("id", codeIds)
    : ({ data: [], error: null } as any);
  if (codesRes.error) return NextResponse.json({ ok: false, error: codesRes.error.message }, { status: 500 });

  const formById = new Map<string, string>((formsRes.data ?? []).map((f: any) => [String(f.id), String(f.name ?? "Taolu")]));
  const codeById = new Map<string, any>((codesRes.data ?? []).map((c: any) => [String(c.id), c]));
  const bySession = new Map<string, any[]>();
  (deductionsRes.data ?? []).forEach((d: any) => {
    const sid = String(d.session_id ?? "");
    if (!sid) return;
    if (!bySession.has(sid)) bySession.set(sid, []);
    bySession.get(sid)!.push(d);
  });

  const studentName = String(studentRes.data?.name ?? "Student");
  const pendingCards = (pendingRes.data ?? []).map((row: any) =>
    buildCard(row, studentName, formById.get(String(row.taolu_form_id)) ?? "Taolu", "pending", bySession.get(String(row.id)) ?? [], codeById)
  );
  const finishedCards = (finishedRes24h.data ?? []).map((row: any) =>
    buildCard(row, studentName, formById.get(String(row.taolu_form_id)) ?? "Taolu", "finished", bySession.get(String(row.id)) ?? [], codeById)
  );
  const recentLogs = (finishedRecentRes.data ?? []).map((row: any) =>
    buildCard(row, studentName, formById.get(String(row.taolu_form_id)) ?? "Taolu", "finished", bySession.get(String(row.id)) ?? [], codeById)
  );

  const stateRow = await getDisplayStateRow(admin);
  const onDisplayIds = new Set(
    (Array.isArray(stateRow?.tool_payload?.cards) ? stateRow!.tool_payload.cards : [])
      .map((c: any) => String(c?.session_id ?? "").trim())
      .filter(Boolean)
  );
  const onDisplayRows = (Array.isArray(stateRow?.tool_payload?.cards) ? stateRow!.tool_payload.cards : []) as any[];

  const otherSessions = (otherSessions7dRes.data ?? []) as Array<{ id: string; student_id: string; ended_at: string }>;
  const otherSessionIds = otherSessions.map((s) => String(s.id));
  const otherStudentIds = Array.from(new Set(otherSessions.map((s) => String(s.student_id)).filter(Boolean)));

  const [otherStudentsRes, otherDeductionsRes] = await Promise.all([
    otherStudentIds.length
      ? admin.from("students").select("id,name").in("id", otherStudentIds)
      : Promise.resolve({ data: [], error: null } as any),
    otherSessionIds.length
      ? admin.from("taolu_deductions").select("session_id,voided").in("session_id", otherSessionIds)
      : Promise.resolve({ data: [], error: null } as any),
  ]);
  if (otherStudentsRes.error) return NextResponse.json({ ok: false, error: otherStudentsRes.error.message }, { status: 500 });
  if (otherDeductionsRes.error) return NextResponse.json({ ok: false, error: otherDeductionsRes.error.message }, { status: 500 });

  const otherNames = new Map<string, string>((otherStudentsRes.data ?? []).map((s: any) => [String(s.id), String(s.name ?? "Student")]));
  const otherDeductionsBySession = new Map<string, number>();
  (otherDeductionsRes.data ?? []).forEach((d: any) => {
    if (d?.voided) return;
    const sid = String(d?.session_id ?? "");
    if (!sid) return;
    otherDeductionsBySession.set(sid, (otherDeductionsBySession.get(sid) ?? 0) + 1);
  });
  const chipByStudent = new Map<string, { student_id: string; student_name: string; sessions_count: number; deductions_count: number }>();
  otherSessions.forEach((row) => {
    const sid = String(row.id ?? "");
    const uid = String(row.student_id ?? "");
    if (!uid) return;
    const prev = chipByStudent.get(uid) ?? {
      student_id: uid,
      student_name: otherNames.get(uid) ?? "Student",
      sessions_count: 0,
      deductions_count: 0,
    };
    prev.sessions_count += 1;
    prev.deductions_count += Number(otherDeductionsBySession.get(sid) ?? 0);
    chipByStudent.set(uid, prev);
  });
  const displayByStudent = new Set(
    onDisplayRows.map((row: any) => String(row?.student_id ?? "").trim()).filter(Boolean)
  );
  const otherStudentChips = Array.from(chipByStudent.values())
    .sort((a, b) => {
      if (b.sessions_count !== a.sessions_count) return b.sessions_count - a.sessions_count;
      if (b.deductions_count !== a.deductions_count) return b.deductions_count - a.deductions_count;
      return a.student_name.localeCompare(b.student_name);
    })
    .slice(0, 80)
    .map((row) => ({
      ...row,
      on_display: displayByStudent.has(String(row.student_id)),
    }));

  const cumulativeWindows: CumulativeWindowRow[] = [];
  const formNameById = new Map<string, string>();
  (finishedRecentRes.data ?? []).forEach((row: any) => {
    const fid = String(row.taolu_form_id ?? "").trim();
    if (!fid) return;
    formNameById.set(fid, formById.get(fid) ?? "Taolu");
  });
  const formsForWindows = Array.from(formNameById.entries());
  const windowDefs = [
    { key: "7d", label: "Last 7d", days: 7 },
    { key: "30d", label: "Last 30d", days: 30 },
    { key: "90d", label: "Last 3mo", days: 90 },
  ] as const;
  for (const w of windowDefs) {
    const since = Date.now() - w.days * 24 * 60 * 60 * 1000;
    for (const [formId, formName] of formsForWindows) {
      const rows = (finishedRecentRes.data ?? []).filter((r: any) => {
        const ts = Date.parse(String(r?.ended_at ?? r?.created_at ?? ""));
        return String(r?.taolu_form_id ?? "") === formId && Number.isFinite(ts) && ts >= since;
      });
      if (!rows.length) continue;
      const rowIds = rows.map((r: any) => String(r.id ?? "")).filter(Boolean);
      const deductionCount = rowIds.reduce(
        (sum, sid) => sum + Number((bySession.get(sid) ?? []).filter((d: any) => !d?.voided).length || 0),
        0
      );
      const pointsLost = deductionCount * 4;
      const latestAt = rows[0]?.ended_at ?? rows[0]?.created_at ?? null;
      const summaryId = `summary:${studentId}:${w.key}:${formId}`;
      cumulativeWindows.push({
        key: w.key,
        label: w.label,
        days: w.days,
        form_id: formId,
        form_name: formName,
        session_count: rows.length,
        deductions_count: deductionCount,
        points_lost: pointsLost,
        latest_at: latestAt,
        on_display: onDisplayIds.has(summaryId),
        session_id: summaryId,
      });
    }
  }

  let otherStudentLogs: any[] = [];
  if (otherStudentId) {
    const [otherRowsRes, otherNameRes] = await Promise.all([
      admin
        .from("taolu_sessions")
        .select("id,student_id,taolu_form_id,created_at,ended_at")
        .eq("student_id", otherStudentId)
        .not("ended_at", "is", null)
        .gte("ended_at", since7dIso)
        .order("ended_at", { ascending: false })
        .limit(24),
      admin.from("students").select("id,name").eq("id", otherStudentId).maybeSingle(),
    ]);
    if (!otherRowsRes.error && !otherNameRes.error) {
      const rows = otherRowsRes.data ?? [];
      const ids = rows.map((r: any) => String(r.id ?? "")).filter(Boolean);
      const otherDeductions = ids.length
        ? await admin
            .from("taolu_deductions")
            .select("id,session_id,code_id,section_number,note,voided")
            .in("session_id", ids)
            .order("occurred_at", { ascending: true })
        : ({ data: [], error: null } as any);
      if (!otherDeductions.error) {
        const otherCodeIds = Array.from(new Set((otherDeductions.data ?? []).map((d: any) => String(d.code_id ?? "")).filter(Boolean)));
        const otherCodes = otherCodeIds.length
          ? await admin.from("iwuf_codes").select("id,code_number,name").in("id", otherCodeIds)
          : ({ data: [], error: null } as any);
        if (!otherCodes.error) {
          const otherCodeById = new Map<string, any>((otherCodes.data ?? []).map((c: any) => [String(c.id), c]));
          const bySessionOther = new Map<string, any[]>();
          (otherDeductions.data ?? []).forEach((d: any) => {
            const sid = String(d.session_id ?? "");
            if (!sid) return;
            if (!bySessionOther.has(sid)) bySessionOther.set(sid, []);
            bySessionOther.get(sid)!.push(d);
          });
          const otherStudentName = String(otherNameRes.data?.name ?? "Student");
          otherStudentLogs = rows.map((row: any) => {
            const card = buildCard(
              row,
              otherStudentName,
              formById.get(String(row.taolu_form_id)) ?? "Taolu",
              "finished",
              bySessionOther.get(String(row.id)) ?? [],
              otherCodeById
            );
            return { ...card, on_display: onDisplayIds.has(String(row.id)) };
          });
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    cards: [...pendingCards, ...finishedCards].map((c) => ({
      ...c,
      on_display: onDisplayIds.has(c.session_id),
    })),
    recent_logs: recentLogs.map((c) => ({
      ...c,
      on_display: onDisplayIds.has(c.session_id),
    })),
    other_student_chips: otherStudentChips,
    other_student_logs: otherStudentLogs,
    cumulative_windows: cumulativeWindows,
  });
}

export async function POST(req: Request) {
  const gate = await requireUser();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const studentId = String(body?.student_id ?? "").trim();
  const sessionId = String(body?.session_id ?? "").trim();
  const windowKey = String(body?.window_key ?? "").trim();
  const formId = String(body?.form_id ?? "").trim();
  const action = String(body?.action ?? "push").trim().toLowerCase();
  const wantsSummary = windowKey === "7d" || windowKey === "30d" || windowKey === "90d";
  if (!studentId || (!sessionId && !wantsSummary)) {
    return NextResponse.json({ ok: false, error: "student_id and session_id required" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const studentRes = await admin.from("students").select("id,name").eq("id", studentId).maybeSingle();
  if (studentRes.error) return NextResponse.json({ ok: false, error: studentRes.error.message }, { status: 500 });
  const studentName = String(studentRes.data?.name ?? "Student");

  if (action === "remove") {
    const stateRow = await getDisplayStateRow(admin);
    if (!stateRow?.coach_user_id) {
      return NextResponse.json({ ok: false, error: "No active display target found" }, { status: 400 });
    }
    const targetId = String(sessionId || `summary:${studentId}:${windowKey}${formId ? `:${formId}` : ""}`).trim();
    if (!targetId) return NextResponse.json({ ok: false, error: "session_id required for remove" }, { status: 400 });
    const payload = (stateRow.tool_key === "taolu_tracker" ? stateRow.tool_payload : {}) ?? {};
    const existingCards = Array.isArray(payload?.cards) ? payload.cards : [];
    const existingBar = Array.isArray(payload?.class_tools_bar) ? payload.class_tools_bar : [];
    const nextPayload = {
      ...payload,
      pushed_at: new Date().toISOString(),
      cards: existingCards.filter((c: any) => String(c?.session_id ?? "") !== targetId),
      class_tools_bar: existingBar.filter((b: any) => String(b?.session_id ?? "") !== targetId),
    };
    const up = await admin
      .from("coach_display_state")
      .upsert(
        {
          coach_user_id: stateRow.coach_user_id,
          tool_key: "taolu_tracker",
          tool_payload: nextPayload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "coach_user_id" }
      )
      .select("coach_user_id")
      .maybeSingle();
    if (up.error) return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });
    return NextResponse.json({ ok: true, removed_session_id: targetId });
  }

  let card: any = null;
  let pushSessionId = sessionId;

  if (wantsSummary) {
    if (!formId) return NextResponse.json({ ok: false, error: "form_id required for cumulative card" }, { status: 400 });
    const days = windowKey === "7d" ? 7 : windowKey === "30d" ? 30 : 90;
    const sinceIso = toIsoDaysAgo(days);
    const sessionsRes = await admin
      .from("taolu_sessions")
      .select("id,ended_at,taolu_form_id")
      .eq("student_id", studentId)
      .eq("taolu_form_id", formId)
      .not("ended_at", "is", null)
      .gte("ended_at", sinceIso)
      .order("ended_at", { ascending: false })
      .limit(500);
    if (sessionsRes.error) return NextResponse.json({ ok: false, error: sessionsRes.error.message }, { status: 500 });
    const rows = (sessionsRes.data ?? []) as Array<{ id: string; ended_at?: string | null }>;
    const ids = rows.map((r) => String(r.id)).filter(Boolean);
    const deductionsRes = ids.length
      ? await admin
          .from("taolu_deductions")
          .select("id,session_id,code_id,voided")
          .in("session_id", ids)
      : ({ data: [], error: null } as any);
    if (deductionsRes.error) return NextResponse.json({ ok: false, error: deductionsRes.error.message }, { status: 500 });

    const live = (deductionsRes.data ?? []).filter((d: any) => !d?.voided);
    const codeTotals = new Map<string, number>();
    live.forEach((d: any) => {
      const cid = String(d.code_id ?? "");
      if (!cid) return;
      codeTotals.set(cid, (codeTotals.get(cid) ?? 0) + 1);
    });
    const topCodeIds = Array.from(codeTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id]) => id);
    const codesRes = topCodeIds.length
      ? await admin.from("iwuf_codes").select("id,code_number,name").in("id", topCodeIds)
      : ({ data: [], error: null } as any);
    if (codesRes.error) return NextResponse.json({ ok: false, error: codesRes.error.message }, { status: 500 });
    const codeById = new Map<string, any>((codesRes.data ?? []).map((c: any) => [String(c.id), c]));

    const label = windowKey === "7d" ? "Last 7d" : windowKey === "30d" ? "Last 30d" : "Last 3mo";
    const deductionCount = live.length;
    const pointsLost = deductionCount * 4;
    const formRes = await admin.from("iwuf_taolu_forms").select("id,name").eq("id", formId).maybeSingle();
    if (formRes.error) return NextResponse.json({ ok: false, error: formRes.error.message }, { status: 500 });
    const summaryId = `summary:${studentId}:${windowKey}:${formId}`;
    pushSessionId = summaryId;
    card = {
      session_id: summaryId,
      student_id: studentId,
      student_name: studentName,
      form_name: `${String(formRes.data?.name ?? "Taolu")} • Cumulative ${label}`,
      source: "student_class_tools",
      is_cumulative: true,
      status: "finished",
      refinement_status: "refined",
      created_at: new Date().toISOString(),
      ended_at: rows[0]?.ended_at ?? new Date().toISOString(),
      deductions_count: deductionCount,
      points_lost: pointsLost,
      deductions: topCodeIds.map((cid, idx) => {
        const code = codeById.get(cid);
        const count = Number(codeTotals.get(cid) ?? 0);
        const labelText = code ? `${code.code_number} ${code.name}` : "Code";
        return {
          id: `summary-${windowKey}-${idx + 1}`,
          code_label: `${labelText} ×${count}`,
          section_number: null,
          note: `${rows.length} sessions in ${label}`,
        };
      }),
    };
  } else {
    const sessionRes = await admin
      .from("taolu_sessions")
      .select("id,student_id,taolu_form_id,created_at,ended_at")
      .eq("id", sessionId)
      .maybeSingle();
    if (sessionRes.error) return NextResponse.json({ ok: false, error: sessionRes.error.message }, { status: 500 });
    if (!sessionRes.data) return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });

    const [formRes, deductionsRes] = await Promise.all([
      admin.from("iwuf_taolu_forms").select("id,name").eq("id", sessionRes.data.taolu_form_id).maybeSingle(),
      admin
        .from("taolu_deductions")
        .select("id,session_id,code_id,section_number,note,voided")
        .eq("session_id", sessionId)
        .order("occurred_at", { ascending: true }),
    ]);
    if (deductionsRes.error) return NextResponse.json({ ok: false, error: deductionsRes.error.message }, { status: 500 });

    const codeIds = Array.from(new Set((deductionsRes.data ?? []).map((d: any) => String(d.code_id ?? "")).filter(Boolean)));
    const codesRes = codeIds.length
      ? await admin.from("iwuf_codes").select("id,code_number,name").in("id", codeIds)
      : ({ data: [], error: null } as any);
    if (codesRes.error) return NextResponse.json({ ok: false, error: codesRes.error.message }, { status: 500 });
    const codeById = new Map<string, any>((codesRes.data ?? []).map((c: any) => [String(c.id), c]));

    const pushedStudentRes = await admin.from("students").select("id,name").eq("id", sessionRes.data.student_id).maybeSingle();
    if (pushedStudentRes.error) return NextResponse.json({ ok: false, error: pushedStudentRes.error.message }, { status: 500 });
    card = buildCard(
      sessionRes.data,
      String(pushedStudentRes.data?.name ?? studentName),
      String(formRes.data?.name ?? "Taolu"),
      sessionRes.data.ended_at ? "finished" : "pending",
      deductionsRes.data ?? [],
      codeById
    );
    card = { ...card, source: "student_class_tools", is_cumulative: false };
  }

  const stateRow = await getDisplayStateRow(admin);
  if (!stateRow?.coach_user_id) {
    return NextResponse.json({ ok: false, error: "No active display target found" }, { status: 400 });
  }

  const payload = (stateRow.tool_key === "taolu_tracker" ? stateRow.tool_payload : {}) ?? {};
  const existingCards = Array.isArray(payload?.cards) ? payload.cards : [];
  const nextCards = [...existingCards.filter((c: any) => String(c?.session_id ?? "") !== pushSessionId), card];
  const sectionNumbers: number[] = Array.from(
    new Set(
      (card.deductions ?? [])
        .map((d: any) => Number(d?.section_number ?? 0))
        .filter((n: number) => Number.isFinite(n) && n > 0)
    )
  );
  const sectionSummary = sectionNumbers.sort((a, b) => a - b).join(", ") || "—";
  const nextBar = [
    {
      source: "student_class_tools",
      pushed_at: new Date().toISOString(),
      student_name: card.student_name,
      age_group_name: (card as any).age_group_name ?? null,
      form_name: card.form_name,
      is_cumulative: card?.is_cumulative === true,
      section_summary: sectionSummary,
      session_id: card.session_id,
      status: card.status,
      deductions: card.deductions,
    },
  ];

  const nextPayload = {
    ...payload,
    pushed_at: new Date().toISOString(),
    cards: nextCards,
    class_tools_bar: nextBar,
  };

  const up = await admin
    .from("coach_display_state")
    .upsert(
      {
        coach_user_id: stateRow.coach_user_id,
        tool_key: "taolu_tracker",
        tool_payload: nextPayload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "coach_user_id" }
    )
    .select("coach_user_id")
    .maybeSingle();

  if (up.error) return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, pushed_session_id: pushSessionId });
}

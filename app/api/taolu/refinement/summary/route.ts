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

type DeductionEntry = {
  id: string;
  student_id: string;
  taolu_form_id: string;
  section_number: number;
  code_id: string;
  note: string | null;
  occurred_at: string;
};

function parseCodeNumber(code: string) {
  const num = Number.parseInt(String(code || "").replace(/\D/g, ""), 10);
  return Number.isFinite(num) ? num : null;
}

export async function POST(req: Request) {
  const gate = await getUserScope();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  if (!gate.isAdmin && !gate.isCoach) {
    return NextResponse.json({ ok: false, error: "Coach access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const student_ids = Array.isArray(body?.student_ids)
    ? body.student_ids.map((id: any) => String(id)).filter(Boolean)
    : [];
  const window_days = Number(body?.window_days ?? 7);
  const allowedWindows = new Set([7, 30, 90]);
  const windowDays = allowedWindows.has(window_days) ? window_days : 7;

  if (!student_ids.length) {
    return NextResponse.json({ ok: false, error: "Missing student_ids" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const sinceMs = Date.now() - windowDays * 24 * 60 * 60 * 1000;

  let { data: sessions, error: sErr } = await admin
    .from("taolu_sessions")
    .select("id,student_id,taolu_form_id,created_at,ended_at")
    .in("student_id", student_ids);
  if (sErr && String(sErr.message || "").includes("column")) {
    const retry = await admin
      .from("taolu_sessions")
      .select("id,student_id,taolu_form_id,ended_at")
      .in("student_id", student_ids);
    sessions = retry.data as any;
    sErr = retry.error as any;
  }

  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });
  const sessionMap = new Map<string, { student_id: string; taolu_form_id: string; created_at?: string | null; ended_at?: string | null }>();
  (sessions ?? []).forEach((s: any) => {
    sessionMap.set(String(s.id), {
      student_id: String(s.student_id),
      taolu_form_id: String(s.taolu_form_id),
      created_at: s.created_at ?? null,
      ended_at: s.ended_at ?? null,
    });
  });

  const sessionIds = (sessions ?? []).map((s: any) => String(s.id));
  const deductions: DeductionEntry[] = [];

  if (sessionIds.length) {
    let { data: rows, error: dErr } = await admin
      .from("taolu_deductions")
      .select("id,session_id,occurred_at,assigned_at,created_at,section_number,note,code_id,voided")
      .in("session_id", sessionIds);
    if (dErr && String(dErr.message || "").includes("column")) {
      const retry = await admin
        .from("taolu_deductions")
        .select("id,session_id,occurred_at,section_number,note,code_id,voided")
        .in("session_id", sessionIds);
      rows = retry.data as any;
      dErr = retry.error as any;
    }

    if (dErr) return NextResponse.json({ ok: false, error: dErr.message }, { status: 500 });

    (rows ?? []).forEach((row: any) => {
      const session = sessionMap.get(String(row.session_id));
      if (!session) return;
      if (row.voided) return;
      const sessionTs = session?.ended_at ?? session?.created_at ?? null;
      const ts = row.occurred_at ?? row.assigned_at ?? row.created_at ?? sessionTs;
      if (!ts) return;
      const tsMs = new Date(ts).getTime();
      if (!Number.isFinite(tsMs) || tsMs < sinceMs) return;

      // Prefer using section_number; if missing, infer from session.sections when possible.
      let sectionNum = Number(row.section_number ?? 0);
      if (!Number.isFinite(sectionNum) || sectionNum <= 0) {
        const sections = Array.isArray(session?.sections) ? session?.sections : [];
        if (sections.length === 1) sectionNum = Number(sections[0]);
      }

      deductions.push({
        id: String(row.id),
        student_id: session.student_id,
        taolu_form_id: session.taolu_form_id,
        section_number: Number.isFinite(sectionNum) ? sectionNum : 0,
        code_id: String(row.code_id ?? "unassigned"),
        note: row.note ?? null,
        occurred_at: String(row.occurred_at ?? row.assigned_at ?? row.created_at ?? ""),
      });
    });
  }

  let { data: refRows, error: rErr } = await admin
    .from("taolu_refinement_deductions")
    .select("id,student_id,taolu_form_id,section_number,code_id,note,occurred_at,created_at")
    .in("student_id", student_ids);
  if (rErr && String(rErr.message || "").includes("column")) {
    const retry = await admin
      .from("taolu_refinement_deductions")
      .select("id,student_id,taolu_form_id,section_number,code_id,note,occurred_at")
      .in("student_id", student_ids);
    refRows = retry.data as any;
    rErr = retry.error as any;
  }

  if (rErr) return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 });

  (refRows ?? []).forEach((row: any) => {
    if (row.section_number === null || row.section_number === undefined) return;
    const ts = row.occurred_at ?? row.created_at;
    if (!ts) return;
    const tsMs = new Date(ts).getTime();
    if (!Number.isFinite(tsMs) || tsMs < sinceMs) return;
    deductions.push({
      id: String(row.id),
      student_id: String(row.student_id),
      taolu_form_id: String(row.taolu_form_id),
      section_number: Number(row.section_number ?? 0),
      code_id: String(row.code_id ?? "unassigned"),
      note: row.note ?? null,
      occurred_at: String(row.occurred_at ?? row.created_at ?? ""),
    });
  });

  if (!deductions.length) {
    return NextResponse.json({ ok: true, students: [] });
  }

  const deductionTotals = new Map<string, number>();
  deductions.forEach((d) => {
    const key = `${d.student_id}::${d.taolu_form_id}`;
    deductionTotals.set(key, (deductionTotals.get(key) ?? 0) + 1);
  });

  const codeIds = Array.from(new Set(deductions.map((d) => d.code_id)));
  const formIds = Array.from(new Set(deductions.map((d) => d.taolu_form_id)));

  const [
    { data: codes, error: cErr },
    { data: forms, error: fErr },
    { data: students, error: stErr },
    { data: sessionRows, error: sErr2 },
    { data: rounds, error: rdErr },
  ] = await Promise.all([
    admin.from("iwuf_codes").select("id,code_number,name").in("id", codeIds),
    admin.from("iwuf_taolu_forms").select("id,name,sections_count").in("id", formIds),
    admin.from("students").select("id,name,level,points_total").in("id", student_ids),
    admin.from("taolu_sessions").select("student_id,created_at,ended_at").in("student_id", student_ids),
    admin.from("taolu_refinement_rounds").select("student_id,created_at").in("student_id", student_ids),
  ]);

  if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });
  if (fErr) return NextResponse.json({ ok: false, error: fErr.message }, { status: 500 });
  if (stErr) return NextResponse.json({ ok: false, error: stErr.message }, { status: 500 });
  if (sErr2) return NextResponse.json({ ok: false, error: sErr2.message }, { status: 500 });
  if (rdErr) return NextResponse.json({ ok: false, error: rdErr.message }, { status: 500 });

  const codeById = new Map((codes ?? []).map((c: any) => [String(c.id), c]));
  const formById = new Map((forms ?? []).map((f: any) => [String(f.id), f]));
  const studentById = new Map((students ?? []).map((s: any) => [String(s.id), s]));
  const lastSessionByStudent = new Map<string, string>();
  (sessionRows ?? []).forEach((row: any) => {
    const sid = String(row.student_id ?? "");
    if (!sid) return;
    const ts = String(row.ended_at ?? row.created_at ?? "");
    if (!ts) return;
    const prev = lastSessionByStudent.get(sid);
    if (!prev || new Date(ts).getTime() > new Date(prev).getTime()) {
      lastSessionByStudent.set(sid, ts);
    }
  });
  const lastRefinementByStudent = new Map<string, string>();
  (rounds ?? []).forEach((row: any) => {
    const sid = String(row.student_id ?? "");
    const ts = String(row.created_at ?? "");
    if (!sid || !ts) return;
    const prev = lastRefinementByStudent.get(sid);
    if (!prev || new Date(ts).getTime() > new Date(prev).getTime()) {
      lastRefinementByStudent.set(sid, ts);
    }
  });

  const grouped = new Map<string, DeductionEntry[]>();

  deductions.forEach((d) => {
    const key = `${d.student_id}::${d.taolu_form_id}::${d.section_number}::${d.code_id}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(d);
  });

  const summaryByStudent = new Map<string, any>();

  grouped.forEach((list, key) => {
    const [student_id, taolu_form_id, sectionNum, code_id] = key.split("::");
    const code = codeById.get(code_id);
    const codeNumber = String(code?.code_number ?? "—");
    const codeName = String(code?.name ?? (code_id === "unassigned" ? "Unassigned (needs review)" : "Unknown code"));
    const codeNum = parseCodeNumber(codeNumber);
    const isGrouped = codeNum !== null && codeNum >= 10 && codeNum <= 21;
    const sorted = [...list].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
    const topThree = sorted.slice(0, 3);

    const studentEntry = summaryByStudent.get(student_id) ?? {
      student_id,
      student_name: studentById.get(student_id)?.name ?? "Student",
      student_level: studentById.get(student_id)?.level ?? null,
      student_points: studentById.get(student_id)?.points_total ?? null,
      last_taolu_at: lastSessionByStudent.get(student_id) ?? null,
      last_refinement_at: lastRefinementByStudent.get(student_id) ?? null,
      forms: new Map<string, any>(),
    };

    const formEntry = studentEntry.forms.get(taolu_form_id) ?? {
      taolu_form_id,
      form_name: formById.get(taolu_form_id)?.name ?? "Taolu",
      sections_count: formById.get(taolu_form_id)?.sections_count ?? 0,
      deductions_count: deductionTotals.get(`${student_id}::${taolu_form_id}`) ?? 0,
      sections: new Map<number, any>(),
    };

    const sectionNumber = Number(sectionNum);
    const sectionEntry = formEntry.sections.get(sectionNumber) ?? {
      section_number: sectionNumber,
      chips: [] as any[],
    };

    if (isGrouped) {
      sectionEntry.chips.push({
        chip_id: `${taolu_form_id}:${sectionNumber}:${code_id}:group`,
        code_id,
        code_number: codeNumber,
        code_name: codeName,
        count: sorted.length,
        deduction_ids: topThree.map((d) => d.id),
        notes: topThree.map((d) => d.note).filter(Boolean),
        occurred_at: topThree[0]?.occurred_at ?? null,
      });
    } else {
      topThree.forEach((entry, idx) => {
        sectionEntry.chips.push({
          chip_id: `${taolu_form_id}:${sectionNumber}:${code_id}:single:${idx}`,
          code_id,
          code_number: codeNumber,
          code_name: codeName,
          count: 1,
          deduction_ids: [entry.id],
          notes: entry.note ? [entry.note] : [],
          occurred_at: entry.occurred_at,
        });
      });
    }

    formEntry.sections.set(sectionNumber, sectionEntry);
    studentEntry.forms.set(taolu_form_id, formEntry);
    summaryByStudent.set(student_id, studentEntry);
  });

  const out = Array.from(summaryByStudent.values()).map((studentEntry: any) => {
    const forms = Array.from(studentEntry.forms.values()).map((formEntry: any) => {
      const sections = Array.from(formEntry.sections.values())
        .map((section: any) => {
          const chips = section.chips.sort((a: any, b: any) => {
            const aNum = parseCodeNumber(a.code_number) ?? 999;
            const bNum = parseCodeNumber(b.code_number) ?? 999;
            return aNum - bNum;
          });
          return { ...section, chips };
        })
        .sort((a: any, b: any) => a.section_number - b.section_number);
      return { ...formEntry, sections };
    });

    forms.sort((a: any, b: any) => String(a.form_name).localeCompare(String(b.form_name)));
    return {
      student_id: studentEntry.student_id,
      student_name: studentEntry.student_name,
      student_level: studentEntry.student_level,
      student_points: studentEntry.student_points,
      last_taolu_at: studentEntry.last_taolu_at,
      last_refinement_at: studentEntry.last_refinement_at,
      forms,
    };
  });

  return NextResponse.json({ ok: true, students: out });
}

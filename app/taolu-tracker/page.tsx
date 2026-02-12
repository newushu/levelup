"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AuthGate from "@/components/AuthGate";
import Overlay from "@/components/dashboard/Overlay";

type StudentRow = { id: string; name: string; level?: number; card_plate_url?: string | null };
type TaoluForm = {
  id: string;
  name: string;
  sections_count: number;
  age_group_id?: string | null;
  video_links?: string[];
};
type CodeRow = { id: string; code_number: string; name: string; description?: string | null; deduction_amount?: number };
type AgeGroup = { id: string; name: string; min_age?: number | null; max_age?: number | null };
type SessionRow = {
  id: string;
  student_id: string;
  taolu_form_id: string;
  sections: number[];
  separate_sections: boolean;
  created_at: string;
};
type DeductionRow = {
  id: string;
  session_id: string;
  occurred_at: string;
  code_id?: string | null;
  assigned_at?: string | null;
  section_number?: number | null;
  note?: string | null;
  voided?: boolean | null;
};
type FinishedLog = {
  session_id: string;
  student_id: string;
  taolu_form_id: string;
  sections: number[];
  deductions: DeductionRow[];
  deductions_count: number;
  points_lost: number;
  points_earned: number;
  ended_at?: string | null;
  remediation_points?: number;
  remediation_completed?: boolean;
};
type FinishedHistoryRow = {
  session_id: string;
  student_id: string;
  student_name: string;
  taolu_form_id: string;
  form_name: string;
  sections: number[];
  ended_at?: string | null;
  deductions_count: number;
  deduction_samples?: string[];
  points_lost: number;
  points_earned: number;
  remediation_completed?: boolean;
  remediation_points?: number;
};
type RemediationLog = {
  session_id: string;
  points_awarded: number;
  deduction_ids: string[];
  completed_at: string;
};
type RefinementChip = {
  chip_id: string;
  code_id: string;
  code_number: string;
  code_name: string;
  count: number;
  deduction_ids: string[];
  notes: string[];
};
type RefinementSection = {
  section_number: number;
  chips: RefinementChip[];
};
type RefinementForm = {
  taolu_form_id: string;
  form_name: string;
  sections_count: number;
  deductions_count: number;
  sections: RefinementSection[];
};
type RefinementStudent = {
  student_id: string;
  student_name: string;
  student_level?: number | null;
  student_points?: number | null;
  last_taolu_at?: string | null;
  last_refinement_at?: string | null;
  forms: RefinementForm[];
};
type RefinementNewDeduction = {
  taolu_form_id?: string;
  section_number?: number | null;
  code_id?: string;
  note?: string;
};

const TAOLU_START_POINTS = 10;
const TAOLU_DEDUCTION_POINTS = 2;

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 180)}` } };
  }
}

export default function TaoluTrackerPage() {
  return (
    <AuthGate>
      <TaoluTrackerInner />
    </AuthGate>
  );
}

function TaoluTrackerInner() {
  const [viewerRole, setViewerRole] = useState("coach");
  const [blocked, setBlocked] = useState(false);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [forms, setForms] = useState<TaoluForm[]>([]);
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [individualStudentId, setIndividualStudentId] = useState("");
  const [groupStudentIds, setGroupStudentIds] = useState<string[]>([]);
  const [selectedAgeGroupId, setSelectedAgeGroupId] = useState("");
  const [selectedFormId, setSelectedFormId] = useState("");
  const [selectedSections, setSelectedSections] = useState<number[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [finishedSessions, setFinishedSessions] = useState<FinishedLog[]>([]);
  const [finishedHistory, setFinishedHistory] = useState<FinishedHistoryRow[]>([]);
  const [finishedHistoryLoading, setFinishedHistoryLoading] = useState(false);
  const [finishedHistorySearch, setFinishedHistorySearch] = useState("");
  const [historyDetailId, setHistoryDetailId] = useState<string | null>(null);
  const [refineActiveStudentId, setRefineActiveStudentId] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [deductionsBySession, setDeductionsBySession] = useState<Record<string, DeductionRow[]>>({});
  const [activeSectionBySession, setActiveSectionBySession] = useState<Record<string, number>>({});
  const activeSectionRef = useRef<Record<string, number>>({});
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [deductionFlash, setDeductionFlash] = useState<{ sessionId: string; ts: number } | null>(null);
  const [codeCountsByStudent, setCodeCountsByStudent] = useState<Record<string, Record<string, number>>>({});
  const [remediationBySession, setRemediationBySession] = useState<Record<string, RemediationLog>>({});
  const [remediationSelections, setRemediationSelections] = useState<Record<string, string[]>>({});
  const [remediationBusy, setRemediationBusy] = useState(false);
  const deductionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const jumpIndexRef = useRef(0);
  const [codeSearchByDeduction, setCodeSearchByDeduction] = useState<Record<string, string>>({});
  const [plateOffsets, setPlateOffsets] = useState<{ x: number; y: number; size: number }>({ x: 0, y: 0, size: 220 });
  const [msg, setMsg] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [groupNameInput, setGroupNameInput] = useState("");
  const [addMode, setAddMode] = useState<"individual" | "group">("individual");
  const [activeTab, setActiveTab] = useState<"tracker" | "refinement">("tracker");
  const [newFormName, setNewFormName] = useState("");
  const [newFormAgeGroupId, setNewFormAgeGroupId] = useState("");
  const [newFormSections, setNewFormSections] = useState("1");
  const [newFormMsg, setNewFormMsg] = useState("");
  const [newFormBusy, setNewFormBusy] = useState(false);
  const [refinementWindow, setRefinementWindow] = useState<"7d" | "30d" | "90d">("7d");
  const [finishedWindow, setFinishedWindow] = useState<"7d" | "30d" | "90d" | "all">("7d");
  const [refineStudentIds, setRefineStudentIds] = useState<string[]>([]);
  const [refineNameInput, setRefineNameInput] = useState("");
  const [refineSummary, setRefineSummary] = useState<RefinementStudent[]>([]);
  const [refineLoading, setRefineLoading] = useState(false);
  const [refineMsg, setRefineMsg] = useState("");
  const [refineSelections, setRefineSelections] = useState<Record<string, boolean>>({});
  const [refineSectionInclude, setRefineSectionInclude] = useState<Record<string, boolean>>({});
  const [refineNewDraftByStudent, setRefineNewDraftByStudent] = useState<Record<string, RefinementNewDeduction>>({});
  const [refineNewByStudent, setRefineNewByStudent] = useState<Record<string, RefinementNewDeduction[]>>({});
  const [refineSubmitBusy, setRefineSubmitBusy] = useState<Record<string, boolean>>({});
  const [refineLogByStudent, setRefineLogByStudent] = useState<Record<string, { label: string; sections: number[]; net: number; fixed: number; missed: number; newCount: number }>>({});
  const [refineListeningStudentId, setRefineListeningStudentId] = useState<string | null>(null);

  const nameRef = useRef<HTMLInputElement | null>(null);
  const groupNameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    (async () => {
      const meRes = await fetch("/api/auth/me", { cache: "no-store" }).catch(() => null);
      if (meRes) {
        const meJson = await safeJson(meRes);
        if (meJson.ok) {
          const role = String(meJson.json?.role ?? "coach");
          setViewerRole(role);
          if (role === "student" || role === "classroom") {
            setBlocked(true);
          }
        }
      }
      const [sRes, refsRes] = await Promise.all([
        fetch("/api/students/list", { cache: "no-store" }),
        fetch("/api/iwuf/refs", { cache: "no-store" }),
      ]);
      const sJson = await safeJson(sRes);
      const rJson = await safeJson(refsRes);
      if (!sJson.ok) setMsg(sJson.json?.error || "Failed to load students");
      if (!rJson.ok) setMsg(rJson.json?.error || "Failed to load Taolu data");
      setStudents((sJson.json?.students ?? []) as StudentRow[]);
      setForms((rJson.json?.forms ?? []).filter((f: any) => f.is_active !== false) as TaoluForm[]);
      setCodes((rJson.json?.codes ?? []) as CodeRow[]);
      setAgeGroups((rJson.json?.age_groups ?? []) as AgeGroup[]);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/card-plates/settings", { cache: "no-store" });
      const sj = await safeJson(r);
      if (!sj.ok) return;
      setPlateOffsets({
        x: Number(sj.json?.settings?.taolu_tracker_x ?? 0),
        y: Number(sj.json?.settings?.taolu_tracker_y ?? 0),
        size: Number(sj.json?.settings?.taolu_tracker_size ?? 220),
      });
    })();
  }, []);

  const blockedView = blocked ? (
    <main style={{ display: "grid", gap: 12 }}>
      <div style={{ fontSize: 26, fontWeight: 1000 }}>Taolu Tracker</div>
      <div style={{ opacity: 0.75 }}>
        {viewerRole === "classroom" ? "Classroom mode cannot access Taolu Tracker." : "Student accounts cannot access Taolu Tracker."}
      </div>
    </main>
  ) : null;

  const filteredForms = useMemo(() => {
    if (!selectedAgeGroupId) return forms;
    return forms.filter((f) => String(f.age_group_id ?? "") === selectedAgeGroupId);
  }, [forms, selectedAgeGroupId]);

  const selectedForm = useMemo(
    () => forms.find((f) => f.id === selectedFormId) ?? null,
    [forms, selectedFormId]
  );
  const availableSections = useMemo(() => {
    const count = selectedForm?.sections_count ?? 0;
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [selectedForm]);

  useEffect(() => {
    if (!selectedForm) return;
    if (!selectedSections.length) {
      setSelectedSections(availableSections);
    }
  }, [selectedForm, availableSections, selectedSections.length]);

  useEffect(() => {
    if (blocked) return;
    (async () => {
      const res = await fetch("/api/taolu/sessions", { cache: "no-store" });
      const sj = await safeJson(res);
      if (!sj.ok) return setMsg(sj.json?.error || "Failed to load sessions");
      const list = (sj.json?.sessions ?? []) as SessionRow[];
      setSessions(list);
      if (list.length) setActiveSessionId(list[0]?.id ?? "");
      setActiveSectionBySession((prev) => {
        const next = { ...prev };
        list.forEach((s) => {
          if (!next[s.id] && s.sections?.length) next[s.id] = s.sections[0];
        });
        activeSectionRef.current = { ...activeSectionRef.current, ...next };
        return next;
      });
      await Promise.all(list.map((s) => loadDeductions(s.id)));
    })();
  }, [blocked]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const key = e.code === "Space" ? "space" : e.key.toLowerCase();
      if (key !== "space" && key !== "n") return;
      if (e.repeat) return;
      const activeEl = document.activeElement?.tagName?.toLowerCase();
      if (activeEl === "input" || activeEl === "textarea" || activeEl === "select") return;
      if (activeTab === "refinement") {
        if (!refineListeningStudentId) return;
        e.preventDefault();
        addRefineEmptyDeduction(refineListeningStudentId);
        return;
      }
      if (openSessionId) return;
      if (!activeSessionId) return;
      e.preventDefault();
      logDeduction(activeSessionId);
    }
    window.addEventListener("keydown", onKey, { passive: false });
    return () => window.removeEventListener("keydown", onKey);
  }, [activeSessionId, openSessionId, activeTab, refineListeningStudentId]);

  useEffect(() => {
    jumpIndexRef.current = -1;
  }, [openSessionId]);

  function addStudentByName(raw: string) {
    const name = raw.trim().toLowerCase();
    if (!name) return;
    const matches = students.filter((s) => s.name.trim().toLowerCase().includes(name));
    const exact = students.find((s) => s.name.trim().toLowerCase() === name);
    const match = exact ?? matches[0];
    if (!match) return setMsg("Student not found.");
    setIndividualStudentId(match.id);
    setNameInput("");
    setMsg("");
  }

  function addGroupStudentByName(raw: string) {
    const name = raw.trim().toLowerCase();
    if (!name) return;
    const matches = students.filter((s) => s.name.trim().toLowerCase().includes(name));
    const exact = students.find((s) => s.name.trim().toLowerCase() === name);
    const match = exact ?? matches[0];
    if (!match) return setMsg("Student not found.");
    setGroupStudentIds((prev) => [...prev, match.id]);
    setGroupNameInput("");
    setMsg("");
  }

  function selectAgeGroupByName(raw: string) {
    const name = raw.trim().toLowerCase();
    if (!name) return;
    const exact = ageGroups.find((g) => g.name.trim().toLowerCase() === name);
    const fuzzy = ageGroups.find((g) => g.name.trim().toLowerCase().includes(name));
    const match = exact ?? fuzzy;
    if (!match) return setMsg("Age group not found.");
    setSelectedAgeGroupId(match.id);
    setSelectedFormId("");
    setSelectedSections([]);
    setMsg("");
  }

  function selectFormByName(raw: string) {
    const name = raw.trim().toLowerCase();
    if (!name) return;
    const pool = selectedAgeGroupId ? filteredForms : forms;
    const exact = pool.find((f) => f.name.trim().toLowerCase() === name);
    const fuzzy = pool.find((f) => f.name.trim().toLowerCase().includes(name));
    const match = exact ?? fuzzy;
    if (!match) return setMsg("Form not found.");
    setSelectedFormId(match.id);
    setSelectedSections([]);
    setMsg("");
  }

  function resolveAgeGroupId() {
    return selectedAgeGroupId;
  }

  function resolveFormId() {
    return selectedFormId;
  }

  function resolveSections(formId: string) {
    if (selectedSections.length) return selectedSections;
    const form = forms.find((f) => f.id === formId);
    if (!form) return [];
    return Array.from({ length: form.sections_count }, (_, i) => i + 1);
  }

  async function startTracking(studentIds: string[]) {
    const resolvedAgeId = resolveAgeGroupId();
    const resolvedFormId = resolveFormId();
    const resolvedSections = resolveSections(resolvedFormId);
    if (!resolvedFormId || !resolvedSections.length || !studentIds.length) {
      return setMsg("Select an event and at least one student.");
    }
    setMsg("");
    const res = await fetch("/api/taolu/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taolu_form_id: resolvedFormId,
        student_ids: studentIds,
        sections: resolvedSections,
        separate_sections: false,
      }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to create sessions");
    const newSessions = (sj.json?.sessions ?? []) as SessionRow[];
    setSessions((prev) => {
      const next = [...prev, ...newSessions];
      if (!prev.length && newSessions.length) {
        setActiveSessionId(newSessions[0].id);
      }
      return next;
    });
    setIndividualStudentId("");
    setGroupStudentIds([]);
    setSelectedAgeGroupId("");
    setSelectedFormId("");
    setSelectedSections([]);
    setNameInput("");
    setGroupNameInput("");
  }

  async function logDeduction(sessionId: string) {
    const session = sessions.find((s) => s.id === sessionId);
    const section_number =
      activeSectionRef.current[sessionId] ??
      activeSectionBySession[sessionId] ??
      session?.sections?.[0] ??
      null;
    const res = await fetch("/api/taolu/deductions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, section_number }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to log deduction");
    const deduction = sj.json?.deduction as DeductionRow;
    setDeductionsBySession((prev) => ({
      ...prev,
      [sessionId]: [...(prev[sessionId] ?? []), deduction],
    }));
    setDeductionFlash({ sessionId, ts: Date.now() });
    window.setTimeout(() => {
      setDeductionFlash((prev) => (prev?.sessionId === sessionId ? null : prev));
    }, 700);
  }

  async function loadDeductions(sessionId: string): Promise<DeductionRow[]> {
    const res = await fetch(`/api/taolu/deductions?session_id=${sessionId}`, { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) {
      setMsg(sj.json?.error || "Failed to load deductions");
      return [];
    }
    const list = (sj.json?.deductions ?? []) as DeductionRow[];
    setDeductionsBySession((prev) => ({ ...prev, [sessionId]: list }));
    return list;
  }

  async function loadCodeCounts(studentId: string) {
    if (!studentId) return;
    if (codeCountsByStudent[studentId]) return;
    const res = await fetch(`/api/taolu/student-code-counts?student_id=${studentId}`, { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return;
    setCodeCountsByStudent((prev) => ({ ...prev, [studentId]: sj.json?.counts ?? {} }));
  }

  async function finishSession(sessionId: string) {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;
    await fetch("/api/taolu/deductions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    });
    const finishRes = await fetch("/api/taolu/finish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    });
    const finishJson = await safeJson(finishRes);
    if (!finishJson.ok) return setMsg(finishJson.json?.error || "Failed to finish session");
    const endedAt = String(finishJson.json?.session?.ended_at ?? "") || new Date().toISOString();

    const list = (await loadDeductions(sessionId)) ?? deductionsBySession[sessionId] ?? [];
    const liveCount = countLiveDeductions(list);
    const pointsLost = pointsLostFromDeductions(liveCount);
    const pointsEarned = pointsEarnedFromDeductions(liveCount);
    setFinishedSessions((prev) => [
      ...prev,
      {
        session_id: sessionId,
        student_id: session.student_id,
        taolu_form_id: session.taolu_form_id,
        sections: session.sections ?? [],
        deductions: list,
        deductions_count: liveCount,
        points_lost: pointsLost,
        points_earned: pointsEarned,
        ended_at: endedAt,
      },
    ]);
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== sessionId);
      if (activeSessionId === sessionId) {
        setActiveSessionId(next[0]?.id ?? "");
      }
      return next;
    });
  }

  async function closeSession(sessionId: string) {
    await fetch("/api/taolu/sessions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    });
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== sessionId);
      if (activeSessionId === sessionId) {
        setActiveSessionId(next[0]?.id ?? "");
      }
      return next;
    });
  }

  async function updateDeduction(
    deductionId: string,
    updates: { code_id?: string | null; section_number?: number | null; note?: string | null; voided?: boolean }
  ) {
    const res = await fetch("/api/taolu/deductions/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deduction_id: deductionId, ...updates }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to assign code");
    const updated = sj.json?.deduction as DeductionRow;
    setDeductionsBySession((prev) => {
      const list = (prev[updated.session_id] ?? []).map((d) => (d.id === updated.id ? updated : d));
      return { ...prev, [updated.session_id]: list };
    });
  }

  async function removeDeduction(deduction: DeductionRow) {
    if (!window.confirm("Remove this deduction? This will not subtract points.")) return;
    const res = await fetch("/api/taolu/deductions/assign", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deduction_id: deduction.id }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to remove deduction");
    setDeductionsBySession((prev) => {
      const list = (prev[deduction.session_id] ?? []).filter((row) => row.id !== deduction.id);
      return { ...prev, [deduction.session_id]: list };
    });
    setRemediationSelections((prev) => {
      const current = prev[deduction.session_id];
      if (!current?.length) return prev;
      return { ...prev, [deduction.session_id]: current.filter((id) => id !== deduction.id) };
    });
  }

  function countLiveDeductions(list: DeductionRow[]) {
    return list.filter((d) => !d.voided).length;
  }

  function pointsLostFromDeductions(count: number) {
    return count * TAOLU_DEDUCTION_POINTS;
  }

  function pointsEarnedFromDeductions(count: number) {
    return TAOLU_START_POINTS - pointsLostFromDeductions(count);
  }

  function codeLabel(code?: CodeRow | null) {
    if (!code) return "";
    return `${code.code_number} • ${code.name}`;
  }

  function filterCodes(query: string) {
    const q = query.trim().toLowerCase();
    if (!q) return codes.slice(0, 8);
    return codes
      .filter((c) => `${c.code_number} ${c.name}`.toLowerCase().includes(q))
      .slice(0, 8);
  }

  async function loadRemediation(sessionId: string) {
    if (!sessionId) return;
    const res = await fetch(`/api/taolu/remediations?session_id=${sessionId}`, { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return;
    if (sj.json?.remediation) {
      const row = sj.json.remediation as RemediationLog;
      setRemediationBySession((prev) => ({ ...prev, [sessionId]: row }));
      setFinishedSessions((prev) =>
        prev.map((item) =>
          item.session_id === sessionId
            ? {
                ...item,
                remediation_points: row.points_awarded,
                remediation_completed: true,
              }
            : item
        )
      );
    }
  }

  async function submitRemediation(sessionId: string) {
    const selection = remediationSelections[sessionId] ?? [];
    setRemediationBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/taolu/remediations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, deduction_ids: selection }),
      });
      const sj = await safeJson(res);
      if (!sj.ok) throw new Error(sj.json?.error || "Failed to submit refinement round");
      const remediation = sj.json?.remediation as RemediationLog;
      setRemediationBySession((prev) => ({ ...prev, [sessionId]: remediation }));
      setFinishedSessions((prev) =>
        prev.map((row) =>
          row.session_id === sessionId
            ? {
                ...row,
                remediation_points: remediation.points_awarded,
                remediation_completed: true,
              }
            : row
        )
      );
    } catch (err: any) {
      setMsg(err?.message ?? "Failed to submit refinement round");
    } finally {
      setRemediationBusy(false);
    }
  }

  function toggleRemediationSelection(sessionId: string, deductionId: string) {
    setRemediationSelections((prev) => {
      const current = new Set(prev[sessionId] ?? []);
      if (current.has(deductionId)) {
        current.delete(deductionId);
      } else {
        current.add(deductionId);
      }
      return { ...prev, [sessionId]: Array.from(current) };
    });
  }

  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const formById = useMemo(() => new Map(forms.map((f) => [f.id, f])), [forms]);
  const codeById = useMemo(() => new Map(codes.map((c) => [c.id, c])), [codes]);

  const primaryCards = sessions.slice(0, 4);
  const overflowCards = sessions.slice(4);
  const openSession =
    (openSessionId && sessions.find((s) => s.id === openSessionId)) ||
    (openSessionId && finishedSessions.find((s) => s.session_id === openSessionId)) ||
    null;
  const openFinishedSession =
    openSessionId ? finishedSessions.find((s) => s.session_id === openSessionId) ?? null : null;
  const filteredFinishedSessions = useMemo(() => {
    if (finishedWindow === "all") return finishedSessions;
    const days = finishedWindow === "7d" ? 7 : finishedWindow === "30d" ? 30 : 90;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return finishedSessions.filter((s) => {
      const ts = s.ended_at ? new Date(s.ended_at).getTime() : 0;
      return ts ? ts >= cutoff : true;
    });
  }, [finishedSessions, finishedWindow]);

  useEffect(() => {
    if (!openFinishedSession) return;
    loadRemediation(openFinishedSession.session_id);
  }, [openFinishedSession?.session_id]);

  useEffect(() => {
    if (!refineStudentIds.length || !refineSummary.length) return;
    loadRefinementSummary();
  }, [refinementWindow]);

  useEffect(() => {
    if (activeTab !== "refinement") return;
    if (finishedHistory.length) return;
    loadFinishedHistory();
  }, [activeTab]);

  useEffect(() => {
    if (!historyDetailId) return;
    loadDeductions(historyDetailId);
    loadRemediation(historyDetailId);
  }, [historyDetailId]);

  function moveSessionToFront(sessionId: string) {
    setSessions((prev) => {
      const target = prev.find((s) => s.id === sessionId);
      if (!target) return prev;
      const rest = prev.filter((s) => s.id !== sessionId);
      return [target, ...rest];
    });
    setActiveSessionId(sessionId);
  }

  async function clearOverflow() {
    if (!overflowCards.length) return;
    if (!window.confirm("Clear all next up sessions?")) return;
    for (const s of overflowCards) {
      await closeSession(s.id);
    }
  }

  async function updateSessionSections(sessionId: string, sections: number[]) {
    const res = await fetch("/api/taolu/sessions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, sections }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to update sections");
    const updated = sj.json?.session as SessionRow;
    setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    const active = updated.sections?.[0];
    if (active) {
      activeSectionRef.current = { ...activeSectionRef.current, [sessionId]: active };
      setActiveSectionBySession((prev) => ({ ...prev, [sessionId]: active }));
    }
  }

  function refinementWindowDays() {
    if (refinementWindow === "30d") return 30;
    if (refinementWindow === "90d") return 90;
    return 7;
  }

  function formatShortDate(value?: string | null) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function addRefineStudentByName(raw: string) {
    const value = raw.trim().toLowerCase();
    if (!value) return;
    const match = students.find((s) => s.name.toLowerCase() === value) ??
      students.find((s) => s.name.toLowerCase().includes(value));
    if (!match) return setRefineMsg("Student not found.");
    setRefineStudentIds((prev) => (prev.includes(match.id) ? prev : [...prev, match.id]));
    setRefineNameInput("");
    setRefineMsg("");
  }

  async function loadRefinementSummary() {
    if (!refineStudentIds.length) return setRefineMsg("Select at least one student.");
    setRefineLoading(true);
    setRefineMsg("");
    try {
      const res = await fetch("/api/taolu/refinement/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_ids: refineStudentIds, window_days: refinementWindowDays() }),
      });
      const sj = await safeJson(res);
      if (!sj.ok) throw new Error(sj.json?.error || "Failed to load refinement summary");
      const list = (sj.json?.students ?? []) as RefinementStudent[];
      setRefineSummary(list);
      if (list.length) {
        setRefineActiveStudentId((prev) => (prev && list.some((s) => s.student_id === prev) ? prev : list[0].student_id));
      }
      const nextInclude: Record<string, boolean> = {};
      list.forEach((student) => {
        student.forms.forEach((form) => {
          form.sections.forEach((section) => {
            const key = `${student.student_id}:${form.taolu_form_id}:${section.section_number}`;
            nextInclude[key] = false;
          });
        });
      });
      setRefineSectionInclude(nextInclude);
      setRefineSelections({});
    } catch (err: any) {
      setRefineMsg(err?.message ?? "Failed to load refinement summary");
    } finally {
      setRefineLoading(false);
    }
  }

  function addRefineNewFromDraft(studentId: string) {
    const draft = refineNewDraftByStudent[studentId];
    if (!draft?.taolu_form_id || !draft.code_id || !draft.section_number) {
      setRefineMsg("Select form, section, and code before adding a new deduction.");
      return;
    }
    setRefineNewByStudent((prev) => ({
      ...prev,
      [studentId]: [...(prev[studentId] ?? []), {
        taolu_form_id: draft.taolu_form_id,
        section_number: Number(draft.section_number),
        code_id: draft.code_id,
        note: draft.note ?? "",
      }],
    }));
    setRefineNewDraftByStudent((prev) => ({
      ...prev,
      [studentId]: {
        taolu_form_id: draft.taolu_form_id,
        section_number: draft.section_number,
        code_id: "",
        note: "",
      },
    }));
    setRefineMsg("");
  }

  function addRefineEmptyDeduction(studentId: string) {
    const includedSections = Object.entries(refineSectionInclude)
      .filter(([key, included]) => included && key.startsWith(`${studentId}:`))
      .map(([key]) => key.split(":"))
      .map((parts) => ({ formId: parts[1], section: Number(parts[2]) }))
      .filter((row) => Number.isFinite(row.section));
    const formCounts = new Map<string, number>();
    includedSections.forEach((row) => {
      formCounts.set(row.formId, (formCounts.get(row.formId) ?? 0) + 1);
    });
    const [defaultFormId] = Array.from(formCounts.entries()).sort((a, b) => b[1] - a[1])[0] ?? [];
    const defaultSections = includedSections
      .filter((row) => row.formId === defaultFormId)
      .map((row) => row.section)
      .sort((a, b) => a - b);
    const defaultSection = defaultSections[0] ?? null;
    setRefineNewByStudent((prev) => ({
      ...prev,
      [studentId]: [
        {
          taolu_form_id: defaultFormId ?? "",
          section_number: defaultSection,
          code_id: "",
          note: "",
        },
        ...(prev[studentId] ?? []),
      ],
    }));
  }

  async function loadFinishedHistory() {
    setFinishedHistoryLoading(true);
    try {
      const res = await fetch("/api/taolu/finished-sessions?limit=300", { cache: "no-store" });
      const sj = await safeJson(res);
      if (!sj.ok) throw new Error(sj.json?.error || "Failed to load finished sessions");
      setFinishedHistory((sj.json?.sessions ?? []) as FinishedHistoryRow[]);
    } catch (err: any) {
      setRefineMsg(err?.message ?? "Failed to load finished sessions");
    } finally {
      setFinishedHistoryLoading(false);
    }
  }

  async function openFinishedFromHistory(row: FinishedHistoryRow) {
    setOpenSessionId(row.session_id);
    if (!finishedSessions.find((s) => s.session_id === row.session_id)) {
      setFinishedSessions((prev) => [
        ...prev,
        {
          session_id: row.session_id,
          student_id: row.student_id,
          taolu_form_id: row.taolu_form_id,
          sections: row.sections ?? [],
          deductions: [],
          deductions_count: row.deductions_count ?? 0,
          points_lost: row.points_lost ?? 0,
          points_earned: row.points_earned ?? 0,
          ended_at: row.ended_at ?? null,
          remediation_points: row.remediation_points ?? 0,
          remediation_completed: row.remediation_completed ?? false,
        },
      ]);
    }
    const list = await loadDeductions(row.session_id);
    if (list) {
      const liveCount = countLiveDeductions(list);
      const pointsLost = pointsLostFromDeductions(liveCount);
      const pointsEarned = pointsEarnedFromDeductions(liveCount);
      setFinishedSessions((prev) =>
        prev.map((item) =>
          item.session_id === row.session_id
            ? {
                ...item,
                deductions: list,
                deductions_count: liveCount,
                points_lost: pointsLost,
                points_earned: pointsEarned,
              }
            : item
        )
      );
    }
    loadRemediation(row.session_id);
  }

  function toggleRefineChip(chipId: string) {
    setRefineSelections((prev) => ({ ...prev, [chipId]: !prev[chipId] }));
  }

  async function submitRefinement(student: RefinementStudent) {
    const windowDays = refinementWindowDays();
    const newPenalty = 3;
    const newItems = refineNewByStudent[student.student_id] ?? [];
    const hasUnfilled = newItems.some((row) => !row.taolu_form_id || !row.code_id || !row.section_number);
    if (hasUnfilled) {
      setRefineMsg("Fill out form, section, and code for all new deductions before submitting.");
      return;
    }
    const selections: Array<{
      taolu_form_id: string;
      section_number: number;
      code_id: string;
      code_number: string;
      code_name: string;
      deduction_ids: string[];
      notes: string[];
      fixed: boolean;
    }> = [];

    student.forms.forEach((form) => {
      form.sections.forEach((section) => {
        const key = `${student.student_id}:${form.taolu_form_id}:${section.section_number}`;
        if (!refineSectionInclude[key]) return;
        section.chips.forEach((chip) => {
          selections.push({
            taolu_form_id: form.taolu_form_id,
            section_number: section.section_number,
            code_id: chip.code_id,
            code_number: chip.code_number,
            code_name: chip.code_name,
            deduction_ids: chip.deduction_ids ?? [],
            notes: chip.notes ?? [],
            fixed: !!refineSelections[chip.chip_id],
          });
        });
      });
    });

    setRefineSubmitBusy((prev) => ({ ...prev, [student.student_id]: true }));
    setRefineMsg("");
    try {
      const res = await fetch("/api/taolu/refinement/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: student.student_id,
          window_days: windowDays,
          selections,
          new_deductions: newItems,
        }),
      });
      const sj = await safeJson(res);
      if (!sj.ok) throw new Error(sj.json?.error || "Failed to submit refinement");
      setRefineNewByStudent((prev) => ({ ...prev, [student.student_id]: [] }));
      const fixedCount = selections.filter((s) => s.fixed).length;
      const missedCount = selections.filter((s) => !s.fixed).length;
      const net = fixedCount * 5 - missedCount * 5 - newItems.length * newPenalty;
      const sections = Array.from(new Set(
        selections
          .filter((s) => refineSectionInclude[`${student.student_id}:${s.taolu_form_id}:${s.section_number}`])
          .map((s) => s.section_number)
      )).sort((a, b) => a - b);
      const label = windowDays === 7 ? "7d" : windowDays === 30 ? "30d" : "3mo";
      setRefineLogByStudent((prev) => ({
        ...prev,
        [student.student_id]: {
          label,
          sections,
          net,
          fixed: fixedCount,
          missed: missedCount,
          newCount: newItems.length,
        },
      }));
      setRefineMsg(`Refinement saved for ${student.student_name}. Net ${net} pts.`);
    } catch (err: any) {
      setRefineMsg(err?.message ?? "Failed to submit refinement");
    } finally {
      setRefineSubmitBusy((prev) => ({ ...prev, [student.student_id]: false }));
    }
  }

  return (
    <main style={{ display: "grid", gap: 16, padding: "0 50px" }}>
      <div style={{ fontSize: 26, fontWeight: 1000 }}>Taolu Tracker</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button style={pill(activeTab === "tracker")} onClick={() => setActiveTab("tracker")}>Tracker</button>
        <button style={pill(activeTab === "refinement")} onClick={() => setActiveTab("refinement")}>Refinement</button>
      </div>
      {msg ? <div style={notice()}>{msg}</div> : null}

      {activeTab === "tracker" ? (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 0.8fr)", gap: 16 }}>
        <div style={card()}>
          <div style={{ fontWeight: 1000 }}>Setup</div>
          <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => setAddMode("individual")} style={pill(addMode === "individual")}>
                Individual Add
              </button>
              <button onClick={() => setAddMode("group")} style={pill(addMode === "group")}>
                Group Add
              </button>
            </div>
            <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              {addMode === "individual" ? (
                <div style={miniCard()}>
                  <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.85 }}>Individual Add</div>
                  <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                    <select
                      value={selectedAgeGroupId}
                      onChange={(e) => {
                        setSelectedAgeGroupId(e.target.value);
                        setSelectedFormId("");
                        setSelectedSections([]);
                      }}
                      style={input()}
                    >
                      <option value="">Select age group</option>
                      {ageGroups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                    <select
                      value={selectedFormId}
                      onChange={(e) => {
                        setSelectedFormId(e.target.value);
                        setSelectedSections([]);
                      }}
                      style={input()}
                    >
                      <option value="">Select event</option>
                      {filteredForms.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                    <input
                      ref={nameRef}
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="Student name (Enter)"
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        addStudentByName(nameInput);
                      }}
                      style={input()}
                    />
                    {nameInput.trim() ? (
                      <div style={suggestions()}>
                        {students
                          .filter((s) => s.name.toLowerCase().includes(nameInput.trim().toLowerCase()))
                          .slice(0, 6)
                          .map((s) => (
                            <button
                              key={s.id}
                              onClick={() => addStudentByName(s.name)}
                              style={suggestionItem()}
                            >
                              {s.name}
                            </button>
                          ))}
                      </div>
                    ) : null}
                    {individualStudentId ? (
                      <div style={chip()}>
                        Selected: {studentById.get(individualStudentId)?.name ?? "Student"}
                      </div>
                    ) : null}
                    <button
                      onClick={() => {
                        if (!individualStudentId) return setMsg("Select a student.");
                        if (!selectedFormId) return setMsg("Select an age group and event.");
                        startTracking([individualStudentId]);
                      }}
                      style={btn()}
                    >
                      Add Individual Card
                    </button>
                  </div>
                </div>
              ) : null}

              {addMode === "group" ? (
                <div style={miniCard()}>
                  <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.85 }}>Group Add</div>
                  <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                    <select
                      value={selectedAgeGroupId}
                      onChange={(e) => {
                        setSelectedAgeGroupId(e.target.value);
                        setSelectedFormId("");
                        setSelectedSections([]);
                      }}
                      style={input()}
                    >
                      <option value="">Select age group</option>
                      {ageGroups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                    <select
                      value={selectedFormId}
                      onChange={(e) => {
                        setSelectedFormId(e.target.value);
                        setSelectedSections([]);
                      }}
                      style={input()}
                    >
                      <option value="">Select event</option>
                      {filteredForms.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                    <input
                      ref={groupNameRef}
                      value={groupNameInput}
                      onChange={(e) => setGroupNameInput(e.target.value)}
                      placeholder="Type name + Enter"
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        addGroupStudentByName(groupNameInput);
                      }}
                      style={input()}
                    />
                    {groupNameInput.trim() ? (
                      <div style={suggestions()}>
                        {students
                          .filter((s) => s.name.toLowerCase().includes(groupNameInput.trim().toLowerCase()))
                          .slice(0, 6)
                          .map((s) => (
                            <button
                              key={s.id}
                              onClick={() => addGroupStudentByName(s.name)}
                              style={suggestionItem()}
                            >
                              {s.name}
                            </button>
                          ))}
                      </div>
                    ) : null}
                    {groupStudentIds.length ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {groupStudentIds.map((id, idx) => (
                          <span key={`${id}-${idx}`} style={chip()}>
                            {studentById.get(id)?.name ?? "Student"}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <button
                      onClick={() => {
                        if (!groupStudentIds.length) return setMsg("Add at least one student.");
                        if (!selectedFormId) return setMsg("Select an age group and event.");
                        startTracking(groupStudentIds);
                      }}
                      style={btn()}
                    >
                      Add Group Cards
                    </button>
                  </div>
                </div>
              ) : null}

              {viewerRole === "admin" ? (
                <div style={miniCard()}>
                  <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.85 }}>Add Taolu Form</div>
                  <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                    <input
                      value={newFormName}
                      onChange={(e) => setNewFormName(e.target.value)}
                      placeholder="Form name"
                      style={input()}
                    />
                    <select
                      value={newFormAgeGroupId}
                      onChange={(e) => setNewFormAgeGroupId(e.target.value)}
                      style={input()}
                    >
                      <option value="">Age group (optional)</option>
                      {ageGroups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                    <input
                      value={newFormSections}
                      onChange={(e) => setNewFormSections(e.target.value)}
                      placeholder="Sections count"
                      style={input()}
                    />
                    <button
                      style={btn()}
                      disabled={newFormBusy}
                      onClick={async () => {
                        const name = newFormName.trim();
                        const sectionsCount = Number(newFormSections);
                        if (!name) return setNewFormMsg("Name required.");
                        if (!sectionsCount || Number.isNaN(sectionsCount) || sectionsCount < 1) {
                          return setNewFormMsg("Sections must be >= 1.");
                        }
                        setNewFormBusy(true);
                        setNewFormMsg("");
                        try {
                          const res = await fetch("/api/admin/iwuf/forms", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              name,
                              age_group_id: newFormAgeGroupId || null,
                              sections_count: sectionsCount,
                              event_type: "taolu",
                            }),
                          });
                          const sj = await safeJson(res);
                          if (!sj.ok) throw new Error(sj.json?.error || "Failed to add form");
                          const form = sj.json?.form as TaoluForm;
                          setForms((prev) => [...prev, form].sort((a, b) => a.name.localeCompare(b.name)));
                          setNewFormName("");
                          setNewFormAgeGroupId("");
                          setNewFormSections("1");
                        } catch (err: any) {
                          setNewFormMsg(err?.message ?? "Failed to add form");
                        } finally {
                          setNewFormBusy(false);
                        }
                      }}
                    >
                      {newFormBusy ? "Saving..." : "Create form"}
                    </button>
                    {newFormMsg ? <div style={{ fontSize: 12, opacity: 0.7 }}>{newFormMsg}</div> : null}
                  </div>
                </div>
              ) : null}
            </div>

            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Use the Individual Add or Group Add boxes above to create cards.
            </div>
          </div>
        </div>
        <div style={statsPanel()}>
          <div
            style={{
              fontWeight: 1000,
              fontSize: 13,
              position: "sticky",
              top: 0,
              background: "rgba(5,10,18,0.92)",
              paddingBottom: 6,
              zIndex: 2,
            }}
          >
            Current Session Stats
          </div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Active cards: {sessions.length} • Total deductions{" "}
            {sessions.reduce((sum, s) => sum + countLiveDeductions(deductionsBySession[s.id] ?? []), 0)}
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {sessions.map((s) => {
              const student = studentById.get(s.student_id);
              const form = formById.get(s.taolu_form_id);
              const list = deductionsBySession[s.id] ?? [];
              const liveCount = countLiveDeductions(list);
              const pointsLost = pointsLostFromDeductions(liveCount);
              const pointsEarned = pointsEarnedFromDeductions(liveCount);
              return (
                <div key={s.id} style={statsRow()}>
                  <div style={{ fontWeight: 900 }}>{student?.name ?? "Student"}</div>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>{form?.name ?? "Taolu"}</div>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>
                    Deductions {liveCount} • Lost {pointsLost} • Score {pointsEarned}
                  </div>
                </div>
              );
            })}
            {!sessions.length ? (
              <div style={{ opacity: 0.6, fontSize: 12 }}>No active session data.</div>
            ) : null}
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {Array.from(
              sessions.reduce((acc, s) => {
                const form = formById.get(s.taolu_form_id);
                const ageLabel = form?.age_group_id
                  ? ageGroups.find((g) => g.id === form.age_group_id)?.name ?? "Age group"
                  : "Age group";
                const key = `${ageLabel} • ${form?.name ?? "Taolu"}`;
                if (!acc.has(key)) acc.set(key, []);
                acc.get(key)?.push(s);
                return acc;
              }, new Map<string, SessionRow[]>())
            ).map(([label, group]) => {
              const ranked = [...group].sort((a, b) => {
                const aCount = countLiveDeductions(deductionsBySession[a.id] ?? []);
                const bCount = countLiveDeductions(deductionsBySession[b.id] ?? []);
                return aCount - bCount;
              });
              return (
                <div key={label} style={statsRow()}>
                  <div style={{ fontWeight: 900 }}>{label}</div>
                  <div style={{ display: "grid", gap: 4, marginTop: 4 }}>
                    {ranked.map((s, idx) => {
                      const student = studentById.get(s.student_id);
                      const count = countLiveDeductions(deductionsBySession[s.id] ?? []);
                      return (
                        <div key={s.id} style={{ fontSize: 11, opacity: 0.75 }}>
                          #{idx + 1} {student?.name ?? "Student"} • {count} deductions
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        </div>
      ) : null}

      {activeTab === "refinement" ? (
        <div style={card()}>
        <div style={{ fontWeight: 1000, fontSize: 16 }}>Refinement Hub</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Single-session refinement: +1 per fixed deduction, no points lost. Window refinements: +5 fixed, -5 missed, -3 new.
        </div>
        <div style={{ fontSize: 12, opacity: 0.6 }}>
          Click “Start listening” on a student card to arm the space/N hotkey. Space/N adds a new deduction chip.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
          <button style={pill(refinementWindow === "7d")} onClick={() => setRefinementWindow("7d")}>7d</button>
          <button style={pill(refinementWindow === "30d")} onClick={() => setRefinementWindow("30d")}>30d</button>
          <button style={pill(refinementWindow === "90d")} onClick={() => setRefinementWindow("90d")}>3mo</button>
        </div>
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          <input
            value={refineNameInput}
            onChange={(e) => setRefineNameInput(e.target.value)}
            placeholder="Add student name + Enter"
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              addRefineStudentByName(refineNameInput);
            }}
            style={input()}
          />
          {refineNameInput.trim() ? (
            <div style={suggestions()}>
              {students
                .filter((s) => s.name.toLowerCase().includes(refineNameInput.trim().toLowerCase()))
                .slice(0, 6)
                .map((s) => (
                  <button
                    key={s.id}
                    onClick={() => addRefineStudentByName(s.name)}
                    style={suggestionItem()}
                  >
                    {s.name}
                  </button>
                ))}
            </div>
          ) : null}
          {refineStudentIds.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {refineStudentIds.map((id) => (
                <button
                  key={id}
                  style={chip()}
                  onClick={() => setRefineStudentIds((prev) => prev.filter((sid) => sid !== id))}
                >
                  {studentById.get(id)?.name ?? "Student"} ✕
                </button>
              ))}
            </div>
          ) : null}
          <button style={btn()} onClick={loadRefinementSummary} disabled={refineLoading}>
            {refineLoading ? "Loading..." : "Load refinement"}
          </button>
          {refineMsg ? <div style={{ fontSize: 12, opacity: 0.7 }}>{refineMsg}</div> : null}
        </div>

        {refineSummary.length ? (
          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {refineSummary.map((student) => {
                const selectedCount = Object.entries(refineSectionInclude)
                  .filter(([key, included]) => included && key.startsWith(`${student.student_id}:`)).length;
                return (
                  <button
                    key={student.student_id}
                    style={pill(refineActiveStudentId === student.student_id)}
                    onClick={() => setRefineActiveStudentId(student.student_id)}
                  >
                    {student.student_name}
                    {selectedCount ? ` • ${selectedCount}` : ""}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
            {refineSummary
              .filter((student) => !refineActiveStudentId || student.student_id === refineActiveStudentId)
              .map((student) => {
              const newPenalty = 3;
              let totalChips = 0;
              let fixedCount = 0;
              student.forms.forEach((form) => {
                form.sections.forEach((section) => {
                  const includeKey = `${student.student_id}:${form.taolu_form_id}:${section.section_number}`;
                  if (!refineSectionInclude[includeKey]) return;
                  totalChips += section.chips.length;
                  section.chips.forEach((chip) => {
                    if (refineSelections[chip.chip_id]) fixedCount += 1;
                  });
                });
              });
              const missedCount = Math.max(0, totalChips - fixedCount);
              const newCount = (refineNewByStudent[student.student_id] ?? []).length;
              const net = fixedCount * 5 - missedCount * 5 - newCount * newPenalty;
              const log = refineLogByStudent[student.student_id];
              return (
                <div
                  key={student.student_id}
                  style={refineCard(refineListeningStudentId === student.student_id)}
                  onClick={() => {
                    setRefineActiveStudentId(student.student_id);
                    setRefineListeningStudentId(student.student_id);
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 1000 }}>{student.student_name}</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        Lvl {student.student_level ?? "—"} • {student.student_points ?? 0} pts • Forms {student.forms.length}
                      </div>
                      <div style={{ fontSize: 11, opacity: 0.65 }}>
                        Last taolu {formatShortDate(student.last_taolu_at)} • Last refinement {formatShortDate(student.last_refinement_at)}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                        Fixed {fixedCount} • Missed {missedCount} • New {newCount} • Net {net} pts
                      </div>
                      {log ? (
                        <div style={{ marginTop: 6 }}>
                          <div style={{ fontWeight: 900 }}>{log.label} Refinement</div>
                          <div style={{ fontSize: 11, opacity: 0.75 }}>
                            Sections {log.sections.length ? log.sections.join(", ") : "—"}
                          </div>
                          <div style={{ fontSize: 11, opacity: 0.75 }}>
                            +{log.fixed * 5} fixed • -{log.missed * 5} missed • -{log.newCount * 3} new
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 1000, color: log.net >= 0 ? "rgba(34,197,94,0.95)" : "rgba(248,113,113,0.95)" }}>
                            {log.net >= 0 ? `+${log.net}` : log.net} pts
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        style={pill(refineListeningStudentId === student.student_id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setRefineListeningStudentId((prev) =>
                            prev === student.student_id ? null : student.student_id
                          );
                        }}
                      >
                        {refineListeningStudentId === student.student_id ? "Tracking" : "Track new deductions"}
                      </button>
                      <button
                        style={btnGhost()}
                        onClick={() => {
                          const next = { ...refineSectionInclude };
                          student.forms.forEach((form) => {
                            form.sections.forEach((section) => {
                              const key = `${student.student_id}:${form.taolu_form_id}:${section.section_number}`;
                              next[key] = false;
                            });
                          });
                          setRefineSectionInclude(next);
                        }}
                      >
                        Unselect all
                      </button>
                      <button
                        style={btn()}
                        onClick={() => submitRefinement(student)}
                        disabled={!!refineSubmitBusy[student.student_id]}
                      >
                        {refineSubmitBusy[student.student_id] ? "Submitting..." : "Submit refinement"}
                      </button>
                    </div>
                  </div>

                  {student.forms.map((form) => (
                    <div key={form.taolu_form_id} style={{ display: "grid", gap: 8 }}>
                      <div style={{ fontWeight: 900 }}>{form.form_name}</div>
                      <div style={{ fontSize: 11, opacity: 0.7 }}>
                        Sections {form.sections_count ?? 0} • Deductions {form.deductions_count ?? 0}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          style={pill(false)}
                          onClick={() => {
                            const next = { ...refineSectionInclude };
                            form.sections.forEach((section) => {
                              const key = `${student.student_id}:${form.taolu_form_id}:${section.section_number}`;
                              next[key] = false;
                            });
                            setRefineSectionInclude(next);
                          }}
                        >
                          Unselect all sections
                        </button>
                      </div>
                      {form.sections.map((section) => {
                        const includeKey = `${student.student_id}:${form.taolu_form_id}:${section.section_number}`;
                        const included = !!refineSectionInclude[includeKey];
                        return (
                          <div key={`${form.taolu_form_id}-${section.section_number}`} style={refineSection()}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                              <div style={{ fontWeight: 900 }}>Section {section.section_number}</div>
                              <button
                                style={pill(included)}
                                onClick={() =>
                                  setRefineSectionInclude((prev) => ({ ...prev, [includeKey]: !included }))
                                }
                              >
                                {included ? "Included" : "Include section"}
                              </button>
                            </div>
                            <div style={refineChipRow()}>
                              {section.chips.map((chip) => {
                                const selected = !!refineSelections[chip.chip_id];
                                return (
                                  <button
                                    key={chip.chip_id}
                                    type="button"
                                    onClick={() => {
                                      if (!included) return;
                                      toggleRefineChip(chip.chip_id);
                                    }}
                                    style={refineChip(selected, included)}
                                  >
                                    <div style={{ fontWeight: 900 }}>
                                      {chip.code_number} • {chip.code_name}
                                      {chip.count > 1 ? ` ×${chip.count}` : ""}
                                    </div>
                                    {selected ? (
                                      <div style={{ fontSize: 10, fontWeight: 900, color: "rgba(96,165,250,0.95)", marginTop: 4 }}>
                                        Refined
                                      </div>
                                    ) : null}
                                    {chip.notes?.length ? (
                                      <div style={{ fontSize: 10, opacity: 0.8, marginTop: 4 }}>
                                        {chip.notes.slice(0, 3).map((note, idx) => (
                                          <div key={`${chip.chip_id}-note-${idx}`}>• {note}</div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4 }}>No notes</div>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    <div style={{ fontWeight: 900, fontSize: 12 }}>New deductions</div>
                    <button
                      style={btnGhost()}
                      onClick={() => {
                        setRefineActiveStudentId(student.student_id);
                        addRefineEmptyDeduction(student.student_id);
                      }}
                    >
                      Add new deduction (Space/N)
                    </button>
                    {(refineNewByStudent[student.student_id] ?? []).length ? (
                      <div style={{ display: "grid", gap: 8 }}>
                        {(refineNewByStudent[student.student_id] ?? []).map((row, idx) => {
                          const includedSections = Object.entries(refineSectionInclude)
                            .filter(([key, included]) => included && key.startsWith(`${student.student_id}:`))
                            .map(([key]) => key.split(":"))
                            .map((parts) => ({ formId: parts[1], section: Number(parts[2]) }))
                            .filter((entry) => Number.isFinite(entry.section));
                          const availableFormIds = Array.from(new Set(includedSections.map((entry) => entry.formId)));
                          const allowedFormIds = availableFormIds.length ? availableFormIds : forms.map((f) => f.id);
                          const selectedFormId = row.taolu_form_id && allowedFormIds.includes(row.taolu_form_id)
                            ? row.taolu_form_id
                            : allowedFormIds[0] ?? "";
                          const sectionsForForm = includedSections
                            .filter((entry) => entry.formId === selectedFormId)
                            .map((entry) => entry.section)
                            .sort((a, b) => a - b);
                          const fallbackSections = selectedFormId
                            ? Array.from(
                                { length: forms.find((f) => f.id === selectedFormId)?.sections_count ?? 0 },
                                (_, i) => i + 1
                              )
                            : [];
                          const sectionOptions = sectionsForForm.length ? sectionsForForm : fallbackSections;
                          const selectedSection = row.section_number && sectionOptions.includes(Number(row.section_number))
                            ? Number(row.section_number)
                            : sectionOptions[0] ?? null;
                          const isInvalid = !row.taolu_form_id || !row.code_id || !row.section_number;
                          return (
                            <div key={`${student.student_id}-new-${idx}`} style={refineNewChip()}>
                              <div style={{ fontWeight: 900, fontSize: 11 }}>
                                Add deduction {isInvalid ? "• Unfilled" : ""}
                              </div>
                              <div style={{ display: "grid", gap: 6, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
                                <select
                                  value={selectedFormId}
                                  onChange={(e) =>
                                    setRefineNewByStudent((prev) => ({
                                      ...prev,
                                      [student.student_id]: (prev[student.student_id] ?? []).map((item, i) =>
                                        i === idx ? { ...item, taolu_form_id: e.target.value, section_number: null } : item
                                      ),
                                    }))
                                  }
                                  style={input()}
                                >
                                  <option value="">Select form</option>
                                  {forms.filter((f) => allowedFormIds.includes(f.id)).map((f) => (
                                    <option key={f.id} value={f.id}>{f.name}</option>
                                  ))}
                                </select>
                                <div style={{ display: "grid", gap: 4 }}>
                                  <div style={{ fontSize: 10, opacity: 0.7, fontWeight: 900 }}>Section</div>
                                  <div style={sectionChipRow()}>
                                    {sectionOptions.map((sec) => (
                                      <button
                                        key={`${selectedFormId}-sec-${sec}`}
                                        type="button"
                                        onClick={() =>
                                          setRefineNewByStudent((prev) => ({
                                            ...prev,
                                            [student.student_id]: (prev[student.student_id] ?? []).map((item, i) =>
                                              i === idx ? { ...item, section_number: sec } : item
                                            ),
                                          }))
                                        }
                                        style={sectionChip(selectedSection === sec)}
                                      >
                                        {sec}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <select
                                  value={row.code_id ?? ""}
                                  onChange={(e) =>
                                    setRefineNewByStudent((prev) => ({
                                      ...prev,
                                      [student.student_id]: (prev[student.student_id] ?? []).map((item, i) =>
                                        i === idx ? { ...item, code_id: e.target.value } : item
                                      ),
                                    }))
                                  }
                                  style={input()}
                                >
                                  <option value="">Code</option>
                                  {codes.map((c) => (
                                    <option key={c.id} value={c.id}>{c.code_number} • {c.name}</option>
                                  ))}
                                </select>
                                <input
                                  value={row.note ?? ""}
                                  onChange={(e) =>
                                    setRefineNewByStudent((prev) => ({
                                      ...prev,
                                      [student.student_id]: (prev[student.student_id] ?? []).map((item, i) =>
                                        i === idx ? { ...item, note: e.target.value } : item
                                      ),
                                    }))
                                  }
                                  placeholder="Note (optional)"
                                  style={input()}
                                />
                              </div>
                              <button
                                style={removeMiniBtn()}
                                onClick={() =>
                                  setRefineNewByStudent((prev) => ({
                                    ...prev,
                                    [student.student_id]: (prev[student.student_id] ?? []).filter((_, i) => i !== idx),
                                  }))
                                }
                              >
                                Remove
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        ) : null}
        <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 900 }}>Refine Past Sessions</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Single-session refinement can be done once and awards +1 per fixed deduction.
          </div>
          <input
            value={finishedHistorySearch}
            onChange={(e) => setFinishedHistorySearch(e.target.value)}
            placeholder="Search by student or form"
            style={input()}
          />
          {finishedHistoryLoading ? (
            <div style={{ fontSize: 12, opacity: 0.7 }}>Loading finished sessions...</div>
          ) : null}
          <div className="refine-history-grid" style={{ maxHeight: 320, overflowY: "auto", display: "grid", gap: 10 }}>
            {finishedHistory
              .filter((row) => {
                const q = finishedHistorySearch.trim().toLowerCase();
                if (!q) return true;
                return (
                  row.student_name.toLowerCase().includes(q) ||
                  row.form_name.toLowerCase().includes(q)
                );
              })
              .slice(0, 200)
              .map((row) => {
                const refined = !!row.remediation_completed;
                return (
                  <div key={row.session_id} style={refineLogCard(refined)}>
                    <div>
                      <div style={{ fontWeight: 900 }}>
                        {row.student_name} • {row.form_name}
                      </div>
                      <div style={{ fontSize: 11, opacity: 0.7 }}>
                        {row.ended_at ? new Date(row.ended_at).toLocaleDateString() : "No end date"} • Deductions {row.deductions_count}
                      </div>
                      <div style={{ fontSize: 11, opacity: 0.65 }}>
                        Sections {row.sections?.length ? row.sections.join(", ") : "—"} • Score {row.points_earned}
                      </div>
                      <div style={{ fontSize: 11, opacity: 0.65 }}>
                        Codes {row.deduction_samples?.length ? row.deduction_samples.join(", ") : "—"}
                        {row.deductions_count > (row.deduction_samples?.length ?? 0) ? " • more" : ""}
                      </div>
                      {refined ? (
                        <div style={{ fontSize: 11, fontWeight: 900, color: "rgba(96,165,250,0.95)" }}>
                          Refined +{row.remediation_points ?? 0} pts
                        </div>
                      ) : null}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                      {refined ? (
                        <div style={{ fontSize: 10, fontWeight: 900, color: "rgba(34,197,94,0.9)" }}>Refined</div>
                      ) : null}
                      <button
                        style={btnGhost()}
                        onClick={() => {
                          if (refined) {
                            setHistoryDetailId(row.session_id);
                          } else {
                            openFinishedFromHistory(row);
                          }
                        }}
                      >
                        {refined ? "See details" : "Refine this one"}
                      </button>
                    </div>
                  </div>
                );
              })}
            {!finishedHistory.length && !finishedHistoryLoading ? (
              <div style={{ fontSize: 12, opacity: 0.7 }}>No finished sessions yet.</div>
            ) : null}
          </div>
        </div>
      </div>
      ) : null}
      {activeTab === "tracker" ? (
      <div style={{ display: "grid", gap: 12 }}>
        <div className="taolu-cards-shell" style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 12 }}>
            {sessions.length ? (
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                {primaryCards.map((s) => {
                  const student = studentById.get(s.student_id);
                  const form = formById.get(s.taolu_form_id);
                  const count = countLiveDeductions(deductionsBySession[s.id] ?? []);
                  const activeSection = activeSectionBySession[s.id] ?? s.sections[0];
                  const flashActive = deductionFlash?.sessionId === s.id;
                  const allSections = form
                    ? Array.from({ length: form.sections_count }, (_, i) => i + 1)
                    : s.sections;
                  const ageLabel = form?.age_group_id
                    ? ageGroups.find((g) => g.id === form.age_group_id)?.name
                    : "";
                  return (
                    <div
                      key={s.id}
                      onClick={() => setActiveSessionId(s.id)}
                      style={sessionCard(activeSessionId === s.id)}
                    >
                      <div style={taoluParticles(activeSessionId === s.id)} />
                      {student?.card_plate_url ? (
                        <img src={student.card_plate_url} alt="" style={cardPlateStyle(plateOffsets)} />
                      ) : null}
                      {flashActive ? <div style={deductionFlashLayer()} /> : null}
                      <div style={sessionBody()}>
                        <div style={{ fontWeight: 1000, fontSize: 18 }}>{student?.name ?? "Student"}</div>
                        <div style={{ opacity: 0.85, fontSize: 14, fontWeight: 900 }}>{form?.name ?? "Taolu"}</div>
                        {ageLabel ? (
                          <div style={{ opacity: 0.7, fontSize: 12, fontWeight: 800 }}>{ageLabel}</div>
                        ) : null}
                        <div style={{ marginTop: 6, fontSize: 13, fontWeight: 900 }}>Sections: {s.sections.join(", ")}</div>
                        {allSections.length ? (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                            {allSections.map((sec) => {
                              const selected = s.sections.includes(sec);
                              return (
                                <button
                                  key={sec}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (selected && s.sections.length === 1) return;
                                    const next = selected
                                      ? s.sections.filter((x) => x !== sec)
                                      : [...s.sections, sec];
                                    const sorted = [...next].sort((a, b) => a - b);
                                    updateSessionSections(s.id, sorted);
                                    activeSectionRef.current = { ...activeSectionRef.current, [s.id]: sec };
                                    setActiveSectionBySession((prev) => ({ ...prev, [s.id]: sec }));
                                  }}
                                  style={{
                                    ...pill(selected),
                                    boxShadow: activeSection === sec ? "0 0 0 2px rgba(59,130,246,0.6)" : "none",
                                  }}
                                >
                                  Sec {sec}
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                        <div style={{ marginTop: 10, fontWeight: 900 }}>Deductions: {count}</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              finishSession(s.id);
                            }}
                            style={btnGhost()}
                          >
                            Finish
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              closeSession(s.id);
                            }}
                            style={btnGhost()}
                          >
                            ✕ Close
                          </button>
                        </div>
                        {activeSessionId === s.id ? (
                          <div style={{ marginTop: 8, fontSize: 12, fontWeight: 900, color: "rgba(59,130,246,0.9)" }}>
                            Press space to log a deduction
                          </div>
                        ) : null}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenSessionId(s.id);
                            loadDeductions(s.id);
                            loadCodeCounts(s.student_id);
                          }}
                          style={btnGhost()}
                        >
                          Assign Codes
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ opacity: 0.7 }}>No active cards yet.</div>
            )}
          </div>
          <div style={sideList()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ fontWeight: 1000, fontSize: 12, opacity: 0.85 }}>Next Up</div>
              <button
                onClick={clearOverflow}
                style={{
                  padding: "4px 8px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.08)",
                  color: "white",
                  fontWeight: 900,
                  fontSize: 10,
                  cursor: "pointer",
                }}
              >
                Clear All
              </button>
            </div>
            {overflowCards.map((s) => {
              const student = studentById.get(s.student_id);
              return (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={() => moveSessionToFront(s.id)}
                    style={{ ...sideItem(), flex: 1 }}
                  >
                    {student?.name ?? "Student"}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeSession(s.id);
                    }}
                    style={{
                      padding: "6px 8px",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(239,68,68,0.18)",
                      color: "white",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
            {!overflowCards.length && <div style={{ opacity: 0.6, fontSize: 12 }}>No overflow</div>}
          </div>
        </div>

        <div style={finishedBar()}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontWeight: 1000, fontSize: 12, opacity: 0.85 }}>Finished Log</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button style={pill(finishedWindow === "7d")} onClick={() => setFinishedWindow("7d")}>7d</button>
              <button style={pill(finishedWindow === "30d")} onClick={() => setFinishedWindow("30d")}>30d</button>
              <button style={pill(finishedWindow === "90d")} onClick={() => setFinishedWindow("90d")}>3mo</button>
              <button style={pill(finishedWindow === "all")} onClick={() => setFinishedWindow("all")}>All</button>
            </div>
          </div>
          <div style={finishedRow()}>
            {filteredFinishedSessions.map((s) => {
              const student = studentById.get(s.student_id);
              const form = formById.get(s.taolu_form_id);
              const liveCount = countLiveDeductions(s.deductions);
              const pointsLost = pointsLostFromDeductions(liveCount);
              const pointsEarned = pointsEarnedFromDeductions(liveCount);
              const remediation = remediationBySession[s.session_id];
              const remediationPoints = remediation?.points_awarded ?? s.remediation_points ?? 0;
              const isRemediated = !!remediation || !!s.remediation_completed;
              const statusLabel = isRemediated ? "Refined" : "Complete";
              return (
                <button
                  key={s.session_id}
                  onClick={() => {
                    setOpenSessionId(s.session_id);
                    loadDeductions(s.session_id);
                    loadCodeCounts(s.student_id);
                    loadRemediation(s.session_id);
                  }}
                  style={finishedCard(isRemediated)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div style={{ fontWeight: 1000, fontSize: 16 }}>{student?.name ?? "Student"}</div>
                    <div style={statusChip(isRemediated)}>{statusLabel}</div>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>{form?.name ?? "Taolu"}</div>
                  <div style={{ display: "grid", gap: 4, fontSize: 12 }}>
                    <div>Deductions: {liveCount}</div>
                    <div>Points lost: {pointsLost}</div>
                    <div>Score: {pointsEarned}</div>
                    {remediationPoints ? <div>Refinement +{remediationPoints}</div> : null}
                  </div>
                </button>
              );
            })}
            {!filteredFinishedSessions.length && <div style={{ opacity: 0.6, fontSize: 12 }}>No finished sessions</div>}
          </div>
        </div>
      </div>
      ) : null}

      {openSessionId ? (
        <Overlay title="Review Deductions" maxWidth={1280} onClose={() => setOpenSessionId(null)}>
          {openFinishedSession && activeTab === "refinement" ? (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ fontWeight: 1000 }}>Refinement Session</div>
                <button
                  style={pill(refineListeningStudentId === openFinishedSession.student_id)}
                  onClick={() =>
                    setRefineListeningStudentId((prev) =>
                      prev === openFinishedSession.student_id ? null : openFinishedSession.student_id
                    )
                  }
                >
                  {refineListeningStudentId === openFinishedSession.student_id ? "Tracking" : "Track new deductions"}
                </button>
              </div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Tap chips to mark refined deductions. Each refined deduction earns +1 point.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(deductionsBySession[openFinishedSession.session_id] ?? [])
                  .filter((d) => !d.voided)
                  .map((d, idx) => {
                    const code = codeById.get(d.code_id ?? "");
                    const label = code ? `${code.code_number} ${code.name}` : `Deduction ${idx + 1}`;
                    const selected = (remediationSelections[openFinishedSession.session_id] ?? []).includes(d.id);
                    const completed = !!remediationBySession[openFinishedSession.session_id];
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          if (completed) return;
                          toggleRemediationSelection(openFinishedSession.session_id, d.id);
                        }}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 999,
                          border: selected
                            ? "1px solid rgba(59,130,246,0.7)"
                            : "1px solid rgba(255,255,255,0.18)",
                          background: selected ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.06)",
                          color: "white",
                          fontWeight: 900,
                          fontSize: 11,
                          cursor: completed ? "default" : "pointer",
                          opacity: completed && !selected ? 0.6 : 1,
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
              </div>
              <div style={{ display: "grid", gap: 8, maxHeight: 360, overflowY: "auto" }}>
                {(deductionsBySession[openFinishedSession.session_id] ?? []).filter((d) => !d.voided).map((d, idx) => {
                  const code = codeById.get(d.code_id ?? "");
                  const selected = (remediationSelections[openFinishedSession.session_id] ?? []).includes(d.id);
                  return (
                    <div key={d.id} style={refineDetailRow()}>
                      <div style={{ fontWeight: 900, fontSize: 12, color: selected ? "rgba(96,165,250,0.95)" : "white" }}>
                        {code ? `${code.code_number} ${code.name}` : `Deduction ${idx + 1}`}
                      </div>
                      {code?.description ? (
                        <div style={{ fontSize: 11, opacity: 0.7 }}>{code.description}</div>
                      ) : null}
                      <div style={{ fontSize: 11, opacity: 0.7 }}>Section {d.section_number ?? "—"}</div>
                      {d.note ? <div style={{ fontSize: 11, opacity: 0.7 }}>{d.note}</div> : null}
                      {selected ? (
                        <div style={{ fontSize: 10, fontWeight: 900, color: "rgba(96,165,250,0.95)" }}>Refined</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              {!remediationBySession[openFinishedSession.session_id] ? (
                <button
                  style={btn()}
                  disabled={remediationBusy}
                  onClick={() => submitRemediation(openFinishedSession.session_id)}
                >
                  {remediationBusy
                    ? "Submitting..."
                    : `Submit Refinement (+${(remediationSelections[openFinishedSession.session_id] ?? []).length} pts)`}
                </button>
              ) : (
                <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(96,165,250,0.95)" }}>
                  Refined • +{remediationBySession[openFinishedSession.session_id]?.points_awarded ?? 0} pts
                </div>
              )}
            </div>
          ) : openFinishedSession ? (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ fontWeight: 1000 }}>Refinement + Edit Deductions</div>
                <button
                  style={pill(refineListeningStudentId === openFinishedSession.student_id)}
                  onClick={() =>
                    setRefineListeningStudentId((prev) =>
                      prev === openFinishedSession.student_id ? null : openFinishedSession.student_id
                    )
                  }
                >
                  {refineListeningStudentId === openFinishedSession.student_id ? "Tracking" : "Track new deductions"}
                </button>
              </div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Tap chips to mark refined. You can still edit deductions in this session.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(deductionsBySession[openFinishedSession.session_id] ?? [])
                  .filter((d) => !d.voided)
                  .map((d, idx) => {
                    const code = codeById.get(d.code_id ?? "");
                    const label = code ? `${code.code_number} ${code.name}` : `Deduction ${idx + 1}`;
                    const selected = (remediationSelections[openFinishedSession.session_id] ?? []).includes(d.id);
                    const completed = !!remediationBySession[openFinishedSession.session_id];
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          if (completed) return;
                          toggleRemediationSelection(openFinishedSession.session_id, d.id);
                        }}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 999,
                          border: selected
                            ? "1px solid rgba(59,130,246,0.7)"
                            : "1px solid rgba(255,255,255,0.18)",
                          background: selected ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.06)",
                          color: "white",
                          fontWeight: 900,
                          fontSize: 11,
                          cursor: completed ? "default" : "pointer",
                          opacity: completed && !selected ? 0.6 : 1,
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
              </div>
              <div style={{ display: "grid", gap: 10, maxHeight: 420, overflowY: "auto" }}>
                {(deductionsBySession[openFinishedSession.session_id] ?? []).map((d, idx, list) => {
                  const code = codeById.get(d.code_id ?? "");
                  const searchValue = codeSearchByDeduction[d.id] ?? (code ? codeLabel(code) : "");
                  const matches = filterCodes(searchValue);
                  return (
                    <div key={d.id} style={refineEditCard()}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ fontWeight: 900, fontSize: 12 }}>
                          {code ? `${code.code_number} ${code.name}` : `Deduction ${idx + 1}`}
                        </div>
                        <div style={{ fontSize: 10, opacity: 0.7 }}>
                          {idx + 1}/{list.length}
                        </div>
                      </div>
                      {code?.description ? (
                        <div style={{ fontSize: 11, opacity: 0.7 }}>{code.description}</div>
                      ) : null}
                      <div style={{ display: "grid", gap: 6, gridTemplateColumns: "minmax(0, 1fr) minmax(0, 140px)" }}>
                        <div style={field()}>
                          <div style={fieldLabel()}>Deduction Code</div>
                          <input
                            value={searchValue}
                            onChange={(e) =>
                              setCodeSearchByDeduction((prev) => ({ ...prev, [d.id]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key !== "Enter") return;
                              const match = matches[0];
                              if (!match) return;
                              updateDeduction(d.id, { code_id: match.id });
                              setCodeSearchByDeduction((prev) => ({ ...prev, [d.id]: codeLabel(match) }));
                            }}
                            placeholder="Search by code or name"
                            style={fieldInput()}
                          />
                          {matches.length ? (
                            <div style={codeSuggestionRow()}>
                              {matches.map((match) => (
                                <button
                                  key={match.id}
                                  type="button"
                                  onClick={() => {
                                    updateDeduction(d.id, { code_id: match.id });
                                    setCodeSearchByDeduction((prev) => ({ ...prev, [d.id]: codeLabel(match) }));
                                  }}
                                  style={codeSuggestionChip(match.id === d.code_id)}
                                >
                                  {match.code_number} • {match.name}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div style={field()}>
                          <div style={fieldLabel()}>Section</div>
                          <div style={sectionChipRow()}>
                            {(openFinishedSession.sections ?? []).map((sec) => (
                              <button
                                key={sec}
                                type="button"
                                onClick={() => updateDeduction(d.id, { section_number: sec })}
                                style={sectionChip(d.section_number === sec)}
                              >
                                {sec}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div style={field()}>
                        <div style={fieldLabel()}>Coach Note</div>
                        <input
                          value={d.note ?? ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            setDeductionsBySession((prev) => {
                              const list = (prev[openSessionId] ?? []).map((row) =>
                                row.id === d.id ? { ...row, note: value } : row
                              );
                              return { ...prev, [openSessionId]: list };
                            });
                          }}
                          onBlur={(e) => updateDeduction(d.id, { note: e.target.value || null })}
                          placeholder="Add detail for review report"
                          style={fieldInput()}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              {!remediationBySession[openFinishedSession.session_id] ? (
                <button
                  style={btn()}
                  disabled={remediationBusy}
                  onClick={() => submitRemediation(openFinishedSession.session_id)}
                >
                  {remediationBusy
                    ? "Submitting..."
                    : `Submit Refinement (+${(remediationSelections[openFinishedSession.session_id] ?? []).length} pts)`}
                </button>
              ) : (
                <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(96,165,250,0.95)" }}>
                  Refined • +{remediationBySession[openFinishedSession.session_id]?.points_awarded ?? 0} pts
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
            <div style={overlayActionBar()}>
              <button
                type="button"
                style={overlayActionButton()}
                onClick={() => {
                  const list = deductionsBySession[openSessionId] ?? [];
                  if (!list.length) return;
                  const unfilled = list
                    .map((d, idx) => ({ d, idx }))
                    .filter(({ d }) => !d.code_id || !d.section_number);
                  if (!unfilled.length) return;
                  const startIdx = jumpIndexRef.current;
                  const next = unfilled.find((row) => row.idx > startIdx) ?? unfilled[0];
                  jumpIndexRef.current = next.idx;
                  const el = deductionRefs.current[next.d.id];
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
              >
                Next unfilled
              </button>
            </div>
            <div style={{ maxHeight: 420, overflowY: "auto", display: "grid", gap: 10 }}>
              {(deductionsBySession[openSessionId] ?? []).map((d, idx, list) => {
              const code = codeById.get(d.code_id ?? "");
              const session = sessions.find((s) => s.id === openSessionId) || finishedSessions.find((s) => s.session_id === openSessionId);
              const studentId = session ? session.student_id : "";
              const pastCount = studentId
                ? Number(codeCountsByStudent[studentId]?.[String(d.code_id ?? "")] ?? 0)
                : 0;
              const deductionValue = d.voided ? 0 : TAOLU_DEDUCTION_POINTS;
              const searchValue = codeSearchByDeduction[d.id] ?? (code ? codeLabel(code) : "");
              const matches = filterCodes(searchValue);
              return (
                <div
                  key={d.id}
                  ref={(el) => {
                    deductionRefs.current[d.id] = el;
                  }}
                  style={deductionRow()}
                >
                  <div style={deductionHeader()}>
                    <div style={deductionTime()}>{new Date(d.occurred_at).toLocaleTimeString()}</div>
                    <div style={deductionCount()}>
                      {idx + 1} / {list.length}
                    </div>
                    <div style={deductionBadge()}>
                      {code ? `${code.code_number} ${code.name}` : "Unassigned"}
                    </div>
                    <div style={deductionValueBadge()}>
                      {d.voided ? "0" : `-${deductionValue}`}
                    </div>
                  </div>
                  <div style={deductionGrid()}>
                    <div style={field()}>
                      <div style={fieldLabel()}>Deduction Code</div>
                      <input
                        value={searchValue}
                        onChange={(e) =>
                          setCodeSearchByDeduction((prev) => ({ ...prev, [d.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          const match = matches[0];
                          if (!match) return;
                          updateDeduction(d.id, { code_id: match.id });
                          setCodeSearchByDeduction((prev) => ({ ...prev, [d.id]: codeLabel(match) }));
                        }}
                        placeholder="Search by code or name"
                        style={fieldInput()}
                      />
                      {matches.length ? (
                        <div style={codeSuggestionRow()}>
                          {matches.map((match) => (
                            <button
                              key={match.id}
                              type="button"
                              onClick={() => {
                                updateDeduction(d.id, { code_id: match.id });
                                setCodeSearchByDeduction((prev) => ({ ...prev, [d.id]: codeLabel(match) }));
                              }}
                              style={codeSuggestionChip(match.id === d.code_id)}
                            >
                              {match.code_number} • {match.name}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div style={field()}>
                      <div style={fieldLabel()}>Section</div>
                      <div style={sectionChipRow()}>
                        {(session?.sections ?? []).map((sec) => (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => updateDeduction(d.id, { section_number: sec })}
                            style={sectionChip(d.section_number === sec)}
                          >
                            {sec}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={field(2)}>
                      <div style={fieldLabel()}>Coach Note</div>
                      <input
                        value={d.note ?? ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          setDeductionsBySession((prev) => {
                            const list = (prev[openSessionId] ?? []).map((row) =>
                              row.id === d.id ? { ...row, note: value } : row
                            );
                            return { ...prev, [openSessionId]: list };
                          });
                        }}
                        onBlur={(e) => updateDeduction(d.id, { note: e.target.value || null })}
                        placeholder="Add detail for review report"
                        style={fieldInput()}
                      />
                    </div>
                  </div>
                  <div style={deductionFooter()}>
                    <button type="button" style={overlayActionButton()} onClick={() => removeDeduction(d)}>
                      Remove deduction
                    </button>
                    <label style={voidToggle()}>
                      <input
                        type="checkbox"
                        checked={!!d.voided}
                        onChange={(e) => updateDeduction(d.id, { voided: e.target.checked })}
                      />
                      Void deduction
                    </label>
                    <div style={deductionMeta()}>Past count: {pastCount}</div>
                    <div style={deductionMeta()}>
                      {d.voided ? "0 pts" : `-${deductionValue} pts`}
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
            {!deductionsBySession[openSessionId]?.length ? (
              <div style={{ opacity: 0.7 }}>No deductions yet.</div>
            ) : null}
            {deductionsBySession[openSessionId]?.length ? (
              <div style={{ marginTop: 8, fontWeight: 900 }}>
                Total deductions: {countLiveDeductions(deductionsBySession[openSessionId] ?? [])} •
                Total points lost: {pointsLostFromDeductions(countLiveDeductions(deductionsBySession[openSessionId] ?? []))} •
                Score: {pointsEarnedFromDeductions(countLiveDeductions(deductionsBySession[openSessionId] ?? []))}
              </div>
            ) : null}
            {openFinishedSession ? (
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                <div style={{ fontWeight: 1000 }}>Refinement Round</div>
                {remediationBySession[openFinishedSession.session_id] ? (
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    Refinement Round complete • +{remediationBySession[openFinishedSession.session_id].points_awarded} pts
                  </div>
                ) : (
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    Select which deductions were fixed. Each selected chip earns +1 point.
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {(deductionsBySession[openFinishedSession.session_id] ?? [])
                    .filter((d) => !d.voided)
                    .map((d, idx) => {
                      const code = codeById.get(d.code_id ?? "");
                      const label = code ? `${code.code_number} ${code.name}` : `Deduction ${idx + 1}`;
                      const selected = (remediationSelections[openFinishedSession.session_id] ?? []).includes(d.id);
                      const completed = !!remediationBySession[openFinishedSession.session_id];
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => {
                            if (completed) return;
                            toggleRemediationSelection(openFinishedSession.session_id, d.id);
                          }}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 999,
                            border: selected
                              ? "1px solid rgba(34,197,94,0.6)"
                              : "1px solid rgba(255,255,255,0.18)",
                            background: selected ? "rgba(34,197,94,0.22)" : "rgba(255,255,255,0.06)",
                            color: "white",
                            fontWeight: 900,
                            fontSize: 11,
                            cursor: completed ? "default" : "pointer",
                            opacity: completed && !selected ? 0.6 : 1,
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                </div>
                {!remediationBySession[openFinishedSession.session_id] ? (
                  <button
                    style={btn()}
                    disabled={remediationBusy}
                    onClick={() => submitRemediation(openFinishedSession.session_id)}
                  >
                    {remediationBusy
                      ? "Submitting..."
                      : `Submit Refinement (+${(remediationSelections[openFinishedSession.session_id] ?? []).length} pts)`}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          )}
        </Overlay>
      ) : null}
      {historyDetailId ? (
        <Overlay title="Refined Session" maxWidth={720} onClose={() => setHistoryDetailId(null)}>
          {(() => {
            const row = finishedHistory.find((r) => r.session_id === historyDetailId);
            const list = (deductionsBySession[historyDetailId] ?? []).filter((d) => !d.voided);
            const remediation = remediationBySession[historyDetailId];
            return (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ fontWeight: 1000 }}>
                  {row?.student_name ?? "Student"} • {row?.form_name ?? "Taolu"}
                </div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {row?.ended_at ? new Date(row.ended_at).toLocaleDateString() : "No end date"} • Sections{" "}
                  {row?.sections?.length ? row.sections.join(", ") : "—"}
                </div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Deductions {row?.deductions_count ?? list.length} • Score {row?.points_earned ?? 0}
                </div>
                {remediation ? (
                  <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(34,197,94,0.9)" }}>
                    Refined • +{remediation.points_awarded} pts
                  </div>
                ) : null}
                <div style={{ display: "grid", gap: 8, maxHeight: 320, overflowY: "auto" }}>
                  {list.map((d, idx) => {
                    const code = codeById.get(d.code_id ?? "");
                    const refined = remediation?.deduction_ids?.includes?.(d.id);
                    return (
                      <div key={d.id} style={refineDetailRow()}>
                        <div style={{ fontWeight: 900, fontSize: 12, color: refined ? "rgba(96,165,250,0.95)" : "white" }}>
                          {code ? `${code.code_number} ${code.name}` : `Deduction ${idx + 1}`}
                        </div>
                        <div style={{ fontSize: 11, opacity: 0.75 }}>Section {d.section_number ?? "—"}</div>
                        {refined ? (
                          <div style={{ fontSize: 10, fontWeight: 900, color: "rgba(96,165,250,0.95)" }}>Refined</div>
                        ) : null}
                        {d.note ? <div style={{ fontSize: 11, opacity: 0.7 }}>{d.note}</div> : null}
                      </div>
                    );
                  })}
                  {!list.length ? <div style={{ fontSize: 12, opacity: 0.7 }}>No deductions found.</div> : null}
                </div>
              </div>
            );
          })()}
        </Overlay>
      ) : null}
      <style>{`
        @keyframes taoluBorderDrift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes taoluDeductFlash {
          0% { opacity: 0; transform: scale(0.98); }
          30% { opacity: 1; transform: scale(1.02); }
          100% { opacity: 0; transform: scale(1.05); }
        }
        .taolu-cards-shell {
          grid-template-columns: minmax(0, 1fr) minmax(220px, 260px);
          align-items: start;
        }
        .refine-history-grid {
          grid-template-columns: repeat(5, minmax(0, 1fr));
        }
        @media (max-width: 960px) {
          .taolu-cards-shell {
            grid-template-columns: minmax(0, 1fr);
          }
          .refine-history-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 640px) {
          .refine-history-grid {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>
    </main>
  );
}

function card(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
  };
}

function input(): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.2)",
    color: "white",
    fontWeight: 900,
  };
}

function suggestions(): React.CSSProperties {
  return {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  };
}

function suggestionItem(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  };
}

function pill(active: boolean): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: active
      ? "linear-gradient(120deg, rgba(34,197,94,0.32), rgba(34,197,94,0.12))"
      : "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  };
}

function btn(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(59,130,246,0.35)",
    background: "rgba(59,130,246,0.25)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    width: "fit-content",
  };
}

function miniCard(): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.24)",
    maxWidth: 360,
  };
}

function chip(): React.CSSProperties {
  return {
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.08)",
    fontSize: 11,
    fontWeight: 900,
  };
}

function refineCard(active = false): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 14,
    border: active ? "2px solid rgba(59,130,246,0.7)" : "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.2)",
    display: "grid",
    gap: 10,
  };
}

function refineSection(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    display: "grid",
    gap: 8,
  };
}

function refineChipRow(): React.CSSProperties {
  return {
    display: "grid",
    gap: 8,
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  };
}

function refineChip(selected: boolean, enabled: boolean): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 14,
    border: selected ? "1px solid rgba(59,130,246,0.7)" : "1px solid rgba(255,255,255,0.2)",
    background: selected ? "rgba(59,130,246,0.18)" : "rgba(255,255,255,0.06)",
    color: "white",
    textAlign: "left",
    opacity: enabled ? 1 : 0.5,
    cursor: enabled ? "pointer" : "not-allowed",
  };
}

function refineNewChip(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: "8px 10px",
    border: "1px solid rgba(248,113,113,0.6)",
    background: "rgba(248,113,113,0.12)",
    boxShadow: "0 0 12px rgba(248,113,113,0.25)",
    display: "grid",
    gap: 4,
  };
}

function refineLogCard(refined: boolean): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 12,
    border: refined ? "1px solid rgba(34,197,94,0.45)" : "1px solid rgba(255,255,255,0.12)",
    background: refined ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.04)",
    display: "grid",
    gap: 8,
  };
}

function refineDetailRow(): React.CSSProperties {
  return {
    borderRadius: 10,
    padding: "8px 10px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    display: "grid",
    gap: 4,
  };
}

function refineEditCard(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.45)",
    display: "grid",
    gap: 8,
  };
}

function removeMiniBtn(): React.CSSProperties {
  return {
    justifySelf: "start",
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(248,113,113,0.5)",
    background: "rgba(248,113,113,0.18)",
    color: "white",
    fontWeight: 900,
    fontSize: 10,
    cursor: "pointer",
  };
}

function btnGhost(): React.CSSProperties {
  return {
    marginTop: 10,
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    width: "fit-content",
  };
}

function sessionBody(): React.CSSProperties {
  return {
    position: "relative",
    zIndex: 2,
    display: "grid",
    gap: 4,
  };
}

function sessionCard(active: boolean): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 12,
    border: active ? "2px solid rgba(59,130,246,0.6)" : "1px solid rgba(255,255,255,0.18)",
    background: active
      ? "linear-gradient(140deg, rgba(59,130,246,0.28), rgba(14,116,144,0.12))"
      : "linear-gradient(140deg, rgba(16,185,129,0.08), rgba(255,255,255,0.02))",
    boxShadow: active
      ? "0 16px 30px rgba(15,23,42,0.45), inset 0 0 0 1px rgba(255,255,255,0.06)"
      : "0 10px 22px rgba(15,23,42,0.35)",
    position: "relative",
    overflow: "visible",
    display: "grid",
    gap: 4,
    cursor: "pointer",
  };
}

function taoluParticles(active: boolean): React.CSSProperties {
  return {
    position: "absolute",
    inset: -8,
    borderRadius: 22,
    backgroundImage:
      "radial-gradient(circle at 20% 15%, rgba(59,130,246,0.35), transparent 55%), radial-gradient(circle at 80% 20%, rgba(34,197,94,0.35), transparent 50%), radial-gradient(circle at 15% 80%, rgba(14,165,233,0.28), transparent 60%), radial-gradient(circle at 85% 85%, rgba(236,72,153,0.25), transparent 55%)",
    opacity: active ? 0.75 : 0.5,
    filter: "blur(0.4px)",
    animation: "taoluBorderDrift 8s linear infinite",
    pointerEvents: "none",
    zIndex: 0,
    mixBlendMode: "screen",
  };
}

function deductionFlashLayer(): React.CSSProperties {
  return {
    position: "absolute",
    inset: -2,
    borderRadius: 18,
    border: "2px solid rgba(239,68,68,0.9)",
    boxShadow: "0 0 18px rgba(239,68,68,0.65), 0 0 36px rgba(239,68,68,0.45)",
    animation: "taoluDeductFlash 0.7s ease",
    pointerEvents: "none",
    zIndex: 1,
  };
}

function cardPlateStyle(offset: { x: number; y: number; size: number }): React.CSSProperties {
  return {
    position: "absolute",
    top: offset.y,
    left: offset.x,
    width: offset.size,
    height: "auto",
    objectFit: "contain",
    pointerEvents: "none",
    zIndex: 8,
  };
}

function sideList(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    display: "grid",
    gap: 8,
    alignContent: "start",
    maxHeight: 520,
    overflowY: "auto",
  };
}

function sideItem(): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    textAlign: "left",
  };
}

function deductionRow(): React.CSSProperties {
  return {
    display: "grid",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.16)",
    background:
      "linear-gradient(140deg, rgba(15,23,42,0.9), rgba(2,6,23,0.85))",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 12px 28px rgba(0,0,0,0.35)",
  };
}

function deductionHeader(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  };
}

function deductionTime(): React.CSSProperties {
  return {
    fontWeight: 900,
    fontSize: 12,
    letterSpacing: 0.3,
    opacity: 0.85,
  };
}

function deductionCount(): React.CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 900,
    opacity: 0.65,
  };
}

function deductionBadge(): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 900,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.08)",
    opacity: 0.9,
  };
}

function deductionValueBadge(): React.CSSProperties {
  return {
    fontSize: 13,
    fontWeight: 1000,
    padding: "6px 10px",
    borderRadius: 10,
    background: "rgba(239,68,68,0.18)",
    border: "1px solid rgba(239,68,68,0.35)",
  };
}

function deductionGrid(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 0.7fr)",
    gap: 14,
    marginTop: 6,
    marginBottom: 6,
  };
}

function field(span = 1): React.CSSProperties {
  return {
    display: "grid",
    gap: 6,
    gridColumn: span > 1 ? `span ${span}` : undefined,
  };
}

function fieldLabel(): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 0.3,
    textTransform: "uppercase",
    opacity: 0.8,
  };
}

function fieldInput(): React.CSSProperties {
  return {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(59,130,246,0.4)",
    background: "rgba(8,16,30,0.7)",
    color: "white",
    fontWeight: 900,
    fontSize: 14,
    outline: "none",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(34,197,94,0.08)",
  };
}

function codeSuggestionRow(): React.CSSProperties {
  return {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  };
}

function codeSuggestionChip(active: boolean): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: active ? "1px solid rgba(34,197,94,0.6)" : "1px solid rgba(255,255,255,0.18)",
    background: active ? "rgba(34,197,94,0.22)" : "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    fontSize: 11,
    cursor: "pointer",
  };
}

function deductionFooter(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    fontSize: 11,
  };
}

function deductionMeta(): React.CSSProperties {
  return {
    opacity: 0.7,
    fontWeight: 900,
  };
}

function voidToggle(): React.CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    gap: 6,
  };
}

function statsPanel(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(5,10,18,0.7)",
    display: "grid",
    gap: 10,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 16px 32px rgba(0,0,0,0.35)",
    height: 300,
    overflowY: "auto",
  };
}

function statsRow(): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    display: "grid",
    gap: 2,
  };
}

function notice(): React.CSSProperties {
  return {
    padding: 10,
    borderRadius: 14,
    background: "rgba(239,68,68,0.15)",
    border: "1px solid rgba(255,255,255,0.10)",
    fontWeight: 900,
  };
}

function finishedBar(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: "12px 14px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    display: "grid",
    gap: 10,
  };
}

function finishedRow(): React.CSSProperties {
  return {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  };
}

function overlayActionBar(): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "flex-end",
  };
}

function overlayActionButton(): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid rgba(59,130,246,0.5)",
    background: "rgba(59,130,246,0.2)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function sectionChipRow(): React.CSSProperties {
  return {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  };
}

function sectionChip(active: boolean): React.CSSProperties {
  return {
    width: 38,
    height: 38,
    borderRadius: 10,
    border: active ? "1px solid rgba(59,130,246,0.7)" : "1px solid rgba(255,255,255,0.18)",
    background: active ? "rgba(59,130,246,0.28)" : "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function finishedCard(refined: boolean): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 14,
    border: refined ? "1px solid rgba(59,130,246,0.6)" : "1px solid rgba(34,197,94,0.55)",
    background: refined ? "rgba(37,99,235,0.25)" : "rgba(16,185,129,0.18)",
    color: "white",
    display: "grid",
    gap: 8,
    cursor: "pointer",
    boxShadow: refined
      ? "0 10px 30px rgba(37,99,235,0.35)"
      : "0 0 0 1px rgba(16,185,129,0.4), 0 12px 30px rgba(16,185,129,0.28)",
  };
}

function statusChip(refined: boolean): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: refined ? "1px solid rgba(59,130,246,0.6)" : "1px solid rgba(34,197,94,0.55)",
    background: refined ? "rgba(37,99,235,0.35)" : "rgba(16,185,129,0.3)",
    fontWeight: 900,
    fontSize: 11,
    width: "fit-content",
  };
}

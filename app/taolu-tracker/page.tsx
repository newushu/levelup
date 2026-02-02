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
type CodeRow = { id: string; code_number: string; name: string; deduction_amount?: number };
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
  remediation_points?: number;
  remediation_completed?: boolean;
};
type RemediationLog = {
  session_id: string;
  points_awarded: number;
  deduction_ids: string[];
  completed_at: string;
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
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [deductionsBySession, setDeductionsBySession] = useState<Record<string, DeductionRow[]>>({});
  const [activeSectionBySession, setActiveSectionBySession] = useState<Record<string, number>>({});
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

  if (blocked) {
    return (
      <main style={{ display: "grid", gap: 12 }}>
        <div style={{ fontSize: 26, fontWeight: 1000 }}>Taolu Tracker</div>
        <div style={{ opacity: 0.75 }}>
          {viewerRole === "classroom" ? "Classroom mode cannot access Taolu Tracker." : "Student accounts cannot access Taolu Tracker."}
        </div>
      </main>
    );
  }

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
        return next;
      });
      await Promise.all(list.map((s) => loadDeductions(s.id)));
    })();
  }, [blocked]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code !== "Space" || e.repeat) return;
      if (openSessionId) return;
      const activeEl = document.activeElement?.tagName?.toLowerCase();
      if (activeEl === "input" || activeEl === "textarea" || activeEl === "select") return;
      if (!activeSessionId) return;
      e.preventDefault();
      logDeduction(activeSessionId);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeSessionId, openSessionId]);

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
    const section_number = activeSectionBySession[sessionId] ?? null;
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

  async function loadDeductions(sessionId: string) {
    const res = await fetch(`/api/taolu/deductions?session_id=${sessionId}`, { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to load deductions");
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
    if (!selection.length) return;
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

  useEffect(() => {
    if (!openFinishedSession) return;
    loadRemediation(openFinishedSession.session_id);
  }, [openFinishedSession?.session_id]);

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
    if (active) setActiveSectionBySession((prev) => ({ ...prev, [sessionId]: active }));
  }

  return (
    <main style={{ display: "grid", gap: 16, padding: "0 50px" }}>
      <div style={{ fontSize: 26, fontWeight: 1000 }}>Taolu Tracker</div>
      {msg ? <div style={notice()}>{msg}</div> : null}

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
          <div style={{ fontWeight: 1000, fontSize: 12, opacity: 0.85 }}>Finished Log</div>
          <div style={finishedRow()}>
            {finishedSessions.map((s) => {
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
            {!finishedSessions.length && <div style={{ opacity: 0.6, fontSize: 12 }}>No finished sessions</div>}
          </div>
        </div>
      </div>

      {openSessionId ? (
        <Overlay title="Review Deductions" maxWidth={1280} onClose={() => setOpenSessionId(null)}>
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
                    disabled={
                      remediationBusy ||
                      !(remediationSelections[openFinishedSession.session_id] ?? []).length
                    }
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
        @media (max-width: 960px) {
          .taolu-cards-shell {
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

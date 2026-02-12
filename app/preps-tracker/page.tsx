"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AuthGate from "@/components/AuthGate";
import Overlay from "@/components/dashboard/Overlay";

type StudentRow = { id: string; name: string };
type TaoluForm = { id: string; name: string; age_group_id?: string | null; sections_count: number };
type AgeGroup = { id: string; name: string };
type SessionRow = {
  id: string;
  student_id: string;
  taolu_form_id: string;
  created_at: string;
};
type NoteRow = {
  id: string;
  session_id: string;
  occurred_at: string;
  prep_key?: string | null;
  note?: string | null;
};
type FinishedSession = {
  session_id: string;
  student_id: string;
  taolu_form_id: string;
  notes: NoteRow[];
  remediation_points?: number;
  remediation_completed?: boolean;
};
type RemediationLog = {
  session_id: string;
  points_awarded: number;
  note_ids: string[];
  completed_at: string;
};

const PREPS_KEYS = [
  { key: "P", label: "Posture" },
  { key: "R", label: "Rhythm" },
  { key: "E", label: "Eyes" },
  { key: "O", label: "Power" },
  { key: "S", label: "Stances" },
] as const;

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status})` } };
  }
}

export default function PrepsTrackerPage() {
  if (blockedView) return blockedView;
  return (
    <AuthGate>
      <PrepsTrackerInner />
    </AuthGate>
  );
}

function PrepsTrackerInner() {
  const [blocked, setBlocked] = useState(false);
  const [viewerRole, setViewerRole] = useState("coach");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [forms, setForms] = useState<TaoluForm[]>([]);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [selectedAgeGroupId, setSelectedAgeGroupId] = useState("");
  const [selectedFormId, setSelectedFormId] = useState("");
  const [individualStudentId, setIndividualStudentId] = useState("");
  const [groupStudentIds, setGroupStudentIds] = useState<string[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [finishedSessions, setFinishedSessions] = useState<FinishedSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [notesBySession, setNotesBySession] = useState<Record<string, NoteRow[]>>({});
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [remediationBySession, setRemediationBySession] = useState<Record<string, RemediationLog>>({});
  const [remediationSelections, setRemediationSelections] = useState<Record<string, string[]>>({});
  const [remediationBusy, setRemediationBusy] = useState(false);
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
      setAgeGroups((rJson.json?.age_groups ?? []) as AgeGroup[]);
    })();
  }, []);

  useEffect(() => {
    if (blocked) return;
    (async () => {
      const [activeRes, endedRes] = await Promise.all([
        fetch("/api/preps/sessions?status=active", { cache: "no-store" }),
        fetch("/api/preps/sessions?status=ended", { cache: "no-store" }),
      ]);
      const activeJson = await safeJson(activeRes);
      const endedJson = await safeJson(endedRes);
      if (!activeJson.ok) setMsg(activeJson.json?.error || "Failed to load sessions");
      if (!endedJson.ok) setMsg(endedJson.json?.error || "Failed to load history");
      const list = (activeJson.json?.sessions ?? []) as SessionRow[];
      setSessions(list);
      if (list.length) setActiveSessionId(list[0]?.id ?? "");
      await Promise.all(list.map((s) => loadNotes(s.id)));
      const endedList = (endedJson.json?.sessions ?? []) as SessionRow[];
      if (endedList.length) {
        const finished: FinishedSession[] = [];
        for (const s of endedList) {
          const notes = (await loadNotes(s.id)) ?? [];
          finished.push({
            session_id: s.id,
            student_id: s.student_id,
            taolu_form_id: s.taolu_form_id,
            notes,
          });
        }
        setFinishedSessions(finished);
      }
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
      logPrepNote(activeSessionId);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeSessionId, openSessionId]);

  const blockedView = blocked ? (
    <main style={{ display: "grid", gap: 12 }}>
      <div style={{ fontSize: 26, fontWeight: 1000 }}>P.R.E.P.S Tracker</div>
      <div style={{ opacity: 0.75 }}>
        {viewerRole === "classroom" ? "Classroom mode cannot access P.R.E.P.S Tracker." : "Student accounts cannot access P.R.E.P.S Tracker."}
      </div>
    </main>
  ) : null;

  const filteredForms = useMemo(() => {
    if (!selectedAgeGroupId) return forms;
    return forms.filter((f) => String(f.age_group_id ?? "") === selectedAgeGroupId);
  }, [forms, selectedAgeGroupId]);

  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const formById = useMemo(() => new Map(forms.map((f) => [f.id, f])), [forms]);
  const nameSuggestions = useMemo(() => getStudentSuggestions(nameInput, students), [nameInput, students]);
  const groupSuggestions = useMemo(() => getStudentSuggestions(groupNameInput, students), [groupNameInput, students]);
  const selectedIds = addMode === "group" ? groupStudentIds : individualStudentId ? [individualStudentId] : [];
  const selectedStudents = selectedIds.map((id) => studentById.get(id)).filter(Boolean) as StudentRow[];

  async function startTracking(studentIds: string[]) {
    if (!selectedFormId || !studentIds.length) {
      return setMsg("Select an event and at least one student.");
    }
    setMsg("");
    const res = await fetch("/api/preps/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taolu_form_id: selectedFormId, student_ids: studentIds }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to create sessions");
    const newSessions = (sj.json?.sessions ?? []) as SessionRow[];
    setSessions((prev) => {
      const next = [...prev, ...newSessions];
      if (!prev.length && newSessions.length) setActiveSessionId(newSessions[0].id);
      return next;
    });
    setIndividualStudentId("");
    setGroupStudentIds([]);
    setSelectedAgeGroupId("");
    setSelectedFormId("");
    setNameInput("");
    setGroupNameInput("");
  }

  async function logPrepNote(sessionId: string) {
    const res = await fetch("/api/preps/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to log PREPS note");
    const note = sj.json?.note as NoteRow;
    setNotesBySession((prev) => ({ ...prev, [sessionId]: [...(prev[sessionId] ?? []), note] }));
  }

  async function loadNotes(sessionId: string): Promise<NoteRow[]> {
    const res = await fetch(`/api/preps/notes?session_id=${sessionId}`, { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) {
      setMsg(sj.json?.error || "Failed to load notes");
      return [];
    }
    const list = (sj.json?.notes ?? []) as NoteRow[];
    setNotesBySession((prev) => ({ ...prev, [sessionId]: list }));
    return list;
  }

  async function updateNote(noteId: string, updates: { prep_key?: string | null; note?: string | null }) {
    const res = await fetch("/api/preps/notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note_id: noteId, ...updates }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to update note");
    const updated = sj.json?.note as NoteRow;
    setNotesBySession((prev) => {
      const list = (prev[updated.session_id] ?? []).map((n) => (n.id === updated.id ? updated : n));
      return { ...prev, [updated.session_id]: list };
    });
  }

  async function finishSession(sessionId: string) {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;
    await fetch("/api/preps/sessions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    });
    const list = (await loadNotes(sessionId)) ?? notesBySession[sessionId] ?? [];
    setFinishedSessions((prev) => [
      ...prev,
      {
        session_id: sessionId,
        student_id: session.student_id,
        taolu_form_id: session.taolu_form_id,
        notes: list,
      },
    ]);
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== sessionId);
      if (activeSessionId === sessionId) setActiveSessionId(next[0]?.id ?? "");
      return next;
    });
  }

  function toggleRemediationSelection(sessionId: string, noteId: string) {
    setRemediationSelections((prev) => {
      const current = new Set(prev[sessionId] ?? []);
      if (current.has(noteId)) current.delete(noteId);
      else current.add(noteId);
      return { ...prev, [sessionId]: Array.from(current) };
    });
  }

  async function loadRemediation(sessionId: string) {
    const res = await fetch(`/api/preps/remediations?session_id=${sessionId}`, { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return;
    if (sj.json?.remediation) {
      const row = sj.json.remediation as RemediationLog;
      setRemediationBySession((prev) => ({ ...prev, [sessionId]: row }));
      setFinishedSessions((prev) =>
        prev.map((item) =>
          item.session_id === sessionId
            ? { ...item, remediation_points: row.points_awarded, remediation_completed: true }
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
      const res = await fetch("/api/preps/remediations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, note_ids: selection }),
      });
      const sj = await safeJson(res);
      if (!sj.ok) throw new Error(sj.json?.error || "Failed to submit refinement round");
      const remediation = sj.json?.remediation as RemediationLog;
      setRemediationBySession((prev) => ({ ...prev, [sessionId]: remediation }));
      setFinishedSessions((prev) =>
        prev.map((row) =>
          row.session_id === sessionId
            ? { ...row, remediation_points: remediation.points_awarded, remediation_completed: true }
            : row
        )
      );
    } catch (err: any) {
      setMsg(err?.message ?? "Failed to submit refinement round");
    } finally {
      setRemediationBusy(false);
    }
  }

  function addStudentByName(raw: string, target: "individual" | "group") {
    const name = raw.trim().toLowerCase();
    if (!name) return;
    const matches = students.filter((s) => s.name.trim().toLowerCase().includes(name));
    const exact = students.find((s) => s.name.trim().toLowerCase() === name);
    const match = exact ?? matches[0];
    if (!match) return setMsg("Student not found.");
    selectStudent(match, target);
    setMsg("");
  }

  function selectStudent(student: StudentRow, target: "individual" | "group") {
    if (target === "individual") {
      setIndividualStudentId(student.id);
      setNameInput("");
    } else {
      setGroupStudentIds((prev) => (prev.includes(student.id) ? prev : [...prev, student.id]));
      setGroupNameInput("");
    }
  }

  function removeSelectedStudent(id: string) {
    if (addMode === "group") {
      setGroupStudentIds((prev) => prev.filter((sid) => sid !== id));
      return;
    }
    if (individualStudentId === id) {
      setIndividualStudentId("");
    }
  }

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

  useEffect(() => {
    if (!openSessionId) return;
    loadNotes(openSessionId);
  }, [openSessionId]);

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 1000 }}>P.R.E.P.S Tracker</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Posture • Rhythm • Eyes • Power • Stances</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button style={pill(addMode === "individual")} onClick={() => setAddMode("individual")}>
            Individual
          </button>
          <button style={pill(addMode === "group")} onClick={() => setAddMode("group")}>
            Group
          </button>
        </div>
      </div>

      {msg ? <div style={notice()}>{msg}</div> : null}

      <div style={card()}>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <label style={fieldLabel()}>
            Age Group
            <select value={selectedAgeGroupId} onChange={(e) => setSelectedAgeGroupId(e.target.value)} style={input()}>
              <option value="">All ages</option>
              {ageGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label style={fieldLabel()}>
            Form
            <select value={selectedFormId} onChange={(e) => setSelectedFormId(e.target.value)} style={input()}>
              <option value="">Select form</option>
              {filteredForms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          {addMode === "individual" ? (
            <label style={fieldLabel()}>
              Student
              <input
                ref={nameRef}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  if (nameSuggestions.length) selectStudent(nameSuggestions[0], "individual");
                  else addStudentByName(nameInput, "individual");
                }}
                placeholder="Type name + Enter"
                style={input()}
              />
              {nameSuggestions.length ? (
                <div style={suggestionsRow()}>
                  {nameSuggestions.map((s) => (
                    <button key={s.id} type="button" onClick={() => selectStudent(s, "individual")} style={suggestionChip()}>
                      {s.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </label>
          ) : (
            <label style={fieldLabel()}>
              Group Add
              <input
                ref={groupNameRef}
                value={groupNameInput}
                onChange={(e) => setGroupNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  if (groupSuggestions.length) selectStudent(groupSuggestions[0], "group");
                  else addStudentByName(groupNameInput, "group");
                }}
                placeholder="Type name + Enter"
                style={input()}
              />
              {groupSuggestions.length ? (
                <div style={suggestionsRow()}>
                  {groupSuggestions.map((s) => (
                    <button key={s.id} type="button" onClick={() => selectStudent(s, "group")} style={suggestionChip()}>
                      {s.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </label>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          {selectedStudents.length ? (
            <div style={selectedGrid()}>
              {selectedStudents.map((s) => (
                <div key={s.id} style={selectedCard()}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                    <div style={{ fontWeight: 900 }}>{s.name}</div>
                    <button type="button" onClick={() => removeSelectedStudent(s.id)} style={removeChip()}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <button
            style={btn()}
            onClick={() => startTracking(addMode === "group" ? groupStudentIds : individualStudentId ? [individualStudentId] : [])}
          >
            Start PREPS
          </button>
        </div>
      </div>

      <div style={prepsLayout()}>
        <div style={prepsMain()}>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {sessions.map((s) => {
            const student = studentById.get(s.student_id);
            const form = formById.get(s.taolu_form_id);
            const notes = notesBySession[s.id] ?? [];
            return (
              <div key={s.id} style={sessionCard(activeSessionId === s.id)} onClick={() => setActiveSessionId(s.id)}>
                <div style={{ fontWeight: 1000, fontSize: 16 }}>{student?.name ?? "Student"}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{form?.name ?? "Taolu"}</div>
                <div style={{ marginTop: 6, fontSize: 12 }}>Notes: {notes.length}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  <button
                    style={btnGhost()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenSessionId(s.id);
                    }}
                  >
                    Review
                  </button>
                  <button
                    style={btnGhost()}
                    onClick={(e) => {
                      e.stopPropagation();
                      finishSession(s.id);
                    }}
                  >
                    Finish
                  </button>
                </div>
              </div>
            );
          })}
          {!sessions.length ? <div style={{ opacity: 0.6, fontSize: 12 }}>No active PREPS sessions.</div> : null}
          </div>
        </div>
        <div style={prepsSidebar()}>
          <div style={finishedBar()}>
            <div style={{ fontWeight: 1000, fontSize: 12, opacity: 0.85 }}>Finished Log</div>
            <div style={finishedRow()}>
              {finishedSessions.map((s) => {
                const student = studentById.get(s.student_id);
                const form = formById.get(s.taolu_form_id);
                const isRefined = !!s.remediation_completed;
                return (
                  <button
                    key={s.session_id}
                    onClick={() => setOpenSessionId(s.session_id)}
                    style={finishedCard(isRefined)}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontWeight: 1000 }}>{student?.name ?? "Student"}</div>
                      <div style={statusChip(isRefined)}>{isRefined ? "Refined" : "Complete"}</div>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>{form?.name ?? "Taolu"}</div>
                    <div style={{ fontSize: 12 }}>Notes: {s.notes.length}</div>
                    {s.remediation_points ? <div style={{ fontSize: 12 }}>Refinement +{s.remediation_points}</div> : null}
                  </button>
                );
              })}
              {!finishedSessions.length ? <div style={{ opacity: 0.6, fontSize: 12 }}>No finished sessions.</div> : null}
            </div>
          </div>
        </div>
      </div>

      {openSessionId && openSession ? (
        <Overlay
          title="PREPS Notes"
          maxWidth={1100}
          topOffset={120}
          maxHeight={620}
          onClose={() => setOpenSessionId(null)}
        >
          <div style={{ display: "grid", gap: 12, maxHeight: 520, overflowY: "auto", paddingRight: 4 }}>
            <div style={{ fontWeight: 900 }}>
              {studentById.get(openSession.student_id)?.name ?? "Student"} •{" "}
              {formById.get(openSession.taolu_form_id)?.name ?? "Taolu"}
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {(notesBySession[openSessionId] ?? []).map((n) => {
                const isFinished = !!openFinishedSession;
                const isRefined = !!remediationBySession[openSessionId];
                const selected = (remediationSelections[openSessionId] ?? []).includes(n.id);
                return (
                  <div key={n.id} style={noteRow()}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {PREPS_KEYS.map((k) => {
                        const active = n.prep_key === k.key;
                        return (
                          <button
                            key={k.key}
                            type="button"
                            onClick={() => updateNote(n.id, { prep_key: k.key })}
                            style={prepChip(active)}
                          >
                            {k.key} {k.label}
                          </button>
                        );
                      })}
                      {isFinished ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (isRefined) return;
                            toggleRemediationSelection(openSessionId, n.id);
                          }}
                          style={remediationChip(selected, isRefined, true)}
                        >
                          Refinement
                        </button>
                      ) : null}
                      {isFinished && selected ? (
                        <span style={{ fontSize: 11, fontWeight: 900, color: "#93c5fd" }}>Refined</span>
                      ) : null}
                    </div>
                    <input
                      value={n.note ?? ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        setNotesBySession((prev) => {
                          const list = (prev[openSessionId] ?? []).map((row) =>
                            row.id === n.id ? { ...row, note: value } : row
                          );
                          return { ...prev, [openSessionId]: list };
                        });
                      }}
                      onBlur={(e) => updateNote(n.id, { note: e.target.value || null })}
                      placeholder="What part needs work?"
                      style={input()}
                    />
                  </div>
                );
              })}
              {!notesBySession[openSessionId]?.length ? (
                <div style={{ opacity: 0.6, fontSize: 12 }}>Press Space to log a PREPS note.</div>
              ) : null}
            </div>

            {openFinishedSession ? (
              <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                {remediationBySession[openFinishedSession.session_id] ? (
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    Refinement Round complete • +{remediationBySession[openFinishedSession.session_id].points_awarded} pts
                  </div>
                ) : (
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    Select each fixed PREPS note. Each selected note earns +2 points.
                  </div>
                )}
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
                      : `Submit Refinement (+${(remediationSelections[openFinishedSession.session_id] ?? []).length * 2} pts)`}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </Overlay>
      ) : null}
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
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.2)",
    color: "white",
    fontWeight: 900,
    outline: "none",
    width: "100%",
  };
}

function fieldLabel(): React.CSSProperties {
  return {
    display: "grid",
    gap: 6,
    fontSize: 12,
    fontWeight: 900,
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

function btnGhost(): React.CSSProperties {
  return {
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

function sessionCard(active: boolean): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 12,
    border: active ? "1px solid rgba(59,130,246,0.5)" : "1px solid rgba(255,255,255,0.12)",
    background: active ? "rgba(59,130,246,0.18)" : "rgba(255,255,255,0.04)",
    display: "grid",
    gap: 6,
    cursor: "pointer",
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
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  };
}

function selectedGrid(): React.CSSProperties {
  return {
    display: "grid",
    gap: 10,
    width: "100%",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  };
}

function selectedCard(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    display: "grid",
    gap: 4,
  };
}

function removeChip(): React.CSSProperties {
  return {
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(239,68,68,0.5)",
    background: "rgba(239,68,68,0.2)",
    color: "white",
    fontWeight: 800,
    fontSize: 10,
    cursor: "pointer",
  };
}

function prepsLayout(): React.CSSProperties {
  return {
    display: "flex",
    gap: 16,
    alignItems: "flex-start",
    flexWrap: "wrap",
  };
}

function prepsMain(): React.CSSProperties {
  return {
    flex: "1 1 620px",
    minWidth: 0,
  };
}

function prepsSidebar(): React.CSSProperties {
  return {
    flex: "0 1 320px",
    minWidth: 260,
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
    gap: 6,
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

function notice(): React.CSSProperties {
  return {
    padding: 10,
    borderRadius: 14,
    background: "rgba(239,68,68,0.15)",
    border: "1px solid rgba(255,255,255,0.10)",
    fontWeight: 900,
  };
}

function noteRow(): React.CSSProperties {
  return {
    display: "grid",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.2)",
  };
}

function prepChip(active: boolean): React.CSSProperties {
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

function remediationChip(active: boolean, disabled: boolean, distinct = false): React.CSSProperties {
  const baseBorder = distinct ? "rgba(59,130,246,0.55)" : "rgba(255,255,255,0.18)";
  const baseBg = distinct ? "rgba(59,130,246,0.18)" : "rgba(255,255,255,0.06)";
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: active ? "1px solid rgba(251,146,60,0.8)" : `1px solid ${baseBorder}`,
    background: active ? "rgba(251,146,60,0.35)" : baseBg,
    color: "white",
    fontWeight: 900,
    fontSize: 11,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled && !active ? 0.6 : 1,
  };
}

function getStudentSuggestions(query: string, students: StudentRow[]) {
  const value = query.trim().toLowerCase();
  if (!value) return [];
  const matches = students
    .map((s) => ({ student: s, name: s.name.trim().toLowerCase() }))
    .filter((s) => s.name.includes(value))
    .sort((a, b) => {
      const aStarts = a.name.startsWith(value);
      const bStarts = b.name.startsWith(value);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 5)
    .map((s) => s.student);
  return matches;
}

function suggestionsRow(): React.CSSProperties {
  return {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  };
}

function suggestionChip(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 800,
    fontSize: 11,
    cursor: "pointer",
  };
}

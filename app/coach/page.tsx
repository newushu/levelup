"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AuthGate from "@/components/AuthGate";

type ToolKey = "lesson_forge" | "timers" | "warmup" | "classroom_roster" | "default";

const TOOLS: Array<{
  key: Exclude<ToolKey, "default">;
  label: string;
  description: string;
  coachUrl: string;
  displayUrl?: string;
  supportsLock?: boolean;
}> = [
  {
    key: "lesson_forge",
    label: "LessonForge",
    description: "Run class templates with timers, videos, and tools.",
    coachUrl: "/tools/lesson-forge",
    displayUrl: "/tools/lesson-forge?display=1",
  },
  {
    key: "timers",
    label: "Coach Timers",
    description: "Game timers + controls for the display screen.",
    coachUrl: "/coach/timers",
    displayUrl: "/display/ctf?embed=1",
  },
  {
    key: "warmup",
    label: "Warm Up",
    description: "Warm up flow placeholder.",
    coachUrl: "/coach/warmup",
    displayUrl: "/coach/display?mode=warmup",
  },
  {
    key: "classroom_roster",
    label: "Classroom Roster",
    description: "Check-ins and roster view for a locked class.",
    coachUrl: "/coach/classroom",
    displayUrl: "/display/classroom",
    supportsLock: true,
  },
];

export default function CoachDashboardPage() {
  const [role, setRole] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [blocked, setBlocked] = useState(false);
  const [selectedTool, setSelectedTool] = useState<ToolKey>("default");
  const [msg, setMsg] = useState("");
  const [coachUserId, setCoachUserId] = useState<string>("");
  const [displaySlots, setDisplaySlots] = useState<
    Array<{ slot_key: string; label: string; coach_user_id?: string | null; coach_name?: string | null; coach_email?: string | null }>
  >([]);
  const [selectedSlotKey, setSelectedSlotKey] = useState<string>("");
  const [todaySessions, setTodaySessions] = useState<
    Array<{ instance_id: string; class_id: string; class_name: string; start_time: string; end_time?: string | null }>
  >([]);
  const [lockedInstanceId, setLockedInstanceId] = useState("");
  const [lockedClassId, setLockedClassId] = useState("");
  const [classroomReloadNonce, setClassroomReloadNonce] = useState(0);
  const [checkinName, setCheckinName] = useState("");
  const [checkinMatch, setCheckinMatch] = useState<{ id: string; name: string } | null>(null);
  const [checkinMsg, setCheckinMsg] = useState("");
  const [checkinBusy, setCheckinBusy] = useState(false);
  const [adminNoteKind, setAdminNoteKind] = useState("feature");
  const [adminNoteTitle, setAdminNoteTitle] = useState("");
  const [adminNoteBody, setAdminNoteBody] = useState("");
  const [adminNoteUrgency, setAdminNoteUrgency] = useState("normal");
  const [adminNoteStudentQuery, setAdminNoteStudentQuery] = useState("");
  const [adminNoteStudentResults, setAdminNoteStudentResults] = useState<Array<{ id: string; name: string }>>([]);
  const [adminNoteStudent, setAdminNoteStudent] = useState<{ id: string; name: string } | null>(null);
  const [coachTodos, setCoachTodos] = useState<Array<any>>([]);
  const [adminNoteMsg, setAdminNoteMsg] = useState("");
  const [adminNoteBusy, setAdminNoteBusy] = useState(false);
  const classSelectRef = useRef<HTMLSelectElement | null>(null);
  const localChannelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        const nextRole = String(data?.role ?? "");
        setRole(nextRole);
        setUserId(String(data?.user?.id ?? ""));
        if (!data?.ok || (nextRole !== "admin" && nextRole !== "coach")) {
          setBlocked(true);
          return;
        }
        setCoachUserId(String(data?.user?.id ?? ""));
        const stateRes = await fetch("/api/coach/display-state", { cache: "no-store" });
        const stateJson = await stateRes.json().catch(() => ({}));
        if (stateJson?.ok && stateJson?.state?.tool_key) {
          setSelectedTool(String(stateJson.state.tool_key) as ToolKey);
        }
      } catch {
        setBlocked(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
    localChannelRef.current = new BroadcastChannel("coach-display-local");
    return () => {
      localChannelRef.current?.close();
      localChannelRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!adminNoteStudentQuery.trim()) {
      setAdminNoteStudentResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch("/api/students/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: adminNoteStudentQuery.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAdminNoteStudentResults((data.students ?? []).map((s: any) => ({ id: s.id, name: s.name })));
      }
    }, 200);
    return () => clearTimeout(t);
  }, [adminNoteStudentQuery]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin-todos?status=open&scope=mine", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.ok) setCoachTodos(data.todos ?? []);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    try {
      const savedInstance = localStorage.getItem("coach_dashboard_lock_instance") || "";
      const savedClass = localStorage.getItem("coach_dashboard_lock_class") || "";
      if (savedInstance) setLockedInstanceId(savedInstance);
      if (savedClass) setLockedClassId(savedClass);
    } catch {}
  }, []);

  useEffect(() => {
    if (blocked) return;
    (async () => {
      const res = await fetch("/api/coach-display-slots", { cache: "no-store" });
      const sj = await res.json().catch(() => ({}));
      if (!res.ok || !sj?.ok) return;
      const slots = (sj.slots ?? []) as Array<{
        slot_key: string;
        label: string;
        coach_user_id?: string | null;
        coach_name?: string | null;
        coach_email?: string | null;
      }>;
      setDisplaySlots(slots);
      if (!slots.length) return;
      const assigned = slots.find((s) => s.coach_user_id && String(s.coach_user_id) === String(userId));
      const preferred = selectedSlotKey || assigned?.slot_key || slots[0].slot_key;
      setSelectedSlotKey(preferred);
      const slotCoach = slots.find((s) => s.slot_key === preferred)?.coach_user_id;
      if (slotCoach) setCoachUserId(String(slotCoach));
    })();
  }, [blocked, userId, selectedSlotKey]);

  useEffect(() => {
    if (!selectedSlotKey || !displaySlots.length) return;
    const slot = displaySlots.find((s) => s.slot_key === selectedSlotKey);
    if (!slot?.coach_user_id) {
      setMsg("Selected display has no coach assigned.");
      return;
    }
    setCoachUserId(String(slot.coach_user_id));
  }, [selectedSlotKey, displaySlots]);

  useEffect(() => {
    const name = checkinName.trim();
    if (!name) {
      setCheckinMatch(null);
      return;
    }
    let active = true;
    const t = setTimeout(async () => {
      try {
        const lookup = await fetch(`/api/students/lookup?name=${encodeURIComponent(`%${name}%`)}`, { cache: "no-store" });
        const lookupJson = await lookup.json().catch(() => ({}));
        if (!active) return;
        if (lookup.ok && lookupJson?.ok && lookupJson?.student?.id) {
          setCheckinMatch({ id: String(lookupJson.student.id), name: String(lookupJson.student.name ?? "") });
        } else {
          setCheckinMatch(null);
        }
      } catch {
        if (active) setCheckinMatch(null);
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [checkinName]);

  useEffect(() => {
    if (blocked) return;
    let active = true;
    (async () => {
      try {
        const today = new Date().toLocaleDateString("en-CA");
        const res = await fetch(`/api/schedule/list?date=${encodeURIComponent(today)}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        if (data?.ok) {
          const entries = (data.entries ?? []) as Array<{
            id: string;
            class_id: string;
            class_name: string;
            start_time: string;
            end_time?: string | null;
          }>;
          setTodaySessions(
            entries.map((e) => ({
              instance_id: String(e.id),
              class_id: String(e.class_id),
              class_name: String(e.class_name ?? ""),
              start_time: String(e.start_time ?? ""),
              end_time: e.end_time ?? null,
            }))
          );
        } else if (data?.error) {
          setMsg(data.error);
        }
      } catch (err: any) {
        if (!active) return;
        setMsg(err?.message ?? "Failed to load today's classes.");
      }
    })();
    return () => {
      active = false;
    };
  }, [blocked]);

  async function checkInByName(override?: { id: string; name: string }) {
    setCheckinMsg("");
    const name = checkinName.trim();
    if (!name) {
      setCheckinMsg("Type a student name first.");
      return;
    }
    if (!lockedInstanceId) {
      setCheckinMsg("Select a class first.");
      return;
    }
    setCheckinBusy(true);
    try {
      let student = override;
      if (!student?.id) {
        const lookup = await fetch(`/api/students/lookup?name=${encodeURIComponent(`%${name}%`)}`, { cache: "no-store" });
        const lookupJson = await lookup.json().catch(() => ({}));
        if (!lookup.ok || !lookupJson?.ok) {
          setCheckinMsg(lookupJson?.error || "Student lookup failed.");
          return;
        }
        student = lookupJson?.student ?? null;
      }
      if (!student?.id) {
        setCheckinMsg("No matching student found.");
        return;
      }
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instance_id: lockedInstanceId, student_id: student.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setCheckinMsg(data?.error || "Check-in failed.");
        return;
      }
      const className = todaySessions.find((s) => String(s.instance_id) === String(lockedInstanceId))?.class_name || "class";
      setCheckinMsg(`✅ ${student.name} checked in to ${className}.`);
      setCheckinName("");
      setClassroomReloadNonce((n) => n + 1);
    } catch (err: any) {
      setCheckinMsg(err?.message ?? "Check-in failed.");
    } finally {
      setCheckinBusy(false);
    }
  }

  async function submitAdminNote() {
    setAdminNoteMsg("");
    const title = adminNoteTitle.trim();
    const body = adminNoteBody.trim();
    if (!title) {
      setAdminNoteMsg("Add a title first.");
      return;
    }
    if (!body) {
      setAdminNoteMsg("Add a description first.");
      return;
    }
    setAdminNoteBusy(true);
    try {
      const res = await fetch("/api/admin-todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: adminNoteKind,
          title,
          body,
          urgency: adminNoteUrgency,
          student_id: adminNoteStudent?.id ?? null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setAdminNoteMsg(data?.error || "Failed to send to admin.");
        return;
      }
      setAdminNoteMsg("✅ Sent to admin.");
      setAdminNoteTitle("");
      setAdminNoteBody("");
      setAdminNoteUrgency("normal");
      setAdminNoteStudent(null);
      setAdminNoteStudentQuery("");
      const refresh = await fetch("/api/admin-todos?status=open&scope=mine", { cache: "no-store" });
      const refreshJson = await refresh.json().catch(() => ({}));
      if (refresh.ok && refreshJson?.ok) setCoachTodos(refreshJson.todos ?? []);
    } catch (err: any) {
      setAdminNoteMsg(err?.message ?? "Failed to send to admin.");
    } finally {
      setAdminNoteBusy(false);
    }
  }

  const activeTool = useMemo(() => TOOLS.find((t) => t.key === selectedTool) ?? null, [selectedTool]);

  async function setTool(tool: ToolKey, overrides?: { instanceId?: string; classId?: string }) {
    setSelectedTool(tool);
    setMsg("");
    if (!coachUserId) {
      setMsg("Select a display with an assigned coach.");
      return;
    }
    let nextInstanceId = overrides?.instanceId ?? lockedInstanceId;
    let nextClassId = overrides?.classId ?? lockedClassId;
    if (tool === "classroom_roster" && !nextInstanceId) {
      const first = todaySessions[0];
      if (first?.instance_id) {
        nextInstanceId = String(first.instance_id);
        nextClassId = String(first.class_id ?? "");
        setLockedInstanceId(nextInstanceId);
        setLockedClassId(nextClassId);
      }
    }
    if (tool === "classroom_roster" && !nextInstanceId) {
      setMsg("Select a class to lock before opening Classroom Roster.");
      return;
    }
    if (tool === "classroom_roster" && nextInstanceId) {
      try {
        localStorage.setItem("coach_dashboard_lock_instance", nextInstanceId);
        localStorage.setItem("coach_dashboard_lock_class", nextClassId || "");
      } catch {}
    }
    const nextTool = TOOLS.find((t) => t.key === tool) ?? null;
    const lockParams =
      tool === "classroom_roster" && nextInstanceId
        ? `?lock_instance_id=${encodeURIComponent(nextInstanceId)}&lock_class_id=${encodeURIComponent(nextClassId || "")}`
        : "";
    const coachUrl =
      nextTool?.key === "classroom_roster" ? `${nextTool.coachUrl}${lockParams}` : nextTool?.coachUrl ?? null;
    const displayUrl =
      nextTool?.key === "classroom_roster" ? `${nextTool.displayUrl ?? "/display/classroom"}${lockParams}` : nextTool?.displayUrl ?? null;
    const payload =
      tool === "default"
        ? null
        : {
            coach_url: coachUrl,
            display_url: displayUrl,
            lock_instance_id: nextInstanceId || null,
            lock_class_id: nextClassId || null,
          };
    try {
      await fetch("/api/coach/display-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool_key: tool,
          tool_payload: payload,
          coach_user_id: coachUserId || null,
        }),
      });
    } catch (err: any) {
      setMsg(err?.message ?? "Failed to update display");
    }
  }
  useEffect(() => {
    if (!coachUserId) return;
    (async () => {
      const stateRes = await fetch(`/api/coach/display-state?coach_user_id=${encodeURIComponent(coachUserId)}`, {
        cache: "no-store",
      });
      const stateJson = await stateRes.json().catch(() => ({}));
      if (stateJson?.ok && stateJson?.state?.tool_key) {
        setSelectedTool(String(stateJson.state.tool_key) as ToolKey);
      }
    })();
  }, [coachUserId]);

  return (
    <AuthGate>
      {blocked ? (
        <div style={{ padding: 18 }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>Coach dashboard is coach-only.</div>
          <div style={{ opacity: 0.7, marginTop: 6 }}>Ask an admin to grant coach access.</div>
        </div>
      ) : (
        <main style={page()}>
          <div style={header()}>
            <div>
              <div style={title()}>Coach Dashboard</div>
              <div style={subtitle()}>Launch tools and sync the presenter display.</div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={coachSelect()}>
                <label style={{ fontSize: 11, opacity: 0.7, fontWeight: 800 }}>Display</label>
                <select
                  value={selectedSlotKey}
                  onChange={(e) => setSelectedSlotKey(e.target.value)}
                  style={select()}
                >
                  {displaySlots.length ? (
                    displaySlots.map((s) => (
                      <option key={s.slot_key} value={s.slot_key}>
                        {dashboardLabel(s)}
                      </option>
                    ))
                  ) : (
                    <option value="">No displays</option>
                  )}
                </select>
                <div style={{ fontSize: 11, opacity: 0.7 }}>
                  {(() => {
                    const slot = displaySlots.find((s) => s.slot_key === selectedSlotKey);
                    if (!slot?.coach_user_id) return "Unassigned";
                    const binding = displayBindingLabel(slot);
                    const coach = slot.coach_name || slot.coach_email || "Coach";
                    return `${binding} • ${coach}`;
                  })()}
                </div>
              </div>
              <button
                style={ghostBtn()}
                onClick={() => window.open(`/coach/display${selectedSlotKey ? `?slot=${encodeURIComponent(selectedSlotKey)}` : ""}`, "_blank")}
              >
                Open Presenter Display
              </button>
            </div>
          </div>

          {msg ? <div style={msgStyle()}>{msg}</div> : null}

          <div style={grid()}>
            <section style={leftPane()}>
              <div style={panelTitle()}>Tools</div>
              <div style={toolGrid()}>
                {TOOLS.map((tool) => (
                  <div
                    key={tool.key}
                    style={toolCard(selectedTool === tool.key)}
                    onClick={() => setTool(tool.key)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setTool(tool.key);
                      }
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>{tool.label}</div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>{tool.description}</div>
                    {tool.supportsLock ? (
                      <div style={lockRow()}>
                        <label style={{ fontSize: 11, opacity: 0.7 }}>Lock to class</label>
                        <select
                          ref={classSelectRef}
                          value={lockedInstanceId}
                          onChange={(e) => {
                            const next = e.target.value;
                            setLockedInstanceId(next);
                            const match = todaySessions.find((s) => String(s.instance_id) === String(next));
                            if (match) setLockedClassId(String(match.class_id));
                            try {
                              localStorage.setItem("coach_dashboard_lock_instance", next);
                              localStorage.setItem("coach_dashboard_lock_class", String(match?.class_id ?? ""));
                            } catch {}
                            if (localChannelRef.current && next) {
                              localChannelRef.current.postMessage({
                                type: "classroom_lock",
                                instanceId: next,
                                classId: String(match?.class_id ?? ""),
                              });
                            }
                            if (selectedTool === "classroom_roster" && next) {
                              setClassroomReloadNonce((n) => n + 1);
                              setTool("classroom_roster", {
                                instanceId: next,
                                classId: String(match?.class_id ?? ""),
                              });
                            }
                          }}
                          style={select()}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {todaySessions.length ? (
                            todaySessions.map((s) => (
                              <option key={s.instance_id} value={s.instance_id}>
                                {s.class_name} {s.start_time ? `• ${s.start_time}` : ""}
                              </option>
                            ))
                          ) : (
                            <option value="">No sessions</option>
                          )}
                        </select>
                        <button
                          style={ghostBtn()}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!lockedInstanceId) {
                              classSelectRef.current?.focus();
                              return;
                            }
                            setClassroomReloadNonce((n) => n + 1);
                            if (localChannelRef.current) {
                              localChannelRef.current.postMessage({
                                type: "classroom_lock",
                                instanceId: lockedInstanceId,
                                classId: lockedClassId,
                              });
                            }
                            if (selectedTool === "classroom_roster") {
                              setTool("classroom_roster", {
                                instanceId: lockedInstanceId,
                                classId: lockedClassId,
                              });
                            }
                          }}
                        >
                          Load a new class
                        </button>
                        <div style={checkinRow()} onClick={(e) => e.stopPropagation()}>
                          <input
                            value={checkinName}
                            onChange={(e) => setCheckinName(e.target.value)}
                            placeholder="Check in by name"
                            style={checkinInput()}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key !== "Enter") return;
                              e.preventDefault();
                              e.stopPropagation();
                              if (!checkinBusy) checkInByName(checkinMatch ?? undefined);
                            }}
                          />
                          {checkinMatch ? <div style={checkinMatchStyle()}>Match: {checkinMatch.name}</div> : null}
                          <button
                            style={ghostBtn()}
                            onClick={(e) => {
                              e.stopPropagation();
                              checkInByName(checkinMatch ?? undefined);
                            }}
                            disabled={checkinBusy}
                          >
                            Check in
                          </button>
                          {checkinMsg ? <div style={checkinMsgStyle()}>{checkinMsg}</div> : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              <div style={panelTitle()}>Display</div>
              <div style={displayCard()}>
                <div style={{ fontWeight: 900 }}>Presenter display</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  Currently showing: {selectedTool === "default" ? "Next class" : activeTool?.label ?? ""}
                </div>
                <button
                  style={ghostBtn()}
                  onClick={() => window.open(`/coach/display${selectedSlotKey ? `?slot=${encodeURIComponent(selectedSlotKey)}` : ""}`, "_blank")}
                >
                  Open display →
                </button>
              </div>

              <div style={panelTitle()}>Note to Admin</div>
              <div style={noteCard()}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  Log feature requests, bugs, or other notes for admin to review.
                </div>
                <select value={adminNoteKind} onChange={(e) => setAdminNoteKind(e.target.value)} style={select()}>
                  <option value="feature">Feature Add</option>
                  <option value="bug">Bug</option>
                  <option value="other">Other</option>
                  <option value="todo">To-Do</option>
                </select>
                <input
                  value={adminNoteTitle}
                  onChange={(e) => setAdminNoteTitle(e.target.value)}
                  placeholder="Title"
                  style={input()}
                />
                <textarea
                  value={adminNoteBody}
                  onChange={(e) => setAdminNoteBody(e.target.value)}
                  placeholder="Describe the issue or request..."
                  style={noteInput()}
                  rows={3}
                />
                {adminNoteKind === "todo" ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    <label style={{ fontSize: 12, opacity: 0.7 }}>Urgency</label>
                    <select value={adminNoteUrgency} onChange={(e) => setAdminNoteUrgency(e.target.value)} style={select()}>
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                    <label style={{ fontSize: 12, opacity: 0.7 }}>Bind to student (optional)</label>
                    <input
                      value={adminNoteStudentQuery}
                      onChange={(e) => setAdminNoteStudentQuery(e.target.value)}
                      placeholder="Search student"
                      style={input()}
                    />
                    {adminNoteStudentResults.length ? (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {adminNoteStudentResults.slice(0, 6).map((s) => (
                          <button
                            key={s.id}
                            onClick={() => {
                              setAdminNoteStudent(s);
                              setAdminNoteStudentQuery(s.name);
                              setAdminNoteStudentResults([]);
                            }}
                            style={chip()}
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {adminNoteStudent ? (
                      <div style={{ fontSize: 12, opacity: 0.85 }}>Bound to: {adminNoteStudent.name}</div>
                    ) : null}
                  </div>
                ) : null}
                <button style={ghostBtn()} onClick={submitAdminNote} disabled={adminNoteBusy}>
                  Send to admin
                </button>
                {adminNoteMsg ? <div style={noteMsg()}>{adminNoteMsg}</div> : null}
              </div>

              <div style={panelTitle()}>My To-Dos</div>
              <div style={noteCard()}>
                {coachTodos.length ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    {coachTodos.map((todo) => (
                      <div key={todo.id} style={todoCard()}>
                        <div style={{ fontWeight: 900 }}>{todo.title || "Untitled"}</div>
                        {todo.student_name ? (
                          <div style={{ fontSize: 12, opacity: 0.7 }}>Student: {todo.student_name}</div>
                        ) : null}
                        {todo.urgency ? <div style={todoUrgency(todo.urgency)}>{todo.urgency.toUpperCase()}</div> : null}
                        <div style={{ fontSize: 12, opacity: 0.85 }}>{todo.body}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, opacity: 0.6 }}>No open to-dos.</div>
                )}
              </div>
            </section>

            <section style={rightPane()}>
              {selectedTool === "default" ? (
                <div style={placeholder()}>
                  <div style={{ fontSize: 18, fontWeight: 900 }}>Pick a tool to open it here.</div>
                  <div style={{ fontSize: 13, opacity: 0.7 }}>
                    The presenter display will follow whatever you select.
                  </div>
                </div>
              ) : (
                <div style={toolShell()}>
                  <div style={toolShellHeader()}>
                    <button style={backBtn()} onClick={() => setTool("default")}>
                      ← Back
                    </button>
                    <div style={{ fontWeight: 900 }}>{activeTool?.label}</div>
                    <button
                      style={ghostBtn()}
                      onClick={() => window.open(activeTool?.coachUrl ?? "/tools", "_blank")}
                    >
                      Open in new tab
                    </button>
                  </div>
                  <iframe
                    key={`coach-tool-${selectedTool}-${lockedInstanceId}-${classroomReloadNonce}`}
                    src={
                      selectedTool === "classroom_roster" && lockedInstanceId
                        ? `/coach/classroom?lock_instance_id=${encodeURIComponent(lockedInstanceId)}&lock_class_id=${encodeURIComponent(lockedClassId || "")}`
                        : activeTool?.coachUrl ?? "/tools"
                    }
                    style={toolFrame()}
                    title="Coach Tool"
                  />
                </div>
              )}
            </section>
          </div>
        </main>
      )}
    </AuthGate>
  );
}

function page(): React.CSSProperties {
  return {
    padding: 20,
    display: "grid",
    gap: 16,
    color: "white",
  };
}

function header(): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
  };
}

function title(): React.CSSProperties {
  return { fontSize: 26, fontWeight: 1000 };
}

function subtitle(): React.CSSProperties {
  return { fontSize: 13, opacity: 0.7 };
}

function msgStyle(): React.CSSProperties {
  return { fontSize: 12, opacity: 0.8 };
}

function grid(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "20% 1fr",
    gap: 16,
    alignItems: "start",
  };
}

function leftPane(): React.CSSProperties {
  return {
    display: "grid",
    gap: 14,
    position: "sticky",
    top: 12,
    alignSelf: "start",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "linear-gradient(180deg, rgba(15,23,42,0.85), rgba(2,6,23,0.8))",
    padding: 12,
    boxShadow: "0 14px 30px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)",
  };
}

function rightPane(): React.CSSProperties {
  return {
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.65)",
    padding: 12,
    minHeight: "calc(100vh - 140px)",
  };
}

function panelTitle(): React.CSSProperties {
  return { fontWeight: 900, fontSize: 14, letterSpacing: 0.3 };
}

function toolGrid(): React.CSSProperties {
  return { display: "grid", gap: 10 };
}

function toolCard(active: boolean): React.CSSProperties {
  return {
    textAlign: "left",
    padding: 12,
    borderRadius: 14,
    border: active ? "1px solid rgba(59,130,246,0.6)" : "1px solid rgba(255,255,255,0.12)",
    background: active ? "rgba(59,130,246,0.15)" : "rgba(2,6,23,0.5)",
    display: "grid",
    gap: 6,
    color: "white",
  };
}

function displayCard(): React.CSSProperties {
  return {
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    padding: 12,
    display: "grid",
    gap: 8,
    background: "rgba(2,6,23,0.45)",
  };
}

function placeholder(): React.CSSProperties {
  return {
    minHeight: 420,
    borderRadius: 16,
    border: "1px dashed rgba(255,255,255,0.2)",
    display: "grid",
    placeItems: "center",
    textAlign: "center",
    gap: 8,
  };
}

function toolShell(): React.CSSProperties {
  return { display: "grid", gap: 10 };
}

function toolShellHeader(): React.CSSProperties {
  return { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" };
}

function toolFrame(): React.CSSProperties {
  return {
    width: "100%",
    height: "calc(100vh - 220px)",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "white",
  };
}

function ghostBtn(): React.CSSProperties {
  return {
    borderRadius: 999,
    padding: "8px 14px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "transparent",
    fontWeight: 800,
    fontSize: 12,
    color: "white",
  };
}

function backBtn(): React.CSSProperties {
  return {
    borderRadius: 999,
    padding: "6px 12px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(2,6,23,0.5)",
    fontWeight: 800,
    fontSize: 12,
    color: "white",
  };
}

function coachSelect(): React.CSSProperties {
  return { display: "grid", gap: 4, minWidth: 220 };
}

function select(): React.CSSProperties {
  return {
    borderRadius: 10,
    padding: "6px 10px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(2,6,23,0.6)",
    color: "white",
    fontWeight: 800,
    fontSize: 12,
    width: "100%",
  };
}

function lockRow(): React.CSSProperties {
  return { display: "grid", gap: 4, marginTop: 6 };
}

function checkinRow(): React.CSSProperties {
  return {
    marginTop: 8,
    display: "grid",
    gap: 6,
  };
}

function checkinInput(): React.CSSProperties {
  return {
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(2,6,23,0.7)",
    color: "white",
    padding: "8px 10px",
    fontWeight: 700,
  };
}

function checkinMsgStyle(): React.CSSProperties {
  return { fontSize: 11, opacity: 0.8 };
}

function checkinMatchStyle(): React.CSSProperties {
  return { fontSize: 11, opacity: 0.8 };
}

function noteCard(): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(2,6,23,0.6)",
    display: "grid",
    gap: 10,
  };
}

function noteInput(): React.CSSProperties {
  return {
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(2,6,23,0.7)",
    color: "white",
    padding: "8px 10px",
    fontWeight: 700,
    resize: "vertical",
  };
}

function chip(): React.CSSProperties {
  return {
    borderRadius: 999,
    padding: "6px 10px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(2,6,23,0.6)",
    color: "white",
    fontWeight: 800,
    fontSize: 12,
  };
}

function input(): React.CSSProperties {
  return {
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(2,6,23,0.7)",
    color: "white",
    padding: "8px 10px",
    fontWeight: 700,
  };
}

function noteMsg(): React.CSSProperties {
  return { fontSize: 11, opacity: 0.8 };
}

function todoCard(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.6)",
    display: "grid",
    gap: 6,
  };
}

function todoUrgency(level: string): React.CSSProperties {
  const key = String(level || "").toLowerCase();
  const color =
    key === "urgent" ? "#f43f5e" : key === "high" ? "#f97316" : key === "low" ? "#38bdf8" : "#a3e635";
  return {
    alignSelf: "flex-start",
    borderRadius: 999,
    padding: "3px 10px",
    border: `1px solid ${color}`,
    color,
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 0.6,
  };
}

function slotNumber(slot_key: string) {
  const key = String(slot_key ?? "");
  if (key.startsWith("coach_")) {
    const num = key.replace("coach_", "");
    return num || null;
  }
  return null;
}

function dashboardLabel(slot: { slot_key: string; label?: string | null }) {
  const num = slotNumber(slot.slot_key);
  if (num) return `Dashboard ${num}`;
  return String(slot.label ?? slot.slot_key ?? "Dashboard");
}

function displayBindingLabel(slot: { slot_key: string; label?: string | null }) {
  const num = slotNumber(slot.slot_key);
  if (num) return `Bound to Display ${num}`;
  return `Bound to ${String(slot.label ?? slot.slot_key ?? "Display")}`;
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AuthGate from "@/components/AuthGate";

type StudentRow = { id: string; name: string };

type TaoluCard = {
  session_id: string;
  student_id: string;
  student_name: string;
  form_name: string;
  status: "pending" | "finished";
  created_at?: string | null;
  ended_at?: string | null;
  deductions_count: number;
  points_lost?: number;
  deductions: Array<{ id: string; code_label: string; section_number: number | null; note: string }>;
  on_display?: boolean;
};

type OtherStudentChip = {
  student_id: string;
  student_name: string;
  sessions_count: number;
  deductions_count: number;
  on_display?: boolean;
};

type CumulativeWindow = {
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

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: text.slice(0, 220) } };
  }
}

export default function StudentTaoluClassToolPage() {
  return (
    <AuthGate>
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [cards, setCards] = useState<TaoluCard[]>([]);
  const [recentLogs, setRecentLogs] = useState<TaoluCard[]>([]);
  const [otherChips, setOtherChips] = useState<OtherStudentChip[]>([]);
  const [otherLogsOpen, setOtherLogsOpen] = useState(false);
  const [otherLogsStudent, setOtherLogsStudent] = useState<OtherStudentChip | null>(null);
  const [otherLogs, setOtherLogs] = useState<TaoluCard[]>([]);
  const [windows, setWindows] = useState<CumulativeWindow[]>([]);
  const [busyKey, setBusyKey] = useState("");
  const [msg, setMsg] = useState("");

  async function loadStudent() {
    const res = await fetch("/api/students/list", { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return;
    const rows = (sj.json?.students ?? []) as StudentRow[];
    let id = "";
    try {
      id = localStorage.getItem("active_student_id") || "";
    } catch {}
    const selected = rows.find((r) => String(r.id) === String(id)) ?? null;
    setStudent(selected);
  }

  async function loadAll(studentId: string) {
    const res = await fetch(`/api/student/class-tools/taolu?student_id=${encodeURIComponent(studentId)}&recent_days=90`, { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to load taolu data");
    setCards((sj.json?.cards ?? []) as TaoluCard[]);
    setRecentLogs((sj.json?.recent_logs ?? []) as TaoluCard[]);
    setOtherChips((sj.json?.other_student_chips ?? []) as OtherStudentChip[]);
    setWindows((sj.json?.cumulative_windows ?? []) as CumulativeWindow[]);
  }

  async function loadOtherStudentLogs(studentId: string, otherStudentId: string) {
    const res = await fetch(
      `/api/student/class-tools/taolu?student_id=${encodeURIComponent(studentId)}&recent_days=90&other_student_id=${encodeURIComponent(otherStudentId)}`,
      { cache: "no-store" }
    );
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to load other student logs");
    setOtherLogs((sj.json?.other_student_logs ?? []) as TaoluCard[]);
  }

  useEffect(() => {
    loadStudent();
  }, []);

  useEffect(() => {
    if (!student?.id) return;
    loadAll(student.id);
    const t = window.setInterval(() => loadAll(student.id), 7000);
    return () => window.clearInterval(t);
  }, [student?.id]);

  const orderedCards = useMemo(() => {
    return [...cards].sort((a, b) => {
      const ta = Date.parse(String(a.ended_at ?? a.created_at ?? "")) || 0;
      const tb = Date.parse(String(b.ended_at ?? b.created_at ?? "")) || 0;
      return tb - ta;
    });
  }, [cards]);

  async function setSessionDisplay(sessionId: string, mode: "push" | "remove") {
    if (!student?.id) return;
    setBusyKey(`${mode}:${sessionId}`);
    setMsg("");
    const res = await fetch("/api/student/class-tools/taolu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: student.id, session_id: sessionId, action: mode }),
    });
    const sj = await safeJson(res);
    setBusyKey("");
    if (!sj.ok) return setMsg(sj.json?.error || `Failed to ${mode} card`);
    setMsg(mode === "push" ? "Pushed to display and lower bar." : "Removed from display.");
    loadAll(student.id);
    if (otherLogsOpen && otherLogsStudent?.student_id) {
      loadOtherStudentLogs(student.id, otherLogsStudent.student_id);
    }
  }

  async function setCumulativeDisplay(windowKey: "7d" | "30d" | "90d", formId: string, mode: "push" | "remove") {
    if (!student?.id) return;
    setBusyKey(`window:${windowKey}:${formId}:${mode}`);
    setMsg("");
    const res = await fetch("/api/student/class-tools/taolu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: student.id, window_key: windowKey, form_id: formId, action: mode }),
    });
    const sj = await safeJson(res);
    setBusyKey("");
    if (!sj.ok) return setMsg(sj.json?.error || `Failed to ${mode} cumulative card`);
    setMsg(mode === "push" ? "Cumulative card pushed to display and lower bar." : "Cumulative card removed from display.");
    loadAll(student.id);
  }

  return (
    <main style={{ paddingLeft: 180, minHeight: "100vh", display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 1000 }}>Taolu Tracker Display Tool</div>
          <div style={{ fontSize: 12, opacity: 0.78 }}>
            View your tracker logs, push any log card to display, and push cumulative cards.
          </div>
        </div>
        <Link href="/student/class-tools" style={btnGhost()}>Back to Class Tools</Link>
      </div>
      {msg ? <div style={{ fontSize: 12, opacity: 0.86 }}>{msg}</div> : null}
      <section style={panel()}>
        <div style={title()}>Your Tracker Cards (Active + Recent)</div>
        <div style={grid(2)}>
          {orderedCards.map((card) => (
            <article key={card.session_id} style={cardStyle(card.on_display)}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ fontWeight: 1000 }}>{card.form_name}</div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={chip(Boolean(card.on_display))}>{card.on_display ? "On Display" : "Not Displayed"}</span>
                  <span style={chip(card.status === "finished")}>{card.status === "finished" ? "Completed" : "Open"}</span>
                </div>
              </div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                Deductions: {card.deductions_count} {card.points_lost != null ? `• Lost: ${card.points_lost}` : ""}
              </div>
              <div style={{ display: "grid", gap: 4 }}>
                {(card.deductions ?? []).slice(0, 4).map((d, idx) => (
                  <div key={d.id || `${card.session_id}-${idx}`} style={{ fontSize: 12, opacity: 0.82 }}>
                    {idx + 1}. {d.code_label} • Sec {d.section_number ?? "—"} • {d.note || "No coach note"}
                  </div>
                ))}
                {!card.deductions?.length ? <div style={{ fontSize: 12, opacity: 0.7 }}>No deductions logged.</div> : null}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  style={btn()}
                  disabled={busyKey === `push:${card.session_id}`}
                  onClick={() => setSessionDisplay(card.session_id, "push")}
                >
                  {busyKey === `push:${card.session_id}` ? "Pushing..." : "Push to Display"}
                </button>
                {card.on_display ? (
                  <button
                    style={btnGhost()}
                    disabled={busyKey === `remove:${card.session_id}`}
                    onClick={() => setSessionDisplay(card.session_id, "remove")}
                  >
                    {busyKey === `remove:${card.session_id}` ? "Removing..." : "Remove from Display"}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
          {!orderedCards.length ? <div style={{ opacity: 0.7 }}>No active or recent taolu cards.</div> : null}
        </div>
      </section>

      <section style={panel()}>
        <div style={title()}>Recent Tracker Logs (You)</div>
        <div style={grid(2)}>
          {recentLogs.map((log) => (
            <article key={`recent-${log.session_id}`} style={cardStyle(log.on_display)}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ fontWeight: 1000 }}>{log.form_name}</div>
                <span style={chip(Boolean(log.on_display))}>{log.on_display ? "On Display" : "Not Displayed"}</span>
              </div>
              <div style={{ fontSize: 12, opacity: 0.78 }}>
                {log.ended_at ? new Date(log.ended_at).toLocaleString() : "No end time"} • Deductions: {log.deductions_count}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  style={btnGhost()}
                  disabled={busyKey === `push:${log.session_id}`}
                  onClick={() => setSessionDisplay(log.session_id, "push")}
                >
                  {busyKey === `push:${log.session_id}` ? "Pushing..." : "Push This Log"}
                </button>
                {log.on_display ? (
                  <button
                    style={btnGhost()}
                    disabled={busyKey === `remove:${log.session_id}`}
                    onClick={() => setSessionDisplay(log.session_id, "remove")}
                  >
                    {busyKey === `remove:${log.session_id}` ? "Removing..." : "Remove from Display"}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
          {!recentLogs.length ? <div style={{ opacity: 0.7 }}>No recent logs in selected window.</div> : null}
        </div>
      </section>

      <section style={panel()}>
        <div style={title()}>Cumulative Cards</div>
        <div style={{ fontSize: 12, opacity: 0.74 }}>Create summary cards for 7d, 30d, and 3mo, then push to display.</div>
        <div style={grid(3)}>
          {windows.map((w) => (
            <article key={`${w.key}:${w.form_id}`} style={cardStyle(w.on_display)}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ fontWeight: 1000 }}>{w.form_name} • {w.label}</div>
                <span style={chip(Boolean(w.on_display))}>{w.on_display ? "On Display" : "Not Displayed"}</span>
              </div>
              <div style={{ fontSize: 12, opacity: 0.82 }}>Sessions: {w.session_count}</div>
              <div style={{ fontSize: 12, opacity: 0.82 }}>Deductions: {w.deductions_count}</div>
              <div style={{ fontSize: 12, opacity: 0.82 }}>Points lost: {w.points_lost}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  style={btn()}
                  disabled={busyKey === `window:${w.key}:${w.form_id}:push`}
                  onClick={() => setCumulativeDisplay(w.key, w.form_id, "push")}
                >
                  {busyKey === `window:${w.key}:${w.form_id}:push` ? "Pushing..." : "Create + Push"}
                </button>
                {w.on_display ? (
                  <button
                    style={btnGhost()}
                    disabled={busyKey === `window:${w.key}:${w.form_id}:remove`}
                    onClick={() => setCumulativeDisplay(w.key, w.form_id, "remove")}
                  >
                    {busyKey === `window:${w.key}:${w.form_id}:remove` ? "Removing..." : "Remove from Display"}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section style={panel()}>
        <div style={title()}>Other Student Logs (Last 7d)</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {otherChips.map((c) => (
            <button
              key={c.student_id}
              type="button"
              onClick={async () => {
                if (!student?.id) return;
                setOtherLogsStudent(c);
                setOtherLogsOpen(true);
                await loadOtherStudentLogs(student.id, c.student_id);
              }}
              style={{
                ...chip(Boolean(c.on_display)),
                animation: c.on_display ? "chipPulse 1.2s ease-in-out infinite" : undefined,
                cursor: "pointer",
              }}
            >
              {c.student_name} • {c.sessions_count} sessions • {c.deductions_count} deductions
            </button>
          ))}
          {!otherChips.length ? <div style={{ opacity: 0.7, fontSize: 12 }}>No other student logs in last 7 days.</div> : null}
        </div>
      </section>

      {otherLogsOpen ? (
        <div style={overlay()} onClick={() => setOtherLogsOpen(false)}>
          <div style={overlayCard()} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 1000 }}>
                {otherLogsStudent?.student_name || "Student"} • Recent Logs
              </div>
              <button style={btnGhost()} onClick={() => setOtherLogsOpen(false)}>Close</button>
            </div>
            <div style={{ display: "grid", gap: 8, maxHeight: "62vh", overflowY: "auto" }}>
              {otherLogs.map((log) => (
                <article key={`other-log-${log.session_id}`} style={cardStyle(log.on_display)}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 1000 }}>{log.form_name}</div>
                    <span style={chip(Boolean(log.on_display))}>{log.on_display ? "On Display" : "Not Displayed"}</span>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Deductions: {log.deductions_count}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      style={btn()}
                      disabled={busyKey === `push:${log.session_id}`}
                      onClick={() => setSessionDisplay(log.session_id, "push")}
                    >
                      {busyKey === `push:${log.session_id}` ? "Pushing..." : "Push to Display"}
                    </button>
                    {log.on_display ? (
                      <button
                        style={btnGhost()}
                        disabled={busyKey === `remove:${log.session_id}`}
                        onClick={() => setSessionDisplay(log.session_id, "remove")}
                      >
                        {busyKey === `remove:${log.session_id}` ? "Removing..." : "Remove from Display"}
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
              {!otherLogs.length ? <div style={{ opacity: 0.72 }}>No logs found for this student in last 7 days.</div> : null}
            </div>
          </div>
        </div>
      ) : null}

      <style>{`
        @keyframes chipPulse {
          0% { box-shadow: 0 0 0 rgba(34,197,94,0); }
          50% { box-shadow: 0 0 18px rgba(34,197,94,0.55); }
          100% { box-shadow: 0 0 0 rgba(34,197,94,0); }
        }
        @media (max-width: 1100px) {
          main { padding-left: 0 !important; padding-bottom: 92px; }
        }
      `}</style>
    </main>
  );
}

function panel(): React.CSSProperties {
  return {
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.2)",
    background: "rgba(15,23,42,0.58)",
    padding: 12,
    display: "grid",
    gap: 10,
  };
}

function grid(cols: number): React.CSSProperties {
  const min = cols >= 3 ? 220 : 280;
  return {
    display: "grid",
    gap: 10,
    gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
  };
}

function title(): React.CSSProperties {
  return { fontWeight: 1000, fontSize: 16 };
}

function cardStyle(onDisplay?: boolean): React.CSSProperties {
  return {
    borderRadius: 14,
    border: onDisplay ? "1px solid rgba(34,197,94,0.45)" : "1px solid rgba(148,163,184,0.25)",
    background: onDisplay ? "rgba(22,101,52,0.2)" : "rgba(15,23,42,0.55)",
    padding: 12,
    display: "grid",
    gap: 8,
  };
}

function chip(active: boolean): React.CSSProperties {
  return {
    padding: "4px 8px",
    borderRadius: 999,
    border: active ? "1px solid rgba(34,197,94,0.45)" : "1px solid rgba(148,163,184,0.3)",
    background: active ? "rgba(34,197,94,0.18)" : "rgba(15,23,42,0.5)",
    fontSize: 11,
    fontWeight: 900,
  };
}

function btn(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(34,197,94,0.4)",
    background: "rgba(34,197,94,0.22)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function btnGhost(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.3)",
    background: "rgba(15,23,42,0.5)",
    color: "white",
    fontWeight: 900,
    textDecoration: "none",
    cursor: "pointer",
  };
}

function overlay(): React.CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    background: "rgba(2,6,23,0.7)",
    display: "grid",
    placeItems: "center",
    zIndex: 80,
    padding: 16,
  };
}

function overlayCard(): React.CSSProperties {
  return {
    width: "min(920px, 96vw)",
    maxHeight: "90vh",
    overflow: "auto",
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.3)",
    background: "rgba(15,23,42,0.94)",
    padding: 12,
    display: "grid",
    gap: 10,
  };
}

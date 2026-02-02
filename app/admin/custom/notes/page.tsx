"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status})` } };
  }
}

export default function AdminNotesSettingsPage() {
  const [email, setEmail] = useState("");
  const [emailList, setEmailList] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [saved, setSaved] = useState(false);
  const [notes, setNotes] = useState<
    Array<{
      id: string;
      student_name: string;
      body: string;
      urgency: string;
      category: string;
      status: string;
      created_at: string;
      completed_at?: string | null;
    }>
  >([]);
  const [todoMsg, setTodoMsg] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/student-notes/settings", { cache: "no-store" });
      const sj = await safeJson(res);
      if (!sj.ok) return setMsg(sj.json?.error || "Failed to load settings");
      setEmail(String(sj.json?.settings?.todo_notify_email ?? ""));
      setEmailList((sj.json?.settings?.todo_notify_emails ?? []) as string[]);
      setMsg("");
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams({
        status: showCompleted ? "all" : "open",
        limit: "120",
      });
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      const res = await fetch(`/api/student-notes?${params.toString()}`, { cache: "no-store" });
      const sj = await safeJson(res);
      if (!sj.ok) return setTodoMsg(sj.json?.error || "Failed to load notes");
      setNotes((sj.json?.notes ?? []) as any[]);
      setTodoMsg("");
    })();
  }, [showCompleted, categoryFilter]);

  async function markDone(id: string) {
    const res = await fetch("/api/student-notes/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "done" }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setTodoMsg(sj.json?.error || "Failed to update");
    if (!showCompleted) {
      setNotes((prev) => prev.filter((row) => row.id !== id));
    } else {
      setNotes((prev) =>
        prev.map((row) =>
          row.id === id ? { ...row, status: "done", completed_at: new Date().toISOString() } : row
        )
      );
    }
  }

  async function removeNote(id: string) {
    const res = await fetch("/api/student-notes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setTodoMsg(sj.json?.error || "Failed to remove note");
    setNotes((prev) => prev.filter((row) => row.id !== id));
  }

  async function save() {
    setSaved(false);
    setMsg("");
    const res = await fetch("/api/student-notes/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ todo_notify_email: email, todo_notify_emails: emailList }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to save settings");
    setSaved(true);
  }

  return (
    <main style={{ display: "grid", gap: 14 }}>
      <Link href="/admin/custom" style={backLink()}>
        ← Back to Admin Workspace
      </Link>

      <div style={{ fontSize: 22, fontWeight: 1000 }}>Coach Notes & Alerts</div>
      <div style={{ opacity: 0.7, fontSize: 13 }}>
        Configure admin alert email for coach to-do notes and review urgency standards.
      </div>

      {msg ? <div style={notice()}>{msg}</div> : null}
      {saved ? <div style={success()}>Saved.</div> : null}

      <section style={card()}>
        <div style={{ fontWeight: 900 }}>To-Do Alert Email</div>
        <div style={{ opacity: 0.7, fontSize: 12 }}>
          This email will be used for to-do note alerts (email sending requires a provider hookup).
        </div>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin-alerts@example.com"
          style={input()}
        />
        <div style={{ opacity: 0.7, fontSize: 12, marginTop: 6 }}>
          Optional additional recipients (comma or new line separated).
        </div>
        <textarea
          value={emailList.join(", ")}
          onChange={(e) => {
            const list = e.target.value
              .split(/[\n,]/g)
              .map((v) => v.trim())
              .filter(Boolean);
            setEmailList(list);
          }}
          placeholder="coach1@example.com, coach2@example.com"
          style={textarea()}
        />
        {emailList.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
            {emailList.map((addr) => (
              <span key={addr} style={emailChip()}>
                {addr}
              </span>
            ))}
          </div>
        ) : (
          <div style={{ opacity: 0.6, fontSize: 11 }}>No extra recipients added yet.</div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={save} style={saveBtn()}>
            Save Email
          </button>
        </div>
      </section>

      <section style={card()}>
        <div style={{ fontWeight: 900 }}>Urgency Levels</div>
        <div style={{ display: "grid", gap: 6, marginTop: 6, fontSize: 13 }}>
          <div><b>Low</b> — Routine check-in or FYI note.</div>
          <div><b>Medium</b> — Needs follow-up in the next few classes.</div>
          <div><b>High</b> — Important action within 1–2 days.</div>
          <div><b>Critical</b> — Immediate attention required.</div>
        </div>
      </section>

      <section style={card()}>
        <div style={{ fontWeight: 900 }}>Coach View</div>
        <div style={{ opacity: 0.7, fontSize: 12 }}>
          Coaches can view open to-dos at <code>/coach/todo</code>.
        </div>
      </section>

      <section style={card()}>
        <div style={{ fontWeight: 900 }}>Notes & To-Dos</div>
        {todoMsg ? <div style={notice()}>{todoMsg}</div> : null}
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, opacity: 0.7 }}>
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
            />
            Show completed
          </label>
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 11, opacity: 0.6 }}>Filter</div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={input()}
            >
              <option value="all">All</option>
              <option value="todo">To-dos</option>
              <option value="note">Notes</option>
            </select>
          </div>
        </div>
        {notes.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {notes.map((row) => (
              <div key={row.id} style={todoCard(row.status === "done")}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontWeight: 900 }}>{row.student_name}</div>
                  <div style={{ opacity: 0.6, fontSize: 11 }}>{new Date(row.created_at).toLocaleString()}</div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={urgencyChip(row.urgency)}>{String(row.urgency).toUpperCase()}</span>
                  <span style={categoryChip(row.category)}>{String(row.category).toUpperCase()}</span>
                  <span style={{ fontWeight: 800 }}>{row.body}</span>
                  {row.status === "done" ? (
                    <span style={doneBadge()}>
                      DONE{row.completed_at ? ` • ${new Date(row.completed_at).toLocaleString()}` : ""}
                    </span>
                  ) : (
                    <button onClick={() => markDone(row.id)} style={doneBtn()}>
                      {row.category === "todo" ? "Mark done" : "Hide"}
                    </button>
                  )}
                  <button onClick={() => removeNote(row.id)} style={removeBtn()}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ opacity: 0.7 }}>No notes found for this filter.</div>
        )}
      </section>
    </main>
  );
}

function backLink(): React.CSSProperties {
  return {
    color: "#93c5fd",
    textDecoration: "none",
    fontWeight: 700,
  };
}

function card(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    display: "grid",
    gap: 8,
    boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
  };
}

function input(): React.CSSProperties {
  return {
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(15,23,42,0.6)",
    color: "white",
    padding: "8px 10px",
    fontSize: 13,
  };
}

function textarea(): React.CSSProperties {
  return {
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(15,23,42,0.6)",
    color: "white",
    padding: "8px 10px",
    fontSize: 12,
    minHeight: 70,
  };
}

function emailChip(): React.CSSProperties {
  return {
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid rgba(59,130,246,0.5)",
    background: "rgba(59,130,246,0.2)",
    fontSize: 10,
    fontWeight: 800,
  };
}

function saveBtn(): React.CSSProperties {
  return {
    borderRadius: 10,
    border: "1px solid rgba(34,197,94,0.5)",
    background: "rgba(34,197,94,0.2)",
    color: "white",
    padding: "8px 12px",
    fontWeight: 800,
    cursor: "pointer",
  };
}

function notice(): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(248,113,113,0.5)",
    background: "rgba(248,113,113,0.16)",
    fontSize: 12,
    fontWeight: 800,
  };
}

function success(): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(34,197,94,0.5)",
    background: "rgba(34,197,94,0.18)",
    fontSize: 12,
    fontWeight: 800,
  };
}

function todoCard(done = false): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    display: "grid",
    gap: 6,
    opacity: done ? 0.6 : 1,
  };
}

function urgencyChip(level: string): React.CSSProperties {
  const map: Record<string, string> = {
    low: "rgba(16,185,129,0.18)",
    medium: "rgba(250,204,21,0.18)",
    high: "rgba(249,115,22,0.2)",
    critical: "rgba(239,68,68,0.2)",
  };
  const border: Record<string, string> = {
    low: "rgba(16,185,129,0.55)",
    medium: "rgba(250,204,21,0.55)",
    high: "rgba(249,115,22,0.55)",
    critical: "rgba(239,68,68,0.55)",
  };
  const key = map[level] ? level : "medium";
  return {
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 0.4,
    background: map[key],
    border: `1px solid ${border[key]}`,
  };
}

function categoryChip(kind: string): React.CSSProperties {
  const isTodo = kind === "todo";
  return {
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 0.4,
    background: isTodo ? "rgba(59,130,246,0.2)" : "rgba(148,163,184,0.2)",
    border: `1px solid ${isTodo ? "rgba(59,130,246,0.55)" : "rgba(148,163,184,0.45)"}`,
  };
}

function doneBtn(): React.CSSProperties {
  return {
    marginLeft: "auto",
    borderRadius: 999,
    border: "1px solid rgba(34,197,94,0.6)",
    background: "rgba(34,197,94,0.2)",
    color: "white",
    padding: "4px 10px",
    fontSize: 10,
    fontWeight: 900,
    cursor: "pointer",
  };
}

function doneBadge(): React.CSSProperties {
  return {
    marginLeft: "auto",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.5)",
    background: "rgba(148,163,184,0.2)",
    color: "white",
    padding: "4px 10px",
    fontSize: 10,
    fontWeight: 900,
  };
}

function removeBtn(): React.CSSProperties {
  return {
    borderRadius: 999,
    border: "1px solid rgba(248,113,113,0.6)",
    background: "rgba(248,113,113,0.18)",
    color: "white",
    padding: "4px 10px",
    fontSize: 10,
    fontWeight: 900,
    cursor: "pointer",
  };
}

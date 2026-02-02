"use client";

import { useEffect, useState } from "react";
import AuthGate from "@/components/AuthGate";

type TodoRow = {
  id: string;
  student_id: string;
  student_name: string;
  body: string;
  urgency: "low" | "medium" | "high" | "critical";
  created_at: string;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status})` } };
  }
}

export default function CoachTodoPage() {
  return (
    <AuthGate>
      <CoachTodoInner />
    </AuthGate>
  );
}

function CoachTodoInner() {
  const [todos, setTodos] = useState<TodoRow[]>([]);
  const [msg, setMsg] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/student-notes/todo?status=${showCompleted ? "all" : "open"}`, { cache: "no-store" });
      const sj = await safeJson(res);
      if (!sj.ok) return setMsg(sj.json?.error || "Failed to load to-dos");
      setTodos((sj.json?.todos ?? []) as TodoRow[]);
      setMsg("");
    })();
  }, [showCompleted]);

  async function markDone(id: string) {
    const res = await fetch("/api/student-notes/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "done" }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to update");
    setTodos((prev) => prev.map((row) => (row.id === id ? { ...row, status: "done" } : row)));
  }

  return (
    <main style={{ padding: "26px 32px", display: "grid", gap: 16 }}>
      <div>
        <div style={{ fontSize: 26, fontWeight: 1000 }}>Coach To-Do List</div>
        <div style={{ opacity: 0.7, fontSize: 13 }}>Read-only view of open student to-dos.</div>
      </div>
      {msg ? <div style={msgBox()}>{msg}</div> : null}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, opacity: 0.8 }}>
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
          />
          Show completed
        </label>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {todos.length ? (
          todos.map((row) => (
            <div key={row.id} style={todoCard()}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontWeight: 900 }}>{row.student_name}</div>
                <div style={{ opacity: 0.6, fontSize: 11 }}>{new Date(row.created_at).toLocaleString()}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
                <span style={urgencyChip(row.urgency)}>{row.urgency.toUpperCase()}</span>
                <span style={{ opacity: 0.85 }}>{row.body}</span>
                {row.status !== "done" ? (
                  <button onClick={() => markDone(row.id)} style={doneBtn()}>
                    Mark done
                  </button>
                ) : (
                  <span style={doneBadge()}>DONE</span>
                )}
              </div>
            </div>
          ))
        ) : (
          <div style={{ opacity: 0.7 }}>No open to-dos.</div>
        )}
      </div>
    </main>
  );
}

function todoCard(): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    display: "grid",
    gap: 4,
  };
}

function urgencyChip(level: TodoRow["urgency"]): React.CSSProperties {
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
  return {
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 0.4,
    background: map[level],
    border: `1px solid ${border[level]}`,
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

function msgBox(): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(248,113,113,0.5)",
    background: "rgba(248,113,113,0.16)",
    fontSize: 12,
    fontWeight: 800,
  };
}

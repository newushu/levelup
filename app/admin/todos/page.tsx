"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AuthGate from "../../../components/AuthGate";

type AdminTodo = {
  id: string;
  kind: string | null;
  title: string | null;
  body: string;
  urgency: string | null;
  student_id: string | null;
  student_name: string | null;
  status: string | null;
  created_at: string | null;
  due_at?: string | null;
};

type Student = { id: string; name: string };

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 180)}` } };
  }
}

export default function AdminTodosPage() {
  const [pinOk, setPinOk] = useState(false);
  const [tab, setTab] = useState<"open" | "done">("open");
  const [todos, setTodos] = useState<AdminTodo[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  const [kind, setKind] = useState("todo");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [urgency, setUrgency] = useState("normal");
  const [dueDate, setDueDate] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
  const [studentResults, setStudentResults] = useState<Student[]>([]);
  const [student, setStudent] = useState<Student | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ok = window.sessionStorage.getItem("admin_pin_ok") === "1";
    if (!ok) {
      window.location.href = "/admin";
      return;
    }
    setPinOk(true);
  }, []);

  useEffect(() => {
    if (!pinOk) return;
    loadTodos(tab);
  }, [pinOk, tab]);

  useEffect(() => {
    if (!studentQuery.trim()) {
      setStudentResults([]);
      return;
    }
    let active = true;
    (async () => {
      const res = await fetch("/api/students/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: studentQuery.trim() }),
      });
      const data = await safeJson(res);
      if (!active) return;
      if (!data.ok) {
        setStudentResults([]);
      } else {
        setStudentResults((data.json?.students ?? []) as Student[]);
      }
    })();
    return () => {
      active = false;
    };
  }, [studentQuery]);

  async function loadTodos(status: "open" | "done") {
    setLoading(true);
    setMsg("");
    const res = await fetch(`/api/admin-todos?status=${status}&limit=200`, { cache: "no-store" });
    const data = await safeJson(res);
    if (!data.ok) {
      setLoading(false);
      return setMsg(data.json?.error || "Failed to load to-dos");
    }
    setTodos((data.json?.todos ?? []) as AdminTodo[]);
    setLoading(false);
  }

  async function submitTodo() {
    setMsg("");
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    if (!cleanTitle) return setMsg("Title is required.");
    if (!cleanBody) return setMsg("Details are required.");

    const sendKind = kind === "note" ? "other" : kind;
    const payload: Record<string, any> = {
      kind: sendKind,
      title: cleanTitle,
      body: cleanBody,
      urgency,
      student_id: student?.id ?? null,
    };
    if (dueDate) payload.due_at = `${dueDate}T00:00:00`;

    const res = await fetch("/api/admin-todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await safeJson(res);
    if (!data.ok) return setMsg(data.json?.error || "Failed to add to-do.");

    setTitle("");
    setBody("");
    setDueDate("");
    setStudent(null);
    setStudentQuery("");
    setStudentResults([]);
    if (tab === "open") await loadTodos("open");
    setMsg("Saved.");
  }

  async function updateStatus(id: string, status: "open" | "done") {
    setBusy((prev) => ({ ...prev, [id]: true }));
    setMsg("");
    const res = await fetch("/api/admin-todos/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const data = await safeJson(res);
    if (!data.ok) {
      setBusy((prev) => ({ ...prev, [id]: false }));
      return setMsg(data.json?.error || "Failed to update");
    }
    await loadTodos(tab);
    setBusy((prev) => ({ ...prev, [id]: false }));
  }

  if (!pinOk) return null;

  return (
    <AuthGate>
      <main style={page()}>
        <div style={header()}>
          <div>
            <div style={titleStyle()}>Admin To-Do Board</div>
            <div style={subtitle()}>PIN-only workspace for notes, to-dos, urgency, and due dates.</div>
          </div>
          <Link href="/admin/custom" style={backLink()}>
            Back to Admin
          </Link>
        </div>

        {msg ? <div style={notice()}>{msg}</div> : null}

        <div style={grid()}>
          <section style={panel()}>
            <div style={panelTitle()}>Create Note / To-Do</div>
            <div style={{ display: "grid", gap: 10 }}>
              <select value={kind} onChange={(e) => setKind(e.target.value)} style={select()}>
                <option value="todo">To-Do</option>
                <option value="note">Note</option>
                <option value="feature">Feature</option>
                <option value="bug">Bug</option>
              </select>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                style={input()}
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Details / notes"
                style={textarea()}
                rows={4}
              />
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <label style={label()}>Urgency</label>
                  <select value={urgency} onChange={(e) => setUrgency(e.target.value)} style={select()}>
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <label style={label()}>Due date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    style={input()}
                  />
                </div>
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <label style={label()}>Bind to student (optional)</label>
                <input
                  value={studentQuery}
                  onChange={(e) => setStudentQuery(e.target.value)}
                  placeholder="Search student name"
                  style={input()}
                />
                {studentResults.length ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {studentResults.slice(0, 8).map((row) => (
                      <button
                        key={row.id}
                        style={chip()}
                        onClick={() => {
                          setStudent(row);
                          setStudentQuery(row.name);
                          setStudentResults([]);
                        }}
                      >
                        {row.name}
                      </button>
                    ))}
                  </div>
                ) : null}
                {student ? <div style={{ fontSize: 12, opacity: 0.8 }}>Selected: {student.name}</div> : null}
              </div>
              <button onClick={submitTodo} style={primaryBtn()}>
                Save item
              </button>
            </div>
          </section>

          <section style={panel()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={panelTitle()}>To-Do List</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={tabBtn(tab === "open")} onClick={() => setTab("open")}>
                  Open
                </button>
                <button style={tabBtn(tab === "done")} onClick={() => setTab("done")}>
                  Done
                </button>
              </div>
            </div>

            {loading ? <div style={muted()}>Loading...</div> : null}
            {!loading && !todos.length ? <div style={muted()}>No items yet.</div> : null}
            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              {todos.map((todo) => (
                <div key={todo.id} style={todoCard()}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 900 }}>{todo.title || "Untitled"}</div>
                      {todo.student_name ? (
                        <div style={{ fontSize: 12, opacity: 0.75 }}>Student: {todo.student_name}</div>
                      ) : null}
                      <div style={{ fontSize: 11, opacity: 0.65 }}>
                        {todo.due_at ? `Due ${new Date(todo.due_at).toLocaleDateString()}` : "No due date"}
                      </div>
                    </div>
                    <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
                      {todo.urgency ? <div style={urgencyTag(todo.urgency)}>{todo.urgency.toUpperCase()}</div> : null}
                      <button
                        style={smallBtn(todo.status === "done" ? "reopen" : "done")}
                        onClick={() => updateStatus(todo.id, todo.status === "done" ? "open" : "done")}
                        disabled={!!busy[todo.id]}
                      >
                        {todo.status === "done" ? "Reopen" : "Mark done"}
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>{todo.body}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
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
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  };
}

function titleStyle(): React.CSSProperties {
  return {
    fontSize: 26,
    fontWeight: 1000,
  };
}

function subtitle(): React.CSSProperties {
  return {
    opacity: 0.7,
    fontSize: 12,
  };
}

function backLink(): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 12,
  };
}

function notice(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(56,189,248,0.18)",
    color: "white",
    fontWeight: 900,
    fontSize: 12,
  };
}

function grid(): React.CSSProperties {
  return {
    display: "grid",
    gap: 16,
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  };
}

function panel(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    display: "grid",
    gap: 12,
  };
}

function panelTitle(): React.CSSProperties {
  return {
    fontSize: 16,
    fontWeight: 900,
  };
}

function input(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.35)",
    color: "white",
    fontWeight: 900,
    fontSize: 13,
  };
}

function textarea(): React.CSSProperties {
  return {
    ...input(),
    minHeight: 90,
  };
}

function select(): React.CSSProperties {
  return {
    ...input(),
    cursor: "pointer",
  };
}

function label(): React.CSSProperties {
  return {
    fontSize: 11,
    opacity: 0.7,
    fontWeight: 800,
  };
}

function primaryBtn(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(56,189,248,0.5)",
    background: "linear-gradient(135deg, rgba(56,189,248,0.35), rgba(59,130,246,0.2))",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function tabBtn(active: boolean): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: active ? "1px solid rgba(56,189,248,0.6)" : "1px solid rgba(255,255,255,0.2)",
    background: active ? "rgba(56,189,248,0.2)" : "rgba(255,255,255,0.05)",
    color: "white",
    fontWeight: 900,
    fontSize: 11,
    cursor: "pointer",
  };
}

function muted(): React.CSSProperties {
  return {
    fontSize: 12,
    opacity: 0.65,
  };
}

function todoCard(): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(0,0,0,0.2)",
  };
}

function urgencyTag(level: string): React.CSSProperties {
  const norm = String(level || "").toLowerCase();
  const palette: Record<string, string> = {
    low: "rgba(148,163,184,0.35)",
    normal: "rgba(59,130,246,0.35)",
    high: "rgba(249,115,22,0.4)",
    urgent: "rgba(239,68,68,0.45)",
  };
  return {
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: palette[norm] ?? "rgba(148,163,184,0.3)",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 0.4,
  };
}

function smallBtn(kind: "done" | "reopen"): React.CSSProperties {
  return {
    border: "1px solid rgba(255,255,255,0.18)",
    background: kind === "done" ? "rgba(34,197,94,0.25)" : "rgba(248,113,113,0.25)",
    color: "white",
    fontWeight: 900,
    fontSize: 11,
    padding: "6px 10px",
    borderRadius: 999,
    cursor: "pointer",
  };
}

function chip(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 900,
    fontSize: 11,
    cursor: "pointer",
  };
}

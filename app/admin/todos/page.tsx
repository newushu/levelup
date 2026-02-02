"use client";

import { useEffect, useState } from "react";
import AuthGate from "@/components/AuthGate";

type TodoRow = {
  id: string;
  kind: string;
  title?: string | null;
  body: string;
  urgency?: string | null;
  student_name?: string | null;
  status: string;
  created_at: string;
  resolved_at?: string | null;
};

export default function AdminTodosPage() {
  const [todos, setTodos] = useState<TodoRow[]>([]);
  const [msg, setMsg] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadTodos = async () => {
    try {
      const res = await fetch(`/api/admin-todos?status=${showDone ? "done" : "open"}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setMsg(data?.error || "Failed to load to-dos");
        return;
      }
      setTodos((data?.todos ?? []) as TodoRow[]);
      setMsg("");
    } catch (err: any) {
      setMsg(err?.message ?? "Failed to load to-dos");
    }
  };

  useEffect(() => {
    loadTodos();
  }, [showDone]);

  async function setStatus(id: string, status: "open" | "done") {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin-todos/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setMsg(data?.error || "Failed to update status");
        return;
      }
      await loadTodos();
    } catch (err: any) {
      setMsg(err?.message ?? "Failed to update status");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AuthGate>
      <main style={page()}>
        <div style={header()}>
          <div>
            <div style={title()}>Admin To-Dos</div>
            <div style={subTitle()}>Coach submitted notes, feature requests, and bug reports.</div>
          </div>
          <label style={toggle()}>
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
            Show done
          </label>
        </div>
        {msg ? <div style={notice()}>{msg}</div> : null}
        <div style={grid()}>
          {todos.length ? (
            todos.map((row) => (
              <div key={row.id} style={card(row.status === "done")}>
                <div style={cardHeader()}>
                  <span style={chip(row.kind)}>{row.kind.toUpperCase()}</span>
                  <span style={{ fontSize: 11, opacity: 0.7 }}>{new Date(row.created_at).toLocaleString()}</span>
                </div>
                <div style={titleText()}>{row.title || "Untitled"}</div>
                {row.student_name ? (
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Student: {row.student_name}</div>
                ) : null}
                {row.urgency ? <div style={urgencyChip(row.urgency)}>{row.urgency.toUpperCase()}</div> : null}
                <div style={body()}>{row.body}</div>
                <div style={cardFooter()}>
                  {row.status === "done" ? (
                    <span style={doneBadge()}>
                      DONE{row.resolved_at ? ` • ${new Date(row.resolved_at).toLocaleString()}` : ""}
                    </span>
                  ) : (
                    <button style={btn()} onClick={() => setStatus(row.id, "done")} disabled={busyId === row.id}>
                      Mark done
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div style={{ opacity: 0.7 }}>No to-dos found.</div>
          )}
        </div>
      </main>
    </AuthGate>
  );
}

function page(): React.CSSProperties {
  return {
    minHeight: "100vh",
    padding: 24,
    background: "#0b1020",
    color: "white",
    display: "grid",
    gap: 18,
  };
}

function header(): React.CSSProperties {
  return { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" };
}

function title(): React.CSSProperties {
  return { fontSize: 24, fontWeight: 1000 };
}

function subTitle(): React.CSSProperties {
  return { fontSize: 12, opacity: 0.7 };
}

function toggle(): React.CSSProperties {
  return { display: "flex", gap: 8, alignItems: "center", fontSize: 12, opacity: 0.8 };
}

function grid(): React.CSSProperties {
  return { display: "grid", gap: 12 };
}

function card(done: boolean): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: done ? "rgba(148,163,184,0.12)" : "rgba(15,23,42,0.7)",
    display: "grid",
    gap: 10,
  };
}

function cardHeader(): React.CSSProperties {
  return { display: "flex", justifyContent: "space-between", alignItems: "center" };
}

function chip(kind: string): React.CSSProperties {
  const color = kind === "bug" ? "#f87171" : kind === "feature" ? "#38bdf8" : "#facc15";
  return {
    borderRadius: 999,
    padding: "4px 10px",
    border: `1px solid ${color}`,
    color,
    fontWeight: 900,
    fontSize: 11,
    letterSpacing: 0.6,
  };
}

function body(): React.CSSProperties {
  return { fontSize: 14, fontWeight: 700 };
}

function titleText(): React.CSSProperties {
  return { fontSize: 16, fontWeight: 900 };
}

function urgencyChip(urgency: string): React.CSSProperties {
  const level = String(urgency || "").toLowerCase();
  const color =
    level === "urgent" ? "#f43f5e" : level === "high" ? "#f97316" : level === "low" ? "#38bdf8" : "#a3e635";
  return {
    alignSelf: "flex-start",
    borderRadius: 999,
    padding: "4px 10px",
    border: `1px solid ${color}`,
    color,
    fontWeight: 900,
    fontSize: 10,
    letterSpacing: 0.6,
  };
}

function cardFooter(): React.CSSProperties {
  return { display: "flex", justifyContent: "space-between", alignItems: "center" };
}

function btn(): React.CSSProperties {
  return {
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 900,
    padding: "6px 12px",
  };
}

function doneBadge(): React.CSSProperties {
  return {
    borderRadius: 999,
    padding: "4px 10px",
    border: "1px solid rgba(34,197,94,0.5)",
    background: "rgba(34,197,94,0.15)",
    color: "#86efac",
    fontWeight: 900,
    fontSize: 11,
  };
}

function notice(): React.CSSProperties {
  return { fontSize: 12, color: "#fca5a5" };
}

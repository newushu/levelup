"use client";

import { useEffect, useMemo, useState } from "react";
import AuthGate from "@/components/AuthGate";

type ParentRow = {
  id: string;
  name: string;
  email: string;
};

type MessageRow = {
  id: string;
  parent_id: string;
  body: string;
  created_at: string;
  is_from_admin?: boolean;
  thread_key?: string | null;
  coach_user_id?: string | null;
  sender_name?: string | null;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status})` } };
  }
}

export default function ParentMessagesAdminPage() {
  return (
    <AuthGate>
      <ParentMessagesAdminInner />
    </AuthGate>
  );
}

function ParentMessagesAdminInner() {
  const [role, setRole] = useState("student");
  const [parents, setParents] = useState<ParentRow[]>([]);
  const [parentId, setParentId] = useState("");
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [body, setBody] = useState("");
  const [threadKey, setThreadKey] = useState("general");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const sj = await safeJson(res);
      if (sj.ok) setRole(String(sj.json?.role ?? "student"));
    })();
  }, []);

  useEffect(() => {
    if (role !== "admin") return;
    (async () => {
      const res = await fetch("/api/admin/parents/list", { cache: "no-store" });
      const sj = await safeJson(res);
      if (!sj.ok) return setMsg(sj.json?.error || "Failed to load parents");
      const list = (sj.json?.parents ?? []) as ParentRow[];
      setParents(list);
      if (list.length && !parentId) {
        setParentId(list[0].id);
      }
    })();
  }, [role]);

  useEffect(() => {
    if (!parentId) return;
    refreshMessages(parentId);
  }, [parentId]);

  const parentLookup = useMemo(() => {
    const map = new Map<string, ParentRow>();
    parents.forEach((p) => map.set(p.id, p));
    return map;
  }, [parents]);

  const coachThreads = useMemo(() => {
    const set = new Set<string>();
    messages.forEach((row) => {
      const key = String(row.thread_key ?? "");
      if (key.startsWith("coach:")) set.add(key);
    });
    return Array.from(set).sort();
  }, [messages]);

  const coachThreadLabels = useMemo(() => {
    const map = new Map<string, string>();
    messages.forEach((row) => {
      const key = String(row.thread_key ?? "");
      if (!key.startsWith("coach:")) return;
      if (row.is_from_admin && row.sender_name) {
        map.set(key, row.sender_name);
      }
    });
    return map;
  }, [messages]);

  async function refreshMessages(pid: string) {
    const res = await fetch(`/api/admin/parent-messages/list?parent_id=${pid}`, { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to load messages");
    const list = (sj.json?.messages ?? []) as MessageRow[];
    setMessages(list);
    if (list.length) {
      try {
        const latest = list[list.length - 1]?.created_at;
        if (latest) localStorage.setItem("admin_parent_messages_last_seen", latest);
      } catch {}
    }
  }

  async function sendMessage() {
    setMsg("");
    if (!body.trim() || !parentId) return;
    setBusy(true);
    const res = await fetch("/api/admin/parent-messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parent_id: parentId, body, thread_key: threadKey }),
    });
    const sj = await safeJson(res);
    setBusy(false);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to send");
    setBody("");
    refreshMessages(parentId);
  }

  if (role !== "admin") {
    return (
      <main style={{ padding: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Admin access only.</div>
      </main>
    );
  }

  return (
    <main style={{ padding: 18, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ fontSize: 28, fontWeight: 1000 }}>Parent Messages</div>
      <div style={{ opacity: 0.7, marginTop: 6 }}>Direct messages between parents and the academy.</div>
      {msg ? <div style={{ marginTop: 10, opacity: 0.8 }}>{msg}</div> : null}

      <div style={layout()}>
        <div style={sidebar()}>
          {parents.map((p) => (
            <button
              key={p.id}
              onClick={() => setParentId(p.id)}
              style={parentButton(p.id === parentId)}
            >
              <div style={{ fontWeight: 900 }}>{p.name}</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>{p.email}</div>
            </button>
          ))}
          {!parents.length && <div style={{ opacity: 0.7 }}>No parent accounts yet.</div>}
        </div>

        <div style={panel()}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>
            {parentLookup.get(parentId)?.name || "Select a parent"}
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <select value={threadKey} onChange={(e) => setThreadKey(e.target.value)} style={select()}>
              <option value="general">General</option>
              <option value="coach_notes">Important Coach Notes</option>
              <option value="coach_todos">Coach To-Do</option>
              {coachThreads.map((key) => (
                <option key={key} value={key}>
                  Coach DM{coachThreadLabels.get(key) ? ` - ${coachThreadLabels.get(key)}` : ""}
                </option>
              ))}
            </select>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Write a reply..."
              style={textarea()}
            />
            <button onClick={sendMessage} style={btn()} disabled={busy}>
              {busy ? "Sending..." : "Send Reply"}
            </button>
          </div>

          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            {messages.map((m) => (
              <div key={m.id} style={card(m.is_from_admin)}>
                <div style={{ fontWeight: 900 }}>
                  {m.sender_name || (m.is_from_admin ? "Coach/Admin" : "Parent")} • {threadLabel(m.thread_key)}
                </div>
                <div style={{ opacity: 0.85, fontSize: 13 }}>{m.body}</div>
                <div style={{ opacity: 0.6, fontSize: 11 }}>{new Date(m.created_at).toLocaleString()}</div>
              </div>
            ))}
            {!messages.length && <div style={{ opacity: 0.7 }}>No messages yet.</div>}
          </div>
        </div>
      </div>
    </main>
  );
}

function layout(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "minmax(220px, 280px) 1fr",
    gap: 16,
    marginTop: 16,
    alignItems: "start",
  };
}

function sidebar(): React.CSSProperties {
  return {
    display: "grid",
    gap: 10,
  };
}

function panel(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(8,10,15,0.7)",
  };
}

function parentButton(active: boolean): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 12,
    border: `1px solid ${active ? "rgba(59,130,246,0.7)" : "rgba(255,255,255,0.12)"}`,
    background: active ? "rgba(59,130,246,0.15)" : "rgba(8,10,15,0.7)",
    color: "white",
    textAlign: "left",
    cursor: "pointer",
  };
}

function textarea(): React.CSSProperties {
  return {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.4)",
    color: "white",
    fontSize: 14,
    outline: "none",
  };
}

function select(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.4)",
    color: "white",
    fontSize: 13,
    outline: "none",
  };
}

function threadLabel(key?: string | null) {
  const value = String(key ?? "general").toLowerCase();
  if (value === "coach_todos") return "Coach To-Do";
  if (value === "coach_notes") return "Important Coach Notes";
  if (value.startsWith("coach:")) return "Coach DM";
  return "General";
}

function btn(): React.CSSProperties {
  return {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(59,130,246,0.6)",
    background: "linear-gradient(90deg, rgba(59,130,246,0.9), rgba(14,116,144,0.7))",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function card(isAdmin?: boolean): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 12,
    border: `1px solid ${isAdmin ? "rgba(34,197,94,0.45)" : "rgba(255,255,255,0.12)"}`,
    background: isAdmin ? "rgba(34,197,94,0.12)" : "rgba(8,10,15,0.7)",
    display: "grid",
    gap: 6,
    alignSelf: isAdmin ? "flex-end" : "flex-start",
    maxWidth: "80%",
  };
}

"use client";

import { useEffect, useState } from "react";
import AuthGate from "@/components/AuthGate";
import ParentImpersonationBar, { useAdminParentImpersonation } from "@/components/ParentImpersonationBar";

type Message = {
  id: string;
  body: string;
  created_at: string;
  is_from_admin?: boolean;
  thread_key?: string | null;
  student_id?: string | null;
  coach_user_id?: string | null;
  admin_user_id?: string | null;
  sender_name?: string | null;
};

type Coach = {
  id: string;
  name: string;
  email?: string;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status})` } };
  }
}

export default function ParentMessagesPage() {
  return (
    <AuthGate>
      <ParentMessagesInner />
    </AuthGate>
  );
}

function ParentMessagesInner() {
  const [role, setRole] = useState("student");
  const [messages, setMessages] = useState<Message[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeThread, setActiveThread] = useState("general");
  const isParent = role === "parent";
  const isAdmin = role === "admin";
  const canView = isParent || isAdmin;
  const impersonateId = useAdminParentImpersonation(isAdmin);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const sj = await safeJson(res);
      if (sj.ok) setRole(String(sj.json?.role ?? "student"));
    })();
  }, []);

  useEffect(() => {
    if (!isParent && !isAdmin) return;
    if (isAdmin && !impersonateId) return;
    refresh();
  }, [isParent, isAdmin, impersonateId]);

  useEffect(() => {
    if (!isParent && !isAdmin) return;
    if (isAdmin && !impersonateId) return;
    (async () => {
      const parentParam = isAdmin && impersonateId ? `?parent_id=${encodeURIComponent(impersonateId)}` : "";
      const res = await fetch(`/api/parent/coaches${parentParam}`, { cache: "no-store" });
      const sj = await safeJson(res);
      if (!sj.ok) return;
      setCoaches((sj.json?.coaches ?? []) as Coach[]);
    })();
  }, [isParent, isAdmin, impersonateId]);

  useEffect(() => {
    if (!coaches.length) return;
    setActiveThread((prev) => (prev === "general" ? `coach:${coaches[0].id}` : prev));
  }, [coaches]);

  async function refresh() {
    const parentParam = isAdmin && impersonateId ? `?parent_id=${encodeURIComponent(impersonateId)}` : "";
    const res = await fetch(`/api/parent/messages${parentParam}`, { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to load messages.");
    const list = (sj.json?.messages ?? []) as Message[];
    const sorted = list.slice().sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    setMessages(sorted);
    const latestAdmin = sorted.filter((m) => m.is_from_admin).slice(-1)[0];
    if (latestAdmin?.created_at) {
      try {
        localStorage.setItem("parent_messages_last_seen", latestAdmin.created_at);
      } catch {}
    }
  }

  async function send() {
    setMsg("");
    if (!body.trim()) return;
    if (!activeThread.startsWith("coach:")) {
      return setMsg("Select a coach thread to send messages.");
    }
    const coachId = activeThread.split("coach:")[1] || "";
    if (!coachId) return setMsg("Select a coach thread to send messages.");
    setBusy(true);
    const res = await fetch("/api/parent/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, thread_key: activeThread, coach_user_id: coachId }),
    });
    const sj = await safeJson(res);
    setBusy(false);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to send.");
    setBody("");
    refresh();
  }

  const coachById = new Map(coaches.map((coach) => [coach.id, coach]));
  const threadGroups = buildThreadGroups(messages, coachById);
  const threads = orderThreads(threadGroups);
  const activeMessages = threadGroups.get(activeThread)?.messages ?? [];
  const activeMeta = threadGroups.get(activeThread);
  const activeCoachId = activeThread.startsWith("coach:") ? activeThread.split("coach:")[1] : "";
  const activeCoach = coachById.get(activeCoachId);

  if (!canView) {
    return (
      <main style={{ padding: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Parent access only.</div>
      </main>
    );
  }

  return (
    <main style={{ padding: 18, maxWidth: "none", margin: 0, width: "100%" }}>
      <ParentImpersonationBar enabled={isAdmin} />
      {isAdmin ? (
        <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 10, background: "rgba(251,191,36,0.16)", border: "1px solid rgba(251,191,36,0.45)" }}>
          Admin preview: showing data for selected parent.
        </div>
      ) : null}
      <div style={{ fontSize: 26, fontWeight: 1000 }}>Parent Messages</div>
      <div style={{ opacity: 0.7, marginTop: 6 }}>Threaded conversation with the academy team.</div>
      {msg ? <div style={{ marginTop: 10, opacity: 0.8 }}>{msg}</div> : null}

      <div style={layout()}>
        <div style={threadColumn()}>
          {threads.map((thread) => (
            <button
              key={thread.key}
              onClick={() => {
                setActiveThread(thread.key);
                markThreadSeen(thread.key, thread.messages);
              }}
              style={threadCard(thread.key === activeThread)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontWeight: 900 }}>{thread.label}</div>
                {thread.unread ? <span style={threadBadge()}>New</span> : null}
              </div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>
                {thread.lastAt ? new Date(thread.lastAt).toLocaleString() : "No updates yet"}
              </div>
              {thread.pinned ? <div style={pinPill()}>Pinned</div> : null}
            </button>
          ))}
        </div>

        <div style={messagePanel()}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 1000 }}>{activeMeta?.label ?? "General"}</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>
                {activeMeta?.pinned ? "Pinned thread" : "Conversation"}
              </div>
            </div>
            {activeCoach ? (
              <div style={{ fontSize: 12, opacity: 0.7 }}>Messaging coach {activeCoach.name}</div>
            ) : null}
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder={
                activeThread.startsWith("coach:")
                  ? "Write your message to the coach..."
                  : "Select a coach thread to send a message."
              }
              style={textarea()}
              disabled={isAdmin || !activeThread.startsWith("coach:")}
            />
            <button onClick={send} style={btn()} disabled={isAdmin || busy || !activeThread.startsWith("coach:")}>
              {busy ? "Sending..." : "Send Message"}
            </button>
          </div>

          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            {activeMessages.map((m) => (
              <div key={m.id} style={card(m.is_from_admin)}>
                <div style={{ fontWeight: 900 }}>{m.sender_name || (m.is_from_admin ? "Coach" : "You")}</div>
                <div style={{ opacity: 0.85, fontSize: 13 }}>{m.body}</div>
                <div style={{ opacity: 0.6, fontSize: 11 }}>{new Date(m.created_at).toLocaleString()}</div>
              </div>
            ))}
            {!activeMessages.length && <div style={{ opacity: 0.7 }}>No messages yet.</div>}
          </div>
        </div>
      </div>
    </main>
  );
}

function buildThreadGroups(messages: Message[], coachById: Map<string, Coach>) {
  const groups = new Map<
    string,
    { key: string; label: string; pinned: boolean; messages: Message[]; lastAt: string | null; unread: boolean }
  >();
  const threadLabels: Record<string, string> = {
    coach_todos: "Coach To-Do",
    coach_notes: "Important Coach Notes",
    general: "Academy Inbox",
  };

  const threadPinned = new Set(["coach_todos", "coach_notes"]);
  messages.forEach((msg) => {
    const key = String(msg.thread_key ?? "general").toLowerCase() || "general";
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: labelForThread(key, coachById, threadLabels),
        pinned: threadPinned.has(key),
        messages: [],
        lastAt: null,
        unread: false,
      });
    }
    const group = groups.get(key)!;
    group.messages.push(msg);
    group.lastAt = msg.created_at;
  });

  groups.forEach((group) => {
    const lastSeen = (() => {
      try {
        return localStorage.getItem(`parent_thread_last_seen_${group.key}`) || "";
      } catch {
        return "";
      }
    })();
    group.unread = group.messages.some(
      (m) => m.is_from_admin && (!lastSeen || new Date(m.created_at) > new Date(lastSeen))
    );
  });

  if (!groups.has("general")) {
    groups.set("general", {
      key: "general",
      label: "Academy Inbox",
      pinned: false,
      messages: [],
      lastAt: null,
      unread: false,
    });
  }
  if (!groups.has("coach_todos")) {
    groups.set("coach_todos", {
      key: "coach_todos",
      label: "Coach To-Do",
      pinned: true,
      messages: [],
      lastAt: null,
      unread: false,
    });
  }
  if (!groups.has("coach_notes")) {
    groups.set("coach_notes", {
      key: "coach_notes",
      label: "Important Coach Notes",
      pinned: true,
      messages: [],
      lastAt: null,
      unread: false,
    });
  }

  coachById.forEach((coach) => {
    const key = `coach:${coach.id}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: coach.name,
        pinned: false,
        messages: [],
        lastAt: null,
        unread: false,
      });
    }
  });

  return groups;
}

function labelForThread(key: string, coachById: Map<string, Coach>, labels: Record<string, string>) {
  if (key.startsWith("coach:")) {
    const coachId = key.split("coach:")[1] || "";
    const coach = coachById.get(coachId);
    return coach ? coach.name : "Coach Message";
  }
  return labels[key] ?? key.replace("_", " ");
}

function orderThreads(
  groups: Map<string, { key: string; label: string; pinned: boolean; messages: Message[]; lastAt: string | null; unread: boolean }>
) {
  const pinned = Array.from(groups.values()).filter((g) => g.pinned).sort((a, b) => a.label.localeCompare(b.label));
  const rest = Array.from(groups.values())
    .filter((g) => !g.pinned)
    .sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
  return [...pinned, ...rest];
}

function markThreadSeen(threadKey: string, messages: Message[]) {
  const latestAdmin = messages.filter((m) => m.is_from_admin).slice(-1)[0];
  if (!latestAdmin?.created_at) return;
  try {
    localStorage.setItem(`parent_thread_last_seen_${threadKey}`, latestAdmin.created_at);
  } catch {}
}

function textarea(): React.CSSProperties {
  return {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(6,8,14,0.7)",
    color: "white",
    fontSize: 14,
    outline: "none",
  };
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
    border: `1px solid ${isAdmin ? "rgba(34,197,94,0.45)" : "rgba(59,130,246,0.35)"}`,
    background: isAdmin ? "rgba(34,197,94,0.12)" : "rgba(59,130,246,0.12)",
    display: "grid",
    gap: 6,
    boxShadow: "0 14px 24px rgba(0,0,0,0.35)",
    alignSelf: isAdmin ? "flex-start" : "flex-end",
    maxWidth: "80%",
  };
}

function layout(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "minmax(210px, 280px) 1fr",
    gap: 16,
    marginTop: 16,
    alignItems: "start",
  };
}

function threadColumn(): React.CSSProperties {
  return {
    display: "grid",
    gap: 10,
  };
}

function threadCard(active: boolean): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 12,
    border: `1px solid ${active ? "rgba(59,130,246,0.65)" : "rgba(255,255,255,0.12)"}`,
    background: active ? "rgba(59,130,246,0.18)" : "rgba(8,10,15,0.7)",
    color: "white",
    textAlign: "left",
    cursor: "pointer",
    display: "grid",
    gap: 6,
    boxShadow: "0 14px 26px rgba(0,0,0,0.35)",
  };
}

function threadBadge(): React.CSSProperties {
  return {
    padding: "2px 8px",
    borderRadius: 999,
    background: "rgba(248,113,113,0.9)",
    color: "white",
    fontSize: 10,
    fontWeight: 900,
  };
}

function pinPill(): React.CSSProperties {
  return {
    width: "fit-content",
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    fontSize: 10,
    fontWeight: 900,
  };
}

function messagePanel(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "linear-gradient(135deg, rgba(15,23,42,0.9), rgba(2,6,23,0.92))",
    boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
  };
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type StudentRow = { id: string; name: string; level?: number };
type ThreadRow = {
  id: string;
  other_student_id: string;
  other_name: string;
  other_level?: number;
  last_message?: string;
  last_at?: string | null;
  last_sender_id?: string | null;
  is_public?: boolean;
};
type MessageRow = {
  id: string;
  conversation_id: string;
  sender_student_id?: string | null;
  body: string;
  created_at: string;
  sender?: { name?: string | null } | null;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 180)}` } };
  }
}

export default function ChatWidget() {
  const path = usePathname();
  const ADMIN_STUDENT_ID =
    process.env.NEXT_PUBLIC_ADMIN_STUDENT_ID || "1336212a-96da-4f03-b06d-d7527602d643";
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"chats" | "friends">("chats");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [online, setOnline] = useState<StudentRow[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string>("");
  const [activeStudentId, setActiveStudentId] = useState<string>("");
  const [activeStub, setActiveStub] = useState<null | "marketplace">(null);
  const [viewerRole, setViewerRole] = useState("student");
  const [viewerStudentId, setViewerStudentId] = useState("");
  const [input, setInput] = useState("");
  const [msg, setMsg] = useState("");
  const hideWidget = path.startsWith("/classroom") || path.startsWith("/coach/classroom");

  const effectiveStudentId = viewerRole === "student" ? viewerStudentId : ADMIN_STUDENT_ID;

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const sj = await safeJson(res);
      if (!sj.ok) return;
      setViewerRole(String(sj.json?.role ?? "student"));
      setViewerStudentId(String(sj.json?.student_id ?? ""));
    })();
  }, []);

  useEffect(() => {
    if (viewerRole === "student" && viewerStudentId) {
      setActiveStudentId(viewerStudentId);
      return;
    }
    try {
      setActiveStudentId(localStorage.getItem("active_student_id") || "");
    } catch {}
  }, [viewerRole, viewerStudentId]);

  useEffect(() => {
    function onActive(e: Event) {
      if (viewerRole === "student") return;
      const ev = e as CustomEvent<{ student_id?: string }>;
      const next = String(ev.detail?.student_id ?? "").trim();
      if (next) setActiveStudentId(next);
    }
    window.addEventListener("active-student-changed", onActive as EventListener);
    return () => window.removeEventListener("active-student-changed", onActive as EventListener);
  }, [viewerRole]);

  useEffect(() => {
    if (!open || viewerRole !== "student") return;
    (async () => {
      const res = await fetch("/api/public/students-list", { cache: "no-store" });
      const sj = await safeJson(res);
      if (!sj.ok) return;
      setStudents((sj.json?.students ?? []) as StudentRow[]);
    })();
  }, [open, viewerRole]);

  async function refreshThreads() {
    if (!effectiveStudentId) return;
    const res = await fetch(`/api/chat/threads?student_id=${effectiveStudentId}`, { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to load chats");
    setThreads((sj.json?.threads ?? []) as ThreadRow[]);
  }

  async function refreshMessages(threadId: string) {
    if (!threadId) return;
    const res = await fetch(`/api/chat/messages?conversation_id=${threadId}`, { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to load messages");
    setMessages((sj.json?.messages ?? []) as MessageRow[]);
  }

  useEffect(() => {
    if (!open || !effectiveStudentId) return;
    refreshThreads();
  }, [open, effectiveStudentId]);

  useEffect(() => {
    if (!activeThreadId) return;
    refreshMessages(activeThreadId);
  }, [activeThreadId]);

  useEffect(() => {
    if (!open || !activeThreadId) return;
    let t: ReturnType<typeof window.setInterval> | null = null;
    t = setInterval(() => {
      refreshMessages(activeThreadId);
    }, 2500);
    return () => {
      if (t) clearInterval(t);
    };
  }, [open, activeThreadId]);

  useEffect(() => {
    if (!open) return;
    let t: ReturnType<typeof window.setInterval> | null = null;
    (async () => {
      if (viewerRole === "student") {
        await fetch("/api/chat/presence", { method: "POST" });
      } else {
        const res = await fetch("/api/chat/presence", { cache: "no-store" });
        const sj = await safeJson(res);
        if (sj.ok) setOnline((sj.json?.online ?? []) as StudentRow[]);
      }
    })();
    t = setInterval(async () => {
      if (viewerRole === "student") {
        await fetch("/api/chat/presence", { method: "POST" });
      } else {
        const res = await fetch("/api/chat/presence", { cache: "no-store" });
        const sj = await safeJson(res);
        if (sj.ok) setOnline((sj.json?.online ?? []) as StudentRow[]);
      }
    }, 15000);
    return () => {
      if (t) clearInterval(t);
    };
  }, [open, viewerRole]);

  async function startChat(otherId: string) {
    if (!effectiveStudentId || !otherId) return;
    setActiveStub(null);
    const res = await fetch("/api/chat/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: effectiveStudentId, other_student_id: otherId }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to start chat");
    const threadId = String(sj.json?.thread_id ?? "");
    if (threadId) {
      setActiveThreadId(threadId);
      setTab("chats");
      await refreshThreads();
      await refreshMessages(threadId);
    }
  }

  async function sendMessage() {
    if (!effectiveStudentId || !activeThreadId) return;
    const body = input.trim();
    if (!body) return;
    setInput("");
    const res = await fetch("/api/chat/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: activeThreadId, student_id: effectiveStudentId, body }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to send");
    await refreshMessages(activeThreadId);
    await refreshThreads();
  }

  const activeThread = threads.find((t) => t.id === activeThreadId) ?? null;
  const friends = useMemo(
    () => students.filter((s) => s.id !== effectiveStudentId),
    [students, effectiveStudentId]
  );
  const publicThread = threads.find((t) => t.is_public);
  const isAdminView = viewerRole !== "student";
  if (hideWidget) return null;

  return (
    <div style={wrap()}>
      {open ? (
        <div style={panel(!activeThread && !activeStub)}>
          <div style={panelHeader()}>
            <div style={{ fontWeight: 1000 }}>💬 Student Chat</div>
            <button onClick={() => setOpen(false)} style={closeBtn()}>
              ✖
            </button>
          </div>

          {msg ? <div style={notice()}>{msg}</div> : null}

          <div style={tabRow()}>
            <button onClick={() => setTab("chats")} style={tabBtn(tab === "chats")}>
              Chats
            </button>
            <button onClick={() => setTab("friends")} style={tabBtn(tab === "friends")}>
              {isAdminView ? "Online" : "Friends"}
            </button>
          </div>

          <div style={bodyWrap()}>
            <div style={listPane()}>
              {tab === "chats" ? (
                <div style={list()}>
                  {publicThread ? (
                    <button
                      onClick={() => {
                        setActiveStub(null);
                        setActiveThreadId(publicThread.id);
                      }}
                      style={threadRow(activeThreadId === publicThread.id)}
                    >
                      <div style={{ fontWeight: 900 }}>🌐 {publicThread.other_name}</div>
                      <div style={{ fontSize: 11, opacity: 0.7 }}>
                        {publicThread.last_message || "Everyone can chat here"}
                      </div>
                    </button>
                  ) : null}
                  <button
                    onClick={() => {
                      setActiveThreadId("");
                      setActiveStub("marketplace");
                    }}
                    style={threadRow(activeStub === "marketplace")}
                  >
                    <div style={{ fontWeight: 900, display: "flex", alignItems: "center", gap: 6 }}>
                      <span>🛍️ Marketplace</span>
                      <span style={comingSoonPill()}>Coming Soon</span>
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>
                      Marketplace chat room (preview)
                    </div>
                  </button>
                  {!threads.length && <div style={empty()}>No chats yet.</div>}
                  {threads.filter((t) => !t.is_public).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setActiveStub(null);
                        setActiveThreadId(t.id);
                      }}
                      style={threadRow(activeThreadId === t.id)}
                    >
                      <div style={{ fontWeight: 900 }}>{t.other_name}</div>
                      <div style={{ fontSize: 11, opacity: 0.7 }}>
                        {t.last_message || "No messages yet"}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div style={list()}>
                  {!isAdminView ? (
                    <>
                      <button onClick={() => startChat(ADMIN_STUDENT_ID)} style={threadRow(false)}>
                        <div style={{ fontWeight: 900 }}>👑 Chat to Admin</div>
                        <div style={{ fontSize: 11, opacity: 0.7 }}>Direct line</div>
                      </button>
                      {!friends.length && <div style={empty()}>No students found.</div>}
                      {friends.map((s) => (
                        <button key={s.id} onClick={() => startChat(s.id)} style={threadRow(false)}>
                          <div style={{ fontWeight: 900 }}>{s.name}</div>
                          <div style={{ fontSize: 11, opacity: 0.7 }}>Lv {s.level ?? 0}</div>
                        </button>
                      ))}
                    </>
                  ) : (
                    <>
                      {!online.length && <div style={empty()}>No students online.</div>}
                      {online.map((s) => (
                        <button key={s.id} onClick={() => startChat(s.id)} style={threadRow(false)}>
                          <div style={{ fontWeight: 900 }}>{s.name}</div>
                          <div style={{ fontSize: 11, opacity: 0.7 }}>Lv {s.level ?? 0}</div>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            <div style={chatPane()}>
              {!activeThread && !activeStub ? (
                <div style={empty()}>Select a chat to begin.</div>
              ) : activeStub === "marketplace" ? (
                <div style={marketplaceStub()}>
                  <div style={{ fontWeight: 1000, marginBottom: 6 }}>🛍️ Marketplace Chat</div>
                  <div style={{ opacity: 0.7 }}>
                    Coming soon. This space will host marketplace conversations and offers.
                  </div>
                </div>
              ) : (
                <>
                  <div style={chatHeader()}>
                    <div style={{ fontWeight: 1000 }}>
                      {activeThread.other_name}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>
                      Lv {activeThread.other_level ?? 0}
                    </div>
                  </div>
                  <div style={messageList()}>
                    {messages.map((m) => {
                      const mine = String(m.sender_student_id ?? "") === String(effectiveStudentId);
                      const senderName = String(m.sender?.name ?? "").trim();
                      return (
                        <div key={m.id} style={messageRow(mine)}>
                          <div style={messageBubble(mine)}>{m.body}</div>
                          <div style={{ fontSize: 10, opacity: 0.6 }}>
                            {senderName ? `${senderName} • ` : ""}
                            {new Date(m.created_at).toLocaleTimeString()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={composer()}>
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") sendMessage();
                      }}
                      placeholder="Type a message..."
                      style={composerInput()}
                    />
                    <button onClick={sendMessage} style={sendBtn()}>
                      ➤
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} style={launcher()}>
          💬 Chat
        </button>
      )}
    </div>
  );
}

function wrap(): React.CSSProperties {
  return {
    position: "fixed",
    left: 18,
    bottom: 24,
    zIndex: 900,
    display: "flex",
  };
}

function launcher(): React.CSSProperties {
  return {
    padding: "12px 16px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "linear-gradient(90deg, rgba(59,130,246,0.45), rgba(34,197,94,0.35))",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    marginLeft: 50,
  };
}

function panel(expanded: boolean): React.CSSProperties {
  return {
    width: 620,
    height: "100%",
    maxHeight: expanded ? 860 : 640,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(6,10,18,0.98)",
    boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
    display: "grid",
    gridTemplateRows: "auto auto 1fr",
    overflow: "hidden",
  };
}

function panelHeader(): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 14px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  };
}

function closeBtn(): React.CSSProperties {
  return {
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    borderRadius: 10,
    padding: "4px 8px",
    cursor: "pointer",
  };
}

function notice(): React.CSSProperties {
  return {
    padding: "6px 12px",
    background: "rgba(239,68,68,0.18)",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    fontSize: 12,
    fontWeight: 900,
  };
}

function tabRow(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  };
}

function tabBtn(active: boolean): React.CSSProperties {
  return {
    padding: "10px 12px",
    background: active ? "rgba(59,130,246,0.18)" : "transparent",
    border: "none",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function bodyWrap(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "160px 1fr",
    height: "100%",
    minHeight: 0,
  };
}

function listPane(): React.CSSProperties {
  return {
    borderRight: "1px solid rgba(255,255,255,0.08)",
    overflowY: "auto",
  };
}

function list(): React.CSSProperties {
  return {
    display: "grid",
    gap: 6,
    padding: 10,
  };
}

function threadRow(active: boolean): React.CSSProperties {
  return {
    textAlign: "left",
    padding: "8px 10px",
    borderRadius: 12,
    border: active ? "1px solid rgba(59,130,246,0.45)" : "1px solid rgba(255,255,255,0.08)",
    background: active ? "rgba(59,130,246,0.18)" : "rgba(255,255,255,0.03)",
    color: "white",
    cursor: "pointer",
  };
}

function comingSoonPill(): React.CSSProperties {
  return {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    padding: "2px 6px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.45)",
    background: "rgba(148,163,184,0.16)",
    color: "rgba(255,255,255,0.9)",
  };
}

function chatPane(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateRows: "auto 1fr auto",
    minHeight: 0,
    overflow: "hidden",
  };
}

function chatHeader(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  };
}

function messageList(): React.CSSProperties {
  return {
    padding: 12,
    display: "grid",
    gap: 10,
    overflowY: "auto",
    minHeight: 0,
    maxHeight: "100%",
  };
}

function messageRow(mine: boolean): React.CSSProperties {
  return {
    display: "grid",
    justifyItems: mine ? "end" : "start",
    gap: 4,
  };
}

function messageBubble(mine: boolean): React.CSSProperties {
  return {
    maxWidth: 220,
    padding: "8px 10px",
    borderRadius: 12,
    background: mine ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
  };
}

function composer(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 8,
    padding: 10,
    borderTop: "1px solid rgba(255,255,255,0.08)",
  };
}

function composerInput(): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.05)",
    color: "white",
    outline: "none",
  };
}

function sendBtn(): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "linear-gradient(90deg, rgba(34,197,94,0.8), rgba(59,130,246,0.8))",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function empty(): React.CSSProperties {
  return {
    padding: 10,
    opacity: 0.7,
    fontSize: 12,
  };
}

function marketplaceStub(): React.CSSProperties {
  return {
    padding: 14,
    minHeight: 220,
    margin: 12,
    borderRadius: 14,
    border: "1px dashed rgba(148,163,184,0.45)",
    background: "rgba(15,23,42,0.6)",
    fontSize: 12,
    display: "grid",
    alignContent: "center",
    gap: 8,
    textAlign: "center",
  };
}

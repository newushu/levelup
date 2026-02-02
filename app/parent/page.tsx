"use client";

import { useEffect, useMemo, useState } from "react";
import AuthGate from "@/components/AuthGate";

type ParentStudent = {
  id: string;
  name: string;
  level?: number;
  points_total?: number;
  points_balance?: number;
  is_competition_team?: boolean;
  avatar_storage_path?: string | null;
  avatar_zoom_pct?: number;
  avatar_url?: string | null;
  relationship_type?: string;
};

type WeeklyStatus = {
  limit: number;
  used: number;
  week_start: string;
};
type ParentRequest = {
  id: string;
  status: string;
  student_names: string[];
  created_at: string;
} | null;

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status})` } };
  }
}

export default function ParentPortalPage() {
  return (
    <AuthGate>
      <ParentPortalInner />
    </AuthGate>
  );
}

function ParentPortalInner() {
  const [role, setRole] = useState("student");
  const [students, setStudents] = useState<ParentStudent[]>([]);
  const [status, setStatus] = useState<WeeklyStatus | null>(null);
  const [request, setRequest] = useState<ParentRequest>(null);
  const [msg, setMsg] = useState("");
  const [unreadMessages, setUnreadMessages] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const sj = await safeJson(res);
      if (sj.ok) setRole(String(sj.json?.role ?? "student"));
    })();
  }, []);

  useEffect(() => {
    if (role !== "parent") return;
    (async () => {
      const sRes = await fetch("/api/parent/students", { cache: "no-store" });
      const sJson = await safeJson(sRes);
      if (!sJson.ok) return setMsg(sJson.json?.error || "Failed to load students.");
      setStudents((sJson.json?.students ?? []) as ParentStudent[]);

      const wRes = await fetch("/api/parent/weekly-status", { cache: "no-store" });
      const wJson = await safeJson(wRes);
      if (wJson.ok) setStatus(wJson.json as WeeklyStatus);

      const rRes = await fetch("/api/parent/request/status", { cache: "no-store" });
      const rJson = await safeJson(rRes);
      if (rJson.ok) setRequest((rJson.json?.request ?? null) as ParentRequest);

      const mRes = await fetch("/api/parent/messages", { cache: "no-store" });
      const mJson = await safeJson(mRes);
      if (mJson.ok) {
        const list = (mJson.json?.messages ?? []) as Array<{ created_at: string; is_from_admin?: boolean; thread_key?: string }>;
        const hasUnread = list.some((m) => {
          if (!m.is_from_admin) return false;
          const threadKey = String(m.thread_key ?? "general").toLowerCase() || "general";
          const lastSeen = (() => {
            try {
              return localStorage.getItem(`parent_thread_last_seen_${threadKey}`) || "";
            } catch {
              return "";
            }
          })();
          return !lastSeen || new Date(m.created_at) > new Date(lastSeen);
        });
        setUnreadMessages(hasUnread);
      }
    })();
  }, [role]);

  const pct = useMemo(() => {
    if (!status) return 0;
    if (status.limit <= 0) return 0;
    return Math.min(100, Math.round((status.used / status.limit) * 100));
  }, [status]);

  function openDashboardFor(studentId: string) {
    try {
      localStorage.setItem("active_student_id", studentId);
    } catch {}
    window.location.href = "/dashboard";
  }

  if (role !== "parent") {
    return (
      <main style={{ padding: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Parent access only.</div>
      </main>
    );
  }

  return (
    <main style={{ padding: 18, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 28, fontWeight: 1000 }}>Parent Portal</div>
        {unreadMessages ? <span style={notifPill()}>New Message</span> : null}
      </div>
      <div style={{ opacity: 0.7, marginTop: 6 }}>Approve at-home tasks and view your student dashboards.</div>
      {msg ? <div style={{ marginTop: 10, opacity: 0.8 }}>{msg}</div> : null}

      <div style={statusCard()}>
        <div style={{ fontWeight: 900 }}>Weekly Points Limit</div>
        <div style={{ fontSize: 20, fontWeight: 1000 }}>
          {status?.used ?? 0} / {status?.limit ?? 0} pts
        </div>
        <div style={progressTrack()}>
          <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg, rgba(59,130,246,0.9), rgba(34,197,94,0.8))" }} />
        </div>
      </div>

      <div style={grid()}>
        <a href="/home-quest" style={card()}>
          <div style={{ fontWeight: 1000 }}>Approve At-Home Tasks</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Review and approve home quest entries.</div>
        </a>
        <a href="/parent/pin" style={card()}>
          <div style={{ fontWeight: 1000 }}>Set / Reset Parent PIN</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Update the PIN for task approvals.</div>
        </a>
        <a href="/parent/pairing-request" style={card()}>
          <div style={{ fontWeight: 1000 }}>Request Student Pairing</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Add another student by name.</div>
        </a>
        <a href="/parent/messages" style={card()}>
          <div style={{ fontWeight: 1000 }}>Message Coaches</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Send a note to the academy.</div>
        </a>
        <a href="/parent/announcements" style={card()}>
          <div style={{ fontWeight: 1000 }}>Important Announcements</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>School closures and schedule updates.</div>
        </a>
        <a href="/parent/rewards" style={card()}>
          <div style={{ fontWeight: 1000 }}>Rewards & Discounts</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Available rewards and promos.</div>
        </a>
        <div style={card()}>
          <div style={{ fontWeight: 1000 }}>Account Info</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Email, name, and address (coming soon).</div>
        </div>
        <div style={card()}>
          <div style={{ fontWeight: 1000 }}>Email Reports</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Weekly reports will be sent to your email.</div>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>Your Students</div>
        {!students.length ? (
          <div style={pendingCard()}>
            <div style={{ fontWeight: 1000 }}>Pending approval</div>
            <div style={{ opacity: 0.75, fontSize: 12 }}>
              We received your request. Please allow up to 24 hours for pairing.
            </div>
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
              Requested students: {request?.student_names?.length ? request.student_names.join(", ") : "None provided"}
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            {students.map((s) => (
              <button key={s.id} onClick={() => openDashboardFor(s.id)} style={studentCard()}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={avatarCircle()}>
                    {s.avatar_url ? (
                      <img
                        src={s.avatar_url}
                        alt={s.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          transform: `scale(${(s.avatar_zoom_pct ?? 100) / 100})`,
                        }}
                      />
                    ) : (
                      <div style={avatarFallback()}>{(s.name || "?").slice(0, 1)}</div>
                    )}
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontWeight: 1000, fontSize: 18 }}>{s.name}</div>
                    <div style={{ opacity: 0.75, fontSize: 12 }}>
                      Lv {s.level ?? 0} • Balance {s.points_balance ?? 0} pts {s.is_competition_team ? "⭐" : ""}
                    </div>
                    {s.relationship_type ? (
                      <div style={{ fontSize: 11, opacity: 0.6 }}>{s.relationship_type}</div>
                    ) : null}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function grid(): React.CSSProperties {
  return {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    marginTop: 16,
  };
}

function card(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(8,10,15,0.7)",
    color: "white",
    textDecoration: "none",
    display: "grid",
    gap: 6,
  };
}

function statusCard(): React.CSSProperties {
  return {
    marginTop: 14,
    borderRadius: 16,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(8,10,15,0.7)",
    display: "grid",
    gap: 8,
  };
}

function progressTrack(): React.CSSProperties {
  return {
    height: 10,
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  };
}

function studentCard(): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.6)",
    color: "white",
    textAlign: "left",
    display: "grid",
    gap: 6,
    cursor: "pointer",
    minHeight: 120,
  };
}

function pendingCard(): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 14,
    border: "1px solid rgba(250,204,21,0.35)",
    background: "rgba(250,204,21,0.08)",
    display: "grid",
    gap: 6,
  };
}

function avatarCircle(): React.CSSProperties {
  return {
    width: 72,
    height: 72,
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(15,23,42,0.6)",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
  };
}

function avatarFallback(): React.CSSProperties {
  return {
    width: "100%",
    height: "100%",
    display: "grid",
    placeItems: "center",
    fontWeight: 1000,
    fontSize: 20,
    color: "rgba(255,255,255,0.75)",
  };
}

function notifPill(): React.CSSProperties {
  return {
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(248,113,113,0.6)",
    background: "rgba(248,113,113,0.18)",
    fontSize: 11,
    fontWeight: 900,
    color: "white",
  };
}

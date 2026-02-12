"use client";

import { useEffect, useMemo, useState } from "react";
import AuthGate from "@/components/AuthGate";
import ParentImpersonationBar, { useAdminParentImpersonation } from "@/components/ParentImpersonationBar";

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
  const [activeStudentId, setActiveStudentId] = useState("");
  const [status, setStatus] = useState<WeeklyStatus | null>(null);
  const [request, setRequest] = useState<ParentRequest>(null);
  const [msg, setMsg] = useState("");
  const [unreadMessages, setUnreadMessages] = useState(false);
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
    const parentParam = isAdmin && impersonateId ? `?parent_id=${encodeURIComponent(impersonateId)}` : "";
    (async () => {
      const sRes = await fetch(`/api/parent/students${parentParam}`, { cache: "no-store" });
      const sJson = await safeJson(sRes);
      if (!sJson.ok) return setMsg(sJson.json?.error || "Failed to load students.");
      const list = (sJson.json?.students ?? []) as ParentStudent[];
      setStudents(list);
      if (list.length) {
        const stored = (() => {
          try {
            return localStorage.getItem("parent_active_student_id") || "";
          } catch {
            return "";
          }
        })();
        const first = list[0]?.id ?? "";
        const nextId = list.some((s) => s.id === stored) ? stored : first;
        setActiveStudentId(nextId);
      }

      const wRes = await fetch(`/api/parent/weekly-status${parentParam}`, { cache: "no-store" });
      const wJson = await safeJson(wRes);
      if (wJson.ok) setStatus(wJson.json as WeeklyStatus);

      const rRes = await fetch(`/api/parent/request/status${parentParam}`, { cache: "no-store" });
      const rJson = await safeJson(rRes);
      if (rJson.ok) setRequest((rJson.json?.request ?? null) as ParentRequest);

      const mRes = await fetch(`/api/parent/messages${parentParam}`, { cache: "no-store" });
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
  }, [isParent, isAdmin, impersonateId]);

  const pct = useMemo(() => {
    if (!status) return 0;
    if (status.limit <= 0) return 0;
    return Math.min(100, Math.round((status.used / status.limit) * 100));
  }, [status]);

  const activeStudent = useMemo(
    () => students.find((s) => s.id === activeStudentId) ?? students[0],
    [students, activeStudentId]
  );

  function openDashboardFor(studentId: string) {
    try {
      localStorage.setItem("active_student_id", studentId);
    } catch {}
    window.location.href = "/dashboard";
  }

  function setActiveStudent(nextId: string) {
    setActiveStudentId(nextId);
    try {
      localStorage.setItem("parent_active_student_id", nextId);
    } catch {}
  }

  if (!canView) {
    return (
      <main style={{ padding: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Parent access only.</div>
      </main>
    );
  }

  return (
    <main style={{ padding: 18, maxWidth: "none", margin: 0, width: "100%" }}>
      <style>{`
        @media (max-width: 720px) {
          .parent-hero {
            padding: 14px;
          }
          .parent-student-hero {
            grid-template-columns: 1fr !important;
            text-align: center;
          }
          .parent-student-hero .parent-avatar {
            margin: 0 auto;
            width: 120px !important;
            height: 120px !important;
          }
          .parent-student-hero .parent-actions {
            width: 100%;
          }
          .parent-student-hero .parent-actions button {
            width: 100%;
          }
          .parent-student-select {
            width: 100%;
          }
        }
      `}</style>
      <ParentImpersonationBar enabled={isAdmin} />
      {isAdmin ? (
        <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 10, background: "rgba(251,191,36,0.16)", border: "1px solid rgba(251,191,36,0.45)" }}>
          Admin preview: showing data for selected parent.
        </div>
      ) : null}
      <div style={hero()} className="parent-hero">
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 26, fontWeight: 1000 }}>Parent Portal</div>
              {unreadMessages ? <span style={notifPill()}>New Message</span> : null}
            </div>
            {students.length > 1 ? (
              <select
                value={activeStudent?.id ?? ""}
                onChange={(e) => setActiveStudent(e.target.value)}
                style={studentSelect()}
                className="parent-student-select"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          <div style={{ opacity: 0.8, fontSize: 13 }}>Approve at-home tasks and view your student dashboards.</div>
        </div>

        <div style={studentHero()} className="parent-student-hero">
          <div style={avatarHero()} className="parent-avatar">
            {activeStudent?.avatar_url ? (
              <img
                src={activeStudent.avatar_url}
                alt={activeStudent.name}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  transform: `scale(${(activeStudent.avatar_zoom_pct ?? 100) / 100})`,
                }}
              />
            ) : (
              <div style={avatarFallback()}>{(activeStudent?.name || "?").slice(0, 1)}</div>
            )}
          </div>
          <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 1000, overflow: "hidden", textOverflow: "ellipsis" }}>
              {activeStudent?.name ?? "Student"}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={statPill("level")}>Lv {activeStudent?.level ?? 0}</span>
              <span style={statPill("points")}>{activeStudent?.points_balance ?? 0} pts</span>
              {activeStudent?.is_competition_team ? <span style={statPill("team")}>Competition</span> : null}
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontWeight: 900, fontSize: 12 }}>Weekly Points Limit</div>
              <div style={{ fontSize: 18, fontWeight: 1000 }}>
                {status?.used ?? 0} / {status?.limit ?? 0} pts
              </div>
              <div style={progressTrack()}>
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: "linear-gradient(90deg, rgba(59,130,246,0.95), rgba(34,197,94,0.9))",
                  }}
                />
              </div>
            </div>
          </div>
          <div className="parent-actions">
            <button
              style={primaryBtn()}
              onClick={() => activeStudent?.id && openDashboardFor(activeStudent.id)}
              disabled={!activeStudent?.id}
            >
              Open Dashboard
            </button>
          </div>
        </div>
      </div>

      {msg ? <div style={{ marginTop: 10, opacity: 0.8 }}>{msg}</div> : null}

      <div style={cardScrollerWrap()}>
        <div style={cardScroller()}>
          {portalCard("/parent/home-quest", "Home Quest", "Award points and manage home challenges.", "quest")}
          {portalCard("/parent/pin", "Set / Reset Parent PIN", "Update the PIN for task approvals.", "pin")}
          {portalCard("/parent/pairing-request", "Request Student Pairing", "Add another student by name.", "pair")}
          {portalCard("/parent/messages", "Message Coaches", "Send a note to the academy.", "msg")}
          {portalCard("/parent/announcements", "Important Announcements", "School closures and schedule updates.", "announce")}
          {portalCard("/parent/rewards", "Rewards & Discounts", "Available rewards and promos.", "reward")}
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>Your Students</div>
      {isAdmin ? (
        <div style={pendingCard()}>
          <div style={{ fontWeight: 1000 }}>Admin preview</div>
          <div style={{ opacity: 0.75, fontSize: 12 }}>Student list is available for parent accounts only.</div>
        </div>
      ) : !students.length ? (
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
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
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

function hero(): React.CSSProperties {
  return {
    borderRadius: 20,
    padding: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background:
      "radial-gradient(circle at top left, rgba(59,130,246,0.2), transparent 45%), radial-gradient(circle at top right, rgba(34,197,94,0.15), transparent 50%), rgba(7,10,16,0.9)",
    display: "grid",
    gap: 14,
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

function studentHero(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "96px 1fr auto",
    gap: 14,
    alignItems: "center",
    background: "rgba(15,23,42,0.6)",
    borderRadius: 18,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.12)",
  };
}

function avatarHero(): React.CSSProperties {
  return {
    width: 92,
    height: 92,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(10,16,30,0.8)",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
  };
}

function studentSelect(): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(0,0,0,0.4)",
    color: "white",
    fontWeight: 900,
    fontSize: 12,
  };
}

function statPill(kind: "level" | "points" | "team"): React.CSSProperties {
  const color =
    kind === "level"
      ? "rgba(59,130,246,0.25)"
      : kind === "points"
      ? "rgba(34,197,94,0.22)"
      : "rgba(250,204,21,0.2)";
  const border =
    kind === "level"
      ? "rgba(59,130,246,0.6)"
      : kind === "points"
      ? "rgba(34,197,94,0.55)"
      : "rgba(250,204,21,0.6)";
  return {
    padding: "4px 10px",
    borderRadius: 999,
    border: `1px solid ${border}`,
    background: color,
    fontSize: 11,
    fontWeight: 900,
  };
}

function primaryBtn(): React.CSSProperties {
  return {
    marginTop: 6,
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid rgba(34,197,94,0.6)",
    background: "linear-gradient(135deg, rgba(34,197,94,0.95), rgba(59,130,246,0.85))",
    color: "white",
    fontWeight: 1000,
    cursor: "pointer",
    justifySelf: "stretch",
  };
}

function cardScrollerWrap(): React.CSSProperties {
  return {
    marginTop: 16,
    overflow: "hidden",
  };
}

function cardScroller(): React.CSSProperties {
  return {
    display: "flex",
    gap: 14,
    overflowX: "auto",
    paddingBottom: 6,
    scrollSnapType: "x mandatory",
  };
}

function portalCard(href: string, title: string, subtitle: string, tone: "quest" | "pin" | "pair" | "msg" | "announce" | "reward") {
  const palette: Record<string, { bg: string; border: string; glow: string }> = {
    quest: { bg: "rgba(59,130,246,0.18)", border: "rgba(59,130,246,0.6)", glow: "rgba(59,130,246,0.35)" },
    pin: { bg: "rgba(14,116,144,0.18)", border: "rgba(14,116,144,0.6)", glow: "rgba(14,116,144,0.35)" },
    pair: { bg: "rgba(168,85,247,0.18)", border: "rgba(168,85,247,0.6)", glow: "rgba(168,85,247,0.35)" },
    msg: { bg: "rgba(34,197,94,0.18)", border: "rgba(34,197,94,0.6)", glow: "rgba(34,197,94,0.35)" },
    announce: { bg: "rgba(250,204,21,0.16)", border: "rgba(250,204,21,0.6)", glow: "rgba(250,204,21,0.35)" },
    reward: { bg: "rgba(248,113,113,0.18)", border: "rgba(248,113,113,0.6)", glow: "rgba(248,113,113,0.35)" },
  };
  const style = palette[tone];
  return (
    <a
      key={href}
      href={href}
      style={{
        minWidth: 260,
        maxWidth: 320,
        flex: "0 0 auto",
        borderRadius: 18,
        padding: 18,
        border: `1px solid ${style.border}`,
        background: `linear-gradient(180deg, ${style.bg}, rgba(8,10,15,0.7))`,
        color: "white",
        textDecoration: "none",
        display: "grid",
        gap: 8,
        scrollSnapAlign: "start",
        boxShadow: `0 18px 30px ${style.glow}`,
      }}
    >
      <div style={{ fontWeight: 1000, fontSize: 18 }}>{title}</div>
      <div style={{ opacity: 0.85, fontSize: 13 }}>{subtitle}</div>
      <div style={{ marginTop: 6, fontSize: 11, opacity: 0.7 }}>Tap to open</div>
    </a>
  );
}

function studentCard(): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.6)",
    color: "white",
    textAlign: "left",
    display: "grid",
    gap: 6,
    cursor: "pointer",
    minHeight: 128,
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

"use client";

import { useEffect, useMemo, useState } from "react";
import AuthGate from "@/components/AuthGate";
import AvatarRender from "@/components/AvatarRender";
import ParentImpersonationBar, { useAdminParentImpersonation } from "@/components/ParentImpersonationBar";

type HomeQuestSettings = {
  max_points: number;
  features: {
    games: boolean;
    home_tracker: boolean;
    daily_checkin: boolean;
    quiz: boolean;
  };
};

type Progress = {
  total: number;
  max: number;
};

type Tracker = {
  id: string;
  skill_name: string;
  target_reps: number;
  created_at: string;
  completed_at?: string | null;
};

type ParentStudent = {
  id: string;
  name: string;
  level?: number | null;
  points_total?: number | null;
  points_balance?: number | null;
  avatar_url?: string | null;
  avatar_zoom_pct?: number | null;
};

type HomeChallengeRow = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  tier?: string | null;
  points_awarded?: number | null;
};

type ParentChallengeRow = HomeChallengeRow & {
  status?: string | null;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status})` } };
  }
}

export default function ParentHomeQuestPage() {
  return (
    <AuthGate>
      <ParentHomeQuestInner />
    </AuthGate>
  );
}

function ParentHomeQuestInner() {
  const [role, setRole] = useState("student");
  const [students, setStudents] = useState<ParentStudent[]>([]);
  const [activeStudentId, setActiveStudentId] = useState("");
  const [settings, setSettings] = useState<HomeQuestSettings | null>(null);
  const [progress, setProgress] = useState<Progress>({ total: 0, max: 0 });
  const [tracker, setTracker] = useState<Tracker | null>(null);
  const [trackerName, setTrackerName] = useState("");
  const [trackerTarget, setTrackerTarget] = useState(5);
  const [parentPin, setParentPin] = useState("");
  const [msg, setMsg] = useState("");
  const [homeChallenges, setHomeChallenges] = useState<HomeChallengeRow[]>([]);
  const [parentChallenges, setParentChallenges] = useState<ParentChallengeRow[]>([]);
  const [limits, setLimits] = useState<{ max_parent_challenges: number; current_parent_challenges: number } | null>(
    null
  );
  const [newChallengeName, setNewChallengeName] = useState("");
  const [newChallengeDesc, setNewChallengeDesc] = useState("");
  const [newChallengePoints, setNewChallengePoints] = useState(15);

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
      const res = await fetch(`/api/parent/students${parentParam}`, { cache: "no-store" });
      const sj = await safeJson(res);
      if (!sj.ok) return setMsg(sj.json?.error || "Failed to load students");
      const list = (sj.json?.students ?? []) as ParentStudent[];
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
    })();
  }, [isParent, isAdmin, impersonateId]);

  useEffect(() => {
    if (!activeStudentId) return;
    const parentParam = isAdmin && impersonateId ? `?parent_id=${encodeURIComponent(impersonateId)}` : "";
    loadSettings();
    loadProgress(activeStudentId);
    loadTracker(activeStudentId);
    loadChallenges(parentParam);
  }, [activeStudentId, isAdmin, impersonateId]);

  const activeStudent = useMemo(
    () => students.find((s) => s.id === activeStudentId) ?? students[0] ?? null,
    [students, activeStudentId]
  );

  function setActiveStudent(nextId: string) {
    setActiveStudentId(nextId);
    try {
      localStorage.setItem("parent_active_student_id", nextId);
    } catch {}
  }

  async function loadSettings() {
    const res = await fetch("/api/home-quest/settings", { cache: "no-store" });
    const sj = await safeJson(res);
    if (sj.ok) setSettings(sj.json?.settings as HomeQuestSettings);
  }

  async function loadProgress(studentId: string) {
    const res = await fetch("/api/home-quest/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId }),
    });
    const sj = await safeJson(res);
    if (sj.ok) setProgress({ total: Number(sj.json?.total ?? 0), max: Number(sj.json?.max ?? 0) });
  }

  async function loadTracker(studentId: string) {
    const res = await fetch("/api/home-quest/tracker/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId }),
    });
    const sj = await safeJson(res);
    if (sj.ok) setTracker((sj.json?.tracker as Tracker) ?? null);
  }

  async function loadChallenges(parentParam: string) {
    const res = await fetch(`/api/parent/home-quest/challenges${parentParam}`, { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to load challenges");
    setHomeChallenges((sj.json?.challenges?.available ?? []) as HomeChallengeRow[]);
    setParentChallenges((sj.json?.challenges?.parent_created ?? []) as ParentChallengeRow[]);
    setLimits(sj.json?.limits ?? null);
  }

  async function awardPoints(feature: "games" | "daily_checkin" | "quiz", points: number) {
    if (!activeStudentId) return setMsg("Pick a student first.");
    setMsg("");
    const parentParam = isAdmin && impersonateId ? `?parent_id=${encodeURIComponent(impersonateId)}` : "";
    const res = await fetch(`/api/parent/home-quest/award${parentParam}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id: activeStudentId,
        feature,
        points,
        parent_pin: parentPin.trim(),
      }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to award");
    setMsg(sj.json?.message || "Points added.");
    loadProgress(activeStudentId);
  }

  async function startTracker() {
    if (!activeStudentId) return setMsg("Pick a student first.");
    setMsg("");
    const res = await fetch("/api/home-quest/tracker/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id: activeStudentId,
        skill_name: trackerName.trim(),
        target_reps: trackerTarget,
      }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to start tracker");
    setTracker(sj.json?.tracker as Tracker);
    setTrackerName("");
    setMsg("Tracker created.");
  }

  async function completeTracker() {
    if (!tracker) return;
    setMsg("");
    const res = await fetch("/api/home-quest/tracker/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id: activeStudentId,
        tracker_id: tracker.id,
        parent_pin: parentPin.trim(),
      }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to complete tracker");
    setParentPin("");
    setTracker(null);
    setMsg(sj.json?.message || "Tracker completed.");
    loadProgress(activeStudentId);
  }

  async function completeChallenge(challengeId: string) {
    if (!activeStudentId) return setMsg("Pick a student first.");
    setMsg("");
    const parentParam = isAdmin && impersonateId ? `?parent_id=${encodeURIComponent(impersonateId)}` : "";
    const res = await fetch(`/api/parent/home-quest/challenges/complete${parentParam}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id: activeStudentId,
        challenge_id: challengeId,
        parent_pin: parentPin.trim(),
      }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to complete challenge");
    setMsg("Challenge awarded.");
    loadProgress(activeStudentId);
  }

  async function createParentChallenge() {
    if (!newChallengeName.trim()) return setMsg("Enter a challenge name.");
    setMsg("");
    const parentParam = isAdmin && impersonateId ? `?parent_id=${encodeURIComponent(impersonateId)}` : "";
    const res = await fetch(`/api/parent/home-quest/challenges${parentParam}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newChallengeName.trim(),
        description: newChallengeDesc.trim(),
        points_awarded: Math.min(15, Math.max(1, newChallengePoints || 15)),
      }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to create challenge");
    setNewChallengeName("");
    setNewChallengeDesc("");
    setMsg("Challenge submitted for approval.");
    loadChallenges(parentParam);
  }

  if (!canView) {
    return (
      <main style={{ padding: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Parent access only.</div>
      </main>
    );
  }

  const max = Number(progress.max ?? 0);
  const total = Number(progress.total ?? 0);
  const pct = max > 0 ? Math.min(100, Math.round((total / max) * 100)) : 0;
  const pointsDisplay = Number(activeStudent?.points_balance ?? activeStudent?.points_total ?? 0);
  const levelDisplay = Number(activeStudent?.level ?? 1);
  const initials = (activeStudent?.name || "").trim().slice(0, 2).toUpperCase() || "ST";
  const avatarZoomPct = Math.max(50, Math.min(200, Number(activeStudent?.avatar_zoom_pct ?? 100)));

  return (
    <main style={{ padding: 18, maxWidth: "none", margin: 0, width: "100%" }}>
      <style>{`
        .hq-scroll {
          display: flex;
          gap: 14px;
          overflow-x: auto;
          padding-bottom: 6px;
          scroll-snap-type: x mandatory;
        }
        .hq-card {
          min-width: 220px;
          scroll-snap-align: start;
        }
        @media (max-width: 720px) {
          .hq-hero {
            grid-template-columns: 1fr !important;
          }
          .hq-hero .hq-avatar {
            margin: 0 auto;
          }
          .hq-topbar {
            flex-direction: column;
            align-items: stretch;
          }
          .hq-topbar select {
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

      <div style={hero()}>
        <div style={topbar()} className="hq-topbar">
          <div>
            <div style={{ fontSize: 26, fontWeight: 1000 }}>Home Quest</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>Award points, track skills, and approve challenges at home.</div>
          </div>
          {students.length > 1 ? (
            <select value={activeStudent?.id ?? ""} onChange={(e) => setActiveStudent(e.target.value)} style={select()}>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <div style={heroGrid()} className="hq-hero">
          <div style={identity()}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{activeStudent?.name ?? "Student"}</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>Level {levelDisplay} • {pointsDisplay.toLocaleString()} pts</div>
            <div style={pinRow()}>
              <input
                type="password"
                value={parentPin}
                onChange={(e) => setParentPin(e.target.value)}
                placeholder="Parent PIN (required for awards)"
                style={input()}
              />
              <a href="/parent/pin" style={pinLink()}>Reset PIN</a>
            </div>
            <div style={progressCard()}>
              <div style={{ fontWeight: 900 }}>Weekly Home Quest Points</div>
              <div style={{ fontSize: 22, fontWeight: 1000 }}>
                {total} / {max} pts
              </div>
              <div style={progressTrack()}>
                <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg, rgba(16,185,129,0.9), rgba(59,130,246,0.8))" }} />
              </div>
            </div>
          </div>

          <div style={avatarWrap()}>
            <AvatarRender
              size={160}
              bg="rgba(15,23,42,0.6)"
              avatarSrc={activeStudent?.avatar_url ?? null}
              avatarZoomPct={avatarZoomPct}
              showImageBorder={false}
              style={{ borderRadius: 20 }}
              fallback={<div style={avatarFallback()}>{initials}</div>}
            />
          </div>
        </div>
      </div>

      {msg ? <div style={notice()}>{msg}</div> : null}

      <section style={{ display: "grid", gap: 10 }}>
        <div style={sectionTitle()}>Quick Awards</div>
        <div className="hq-scroll">
          {settings?.features?.games ? (
            <div style={featureCard()} className="hq-card">
              <div style={{ fontWeight: 1000 }}>Games</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Quick mini-games for points.</div>
              <button onClick={() => awardPoints("games", 2)} style={btn()}>
                Award +2
              </button>
            </div>
          ) : null}
          {settings?.features?.daily_checkin ? (
            <div style={featureCard()} className="hq-card">
              <div style={{ fontWeight: 1000 }}>Daily Check-in</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Training check-in.</div>
              <button onClick={() => awardPoints("daily_checkin", 1)} style={btn()}>
                Award +1
              </button>
            </div>
          ) : null}
          {settings?.features?.quiz ? (
            <div style={featureCard()} className="hq-card">
              <div style={{ fontWeight: 1000 }}>Quiz</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Short quiz bonus.</div>
              <button onClick={() => awardPoints("quiz", 3)} style={btn()}>
                Award +3
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {settings?.features?.home_tracker ? (
        <section style={{ display: "grid", gap: 10 }}>
          <div style={sectionTitle()}>Daily Skill Tracker</div>
          <div style={featureCard()}>
            <div style={{ opacity: 0.7, fontSize: 12 }}>One tracker per student per day.</div>
            {tracker ? (
              <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                <div style={{ fontWeight: 900 }}>
                  Active: {tracker.skill_name} • {tracker.target_reps} reps
                </div>
                <button onClick={completeTracker} style={btn()}>
                  Complete Tracker +5
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                <input
                  value={trackerName}
                  onChange={(e) => setTrackerName(e.target.value)}
                  placeholder="Skill name"
                  style={input()}
                />
                <input
                  type="number"
                  min={1}
                  value={trackerTarget}
                  onChange={(e) => setTrackerTarget(Number(e.target.value))}
                  placeholder="Target reps"
                  style={input()}
                />
                <button onClick={startTracker} style={btn()}>
                  Start Tracker
                </button>
              </div>
            )}
          </div>
        </section>
      ) : null}

      <section style={{ display: "grid", gap: 10 }}>
        <div style={sectionTitle()}>Home Challenges</div>
        <div className="hq-scroll">
          {homeChallenges.map((c) => (
            <div key={c.id} style={featureCard()} className="hq-card">
              <div style={{ fontWeight: 1000 }}>{c.name}</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>
                {c.category ? `${c.category} • ` : ""}{c.points_awarded ?? 0} pts • {c.tier ?? "bronze"}
              </div>
              {c.description ? <div style={{ opacity: 0.7, fontSize: 12 }}>{c.description}</div> : null}
              <button onClick={() => completeChallenge(c.id)} style={btn()}>
                Award
              </button>
            </div>
          ))}
          {!homeChallenges.length ? (
            <div style={featureCard()} className="hq-card">
              <div style={{ fontWeight: 900 }}>No challenges available</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Ask your coach to enable Home Quest challenges.</div>
            </div>
          ) : null}
        </div>
      </section>

      <section style={{ display: "grid", gap: 10 }}>
        <div style={sectionTitle()}>Parent-Created Challenges</div>
        <div style={limitsRow()}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            {limits
              ? `${limits.current_parent_challenges} / ${limits.max_parent_challenges} created`
              : "Loading limits..."}
          </div>
        </div>
        <div className="hq-scroll">
          {parentChallenges.map((c) => (
            <div key={c.id} style={featureCard()} className="hq-card">
              <div style={{ fontWeight: 1000 }}>{c.name}</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>
                {c.points_awarded ?? 0} pts • {c.tier ?? "bronze"}
              </div>
              {c.description ? <div style={{ opacity: 0.7, fontSize: 12 }}>{c.description}</div> : null}
              {c.status === "approved" ? (
                <button onClick={() => completeChallenge(c.id)} style={btn()}>
                  Award
                </button>
              ) : (
                <div style={{ opacity: 0.7, fontSize: 12 }}>Pending coach approval</div>
              )}
            </div>
          ))}
          <div style={featureCard()} className="hq-card">
            <div style={{ fontWeight: 1000 }}>Create a Challenge</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>Max 15 points. Coach approval required.</div>
            <input
              value={newChallengeName}
              onChange={(e) => setNewChallengeName(e.target.value)}
              placeholder="Challenge name"
              style={input()}
            />
            <input
              value={newChallengeDesc}
              onChange={(e) => setNewChallengeDesc(e.target.value)}
              placeholder="Details (optional)"
              style={input()}
            />
            <input
              type="number"
              min={1}
              max={15}
              value={newChallengePoints}
              onChange={(e) => setNewChallengePoints(Number(e.target.value))}
              style={input()}
            />
            <button onClick={createParentChallenge} style={btn()}>
              Submit
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function hero(): React.CSSProperties {
  return {
    borderRadius: 24,
    padding: 16,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "linear-gradient(135deg, rgba(15,23,42,0.9), rgba(2,6,23,0.7))",
    display: "grid",
    gap: 16,
  };
}

function topbar(): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  };
}

function heroGrid(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr",
    gap: 16,
    alignItems: "center",
  };
}

function identity(): React.CSSProperties {
  return {
    display: "grid",
    gap: 10,
  };
}

function avatarWrap(): React.CSSProperties {
  return {
    display: "grid",
    placeItems: "center",
  };
}

function avatarFallback(): React.CSSProperties {
  return {
    width: 160,
    height: 160,
    borderRadius: 20,
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
    fontSize: 30,
    background: "rgba(30,41,59,0.8)",
  };
}

function pinRow(): React.CSSProperties {
  return {
    display: "grid",
    gap: 6,
  };
}

function pinLink(): React.CSSProperties {
  return {
    fontSize: 12,
    textDecoration: "none",
    color: "rgba(148,163,184,0.9)",
  };
}

function progressCard(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(59,130,246,0.08)",
    display: "grid",
    gap: 6,
  };
}

function progressTrack(): React.CSSProperties {
  return {
    width: "100%",
    height: 10,
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  };
}

function sectionTitle(): React.CSSProperties {
  return {
    fontSize: 18,
    fontWeight: 1000,
  };
}

function featureCard(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    display: "grid",
    gap: 8,
  };
}

function btn(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(59,130,246,0.35)",
    background: "linear-gradient(90deg, rgba(59,130,246,0.85), rgba(14,165,233,0.65))",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function input(): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.24)",
    color: "white",
    outline: "none",
    fontSize: 13,
    fontWeight: 900,
  };
}

function notice(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(59,130,246,0.18)",
    color: "white",
    fontWeight: 900,
    fontSize: 12,
    marginTop: 10,
  };
}

function select(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(15,23,42,0.85)",
    color: "white",
    fontWeight: 900,
  };
}

function limitsRow(): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  };
}

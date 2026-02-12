"use client";

import { useEffect, useState } from "react";
import AuthGate from "../../components/AuthGate";
import AvatarRender from "@/components/AvatarRender";
import StudentNavPanel, { studentNavStyles } from "@/components/StudentNavPanel";

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

type StudentRow = {
  id: string;
  name: string;
  level?: number | null;
  points_total?: number | null;
  points_balance?: number | null;
  avatar_storage_path?: string | null;
  avatar_zoom_pct?: number | null;
};

export default function HomeQuestPage() {
  const [settings, setSettings] = useState<HomeQuestSettings | null>(null);
  const [progress, setProgress] = useState<Progress>({ total: 0, max: 0 });
  const [studentId, setStudentId] = useState("");
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [msg, setMsg] = useState("");
  const [tracker, setTracker] = useState<Tracker | null>(null);
  const [trackerName, setTrackerName] = useState("");
  const [trackerTarget, setTrackerTarget] = useState(5);
  const [parentPin, setParentPin] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (data?.ok && data?.role === "student" && data?.student_id) {
          setStudentId(String(data.student_id));
          return;
        }
      } catch {}

      try {
        setStudentId(localStorage.getItem("active_student_id") || "");
      } catch {}
    })();
  }, []);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (!studentId) return;
    loadProgress(studentId);
    loadTracker(studentId);
    loadStudent(studentId);
  }, [studentId]);

  async function loadStudent(sid: string) {
    const res = await fetch("/api/students/list", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    const match = (data?.students ?? []).find((s: any) => String(s.id) === String(sid));
    if (match?.id) setStudent(match as StudentRow);
  }

  async function loadSettings() {
    const res = await fetch("/api/home-quest/settings", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setSettings(data.settings as HomeQuestSettings);
  }

  async function loadProgress(sid: string) {
    const res = await fetch("/api/home-quest/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: sid }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setProgress({ total: Number(data.total ?? 0), max: Number(data.max ?? 0) });
  }

  async function loadTracker(sid: string) {
    const res = await fetch("/api/home-quest/tracker/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: sid }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setTracker((data.tracker as Tracker) ?? null);
  }

  async function awardPoints(feature: "games" | "daily_checkin" | "quiz", points: number) {
    if (!studentId) return setMsg("Pick a student first.");
    setMsg("");
    const res = await fetch("/api/home-quest/award", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId, feature, points }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data?.error || "Failed to award");
    setMsg(data?.message || "Points added.");
    loadProgress(studentId);
  }

  async function startTracker() {
    if (!studentId) return setMsg("Pick a student first.");
    setMsg("");
    const res = await fetch("/api/home-quest/tracker/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id: studentId,
        skill_name: trackerName.trim(),
        target_reps: trackerTarget,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data?.error || "Failed to start tracker");
    setTracker(data.tracker as Tracker);
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
        student_id: studentId,
        tracker_id: tracker.id,
        parent_pin: parentPin.trim(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data?.error || "Failed to complete tracker");
    setParentPin("");
    setTracker(null);
    setMsg(data?.message || "Tracker completed.");
    loadProgress(studentId);
  }

  const max = Number(progress.max ?? 0);
  const total = Number(progress.total ?? 0);
  const pct = max > 0 ? Math.min(100, Math.round((total / max) * 100)) : 0;
  const avatarSrc = (() => {
    const path = String(student?.avatar_storage_path ?? "").trim();
    if (!path) return null;
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return base ? `${base}/storage/v1/object/public/avatars/${path}` : null;
  })();
  const avatarZoomPct = Math.max(50, Math.min(200, Number(student?.avatar_zoom_pct ?? 100)));
  const pointsDisplay = Number(student?.points_balance ?? student?.points_total ?? 0);
  const levelDisplay = Number(student?.level ?? 1);
  const initials = (student?.name || "").trim().slice(0, 2).toUpperCase() || "LA";

  return (
    <AuthGate>
      <main style={{ display: "grid", gap: 16 }}>
        <style>{studentNavStyles()}</style>
        <StudentNavPanel />
        <button style={backBtn()} onClick={() => window.history.back()}>Back</button>
        <div style={topBar()}>
          <div style={identity()}>
            <div style={studentNameStyle()}>{student?.name ?? "Student"}</div>
            <div style={studentMeta()}>Level {levelDisplay} • {pointsDisplay.toLocaleString()} pts</div>
            <div style={avatarWrap()}>
              <AvatarRender
                size={160}
                bg="rgba(15,23,42,0.6)"
                avatarSrc={avatarSrc}
                avatarZoomPct={avatarZoomPct}
                showImageBorder={false}
                style={{ borderRadius: 20 }}
                fallback={<div style={avatarFallback()}>{initials}</div>}
              />
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 28, fontWeight: 1000 }}>Home Quest</div>
          <div style={{ opacity: 0.7, fontSize: 13 }}>
            {student?.name ? `For ${student.name}. ` : ""}At-home games and challenges to earn points (with a capped limit).
          </div>
        </div>

        {msg ? <div style={notice()}>{msg}</div> : null}

        <div style={pointsCard()}>
          <div style={{ fontWeight: 1000 }}>At-Home Points</div>
          <div style={{ fontSize: 24, fontWeight: 1100 }}>
            {total} / {max} pts
          </div>
          <div style={progressTrack()}>
            <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg, rgba(59,130,246,0.9), rgba(34,197,94,0.8))" }} />
          </div>
        </div>

        <div style={grid()}>
          {settings?.features?.games ? (
            <div style={featureCard()}>
              <div style={{ fontWeight: 1000 }}>Games</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Quick mini-games for points.</div>
              <button onClick={() => awardPoints("games", 2)} style={featureBtn()}>
                Earn 2 pts
              </button>
            </div>
          ) : null}

          {settings?.features?.daily_checkin ? (
            <div style={featureCard()}>
              <div style={{ fontWeight: 1000 }}>Daily Check-in</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Log a daily training check-in.</div>
              <button onClick={() => awardPoints("daily_checkin", 1)} style={featureBtn()}>
                Check-in +1
              </button>
            </div>
          ) : null}

          {settings?.features?.quiz ? (
            <div style={featureCard()}>
              <div style={{ fontWeight: 1000 }}>Quiz</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Short quiz to earn points.</div>
              <button onClick={() => awardPoints("quiz", 3)} style={featureBtn()}>
                Complete Quiz +3
              </button>
            </div>
          ) : null}

          {settings?.features?.home_tracker ? (
            <div style={featureCard()}>
              <div style={{ fontWeight: 1000 }}>Home Tracker</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>
                One active tracker. Parent PIN required to complete.
              </div>
              {tracker ? (
                <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
                  <div style={{ fontWeight: 900 }}>
                    Active: {tracker.skill_name} • {tracker.target_reps} reps
                  </div>
                  <input
                    type="password"
                    value={parentPin}
                    onChange={(e) => setParentPin(e.target.value)}
                    placeholder="Parent PIN"
                    style={input()}
                  />
                  <button onClick={completeTracker} style={featureBtn()}>
                    Complete Tracker +5
                  </button>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
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
                  <button onClick={startTracker} style={featureBtn()}>
                    Start Tracker
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </main>
    </AuthGate>
  );
}

function grid(): React.CSSProperties {
  return {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
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

function featureBtn(): React.CSSProperties {
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

function pointsCard(): React.CSSProperties {
  return {
    borderRadius: 20,
    padding: 16,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "linear-gradient(135deg, rgba(59,130,246,0.16), rgba(34,197,94,0.12))",
    display: "grid",
    gap: 8,
    boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
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
  };
}

function topBar(): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    gap: 20,
    flexWrap: "wrap",
    alignItems: "flex-start",
  };
}

function identity(): React.CSSProperties {
  return {
    display: "grid",
    gap: 8,
  };
}

function studentNameStyle(): React.CSSProperties {
  return {
    fontSize: "clamp(24px, 4vw, 36px)",
    fontWeight: 1000,
  };
}

function studentMeta(): React.CSSProperties {
  return {
    fontSize: 14,
    opacity: 0.75,
    fontWeight: 800,
  };
}

function avatarWrap(): React.CSSProperties {
  return {
    marginTop: 6,
    display: "grid",
    placeItems: "start",
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

function backBtn(): React.CSSProperties {
  return {
    justifySelf: "start",
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.2)",
    background: "rgba(30,41,59,0.7)",
    color: "inherit",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontSize: 11,
  };
}

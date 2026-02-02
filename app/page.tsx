"use client";

import { useEffect, useRef, useState } from "react";
import AuthGate from "../components/AuthGate";
import AvatarEffectParticles from "@/components/AvatarEffectParticles";

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 180)}` } };
  }
}

type TodayStats = {
  total_points_given_today: number;
  prizes_redeemed_today: number;
  top_earner_today: null | { student_id: string; name: string | null; points: number };
};

type LeaderboardEntry = {
  student_id: string;
  name: string;
  points: number;
  level: number;
  is_competition_team: boolean;
  avatar_storage_path: string | null;
  avatar_bg: string | null;
  avatar_effect?: string | null;
};

type Leaderboards = {
  total: LeaderboardEntry[];
  weekly: LeaderboardEntry[];
  lifetime: LeaderboardEntry[];
  skill_pulse_today?: LeaderboardEntry[];
  mvp?: LeaderboardEntry[];
};

export default function HomePage() {
  return (
    <>
      <AuthGate redirectDelayMs={1800}>
        <HomeGate />
      </AuthGate>
    </>
  );
}

function HomeGate() {
  const [entered, setEntered] = useState(false);
  const [introActive, setIntroActive] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("intro_after_login") === "1") {
        localStorage.removeItem("intro_after_login");
        setIntroActive(true);
      }
    } catch {}
  }, []);

  return (
    <>
      {introActive ? (
        <LogoIntroOverlay
          onDone={() => {
            setIntroActive(false);
            setEntered(true);
          }}
        />
      ) : null}
      {!entered && !introActive ? (
        <WelcomeScreen onEnter={() => setIntroActive(true)} />
      ) : (
        <HomeInner />
      )}
    </>
  );
}

function HomeInner() {
  const [stats, setStats] = useState<TodayStats | null>(null);
  const [leaderboards, setLeaderboards] = useState<Leaderboards | null>(null);
  const [effectConfigByKey, setEffectConfigByKey] = useState<Record<string, { config?: any }>>({});
  const [msg, setMsg] = useState("");
  const [pulseDetailOpen, setPulseDetailOpen] = useState(false);
  const [pulseDetailName, setPulseDetailName] = useState("");
  const [pulseDetailRows, setPulseDetailRows] = useState<Array<{ note: string; points: number }>>([]);
  const [pulseDetailMsg, setPulseDetailMsg] = useState("");
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [weeklyDetailOpen, setWeeklyDetailOpen] = useState(false);
  const [weeklyDetailName, setWeeklyDetailName] = useState("");
  const [weeklyDetailRows, setWeeklyDetailRows] = useState<Array<{ date: string; points: number }>>([]);
  const [weeklyDetailMsg, setWeeklyDetailMsg] = useState("");
  const weeklyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [totalDetailOpen, setTotalDetailOpen] = useState(false);
  const [totalDetailName, setTotalDetailName] = useState("");
  const [totalDetailRows, setTotalDetailRows] = useState<Array<{ points: number; note: string; created_at: string }>>([]);
  const [totalDetailMsg, setTotalDetailMsg] = useState("");
  const totalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      setMsg("");
      const r = await fetch("/api/stats/today", { cache: "no-store" });
      const sj = await safeJson(r);
      if (!sj.ok) return setMsg(sj.json?.error || "Failed to load stats");
      setStats((sj.json?.stats ?? null) as TodayStats | null);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/leaderboard", { cache: "no-store" });
      const sj = await safeJson(r);
      if (sj.ok) setLeaderboards((sj.json?.leaderboards ?? null) as Leaderboards | null);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/avatar-effects/list", { cache: "no-store" });
      const sj = await safeJson(r);
      if (!sj.ok) return;
      const list = (sj.json?.effects ?? []) as Array<{ key: string; config?: any }>;
      const map: Record<string, { config?: any }> = {};
      list.forEach((e) => {
        if (e?.key) map[String(e.key)] = { config: e.config };
      });
      setEffectConfigByKey(map);
    })();
  }, []);

  async function openPulseDetail(studentId: string, name: string) {
    if (!studentId) return;
    setPulseDetailMsg("");
    setPulseDetailName(name);
    setPulseDetailRows([]);
    setPulseDetailOpen(true);

    if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
    pulseTimer.current = window.setTimeout(() => setPulseDetailOpen(false), 5000);

    const res = await fetch("/api/leaderboard/skill-pulse-detail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) {
      setPulseDetailMsg(sj.json?.error || "Failed to load skill pulse details");
      return;
    }
    const rows = (sj.json?.rows ?? []) as Array<{ note: string; points: number }>;
    setPulseDetailRows(rows.filter((r) => Number(r.points ?? 0) > 0));
  }

  async function openWeeklyDetail(studentId: string, name: string) {
    if (!studentId) return;
    setWeeklyDetailMsg("");
    setWeeklyDetailName(name);
    setWeeklyDetailRows([]);
    setWeeklyDetailOpen(true);

    if (weeklyTimer.current) window.clearTimeout(weeklyTimer.current);
    weeklyTimer.current = window.setTimeout(() => setWeeklyDetailOpen(false), 5000);

    const res = await fetch("/api/leaderboard/weekly-detail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) {
      setWeeklyDetailMsg(sj.json?.error || "Failed to load weekly points");
      return;
    }
    const rows = (sj.json?.rows ?? []) as Array<{ date: string; points: number }>;
    setWeeklyDetailRows(rows);
  }

  async function openTotalDetail(studentId: string, name: string) {
    if (!studentId) return;
    setTotalDetailMsg("");
    setTotalDetailName(name);
    setTotalDetailRows([]);
    setTotalDetailOpen(true);

    if (totalTimer.current) window.clearTimeout(totalTimer.current);
    totalTimer.current = window.setTimeout(() => setTotalDetailOpen(false), 5000);

    const res = await fetch("/api/leaderboard/total-detail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) {
      setTotalDetailMsg(sj.json?.error || "Failed to load recent skills");
      return;
    }
    const rows = (sj.json?.rows ?? []) as Array<{ points: number; note: string; created_at: string }>;
    setTotalDetailRows(rows);
  }

  return (
    <div style={homeShell()}>
      <div style={{ display: "grid", gap: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontSize: 28, fontWeight: 1100 }}>Home</div>
          <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>Global view • Top 10 leaders</div>
        </div>
        {msg && <div style={errorBox()}>{msg}</div>}

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <div style={card()}>
            <div style={{ opacity: 0.85, fontWeight: 1000 }}>Total Points Given Today</div>
            <div style={{ marginTop: 8, fontSize: 34, fontWeight: 1150 }}>{stats ? stats.total_points_given_today : "—"}</div>
          </div>

          <div style={card()}>
            <div style={{ opacity: 0.85, fontWeight: 1000 }}>Prizes Redeemed Today</div>
            <div style={{ marginTop: 8, fontSize: 34, fontWeight: 1150 }}>{stats ? stats.prizes_redeemed_today : "—"}</div>
            <div style={{ marginTop: 6, opacity: 0.7, fontSize: 12 }}>Uses prize_redemptions table (change if needed).</div>
          </div>

          <div style={card()}>
            <div style={{ opacity: 0.85, fontWeight: 1000 }}>Top Earner Today</div>
            {stats?.top_earner_today ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 18, fontWeight: 1100 }}>{stats.top_earner_today.name ?? "Unknown student"}</div>
                <div style={{ marginTop: 6, opacity: 0.9, fontWeight: 1000 }}>
                  +{stats.top_earner_today.points} points
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 10, opacity: 0.75 }}>No points awarded yet today.</div>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ fontSize: 20, fontWeight: 1000 }}>Leaderboards</div>
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            <LeaderboardPanel
              title="Total Points"
              accent="linear-gradient(135deg, rgba(59,130,246,0.35), rgba(15,23,42,0.5))"
              rows={leaderboards?.total ?? []}
              onRowClick={(r) => openTotalDetail(r.student_id, r.name)}
              maxCount={10}
              effectConfigByKey={effectConfigByKey}
            />
            <LeaderboardPanel
              title="Weekly Points"
              accent="linear-gradient(135deg, rgba(16,185,129,0.35), rgba(15,23,42,0.5))"
              rows={leaderboards?.weekly ?? []}
              onRowClick={(r) => openWeeklyDetail(r.student_id, r.name)}
              maxCount={5}
              effectConfigByKey={effectConfigByKey}
            />
            <LeaderboardPanel
              title="Skill Pulse Today"
              accent="linear-gradient(135deg, rgba(236,72,153,0.35), rgba(15,23,42,0.5))"
              rows={leaderboards?.skill_pulse_today ?? []}
              onRowClick={(r) => openPulseDetail(r.student_id, r.name)}
              maxCount={5}
              effectConfigByKey={effectConfigByKey}
            />
            <LeaderboardPanel
              title="Lifetime Points"
              accent="linear-gradient(135deg, rgba(245,158,11,0.35), rgba(15,23,42,0.5))"
              rows={leaderboards?.lifetime ?? []}
              maxCount={5}
              effectConfigByKey={effectConfigByKey}
            />
            <LeaderboardPanel
              title="MVP Leaders"
              accent="linear-gradient(135deg, rgba(250,204,21,0.35), rgba(15,23,42,0.5))"
              rows={leaderboards?.mvp ?? []}
              maxCount={5}
              effectConfigByKey={effectConfigByKey}
            />
          </div>
        </div>
      </div>

      {pulseDetailOpen ? (
        <div style={pulseOverlay()} onClick={() => setPulseDetailOpen(false)}>
          <div style={{ fontWeight: 1000, fontSize: 12 }}>{pulseDetailName}</div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>Skill Pulse Today</div>
          {pulseDetailMsg ? <div style={{ fontSize: 11, opacity: 0.7 }}>{pulseDetailMsg}</div> : null}
          <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
            {pulseDetailRows.map((row, i) => (
              <div key={`${row.note}-${i}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11 }}>
                <div style={{ opacity: 0.85 }}>{row.note || "Skill Pulse"}</div>
                <div style={{ fontWeight: 900 }}>{row.points}</div>
              </div>
            ))}
            {!pulseDetailRows.length && !pulseDetailMsg ? (
              <div style={{ fontSize: 11, opacity: 0.7 }}>No Skill Pulse points yet today.</div>
            ) : null}
          </div>
        </div>
      ) : null}
      {weeklyDetailOpen ? (
        <div style={pulseOverlay()} onClick={() => setWeeklyDetailOpen(false)}>
          <div style={{ fontWeight: 1000, fontSize: 12 }}>{weeklyDetailName}</div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>Weekly Points</div>
          {weeklyDetailMsg ? <div style={{ fontSize: 11, opacity: 0.7 }}>{weeklyDetailMsg}</div> : null}
          <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
            {weeklyDetailRows.map((row) => (
              <div key={row.date} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11 }}>
                <div style={{ opacity: 0.85 }}>{row.date}</div>
                <div style={{ fontWeight: 900 }}>{row.points}</div>
              </div>
            ))}
            {!weeklyDetailRows.length && !weeklyDetailMsg ? (
              <div style={{ fontSize: 11, opacity: 0.7 }}>No points yet this week.</div>
            ) : null}
          </div>
        </div>
      ) : null}
      {totalDetailOpen ? (
        <div style={pulseOverlay()} onClick={() => setTotalDetailOpen(false)}>
          <div style={{ fontWeight: 1000, fontSize: 12 }}>{totalDetailName}</div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>Last 10 Point Actions</div>
          {totalDetailMsg ? <div style={{ fontSize: 11, opacity: 0.7 }}>{totalDetailMsg}</div> : null}
          <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
            {totalDetailRows.map((row, i) => (
              <div key={`${row.note}-${row.created_at}-${i}`} style={{ display: "grid", gap: 2, fontSize: 11 }}>
                <div style={{ fontWeight: 900 }}>+{row.points} pts</div>
                <div style={{ opacity: 0.7 }}>{row.note}</div>
                <div style={{ opacity: 0.6 }}>{formatDate(row.created_at)}</div>
              </div>
            ))}
            {!totalDetailRows.length && !totalDetailMsg ? (
              <div style={{ fontSize: 11, opacity: 0.7 }}>No recent point actions.</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LogoIntroOverlay({ onDone }: { onDone?: () => void }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoZoom, setLogoZoom] = useState(1);
  const [soundUrl, setSoundUrl] = useState<string | null>(null);
  const [soundVolume, setSoundVolume] = useState(1);
  const [active, setActive] = useState(true);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await fetch("/api/public/nav-logo", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!mounted) return;
      if (data?.logo_url) setLogoUrl(String(data.logo_url));
      if (data?.logo_zoom) setLogoZoom(Number(data.logo_zoom ?? 1));
      if (data?.intro_audio_url) setSoundUrl(String(data.intro_audio_url));
      if (data?.intro_volume != null) setSoundVolume(Math.min(1, Math.max(0, Number(data.intro_volume))));
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    if (!soundUrl) return;
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;
    audio.pause();
    audio.muted = false;
    audio.src = soundUrl;
    audio.volume = soundVolume;
    audio.currentTime = 0;
    audio.play().then(() => setAudioBlocked(false)).catch(() => {
      setAudioBlocked(true);
      const retry = () => {
        if (!active) return;
        audio.play().then(() => setAudioBlocked(false)).catch(() => {});
      };
    });
  }, [active, soundUrl, soundVolume]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => {
      setActive(false);
      onDone?.();
    }, 4050);
    return () => {
      window.clearTimeout(timer);
    };
  }, [active, onDone]);

  if (!active) return null;

  return (
    <div style={introWrap(audioBlocked)}>
      <style>{introStyle}</style>
      <div className="intro-panel" />
      <div style={introBackdrop()} />
      <div style={logoStage()}>
        <div style={logoClip()}>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo"
              style={{
                width: `${Math.max(160, 240 * logoZoom)}px`,
                height: "auto",
                display: "block",
                filter: "invert(1) brightness(1.1) drop-shadow(0 20px 40px rgba(0,0,0,0.55))",
              }}
            />
          ) : (
            <img
              src="https://newushu.com/uploads/1/1/1/3/111378341/newushu-black-transparent-2.png"
              alt="Logo"
              style={{
                width: `${Math.max(160, 240 * logoZoom)}px`,
                height: "auto",
                display: "block",
                filter: "invert(1) brightness(1.1) drop-shadow(0 20px 40px rgba(0,0,0,0.55))",
              }}
            />
          )}
          <div style={revealLeft()} />
          <div style={revealRight()} />
        </div>
        <div style={introTitlePrimary()}>Lead &amp; Achieve</div>
        <div style={introTitleSecondary()}>Level Up</div>
      </div>
      {audioBlocked ? (
        <button
          type="button"
          onClick={() => {
            if (!audioRef.current) return;
            audioRef.current.play().then(() => setAudioBlocked(false)).catch(() => {});
          }}
          style={audioEnableButton()}
        >
          Tap to Enable Audio
        </button>
      ) : null}
    </div>
  );
}

function WelcomeScreen({ onEnter }: { onEnter: () => void }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoZoom, setLogoZoom] = useState(1);
  const [name, setName] = useState<string>("Welcome");
  const [role, setRole] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await fetch("/api/public/nav-logo", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!mounted) return;
      if (data?.logo_url) setLogoUrl(String(data.logo_url));
      if (data?.logo_zoom) setLogoZoom(Number(data.logo_zoom ?? 1));
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await fetch("/api/account/profile", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!mounted) return;
      if (!data?.ok) return;
      setRole(String(data?.role ?? ""));
      const display = String(data?.display_name ?? "").trim();
      if (display) setName(display);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div style={welcomeWrap()}>
      <div style={welcomeBackdrop()} />
      <div style={welcomeCard()}>
        <img
          src={logoUrl ?? "https://newushu.com/uploads/1/1/1/3/111378341/newushu-black-transparent-2.png"}
          alt="Logo"
          style={{
            width: Math.max(140, 240 * logoZoom),
            height: "auto",
            objectFit: "contain",
            filter: "invert(1) brightness(1.1)",
          }}
        />
        <div style={welcomeTitle()}>Welcome{role === "student" ? "," : ""}</div>
        <div style={welcomeName()}>{name}</div>
        <button type="button" onClick={onEnter} style={enterButton()}>
          Enter the App
        </button>
      </div>
    </div>
  );
}

function welcomeWrap(): React.CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    zIndex: 9998,
    display: "grid",
    placeItems: "center",
    background: "rgba(2,6,23,0.88)",
  };
}

function welcomeBackdrop(): React.CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(circle at 50% 30%, rgba(59,130,246,0.25), transparent 55%), radial-gradient(circle at 20% 80%, rgba(248,113,113,0.2), transparent 55%)",
  };
}

function welcomeCard(): React.CSSProperties {
  return {
    position: "relative",
    zIndex: 2,
    display: "grid",
    gap: 10,
    placeItems: "center",
    padding: "30px 28px",
    borderRadius: 28,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(2,6,23,0.65)",
    boxShadow: "0 24px 70px rgba(0,0,0,0.55)",
    minWidth: "min(520px, 90vw)",
  };
}

function welcomeTitle(): React.CSSProperties {
  return {
    fontSize: 26,
    fontWeight: 900,
    letterSpacing: 2,
    color: "rgba(255,255,255,0.8)",
    textTransform: "uppercase",
  };
}

function welcomeName(): React.CSSProperties {
  return {
    fontFamily: "\"Bebas Neue\", \"Impact\", sans-serif",
    fontSize: 48,
    letterSpacing: 3,
    color: "white",
    textShadow: "0 12px 30px rgba(0,0,0,0.7)",
  };
}

function enterButton(): React.CSSProperties {
  return {
    marginTop: 8,
    padding: "12px 22px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.3)",
    background: "linear-gradient(120deg, rgba(59,130,246,0.9), rgba(248,113,113,0.9))",
    color: "white",
    fontWeight: 900,
    letterSpacing: 1,
    cursor: "pointer",
  };
}

function introWrap(audioBlocked = false): React.CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    display: "grid",
    placeItems: "center",
    background: "rgba(2,6,23,0.85)",
    animation: "introFade 4.05s ease forwards",
    pointerEvents: audioBlocked ? "auto" : "none",
    overflow: "hidden",
  };
}

function introBackdrop(): React.CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(circle at 50% 40%, rgba(248,113,113,0.15), transparent 60%), radial-gradient(circle at 20% 20%, rgba(59,130,246,0.2), transparent 55%)",
    opacity: 0.8,
  };
}

function logoStage(): React.CSSProperties {
  return {
    position: "relative",
    zIndex: 2,
    display: "grid",
    placeItems: "center",
    gap: 16,
  };
}

function logoClip(): React.CSSProperties {
  return {
    position: "relative",
    overflow: "hidden",
    padding: "20px 0",
  };
}

function revealLeft(): React.CSSProperties {
  return {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "50%",
    background: "rgba(2,6,23,0.95)",
    animation: "introRevealLeft 1.8s ease forwards",
  };
}

function revealRight(): React.CSSProperties {
  return {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: "50%",
    background: "rgba(2,6,23,0.95)",
    animation: "introRevealRight 1.8s ease forwards",
  };
}

function logoFallback(): React.CSSProperties {
  return {
    fontSize: 48,
    fontWeight: 900,
    letterSpacing: 6,
    color: "white",
  };
}

function introTitlePrimary(): React.CSSProperties {
  return {
    fontFamily: "\"Bebas Neue\", \"Impact\", sans-serif",
    fontSize: 46,
    letterSpacing: 4,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.96)",
    textShadow: "0 12px 30px rgba(0,0,0,0.65)",
  };
}

function introTitleSecondary(): React.CSSProperties {
  return {
    fontFamily: "\"Bebas Neue\", \"Impact\", sans-serif",
    fontSize: 30,
    letterSpacing: 4,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.92)",
    textShadow: "0 10px 30px rgba(0,0,0,0.6)",
  };
}

function audioEnableButton(): React.CSSProperties {
  return {
    position: "absolute",
    bottom: "8%",
    padding: "12px 22px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.3)",
    background: "rgba(15,23,42,0.85)",
    color: "white",
    fontWeight: 900,
    letterSpacing: 1,
    cursor: "pointer",
  };
}

const introStyle = `
.intro-panel{
  position:absolute;
  width: 220vmax;
  height: 220vmax;
  border-radius: 30%;
  background:
    linear-gradient(135deg, rgba(59,130,246,0.22), rgba(248,113,113,0.22)),
    repeating-linear-gradient(90deg, rgba(255,255,255,0.08) 0 12px, rgba(2,6,23,0.85) 12px 24px);
  animation: introPanel 3.8s ease forwards;
  transform: scale(0.1);
  opacity: 0.9;
  mix-blend-mode: screen;
}
@keyframes introRevealLeft {
  0% { transform: translateX(0); }
  100% { transform: translateX(-100%); }
}
@keyframes introRevealRight {
  0% { transform: translateX(0); }
  100% { transform: translateX(100%); }
}
@keyframes introFade {
  0% { opacity: 1; }
  75% { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes introPanel{
  0%{ transform: scale(0.05) rotate(6deg); opacity:0; }
  25%{ opacity:1; }
  70%{ transform: scale(1) rotate(0deg); opacity:0.9; }
  100%{ transform: scale(1.2) rotate(-6deg); opacity:0; }
}
`;

function LeaderboardPanel({
  title,
  accent,
  rows,
  onRowClick,
  maxCount = 10,
  effectConfigByKey,
}: {
  title: string;
  accent: string;
  rows: LeaderboardEntry[];
  onRowClick?: (row: LeaderboardEntry) => void;
  maxCount?: number;
  effectConfigByKey: Record<string, { config?: any }>;
}) {
  return (
    <div style={{ ...leaderboardPanel(), background: accent }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <div style={{ fontWeight: 1000 }}>{title}</div>
        <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 900 }}>Top {maxCount}</div>
      </div>
      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
        {rows.slice(0, maxCount).map((r, i) => {
          return (
            <div
              key={r.student_id}
              style={{ ...leaderboardRow(r.is_competition_team), cursor: onRowClick ? "pointer" : "default" }}
              onClick={() => onRowClick?.(r)}
            >
              <div style={rankBadge(i + 1)}>{i + 1}</div>
              <div style={avatarBadge(r.avatar_bg ?? "rgba(255,255,255,0.12)")}>
                <AvatarEffectParticles
                  effectKey={r.avatar_effect ?? null}
                  config={effectConfigByKey[r.avatar_effect ?? ""]?.config}
                />
                {r.avatar_storage_path ? (
                  <img
                    src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${r.avatar_storage_path}`}
                    alt={r.name}
                    style={{ width: "100%", height: "100%", objectFit: "contain", position: "relative", zIndex: 1 }}
                  />
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 900 }}>{r.name.slice(0, 1)}</span>
                )}
              </div>
              <div style={{ display: "grid", gap: 2 }}>
                <div style={{ fontWeight: 900 }}>{r.name}</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>Lv {r.level}</div>
              </div>
              <div style={{ marginLeft: "auto", fontWeight: 1000 }}>{r.points}</div>
            </div>
          );
        })}
        {!rows.length && <div style={{ opacity: 0.7, fontSize: 12 }}>No leaderboard data yet.</div>}
      </div>
    </div>
  );
}

function card(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: 14,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 14px 50px rgba(0,0,0,0.25)",
  };
}

function errorBox(): React.CSSProperties {
  return {
    padding: 10,
    borderRadius: 14,
    background: "rgba(239,68,68,0.15)",
    border: "1px solid rgba(255,255,255,0.10)",
  };
}

function leaderboardPanel(): React.CSSProperties {
  return {
    borderRadius: 20,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 16px 50px rgba(0,0,0,0.35)",
    backdropFilter: "blur(6px)",
  };
}

function pulseOverlay(): React.CSSProperties {
  return {
    position: "fixed",
    right: 24,
    bottom: 24,
    width: 260,
    borderRadius: 14,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(2,6,23,0.9)",
    boxShadow: "0 14px 40px rgba(0,0,0,0.45)",
    color: "white",
    zIndex: 9998,
  };
}

function homeShell(): React.CSSProperties {
  return {
    display: "grid",
    gap: 18,
    gridTemplateColumns: "minmax(0, 1fr)",
    alignItems: "start",
    maxWidth: 1680,
    margin: "0 auto",
  };
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function leaderboardRow(isComp: boolean): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "26px 36px 1fr auto",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    borderRadius: 14,
    border: isComp ? "1px solid rgba(59,130,246,0.55)" : "1px solid rgba(255,255,255,0.12)",
    background: isComp ? "rgba(59,130,246,0.15)" : "rgba(15,23,42,0.5)",
    boxShadow: isComp ? "0 0 18px rgba(59,130,246,0.2)" : "inset 0 1px 0 rgba(255,255,255,0.05)",
  };
}

function rankBadge(rank: number): React.CSSProperties {
  const tone =
    rank === 1
      ? "rgba(250,204,21,0.85)"
      : rank === 2
      ? "rgba(148,163,184,0.85)"
      : rank === 3
      ? "rgba(251,146,60,0.85)"
      : "rgba(255,255,255,0.16)";
  return {
    width: 26,
    height: 26,
    borderRadius: 10,
    background: tone,
    display: "grid",
    placeItems: "center",
    color: rank <= 3 ? "#0b1220" : "white",
    fontWeight: 1000,
    fontSize: 12,
  };
}

function avatarBadge(bg: string): React.CSSProperties {
  return {
    width: 34,
    height: 34,
    borderRadius: 12,
    background: bg,
    border: "1px solid rgba(255,255,255,0.18)",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    position: "relative",
  };
}

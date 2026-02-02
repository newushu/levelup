"use client";

import { useEffect, useRef, useState } from "react";
import AuthGate from "@/components/AuthGate";

type SoundEffect = {
  id: string;
  key: string;
  label: string;
  audio_url: string | null;
  category?: string | null;
  volume?: number | null;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status})` } };
  }
}

function formatSeconds(total: number) {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function ScorekeeperPage() {
  const [studentBlocked, setStudentBlocked] = useState(false);
  const [homeLabel, setHomeLabel] = useState("Home");
  const [guestLabel, setGuestLabel] = useState("Guest");
  const [homeScore, setHomeScore] = useState(0);
  const [guestScore, setGuestScore] = useState(0);
  const [homeFlagsCaptured, setHomeFlagsCaptured] = useState(0);
  const [guestFlagsCaptured, setGuestFlagsCaptured] = useState(0);
  const [homeFlagsRemoved, setHomeFlagsRemoved] = useState(0);
  const [guestFlagsRemoved, setGuestFlagsRemoved] = useState(0);
  const [duration, setDuration] = useState(180);
  const [remaining, setRemaining] = useState(180);
  const [running, setRunning] = useState(false);
  const [musicTracks, setMusicTracks] = useState<SoundEffect[]>([]);
  const [alertEffects, setAlertEffects] = useState<SoundEffect[]>([]);
  const [musicUrl, setMusicUrl] = useState("");
  const [alertUrl, setAlertUrl] = useState("");
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const alertRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json();
        if (data?.ok && data?.role === "student") setStudentBlocked(true);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const [musicRes, alertRes] = await Promise.all([
        fetch("/api/sound-effects/list?category=music", { cache: "no-store" }),
        fetch("/api/sound-effects/list?category=effect", { cache: "no-store" }),
      ]);
      const musicJson = await safeJson(musicRes);
      const alertJson = await safeJson(alertRes);
      if (musicJson.ok) setMusicTracks((musicJson.json?.effects ?? []) as SoundEffect[]);
      if (alertJson.ok) setAlertEffects((alertJson.json?.effects ?? []) as SoundEffect[]);
    })();
  }, []);

  useEffect(() => {
    if (!running) return;
    if (remaining <= 0) return;
    const timer = window.setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running, remaining]);

  useEffect(() => {
    if (!running) return;
    if (remaining > 0) return;
    setRunning(false);
    stopMusic();
  }, [remaining, running]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      }
      if (event.code === "ArrowLeft") {
        event.preventDefault();
        addScore("home", event.shiftKey ? 5 : 1);
      }
      if (event.code === "ArrowRight") {
        event.preventDefault();
        addScore("guest", event.shiftKey ? 5 : 1);
      }
      if (event.code === "Space") {
        event.preventDefault();
        if (!running) {
          startTimer();
        } else {
          toggleTimer();
        }
      }
      if (event.code === "KeyP") {
        event.preventDefault();
        playAlert();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [alertUrl]);

  function addScore(team: "home" | "guest", delta: number) {
    if (team === "home") setHomeScore((prev) => Math.max(0, prev + delta));
    if (team === "guest") setGuestScore((prev) => Math.max(0, prev + delta));
    if (delta >= 5) {
      if (team === "home") setHomeFlagsCaptured((prev) => prev + 1);
      if (team === "guest") setGuestFlagsCaptured((prev) => prev + 1);
      return;
    }
    if (team === "home") setHomeFlagsRemoved((prev) => prev + 1);
    if (team === "guest") setGuestFlagsRemoved((prev) => prev + 1);
  }

  function resetScores() {
    setHomeScore(0);
    setGuestScore(0);
    setHomeFlagsCaptured(0);
    setGuestFlagsCaptured(0);
    setHomeFlagsRemoved(0);
    setGuestFlagsRemoved(0);
  }

  function startTimer() {
    setRemaining(duration);
    setRunning(true);
    playMusic();
  }

  function toggleTimer() {
    if (!running) {
      setRunning(true);
      playMusic();
      return;
    }
    setRunning(false);
    stopMusic();
  }

  function resetTimer() {
    setRunning(false);
    stopMusic();
    setRemaining(duration);
  }

  function playMusic() {
    if (!musicUrl) return;
    if (!musicRef.current || musicRef.current.src !== musicUrl) {
      musicRef.current = new Audio(musicUrl);
    }
    musicRef.current.loop = true;
    musicRef.current.volume = 1;
    musicRef.current.play().catch(() => {});
  }

  function stopMusic() {
    if (!musicRef.current) return;
    musicRef.current.pause();
    musicRef.current.currentTime = 0;
  }

  function playAlert() {
    if (!alertUrl) return;
    if (!alertRef.current || alertRef.current.src !== alertUrl) {
      alertRef.current = new Audio(alertUrl);
    }
    alertRef.current.volume = 1;
    alertRef.current.loop = false;
    alertRef.current.play().catch(() => {});
  }

  return (
    <AuthGate>
      {studentBlocked ? (
        <div style={{ padding: 18 }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>Scorekeeper is coach-only.</div>
          <div style={{ opacity: 0.7, marginTop: 6 }}>Student accounts cannot access this page.</div>
        </div>
      ) : (
        <main style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 1000 }}>CTF Scorekeeper</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>
                Use the buttons or the keyboard: Left/Right = +1, Shift + Left/Right = +5, Space = start/pause timer, P = safe zone alert.
              </div>
            </div>
            <a href="/admin/custom/media" target="_blank" rel="noreferrer" style={linkBtn()}>
              Sound Library →
            </a>
          </div>

          <section style={scoreboard()}>
            <div style={{ display: "grid", gap: 12 }}>
              <input value={homeLabel} onChange={(e) => setHomeLabel(e.target.value)} style={teamInput()} />
              <div style={scoreCard("rgba(59,130,246,0.2)")}>{homeScore}</div>
              <div style={flagRow()}>
                <span style={flagEmoji()}>🏁</span>
                <span style={flagCount()}>{homeFlagsCaptured}</span>
                <span style={flagEmoji()}>🤚</span>
                <span style={flagCount()}>{homeFlagsRemoved}</span>
              </div>
              <div style={scoreButtons()}>
                <button style={pillBtn()} onClick={() => addScore("home", 1)}>+1 (Remove Flag)</button>
                <button style={pillBtn()} onClick={() => addScore("home", 5)}>+5 (Capture)</button>
              </div>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              <input value={guestLabel} onChange={(e) => setGuestLabel(e.target.value)} style={teamInput()} />
              <div style={scoreCard("rgba(34,197,94,0.22)")}>{guestScore}</div>
              <div style={flagRow()}>
                <span style={flagEmoji()}>🏁</span>
                <span style={flagCount()}>{guestFlagsCaptured}</span>
                <span style={flagEmoji()}>🤚</span>
                <span style={flagCount()}>{guestFlagsRemoved}</span>
              </div>
              <div style={scoreButtons()}>
                <button style={pillBtn()} onClick={() => addScore("guest", 1)}>+1 (Remove Flag)</button>
                <button style={pillBtn()} onClick={() => addScore("guest", 5)}>+5 (Capture)</button>
              </div>
            </div>
          </section>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={ghostBtn()} onClick={resetScores}>Reset Scores</button>
            <button style={ghostBtn()} onClick={() => { setHomeScore(0); setGuestScore(0); setRemaining(duration); }}>Reset All</button>
          </div>

          <section style={panel()}>
            <div style={{ fontWeight: 1000 }}>CTF Timer + Music</div>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <label style={label()}>
                Round seconds
                <input
                  type="number"
                  min={10}
                  value={duration}
                  onChange={(e) => {
                    const next = Math.max(10, Number(e.target.value || 0));
                    setDuration(next);
                    if (!running) setRemaining(next);
                  }}
                  style={input()}
                />
              </label>
              <label style={label()}>
                Music track
                <select value={musicUrl} onChange={(e) => setMusicUrl(e.target.value)} style={input()}>
                  <option value="">No music</option>
                  {musicTracks.map((track) => (
                    <option key={track.id} value={track.audio_url ?? ""}>
                      {track.label || track.key}
                    </option>
                  ))}
                </select>
              </label>
              <label style={label()}>
                Safe zone alert sound
                <select value={alertUrl} onChange={(e) => setAlertUrl(e.target.value)} style={input()}>
                  <option value="">Select sound</option>
                  {alertEffects.map((fx) => (
                    <option key={fx.id} value={fx.audio_url ?? ""}>
                      {fx.label || fx.key}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button style={btn()} onClick={startTimer}>Start Round (Space)</button>
              <button style={ghostBtn()} onClick={toggleTimer}>{running ? "Pause" : "Resume"} (Space)</button>
              <button style={ghostBtn()} onClick={resetTimer}>Reset Timer</button>
              <button style={ghostBtn()} onClick={playAlert}>Play Safe Zone Alert (P)</button>
            </div>
            <div style={timerReadout()}>{formatSeconds(remaining)}</div>
          </section>
        </main>
      )}
    </AuthGate>
  );
}

function scoreboard(): React.CSSProperties {
  return {
    display: "grid",
    gap: 16,
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  };
}

function scoreCard(tint: string): React.CSSProperties {
  return {
    borderRadius: 24,
    padding: "26px 10px",
    textAlign: "center",
    fontSize: 56,
    fontWeight: 1000,
    border: "1px solid rgba(255,255,255,0.14)",
    background: `linear-gradient(140deg, ${tint}, rgba(15,23,42,0.85))`,
    boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
  };
}

function scoreButtons(): React.CSSProperties {
  return { display: "flex", gap: 10, flexWrap: "wrap" };
}

function flagRow(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "6px 10px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
  };
}

function flagEmoji(): React.CSSProperties {
  return { fontSize: 22 };
}

function flagCount(): React.CSSProperties {
  return { fontSize: 16, fontWeight: 900, minWidth: 18 };
}

function teamInput(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.3)",
    color: "white",
    fontWeight: 900,
    outline: "none",
  };
}

function panel(): React.CSSProperties {
  return {
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    padding: 14,
    display: "grid",
    gap: 12,
  };
}

function label(): React.CSSProperties {
  return { fontSize: 12, fontWeight: 900, display: "grid", gap: 6 };
}

function input(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.25)",
    color: "white",
    outline: "none",
  };
}

function timerReadout(): React.CSSProperties {
  return {
    fontSize: 32,
    fontWeight: 1000,
    letterSpacing: 1,
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    width: "fit-content",
  };
}

function btn(): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "linear-gradient(90deg, rgba(34,197,94,0.9), rgba(59,130,246,0.7))",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function ghostBtn(): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function pillBtn(): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  };
}

function linkBtn(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    color: "white",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 900,
  };
}

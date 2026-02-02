"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AuthGate from "@/components/AuthGate";
import { playGlobalSfx, setGlobalSounds } from "@/lib/globalAudio";

type CtfState = {
  running: boolean;
  secondsLeft: number;
  durationSeconds: number;
  safeZoneSeconds: number;
  removedPoints: number;
  stolenPoints: number;
  jailbreakEnabled: boolean;
  team1Points: number;
  team2Points: number;
  team1Removed: number;
  team1Stolen: number;
  team2Removed: number;
  team2Stolen: number;
  safeZoneEndsAt: number | null;
  lastEvent: string | null;
  updatedAt: number;
};

const EMPTY_STATE: CtfState = {
  running: false,
  secondsLeft: 0,
  durationSeconds: 0,
  safeZoneSeconds: 10,
  removedPoints: 1,
  stolenPoints: 5,
  jailbreakEnabled: true,
  team1Points: 0,
  team2Points: 0,
  team1Removed: 0,
  team1Stolen: 0,
  team2Removed: 0,
  team2Stolen: 0,
  safeZoneEndsAt: null,
  lastEvent: null,
  updatedAt: Date.now(),
};

export default function CtfDisplayPage() {
  const [state, setState] = useState<CtfState>(() => {
    if (typeof window === "undefined") return EMPTY_STATE;
    try {
      const raw = localStorage.getItem("ctf_state_display") || "";
      if (!raw) return EMPTY_STATE;
      return { ...EMPTY_STATE, ...(JSON.parse(raw) as CtfState) };
    } catch {
      return EMPTY_STATE;
    }
  });
  const [now, setNow] = useState(() => Date.now());
  const channelRef = useRef<BroadcastChannel | null>(null);
  const navChannelRef = useRef<BroadcastChannel | null>(null);
  const lastSafeZoneRef = useRef<number | null>(null);
  const lastScoresRef = useRef<{ t1: number; t2: number; event: string | null }>({
    t1: 0,
    t2: 0,
    event: null,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/sound-effects/list", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!active || !json?.ok) return;
        const map: Record<string, { url: string; volume?: number; loop?: boolean }> = {};
        (json.effects ?? []).forEach((row: any) => {
          const key = String(row?.key ?? "");
          const url = String(row?.audio_url ?? "");
          if (key && url) {
            map[key] = { url, volume: Number(row?.volume ?? 1), loop: row?.loop ?? false };
          }
        });
        setGlobalSounds(map);
      } catch {}
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
    channelRef.current = new BroadcastChannel("coach-timer-ctf");
    channelRef.current.onmessage = (event) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "ctf_state") {
        const next = { ...EMPTY_STATE, ...(data.state as CtfState) };
        setState(next);
        try {
          localStorage.setItem("ctf_state_display", JSON.stringify(next));
        } catch {}
      }
    };
    channelRef.current.postMessage({ type: "ctf_request_state" });
    return () => {
      channelRef.current?.close();
      channelRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
    navChannelRef.current = new BroadcastChannel("coach-timer-nav");
    navChannelRef.current.onmessage = (event) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "display_timer") {
        const route = timerRouteForKey(String(data.key ?? ""));
        if (route && window.location.pathname !== route) {
          window.location.href = route;
        }
      }
    };
    return () => {
      navChannelRef.current?.close();
      navChannelRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!state.safeZoneEndsAt) return;
    if (lastSafeZoneRef.current !== state.safeZoneEndsAt && state.safeZoneEndsAt > Date.now()) {
      playGlobalSfx("ctf_safe_zone");
    }
    lastSafeZoneRef.current = state.safeZoneEndsAt;
  }, [state.safeZoneEndsAt]);

  useEffect(() => {
    const prev = lastScoresRef.current;
    const t1Diff = state.team1Points - prev.t1;
    const t2Diff = state.team2Points - prev.t2;
    if (t1Diff === 1 || t2Diff === 1) playGlobalSfx("ctf_point_1");
    if (t1Diff === 5 || t2Diff === 5) playGlobalSfx("ctf_point_5");
    if (state.lastEvent === "Jailbreak" && prev.event !== "Jailbreak") {
      playGlobalSfx("ctf_jailbreak");
    }
    lastScoresRef.current = { t1: state.team1Points, t2: state.team2Points, event: state.lastEvent };
  }, [state.team1Points, state.team2Points, state.lastEvent]);

  const displaySeconds = useMemo(() => {
    if (!state.running) return Math.max(0, state.secondsLeft);
    const elapsed = Math.floor((now - state.updatedAt) / 1000);
    return Math.max(0, state.secondsLeft - elapsed);
  }, [state.secondsLeft, state.running, state.updatedAt, now]);

  const safeZoneRemaining = useMemo(() => {
    if (!state.safeZoneEndsAt) return 0;
    return Math.max(0, Math.ceil((state.safeZoneEndsAt - now) / 1000));
  }, [state.safeZoneEndsAt, now]);

  const timeText = useMemo(() => {
    const minutes = Math.floor(displaySeconds / 60);
    const seconds = displaySeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [displaySeconds]);

  return (
    <AuthGate>
      <main style={page()}>
        <style>{`
          .ctf-bg {
            position: relative;
          }
          .ctf-bg::before {
            content: "";
            position: absolute;
            inset: 0;
            background:
              radial-gradient(circle, rgba(59,130,246,0.12) 0 2px, transparent 3px),
              radial-gradient(circle, rgba(248,113,113,0.12) 0 2px, transparent 3px),
              radial-gradient(circle, rgba(255,255,255,0.08) 0 1px, transparent 2px);
            background-size: 140px 140px, 180px 180px, 120px 120px;
            animation: driftBg 40s linear infinite;
            pointer-events: none;
            opacity: 0.6;
          }
          .ctf-wrap { position: relative; }
          .ctf-particles::before,
          .ctf-particles::after {
            content: "";
            position: absolute;
            inset: -20%;
            background:
              radial-gradient(circle, rgba(59,130,246,0.18) 0 2px, transparent 3px),
              radial-gradient(circle, rgba(248,113,113,0.18) 0 2px, transparent 3px),
              radial-gradient(circle, rgba(255,255,255,0.12) 0 1px, transparent 2px);
            background-size: 120px 120px, 160px 160px, 90px 90px;
            animation: drift 18s linear infinite;
            pointer-events: none;
            opacity: 0.5;
          }
          .ctf-particles::after {
            animation-duration: 28s;
            opacity: 0.35;
          }
          @keyframes glowPulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
          @keyframes bannerFlash { 0% { transform: scale(1); } 50% { transform: scale(1.04); } 100% { transform: scale(1); } }
          @keyframes drift { from { transform: translate3d(0,0,0); } to { transform: translate3d(-60px, 40px, 0); } }
          @keyframes shake { 0% { transform: translate3d(0,0,0); } 25% { transform: translate3d(-4px, 2px, 0); } 50% { transform: translate3d(4px, -3px, 0); } 75% { transform: translate3d(-3px, -2px, 0); } 100% { transform: translate3d(0,0,0); } }
          @keyframes driftBg { from { transform: translate3d(0,0,0); } to { transform: translate3d(80px, -60px, 0); } }
          .ctf-timer::before,
          .ctf-timer::after {
            content: "";
            position: absolute;
            inset: -20%;
            background:
              radial-gradient(circle, rgba(56,189,248,0.25) 0 2px, transparent 3px),
              radial-gradient(circle, rgba(255,255,255,0.18) 0 1px, transparent 2px);
            background-size: 120px 120px, 80px 80px;
            animation: drift 16s linear infinite;
            opacity: 0.45;
            pointer-events: none;
          }
          .ctf-timer::after {
            animation-duration: 26s;
            opacity: 0.3;
          }
          .rule-panel::before,
          .rule-panel::after,
          .rule-panel .rule-pin {
            content: "";
            position: absolute;
            width: 10px;
            height: 10px;
            border-radius: 999px;
            background: radial-gradient(circle, rgba(251,191,36,0.9), rgba(124,45,18,0.6));
            box-shadow: 0 0 10px rgba(251,191,36,0.6);
          }
          .rule-panel::before { top: 10px; left: 10px; }
          .rule-panel::after { top: 10px; right: 10px; }
          .rule-panel .rule-pin:nth-child(1) { bottom: 10px; left: 10px; }
          .rule-panel .rule-pin:nth-child(2) { bottom: 10px; right: 10px; }
        `}</style>

        <div className="ctf-bg" style={bgWrap()}>
          <div className="ctf-wrap ctf-particles ctf-timer" style={topTimer()}>
            <div style={timerTitleRow()}>
              <div style={timerTitle()}>Capture the Flag</div>
            </div>
            <div style={timerLabel()}>CTF TIMER</div>
            <div style={timerValue()}>{timeText}</div>
            {!state.running && state.secondsLeft ? <div style={pausedTag()}>TIME IS PAUSED</div> : null}
          </div>

          <div className="ctf-wrap ctf-particles" style={arena()}>
            <div style={teamPanel("left")}>
            <div style={teamHeader("left")}>Team 1</div>
            <div style={teamScore()}>{state.team1Points}</div>
            <div style={statBox()}>
              <div style={statLabel()}>Flags</div>
              <div style={statRow()}>
                <div style={statItem("remove")}>
                  <span style={statIcon("remove")}>✋</span>
                  <span style={statText()}>Removed</span>
                  <span style={statValue()}>{state.team1Removed}</span>
                </div>
                <div style={statItem("steal")}>
                  <span style={statIcon("steal")}>⚑</span>
                  <span style={statText()}>Stolen</span>
                  <span style={statValue()}>{state.team1Stolen}</span>
                </div>
              </div>
            </div>
          </div>

          <div style={centerPanel()}>
            {safeZoneRemaining > 0 ? (
              <div style={safeZoneBanner()}>
                <div style={{ fontSize: 22, fontWeight: 1000 }}>NO LONGER SAFE</div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>Safe in {safeZoneRemaining}s</div>
              </div>
            ) : null}
            {state.lastEvent ? <div style={eventTag(state.lastEvent)}>{state.lastEvent}</div> : null}
          </div>

            <div style={teamPanel("right")}>
            <div style={teamHeader("right")}>Team 2</div>
            <div style={teamScore()}>{state.team2Points}</div>
            <div style={statBox()}>
              <div style={statLabel()}>Flags</div>
              <div style={statRow()}>
                <div style={statItem("remove")}>
                  <span style={statIcon("remove")}>✋</span>
                  <span style={statText()}>Removed</span>
                  <span style={statValue()}>{state.team2Removed}</span>
                </div>
                <div style={statItem("steal")}>
                  <span style={statIcon("steal")}>⚑</span>
                  <span style={statText()}>Stolen</span>
                  <span style={statValue()}>{state.team2Stolen}</span>
                </div>
              </div>
            </div>
            </div>
          </div>
          <div style={ruleBarWrap()}>
            <div style={rulePanel()} className="rule-panel">
              <span className="rule-pin" />
              <span className="rule-pin" />
              <div style={rulePanelTitle()}>Rules</div>
              <div style={ruleBoxes()}>
                <div style={ruleBox()}>+{state.removedPoints} Removed</div>
                <div style={ruleBox()}>+{state.stolenPoints} Stolen</div>
                <div style={ruleBox()}>Safe Zone ON</div>
                <div style={ruleBox()}>Jailbreak {state.jailbreakEnabled ? "ON" : "OFF"}</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </AuthGate>
  );
}

function page(): React.CSSProperties {
  return {
    minHeight: "100vh",
    padding: "24px 24px 40px",
    color: "white",
    background:
      "radial-gradient(circle at top, rgba(59,130,246,0.2), rgba(2,6,23,0.96)), linear-gradient(120deg, rgba(15,23,42,0.9), rgba(2,6,23,1))",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 18,
  };
}

function arena(): React.CSSProperties {
  return {
    width: "100%",
    maxWidth: 1400,
    display: "grid",
    gridTemplateColumns: "1fr 1.2fr 1fr",
    gap: 18,
    alignItems: "stretch",
  };
}

function ruleBarWrap(): React.CSSProperties {
  return {
    width: "100%",
    maxWidth: 1400,
    display: "flex",
    justifyContent: "center",
    marginTop: 12,
  };
}

function topTimer(): React.CSSProperties {
  return {
    width: "100%",
    maxWidth: 1160,
    marginBottom: 16,
    borderRadius: 24,
    padding: "22px 26px",
    border: "2px solid rgba(56,189,248,0.55)",
    background: "rgba(8,12,22,0.85)",
    display: "grid",
    placeItems: "center",
    gap: 8,
    boxShadow: "0 24px 50px rgba(0,0,0,0.5)",
    textAlign: "center",
    overflow: "hidden",
  };
}

function bgWrap(): React.CSSProperties {
  return {
    width: "100%",
    display: "grid",
    placeItems: "center",
  };
}

function timerTitleRow(): React.CSSProperties {
  return {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  };
}

function timerTitle(): React.CSSProperties {
  return { fontSize: 28, fontWeight: 1000, letterSpacing: 1 };
}

function ruleBoxes(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14, width: "100%" };
}

function ruleBox(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: "14px 14px",
    border: "2px solid rgba(255,255,255,0.2)",
    background: "rgba(15,23,42,0.78)",
    fontSize: 15,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    textAlign: "center",
    boxShadow: "0 10px 20px rgba(0,0,0,0.35)",
    position: "relative",
    overflow: "hidden",
  };
}

function rulePanel(): React.CSSProperties {
  return {
    position: "relative",
    width: "100%",
    maxWidth: 1200,
    padding: "16px 18px 18px",
    borderRadius: 18,
    border: "2px solid rgba(255,255,255,0.22)",
    background: "rgba(2,6,23,0.72)",
    boxShadow: "0 20px 36px rgba(0,0,0,0.45)",
    display: "grid",
    gap: 12,
  };
}

function rulePanelTitle(): React.CSSProperties {
  return { fontWeight: 1000, fontSize: 16, letterSpacing: 2, textTransform: "uppercase", textAlign: "center" };
}

function teamPanel(side: "left" | "right"): React.CSSProperties {
  return {
    borderRadius: 24,
    padding: 18,
    border: side === "left" ? "2px solid rgba(59,130,246,0.7)" : "2px solid rgba(248,113,113,0.7)",
    background:
      side === "left"
        ? "linear-gradient(140deg, rgba(30,58,138,0.6), rgba(2,6,23,0.9))"
        : "linear-gradient(140deg, rgba(127,29,29,0.6), rgba(2,6,23,0.9))",
    boxShadow: "0 30px 60px rgba(0,0,0,0.45)",
    display: "grid",
    gap: 12,
    alignContent: "center",
  };
}

function teamHeader(side: "left" | "right"): React.CSSProperties {
  return {
    fontSize: 24,
    fontWeight: 1000,
    textTransform: "uppercase",
    letterSpacing: 2,
    color: side === "left" ? "rgba(147,197,253,1)" : "rgba(248,113,113,1)",
    textAlign: "center",
  };
}

function teamScore(): React.CSSProperties {
  return {
    fontSize: 110,
    fontWeight: 1000,
    textShadow: "0 12px 28px rgba(0,0,0,0.5)",
    textAlign: "center",
  };
}

function statBox(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: "14px 14px",
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(2,6,23,0.6)",
    boxShadow: "inset 0 1px 8px rgba(0,0,0,0.6)",
    display: "grid",
    gap: 10,
  };
}

function statLabel(): React.CSSProperties {
  return { fontSize: 12, letterSpacing: 1, opacity: 0.7, textTransform: "uppercase", fontWeight: 900, textAlign: "center" };
}

function statRow(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 };
}

function statItem(kind: "remove" | "steal"): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: "16px 14px",
    border: "1px solid rgba(255,255,255,0.14)",
    background:
      kind === "remove"
        ? "linear-gradient(160deg, rgba(125,211,252,0.18), rgba(15,23,42,0.55))"
        : "linear-gradient(160deg, rgba(253,224,71,0.18), rgba(15,23,42,0.55))",
    textAlign: "center",
    boxShadow: "inset 0 1px 6px rgba(0,0,0,0.5)",
    display: "grid",
    gridTemplateRows: "auto auto",
    gridTemplateColumns: "auto 1fr auto",
    alignItems: "center",
    columnGap: 10,
    rowGap: 6,
  };
}

function statIcon(kind: "remove" | "steal"): React.CSSProperties {
  return {
    fontSize: 22,
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.2)",
    background:
      kind === "remove"
        ? "linear-gradient(160deg, rgba(59,130,246,0.25), rgba(15,23,42,0.65))"
        : "linear-gradient(160deg, rgba(251,191,36,0.25), rgba(15,23,42,0.65))",
    boxShadow: "inset 0 1px 6px rgba(0,0,0,0.6)",
  };
}

function statText(): React.CSSProperties {
  return { fontSize: 16, fontWeight: 900, letterSpacing: 0.4 };
}

function statValue(): React.CSSProperties {
  return { fontSize: 28, fontWeight: 1000 };
}

function centerPanel(): React.CSSProperties {
  return {
    borderRadius: 28,
    padding: 18,
    border: "2px solid rgba(255,255,255,0.2)",
    background: "rgba(8,10,20,0.85)",
    display: "grid",
    placeItems: "center",
    gap: 14,
    boxShadow: "0 30px 60px rgba(0,0,0,0.55)",
  };
}

function timerLabel(): React.CSSProperties {
  return { fontSize: 14, letterSpacing: 3, opacity: 0.7, fontWeight: 900 };
}

function timerValue(): React.CSSProperties {
  return { fontSize: 180, fontWeight: 1000, letterSpacing: 2 };
}

function pausedTag(): React.CSSProperties {
  return {
    fontSize: 18,
    fontWeight: 900,
    padding: "6px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.25)",
    background: "rgba(255,255,255,0.08)",
  };
}

function safeZoneBanner(): React.CSSProperties {
  return {
    width: "100%",
    maxWidth: 420,
    padding: "12px 16px",
    borderRadius: 16,
    border: "2px solid rgba(248,113,113,0.95)",
    background: "rgba(239,68,68,0.22)",
    textAlign: "center",
    display: "grid",
    gap: 6,
    animation: "bannerFlash 0.8s ease-in-out infinite, shake 0.5s ease-in-out infinite",
    boxShadow: "0 0 28px rgba(248,113,113,0.65)",
  };
}

function eventTag(kind: string): React.CSSProperties {
  const isJailbreak = String(kind || "").toLowerCase().includes("jailbreak");
  return {
    padding: "10px 14px",
    borderRadius: 999,
    border: isJailbreak ? "1px solid rgba(251,191,36,0.8)" : "1px solid rgba(56,189,248,0.5)",
    background: isJailbreak ? "rgba(251,191,36,0.2)" : "rgba(56,189,248,0.12)",
    fontSize: 20,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 1,
    animation: "glowPulse 1.8s ease-in-out infinite",
    color: "white",
  };
}

function timerRouteForKey(key: string) {
  if (key === "ctf") return "/display/ctf";
  if (key === "crack_a_bat") return "/display/crack-a-bat";
  if (key === "siege_survive") return "/display/siege-survive";
  return "";
}

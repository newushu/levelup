"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AuthGate from "@/components/AuthGate";
import { fadeOutGlobalMusic, playGlobalMusic, playGlobalSfx, setGlobalSounds } from "@/lib/globalAudio";

type SiegeState = {
  running: boolean;
  started: boolean;
  completed: boolean;
  secondsLeft: number;
  durationSeconds: number;
  timerUpdatedAt: number;
  intermissionActive: boolean;
  intermissionEndsAt: number | null;
  intermissionTotal: number;
  roundEndActive: boolean;
  roundEndEndsAt: number | null;
  roundEndDuration: number;
  roundEndPending: boolean;
  roundEndReason: "time" | null;
  endGameActive: boolean;
  endGameEndsAt: number | null;
  round: number;
  roundsTotal: number;
  subround: 1 | 2;
  insideTeam: "A" | "B";
  teamAName: string;
  teamBName: string;
  teamAPlayers: number;
  teamBPlayers: number;
  teamAEliminated: number;
  teamBEliminated: number;
  teamALives: number;
  teamBLives: number;
  teamAWins: number;
  teamBWins: number;
  roundResults: Array<{
    round: number;
    winner: "A" | "B" | null;
    teamA?: { timeSurvived: number; survivors: number; lives: number };
    teamB?: { timeSurvived: number; survivors: number; lives: number };
    decidedAt?: number;
  }>;
  updatedAt: number;
};

const EMPTY_STATE: SiegeState = {
  running: false,
  started: false,
  completed: false,
  secondsLeft: 0,
  durationSeconds: 0,
  timerUpdatedAt: Date.now(),
  intermissionActive: false,
  intermissionEndsAt: null,
  intermissionTotal: 20,
  roundEndActive: false,
  roundEndEndsAt: null,
  roundEndDuration: 10,
  roundEndPending: false,
  roundEndReason: null,
  endGameActive: false,
  endGameEndsAt: null,
  round: 1,
  roundsTotal: 1,
  subround: 1,
  insideTeam: "A",
  teamAName: "Team A",
  teamBName: "Team B",
  teamAPlayers: 0,
  teamBPlayers: 0,
  teamAEliminated: 0,
  teamBEliminated: 0,
  teamALives: 0,
  teamBLives: 0,
  teamAWins: 0,
  teamBWins: 0,
  roundResults: [],
  updatedAt: Date.now(),
};

export default function SiegeSurviveDisplayPage() {
  const [state, setState] = useState<SiegeState>(() => {
    if (typeof window === "undefined") return EMPTY_STATE;
    try {
      const raw = localStorage.getItem("siege_state_display") || "";
      if (!raw) return EMPTY_STATE;
      const merged = { ...EMPTY_STATE, ...(JSON.parse(raw) as SiegeState) };
      if (!Number.isFinite(merged.timerUpdatedAt)) merged.timerUpdatedAt = merged.updatedAt || Date.now();
      if (!Array.isArray(merged.roundResults)) merged.roundResults = [];
      return merged;
    } catch {
      return EMPTY_STATE;
    }
  });
  const [now, setNow] = useState(() => Date.now());
  const channelRef = useRef<BroadcastChannel | null>(null);
  const navChannelRef = useRef<BroadcastChannel | null>(null);
  const lastBeepRef = useRef<number | null>(null);
  const wasIntermissionRef = useRef(false);
  const wasRoundEndRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [confettiPieces, setConfettiPieces] = useState<Array<{ id: number; left: number; size: number; delay: number; duration: number; hue: number }>>([]);

  useEffect(() => {
    setConfettiPieces(
      Array.from({ length: 36 }).map((_, idx) => ({
        id: idx,
        left: Math.random() * 100,
        size: 8 + Math.random() * 12,
        delay: Math.random() * 1.6,
        duration: 2.6 + Math.random() * 2.2,
        hue: Math.floor(Math.random() * 360),
      }))
    );
  }, []);

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
          if (!key || !url) return;
          map[key] = { url, volume: Number(row?.volume ?? 1), loop: row?.loop ?? false };
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
    channelRef.current = new BroadcastChannel("coach-timer-siege");
    channelRef.current.onmessage = (event) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "siege_state") {
        const next = { ...EMPTY_STATE, ...(data.state as SiegeState) };
        if (!Number.isFinite(next.timerUpdatedAt)) next.timerUpdatedAt = next.updatedAt || Date.now();
        setState(next);
        try {
          localStorage.setItem("siege_state_display", JSON.stringify(next));
        } catch {}
      }
    };
    channelRef.current.postMessage({ type: "siege_request_state" });
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

  const displaySeconds = useMemo(() => {
    if (!state.running) return Math.max(0, state.secondsLeft);
    const elapsed = Math.floor((now - state.timerUpdatedAt) / 1000);
    const raw = Math.max(0, state.secondsLeft - (Number.isFinite(elapsed) ? elapsed : 0));
    return raw;
  }, [state.secondsLeft, state.running, state.timerUpdatedAt, now]);

  const intermissionRemaining = useMemo(() => {
    if (!state.intermissionActive || !state.intermissionEndsAt) return 0;
    return Math.max(0, Math.ceil((state.intermissionEndsAt - now) / 1000));
  }, [state.intermissionActive, state.intermissionEndsAt, now]);

  const roundEndRemaining = useMemo(() => {
    if (!state.roundEndActive || !state.roundEndEndsAt) return 0;
    return Math.max(0, Math.ceil((state.roundEndEndsAt - now) / 1000));
  }, [state.roundEndActive, state.roundEndEndsAt, now]);

  const endGameRemaining = useMemo(() => {
    if (!state.endGameActive || !state.endGameEndsAt) return 0;
    return Math.max(0, Math.ceil((state.endGameEndsAt - now) / 1000));
  }, [state.endGameActive, state.endGameEndsAt, now]);

  useEffect(() => {
    if (state.intermissionActive && !wasIntermissionRef.current) {
      playGlobalSfx("siege_next_round");
      lastBeepRef.current = null;
    }
    wasIntermissionRef.current = state.intermissionActive;
  }, [state.intermissionActive]);

  useEffect(() => {
    if (state.roundEndActive && !wasRoundEndRef.current) {
      const playBeep = () => {
        const played = playGlobalSfx("siege_countdown_beep");
        if (played) return;
        const ctx =
          audioCtxRef.current ??
          (() => {
            const created = new AudioContext();
            audioCtxRef.current = created;
            return created;
          })();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = 880;
        gain.gain.value = 0.06;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const nowTime = ctx.currentTime;
        osc.start(nowTime);
        osc.stop(nowTime + 0.12);
      };
      playBeep();
      window.setTimeout(playBeep, 200);
      window.setTimeout(playBeep, 400);
    }
    wasRoundEndRef.current = state.roundEndActive;
  }, [state.roundEndActive]);

  useEffect(() => {
    if (!state.intermissionActive) return;
    if (intermissionRemaining <= 0) return;
    if (intermissionRemaining <= 10 && lastBeepRef.current !== intermissionRemaining) {
      const played = playGlobalSfx("siege_countdown_beep");
      if (!played) {
        const ctx =
          audioCtxRef.current ??
          (() => {
            const created = new AudioContext();
            audioCtxRef.current = created;
            return created;
          })();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = 880;
        gain.gain.value = 0.05;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const nowTime = ctx.currentTime;
        osc.start(nowTime);
        osc.stop(nowTime + 0.12);
      }
      lastBeepRef.current = intermissionRemaining;
    }
  }, [state.intermissionActive, intermissionRemaining]);

  useEffect(() => {
    if (!state.endGameActive) return;
    playGlobalSfx("siege_game_over");
  }, [state.endGameActive]);

  useEffect(() => {
    if (!state.started) {
      fadeOutGlobalMusic(600);
      return;
    }
    const blocked = !state.running || state.intermissionActive || state.roundEndActive || state.endGameActive;
    if (blocked) {
      fadeOutGlobalMusic(800);
      return;
    }
    playGlobalMusic("siege_survive_music");
  }, [state.started, state.running, state.intermissionActive, state.roundEndActive, state.endGameActive]);

  const timeText = useMemo(() => {
    const minutes = Math.floor(displaySeconds / 60);
    const seconds = displaySeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [displaySeconds]);

  const insideName = state.insideTeam === "A" ? state.teamAName : state.teamBName;
  const outsideName = state.insideTeam === "A" ? state.teamBName : state.teamAName;
  const insideLives = state.insideTeam === "A" ? state.teamALives : state.teamBLives;

  const roundLog = state.roundResults ?? [];
  return (
    <AuthGate>
      <main style={page()}>
        <style>{`
          @keyframes siegeFlash {
            0% { opacity: 0.15; transform: scale(0.98); }
            50% { opacity: 1; transform: scale(1.02); }
            100% { opacity: 0.15; transform: scale(0.98); }
          }
          @keyframes confettiFall {
            0% { transform: translateY(-10vh) rotate(0deg); opacity: 0; }
            10% { opacity: 1; }
            100% { transform: translateY(110vh) rotate(540deg); opacity: 0; }
          }
          .siege-bg {
            position: relative;
          }
          .siege-bg::before {
            content: "";
            position: absolute;
            inset: 0;
            background:
              radial-gradient(circle at top, rgba(34,197,94,0.18), transparent 45%),
              radial-gradient(circle at bottom, rgba(59,130,246,0.18), transparent 45%);
            opacity: 0.7;
            pointer-events: none;
          }
        `}</style>
        {state.intermissionActive && intermissionRemaining > 0 ? (
          <div style={intermissionOverlay()}>
            <div style={intermissionNumber()}>{intermissionRemaining}</div>
            <div style={intermissionLabel()}>Next round starting…</div>
          </div>
        ) : null}
        {state.roundEndActive && roundEndRemaining > 0 ? (
          <div style={roundEndOverlay()}>
            <div style={roundEndTitle()}>Round Ended</div>
            <div style={roundEndSub()}>Get ready…</div>
          </div>
        ) : null}
        {state.endGameActive && endGameRemaining > 0 ? (
          <div style={endGameOverlay()}>
            <div style={confettiWrap()}>{renderConfetti(confettiPieces)}</div>
            <div style={endGameTitle()}>{winnerLabel(state)}</div>
            <div style={endGameSub()}>Game ends in {endGameRemaining}s</div>
            <div style={endGameScoreRow()}>
              <div style={endGameScoreCard()}>
                <div style={endGameScoreLabel()}>{state.teamAName || "Team A"}</div>
                <div style={endGameScoreValue()}>{state.teamAWins}</div>
              </div>
              <div style={endGameScoreDash()}>-</div>
              <div style={endGameScoreCard()}>
                <div style={endGameScoreLabel()}>{state.teamBName || "Team B"}</div>
                <div style={endGameScoreValue()}>{state.teamBWins}</div>
              </div>
            </div>
          </div>
        ) : null}
        <div className="siege-bg" style={layout()}>
          <div style={header()}>
            <div>
              <div style={title()}>Siege &amp; Survive</div>
              <div style={subtitle()}>Inside vs Outside • Round {state.round}/{state.roundsTotal}</div>
            </div>
            <div style={statusBadge(state.running, state.completed, state.intermissionActive, state.roundEndActive, state.endGameActive)}>
              {state.completed
                ? "Game Ended"
                : state.roundEndActive
                ? "Round Ended"
                : state.intermissionActive
                ? "Intermission"
                : state.running
                ? "LIVE"
                : "Paused"}
            </div>
          </div>
          <div style={roundBanner()}>
            ROUND {state.round}
          </div>

          <div style={scoreRow()}>
            <div style={scoreBigCard()}>
              <div style={scoreBigLabel()}>{state.teamAName || "Team A"}</div>
              <div style={scoreBigValue()}>{state.teamAWins}</div>
            </div>
            <div style={scoreBigDash()}>-</div>
            <div style={scoreBigCard()}>
              <div style={scoreBigLabel()}>{state.teamBName || "Team B"}</div>
              <div style={scoreBigValue()}>{state.teamBWins}</div>
            </div>
          </div>

          <div style={roundLogWrap()}>
            <div style={roundLogTitle()}>Round Log</div>
            {renderRoundCards(roundLog, state.teamAName || "Team A", state.teamBName || "Team B")}
          </div>

          <div style={arenaRow()}>
            <div style={teamPanel(state.insideTeam === "A")}>
              <div style={teamHeader()}>
                <div style={teamName()}>{state.teamAName || "Team A"}</div>
                {state.insideTeam === "A" ? <div style={roleTagLarge()}>INSIDE</div> : <div style={roleTagMutedLarge()}>OUTSIDE</div>}
              </div>
              <div style={lifeRow()}>
                <div style={lifePillLarge()}>{state.teamALives} lives</div>
                <div style={elimsPill()}>
                  {Math.min(state.teamAEliminated, state.teamAPlayers)}/{state.teamAPlayers} eliminated
                </div>
              </div>
              <div style={playerGridWrap(state.insideTeam === "A")}>
                <div style={playerGrid()}>
                  {renderPlayers(state.teamAPlayers, state.teamAEliminated)}
                </div>
              </div>
            </div>

            <div style={centerColumn()}>
              <div style={timerWrap()}>
                <div style={timerLabel()}>Round Timer</div>
                <div style={timerValue()}>{timeText}</div>
              </div>
              <div style={statusLine(state.completed)}>
                {state.completed
                  ? `Game ended • ${state.teamAName || "Team A"} ${state.teamAWins} - ${state.teamBName || "Team B"} ${state.teamBWins}`
                  : state.started
                  ? "Game live"
                  : "Game not started"}
              </div>
            </div>

            <div style={teamPanel(state.insideTeam === "B")}>
              <div style={teamHeader()}>
                <div style={teamName()}>{state.teamBName || "Team B"}</div>
                {state.insideTeam === "B" ? <div style={roleTagLarge()}>INSIDE</div> : <div style={roleTagMutedLarge()}>OUTSIDE</div>}
              </div>
              <div style={lifeRow()}>
                <div style={lifePillLarge()}>{state.teamBLives} lives</div>
                <div style={elimsPill()}>
                  {Math.min(state.teamBEliminated, state.teamBPlayers)}/{state.teamBPlayers} eliminated
                </div>
              </div>
              <div style={playerGridWrap(state.insideTeam === "B")}>
                <div style={playerGrid()}>
                  {renderPlayers(state.teamBPlayers, state.teamBEliminated)}
                </div>
              </div>
            </div>
          </div>

          <div style={diagramRow()}>
            <div style={diagramOutsideLabel()}>Outside</div>
            <div style={diagramBox()}>
              <div style={diagramInsideLabel()}>Inside</div>
              <div style={diagramName()}>{insideName || "Inside"}</div>
            </div>
            <div style={diagramOutsideName()}>{outsideName || "Outside"}</div>
          </div>

          {state.started ? (
            <div style={insideBanner()}>
              Inside lives: {insideLives} • Losses apply to Inside team only
            </div>
          ) : (
            <div style={insideBannerMuted()}>Waiting for coach to start the game…</div>
          )}
        </div>
      </main>
    </AuthGate>
  );
}

function renderPlayers(total: number, eliminated: number) {
  const safeTotal = Math.max(0, Number(total || 0));
  const safeElim = Math.min(safeTotal, Math.max(0, Number(eliminated || 0)));
  const aliveCount = safeTotal - safeElim;
  return Array.from({ length: safeTotal }).map((_, idx) => {
    const alive = idx < aliveCount;
    return (
      <div key={idx} style={playerCard(alive)}>
        <div style={playerHead(alive)} />
        <div style={playerBody(alive)} />
      </div>
    );
  });
}

function intermissionOverlay(): React.CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    display: "grid",
    placeItems: "center",
    background: "rgba(3,7,18,0.72)",
    backdropFilter: "blur(6px)",
  };
}

function intermissionNumber(): React.CSSProperties {
  return {
    fontSize: 180,
    fontWeight: 1000,
    letterSpacing: 6,
    color: "#fff",
    textShadow: "0 0 30px rgba(34,197,94,0.35)",
    animation: "siegeFlash 1s infinite",
  };
}

function intermissionLabel(): React.CSSProperties {
  return {
    marginTop: -18,
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    opacity: 0.85,
  };
}

function roundEndOverlay(): React.CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    zIndex: 9998,
    display: "grid",
    placeItems: "center",
    background: "rgba(2,6,23,0.78)",
    backdropFilter: "blur(4px)",
  };
}

function roundEndTitle(): React.CSSProperties {
  return {
    fontSize: 84,
    fontWeight: 1000,
    letterSpacing: 3,
    textTransform: "uppercase",
    color: "#fff",
    textShadow: "0 0 22px rgba(59,130,246,0.4)",
    animation: "siegeFlash 0.8s infinite",
  };
}

function roundEndSub(): React.CSSProperties {
  return {
    marginTop: -6,
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    opacity: 0.75,
  };
}

function endGameOverlay(): React.CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    zIndex: 9997,
    display: "grid",
    placeItems: "center",
    background: "rgba(2,6,23,0.82)",
    backdropFilter: "blur(6px)",
  };
}

function endGameTitle(): React.CSSProperties {
  return {
    fontSize: 96,
    fontWeight: 1000,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#fff",
    textShadow: "0 0 30px rgba(250,204,21,0.35)",
    animation: "siegeFlash 1s infinite",
  };
}

function endGameSub(): React.CSSProperties {
  return {
    marginTop: -4,
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    opacity: 0.8,
  };
}

function endGameScoreRow(): React.CSSProperties {
  return {
    marginTop: 24,
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    gap: 24,
    minWidth: 520,
  };
}

function endGameScoreCard(): React.CSSProperties {
  return {
    borderRadius: 24,
    padding: "18px 24px",
    border: "1px solid rgba(255,255,255,0.3)",
    background: "rgba(15,23,42,0.7)",
    textAlign: "center",
  };
}

function endGameScoreLabel(): React.CSSProperties {
  return { fontSize: 20, fontWeight: 800, opacity: 0.8, textTransform: "uppercase", letterSpacing: 1.2 };
}

function endGameScoreValue(): React.CSSProperties {
  return { fontSize: 64, fontWeight: 1000, marginTop: 4 };
}

function endGameScoreDash(): React.CSSProperties {
  return { fontSize: 48, fontWeight: 900, opacity: 0.6 };
}

function confettiWrap(): React.CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    overflow: "hidden",
    pointerEvents: "none",
  };
}

function renderConfetti(pieces: Array<{ id: number; left: number; size: number; delay: number; duration: number; hue: number }>) {
  return pieces.map((piece) => (
    <div
      key={piece.id}
      style={{
        position: "absolute",
        top: "-12%",
        left: `${piece.left}%`,
        width: piece.size,
        height: piece.size * 1.4,
        borderRadius: 3,
        background: `hsl(${piece.hue} 90% 60%)`,
        boxShadow: "0 0 12px rgba(255,255,255,0.3)",
        animation: `confettiFall ${piece.duration}s linear ${piece.delay}s infinite`,
      }}
    />
  ));
}

function winnerLabel(state: SiegeState): string {
  if (state.teamAWins === state.teamBWins) return "Tie Game";
  if (state.teamAWins > state.teamBWins) return `${state.teamAName || "Team A"} Wins`;
  return `${state.teamBName || "Team B"} Wins`;
}

function page(): React.CSSProperties {
  return {
    minHeight: "100vh",
    background: "radial-gradient(circle at top, rgba(15,23,42,0.95), rgba(2,6,23,1))",
    color: "white",
    padding: 28,
  };
}

function layout(): React.CSSProperties {
  return { display: "grid", gap: 20, position: "relative" };
}

function header(): React.CSSProperties {
  return { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap" };
}

function title(): React.CSSProperties {
  return { fontSize: 32, fontWeight: 1000, letterSpacing: 0.4 };
}

function subtitle(): React.CSSProperties {
  return { fontSize: 14, opacity: 0.7, letterSpacing: 0.4 };
}

function roundBanner(): React.CSSProperties {
  return {
    justifySelf: "center",
    fontSize: 36,
    fontWeight: 1000,
    letterSpacing: 2,
    textTransform: "uppercase",
    padding: "6px 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(15,23,42,0.6)",
  };
}

function statusBadge(
  running: boolean,
  completed: boolean,
  intermission: boolean,
  roundEnd: boolean,
  endGame: boolean
): React.CSSProperties {
  const color = completed
    ? "rgba(251,191,36,0.4)"
    : endGame
    ? "rgba(250,204,21,0.5)"
    : roundEnd
    ? "rgba(248,113,113,0.5)"
    : intermission
    ? "rgba(59,130,246,0.5)"
    : running
    ? "rgba(34,197,94,0.5)"
    : "rgba(148,163,184,0.4)";
  return {
    padding: "8px 14px",
    borderRadius: 999,
    border: `1px solid ${color}`,
    background: "rgba(15,23,42,0.6)",
    fontWeight: 900,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  };
}

function statusLine(ended: boolean): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 999,
    border: ended ? "1px solid rgba(251,191,36,0.6)" : "1px solid rgba(255,255,255,0.18)",
    background: ended ? "rgba(251,191,36,0.12)" : "rgba(15,23,42,0.6)",
    fontSize: 12,
    fontWeight: 900,
    width: "fit-content",
  };
}

function timerWrap(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: "16px 20px",
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(15,23,42,0.7)",
    display: "grid",
    gap: 6,
    justifyItems: "center",
  };
}

function timerLabel(): React.CSSProperties {
  return { fontSize: 12, opacity: 0.7, letterSpacing: 0.6, textTransform: "uppercase" };
}

function timerValue(): React.CSSProperties {
  return { fontSize: 120, fontWeight: 1000, letterSpacing: 4 };
}

function diagramRow(): React.CSSProperties {
  return { display: "grid", justifyItems: "center", gap: 8 };
}

function diagramOutsideLabel(): React.CSSProperties {
  return { fontSize: 12, opacity: 0.7, letterSpacing: 0.6, textTransform: "uppercase" };
}

function diagramBox(): React.CSSProperties {
  return {
    width: 240,
    height: 160,
    borderRadius: 18,
    border: "2px solid rgba(34,197,94,0.6)",
    background: "rgba(34,197,94,0.08)",
    display: "grid",
    placeItems: "center",
    position: "relative",
  };
}

function diagramInsideLabel(): React.CSSProperties {
  return {
    position: "absolute",
    top: 12,
    fontSize: 12,
    opacity: 0.7,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  };
}

function diagramName(): React.CSSProperties {
  return { fontWeight: 1000, fontSize: 22 };
}

function diagramOutsideName(): React.CSSProperties {
  return { fontWeight: 900, fontSize: 16, opacity: 0.9 };
}

function teamGrid(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 };
}

function arenaRow(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 18, alignItems: "start" };
}

function centerColumn(): React.CSSProperties {
  return { display: "grid", gap: 16, alignItems: "center", justifyItems: "center" };
}

function teamPanel(isInside: boolean): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: "16px 18px",
    border: isInside ? "1px solid rgba(34,197,94,0.5)" : "1px solid rgba(255,255,255,0.12)",
    background: isInside ? "rgba(34,197,94,0.12)" : "rgba(15,23,42,0.7)",
    display: "grid",
    gap: 12,
  };
}

function teamHeader(): React.CSSProperties {
  return { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 };
}

function teamName(): React.CSSProperties {
  return { fontWeight: 1000, fontSize: 18 };
}

function roleTag(): React.CSSProperties {
  return {
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(34,197,94,0.7)",
    background: "rgba(34,197,94,0.2)",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  };
}

function roleTagLarge(): React.CSSProperties {
  return {
    padding: "6px 14px",
    borderRadius: 999,
    border: "1px solid rgba(34,197,94,0.7)",
    background: "rgba(34,197,94,0.2)",
    fontSize: 13,
    fontWeight: 1000,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  };
}

function roleTagMuted(): React.CSSProperties {
  return {
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.5)",
    background: "rgba(15,23,42,0.5)",
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    opacity: 0.7,
  };
}

function roleTagMutedLarge(): React.CSSProperties {
  return {
    padding: "6px 14px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.5)",
    background: "rgba(15,23,42,0.5)",
    fontSize: 13,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    opacity: 0.75,
  };
}

function lifeRow(): React.CSSProperties {
  return { display: "flex", gap: 8, flexWrap: "wrap" };
}

function lifePill(): React.CSSProperties {
  return {
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(34,197,94,0.5)",
    background: "rgba(34,197,94,0.15)",
    fontSize: 11,
    fontWeight: 900,
  };
}

function lifePillLarge(): React.CSSProperties {
  return {
    padding: "6px 14px",
    borderRadius: 999,
    border: "1px solid rgba(34,197,94,0.6)",
    background: "rgba(34,197,94,0.2)",
    fontSize: 13,
    fontWeight: 1000,
  };
}

function elimsPill(): React.CSSProperties {
  return {
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.5)",
    background: "rgba(148,163,184,0.15)",
    fontSize: 11,
    fontWeight: 900,
  };
}

function playerGrid(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "repeat(3, minmax(40px, 1fr))", gap: 8 };
}

function playerGridWrap(isInside: boolean): React.CSSProperties {
  const color = isInside ? "rgba(34,197,94,0.7)" : "rgba(148,163,184,0.4)";
  return {
    borderRadius: 14,
    padding: 8,
    border: `2px solid ${color}`,
    background: "rgba(2,6,23,0.5)",
  };
}

function playerCard(alive: boolean): React.CSSProperties {
  return {
    borderRadius: "12px 12px 8px 8px",
    border: "1px solid rgba(255,255,255,0.14)",
    background: alive ? "rgba(34,197,94,0.6)" : "rgba(148,163,184,0.35)",
    padding: "6px 4px",
    height: 64,
    display: "grid",
    justifyItems: "center",
    alignContent: "center",
    gap: 4,
  };
}

function playerHead(alive: boolean): React.CSSProperties {
  return {
    width: 16,
    height: 16,
    borderRadius: "50%",
    background: alive ? "rgba(15,23,42,0.85)" : "rgba(30,41,59,0.7)",
  };
}

function playerBody(alive: boolean): React.CSSProperties {
  return {
    width: 20,
    height: 18,
    borderRadius: 6,
    background: alive ? "rgba(15,23,42,0.85)" : "rgba(30,41,59,0.7)",
  };
}

function insideBanner(): React.CSSProperties {
  return {
    padding: "8px 14px",
    borderRadius: 999,
    border: "1px solid rgba(34,197,94,0.5)",
    background: "rgba(34,197,94,0.15)",
    fontSize: 12,
    fontWeight: 900,
    width: "fit-content",
  };
}

function insideBannerMuted(): React.CSSProperties {
  return {
    padding: "8px 14px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.4)",
    background: "rgba(15,23,42,0.6)",
    fontSize: 12,
    fontWeight: 800,
    opacity: 0.7,
    width: "fit-content",
  };
}

function scoreStrip(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, width: "100%" };
}

function scoreItem(active: boolean): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: "10px 12px",
    border: active ? "1px solid rgba(34,197,94,0.6)" : "1px solid rgba(255,255,255,0.12)",
    background: active ? "rgba(34,197,94,0.12)" : "rgba(15,23,42,0.7)",
    display: "grid",
    gap: 4,
    justifyItems: "center",
  };
}

function scoreLabel(): React.CSSProperties {
  return { fontSize: 11, opacity: 0.7, letterSpacing: 0.6, textTransform: "uppercase" };
}

function scoreValue(): React.CSSProperties {
  return { fontSize: 22, fontWeight: 1000 };
}

function scoreMeta(): React.CSSProperties {
  return { fontSize: 11, opacity: 0.75, fontWeight: 800 };
}

function scoreRow(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 20, alignItems: "center" };
}

function scoreBigCard(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: "12px 16px",
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(15,23,42,0.7)",
    display: "grid",
    justifyItems: "center",
    gap: 4,
  };
}

function scoreBigLabel(): React.CSSProperties {
  return { fontSize: 12, opacity: 0.7, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 900 };
}

function scoreBigValue(): React.CSSProperties {
  return { fontSize: 48, fontWeight: 1000 };
}

function scoreBigDash(): React.CSSProperties {
  return { fontSize: 42, fontWeight: 900, opacity: 0.6 };
}

function roundLogWrap(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: "16px 18px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(2,6,23,0.6)",
    display: "grid",
    gap: 10,
    width: "100%",
  };
}

function roundLogTitle(): React.CSSProperties {
  return { fontWeight: 1000, fontSize: 13, letterSpacing: 0.6, textTransform: "uppercase", opacity: 0.8 };
}

function roundRow(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: "14px 14px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.7)",
    display: "grid",
    gap: 8,
    minHeight: 140,
  };
}

function roundRowLabel(): React.CSSProperties {
  return { fontWeight: 1000, fontSize: 22 };
}

function roundRowMeta(): React.CSSProperties {
  return { fontSize: 13, opacity: 0.85 };
}

function roundWinnerBadge(winner: "A" | "B"): React.CSSProperties {
  const color = winner === "A" ? "rgba(34,197,94,0.7)" : "rgba(59,130,246,0.7)";
  return {
    fontSize: 11,
    fontWeight: 900,
    padding: "4px 8px",
    borderRadius: 999,
    border: `1px solid ${color}`,
    background: "rgba(2,6,23,0.5)",
    width: "fit-content",
  };
}

function roundEmpty(): React.CSSProperties {
  return { fontSize: 12, opacity: 0.7 };
}

function renderRoundCards(results: SiegeState["roundResults"], teamAName: string, teamBName: string) {
  const totalRounds = Math.max(3, Math.max(...results.map((r) => r.round), 0));
  const rows = Array.from({ length: totalRounds }).map((_, idx) => {
    const round = idx + 1;
    const result = results.find((r) => r.round === round) || null;
    const winner = result?.winner ?? null;
    const a = result?.teamA;
    const b = result?.teamB;
    return (
      <div key={round} style={roundRow()}>
        <div style={roundRowLabel()}>Round {round}</div>
        <div style={roundTeamRow()}>
          <div style={roundTeamBadge(winner === "A")}>{teamAName}</div>
          <div style={roundTeamBadge(winner === "B")}>{teamBName}</div>
        </div>
        <div style={roundInfoRow()}>
          <div>Time: {a ? `${Math.floor(a.timeSurvived / 60)}:${String(a.timeSurvived % 60).padStart(2, "0")}` : "—"}</div>
          <div>Players: {a ? a.survivors : "—"}</div>
          <div>Lives: {a ? a.lives : "—"}</div>
        </div>
        <div style={roundInfoRow()}>
          <div>Time: {b ? `${Math.floor(b.timeSurvived / 60)}:${String(b.timeSurvived % 60).padStart(2, "0")}` : "—"}</div>
          <div>Players: {b ? b.survivors : "—"}</div>
          <div>Lives: {b ? b.lives : "—"}</div>
        </div>
        {result?.winner === null && result?.decidedAt ? <div style={roundRowMeta()}>Tie • extra round added</div> : null}
      </div>
    );
  });
  return <div style={roundScrollRow()}>{rows}</div>;
}

function roundScrollRow(): React.CSSProperties {
  return {
    display: "grid",
    gridAutoFlow: "column",
    gridAutoColumns: "minmax(260px, 1fr)",
    gap: 12,
    overflowX: "auto",
    paddingBottom: 4,
  };
}

function roundTeamRow(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 };
}

function roundTeamBadge(winner: boolean): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: winner ? "2px solid rgba(34,197,94,0.7)" : "1px solid rgba(255,255,255,0.18)",
    background: winner ? "rgba(34,197,94,0.18)" : "rgba(15,23,42,0.6)",
    fontSize: 13,
    fontWeight: 900,
    textAlign: "center",
  };
}

function roundInfoRow(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, fontSize: 13, opacity: 0.9 };
}

function timerRouteForKey(key: string) {
  if (key === "ctf") return "/display/ctf";
  if (key === "crack_a_bat") return "/display/crack-a-bat";
  if (key === "siege_survive") return "/display/siege-survive";
  return "";
}

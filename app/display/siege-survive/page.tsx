"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AuthGate from "@/components/AuthGate";

type SiegeState = {
  running: boolean;
  started: boolean;
  completed: boolean;
  secondsLeft: number;
  durationSeconds: number;
  timerUpdatedAt: number;
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

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
    channelRef.current = new BroadcastChannel("coach-timer-siege");
    channelRef.current.onmessage = (event) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "siege_state") {
        const next = { ...EMPTY_STATE, ...(data.state as SiegeState) };
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

  const baseStartRef = useRef<number>(Date.now());
  const baseSecondsRef = useRef<number>(0);
  const lastDisplayRef = useRef<number>(0);
  const lastSecondsRef = useRef<number>(0);
  const lastRoundRef = useRef<number>(0);
  const lastRunningRef = useRef<boolean>(false);
  useEffect(() => {
    const nextSeconds = Math.max(0, state.secondsLeft);
    const runningChanged = lastRunningRef.current !== state.running;
    const roundChanged = lastRoundRef.current !== state.round;
    if (runningChanged || roundChanged) {
      baseStartRef.current = Date.now();
      baseSecondsRef.current = nextSeconds;
      lastSecondsRef.current = nextSeconds;
      lastRoundRef.current = state.round;
      lastRunningRef.current = state.running;
      return;
    }
    const prevSeconds = lastSecondsRef.current || nextSeconds;
    if (nextSeconds < prevSeconds) {
      baseStartRef.current = Date.now();
      baseSecondsRef.current = nextSeconds;
      lastSecondsRef.current = nextSeconds;
    }
  }, [state.secondsLeft, state.running, state.round]);

  const displaySeconds = useMemo(() => {
    if (!state.running) return Math.max(0, state.secondsLeft);
    const elapsed = Math.floor((now - baseStartRef.current) / 1000);
    const raw = Math.max(0, baseSecondsRef.current - elapsed);
    const prev = lastDisplayRef.current || raw;
    return Math.min(raw, prev);
  }, [state.secondsLeft, state.running, now]);

  useEffect(() => {
    lastDisplayRef.current = displaySeconds;
  }, [displaySeconds, state.running]);

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
        <div className="siege-bg" style={layout()}>
          <div style={header()}>
            <div>
              <div style={title()}>Siege &amp; Survive</div>
              <div style={subtitle()}>Inside vs Outside • Round {state.round}/{state.roundsTotal}</div>
            </div>
            <div style={statusBadge(state.running, state.completed)}>
              {state.completed ? "Game Ended" : state.running ? "LIVE" : "Paused"}
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

function statusBadge(running: boolean, completed: boolean): React.CSSProperties {
  const color = completed ? "rgba(251,191,36,0.4)" : running ? "rgba(34,197,94,0.5)" : "rgba(148,163,184,0.4)";
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

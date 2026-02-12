"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AuthGate from "@/components/AuthGate";
import { playGlobalSfx, setGlobalSounds } from "@/lib/globalAudio";

type TimerKey = "ctf" | "fishy_fish" | "cross_my_ocean" | "crack_a_bat" | "siege_survive";

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

type RosterStudent = {
  id: string;
  name: string;
  level?: number | null;
  points_total?: number | null;
  avatar_storage_path?: string | null;
  avatar_bg?: string | null;
};

type WinnerCard = {
  id: string;
  name: string;
  level?: number | null;
  points_total?: number | null;
  avatar_storage_path?: string | null;
  points_awarded: number;
};

type CrackState = {
  running: boolean;
  secondsLeft: number;
  durationSeconds: number;
  steps: number;
  ruleSeconds: number;
  ruleCount: number;
  ruleNote: string;
  suddenDeathAt: number;
  eliminatedIds: string[];
  winners: WinnerCard[];
  updatedAt: number;
};

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

type TimerArtwork = {
  ctf: string;
  crack_a_bat: string;
  fishy_fish: string;
  cross_my_ocean: string;
  siege_survive: string;
};

const TIMER_CARDS: Array<{ key: TimerKey; label: string; desc: string; active?: boolean }> = [
  { key: "fishy_fish", label: "Fishy Fishy Cross My Ocean", desc: "Timer placeholder for Fishy Fishy Cross My Ocean.", active: false },
  { key: "cross_my_ocean", label: "Cross My Ocean", desc: "Timer placeholder for Cross My Ocean.", active: false },
  { key: "crack_a_bat", label: "Crack a Bat", desc: "Crack a Bat timer + rules.", active: true },
  { key: "siege_survive", label: "Siege & Survive (Box Game)", desc: "Round timer with inside/outside swaps + lives.", active: true },
  { key: "ctf", label: "CTF", desc: "Capture the Flag timer + scoring.", active: true },
];

const DEFAULT_CTF_SECONDS = 10 * 60;
const DEFAULT_SAFE_ZONE_SECONDS = 10;
const DEFAULT_CRACK_SECONDS = 5 * 60;
const SIEGE_INTERMISSION_SECONDS = 20;
const SIEGE_ROUND_END_SECONDS = 10;
const SIEGE_END_RESET_SECONDS = 10;

function initialCtfState(): CtfState {
  return {
    running: false,
    secondsLeft: DEFAULT_CTF_SECONDS,
    durationSeconds: DEFAULT_CTF_SECONDS,
    safeZoneSeconds: DEFAULT_SAFE_ZONE_SECONDS,
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
}

function initialCrackState(): CrackState {
  return {
    running: false,
    secondsLeft: DEFAULT_CRACK_SECONDS,
    durationSeconds: DEFAULT_CRACK_SECONDS,
    steps: 3,
    ruleSeconds: 3,
    ruleCount: 3,
    ruleNote: "Burpees",
    suddenDeathAt: 60,
    eliminatedIds: [],
    winners: [],
    updatedAt: Date.now(),
  };
}

function initialSiegeState(): SiegeState {
  return {
    running: false,
    started: false,
    completed: false,
    secondsLeft: 2 * 60,
    durationSeconds: 2 * 60,
    timerUpdatedAt: Date.now(),
    intermissionActive: false,
    intermissionEndsAt: null,
    intermissionTotal: SIEGE_INTERMISSION_SECONDS,
    roundEndActive: false,
    roundEndEndsAt: null,
    roundEndDuration: SIEGE_ROUND_END_SECONDS,
    roundEndPending: false,
    roundEndReason: null,
    endGameActive: false,
    endGameEndsAt: null,
    round: 1,
    roundsTotal: 3,
    subround: 1,
    insideTeam: "A",
    teamAName: "Team A",
    teamBName: "Team B",
    teamAPlayers: 6,
    teamBPlayers: 6,
    teamAEliminated: 0,
    teamBEliminated: 0,
    teamALives: 0,
    teamBLives: 0,
    teamAWins: 0,
    teamBWins: 0,
    roundResults: [],
    updatedAt: Date.now(),
  };
}

export default function CoachTimersPage() {
  const [activeTimer, setActiveTimer] = useState<TimerKey | null>(null);
  const [timerArtwork, setTimerArtwork] = useState<TimerArtwork>({
    ctf: "",
    crack_a_bat: "",
    fishy_fish: "",
    cross_my_ocean: "",
    siege_survive: "",
  });
  const [lockedInstanceId, setLockedInstanceId] = useState("");
  const [crackRoster, setCrackRoster] = useState<RosterStudent[]>([]);
  const [crackRosterMsg, setCrackRosterMsg] = useState("");
  const [crackRosterLoading, setCrackRosterLoading] = useState(false);
  const [crackAwardPoints, setCrackAwardPoints] = useState(5);
  const [ctfState, setCtfState] = useState<CtfState>(() => {
    if (typeof window === "undefined") return initialCtfState();
    try {
      const raw = localStorage.getItem("ctf_state_local") || "";
      if (!raw) return initialCtfState();
      const parsed = JSON.parse(raw) as CtfState;
      if (!parsed || typeof parsed !== "object") return initialCtfState();
      return { ...initialCtfState(), ...parsed };
    } catch {
      return initialCtfState();
    }
  });
  const [crackState, setCrackState] = useState<CrackState>(() => {
    if (typeof window === "undefined") return initialCrackState();
    try {
      const raw = localStorage.getItem("crack_state_local") || "";
      if (!raw) return initialCrackState();
      const parsed = JSON.parse(raw) as CrackState;
      if (!parsed || typeof parsed !== "object") return initialCrackState();
      return { ...initialCrackState(), ...parsed };
    } catch {
      return initialCrackState();
    }
  });
  const [siegeState, setSiegeState] = useState<SiegeState>(() => {
    if (typeof window === "undefined") return initialSiegeState();
    try {
      const raw = localStorage.getItem("siege_state_local") || "";
      if (!raw) return initialSiegeState();
      const parsed = JSON.parse(raw) as SiegeState;
      if (!parsed || typeof parsed !== "object") return initialSiegeState();
      const merged = { ...initialSiegeState(), ...parsed };
      if (!Number.isFinite(merged.timerUpdatedAt)) merged.timerUpdatedAt = merged.updatedAt || Date.now();
      if (!Array.isArray(merged.roundResults)) merged.roundResults = [];
      return merged;
    } catch {
      return initialSiegeState();
    }
  });
  const [now, setNow] = useState(() => Date.now());
  const [siegeTimeUpUntil, setSiegeTimeUpUntil] = useState(0);
  const prevRoundEndActiveRef = useRef(false);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const crackChannelRef = useRef<BroadcastChannel | null>(null);
  const siegeChannelRef = useRef<BroadcastChannel | null>(null);
  const navChannelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
    channelRef.current = new BroadcastChannel("coach-timer-ctf");
    channelRef.current.onmessage = (event) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "ctf_request_state") {
        channelRef.current?.postMessage({ type: "ctf_state", state: { ...ctfState, updatedAt: Date.now() } });
      }
    };
    return () => {
      channelRef.current?.close();
      channelRef.current = null;
    };
  }, [ctfState]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
    crackChannelRef.current = new BroadcastChannel("coach-timer-crack");
    crackChannelRef.current.onmessage = (event) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "crack_request_state") {
        crackChannelRef.current?.postMessage({ type: "crack_state", state: { ...crackState, updatedAt: Date.now() } });
      }
    };
    return () => {
      crackChannelRef.current?.close();
      crackChannelRef.current = null;
    };
  }, [crackState]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
    siegeChannelRef.current = new BroadcastChannel("coach-timer-siege");
    siegeChannelRef.current.onmessage = (event) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "siege_request_state") {
        siegeChannelRef.current?.postMessage({ type: "siege_state", state: { ...siegeState, updatedAt: Date.now() } });
      }
    };
    return () => {
      siegeChannelRef.current?.close();
      siegeChannelRef.current = null;
    };
  }, [siegeState]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
    navChannelRef.current = new BroadcastChannel("coach-timer-nav");
    return () => {
      navChannelRef.current?.close();
      navChannelRef.current = null;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const prev = prevRoundEndActiveRef.current;
    if (!prev && siegeState.roundEndActive) {
      setSiegeTimeUpUntil(Date.now() + 5000);
    }
    prevRoundEndActiveRef.current = siegeState.roundEndActive;
  }, [siegeState.roundEndActive]);

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
    try {
      const savedInstance = localStorage.getItem("coach_dashboard_lock_instance") || "";
      if (savedInstance) setLockedInstanceId(savedInstance);
    } catch {}
  }, []);

  useEffect(() => {
    if (!lockedInstanceId) return;
    let active = true;
    setCrackRosterLoading(true);
    setCrackRosterMsg("");
    (async () => {
      try {
        const res = await fetch("/api/classroom/roster", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instance_id: lockedInstanceId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok || !data?.ok) {
          setCrackRosterMsg(data?.error || "Failed to load roster");
          setCrackRoster([]);
          return;
        }
        const next = (data?.roster ?? []).map((row: any) => ({
          id: String(row?.student?.id ?? ""),
          name: String(row?.student?.name ?? ""),
          level: row?.student?.level ?? null,
          points_total: row?.student?.points_total ?? null,
          avatar_storage_path: row?.student?.avatar_storage_path ?? null,
          avatar_bg: row?.student?.avatar_bg ?? null,
        }));
        setCrackRoster(next.filter((r: any) => r.id));
      } catch (err: any) {
        if (!active) return;
        setCrackRosterMsg(err?.message ?? "Failed to load roster");
        setCrackRoster([]);
      } finally {
        if (active) setCrackRosterLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [lockedInstanceId]);

  useEffect(() => {
    if (!ctfState.running) return;
    const timer = window.setInterval(() => {
      setCtfState((prev) => {
        if (!prev.running) return prev;
        const nextLeft = Math.max(0, prev.secondsLeft - 1);
        const next = {
          ...prev,
          secondsLeft: nextLeft,
          running: nextLeft > 0 ? prev.running : false,
          lastEvent: nextLeft === 0 ? "Time" : prev.lastEvent,
          updatedAt: Date.now(),
        };
        broadcast(next);
        persist(next);
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [ctfState.running]);

  useEffect(() => {
    if (!crackState.running) return;
    const timer = window.setInterval(() => {
      setCrackState((prev) => {
        if (!prev.running) return prev;
        const nextLeft = Math.max(0, prev.secondsLeft - 1);
        const next = {
          ...prev,
          secondsLeft: nextLeft,
          running: nextLeft > 0 ? prev.running : false,
          updatedAt: Date.now(),
        };
        broadcastCrack(next);
        persistCrack(next);
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [crackState.running]);

  useEffect(() => {
    if (!siegeState.running) return;
    const timer = window.setInterval(() => {
      setSiegeState((prev) => {
        if (!prev.running) return prev;
        if (prev.intermissionActive) return prev;
        const now = Date.now();
        const elapsed = Math.max(1, Math.floor((now - prev.timerUpdatedAt) / 1000));
        if (!Number.isFinite(elapsed) || elapsed <= 0) return prev;
        const nextLeft = Math.max(0, prev.secondsLeft - elapsed);
        if (nextLeft > 0) {
          const next = { ...prev, secondsLeft: nextLeft, timerUpdatedAt: now, updatedAt: now };
          broadcastSiege(next);
          persistSiege(next);
          return next;
        }
        if (prev.roundEndActive) return prev;
        const next = {
          ...prev,
          running: false,
          secondsLeft: 0,
          timerUpdatedAt: now,
          updatedAt: now,
          roundEndActive: true,
          roundEndEndsAt: now + prev.roundEndDuration * 1000,
          roundEndPending: true,
          roundEndReason: "time" as const,
        };
        broadcastSiege(next);
        persistSiege(next);
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [siegeState.running]);

  useEffect(() => {
    if (!siegeState.intermissionActive || !siegeState.intermissionEndsAt) return;
    const ms = Math.max(0, siegeState.intermissionEndsAt - Date.now());
    const timer = window.setTimeout(() => {
      updateSiege((prev) => {
        if (!prev.intermissionActive) return prev;
        return {
          ...prev,
          intermissionActive: false,
          intermissionEndsAt: null,
          running: true,
          timerUpdatedAt: Date.now(),
        };
      });
    }, ms);
    return () => window.clearTimeout(timer);
  }, [siegeState.intermissionActive, siegeState.intermissionEndsAt]);

  useEffect(() => {
    if (!siegeState.roundEndActive || !siegeState.roundEndEndsAt) return;
    const ms = Math.max(0, siegeState.roundEndEndsAt - Date.now());
    const timer = window.setTimeout(() => {
      updateSiege((prev) => {
        if (!prev.roundEndActive) return prev;
        if (prev.roundEndPending && prev.roundEndReason === "time") {
          const next = finalizeSiegeRound(prev, "time", true);
          return {
            ...next,
            roundEndActive: false,
            roundEndEndsAt: null,
            roundEndPending: false,
            roundEndReason: null,
          };
        }
        return {
          ...prev,
          roundEndActive: false,
          roundEndEndsAt: null,
          roundEndPending: false,
          roundEndReason: null,
          intermissionActive: true,
          intermissionEndsAt: Date.now() + prev.intermissionTotal * 1000,
        };
      });
    }, ms);
    return () => window.clearTimeout(timer);
  }, [siegeState.roundEndActive, siegeState.roundEndEndsAt, siegeState.intermissionTotal]);

  useEffect(() => {
    if (!siegeState.endGameActive || !siegeState.endGameEndsAt) return;
    const ms = Math.max(0, siegeState.endGameEndsAt - Date.now());
    const timer = setTimeout(() => {
      updateSiege(() => initialSiegeState());
    }, ms);
    return () => clearTimeout(timer);
  }, [siegeState.endGameActive, siegeState.endGameEndsAt]);

  useEffect(() => {
    if (activeTimer !== "ctf" && activeTimer !== "crack_a_bat" && activeTimer !== "siege_survive") return;
    function onKey(e: KeyboardEvent) {
      if (e.repeat) return;
      const key = e.key.toLowerCase();
      if (key === "s" || e.code === "KeyS") {
        e.preventDefault();
        if (activeTimer === "ctf") triggerSafeZone();
        return;
      }
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }
      if (key === " ") {
        e.preventDefault();
        if (activeTimer === "ctf") toggleStartPause();
        if (activeTimer === "crack_a_bat") crackToggleStart();
        if (activeTimer === "siege_survive") {
          if (!siegeState.started) siegeStartGame();
          else siegeTogglePause();
        }
        return;
      }
      if (key === "r") {
        e.preventDefault();
        if (activeTimer === "ctf") resetTimerOnly();
        if (activeTimer === "crack_a_bat") crackResetTimer();
        return;
      }
      if (key === "x") {
        if (activeTimer === "siege_survive") {
          e.preventDefault();
          siegeEndGame();
          return;
        }
      }
      if (key === "z") {
        e.preventDefault();
        if (activeTimer === "ctf") team1RemoveFlag();
        return;
      }
      if (key === "x") {
        e.preventDefault();
        if (activeTimer === "ctf") team1StealFlag();
        return;
      }
      if (key === ",") {
        e.preventDefault();
        if (activeTimer === "ctf") team2RemoveFlag();
        if (activeTimer === "siege_survive") siegeInsideDown();
        return;
      }
      if (key === ".") {
        e.preventDefault();
        if (activeTimer === "ctf") team2StealFlag();
        if (activeTimer === "siege_survive") siegeInsideUp();
        return;
      }
      if (key === "j") {
        e.preventDefault();
        if (activeTimer === "ctf") triggerJailbreak();
      }
      if (key === "p") {
        e.preventDefault();
        if (activeTimer === "siege_survive") siegePenaltyAdd();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [activeTimer, siegeState.started]);

  function persist(next: CtfState) {
    try {
      localStorage.setItem("ctf_state_local", JSON.stringify(next));
    } catch {}
  }

  function broadcast(next: CtfState) {
    channelRef.current?.postMessage({ type: "ctf_state", state: next });
  }

  function persistCrack(next: CrackState) {
    try {
      localStorage.setItem("crack_state_local", JSON.stringify(next));
    } catch {}
  }

  function broadcastCrack(next: CrackState) {
    crackChannelRef.current?.postMessage({ type: "crack_state", state: next });
  }

  function persistSiege(next: SiegeState) {
    try {
      localStorage.setItem("siege_state_local", JSON.stringify(next));
    } catch {}
  }

  function broadcastSiege(next: SiegeState) {
    siegeChannelRef.current?.postMessage({ type: "siege_state", state: next });
  }

function setupSiegeRound(prev: SiegeState, insideTeam: "A" | "B"): SiegeState {
    const teamAPlayers = Math.max(0, Number(prev.teamAPlayers || 0));
    const teamBPlayers = Math.max(0, Number(prev.teamBPlayers || 0));
    const aLess = teamAPlayers < teamBPlayers;
    const bLess = teamBPlayers < teamAPlayers;
    const teamALives = insideTeam === "A" && aLess ? 2 : 0;
    const teamBLives = insideTeam === "B" && bLess ? 2 : 0;
    return {
      ...prev,
      teamAPlayers,
      teamBPlayers,
      teamAEliminated: 0,
      teamBEliminated: 0,
      teamALives,
      teamBLives,
    };
  }

  function finalizeSiegeRound(prev: SiegeState, reason: "time" | "eliminated", skipRoundEnd = false): SiegeState {
    const inside = prev.insideTeam;
    const players = inside === "A" ? prev.teamAPlayers : prev.teamBPlayers;
    const eliminated = inside === "A" ? prev.teamAEliminated : prev.teamBEliminated;
    const survivors = Math.max(0, players - eliminated);
    const lives = inside === "A" ? prev.teamALives : prev.teamBLives;
    const duration = prev.durationSeconds > 0 ? prev.durationSeconds : 120;
    const timeSurvived = reason === "time" ? duration : Math.max(0, duration - prev.secondsLeft);

    const roundResults = [...(prev.roundResults ?? [])];
    const idx = roundResults.findIndex((r) => r.round === prev.round);
    const base = idx >= 0 ? roundResults[idx] : { round: prev.round, winner: null as "A" | "B" | null };
    const updated =
      inside === "A"
        ? { ...base, teamA: { timeSurvived, survivors, lives } }
        : { ...base, teamB: { timeSurvived, survivors, lives } };
    if (idx >= 0) roundResults[idx] = updated;
    else roundResults.push(updated);

    if (prev.subround === 1) {
      const nextInside = inside === "A" ? "B" : "A";
      const useRoundEnd = reason === "time" && !skipRoundEnd;
      const reset = setupSiegeRound(
        {
          ...prev,
          insideTeam: nextInside,
          secondsLeft: duration,
          durationSeconds: duration,
          roundResults,
          timerUpdatedAt: Date.now(),
          subround: 2,
          intermissionActive: !useRoundEnd,
          intermissionEndsAt: useRoundEnd ? null : Date.now() + prev.intermissionTotal * 1000,
          roundEndActive: useRoundEnd,
          roundEndEndsAt: useRoundEnd ? Date.now() + prev.roundEndDuration * 1000 : null,
          roundEndPending: false,
          roundEndReason: null,
        },
        nextInside
      );
      return {
        ...reset,
        running: false,
        started: true,
        completed: false,
        updatedAt: Date.now(),
      };
    }

    const entry = roundResults.find((r) => r.round === prev.round) ?? updated;
    const a = entry.teamA;
    const b = entry.teamB;
    let winner: "A" | "B" | null = entry.winner ?? null;
    let teamAWins = prev.teamAWins;
    let teamBWins = prev.teamBWins;
    let roundsTotal = prev.roundsTotal;
    let decidedAt: number | undefined = entry.decidedAt;
    if (a && b) {
      if (a.timeSurvived !== b.timeSurvived) {
        winner = a.timeSurvived > b.timeSurvived ? "A" : "B";
      } else {
        const aTotal = (a.survivors ?? 0) + (a.lives ?? 0);
        const bTotal = (b.survivors ?? 0) + (b.lives ?? 0);
        if (aTotal !== bTotal) winner = aTotal > bTotal ? "A" : "B";
        else winner = null;
      }
      decidedAt = Date.now();
      if (winner === "A") teamAWins += 1;
      if (winner === "B") teamBWins += 1;
      if (!winner) roundsTotal += 1;
    }
    const updatedEntry = { ...entry, winner, decidedAt };
    roundResults[roundResults.findIndex((r) => r.round === prev.round)] = updatedEntry;

    const winsReached = teamAWins >= 2 || teamBWins >= 2;
    const roundsReached = prev.round >= roundsTotal;
    if (winsReached || roundsReached) {
      return {
        ...prev,
        running: false,
        started: true,
        completed: true,
        secondsLeft: 0,
        teamAWins,
        teamBWins,
        roundsTotal,
        roundResults,
        timerUpdatedAt: Date.now(),
        updatedAt: Date.now(),
        intermissionActive: false,
        intermissionEndsAt: null,
        roundEndActive: false,
        roundEndEndsAt: null,
        roundEndPending: false,
        roundEndReason: null,
        endGameActive: true,
        endGameEndsAt: Date.now() + SIEGE_END_RESET_SECONDS * 1000,
        subround: 1,
      };
    }

    const nextInside = "A";
    const useRoundEnd = reason === "time" && !skipRoundEnd;
    const reset = setupSiegeRound(
      {
        ...prev,
        insideTeam: nextInside,
        round: prev.round + 1,
        secondsLeft: duration,
        durationSeconds: duration,
        teamAWins,
        teamBWins,
        roundsTotal,
        roundResults,
        timerUpdatedAt: Date.now(),
        subround: 1,
        intermissionActive: !useRoundEnd,
        intermissionEndsAt: useRoundEnd ? null : Date.now() + prev.intermissionTotal * 1000,
        roundEndActive: useRoundEnd,
        roundEndEndsAt: useRoundEnd ? Date.now() + prev.roundEndDuration * 1000 : null,
        roundEndPending: false,
        roundEndReason: null,
      },
      nextInside
    );
    return {
      ...reset,
      running: false,
      started: true,
      completed: false,
      updatedAt: Date.now(),
    };
  }

  function updateCtf(updater: (prev: CtfState) => CtfState) {
    setCtfState((prev) => {
      const next = updater(prev);
      const merged = { ...next, updatedAt: Date.now() };
      broadcast(merged);
      persist(merged);
      return merged;
    });
  }

  function updateCrack(updater: (prev: CrackState) => CrackState) {
    setCrackState((prev) => {
      const next = updater(prev);
      const merged = { ...next, updatedAt: Date.now() };
      broadcastCrack(merged);
      persistCrack(merged);
      return merged;
    });
  }

  function updateSiege(updater: (prev: SiegeState) => SiegeState) {
    setSiegeState((prev) => {
      const next = updater(prev);
      const merged = {
        ...next,
        updatedAt: Date.now(),
        timerUpdatedAt: Number.isFinite(next.timerUpdatedAt) ? next.timerUpdatedAt : prev.timerUpdatedAt,
      };
      broadcastSiege(merged);
      persistSiege(merged);
      return merged;
    });
  }

  function toggleStartPause() {
    updateCtf((prev) => ({
      ...prev,
      running: !prev.running,
      lastEvent: !prev.running ? "Start" : "Paused",
    }));
  }

  function resetTimerOnly() {
    updateCtf((prev) => ({
      ...prev,
      running: false,
      secondsLeft: prev.durationSeconds,
      lastEvent: "Reset",
    }));
  }

  function addMinute() {
    updateCtf((prev) => ({
      ...prev,
      secondsLeft: prev.secondsLeft + 60,
      durationSeconds: prev.durationSeconds + 60,
      lastEvent: "+1 min",
    }));
  }

  function triggerSafeZone() {
    updateCtf((prev) => ({
      ...prev,
      safeZoneEndsAt: Date.now() + Math.max(1, prev.safeZoneSeconds) * 1000,
      lastEvent: "No longer safe",
    }));
  }

  function team1RemoveFlag() {
    updateCtf((prev) => ({
      ...prev,
      team1Points: prev.team1Points + (prev.removedPoints || 0),
      team1Removed: prev.team1Removed + 1,
      lastEvent: `Team 1 +${prev.removedPoints || 0}`,
    }));
  }

  function team1StealFlag() {
    updateCtf((prev) => ({
      ...prev,
      team1Points: prev.team1Points + (prev.stolenPoints || 0),
      team1Stolen: prev.team1Stolen + 1,
      lastEvent: `Team 1 +${prev.stolenPoints || 0}`,
    }));
  }

  function team2RemoveFlag() {
    updateCtf((prev) => ({
      ...prev,
      team2Points: prev.team2Points + (prev.removedPoints || 0),
      team2Removed: prev.team2Removed + 1,
      lastEvent: `Team 2 +${prev.removedPoints || 0}`,
    }));
  }

  function team2StealFlag() {
    updateCtf((prev) => ({
      ...prev,
      team2Points: prev.team2Points + (prev.stolenPoints || 0),
      team2Stolen: prev.team2Stolen + 1,
      lastEvent: `Team 2 +${prev.stolenPoints || 0}`,
    }));
  }

  function triggerJailbreak() {
    if (!ctfState.jailbreakEnabled) return;
    updateCtf((prev) => ({
      ...prev,
      lastEvent: "Jailbreak",
    }));
  }

  function resetSides() {
    updateCtf((prev) => ({
      ...prev,
      team1Points: 0,
      team2Points: 0,
      team1Removed: 0,
      team1Stolen: 0,
      team2Removed: 0,
      team2Stolen: 0,
      lastEvent: "Reset sides",
    }));
  }

  function resetAll() {
    updateCtf(() => initialCtfState());
  }

  function crackToggleStart() {
    updateCrack((prev) => ({
      ...prev,
      running: !prev.running,
    }));
  }

  function crackResetTimer() {
    updateCrack((prev) => ({
      ...prev,
      running: false,
      secondsLeft: prev.durationSeconds,
    }));
  }

  function crackAddMinute() {
    updateCrack((prev) => ({
      ...prev,
      secondsLeft: prev.secondsLeft + 60,
      durationSeconds: prev.durationSeconds + 60,
    }));
  }

  function siegeStartGame() {
    updateSiege((prev) => {
      const duration = prev.durationSeconds > 0 ? prev.durationSeconds : 120;
      const base: SiegeState = {
        ...prev,
        started: true,
        completed: false,
        running: true,
        round: 1,
        insideTeam: "A",
        secondsLeft: duration,
        durationSeconds: duration,
        timerUpdatedAt: Date.now(),
        subround: 1,
        intermissionActive: false,
        intermissionEndsAt: null,
        roundEndActive: false,
        roundEndEndsAt: null,
        roundEndPending: false,
        roundEndReason: null,
        endGameActive: false,
        endGameEndsAt: null,
        teamAWins: 0,
        teamBWins: 0,
        roundResults: [],
      };
      return setupSiegeRound(base, "A");
    });
  }

  function siegeTogglePause() {
    updateSiege((prev) => ({ ...prev, running: !prev.running, timerUpdatedAt: Date.now() }));
  }

  function siegeEndGame() {
    updateSiege((prev) => ({
      ...prev,
      running: false,
      started: false,
      completed: false,
      round: 1,
      insideTeam: "A",
      secondsLeft: prev.durationSeconds > 0 ? prev.durationSeconds : 120,
      intermissionActive: false,
      intermissionEndsAt: null,
      roundEndActive: false,
      roundEndEndsAt: null,
      roundEndPending: false,
      roundEndReason: null,
      endGameActive: false,
      endGameEndsAt: null,
      teamAEliminated: 0,
      teamBEliminated: 0,
      teamALives: 0,
      teamBLives: 0,
      teamAWins: 0,
      teamBWins: 0,
      roundResults: [],
      timerUpdatedAt: Date.now(),
      subround: 1,
    }));
  }

  function siegeResetAll() {
    updateSiege((prev) => ({
      ...initialSiegeState(),
      teamAName: prev.teamAName,
      teamBName: prev.teamBName,
      teamAPlayers: prev.teamAPlayers,
      teamBPlayers: prev.teamBPlayers,
    }));
  }

  function siegePenaltyAdd() {
    updateSiege((prev) => {
      if (!prev.started || prev.completed || prev.intermissionActive || prev.roundEndActive || prev.endGameActive) return prev;
      const now = Date.now();
      return {
        ...prev,
        secondsLeft: prev.secondsLeft + 15,
        durationSeconds: prev.durationSeconds + 15,
        timerUpdatedAt: now,
        updatedAt: now,
      };
    });
  }

  function siegeInsideDown() {
    updateSiege((prev) => {
      if (!prev.started || prev.intermissionActive || prev.endGameActive || (prev.roundEndActive && !prev.roundEndPending)) return prev;
      const inside = prev.insideTeam;
      if (inside === "A") {
        if (prev.teamALives > 0) return { ...prev, teamALives: prev.teamALives - 1 };
        const nextElim = Math.min(prev.teamAPlayers, prev.teamAEliminated + 1);
        const next = { ...prev, teamAEliminated: nextElim };
        if (nextElim >= prev.teamAPlayers) return finalizeSiegeRound(next, "eliminated");
        return next;
      }
      if (prev.teamBLives > 0) return { ...prev, teamBLives: prev.teamBLives - 1 };
      const nextElim = Math.min(prev.teamBPlayers, prev.teamBEliminated + 1);
      const next = { ...prev, teamBEliminated: nextElim };
      if (nextElim >= prev.teamBPlayers) return finalizeSiegeRound(next, "eliminated");
      return next;
    });
  }

  function siegeInsideUp() {
    updateSiege((prev) => {
      if (!prev.started || prev.intermissionActive || prev.endGameActive || (prev.roundEndActive && !prev.roundEndPending)) return prev;
      const inside = prev.insideTeam;
      if (inside === "A") {
        if (prev.teamAEliminated > 0) return { ...prev, teamAEliminated: prev.teamAEliminated - 1 };
        return { ...prev, teamALives: prev.teamALives + 1 };
      }
      if (prev.teamBEliminated > 0) return { ...prev, teamBEliminated: prev.teamBEliminated - 1 };
      return { ...prev, teamBLives: prev.teamBLives + 1 };
    });
  }

  function toggleCrackEliminated(id: string) {
    updateCrack((prev) => {
      if (prev.winners?.length) return prev;
      const set = new Set(prev.eliminatedIds ?? []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...prev, eliminatedIds: Array.from(set) };
    });
  }

  async function awardCrackWinners() {
    if (crackState.winners?.length) return;
    const points = Number.isFinite(crackAwardPoints) ? crackAwardPoints : 0;
    if (!points) return;
    const eliminated = new Set(crackState.eliminatedIds ?? []);
    const winners = crackRoster.filter((row) => row.id && !eliminated.has(row.id));
    if (!winners.length) return;
    try {
      const results = await Promise.all(
        winners.map(async (row) => {
          const res = await fetch("/api/ledger/add", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              student_id: row.id,
              points,
              note: "Crack a Bat Winner",
              category: "crack_a_bat",
            }),
          });
          const data = await res.json().catch(() => ({}));
          return { ok: res.ok && data?.ok, data, row };
        })
      );
      const nextRoster = [...crackRoster];
      const winnersOut: WinnerCard[] = results.map((result) => {
        const updated = result.data?.student ?? null;
        if (updated?.id) {
          const idx = nextRoster.findIndex((r) => r.id === updated.id);
          if (idx >= 0) {
            nextRoster[idx] = {
              ...nextRoster[idx],
              points_total: updated.points_total ?? nextRoster[idx].points_total,
              level: updated.level ?? nextRoster[idx].level,
            };
          }
        }
        return {
          id: result.row.id,
          name: result.row.name,
          avatar_storage_path: result.row.avatar_storage_path ?? null,
          points_total: updated?.points_total ?? result.row.points_total ?? null,
          level: updated?.level ?? result.row.level ?? null,
          points_awarded: points,
        };
      });
      setCrackRoster(nextRoster);
      updateCrack((prev) => ({ ...prev, winners: winnersOut }));
    } catch {}
  }

  function displayTimer(key: TimerKey) {
    navChannelRef.current?.postMessage({ type: "display_timer", key });
    if (key === "ctf") {
      broadcast({ ...ctfState, updatedAt: Date.now() });
    }
    if (key === "crack_a_bat") {
      broadcastCrack({ ...crackState, updatedAt: Date.now() });
    }
    if (key === "siege_survive") {
      broadcastSiege({ ...siegeState, updatedAt: Date.now() });
    }
    try {
      const displayUrl = displayRouteForTimer(key);
      if (displayUrl) {
        fetch("/api/coach/display-state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tool_key: "timers",
            tool_payload: { coach_url: "/coach/timers", display_url: displayUrl },
          }),
        }).catch(() => {});
      }
    } catch {}
  }

  function selectTimer(key: TimerKey) {
    if (!window.confirm(`Use ${labelForTimer(key)}?`)) return;
    setActiveTimer(key);
    displayTimer(key);
  }

  const formattedTime = useMemo(() => {
    const m = Math.floor(ctfState.secondsLeft / 60);
    const s = ctfState.secondsLeft % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [ctfState.secondsLeft]);

  const crackTime = useMemo(() => {
    const m = Math.floor(crackState.secondsLeft / 60);
    const s = crackState.secondsLeft % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [crackState.secondsLeft]);
  const siegeTime = useMemo(() => {
    const m = Math.floor(siegeState.secondsLeft / 60);
    const s = siegeState.secondsLeft % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [siegeState.secondsLeft]);
  const siegeIntermissionRemaining = useMemo(() => {
    if (!siegeState.intermissionActive || !siegeState.intermissionEndsAt) return 0;
    return Math.max(0, Math.ceil((siegeState.intermissionEndsAt - now) / 1000));
  }, [siegeState.intermissionActive, siegeState.intermissionEndsAt, now]);
  const siegeRoundEndRemaining = useMemo(() => {
    if (!siegeState.roundEndActive || !siegeState.roundEndEndsAt) return 0;
    return Math.max(0, Math.ceil((siegeState.roundEndEndsAt - now) / 1000));
  }, [siegeState.roundEndActive, siegeState.roundEndEndsAt, now]);
  const siegeTimeUpActive = siegeTimeUpUntil > now;
  const crackSudden = crackState.secondsLeft > 0 && crackState.secondsLeft <= (crackState.suddenDeathAt || 60);
  const showCrackRoster = crackSudden || crackState.secondsLeft === 0 || crackState.winners.length > 0;
  const siegeInsideName = siegeState.insideTeam === "A" ? siegeState.teamAName : siegeState.teamBName;
  const siegeOutsideTeamName = siegeState.insideTeam === "A" ? siegeState.teamBName : siegeState.teamAName;
  const siegeInsideLives = siegeState.insideTeam === "A" ? siegeState.teamALives : siegeState.teamBLives;
  const siegeInsidePlayers = siegeState.insideTeam === "A" ? siegeState.teamAPlayers : siegeState.teamBPlayers;
  const siegeInsideEliminated = siegeState.insideTeam === "A" ? siegeState.teamAEliminated : siegeState.teamBEliminated;
  const siegeRoundResults = siegeState.roundResults ?? [];

  return (
    <AuthGate>
      <main
        style={page()}
        className="coach-timers"
        onClickCapture={(e) => {
          const target = e.target as HTMLElement | null;
          const btn = target?.closest?.("button");
          if (!btn || btn.hasAttribute("disabled")) return;
          playGlobalSfx("ui_button_press");
        }}
      >
        <style>{`
          .timer-card {
            position: relative;
            transform: skewX(-10deg);
            overflow: hidden;
          }
          .timer-card > * { transform: skewX(10deg); }
          .timer-card::before {
            content: "";
            position: absolute;
            inset: 0;
            border-radius: 16px;
            background:
              linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0) 35%),
              linear-gradient(180deg, rgba(59,130,246,0.2), rgba(2,6,23,0) 55%);
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -8px 20px rgba(0,0,0,0.35);
            pointer-events: none;
          }
          .timer-card::after {
            content: "";
            position: absolute;
            left: -10%;
            right: -10%;
            bottom: -40px;
            height: 120px;
            background:
              radial-gradient(circle, rgba(251,191,36,0.35) 0 2px, transparent 3px),
              radial-gradient(circle, rgba(59,130,246,0.35) 0 2px, transparent 3px),
              radial-gradient(circle, rgba(255,255,255,0.25) 0 1px, transparent 2px);
            background-size: 90px 90px, 120px 120px, 70px 70px;
            animation: sparkRise 6s linear infinite;
            opacity: 0.6;
            pointer-events: none;
          }
          .timer-card.inactive {
            opacity: 0.45;
            filter: grayscale(0.7);
          }
          @keyframes sparkRise {
            from { transform: translateY(0); }
            to { transform: translateY(-80px); }
          }
          .timer-icon {
            width: 64px;
            height: 64px;
            border-radius: 14px;
            display: grid;
            placeItems: center;
            border: 1px solid rgba(255,255,255,0.2);
            background: rgba(255,255,255,0.06);
            box-shadow: inset 0 1px 8px rgba(0,0,0,0.4);
          }
          .coach-timers button {
            position: relative;
            overflow: hidden;
            transition: transform 120ms ease, box-shadow 120ms ease, filter 120ms ease;
          }
          .coach-timers button::after {
            content: "";
            position: absolute;
            inset: -6px;
            background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.6), transparent 60%);
            opacity: 0;
            pointer-events: none;
          }
          .coach-timers button:active {
            transform: translateY(1px) scale(0.98);
            filter: brightness(1.05);
          }
          .coach-timers button:active::after {
            opacity: 0.7;
            animation: btnFlash 260ms ease-out;
          }
          .coach-timers button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            filter: grayscale(0.4);
          }
          @keyframes btnFlash {
            from { opacity: 0.7; }
            to { opacity: 0; }
          }
        `}</style>

        {!activeTimer ? (
          <div style={cardGrid()}>
            {TIMER_CARDS.map((card) => (
              <div
                key={card.key}
                style={timerCard(card.active)}
                className={`timer-card ${card.active ? "" : "inactive"}`}
              >
                <div style={cardTop()}>
                  <div className="timer-icon">{iconElement(timerArtwork[card.key], card.label)}</div>
                  <div style={cardText()}>
                    <div style={cardTitle()}>{card.label}</div>
                    <div style={cardDesc()}>{card.desc}</div>
                  </div>
                </div>
                <button
                  type="button"
                  style={cardBtn(card.active)}
                  onClick={() => selectTimer(card.key)}
                  disabled={!card.active}
                >
                  Use this timer
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {activeTimer === "ctf" ? (
          <section style={controlPanel("ctf")}>
            <div style={panelHeader()}>
              <button style={ghostBtn()} onClick={() => setActiveTimer(null)}>
                ← Back to timers
              </button>
              <div style={{ fontWeight: 1000 }}>CTF Controls</div>
              <div style={{ display: "grid", justifyItems: "end", gap: 6 }}>
                <button style={ghostBtn()} onClick={() => displayTimer("ctf")}>
                  Display this timer
                </button>
                <div style={{ opacity: 0.7, fontSize: 12 }}>Space: start/pause • R: reset • S: safe zone</div>
              </div>
            </div>
            <div style={timerRow()}>
              <div style={timerChip(ctfState.running)}>{formattedTime}</div>
              <div style={timerActions("ctf")}>
                <button style={primaryBtn()} onClick={toggleStartPause}>
                  {ctfState.running ? "Pause (Space)" : "Start (Space)"}
                </button>
                <button style={ghostBtn()} onClick={resetTimerOnly}>
                  Reset Timer (R)
                </button>
                <button style={ghostBtn()} onClick={addMinute}>
                  +1 Minute
                </button>
                <div style={inlineField()}>
                  <label style={fieldLabel()}>Safe Zone (sec)</label>
                  <input
                    value={ctfState.safeZoneSeconds}
                    onChange={(e) => {
                      const next = Math.max(1, Math.min(120, Number(e.target.value || 0)));
                      updateCtf((prev) => ({ ...prev, safeZoneSeconds: Number.isFinite(next) ? next : prev.safeZoneSeconds }));
                    }}
                    type="number"
                    min={1}
                    max={120}
                    step={1}
                    style={fieldInput()}
                  />
                </div>
                <button style={alertBtn()} onClick={triggerSafeZone}>
                  Safe Zone No Longer Safe (S)
                </button>
              </div>
            </div>

            <div style={ruleControlsBar()}>
              <div style={ruleControlsWrap()}>
                <div style={ruleControlsTitle()}>Rules</div>
                <div style={ruleControlsRow()}>
                  <div style={inlineField()}>
                    <label style={fieldLabel()}>Removed +</label>
                    <input
                      value={Number.isFinite(ctfState.removedPoints) && ctfState.removedPoints >= 0 ? ctfState.removedPoints : ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") {
                          updateCtf((prev) => ({ ...prev, removedPoints: 0 }));
                          return;
                        }
                        const next = Math.max(0, Math.min(99, Number(raw)));
                        updateCtf((prev) => ({ ...prev, removedPoints: Number.isFinite(next) ? next : prev.removedPoints }));
                      }}
                      type="number"
                      min={0}
                      max={99}
                      step={1}
                      style={fieldInput()}
                    />
                  </div>
                  <div style={inlineField()}>
                    <label style={fieldLabel()}>Stolen +</label>
                    <input
                      value={Number.isFinite(ctfState.stolenPoints) && ctfState.stolenPoints >= 0 ? ctfState.stolenPoints : ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") {
                          updateCtf((prev) => ({ ...prev, stolenPoints: 0 }));
                          return;
                        }
                        const next = Math.max(0, Math.min(99, Number(raw)));
                        updateCtf((prev) => ({ ...prev, stolenPoints: Number.isFinite(next) ? next : prev.stolenPoints }));
                      }}
                      type="number"
                      min={0}
                      max={99}
                      step={1}
                      style={fieldInput()}
                    />
                  </div>
                  <button
                    type="button"
                    style={chipToggle(ctfState.jailbreakEnabled)}
                    onClick={() =>
                      updateCtf((prev) => ({ ...prev, jailbreakEnabled: !prev.jailbreakEnabled }))
                    }
                  >
                    Jailbreak {ctfState.jailbreakEnabled ? "ON" : "OFF"}
                  </button>
                </div>
              </div>
            </div>

            <div style={scoreGrid("ctf")}>
              <div style={teamCard("left")}>
                <div style={teamLabel("left")}>Team 1</div>
                <div style={scoreValue()}>{ctfState.team1Points}</div>
                <div style={statRow()}>
                  <div>Flags Removed: {ctfState.team1Removed}</div>
                  <div>Flags Stolen: {ctfState.team1Stolen}</div>
                </div>
                <div style={btnRow()}>
                  <button style={ghostBtn()} onClick={team1RemoveFlag}>
                    +1 Point (Z)
                  </button>
                  <button style={ghostBtn()} onClick={team1StealFlag}>
                    +5 Points (X)
                  </button>
                </div>
              </div>
              <div style={teamCard("right")}>
                <div style={teamLabel("right")}>Team 2</div>
                <div style={scoreValue()}>{ctfState.team2Points}</div>
                <div style={statRow()}>
                  <div>Flags Removed: {ctfState.team2Removed}</div>
                  <div>Flags Stolen: {ctfState.team2Stolen}</div>
                </div>
                <div style={btnRow()}>
                  <button style={ghostBtn()} onClick={team2RemoveFlag}>
                    +1 Point (,)
                  </button>
                  <button style={ghostBtn()} onClick={team2StealFlag}>
                    +5 Points (.)
                  </button>
                </div>
              </div>
            </div>

            <div style={utilityRow()}>
              <button style={ghostBtn()} onClick={triggerJailbreak}>
                Jailbreak (J)
              </button>
              <button style={ghostBtn()} onClick={resetSides}>
                Reset Sides
              </button>
              <button style={dangerBtn()} onClick={resetAll}>
                Reset All
              </button>
            </div>
            {ctfState.lastEvent ? <div style={eventBadge()}>{ctfState.lastEvent}</div> : null}
          </section>
        ) : null}

        {activeTimer === "crack_a_bat" ? (
          <section style={controlPanel("crack")}>
            <div style={panelHeader()}>
              <button style={ghostBtn()} onClick={() => setActiveTimer(null)}>
                ← Back to timers
              </button>
              <div style={{ fontWeight: 1000 }}>Crack a Bat Controls</div>
              <div style={{ display: "grid", justifyItems: "end", gap: 6 }}>
                <button style={ghostBtn()} onClick={() => displayTimer("crack_a_bat")}>
                  Display this timer
                </button>
                <div style={{ opacity: 0.7, fontSize: 12 }}>Space: start/pause • R: reset</div>
              </div>
            </div>
            <div style={timerRow()}>
              <div style={timerChip(crackState.running)}>{crackTime}</div>
              <div style={timerActions("crack")}>
                <button style={primaryBtn()} onClick={crackToggleStart}>
                  {crackState.running ? "Pause (Space)" : "Start (Space)"}
                </button>
                <button style={ghostBtn()} onClick={crackResetTimer}>
                  Reset Timer (R)
                </button>
                <button style={ghostBtn()} onClick={crackAddMinute}>
                  +1 Minute
                </button>
                <div style={inlineField()}>
                  <label style={fieldLabel()}>Time Limit (min)</label>
                  <input
                    value={crackState.durationSeconds ? Math.round(crackState.durationSeconds / 60) : ""}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") {
                        updateCrack((prev) => ({ ...prev, durationSeconds: 0, secondsLeft: 0 }));
                        return;
                      }
                      const next = Math.max(1, Math.min(30, Number(raw)));
                      updateCrack((prev) => ({
                        ...prev,
                        durationSeconds: next * 60,
                        secondsLeft: Math.min(prev.secondsLeft || next * 60, next * 60),
                      }));
                    }}
                    type="number"
                    min={0}
                    max={30}
                    step={1}
                    style={fieldInput()}
                  />
                </div>
                <div style={inlineField()}>
                  <label style={fieldLabel()}>Sudden Death</label>
                  <select
                    value={crackState.suddenDeathAt}
                    onChange={(e) => {
                      const next = Number(e.target.value || 60);
                      updateCrack((prev) => ({ ...prev, suddenDeathAt: next === 30 ? 30 : 60 }));
                    }}
                    style={fieldSelect()}
                  >
                    <option value={60}>1 minute</option>
                    <option value={30}>30 seconds</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={crackRulesBar()}>
              <div style={crackRulesWrap()}>
                <div style={crackRulesTitle()}>Rules</div>
                <div style={crackRulesRow()}>
                  <div style={inlineField()}>
                    <label style={fieldLabel()}>Steps</label>
                    <input
                      value={Number.isFinite(crackState.steps) && crackState.steps > 0 ? crackState.steps : ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") {
                          updateCrack((prev) => ({ ...prev, steps: 0 }));
                          return;
                        }
                        const next = Math.max(1, Math.min(20, Number(raw)));
                        updateCrack((prev) => ({ ...prev, steps: Number.isFinite(next) ? next : prev.steps }));
                      }}
                      type="number"
                      min={0}
                      max={20}
                      step={1}
                      style={fieldInput()}
                    />
                  </div>
                  <div style={inlineField()}>
                    <label style={fieldLabel()}>Seconds</label>
                    <input
                      value={Number.isFinite(crackState.ruleSeconds) && crackState.ruleSeconds > 0 ? crackState.ruleSeconds : ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") {
                          updateCrack((prev) => ({ ...prev, ruleSeconds: 0 }));
                          return;
                        }
                        const next = Math.max(1, Math.min(120, Number(raw)));
                        updateCrack((prev) => ({ ...prev, ruleSeconds: Number.isFinite(next) ? next : prev.ruleSeconds }));
                      }}
                      type="number"
                      min={0}
                      max={120}
                      step={1}
                      style={fieldInput()}
                    />
                  </div>
                  <div style={inlineField()}>
                    <label style={fieldLabel()}>Rule #</label>
                    <input
                      value={Number.isFinite(crackState.ruleCount) && crackState.ruleCount > 0 ? crackState.ruleCount : ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") {
                          updateCrack((prev) => ({ ...prev, ruleCount: 0 }));
                          return;
                        }
                        const next = Math.max(1, Math.min(99, Number(raw)));
                        updateCrack((prev) => ({ ...prev, ruleCount: Number.isFinite(next) ? next : prev.ruleCount }));
                      }}
                      type="number"
                      min={0}
                      max={99}
                      step={1}
                      style={fieldInput()}
                    />
                  </div>
                  <div style={inlineField()}>
                    <label style={fieldLabel()}>Rule Label</label>
                    <input
                      value={crackState.ruleNote}
                      onChange={(e) => updateCrack((prev) => ({ ...prev, ruleNote: e.target.value }))}
                      placeholder="Burpees"
                      style={fieldInputWide()}
                    />
                  </div>
                </div>
              </div>
            </div>
            {showCrackRoster ? (
              <div style={crackRosterWrap()}>
                <div style={crackRosterHeader()}>
                  <div style={{ fontWeight: 1000 }}>Sudden Death Roster</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <label style={fieldLabel()}>Points per winner</label>
                    <input
                      value={Number.isFinite(crackAwardPoints) && crackAwardPoints > 0 ? crackAwardPoints : ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") {
                          setCrackAwardPoints(0);
                          return;
                        }
                        const next = Math.max(1, Math.min(999, Number(raw)));
                        setCrackAwardPoints(Number.isFinite(next) ? next : crackAwardPoints);
                      }}
                      type="number"
                      min={0}
                      max={999}
                      step={1}
                      style={fieldInput()}
                    />
                    <button
                      style={primaryBtn()}
                      onClick={awardCrackWinners}
                      disabled={crackState.secondsLeft > 0 || !!crackState.winners?.length}
                    >
                      Award Points
                    </button>
                  </div>
                </div>
                {crackRosterLoading ? <div style={hintText()}>Loading roster…</div> : null}
                {crackRosterMsg ? <div style={hintError()}>{crackRosterMsg}</div> : null}
                <div style={crackRosterGrid()}>
                  {crackRoster.map((row) => {
                    const eliminated = crackState.eliminatedIds.includes(row.id);
                    return (
                      <button
                        key={row.id}
                        type="button"
                        style={crackRosterCard(eliminated, !!crackState.winners?.length)}
                        onClick={() => toggleCrackEliminated(row.id)}
                        disabled={!!crackState.winners?.length}
                      >
                        <div style={crackAvatarWrap(row.avatar_bg ?? undefined)}>
                          {row.avatar_storage_path ? (
                            <img src={resolveAvatarUrl(row.avatar_storage_path)} alt={row.name} style={crackAvatarImg()} />
                          ) : (
                            <span style={{ fontSize: 10, opacity: 0.7 }}>No avatar</span>
                          )}
                        </div>
                        <div style={crackRosterName()}>{row.name}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {activeTimer === "siege_survive" ? (
          <section style={controlPanel("siege", siegeTimeUpActive)}>
            <div style={panelHeader()}>
              <button style={ghostBtn()} onClick={() => setActiveTimer(null)}>
                ← Back to timers
              </button>
              <div style={{ fontWeight: 1000 }}>Siege &amp; Survive Controls</div>
              <div style={{ display: "grid", justifyItems: "end", gap: 6 }}>
                <button style={ghostBtn()} onClick={() => displayTimer("siege_survive")}>
                  Display this timer
                </button>
                <div style={{ opacity: 0.7, fontSize: 12 }}>
                  Round {siegeState.round}/{siegeState.roundsTotal} • Inside: {siegeInsideName || "Inside"}
                </div>
              </div>
            </div>

            <div style={timerRow()}>
              <div style={siegeTimerChip(siegeState.running)}>{siegeTime}</div>
              <div style={timerActions("siege")}>
                {!siegeState.started ? (
                  <button style={primaryBtn()} onClick={siegeStartGame}>
                    Start Game
                  </button>
                ) : (
                  <button style={primaryBtn()} onClick={siegeTogglePause}>
                    {siegeState.running ? "Pause" : "Resume"}
                  </button>
                )}
                <button
                  style={ghostBtn()}
                  onClick={siegePenaltyAdd}
                  disabled={
                    !siegeState.started ||
                    siegeState.completed ||
                    siegeState.intermissionActive ||
                    siegeState.roundEndActive ||
                    siegeState.endGameActive
                  }
                >
                  Penalty +15s (P)
                </button>
                <button style={dangerBtn()} onClick={siegeEndGame} disabled={!siegeState.started && !siegeState.completed}>
                  End Game
                </button>
                <button style={ghostBtn()} onClick={siegeResetAll}>
                  Reset Game
                </button>
                <div style={inlineField()}>
                  <label style={fieldLabel()}>Round length</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      value={siegeState.durationSeconds ? Math.floor(siegeState.durationSeconds / 60) : ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") {
                          updateSiege((prev) => ({ ...prev, durationSeconds: 0, secondsLeft: 0 }));
                          return;
                        }
                        const nextMin = Math.max(0, Math.min(10, Number(raw)));
                        updateSiege((prev) => {
                          const secs = Number.isFinite(nextMin) ? Math.floor(nextMin) * 60 + (prev.durationSeconds % 60) : prev.durationSeconds;
                          return { ...prev, durationSeconds: secs, secondsLeft: prev.started ? prev.secondsLeft : secs };
                        });
                      }}
                      type="number"
                      min={0}
                      max={10}
                      step={1}
                      style={fieldInput()}
                      disabled={siegeState.started}
                    />
                    <span style={{ fontSize: 11, opacity: 0.7 }}>min</span>
                    <input
                      value={siegeState.durationSeconds ? siegeState.durationSeconds % 60 : ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") {
                          updateSiege((prev) => ({ ...prev, durationSeconds: 0, secondsLeft: 0 }));
                          return;
                        }
                        const nextSec = Math.max(0, Math.min(59, Number(raw)));
                        updateSiege((prev) => {
                          const mins = Math.floor(prev.durationSeconds / 60);
                          const secs = mins * 60 + (Number.isFinite(nextSec) ? Math.floor(nextSec) : 0);
                          return { ...prev, durationSeconds: secs, secondsLeft: prev.started ? prev.secondsLeft : secs };
                        });
                      }}
                      type="number"
                      min={0}
                      max={59}
                      step={1}
                      style={fieldInput()}
                      disabled={siegeState.started}
                    />
                    <span style={{ fontSize: 11, opacity: 0.7 }}>sec</span>
                  </div>
                </div>
                <div style={inlineField()}>
                  <label style={fieldLabel()}>Rounds (1-3)</label>
                  <input
                    value={siegeState.roundsTotal}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") return;
                      const next = Math.max(1, Math.min(3, Number(raw)));
                      updateSiege((prev) => ({ ...prev, roundsTotal: Number.isFinite(next) ? next : prev.roundsTotal }));
                    }}
                    type="number"
                    min={1}
                    max={3}
                    step={1}
                    style={fieldInput()}
                    disabled={siegeState.started}
                  />
                </div>
              </div>
            </div>
            <div style={siegeStatusMsg(siegeState.completed)}>
              {siegeState.completed
                ? `Game ended • ${siegeState.teamAName || "Team A"} ${siegeState.teamAWins} - ${
                    siegeState.teamBName || "Team B"
                  } ${siegeState.teamBWins}`
                : siegeState.started
                ? "Game live"
                : "Game not started"}
            </div>
            {(siegeState.intermissionActive || siegeState.roundEndActive || siegeTimeUpActive) ? (
              <div style={siegeCountdownRow()}>
                {siegeState.roundEndActive ? (
                  <div style={siegeCountdownBadge("round")}>Round end: {siegeRoundEndRemaining}s</div>
                ) : null}
                {siegeState.intermissionActive ? (
                  <div style={siegeCountdownBadge("intermission")}>Next round in: {siegeIntermissionRemaining}s</div>
                ) : null}
                {siegeTimeUpActive ? <div style={siegeTimeUpBadge()}>Time is up</div> : null}
              </div>
            ) : null}

            <div style={siegeSettingsGrid()}>
              <div style={siegePanel()}>
                <div style={siegePanelTitle()}>Teams</div>
                <div style={siegeTeamRow()}>
                  <div style={inlineField()}>
                    <label style={fieldLabel()}>Team A Name</label>
                    <input
                      value={siegeState.teamAName}
                      onChange={(e) => updateSiege((prev) => ({ ...prev, teamAName: e.target.value }))}
                      style={fieldInputWide()}
                      disabled={siegeState.started}
                    />
                  </div>
                  <div style={inlineField()}>
                    <label style={fieldLabel()}>Team A Players</label>
                    <input
                      value={siegeState.teamAPlayers}
                      onChange={(e) => {
                        const next = Math.max(1, Math.min(30, Number(e.target.value || 1)));
                        updateSiege((prev) => ({
                          ...prev,
                          teamAPlayers: Number.isFinite(next) ? next : prev.teamAPlayers,
                          teamAEliminated: Math.min(prev.teamAEliminated, next),
                        }));
                      }}
                      type="number"
                      min={1}
                      max={30}
                      step={1}
                      style={fieldInput()}
                      disabled={siegeState.started}
                    />
                  </div>
                </div>
                <div style={siegeTeamRow()}>
                  <div style={inlineField()}>
                    <label style={fieldLabel()}>Team B Name</label>
                    <input
                      value={siegeState.teamBName}
                      onChange={(e) => updateSiege((prev) => ({ ...prev, teamBName: e.target.value }))}
                      style={fieldInputWide()}
                      disabled={siegeState.started}
                    />
                  </div>
                  <div style={inlineField()}>
                    <label style={fieldLabel()}>Team B Players</label>
                    <input
                      value={siegeState.teamBPlayers}
                      onChange={(e) => {
                        const next = Math.max(1, Math.min(30, Number(e.target.value || 1)));
                        updateSiege((prev) => ({
                          ...prev,
                          teamBPlayers: Number.isFinite(next) ? next : prev.teamBPlayers,
                          teamBEliminated: Math.min(prev.teamBEliminated, next),
                        }));
                      }}
                      type="number"
                      min={1}
                      max={30}
                      step={1}
                      style={fieldInput()}
                      disabled={siegeState.started}
                    />
                  </div>
                </div>
                <div style={hintText()}>Tip: set team names to player names for Inside/Outside swaps.</div>
              </div>

              <div style={siegePanel()}>
                <div style={siegePanelTitle()}>Inside / Outside</div>
                <div style={siegeDiagram()}>
                  <div style={siegeOutsideLabel()}>Outside</div>
                  <div style={siegeBox()}>
                    <div style={siegeInsideLabel()}>Inside</div>
                    <div style={siegeBoxName()}>{siegeInsideName || "Inside"}</div>
                  </div>
                  <div style={siegeOutsideName()}>{siegeOutsideTeamName || "Outside"}</div>
                </div>
                <div style={siegeRosterPreview()}>
                  <div style={siegeRosterCard()}>
                    <div style={siegeRosterTitle()}>{siegeState.teamAName || "Team A"}</div>
                    <div style={siegeRosterLives()}>
                      Lives: {siegeState.teamALives}
                    </div>
                    <div style={siegeRosterGrid()}>
                      {renderSiegeMiniPlayers(siegeState.teamAPlayers, siegeState.teamAEliminated)}
                    </div>
                  </div>
                  <div style={siegeRosterCard()}>
                    <div style={siegeRosterTitle()}>{siegeState.teamBName || "Team B"}</div>
                    <div style={siegeRosterLives()}>
                      Lives: {siegeState.teamBLives}
                    </div>
                    <div style={siegeRosterGrid()}>
                      {renderSiegeMiniPlayers(siegeState.teamBPlayers, siegeState.teamBEliminated)}
                    </div>
                  </div>
                </div>
                <div style={siegeInsideStats()}>
                  <div>Inside lives: {siegeInsideLives}</div>
                  <div>
                    Inside eliminated: {siegeInsideEliminated}/{siegeInsidePlayers}
                  </div>
                </div>
                <div style={siegeHotkeyRow()}>
                  <button style={siegeHotkeyBtn()} onClick={siegeInsideDown} disabled={!siegeState.started}>
                    , Eliminate player / use a life
                  </button>
                  <button style={siegeHotkeyBtn()} onClick={siegeInsideUp} disabled={!siegeState.started}>
                    . Player returns / gain a life
                  </button>
                </div>
                {siegeState.completed ? <div style={eventBadge()}>Game complete</div> : null}
              </div>
            </div>

            <div style={siegeScoreGrid()}>
              <div style={siegeScoreCard(siegeState.insideTeam === "A")}>
                <div style={siegeScoreTitle()}>{siegeState.teamAName || "Team A"}</div>
                <div style={siegeScoreValue()}>{siegeState.teamAWins}</div>
                <div style={siegeScoreMeta()}>Round wins</div>
              </div>
              <div style={siegeScoreCard(siegeState.insideTeam === "B")}>
                <div style={siegeScoreTitle()}>{siegeState.teamBName || "Team B"}</div>
                <div style={siegeScoreValue()}>{siegeState.teamBWins}</div>
                <div style={siegeScoreMeta()}>Round wins</div>
              </div>
              <div style={siegeRoundLog()}>
                <div style={siegeScoreTitle()}>Round Log</div>
                {renderSiegeRoundCards(siegeRoundResults, siegeState.teamAName || "Team A", siegeState.teamBName || "Team B")}
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </AuthGate>
  );
}

function labelForTimer(key: TimerKey) {
  const match = TIMER_CARDS.find((c) => c.key === key);
  return match?.label ?? "Timer";
}

function displayRouteForTimer(key: TimerKey) {
  if (key === "ctf") return "/display/ctf?embed=1";
  if (key === "crack_a_bat") return "/display/crack-a-bat?embed=1";
  if (key === "siege_survive") return "/display/siege-survive?embed=1";
  return "";
}

function page(): React.CSSProperties {
  return {
    minHeight: "100vh",
    padding: 24,
    color: "white",
    background:
      "radial-gradient(circle at top, rgba(59,130,246,0.18), rgba(2,6,23,0.95))",
    display: "grid",
    gap: 20,
  };
}

function cardGrid(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 };
}

function timerCard(active?: boolean): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: active ? "rgba(15,23,42,0.8)" : "rgba(2,6,23,0.6)",
    display: "grid",
    gap: 10,
    boxShadow: active ? "0 12px 24px rgba(0,0,0,0.35)" : "none",
  };
}

function cardBtn(active?: boolean): React.CSSProperties {
  return {
    borderRadius: 999,
    padding: "8px 14px",
    border: "1px solid rgba(255,255,255,0.22)",
    background: active
      ? "linear-gradient(120deg, rgba(56,189,248,0.18), rgba(255,255,255,0.1))"
      : "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    boxShadow: active ? "0 8px 16px rgba(0,0,0,0.3)" : "none",
    cursor: active ? "pointer" : "not-allowed",
  };
}

function cardTop(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "70px 1fr", gap: 10, alignItems: "center" };
}

function cardText(): React.CSSProperties {
  return { display: "grid", gap: 4 };
}

function cardTitle(): React.CSSProperties {
  return { fontWeight: 1000, fontSize: 16 };
}

function cardDesc(): React.CSSProperties {
  return { opacity: 0.7, fontSize: 12 };
}

function iconElement(imageUrl: string, label: string) {
  const resolved = resolveTimerArtUrl(imageUrl);
  if (resolved) {
    return <img src={resolved} alt={`${label} artwork`} style={timerArtImage()} />;
  }
  return <div style={placeholderIcon()}>Artwork</div>;
}

function placeholderIcon(): React.CSSProperties {
  return {
    width: 46,
    height: 46,
    borderRadius: 12,
    border: "1px dashed rgba(255,255,255,0.35)",
    display: "grid",
    placeItems: "center",
    fontSize: 11,
    opacity: 0.7,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  };
}

function timerArtImage(): React.CSSProperties {
  return {
    width: 56,
    height: 56,
    objectFit: "cover",
    borderRadius: 12,
  };
}

function resolveTimerArtUrl(value: string) {
  const clean = String(value ?? "").trim();
  if (!clean) return "";
  if (/^https?:\/\//i.test(clean)) return clean;
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) return clean;
  const normalized = clean.replace(/^\/+/, "");
  if (normalized.startsWith("storage/v1/object/public/")) {
    return `${baseUrl}/${normalized}`;
  }
  return `${baseUrl}/storage/v1/object/public/${normalized}`;
}

function controlPanel(kind: "ctf" | "crack" | "siege", flash = false): React.CSSProperties {
  const isCrack = kind === "crack";
  return {
    borderRadius: 18,
    padding: isCrack ? 24 : 22,
    border: flash ? "2px solid rgba(248,113,113,0.9)" : "1px solid rgba(255,255,255,0.14)",
    background: "rgba(15,23,42,0.75)",
    boxShadow: flash ? "0 0 18px rgba(248,113,113,0.45)" : "none",
    display: "grid",
    gap: 16,
    maxWidth: isCrack ? 980 : 1040,
    justifySelf: "center",
    width: "100%",
  };
}

function panelHeader(): React.CSSProperties {
  return { display: "flex", justifyContent: "space-between", alignItems: "center" };
}

function timerRow(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "auto 1fr", gap: 16, alignItems: "center" };
}

function timerChip(running: boolean): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: "18px 24px",
    fontSize: 32,
    fontWeight: 1000,
    border: running ? "1px solid rgba(34,197,94,0.6)" : "1px solid rgba(255,255,255,0.2)",
    background: running ? "rgba(34,197,94,0.2)" : "rgba(2,6,23,0.7)",
    minWidth: 150,
    textAlign: "center",
  };
}

function siegeTimerChip(running: boolean): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: "22px 28px",
    fontSize: 40,
    fontWeight: 1000,
    border: running ? "1px solid rgba(34,197,94,0.6)" : "1px solid rgba(255,255,255,0.2)",
    background: running ? "rgba(34,197,94,0.2)" : "rgba(2,6,23,0.7)",
    width: 220,
    textAlign: "center",
  };
}

function timerActions(kind: "ctf" | "crack" | "siege"): React.CSSProperties {
  return { display: "flex", flexWrap: "wrap", gap: kind === "crack" ? 12 : 10 };
}

function inlineField(): React.CSSProperties {
  return {
    display: "grid",
    gap: 4,
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(2,6,23,0.6)",
  };
}

function fieldLabel(): React.CSSProperties {
  return { fontSize: 11, opacity: 0.7, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.6 };
}

function fieldInput(): React.CSSProperties {
  return {
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(15,23,42,0.6)",
    color: "white",
    fontWeight: 900,
    fontSize: 13,
    padding: "6px 10px",
    width: 110,
  };
}

function fieldInputWide(): React.CSSProperties {
  return {
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(15,23,42,0.6)",
    color: "white",
    fontWeight: 900,
    fontSize: 13,
    padding: "8px 10px",
    width: 260,
  };
}

function fieldSelect(): React.CSSProperties {
  return {
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(15,23,42,0.6)",
    color: "white",
    fontWeight: 900,
    fontSize: 13,
    padding: "8px 10px",
  };
}

function scoreGrid(kind: "ctf" | "crack"): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: kind === "crack" ? 16 : 14,
    maxWidth: kind === "crack" ? 980 : 1040,
    justifySelf: "center",
    width: "100%",
  };
}

function crackRulesBar(): React.CSSProperties {
  return {
    width: "100%",
    maxWidth: 980,
    justifySelf: "center",
  };
}

function crackRulesWrap(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: "16px 18px",
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(2,6,23,0.65)",
    display: "grid",
    gap: 12,
  };
}

function crackRulesTitle(): React.CSSProperties {
  return { fontWeight: 1000, fontSize: 14, letterSpacing: 0.6, textTransform: "uppercase", opacity: 0.85 };
}

function crackRulesRow(): React.CSSProperties {
  return { display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" };
}

function siegeSettingsGrid(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 16 };
}

function siegePanel(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: "16px 18px",
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(2,6,23,0.6)",
    display: "grid",
    gap: 12,
  };
}

function siegePanelTitle(): React.CSSProperties {
  return { fontWeight: 1000, fontSize: 13, letterSpacing: 0.6, textTransform: "uppercase", opacity: 0.85 };
}

function siegeTeamRow(): React.CSSProperties {
  return { display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" };
}

function siegeDiagram(): React.CSSProperties {
  return { display: "grid", justifyItems: "center", gap: 8, textAlign: "center" };
}

function siegeOutsideLabel(): React.CSSProperties {
  return { fontSize: 11, opacity: 0.7, letterSpacing: 0.4, textTransform: "uppercase" };
}

function siegeBox(): React.CSSProperties {
  return {
    width: 180,
    height: 120,
    borderRadius: 16,
    border: "2px solid rgba(56,189,248,0.6)",
    background: "rgba(56,189,248,0.08)",
    display: "grid",
    placeItems: "center",
    position: "relative",
  };
}

function siegeInsideLabel(): React.CSSProperties {
  return {
    position: "absolute",
    top: 10,
    fontSize: 11,
    opacity: 0.7,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  };
}

function siegeBoxName(): React.CSSProperties {
  return { fontWeight: 1000, fontSize: 18 };
}

function siegeOutsideName(): React.CSSProperties {
  return { fontWeight: 900, fontSize: 14, opacity: 0.9 };
}

function siegeInsideStats(): React.CSSProperties {
  return {
    display: "grid",
    gap: 6,
    fontSize: 14,
    fontWeight: 900,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(34,197,94,0.35)",
    background: "rgba(34,197,94,0.12)",
  };
}

function siegeHotkeyRow(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };
}

function siegeHotkeyBtn(): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: "12px 16px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(2,6,23,0.7)",
    color: "white",
    fontWeight: 900,
    fontSize: 13,
    textAlign: "center",
  };
}

function siegeScoreGrid(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, alignItems: "start" };
}

function siegeScoreCard(active: boolean): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: "14px 16px",
    border: active ? "1px solid rgba(34,197,94,0.5)" : "1px solid rgba(255,255,255,0.12)",
    background: active ? "rgba(34,197,94,0.12)" : "rgba(2,6,23,0.6)",
    display: "grid",
    gap: 6,
  };
}

function siegeScoreTitle(): React.CSSProperties {
  return { fontWeight: 1000, fontSize: 13, textTransform: "uppercase", letterSpacing: 0.6, opacity: 0.8 };
}

function siegeScoreValue(): React.CSSProperties {
  return { fontWeight: 1000, fontSize: 28 };
}

function siegeScoreMeta(): React.CSSProperties {
  return { fontSize: 12, opacity: 0.8 };
}

function siegeRoundLog(): React.CSSProperties {
  return {
    gridColumn: "1 / -1",
    borderRadius: 16,
    padding: "14px 16px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(2,6,23,0.6)",
    display: "grid",
    gap: 10,
    maxWidth: 980,
    justifySelf: "start",
  };
}

function siegeRoundRow(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: "16px 16px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.6)",
    display: "grid",
    gap: 10,
  };
}

function siegeRoundLabel(): React.CSSProperties {
  return { fontWeight: 1000, fontSize: 16 };
}

function siegeRoundMeta(): React.CSSProperties {
  return { fontSize: 13, opacity: 0.85 };
}

function siegeRoundWinner(winner: "A" | "B"): React.CSSProperties {
  const color = winner === "A" ? "rgba(34,197,94,0.65)" : "rgba(59,130,246,0.65)";
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

function renderSiegeRoundCards(results: SiegeState["roundResults"], teamAName: string, teamBName: string) {
  const totalRounds = Math.max(3, Math.max(...results.map((r) => r.round), 0));
  const rows = Array.from({ length: totalRounds }).map((_, idx) => {
    const round = idx + 1;
    const result = results.find((r) => r.round === round) || null;
    const winner = result?.winner ?? null;
    const a = result?.teamA;
    const b = result?.teamB;
    return (
      <div key={round} style={siegeRoundRow()}>
        <div style={siegeRoundLabel()}>Round {round}</div>
        <div style={siegeRoundTeamRow()}>
          <div style={siegeRoundTeamBadge(winner === "A")}>{teamAName}</div>
          <div style={siegeRoundTeamBadge(winner === "B")}>{teamBName}</div>
        </div>
        <div style={siegeRoundInfoRow()}>
          <div>Time: {a ? `${Math.floor(a.timeSurvived / 60)}:${String(a.timeSurvived % 60).padStart(2, "0")}` : "—"}</div>
          <div>Players: {a ? a.survivors : "—"}</div>
          <div>Lives: {a ? a.lives : "—"}</div>
        </div>
        <div style={siegeRoundInfoRow()}>
          <div>Time: {b ? `${Math.floor(b.timeSurvived / 60)}:${String(b.timeSurvived % 60).padStart(2, "0")}` : "—"}</div>
          <div>Players: {b ? b.survivors : "—"}</div>
          <div>Lives: {b ? b.lives : "—"}</div>
        </div>
        {result?.winner === null && result?.decidedAt ? (
          <div style={siegeRoundMeta()}>Tie • extra round added</div>
        ) : null}
      </div>
    );
  });
  return <div style={{ display: "grid", gap: 10 }}>{rows}</div>;
}

function siegeRoundTeamRow(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 };
}

function siegeRoundTeamBadge(winner: boolean): React.CSSProperties {
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

function siegeRoundInfoRow(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, fontSize: 13, opacity: 0.9 };
}

function siegeRosterPreview(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
}

function siegeRosterCard(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: "10px 10px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.6)",
    display: "grid",
    gap: 8,
  };
}

function siegeRosterTitle(): React.CSSProperties {
  return { fontSize: 11, fontWeight: 900, opacity: 0.8, textTransform: "uppercase", letterSpacing: 0.4 };
}

function siegeRosterLives(): React.CSSProperties {
  return { fontSize: 16, fontWeight: 1000 };
}

function siegeStatusMsg(ended: boolean): React.CSSProperties {
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

function siegeCountdownRow(): React.CSSProperties {
  return { display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" };
}

function siegeCountdownBadge(kind: "round" | "intermission"): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.2)",
    background: kind === "round" ? "rgba(248,113,113,0.16)" : "rgba(59,130,246,0.18)",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 0.6,
  };
}

function siegeTimeUpBadge(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(248,113,113,0.9)",
    background: "rgba(248,113,113,0.2)",
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 1,
    color: "rgba(254,226,226,1)",
  };
}

function siegeRosterGrid(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(16px, 1fr))", gap: 6 };
}

function siegeMiniPlayer(alive: boolean): React.CSSProperties {
  return {
    width: 16,
    height: 22,
    borderRadius: "8px 8px 6px 6px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: alive ? "rgba(34,197,94,0.6)" : "rgba(148,163,184,0.35)",
  };
}

function renderSiegeMiniPlayers(total: number, eliminated: number) {
  const safeTotal = Math.max(0, Number(total || 0));
  const safeElim = Math.min(safeTotal, Math.max(0, Number(eliminated || 0)));
  const aliveCount = safeTotal - safeElim;
  return Array.from({ length: safeTotal }).map((_, idx) => {
    const alive = idx < aliveCount;
    return <div key={idx} style={siegeMiniPlayer(alive)} />;
  });
}

function ruleControlsBar(): React.CSSProperties {
  return {
    width: "100%",
    maxWidth: 1040,
    justifySelf: "center",
  };
}

function ruleControlsWrap(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: "16px 18px",
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(2,6,23,0.65)",
    display: "grid",
    gap: 12,
  };
}

function ruleControlsTitle(): React.CSSProperties {
  return { fontWeight: 1000, fontSize: 14, letterSpacing: 0.6, textTransform: "uppercase", opacity: 0.85 };
}

function ruleControlsRow(): React.CSSProperties {
  return { display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" };
}

function chipToggle(active: boolean): React.CSSProperties {
  return {
    borderRadius: 999,
    padding: "8px 12px",
    border: active ? "1px solid rgba(251,191,36,0.8)" : "1px solid rgba(255,255,255,0.2)",
    background: active ? "rgba(251,191,36,0.2)" : "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 900,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  };
}

function crackRosterWrap(): React.CSSProperties {
  return {
    width: "100%",
    maxWidth: 1040,
    justifySelf: "center",
    borderRadius: 18,
    padding: "16px 18px",
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(2,6,23,0.65)",
    display: "grid",
    gap: 12,
  };
}

function crackRosterHeader(): React.CSSProperties {
  return { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" };
}

function crackRosterGrid(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 };
}

function crackRosterCard(eliminated: boolean, disabled: boolean): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: "10px 8px",
    border: "1px solid rgba(255,255,255,0.18)",
    background: eliminated ? "rgba(148,163,184,0.35)" : "rgba(34,197,94,0.25)",
    color: "white",
    display: "grid",
    gap: 6,
    placeItems: "center",
    opacity: disabled && eliminated ? 0.7 : 1,
    cursor: disabled ? "default" : "pointer",
  };
}

function crackRosterName(): React.CSSProperties {
  return { fontSize: 11, fontWeight: 900, textAlign: "center" };
}

function crackAvatarWrap(bg?: string): React.CSSProperties {
  return {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: bg ?? "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.25)",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
  };
}

function crackAvatarImg(): React.CSSProperties {
  return { width: "100%", height: "100%", objectFit: "cover" };
}

function hintText(): React.CSSProperties {
  return { fontSize: 12, opacity: 0.7 };
}

function hintError(): React.CSSProperties {
  return { fontSize: 12, color: "#fca5a5" };
}

function resolveAvatarUrl(storagePath?: string | null) {
  const clean = String(storagePath ?? "").trim();
  if (!clean) return "";
  if (/^https?:\/\//i.test(clean)) return clean;
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) return "";
  const normalized = clean.replace(/^\/+/, "");
  if (normalized.startsWith("storage/v1/object/public/")) {
    return `${baseUrl}/${normalized}`;
  }
  const fullPath = normalized.startsWith("avatars/") ? normalized : `avatars/${normalized}`;
  return `${baseUrl}/storage/v1/object/public/${fullPath}`;
}

function teamCard(side: "left" | "right"): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 14,
    border: side === "left" ? "1px solid rgba(59,130,246,0.6)" : "1px solid rgba(248,113,113,0.6)",
    background:
      side === "left"
        ? "linear-gradient(160deg, rgba(30,58,138,0.45), rgba(2,6,23,0.7))"
        : "linear-gradient(160deg, rgba(127,29,29,0.45), rgba(2,6,23,0.7))",
    display: "grid",
    gap: 8,
  };
}

function teamLabel(side: "left" | "right"): React.CSSProperties {
  return {
    fontWeight: 1000,
    fontSize: 14,
    color: side === "left" ? "rgba(147,197,253,1)" : "rgba(248,113,113,1)",
  };
}

function scoreValue(): React.CSSProperties {
  return { fontSize: 34, fontWeight: 1000 };
}

function statRow(): React.CSSProperties {
  return { display: "grid", gap: 4, fontSize: 12, opacity: 0.8 };
}

function btnRow(): React.CSSProperties {
  return { display: "flex", gap: 8, flexWrap: "wrap" };
}

function utilityRow(): React.CSSProperties {
  return { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" };
}

function primaryBtn(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: "7px 12px",
    border: "1px solid rgba(56,189,248,0.6)",
    background: "linear-gradient(120deg, rgba(56,189,248,0.35), rgba(56,189,248,0.15))",
    color: "white",
    fontWeight: 900,
    fontSize: 12,
  };
}

function ghostBtn(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: "7px 12px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(2,6,23,0.7)",
    color: "white",
    fontWeight: 800,
    fontSize: 12,
  };
}

function alertBtn(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: "7px 12px",
    border: "1px solid rgba(251,191,36,0.7)",
    background: "linear-gradient(120deg, rgba(251,191,36,0.35), rgba(251,191,36,0.15))",
    color: "white",
    fontWeight: 900,
    fontSize: 12,
  };
}

function dangerBtn(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: "7px 12px",
    border: "1px solid rgba(248,113,113,0.7)",
    background: "linear-gradient(120deg, rgba(248,113,113,0.35), rgba(248,113,113,0.15))",
    color: "white",
    fontWeight: 900,
    fontSize: 12,
  };
}

function eventBadge(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.5)",
    background: "rgba(56,189,248,0.12)",
    fontSize: 12,
    fontWeight: 900,
    width: "fit-content",
  };
}

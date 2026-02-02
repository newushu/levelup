"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AuthGate from "@/components/AuthGate";
import { playGlobalSfx, setGlobalSounds } from "@/lib/globalAudio";

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

const EMPTY_STATE: CrackState = {
  running: false,
  secondsLeft: 0,
  durationSeconds: 0,
  steps: 0,
  ruleSeconds: 0,
  ruleCount: 0,
  ruleNote: "",
  suddenDeathAt: 60,
  eliminatedIds: [],
  winners: [],
  updatedAt: Date.now(),
};

export default function CrackABatDisplay() {
  const [state, setState] = useState<CrackState>(() => {
    if (typeof window === "undefined") return EMPTY_STATE;
    try {
      const raw = localStorage.getItem("crack_state_display") || "";
      if (!raw) return EMPTY_STATE;
      return { ...EMPTY_STATE, ...(JSON.parse(raw) as CrackState) };
    } catch {
      return EMPTY_STATE;
    }
  });
  const [now, setNow] = useState(() => Date.now());
  const channelRef = useRef<BroadcastChannel | null>(null);
  const navChannelRef = useRef<BroadcastChannel | null>(null);
  const suddenDeathRef = useRef(false);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterMsg, setRosterMsg] = useState("");

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
          if (key && url) map[key] = { url, volume: Number(row?.volume ?? 1), loop: row?.loop ?? false };
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
    channelRef.current = new BroadcastChannel("coach-timer-crack");
    channelRef.current.onmessage = (event) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "crack_state") {
        const next = { ...EMPTY_STATE, ...(data.state as CrackState) };
        setState(next);
        try {
          localStorage.setItem("crack_state_display", JSON.stringify(next));
        } catch {}
      }
    };
    channelRef.current.postMessage({ type: "crack_request_state" });
    return () => {
      channelRef.current?.close();
      channelRef.current = null;
    };
  }, []);

  useEffect(() => {
    let active = true;
    let instanceId = "";
    try {
      instanceId = localStorage.getItem("coach_dashboard_lock_instance") || "";
    } catch {}
    if (!instanceId) return;
    setRosterLoading(true);
    setRosterMsg("");
    (async () => {
      try {
        const res = await fetch("/api/classroom/roster", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instance_id: instanceId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok || !data?.ok) {
          setRosterMsg(data?.error || "Failed to load roster");
          setRoster([]);
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
        setRoster(next.filter((r: any) => r.id));
      } catch (err: any) {
        if (!active) return;
        setRosterMsg(err?.message ?? "Failed to load roster");
        setRoster([]);
      } finally {
        if (active) setRosterLoading(false);
      }
    })();
    return () => {
      active = false;
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
    const elapsed = Math.floor((now - state.updatedAt) / 1000);
    return Math.max(0, state.secondsLeft - elapsed);
  }, [state.secondsLeft, state.running, state.updatedAt, now]);

  const timeText = useMemo(() => {
    const minutes = Math.floor(displaySeconds / 60);
    const seconds = displaySeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [displaySeconds]);
  const showRoster = isSudden(displaySeconds, state.suddenDeathAt) || displaySeconds === 0 || state.winners.length > 0;

  useEffect(() => {
    const threshold = state.suddenDeathAt || 60;
    if (displaySeconds <= threshold && displaySeconds > 0 && !suddenDeathRef.current) {
      suddenDeathRef.current = true;
      playGlobalSfx("crack_sudden_death");
    }
    if (displaySeconds > threshold) suddenDeathRef.current = false;
  }, [displaySeconds]);

  return (
    <AuthGate>
      <main style={page()}>
        <style>{`
          .cab-bg::before {
            content: "";
            position: absolute;
            inset: -10%;
            background:
              radial-gradient(circle, rgba(251,191,36,0.18) 0 2px, transparent 3px),
              radial-gradient(circle, rgba(59,130,246,0.14) 0 2px, transparent 3px);
            background-size: 160px 160px, 120px 120px;
            animation: drift 26s linear infinite;
            opacity: 0.5;
            pointer-events: none;
          }
          @keyframes drift { from { transform: translate3d(0,0,0); } to { transform: translate3d(70px, -40px, 0); } }
          @keyframes deathGlow {
            0% { box-shadow: 0 0 0 rgba(248,113,113,0.0); }
            50% { box-shadow: 0 0 40px rgba(248,113,113,0.85); }
            100% { box-shadow: 0 0 0 rgba(248,113,113,0.0); }
          }
          .crack-roster { position: relative; }
          .crack-card {
            border-radius: 18px;
            padding: 10px;
            border: 2px solid rgba(34,197,94,0.6);
            background: rgba(34,197,94,0.2);
            display: grid;
            placeItems: center;
            gap: 8px;
            transition: transform 0.2s ease, opacity 0.2s ease;
            overflow: hidden;
          }
          .crack-card.eliminated {
            border-color: rgba(148,163,184,0.5);
            background: rgba(148,163,184,0.22);
            opacity: 0.6;
          }
          .eliminate-x {
            position: absolute;
            inset: 0;
            pointer-events: none;
          }
          .eliminated .eliminate-x::before,
          .eliminated .eliminate-x::after {
            content: "";
            position: absolute;
            top: 50%;
            left: 50%;
            width: 140%;
            height: 3px;
            background: rgba(239,68,68,0.9);
            transform-origin: center;
            animation: drawX 0.35s ease forwards;
          }
          .eliminated .eliminate-x::after {
            animation-delay: 0.15s;
          }
          @keyframes drawX {
            from { transform: translate(-50%, -50%) rotate(45deg) scaleX(0); }
            to { transform: translate(-50%, -50%) rotate(45deg) scaleX(1); }
          }
          .eliminated .eliminate-x::after {
            transform: translate(-50%, -50%) rotate(-45deg) scaleX(0);
            animation-name: drawXBack;
          }
          @keyframes drawXBack {
            from { transform: translate(-50%, -50%) rotate(-45deg) scaleX(0); }
            to { transform: translate(-50%, -50%) rotate(-45deg) scaleX(1); }
          }
          .winners-overlay {
            position: absolute;
            inset: 0;
            border-radius: 24px;
            background:
              radial-gradient(circle at 20% 20%, rgba(250,204,21,0.35), transparent 45%),
              radial-gradient(circle at 80% 30%, rgba(59,130,246,0.3), transparent 55%),
              rgba(2,6,23,0.9);
            display: grid;
            gap: 16px;
            padding: 20px;
            box-shadow: 0 30px 60px rgba(0,0,0,0.6);
          }
          .winner-card {
            border-radius: 20px;
            padding: 14px;
            border: 2px solid rgba(250,204,21,0.6);
            background: rgba(15,23,42,0.8);
            display: grid;
            gap: 8px;
            placeItems: center;
            position: relative;
            overflow: hidden;
          }
          .winner-card::before {
            content: "";
            position: absolute;
            inset: -20%;
            background:
              radial-gradient(circle, rgba(250,204,21,0.45) 0 2px, transparent 3px),
              radial-gradient(circle, rgba(255,255,255,0.3) 0 1px, transparent 2px);
            background-size: 90px 90px, 60px 60px;
            animation: sparkle 6s linear infinite;
            opacity: 0.8;
          }
          @keyframes sparkle {
            from { transform: translateY(0); }
            to { transform: translateY(-60px); }
          }
        `}</style>

        <div className="cab-bg" style={headerRow()}>
          <div style={timerColumn()}>
            <div style={title()}>Crack a Bat</div>
            <div style={timerBox(isSudden(displaySeconds, state.suddenDeathAt))}>
              <div style={timerValue()}>{timeText}</div>
              {!state.running && state.secondsLeft ? <div style={pausedTag()}>TIME IS PAUSED</div> : null}
            </div>
            <div style={modeRow()}>
              <div style={modeChip(!isSudden(displaySeconds, state.suddenDeathAt))}>Normal Mode</div>
              <div style={modeChip(isSudden(displaySeconds, state.suddenDeathAt))}>Sudden Death</div>
            </div>
          </div>
          <div style={rulesColumn()}>
            <div style={ruleCard(isSudden(displaySeconds, state.suddenDeathAt))}>
              <div style={ruleLabel()}>Steps</div>
              <div style={ruleValue()}>{state.steps || "—"}</div>
            </div>
            <div style={ruleCard(isSudden(displaySeconds, state.suddenDeathAt))}>
              <div style={ruleLabel()}>Seconds</div>
              <div style={ruleValue()}>{state.ruleSeconds || "—"}</div>
            </div>
            <div style={ruleCard(isSudden(displaySeconds, state.suddenDeathAt))}>
              <div style={ruleLabel()}>Rule</div>
              <div style={ruleNote()}>
                {state.ruleCount || state.ruleNote ? `${state.ruleCount || 0} ${state.ruleNote || ""}`.trim() : "—"}
              </div>
            </div>
          </div>
        </div>
        {showRoster ? (
          <div style={rosterWrap()} className="crack-roster">
            <div style={rosterTitle()}>Sudden Death Roster</div>
            {rosterLoading ? <div style={rosterHint()}>Loading roster…</div> : null}
            {rosterMsg ? <div style={rosterError()}>{rosterMsg}</div> : null}
            <div style={rosterGrid()}>
              {roster.map((row) => {
                const eliminated = state.eliminatedIds.includes(row.id);
                return (
                  <div key={row.id} className={`crack-card ${eliminated ? "eliminated" : ""}`} style={rosterCard()}>
                    <div className="eliminate-x" />
                    <div style={rosterAvatar(row.avatar_bg ?? undefined)}>
                      {row.avatar_storage_path ? (
                        <img src={resolveAvatarUrl(row.avatar_storage_path)} alt={row.name} style={rosterAvatarImg()} />
                      ) : (
                        <span style={{ fontSize: 12, opacity: 0.7 }}>No avatar</span>
                      )}
                    </div>
                    <div style={rosterName()}>{row.name}</div>
                  </div>
                );
              })}
            </div>
            {state.winners.length ? (
              <div className="winners-overlay">
                <div style={winnersTitle()}>WINNERS</div>
                <div style={winnersGrid()}>
                  {state.winners.map((winner) => (
                    <div key={winner.id} className="winner-card" style={winnerCard()}>
                      <div style={winnerAvatar()}>
                        {winner.avatar_storage_path ? (
                          <img src={resolveAvatarUrl(winner.avatar_storage_path)} alt={winner.name} style={winnerAvatarImg()} />
                        ) : (
                          <span style={{ fontSize: 12, opacity: 0.7 }}>No avatar</span>
                        )}
                      </div>
                      <div style={winnerName()}>{winner.name}</div>
                      <div style={winnerPoints()}>+{winner.points_awarded} pts</div>
                      <div style={winnerMeta()}>
                        <span>Total {winner.points_total ?? "—"}</span>
                        <span>Lvl {winner.level ?? "—"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </main>
    </AuthGate>
  );
}

function page(): React.CSSProperties {
  return {
    minHeight: "100vh",
    padding: 24,
    color: "white",
    background:
      "radial-gradient(circle at top, rgba(251,191,36,0.2), rgba(2,6,23,0.96)), linear-gradient(120deg, rgba(15,23,42,0.9), rgba(2,6,23,1))",
    display: "grid",
    justifyItems: "center",
    alignContent: "start",
    gap: 24,
  };
}

function headerRow(): React.CSSProperties {
  return {
    width: "100%",
    maxWidth: 1400,
    display: "grid",
    gridTemplateColumns: "1fr 280px",
    gap: 16,
    alignItems: "start",
    position: "relative",
    transform: "scale(1.2)",
    transformOrigin: "top center",
  };
}

function rosterWrap(): React.CSSProperties {
  return {
    width: "100%",
    maxWidth: 1400,
    borderRadius: 24,
    padding: 18,
    border: "2px solid rgba(34,197,94,0.3)",
    background: "rgba(2,6,23,0.7)",
    display: "grid",
    gap: 12,
  };
}

function rosterTitle(): React.CSSProperties {
  return { fontSize: 18, fontWeight: 1000, letterSpacing: 1, textTransform: "uppercase" };
}

function rosterHint(): React.CSSProperties {
  return { fontSize: 12, opacity: 0.7 };
}

function rosterError(): React.CSSProperties {
  return { fontSize: 12, color: "#fca5a5" };
}

function rosterGrid(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 };
}

function rosterCard(): React.CSSProperties {
  return {
    position: "relative",
    minHeight: 160,
  };
}

function rosterAvatar(bg?: string): React.CSSProperties {
  return {
    width: 96,
    height: 96,
    borderRadius: 20,
    background: bg ?? "rgba(255,255,255,0.12)",
    border: "2px solid rgba(255,255,255,0.3)",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
  };
}

function rosterAvatarImg(): React.CSSProperties {
  return { width: "100%", height: "100%", objectFit: "cover" };
}

function rosterName(): React.CSSProperties {
  return { fontSize: 16, fontWeight: 900, textAlign: "center" };
}

function winnersTitle(): React.CSSProperties {
  return { fontSize: 26, fontWeight: 1000, letterSpacing: 2, textAlign: "center" };
}

function winnersGrid(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 };
}

function winnerCard(): React.CSSProperties {
  return { minHeight: 220, position: "relative" };
}

function winnerAvatar(): React.CSSProperties {
  return {
    width: 110,
    height: 110,
    borderRadius: 24,
    border: "2px solid rgba(250,204,21,0.6)",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    background: "rgba(255,255,255,0.08)",
  };
}

function winnerAvatarImg(): React.CSSProperties {
  return { width: "100%", height: "100%", objectFit: "cover" };
}

function winnerName(): React.CSSProperties {
  return { fontSize: 18, fontWeight: 1000, textAlign: "center" };
}

function winnerPoints(): React.CSSProperties {
  return { fontSize: 20, fontWeight: 1000, color: "#fde047" };
}

function winnerMeta(): React.CSSProperties {
  return { fontSize: 12, opacity: 0.8, display: "flex", gap: 10 };
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

function timerColumn(): React.CSSProperties {
  return { display: "grid", gap: 12, justifyItems: "center" };
}

function timerBox(isSudden: boolean): React.CSSProperties {
  return {
    borderRadius: 30,
    padding: "40px 48px",
    border: isSudden ? "3px solid rgba(248,113,113,0.9)" : "2px solid rgba(251,191,36,0.6)",
    background: "rgba(8,12,22,0.85)",
    display: "grid",
    placeItems: "center",
    gap: 10,
    boxShadow: isSudden ? "0 0 40px rgba(248,113,113,0.65)" : "0 26px 60px rgba(0,0,0,0.55)",
    textAlign: "center",
    animation: isSudden ? "deathGlow 0.35s ease-in-out infinite" : "none",
  };
}

function title(): React.CSSProperties {
  return { fontSize: 34, fontWeight: 1000, letterSpacing: 1.2, textAlign: "center" };
}

function timerValue(): React.CSSProperties {
  return { fontSize: 247, fontWeight: 1000, letterSpacing: 2 };
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

function rulesColumn(): React.CSSProperties {
  return { display: "grid", gap: 12 };
}

function ruleCard(isSudden: boolean): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: "18px 16px",
    border: isSudden ? "2px solid rgba(248,113,113,0.85)" : "1px solid rgba(255,255,255,0.18)",
    background: "rgba(2,6,23,0.7)",
    display: "grid",
    gap: 10,
    minHeight: 120,
    boxShadow: isSudden ? "0 0 20px rgba(248,113,113,0.5)" : "inset 0 1px 8px rgba(0,0,0,0.6)",
    animation: isSudden ? "deathGlow 0.35s ease-in-out infinite" : "none",
  };
}

function ruleLabel(): React.CSSProperties {
  return { fontSize: 14, opacity: 0.75, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 900 };
}

function ruleValue(): React.CSSProperties {
  return { fontSize: 44, fontWeight: 1000 };
}

function ruleNote(): React.CSSProperties {
  return { fontSize: 20, fontWeight: 800, minHeight: 48 };
}

function modeRow(): React.CSSProperties {
  return { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" };
}

function modeChip(active: boolean): React.CSSProperties {
  return {
    borderRadius: 999,
    padding: "18px 28px",
    border: active ? "1px solid rgba(251,191,36,0.9)" : "1px solid rgba(255,255,255,0.2)",
    background: active ? "rgba(251,191,36,0.2)" : "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 900,
    fontSize: 24,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    opacity: active ? 1 : 0.5,
  };
}

function isSudden(seconds: number, threshold: number) {
  const t = threshold || 60;
  return seconds > 0 && seconds <= t;
}

function timerRouteForKey(key: string) {
  if (key === "ctf") return "/display/ctf";
  if (key === "crack_a_bat") return "/display/crack-a-bat";
  if (key === "siege_survive") return "/display/siege-survive";
  return "";
}

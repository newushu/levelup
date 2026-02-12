"use client";

import { useEffect, useMemo, useState } from "react";

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 180)}` } };
  }
}

export default function SkillStrikeDisplayPage() {
  const [gameCode, setGameCode] = useState("");
  const [gameId, setGameId] = useState("");
  const [state, setState] = useState<any>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!gameId) return;
    let active = true;
    const load = async () => {
      const res = await fetch(`/api/skill-strike/games/${gameId}`, { cache: "no-store" });
      const sj = await safeJson(res);
      if (sj.ok && active) setState(sj.json.game?.state ?? null);
    };
    load();
    const t = setInterval(load, 2000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [gameId]);

  const joinByCode = async () => {
    setMsg("");
    const res = await fetch("/api/skill-strike/games", { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error ?? "Failed to load games");
    const match = (sj.json.games ?? []).find((g: any) => String(g.code).toUpperCase() === gameCode.toUpperCase());
    if (!match) return setMsg("Game code not found");
    setGameId(match.id);
  };

  const activePlayer = useMemo(() => {
    if (!state) return null;
    const playerId = state.turn?.active_player_id;
    return (
      state.teams?.a?.players?.find((p: any) => p.id === playerId) ||
      state.teams?.b?.players?.find((p: any) => p.id === playerId) ||
      null
    );
  }, [state]);

  const pending = state?.pending_attack;

  return (
    <main style={{ minHeight: "100vh", padding: 32, color: "white", background: "radial-gradient(circle at top, rgba(30,64,175,0.35), rgba(2,6,23,0.9))" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 32, fontWeight: 1000 }}>Skill Strike Live Display</div>
          <div style={{ opacity: 0.7 }}>Live scoreboard + turn order</div>
        </div>
        <a href="/admin/skill-strike" style={linkBtn()}>
          Host Console
        </a>
      </div>

      {msg ? (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 12, background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.4)" }}>
          {msg}
        </div>
      ) : null}

      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <input value={gameCode} onChange={(e) => setGameCode(e.target.value)} style={input()} placeholder="Game code" />
        <button onClick={joinByCode} style={primaryBtn()}>
          Load Game
        </button>
      </div>

      {state ? (
        <div style={{ marginTop: 24, display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={teamBox("a")}>
              <div style={{ fontWeight: 900, letterSpacing: 2 }}>TEAM A</div>
              <div style={{ fontSize: 52, fontWeight: 1000 }}>{state.teams?.a?.hp ?? 0}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(state.teams?.a?.players ?? []).map((p: any) => (
                  <span key={p.id} style={chip()}>
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
            <div style={teamBox("b")}>
              <div style={{ fontWeight: 900, letterSpacing: 2 }}>TEAM B</div>
              <div style={{ fontSize: 52, fontWeight: 1000 }}>{state.teams?.b?.hp ?? 0}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(state.teams?.b?.players ?? []).map((p: any) => (
                  <span key={p.id} style={chip()}>
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div style={infoBox()}>
            <div style={{ fontWeight: 900 }}>Current Turn</div>
            <div style={{ fontSize: 28, fontWeight: 1000 }}>{activePlayer ? activePlayer.name : ""}</div>
            <div style={{ opacity: 0.7 }}>Team {state.turn?.active_team?.toUpperCase()} • Turn #{state.turn_number}</div>
          </div>

          <div style={infoBox()}>
            <div style={{ fontWeight: 900 }}>Pending Attack</div>
            {pending ? (
              <div style={{ fontSize: 18 }}>
                {pending.card?.label} • dmg {pending.damage} • {pending.category}
              </div>
            ) : (
              <div style={{ opacity: 0.7 }}>No pending attack</div>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}

function input(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.3)",
    color: "white",
    fontWeight: 700,
  };
}

function primaryBtn(): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "linear-gradient(135deg, rgba(59,130,246,0.55), rgba(34,197,94,0.55))",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function linkBtn(): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    textDecoration: "none",
    fontWeight: 900,
  };
}

function teamBox(team: "a" | "b"): React.CSSProperties {
  return {
    padding: 16,
    borderRadius: 18,
    border: `1px solid ${team === "a" ? "rgba(59,130,246,0.4)" : "rgba(239,68,68,0.4)"}`,
    background:
      team === "a"
        ? "linear-gradient(135deg, rgba(30,58,138,0.45), rgba(2,6,23,0.85))"
        : "linear-gradient(135deg, rgba(124,45,18,0.45), rgba(2,6,23,0.85))",
    display: "grid",
    gap: 8,
  };
}

function chip(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.1)",
    fontWeight: 900,
  };
}

function infoBox(): React.CSSProperties {
  return {
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(2,6,23,0.65)",
  };
}

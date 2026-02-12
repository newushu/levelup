"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 180)}` } };
  }
}

type Student = { id: string; name: string; level?: number; points_total?: number };

type GameRow = { id: string; code: string; status: string };

type GameState = any;

export default function SkillStrikeHostPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [teamAIds, setTeamAIds] = useState<string[]>([]);
  const [teamBIds, setTeamBIds] = useState<string[]>([]);
  const [games, setGames] = useState<GameRow[]>([]);
  const [activeGameId, setActiveGameId] = useState<string>("");
  const [state, setState] = useState<GameState | null>(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [assignTeam, setAssignTeam] = useState<"a" | "b">("a");

  useEffect(() => {
    const load = async () => {
      const [studentsRes, gamesRes] = await Promise.all([
        fetch("/api/students/list", { cache: "no-store" }),
        fetch("/api/skill-strike/games", { cache: "no-store" }),
      ]);
      const sj = await safeJson(studentsRes);
      if (sj.ok) setStudents(sj.json.students ?? []);
      const gj = await safeJson(gamesRes);
      if (gj.ok) {
        setGames(gj.json.games ?? []);
        const first = (gj.json.games ?? [])[0];
        if (first && !activeGameId) setActiveGameId(first.id);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!activeGameId) return;
    let active = true;
    const loadState = async () => {
      const res = await fetch(`/api/skill-strike/games/${activeGameId}`, { cache: "no-store" });
      const sj = await safeJson(res);
      if (sj.ok && active) setState(sj.json.game?.state ?? null);
    };
    loadState();
    const t = setInterval(loadState, 2000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [activeGameId]);

  const selectedTeamA = teamAIds.map((id) => students.find((s) => s.id === id)).filter(Boolean) as Student[];
  const selectedTeamB = teamBIds.map((id) => students.find((s) => s.id === id)).filter(Boolean) as Student[];

  const availableStudents = students.filter((s) => !teamAIds.includes(s.id) && !teamBIds.includes(s.id));

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

  const createGame = async () => {
    setLoading(true);
    setMsg("");
    const res = await fetch("/api/skill-strike/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team_a_ids: teamAIds, team_b_ids: teamBIds }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) setMsg(sj.json?.error ?? "Failed to create game");
    else {
      setGames((prev) => [sj.json.game, ...prev]);
      setActiveGameId(sj.json.game.id);
      setState(sj.json.state);
    }
    setLoading(false);
  };

  const act = async (action: string, payload: any = {}) => {
    if (!activeGameId) return;
    setLoading(true);
    const res = await fetch(`/api/skill-strike/games/${activeGameId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) setMsg(sj.json?.error ?? "Action failed");
    else setState(sj.json.state);
    setLoading(false);
  };

  return (
    <main style={{ padding: 24, color: "white" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <Link href="/admin/custom/skill-strike" style={{ color: "white", textDecoration: "underline", fontSize: 12 }}>
            ← Back to Skill Strike Settings
          </Link>
          <div style={{ fontSize: 28, fontWeight: 1000, marginTop: 8 }}>Skill Strike — Host Console</div>
          <div style={{ opacity: 0.7 }}>Create and run the live game. This page is for admins/coaches.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/skill-strike/team-1" style={linkBtn()}>
            Team 1 Page
          </a>
          <a href="/skill-strike/team-2" style={linkBtn()}>
            Team 2 Page
          </a>
          <a href="/skill-strike/display" style={linkBtn()}>
            Display Page
          </a>
        </div>
      </div>

      {msg ? (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 12, background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.4)" }}>
          {msg}
        </div>
      ) : null}

      <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "360px 1fr", gap: 16 }}>
        <section style={panel()}>
          <div style={panelTitle()}>Create Game</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>Select up to 4 players per team.</div>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <div style={label()}>Team A</div>
              <div style={chipRow()}>
                {selectedTeamA.map((s) => (
                  <span key={s.id} style={chip()} onClick={() => setTeamAIds((prev) => prev.filter((id) => id !== s.id))}>
                    {s.name} ✕
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div style={label()}>Team B</div>
              <div style={chipRow()}>
                {selectedTeamB.map((s) => (
                  <span key={s.id} style={chip()} onClick={() => setTeamBIds((prev) => prev.filter((id) => id !== s.id))}>
                    {s.name} ✕
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div style={label()}>Available Students</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <button onClick={() => setAssignTeam("a")} style={{ ...tabBtn(), ...(assignTeam === "a" ? tabActive() : null) }}>
                  Add to Team A
                </button>
                <button onClick={() => setAssignTeam("b")} style={{ ...tabBtn(), ...(assignTeam === "b" ? tabActive() : null) }}>
                  Add to Team B
                </button>
              </div>
              <div style={chipRow()}>
                {availableStudents.map((s) => (
                  <span
                    key={s.id}
                    style={chip()}
                    onClick={() =>
                      assignTeam === "a"
                        ? setTeamAIds((prev) => (prev.length < 4 ? [...prev, s.id] : prev))
                        : setTeamBIds((prev) => (prev.length < 4 ? [...prev, s.id] : prev))
                    }
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
            <button disabled={loading} onClick={createGame} style={primaryBtn()}>
              Start Skill Strike
            </button>
          </div>
        </section>

        <section style={panel()}>
          <div style={panelTitle()}>Live Game</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            {games.map((g) => (
              <button
                key={g.id}
                onClick={() => setActiveGameId(g.id)}
                style={{ ...tabBtn(), ...(g.id === activeGameId ? tabActive() : null) }}
              >
                {g.code || g.id.slice(0, 5)}
              </button>
            ))}
          </div>

          {state ? (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={teamBox("a")}>
                  <div style={{ fontWeight: 900 }}>Team A</div>
                  <div style={{ fontSize: 34, fontWeight: 1000 }}>{state.teams?.a?.hp ?? 0} HP</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(state.teams?.a?.players ?? []).map((p: any) => (
                      <span key={p.id} style={chip()}>
                        {p.name}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={teamBox("b")}>
                  <div style={{ fontWeight: 900 }}>Team B</div>
                  <div style={{ fontSize: 34, fontWeight: 1000 }}>{state.teams?.b?.hp ?? 0} HP</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(state.teams?.b?.players ?? []).map((p: any) => (
                      <span key={p.id} style={chip()}>
                        {p.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div style={infoBox()}>
                <div style={{ fontWeight: 900 }}>Turn</div>
                <div style={{ fontSize: 18 }}>{activePlayer ? `${activePlayer.name} (${state.turn?.active_team?.toUpperCase()})` : ""}</div>
                <div style={{ opacity: 0.7 }}>Turn #{state.turn_number}</div>
              </div>

              <div style={infoBox()}>
                <div style={{ fontWeight: 900 }}>Pending Attack</div>
                {pending ? (
                  <div style={{ display: "grid", gap: 6 }}>
                    <div>
                      {pending.attacker_team?.toUpperCase()} — {pending.card?.label} — dmg {pending.damage}
                    </div>
                    <div style={{ opacity: 0.7 }}>Skill: {pending.skill_id || "(not set)"}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={() => act("resolve_attack", { success: true })} style={primaryBtn()}>
                        Success (Block)
                      </button>
                      <button onClick={() => act("resolve_attack", { success: false })} style={dangerBtn()}>
                        Fail (Damage)
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ opacity: 0.7 }}>No pending attack</div>
                )}
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => act("end_turn")} style={primaryBtn()}>
                  End Turn
                </button>
              </div>
            </div>
          ) : (
            <div style={{ opacity: 0.7 }}>Select a game to view state.</div>
          )}
        </section>
      </div>
    </main>
  );
}

function panel(): React.CSSProperties {
  return {
    padding: 16,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(15,23,42,0.55)",
  };
}

function panelTitle(): React.CSSProperties {
  return { fontWeight: 1000, fontSize: 18, marginBottom: 10 };
}

function label(): React.CSSProperties {
  return { fontSize: 12, opacity: 0.7, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 };
}

function chipRow(): React.CSSProperties {
  return { display: "flex", flexWrap: "wrap", gap: 6 };
}

function chip(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function primaryBtn(): React.CSSProperties {
  return {
    padding: "8px 14px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "linear-gradient(135deg, rgba(59,130,246,0.55), rgba(34,197,94,0.55))",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function dangerBtn(): React.CSSProperties {
  return {
    padding: "8px 14px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "linear-gradient(135deg, rgba(239,68,68,0.55), rgba(220,38,38,0.55))",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function tabBtn(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
  };
}

function tabActive(): React.CSSProperties {
  return {
    background: "linear-gradient(135deg, rgba(59,130,246,0.4), rgba(34,197,94,0.4))",
    border: "1px solid rgba(255,255,255,0.3)",
  };
}

function teamBox(team: "a" | "b"): React.CSSProperties {
  return {
    padding: 12,
    borderRadius: 14,
    border: `1px solid ${team === "a" ? "rgba(59,130,246,0.35)" : "rgba(239,68,68,0.35)"}`,
    background:
      team === "a"
        ? "linear-gradient(135deg, rgba(30,58,138,0.35), rgba(2,6,23,0.65))"
        : "linear-gradient(135deg, rgba(124,45,18,0.35), rgba(2,6,23,0.65))",
    display: "grid",
    gap: 6,
  };
}

function infoBox(): React.CSSProperties {
  return {
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(2,6,23,0.6)",
    display: "grid",
    gap: 6,
  };
}

function linkBtn(): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    textDecoration: "none",
    fontWeight: 900,
  };
}

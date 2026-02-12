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

type SkillRow = { id: string; name: string; category?: string | null; damage: number };

export default function SkillStrikeTeamPage({ team }: { team: "a" | "b" }) {
  const [gameCode, setGameCode] = useState("");
  const [gameId, setGameId] = useState("");
  const [state, setState] = useState<any>(null);
  const [playerId, setPlayerId] = useState("");
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [attackSkillId, setAttackSkillId] = useState<string>("");
  const [selectedCardId, setSelectedCardId] = useState<string>("");

  useEffect(() => {
    const loadSkills = async () => {
      const res = await fetch("/api/skill-strike/skills", { cache: "no-store" });
      const sj = await safeJson(res);
      if (sj.ok) setSkills(sj.json.skills ?? []);
    };
    loadSkills();
  }, []);

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

  const teamPlayers = (state?.teams?.[team]?.players ?? []) as any[];
  const activePlayer = state?.turn?.active_player_id;
  const hand = playerId ? state?.hands?.[playerId] ?? [] : [];
  const selectedCard = hand.find((c: any) => c.id === selectedCardId);

  const categorySkills = useMemo(() => {
    if (!selectedCard?.category) return [];
    return skills.filter(
      (s) =>
        s.category === selectedCard.category &&
        (selectedCard.type === "attack" || selectedCard.type === "joker" ? s.damage === Number(selectedCard.damage ?? 5) : true)
    );
  }, [selectedCard, skills]);

  const isMyTurn = playerId && activePlayer === playerId;
  const pending = state?.pending_attack;

  const joinByCode = async () => {
    setMsg("");
    const res = await fetch("/api/skill-strike/games", { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error ?? "Failed to load games");
    const match = (sj.json.games ?? []).find((g: any) => String(g.code).toUpperCase() === gameCode.toUpperCase());
    if (!match) return setMsg("Game code not found");
    setGameId(match.id);
  };

  const act = async (action: string, payload: any = {}) => {
    if (!gameId) return;
    setLoading(true);
    setMsg("");
    const res = await fetch(`/api/skill-strike/games/${gameId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) setMsg(sj.json?.error ?? "Action failed");
    else setState(sj.json.state);
    setLoading(false);
  };

  const playSelected = async () => {
    if (!selectedCard || !playerId) return;
    if (selectedCard.type === "shield" || selectedCard.type === "negate") {
      await act("play_effect", { player_id: playerId, card_id: selectedCard.id });
      return;
    }
    if (selectedCard.type === "joker") {
      const skillId = await pickLowestSkill(playerId);
      if (!skillId) return setMsg("No skills with 7+ attempts to use for Joker.");
      await act("play_attack", { player_id: playerId, card_id: selectedCard.id, skill_id: skillId });
      return;
    }
    if (!attackSkillId) return setMsg("Pick a skill for this attack.");
    await act("play_attack", { player_id: playerId, card_id: selectedCard.id, skill_id: attackSkillId });
  };

  const pickLowestSkill = async (studentId: string) => {
    const res = await fetch(`/api/skill-tracker/list?student_id=${studentId}`, { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return "";
    const rows = sj.json.trackers ?? [];
    const filtered = rows.filter((r: any) => Number(r.lifetime_attempts ?? 0) >= 7);
    if (!filtered.length) return "";
    filtered.sort((a: any, b: any) => Number(a.lifetime_rate ?? 0) - Number(b.lifetime_rate ?? 0));
    return filtered[0]?.skill_id ?? "";
  };

  return (
    <main style={{ padding: 24, color: "white" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 1000 }}>Skill Strike — Team {team === "a" ? "1" : "2"}</div>
          <div style={{ opacity: 0.7 }}>Join the game and play your cards.</div>
        </div>
        <a href="/skill-tracker" style={linkBtn()}>
          Back to Skill Pulse
        </a>
      </div>

      {msg ? (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 12, background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.4)" }}>
          {msg}
        </div>
      ) : null}

      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        <div style={panel()}>
          <div style={label()}>Enter Game Code</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input value={gameCode} onChange={(e) => setGameCode(e.target.value)} style={input()} placeholder="Code" />
            <button onClick={joinByCode} style={primaryBtn()}>
              Join
            </button>
          </div>
        </div>

        {state ? (
          <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16 }}>
            <div style={panel()}>
              <div style={label()}>Team Players</div>
              {teamPlayers.map((p: any) => (
                <div key={p.id} style={{ marginBottom: 6 }}>
                  <button
                    onClick={() => setPlayerId(p.id)}
                    style={{ ...tabBtn(), ...(playerId === p.id ? tabActive() : null) }}
                  >
                    {p.name}
                  </button>
                </div>
              ))}
              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                {isMyTurn ? "YOUR TURN" : `Waiting for ${state.turn?.active_team?.toUpperCase()} to act`}
              </div>
            </div>

            <div style={panel()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 1000 }}>Hand</div>
                {selectedCard ? (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Selected: {selectedCard.label}</div>
                ) : null}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 10 }}>
                {hand.map((card: any) => (
                  <button
                    key={card.id}
                    onClick={() => setSelectedCardId(card.id)}
                    style={{ ...cardBox(), ...(selectedCardId === card.id ? cardActive() : null) }}
                  >
                    <div style={{ fontWeight: 900 }}>{card.label}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{card.type.toUpperCase()}</div>
                    {card.category ? <div style={{ fontSize: 12, opacity: 0.7 }}>{card.category}</div> : null}
                  </button>
                ))}
              </div>

              {selectedCard ? (
                <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                  {selectedCard.type === "attack" ? (
                    <div>
                      <div style={label()}>Pick Skill ({selectedCard.category} • dmg {selectedCard.damage})</div>
                      <select value={attackSkillId} onChange={(e) => setAttackSkillId(e.target.value)} style={input()}>
                        <option value="">Select skill</option>
                        {categorySkills.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  <button disabled={loading || !isMyTurn} onClick={playSelected} style={primaryBtn()}>
                    {selectedCard.type === "attack"
                      ? "Play Attack"
                      : selectedCard.type === "joker"
                      ? "Play Joker"
                      : "Play Effect"}
                  </button>
                </div>
              ) : null}

              {pending ? (
                <div style={{ marginTop: 14, padding: 10, borderRadius: 12, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(15,23,42,0.5)" }}>
                  <div style={{ fontWeight: 900 }}>Pending Attack</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    {pending.card?.label} • dmg {pending.damage}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
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

function input(): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.3)",
    color: "white",
    fontWeight: 700,
  };
}

function label(): React.CSSProperties {
  return { fontSize: 12, opacity: 0.7, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" };
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

function tabBtn(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
    width: "100%",
    textAlign: "left",
  };
}

function tabActive(): React.CSSProperties {
  return {
    background: "linear-gradient(135deg, rgba(59,130,246,0.4), rgba(34,197,94,0.4))",
    border: "1px solid rgba(255,255,255,0.3)",
  };
}

function cardBox(): React.CSSProperties {
  return {
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(2,6,23,0.55)",
    textAlign: "left",
  };
}

function cardActive(): React.CSSProperties {
  return {
    boxShadow: "0 0 0 2px rgba(59,130,246,0.6), 0 0 28px rgba(59,130,246,0.45)",
  };
}

"use client";

import { useMemo, useState } from "react";

type Participant = {
  id: string;
  name: string;
  bankroll: string;
};

type Round = {
  id: string;
  number: number;
  winnerId: string;
  blind: string;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function CampWagerManagerPage() {
  const [participants, setParticipants] = useState<Participant[]>([
    { id: uid(), name: "Player 1", bankroll: "" },
    { id: uid(), name: "Player 2", bankroll: "" },
  ]);
  const [blindInput, setBlindInput] = useState("5");
  const [rounds, setRounds] = useState<Round[]>([]);
  const [msg, setMsg] = useState("");

  const debts = useMemo(() => {
    const map = new Map<string, number>();
    rounds.forEach((round) => {
      if (!round.winnerId) return;
      const roundBlind = Number(round.blind);
      if (!Number.isFinite(roundBlind) || roundBlind <= 0) return;
      participants.forEach((p) => {
        if (p.id === round.winnerId) return;
        const key = `${p.id}::${round.winnerId}`;
        map.set(key, (map.get(key) ?? 0) + roundBlind);
      });
    });
    const net = new Map<string, number>();
    Array.from(map.entries()).forEach(([key, amount]) => {
      const [fromId, toId] = key.split("::");
      const pair = [fromId, toId].sort().join("::");
      const sign = fromId <= toId ? 1 : -1;
      net.set(pair, (net.get(pair) ?? 0) + sign * amount);
    });
    return Array.from(net.entries())
      .map(([pair, amount]) => {
        if (!amount) return null;
        const [a, b] = pair.split("::");
        const fromId = amount > 0 ? a : b;
        const toId = amount > 0 ? b : a;
        return { fromId, toId, amount: Math.abs(amount) };
      })
      .filter(Boolean) as Array<{ fromId: string; toId: string; amount: number }>;
  }, [rounds, participants]);

  const totals = useMemo(() => {
    const result = new Map<string, { owed: number; owedTo: number }>();
    participants.forEach((p) => result.set(p.id, { owed: 0, owedTo: 0 }));
    debts.forEach((d) => {
      const from = result.get(d.fromId);
      const to = result.get(d.toId);
      if (from) from.owed += d.amount;
      if (to) to.owedTo += d.amount;
    });
    return result;
  }, [participants, debts]);

  function addParticipant() {
    setParticipants((prev) => [...prev, { id: uid(), name: `Player ${prev.length + 1}`, bankroll: "" }]);
  }

  function removeParticipant(id: string) {
    setParticipants((prev) => prev.filter((p) => p.id !== id));
    setRounds((prev) =>
      prev.map((r) => (r.winnerId === id ? { ...r, winnerId: "" } : r)).filter((r) => r.winnerId !== id)
    );
  }

  function updateParticipant(id: string, patch: Partial<Participant>) {
    setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function addRound() {
    if (participants.length < 2) {
      setMsg("Add at least two players.");
      return;
    }
    setMsg("");
    const parsedBlind = Number(blindInput || "1");
    const safeBlind = Number.isFinite(parsedBlind) && parsedBlind > 0 ? Math.floor(parsedBlind) : 1;
    setRounds((prev) => [
      ...prev,
      { id: uid(), number: prev.length + 1, winnerId: "", blind: String(safeBlind) },
    ]);
  }

  function removeRound(id: string) {
    setRounds((prev) =>
      prev
        .filter((r) => r.id !== id)
        .map((r, idx) => ({
          ...r,
          number: idx + 1,
        }))
    );
  }

  function updateRound(id: string, patch: Partial<Round>) {
    setRounds((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  return (
    <main style={page()}>
      <div style={header()}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 1000 }}>Camp Wager Manager</div>
          <div style={{ opacity: 0.7, marginTop: 6 }}>Track blinds, winners, and who owes who each round.</div>
        </div>
      </div>

      <div style={layout()}>
        <section style={card()}>
          <div style={sectionTitle()}>Players</div>
          <div style={{ display: "grid", gap: 10 }}>
            {participants.map((p, idx) => (
              <div key={p.id} style={row()}>
                <div style={{ fontWeight: 900 }}>#{idx + 1}</div>
                <input
                  value={p.name}
                  onChange={(e) => updateParticipant(p.id, { name: e.target.value })}
                  placeholder="Name"
                  style={input()}
                />
                <input
                  type="number"
                  min={0}
                  value={p.bankroll}
                  onChange={(e) => updateParticipant(p.id, { bankroll: e.target.value })}
                  placeholder="Bankroll"
                  style={input()}
                />
                <button onClick={() => removeParticipant(p.id)} style={btnGhost()}>
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <button onClick={addParticipant} style={btn()}>
              Add Player
            </button>
          </div>
        </section>

        <section style={card()}>
          <div style={sectionTitle()}>Round Setup</div>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={row()}>
              <div style={{ fontWeight: 900 }}>Blind</div>
              <input
                type="number"
                min={1}
                value={blindInput}
                onChange={(e) => setBlindInput(e.target.value)}
                style={input()}
              />
              <button onClick={addRound} style={btn()}>
                Add Round
              </button>
            </div>
            {msg ? <div style={{ fontSize: 12, opacity: 0.7 }}>{msg}</div> : null}
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {rounds.map((r) => (
              <div key={r.id} style={roundCard()}>
                <div style={roundHeader()}>
                  <div style={{ fontWeight: 900 }}>Round {r.number}</div>
                  <button onClick={() => removeRound(r.id)} style={btnGhost()}>
                    Remove
                  </button>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <label style={label()}>Winner</label>
                  <select
                    value={r.winnerId}
                    onChange={(e) => updateRound(r.id, { winnerId: e.target.value })}
                    style={input()}
                  >
                    <option value="">Select winner</option>
                    {participants.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name || "Player"}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <label style={label()}>Blind</label>
                  <input
                    type="number"
                    min={1}
                    value={r.blind}
                    onChange={(e) => updateRound(r.id, { blind: e.target.value })}
                    style={input()}
                  />
                </div>
              </div>
            ))}
            {!rounds.length ? <div style={{ opacity: 0.7 }}>No rounds yet.</div> : null}
          </div>
        </section>

        <aside style={sideCard()}>
          <div style={sectionTitle()}>Owed Summary</div>
          <div style={{ display: "grid", gap: 10 }}>
            {debts.map((d) => {
              const from = participants.find((p) => p.id === d.fromId);
              const to = participants.find((p) => p.id === d.toId);
              if (!from || !to) return null;
              return (
                <div key={`${d.fromId}-${d.toId}`} style={debtRow()}>
                  <span style={{ fontWeight: 900 }}>{from.name || "Player"}</span>
                  <span style={{ opacity: 0.7 }}>→</span>
                  <span style={{ fontWeight: 900 }}>{to.name || "Player"}</span>
                  <span style={amountTag()}>${d.amount.toFixed(0)}</span>
                </div>
              );
            })}
            {!debts.length ? <div style={{ opacity: 0.7 }}>No debts yet.</div> : null}
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Totals</div>
            <div style={{ display: "grid", gap: 8 }}>
              {participants.map((p) => {
                const t = totals.get(p.id) ?? { owed: 0, owedTo: 0 };
                const net = t.owedTo - t.owed;
                return (
                  <div key={`total-${p.id}`} style={totalRow()}>
                    <span style={{ fontWeight: 900 }}>{p.name || "Player"}</span>
                    <span style={{ opacity: 0.7 }}>Owes: ${t.owed.toFixed(0)}</span>
                    <span style={{ opacity: 0.7 }}>Owed: ${t.owedTo.toFixed(0)}</span>
                    <span style={{ fontWeight: 900 }}>{net >= 0 ? `Net +$${net.toFixed(0)}` : `Net -$${Math.abs(net).toFixed(0)}`}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function page(): React.CSSProperties {
  return {
    minHeight: "100vh",
    padding: "32px 24px 50px",
    background:
      "radial-gradient(circle at top, rgba(14,165,233,0.12), transparent 55%), radial-gradient(circle at 20% 20%, rgba(34,197,94,0.10), transparent 45%), #05070b",
    color: "white",
  };
}

function header(): React.CSSProperties {
  return {
    maxWidth: 1200,
    margin: "0 auto 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  };
}

function layout(): React.CSSProperties {
  return {
    maxWidth: 1200,
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "minmax(0, 2.2fr) minmax(0, 2fr) minmax(0, 1.3fr)",
    gap: 16,
  };
}

function card(): React.CSSProperties {
  return {
    borderRadius: 20,
    padding: 20,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(10,15,24,0.72)",
    boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
  };
}

function sideCard(): React.CSSProperties {
  return {
    borderRadius: 20,
    padding: 20,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "linear-gradient(160deg, rgba(15,23,42,0.8), rgba(2,6,23,0.9))",
    boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
    height: "fit-content",
  };
}

function sectionTitle(): React.CSSProperties {
  return {
    fontWeight: 1000,
    marginBottom: 12,
    fontSize: 18,
  };
}

function row(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "auto 1fr 140px auto",
    gap: 12,
    alignItems: "center",
  };
}

function input(): React.CSSProperties {
  return {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.35)",
    color: "white",
    outline: "none",
    width: "100%",
    fontSize: 14,
  };
}

function btn(): React.CSSProperties {
  return {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(34,197,94,0.4)",
    background: "linear-gradient(90deg, rgba(34,197,94,0.9), rgba(14,116,144,0.7))",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontSize: 14,
  };
}

function btnGhost(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontSize: 13,
  };
}

function roundCard(): React.CSSProperties {
  return {
    display: "grid",
    gap: 14,
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.55)",
  };
}

function roundHeader(): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  };
}

function label(): React.CSSProperties {
  return { fontSize: 12, opacity: 0.7, fontWeight: 900 };
}

function debtRow(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr auto",
    gap: 10,
    alignItems: "center",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    fontSize: 14,
  };
}

function amountTag(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(56,189,248,0.2)",
    border: "1px solid rgba(56,189,248,0.4)",
    fontWeight: 900,
    fontSize: 13,
  };
}

function totalRow(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "1fr auto auto auto",
    gap: 12,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    fontSize: 14,
  };
}

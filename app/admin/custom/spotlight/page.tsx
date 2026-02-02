"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type AwardType = { id: string; name: string; points: number; enabled: boolean };

export default function SpotlightConfigPage() {
  const [awardTypes, setAwardTypes] = useState<AwardType[]>([]);
  const [newAwardName, setNewAwardName] = useState("");
  const [newAwardPoints, setNewAwardPoints] = useState("10");
  const [msg, setMsg] = useState("");
  const [awardLimit, setAwardLimit] = useState(0);

  async function loadAwards() {
    setMsg("");
    const res = await fetch("/api/awards/types?include_disabled=1", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data?.error || "Failed to load awards");
    const list = (data.types ?? []) as AwardType[];
    setAwardTypes(list);
    setAwardLimit(list.filter((a) => a.enabled).length);
  }

  useEffect(() => {
    loadAwards();
  }, []);

  async function createAwardType() {
    const name = newAwardName.trim();
    const points = Number(newAwardPoints);
    if (!name || !Number.isFinite(points) || points <= 0) {
      setMsg("Enter an award name and positive points.");
      return;
    }
    setMsg("");
    const res = await fetch("/api/awards/types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, points }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data?.error || "Failed to create award");
    setNewAwardName("");
    await loadAwards();
  }

  async function updateLimit(next: number) {
    setAwardLimit(next);
    const res = await fetch("/api/awards/types/limit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: next }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data?.error || "Failed to update award limit");
      return;
    }
    await loadAwards();
  }

  async function setAwardEnabled(id: string, enabled: boolean) {
    const res = await fetch("/api/awards/types/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data?.error || "Failed to update award");
    await loadAwards();
  }

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 1000 }}>Spotlight Stars</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Configure award qualities and points.</div>
        </div>
        <Link href="/admin/custom" style={backLink()}>
          Return to Custom
        </Link>
      </div>

      {msg && (
        <div style={{ padding: 10, borderRadius: 14, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(255,255,255,0.10)" }}>
          {msg}
        </div>
      )}

      <div style={card()}>
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>Display Limit</div>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Number of Spotlight Star awards to show in class.</div>
          <select value={String(awardLimit)} onChange={(e) => updateLimit(Number(e.target.value))} style={input()}>
            {Array.from({ length: Math.max(1, awardTypes.length) }).map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={card()}>
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>Add Award Quality</div>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr auto", gap: 8 }}>
          <input
            value={newAwardName}
            onChange={(e) => setNewAwardName(e.target.value)}
            placeholder="Award name (e.g., Most Hardworking)"
            style={input()}
          />
          <input
            value={newAwardPoints}
            onChange={(e) => setNewAwardPoints(e.target.value)}
            placeholder="Points"
            style={input()}
          />
          <button onClick={createAwardType} style={btn()}>
            Add Award
          </button>
        </div>
      </div>

      <div style={card()}>
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>Active Awards</div>
        <div style={{ display: "grid", gap: 8 }}>
          {awardTypes.filter((a) => a.enabled).map((a) => (
            <div key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div style={{ fontWeight: 900 }}>{a.name}</div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ opacity: 0.7, fontSize: 12 }}>{a.points} pts</div>
                <button onClick={() => setAwardEnabled(a.id, false)} style={removeBtn()}>
                  Remove
                </button>
              </div>
            </div>
          ))}
          {!awardTypes.filter((a) => a.enabled).length && <div style={{ opacity: 0.7 }}>No active awards.</div>}
        </div>
      </div>

      <div style={card()}>
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>Hidden Awards</div>
        <div style={{ display: "grid", gap: 8 }}>
          {awardTypes.filter((a) => !a.enabled).map((a) => (
            <div key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div style={{ fontWeight: 900, opacity: 0.6 }}>{a.name}</div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ opacity: 0.6, fontSize: 12 }}>{a.points} pts</div>
                <button onClick={() => setAwardEnabled(a.id, true)} style={restoreBtn()}>
                  Restore
                </button>
              </div>
            </div>
          ))}
          {!awardTypes.filter((a) => !a.enabled).length && <div style={{ opacity: 0.7 }}>No hidden awards.</div>}
        </div>
      </div>
    </main>
  );
}

function card(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: 14,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
  };
}

function input(): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.24)",
    color: "white",
    outline: "none",
  };
}

function btn(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "linear-gradient(90deg, rgba(59,130,246,0.85), rgba(34,197,94,0.70))",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
  };
}

function removeBtn(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid rgba(239,68,68,0.35)",
    background: "rgba(239,68,68,0.18)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  };
}

function restoreBtn(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid rgba(59,130,246,0.35)",
    background: "rgba(59,130,246,0.2)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  };
}

function backLink(): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 12,
  };
}

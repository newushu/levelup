"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type LevelRow = { level: number; min_lifetime_points: number };

type Settings = { base_jump: number; difficulty_pct: number };

function computeThresholds(baseJump: number, difficultyPct: number, maxLevel: number) {
  const totalLevels = Math.max(1, Math.floor(Number(maxLevel) || 1));
  const base = Math.max(0, Math.floor(Number(baseJump) || 0));
  const pct = Math.max(0, Math.floor(Number(difficultyPct) || 0));
  const levels: LevelRow[] = [];
  let total = 0;
  for (let level = 1; level <= totalLevels; level += 1) {
    if (level === 1) {
      levels.push({ level, min_lifetime_points: 0 });
      continue;
    }
    const exponent = level - 1;
    const factor = Math.pow(1 + pct / 100, exponent);
    total += base * factor;
    const rounded = Math.round(total / 10) * 10;
    levels.push({ level, min_lifetime_points: Math.max(0, Math.floor(rounded)) });
  }
  return levels;
}

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status})` } };
  }
}

export default function LevelThresholdsPage() {
  const [role, setRole] = useState("student");
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [settings, setSettings] = useState<Settings>({ base_jump: 50, difficulty_pct: 8 });
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [recalc, setRecalc] = useState(false);
  const [maxLevel, setMaxLevel] = useState(99);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const sj = await safeJson(res);
      if (sj.ok) setRole(String(sj.json?.role ?? "student"));
    })();
  }, []);

  useEffect(() => {
    if (role !== "admin") return;
    (async () => {
      const res = await fetch("/api/admin/avatar-levels", { cache: "no-store" });
      const sj = await safeJson(res);
      if (!sj.ok) return setMsg(sj.json?.error || "Failed to load thresholds");
      const loaded = (sj.json?.levels ?? []) as LevelRow[];
      setLevels(loaded);
      if (loaded.length) {
        const maxLoaded = loaded.reduce((max, row) => Math.max(max, row.level), 1);
        setMaxLevel(maxLoaded);
      }
      if (sj.json?.settings) setSettings(sj.json.settings as Settings);
    })();
  }, [role]);

  useEffect(() => {
    setLevels(computeThresholds(settings.base_jump, settings.difficulty_pct, maxLevel));
  }, [settings.base_jump, settings.difficulty_pct, maxLevel]);

  const sortedLevels = useMemo(
    () => levels.slice().sort((a, b) => a.level - b.level),
    [levels]
  );

  function applyMaxLevel() {
    const nextMax = Math.max(1, Math.floor(Number(maxLevel) || 1));
    setMaxLevel(nextMax);
  }

  async function save() {
    setMsg("");
    setSaving(true);
    const res = await fetch("/api/admin/avatar-levels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ levels, settings, recalc_levels: recalc }),
    });
    const sj = await safeJson(res);
    setSaving(false);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to save");
    setMsg("Saved.");
  }

  if (role !== "admin") {
    return (
      <main style={{ padding: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Admin access only.</div>
      </main>
    );
  }

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 1000 }}>Level Thresholds</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Manage level requirements beyond 99.</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={save} style={btn()} disabled={saving}>
            {saving ? "Saving..." : "Save Thresholds"}
          </button>
          <Link href="/admin/custom" style={backLink()}>
            Return to Custom
          </Link>
        </div>
      </div>

      {msg ? <div style={notice()}>{msg}</div> : null}

      <div style={card()}>
        <div style={{ fontWeight: 1000, marginBottom: 10 }}>Curve Settings</div>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={label()}>Base jump</label>
            <input
              type="number"
              value={settings.base_jump}
              onChange={(e) => setSettings((prev) => ({ ...prev, base_jump: Number(e.target.value) }))}
              style={input()}
            />
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={label()}>Difficulty %</label>
            <input
              type="number"
              value={settings.difficulty_pct}
              onChange={(e) => setSettings((prev) => ({ ...prev, difficulty_pct: Number(e.target.value) }))}
              style={input()}
            />
          </div>
          <label style={toggleRow()}>
            <input type="checkbox" checked={recalc} onChange={(e) => setRecalc(e.target.checked)} />
            Recalculate all student levels on save
          </label>
        </div>
      </div>

      <div style={card()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 1000 }}>Level Table</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={label()}>Max level</span>
              <input
                type="number"
                min={1}
                value={maxLevel}
                onChange={(e) => setMaxLevel(Number(e.target.value))}
                style={{ ...input(), width: 120 }}
              />
            </label>
            <button onClick={applyMaxLevel} style={btnGhost()}>
              Apply Max
            </button>
          </div>
        </div>
        <div style={levelGrid()}>
          {sortedLevels.map((row, idx) => (
            <div key={`${row.level}-${idx}`} style={rowCard()}>
              <div style={{ fontWeight: 900 }}>Level {row.level}</div>
              <input
                type="number"
                value={row.min_lifetime_points}
                onChange={(e) =>
                  setLevels((prev) =>
                    prev.map((lvl) =>
                      lvl.level === row.level
                        ? { ...lvl, min_lifetime_points: Number(e.target.value) }
                        : lvl
                    )
                  )
                }
                style={input()}
              />
            </div>
          ))}
          {!sortedLevels.length && <div style={{ opacity: 0.7 }}>No levels yet.</div>}
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

function rowCard(): React.CSSProperties {
  return {
    display: "grid",
    gap: 6,
    alignItems: "center",
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(8,10,15,0.7)",
  };
}

function levelGrid(): React.CSSProperties {
  return {
    display: "grid",
    gap: 8,
    marginTop: 12,
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  };
}

function label(): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.85,
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
    fontSize: 13,
    fontWeight: 900,
  };
}

function btn(): React.CSSProperties {
  return {
    padding: "10px 16px",
    borderRadius: 12,
    border: "1px solid rgba(59,130,246,0.35)",
    background: "linear-gradient(90deg, rgba(59,130,246,0.85), rgba(14,165,233,0.65))",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
  };
}

function btnGhost(): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  };
}

function notice(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(34,197,94,0.18)",
    color: "white",
    fontWeight: 900,
    fontSize: 12,
  };
}

function toggleRow(): React.CSSProperties {
  return {
    display: "flex",
    gap: 10,
    alignItems: "center",
    fontWeight: 900,
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

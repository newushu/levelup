"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type StatRow = {
  id?: string;
  name: string;
  description?: string | null;
  category?: string | null;
  unit?: string | null;
  higher_is_better?: boolean;
  enabled?: boolean;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 180)}` } };
  }
}

export default function StatsAdminPage() {
  const [stats, setStats] = useState<StatRow[]>([]);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [savedAdd, setSavedAdd] = useState(false);
  const [savedAll, setSavedAll] = useState(false);
  const [filterCategory, setFilterCategory] = useState("all");
  const [categoryDraft, setCategoryDraft] = useState("");
  const [extraCategories, setExtraCategories] = useState<string[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showCategories, setShowCategories] = useState(true);
  const [newStat, setNewStat] = useState<StatRow>({
    name: "",
    description: "",
    category: "",
    unit: "",
    higher_is_better: true,
    enabled: true,
  });

  async function loadStats() {
    const res = await fetch("/api/admin/stats/list", { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to load stats");
    setStats((sj.json?.stats ?? []) as StatRow[]);
  }

  useEffect(() => {
    loadStats();
  }, []);

  async function saveStat(row: StatRow, reload = true) {
    const key = row.id || row.name;
    setSaving((prev) => ({ ...prev, [key]: true }));
    const res = await fetch("/api/admin/stats/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
    const sj = await safeJson(res);
    if (!sj.ok) {
      setSaving((prev) => ({ ...prev, [key]: false }));
      return setMsg(sj.json?.error || "Failed to save stat");
    }
    if (reload) {
      await loadStats();
    }
    setSaving((prev) => ({ ...prev, [key]: false }));
    setSaved((prev) => ({ ...prev, [key]: true }));
    window.setTimeout(() => setSaved((prev) => ({ ...prev, [key]: false })), 1800);
  }

  async function createStat() {
    if (!newStat.name.trim()) return setMsg("Enter a stat name.");
    await saveStat(newStat);
    setNewStat({ name: "", description: "", category: "", unit: "", higher_is_better: true, enabled: true });
    setSavedAdd(true);
    window.setTimeout(() => setSavedAdd(false), 1800);
  }

  async function saveAll() {
    setMsg("");
    const toSave = stats.slice();
    if (!toSave.length) return;
    await Promise.all(toSave.map((row) => saveStat(row, false)));
    await loadStats();
    setSavedAll(true);
    window.setTimeout(() => setSavedAll(false), 1800);
  }

  async function removeCategory(category: string) {
    const targets = stats.filter((s) => statCategories(s).includes(category));
    if (!targets.length) return;
    setMsg("");
    for (const stat of targets) {
      const nextCategories = statCategories(stat).filter((c) => c !== category);
      await saveStat({ ...stat, category: nextCategories.join(", ") });
    }
    setExtraCategories((prev) => prev.filter((c) => c !== category));
  }

  const categories = useMemo(() => {
    const set = new Set<string>();
    stats.forEach((s) => {
      statCategories(s).forEach((c) => set.add(c));
    });
    extraCategories.forEach((c) => set.add(c));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [stats, extraCategories]);

  const filteredStats = useMemo(() => {
    if (filterCategory === "all") return stats;
    return stats.filter((s) => statCategories(s).includes(filterCategory));
  }, [stats, filterCategory]);

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 1000 }}>Performance Lab</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Configure student performance metrics and ranking direction.</div>
        </div>
        <Link href="/admin/custom" style={backLink()}>
          Return to Admin Workspace
        </Link>
      </div>

      {msg ? <div style={notice()}>{msg}</div> : null}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={() => setShowAdd((prev) => !prev)} style={btnAlt()}>
          {showAdd ? "Close Add Stat" : "Add Stat"}
        </button>
        <button onClick={() => setShowCategories((prev) => !prev)} style={btn()}>
          {showCategories ? "Close Categories" : "Add Category"}
        </button>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={saveAll} style={btnGhost()}>
            Save All
          </button>
          {savedAll ? <div style={savedBadge()}>Saved</div> : null}
        </div>
      </div>

      {showCategories ? (
        <div style={card()}>
          <div style={{ fontWeight: 1000, marginBottom: 8 }}>Categories</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={input()}>
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              value={categoryDraft}
              onChange={(e) => setCategoryDraft(e.target.value)}
              placeholder="Add new category"
              style={input()}
            />
            <button
              onClick={() => {
                const next = categoryDraft.trim();
                if (!next) return;
                setExtraCategories((prev) => (prev.includes(next) ? prev : [...prev, next]));
                setNewStat((s) => ({ ...s, category: next }));
                setCategoryDraft("");
              }}
              style={btn()}
            >
              Add Category
            </button>
          </div>
          {categories.length ? (
            <div style={{ marginTop: 12, display: "grid", gap: 8, gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
              {categories.map((c) => (
                <div key={c} style={categoryRow()}>
                  <div style={{ fontWeight: 900 }}>{c}</div>
                  <button
                    onClick={() => removeCategory(c)}
                    style={dangerBtn()}
                    title="Remove category from all stats"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {showAdd ? (
        <div style={card()}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <div style={{ fontWeight: 1000 }}>Add Stat</div>
            {savedAdd ? <div style={savedBadge()}>Saved</div> : null}
          </div>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1.2fr 1fr 1fr 1fr auto" }}>
            <input
              value={newStat.name}
              onChange={(e) => setNewStat((s) => ({ ...s, name: e.target.value }))}
              placeholder="Stat name"
              style={input()}
            />
            <input
              list="stat-category-list"
              value={newStat.category ?? ""}
              onChange={(e) => setNewStat((s) => ({ ...s, category: e.target.value }))}
              placeholder="Categories (comma-separated)"
              style={input()}
            />
            <input
              value={newStat.unit ?? ""}
              onChange={(e) => setNewStat((s) => ({ ...s, unit: e.target.value }))}
              placeholder="Unit (reps, seconds)"
              style={input()}
            />
            <select
              value={newStat.higher_is_better ? "higher" : "lower"}
              onChange={(e) => setNewStat((s) => ({ ...s, higher_is_better: e.target.value === "higher" }))}
              style={input()}
            >
              <option value="higher">Higher is better</option>
              <option value="lower">Lower is better</option>
            </select>
            <button onClick={createStat} style={btn()}>
              Add
            </button>
          </div>
          <textarea
            value={newStat.description ?? ""}
            onChange={(e) => setNewStat((s) => ({ ...s, description: e.target.value }))}
            placeholder="Description"
            style={textarea()}
          />
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 12 }}>
        <datalist id="stat-category-list">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        {filteredStats.map((stat) => (
          <div key={stat.id} style={card()}>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1fr 1fr auto", gap: 10, alignItems: "center" }}>
                <input
                  value={stat.name}
                  onChange={(e) => setStats((prev) => prev.map((s) => (s.id === stat.id ? { ...s, name: e.target.value } : s)))}
                  style={input()}
                />
                <input
                  list="stat-category-list"
                  value={stat.category ?? ""}
                  onChange={(e) => setStats((prev) => prev.map((s) => (s.id === stat.id ? { ...s, category: e.target.value } : s)))}
                  placeholder="Categories (comma-separated)"
                  style={input()}
                />
                <input
                  value={stat.unit ?? ""}
                  onChange={(e) => setStats((prev) => prev.map((s) => (s.id === stat.id ? { ...s, unit: e.target.value } : s)))}
                  placeholder="Unit"
                  style={input()}
                />
                <select
                  value={stat.higher_is_better ? "higher" : "lower"}
                  onChange={(e) =>
                    setStats((prev) =>
                      prev.map((s) => (s.id === stat.id ? { ...s, higher_is_better: e.target.value === "higher" } : s))
                    )
                  }
                  style={input()}
                >
                  <option value="higher">Higher is better</option>
                  <option value="lower">Lower is better</option>
                </select>
                <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
                  <button onClick={() => saveStat(stat)} style={btn()} disabled={!!saving[stat.id ?? ""]}>
                    {saving[stat.id ?? ""] ? "Saving..." : "Save"}
                  </button>
                  {saved[stat.id ?? ""] ? <div style={savedBadge()}>Saved</div> : null}
                </div>
              </div>
              <textarea
                value={stat.description ?? ""}
                onChange={(e) => setStats((prev) => prev.map((s) => (s.id === stat.id ? { ...s, description: e.target.value } : s)))}
                placeholder="Description"
                style={textarea()}
              />
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, opacity: 0.8 }}>
                <input
                  type="checkbox"
                  checked={stat.enabled !== false}
                  onChange={(e) =>
                    setStats((prev) => prev.map((s) => (s.id === stat.id ? { ...s, enabled: e.target.checked } : s)))
                  }
                />
                Enabled
              </label>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

function card(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 14,
    border: "1px solid rgba(148,163,184,0.22)",
    background:
      "linear-gradient(145deg, rgba(30,41,59,0.92), rgba(15,23,42,0.92)), radial-gradient(circle at top right, rgba(56,189,248,0.12), transparent 55%)",
    display: "grid",
    gap: 10,
    boxShadow: "0 16px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)",
  };
}

function input(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.25)",
    background: "rgba(2,6,23,0.65)",
    color: "white",
    fontWeight: 900,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  };
}

function textarea(): React.CSSProperties {
  return {
    minHeight: 70,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.25)",
    background: "rgba(2,6,23,0.65)",
    color: "white",
    fontWeight: 900,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  };
}

function btn(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(56,189,248,0.45)",
    background: "linear-gradient(145deg, rgba(56,189,248,0.45), rgba(14,116,144,0.45))",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(14,116,144,0.35)",
  };
}

function btnAlt(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(251,191,36,0.5)",
    background: "linear-gradient(145deg, rgba(251,191,36,0.45), rgba(245,158,11,0.45))",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(245,158,11,0.35)",
  };
}

function btnGhost(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(15,23,42,0.7)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function categoryRow(): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(2,6,23,0.5)",
  };
}

function dangerBtn(): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid rgba(248,113,113,0.6)",
    background: "rgba(239,68,68,0.2)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function savedBadge(): React.CSSProperties {
  return {
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(34,197,94,0.5)",
    background: "rgba(34,197,94,0.18)",
    color: "white",
    fontWeight: 900,
    fontSize: 11,
  };
}

function statCategories(stat: StatRow): string[] {
  return String(stat.category ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

function notice(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(248,113,113,0.5)",
    background: "rgba(239,68,68,0.18)",
    color: "white",
    fontWeight: 900,
    fontSize: 12,
    boxShadow: "0 10px 24px rgba(239,68,68,0.2)",
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

"use client";

import { useEffect, useMemo, useState } from "react";
import AuthGate from "../../components/AuthGate";

type StatRow = {
  id: string;
  name: string;
  category?: string | null;
  unit?: string | null;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 180)}` } };
  }
}

export default function MyMetricsPage() {
  return (
    <AuthGate>
      <MyMetricsInner />
    </AuthGate>
  );
}

function MyMetricsInner() {
  const [stats, setStats] = useState<StatRow[]>([]);
  const [filterCategory, setFilterCategory] = useState("all");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/performance-lab/stats", { cache: "no-store" });
      const sj = await safeJson(res);
      if (!sj.ok) return setMsg(sj.json?.error || "Failed to load stats");
      setStats((sj.json?.stats ?? []) as StatRow[]);
    })();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    stats.forEach((s) => {
      statCategories(s).forEach((c) => set.add(c));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [stats]);

  const filteredStats = useMemo(() => {
    if (filterCategory === "all") return stats;
    return stats.filter((s) => statCategories(s).includes(filterCategory));
  }, [stats, filterCategory]);

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <div style={{ fontSize: 26, fontWeight: 1000 }}>My Metrics</div>
      <div style={{ opacity: 0.7, fontSize: 12 }}>
        Leaderboards and rankings will appear here as your stats are tracked.
      </div>

      {msg ? <div style={notice()}>{msg}</div> : null}

      <div style={card()}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={input()}>
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <div style={{ opacity: 0.75, fontSize: 12 }}>Leaderboard setup is coming next.</div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {filteredStats.map((stat) => (
          <div key={stat.id} style={card()}>
            <div style={{ fontWeight: 1000 }}>{stat.name}</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>
              {statCategories(stat).length ? `${statCategories(stat).join(" • ")} • ` : ""}
              {stat.unit ? `Unit: ${stat.unit}` : "No unit"}
            </div>
            <div style={{ opacity: 0.7, fontSize: 12, marginTop: 6 }}>Leaderboard coming soon.</div>
          </div>
        ))}
        {!filteredStats.length && <div style={{ opacity: 0.7 }}>No metrics yet.</div>}
      </div>
    </main>
  );
}

function card(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    display: "grid",
    gap: 8,
  };
}

function input(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.28)",
    color: "white",
    fontWeight: 900,
    minWidth: 180,
  };
}

function notice(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(239,68,68,0.3)",
    background: "rgba(239,68,68,0.12)",
    color: "white",
    fontWeight: 900,
    fontSize: 12,
  };
}

function statCategories(stat: StatRow): string[] {
  return String(stat.category ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

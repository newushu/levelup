"use client";

import { useEffect, useMemo, useState } from "react";
import AuthGate from "../../components/AuthGate";

type Row = {
  id: string;
  level: string;
  week: string;
  title: string;
  category: string;
  description: string;
  choreography_id: string | null;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response: ${text.slice(0, 160)}` } };
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  theme: "Theme of the Week",
  warmup: "Warm-up",
  newskill: "New Skills",
  reviewskill: "Review Skills",
  game: "Game",
  conditioning: "Conditioning / Closer",
  closer: "Conditioning / Closer",
  choreograph: "Choreography Focus",
};

const CATEGORY_ORDER = ["theme", "warmup", "newskill", "reviewskill", "game", "conditioning", "closer", "choreograph"];

export default function CurriculumPage() {
  return (
    <AuthGate>
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState("");

  const [level, setLevel] = useState<string>("All");
  const [week, setWeek] = useState<string>("All");

  useEffect(() => {
    (async () => {
      setMsg("");
      const r = await fetch("/api/curriculum", { cache: "no-store" });
      const sj = await safeJson(r);
      if (!sj.ok) return setMsg(sj.json?.error || "Failed to load curriculum");
      setRows((sj.json?.rows ?? []) as Row[]);
    })();
  }, []);

  const levels = useMemo(() => {
    const set = new Set(rows.map((r) => r.level));
    return ["All", ...Array.from(set).sort((a, b) => String(a).localeCompare(String(b)))];
  }, [rows]);

  const weeks = useMemo(() => {
    const set = new Set(rows.map((r) => r.week));
    return ["All", ...Array.from(set).sort((a, b) => Number(a) - Number(b))];
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const okLevel = level === "All" ? true : String(r.level) === level;
      const okWeek = week === "All" ? true : String(r.week) === week;
      return okLevel && okWeek;
    });
  }, [rows, level, week]);

  const byWeekLevel = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of filtered) {
      const key = `W${r.week} • ${r.level}`;
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <main style={{ display: "grid", gap: 14 }}>
      <div className="card" style={panel()}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 1000 }}>Curriculum</div>
            <div style={{ opacity: 0.75, marginTop: 6 }}>Weekly plan pulled from Google Sheet.</div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <select value={level} onChange={(e) => setLevel(e.target.value)} style={select()}>
              {levels.map((x) => (
                <option key={x} value={x}>{x === "All" ? "All Levels" : `Level ${x}`}</option>
              ))}
            </select>

            <select value={week} onChange={(e) => setWeek(e.target.value)} style={select()}>
              {weeks.map((x) => (
                <option key={x} value={x}>{x === "All" ? "All Weeks" : `Week ${x}`}</option>
              ))}
            </select>
          </div>
        </div>

        {msg && <div style={errorBox()}>{msg}</div>}
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        {!byWeekLevel.length && (
          <div className="card" style={panel()}>
            <div style={{ opacity: 0.75 }}>No curriculum rows found for the selected filters.</div>
          </div>
        )}

        {byWeekLevel.map(([key, list]) => {
          const grouped = groupByCategory(list);
          return (
            <div key={key} className="card" style={panel()}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
                <div style={{ fontSize: 18, fontWeight: 1000 }}>{key}</div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>{list.length} items</div>
              </div>

              <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                {CATEGORY_ORDER.filter((c) => grouped[c]?.length).map((cat) => (
                  <div key={cat} style={card()}>
                    <div style={{ fontWeight: 1000, marginBottom: 8 }}>
                      {CATEGORY_LABELS[cat] ?? cat}
                    </div>

                    <div style={{ display: "grid", gap: 10 }}>
                      {grouped[cat].map((r) => (
                        <div key={r.id} style={itemRow()}>
                          <div style={{ fontWeight: 950 }}>{r.title}</div>
                          {r.description && <div style={{ opacity: 0.8, marginTop: 4 }}>{r.description}</div>}
                          {r.choreography_id && (
                            <div style={{ opacity: 0.65, marginTop: 6, fontSize: 12 }}>
                              Choreo ID: <b>{r.choreography_id}</b>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* any uncategorized */}
                {grouped.__other?.length ? (
                  <div style={card()}>
                    <div style={{ fontWeight: 1000, marginBottom: 8 }}>Other</div>
                    <div style={{ display: "grid", gap: 10 }}>
                      {grouped.__other.map((r) => (
                        <div key={r.id} style={itemRow()}>
                          <div style={{ fontWeight: 950 }}>{r.title}</div>
                          {r.description && <div style={{ opacity: 0.8, marginTop: 4 }}>{r.description}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}

function groupByCategory(rows: Row[]) {
  const out: Record<string, Row[]> = {};
  for (const r of rows) {
    const c = String(r.category ?? "").toLowerCase().trim();
    const key = CATEGORY_LABELS[c] ? c : "__other";
    out[key] = [...(out[key] ?? []), r];
  }
  return out;
}

function panel(): React.CSSProperties {
  return {
    borderRadius: 22,
    padding: 14,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 14px 50px rgba(0,0,0,0.25)",
  };
}
function card(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: 12,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
  };
}
function itemRow(): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: "10px 12px",
    background: "rgba(0,0,0,0.18)",
    border: "1px solid rgba(255,255,255,0.10)",
  };
}
function select(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    outline: "none",
    fontWeight: 950,
  };
}
function errorBox(): React.CSSProperties {
  return {
    marginTop: 12,
    padding: 10,
    borderRadius: 14,
    background: "rgba(239,68,68,0.15)",
    border: "1px solid rgba(255,255,255,0.10)",
  };
}

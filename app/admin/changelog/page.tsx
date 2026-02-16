"use client";

import { useMemo, useState } from "react";
import { adminChangeLogEntries } from "@/lib/adminChangeLog";
import { useEffect } from "react";

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: text.slice(0, 200) } };
  }
}

export default function AdminChangeLogPage() {
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState("");
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem("admin_changes_pin_ok") === "1";
  });
  const [dbRows, setDbRows] = useState<Array<{ id: string; page: string; category: string; summary: string; created_at: string }>>([]);
  const [entryPage, setEntryPage] = useState("");
  const [entryCategory, setEntryCategory] = useState("General");
  const [entrySummary, setEntrySummary] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [viewMode, setViewMode] = useState<"grouped" | "timeline">("grouped");
  const [sortMode, setSortMode] = useState<"newest" | "oldest">("newest");
  const [durationMode, setDurationMode] = useState<"all" | "24h" | "7d" | "30d">("all");

  const combinedRows = useMemo(() => {
    const typed = dbRows.map((r) => ({
      id: String(r.id),
      page: String(r.page || "General"),
      category: String(r.category || "General"),
      summary: String(r.summary || ""),
      date: String(r.created_at || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
      createdAtMs: Number(new Date(String(r.created_at || "")).getTime() || 0),
    }));
    const staticTyped = adminChangeLogEntries.map((r) => ({
      ...r,
      createdAtMs: Number(new Date(`${r.date}T00:00:00`).getTime() || 0),
    }));
    return [...typed, ...staticTyped];
  }, [dbRows]);

  const filteredRows = useMemo(() => {
    const now = Date.now();
    let minMs = 0;
    if (durationMode === "24h") minMs = now - 24 * 60 * 60 * 1000;
    if (durationMode === "7d") minMs = now - 7 * 24 * 60 * 60 * 1000;
    if (durationMode === "30d") minMs = now - 30 * 24 * 60 * 60 * 1000;
    const filtered = combinedRows.filter((row) => (minMs ? Number(row.createdAtMs || 0) >= minMs : true));
    return filtered.sort((a, b) =>
      sortMode === "newest" ? Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0) : Number(a.createdAtMs || 0) - Number(b.createdAtMs || 0)
    );
  }, [combinedRows, sortMode, durationMode]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof combinedRows>();
    for (const row of filteredRows) {
      const list = map.get(row.page) ?? [];
      list.push(row);
      map.set(row.page, list);
    }
    return Array.from(map.entries());
  }, [filteredRows]);

  async function loadDbRows() {
    const res = await fetch("/api/admin/changelog/list", { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return;
    setDbRows((sj.json?.entries ?? []) as Array<{ id: string; page: string; category: string; summary: string; created_at: string }>);
  }

  useEffect(() => {
    if (!unlocked) return;
    loadDbRows();
  }, [unlocked]);

  async function unlock() {
    setMsg("");
    const nextPin = pin.trim();
    if (!nextPin) return setMsg("Enter admin PIN.");
    const res = await fetch("/api/skill-tracker/settings/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: nextPin }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(String(sj.json?.error ?? "Invalid PIN"));
    setUnlocked(true);
    window.sessionStorage.setItem("admin_changes_pin_ok", "1");
    setMsg("");
  }

  async function addLog() {
    setMsg("");
    const summary = entrySummary.trim();
    if (!summary) return setMsg("Type a short log line first.");
    setSaveBusy(true);
    const res = await fetch("/api/admin/changelog/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page: entryPage.trim() || "General",
        category: entryCategory.trim() || "General",
        summary,
      }),
    });
    const sj = await safeJson(res);
    setSaveBusy(false);
    if (!sj.ok) return setMsg(String(sj.json?.error ?? "Failed to add log"));
    setEntrySummary("");
    setEntryCategory("General");
    setEntryPage("");
    await loadDbRows();
  }

  return (
    <main style={wrap()}>
      <section style={card()}>
        <div style={title()}>Feature Change Log</div>
        <div style={subTitle()}>Quick plain-English updates by page.</div>
        {!unlocked ? (
          <div style={{ display: "grid", gap: 8, maxWidth: 380 }}>
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Admin PIN"
              type="password"
              style={input()}
            />
            <button type="button" onClick={unlock} style={btn()}>
              Unlock Log
            </button>
            {msg ? <div style={msgStyle()}>{msg}</div> : null}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <section style={sectionCard()}>
              <div style={sectionTitle()}>Add Log</div>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 160px", gap: 8 }}>
                  <input
                    value={entryPage}
                    onChange={(e) => setEntryPage(e.target.value)}
                    placeholder="Page (ex: /camp/classroom)"
                    style={input()}
                  />
                  <input
                    value={entryCategory}
                    onChange={(e) => setEntryCategory(e.target.value)}
                    placeholder="Category"
                    style={input()}
                  />
                </div>
                <input
                  value={entrySummary}
                  onChange={(e) => setEntrySummary(e.target.value)}
                  placeholder="What changed? (quick plain-English note)"
                  style={input()}
                />
                <button type="button" onClick={addLog} style={btn()} disabled={saveBusy}>
                  {saveBusy ? "Saving..." : "Add Log Entry"}
                </button>
              </div>
            </section>
            <section style={sectionCard()}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" onClick={() => setViewMode("grouped")} style={pill(viewMode === "grouped")}>Grouped</button>
                <button type="button" onClick={() => setViewMode("timeline")} style={pill(viewMode === "timeline")}>Timeline</button>
                <button type="button" onClick={() => setSortMode("newest")} style={pill(sortMode === "newest")}>Newest</button>
                <button type="button" onClick={() => setSortMode("oldest")} style={pill(sortMode === "oldest")}>Oldest</button>
                <button type="button" onClick={() => setDurationMode("all")} style={pill(durationMode === "all")}>All</button>
                <button type="button" onClick={() => setDurationMode("24h")} style={pill(durationMode === "24h")}>24h</button>
                <button type="button" onClick={() => setDurationMode("7d")} style={pill(durationMode === "7d")}>7d</button>
                <button type="button" onClick={() => setDurationMode("30d")} style={pill(durationMode === "30d")}>30d</button>
              </div>
            </section>
            {viewMode === "grouped"
              ? grouped.map(([page, rows]) => (
                  <section key={page} style={sectionCard()}>
                    <div style={sectionTitle()}>{page}</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {rows.map((row) => (
                        <article key={row.id} style={rowCard()}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <span style={chip()}>{row.category}</span>
                            <span style={dateChip()}>{row.date}</span>
                          </div>
                          <div style={{ fontWeight: 900 }}>{row.summary}</div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))
              : filteredRows.map((row) => (
                  <article key={`timeline-${row.id}`} style={rowCard()}>
                    <div style={{ fontWeight: 900 }}>{row.summary}</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={chip()}>{row.category}</span>
                      <span style={dateChip()}>{row.date}</span>
                      <span style={{ opacity: 0.8, fontSize: 12 }}>{row.page}</span>
                    </div>
                  </article>
                ))}
          </div>
        )}
      </section>
    </main>
  );
}

function wrap(): React.CSSProperties {
  return {
    minHeight: "100vh",
    padding: 18,
    display: "grid",
    background: "radial-gradient(circle at top, rgba(56,189,248,0.12), rgba(2,6,23,0.96) 60%)",
  };
}
function card(): React.CSSProperties {
  return {
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,0.32)",
    background: "rgba(2,6,23,0.78)",
    padding: 16,
    display: "grid",
    gap: 10,
    color: "white",
    alignContent: "start",
  };
}
function title(): React.CSSProperties {
  return { fontSize: 24, fontWeight: 1000, lineHeight: 1.1 };
}
function subTitle(): React.CSSProperties {
  return { opacity: 0.8, fontSize: 13, fontWeight: 700 };
}
function input(): React.CSSProperties {
  return {
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.45)",
    background: "rgba(15,23,42,0.72)",
    color: "white",
    padding: "10px 12px",
    fontSize: 15,
    fontWeight: 900,
  };
}
function btn(): React.CSSProperties {
  return {
    borderRadius: 10,
    border: "1px solid rgba(56,189,248,0.55)",
    background: "rgba(14,165,233,0.25)",
    color: "white",
    padding: "10px 12px",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
    width: "fit-content",
  };
}
function msgStyle(): React.CSSProperties {
  return { fontSize: 12, color: "#fecaca", fontWeight: 800 };
}
function sectionCard(): React.CSSProperties {
  return {
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.25)",
    background: "rgba(15,23,42,0.58)",
    padding: 10,
    display: "grid",
    gap: 8,
  };
}
function sectionTitle(): React.CSSProperties {
  return { fontSize: 14, fontWeight: 1000, color: "#bae6fd" };
}
function rowCard(): React.CSSProperties {
  return {
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.2)",
    background: "rgba(15,23,42,0.5)",
    padding: "8px 10px",
    display: "grid",
    gap: 6,
  };
}
function chip(): React.CSSProperties {
  return {
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.5)",
    background: "rgba(14,165,233,0.2)",
    padding: "2px 8px",
    fontSize: 11,
    fontWeight: 900,
  };
}
function dateChip(): React.CSSProperties {
  return { opacity: 0.75, fontSize: 11, fontWeight: 800 };
}
function pill(active: boolean): React.CSSProperties {
  return {
    borderRadius: 999,
    border: active ? "1px solid rgba(56,189,248,0.72)" : "1px solid rgba(148,163,184,0.4)",
    background: active ? "rgba(14,165,233,0.24)" : "rgba(30,41,59,0.52)",
    color: "white",
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  };
}

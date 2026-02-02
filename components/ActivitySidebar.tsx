"use client";

import { useEffect, useMemo, useState } from "react";
import { defaultState, getActiveStudent } from "../lib/appState";
import { loadState, subscribeToStateChanges } from "../lib/storage";

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ActivitySidebar() {
  const [mounted, setMounted] = useState(false);
  const [tick, setTick] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);
    const unsub = subscribeToStateChanges(() => setTick((t) => t + 1));
    return unsub;
  }, []);

  const app = useMemo(() => (mounted ? loadState() : defaultState), [mounted, tick]);
  const student = useMemo(() => getActiveStudent(app), [app]);

  const allCategories = Array.from(new Set((student.ledger ?? []).map((l) => String(l.category ?? "").trim()).filter(Boolean)));
  // initialize all selected on mount
  useEffect(() => {
    if (allCategories.length && selected.length === 0) setSelected(allCategories);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  const recent = (student.ledger ?? []).filter((l) => selected.length === 0 || selected.includes(String(l.category ?? ""))).slice(0, 8);

  const colorFor: Record<string, string> = {
    achievement: "#06b6d4",
    leadership: "#f59e0b",
  };

  function toggleCategory(cat: string) {
    if (selected.includes(cat)) setSelected(selected.filter((c) => c !== cat));
    else setSelected([...selected, cat]);
  }

  return (
    <div
      className="card"
      style={{
        borderRadius: 24,
        padding: 14,
        position: "sticky",
        top: 120,
        height: "fit-content",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <div style={{ fontWeight: 950, fontSize: 16 }}>Activity</div>
        <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.65)" }}>Latest 8</div>
      </div>

      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
        {allCategories.length ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
            <button
              onClick={() => setSelected(allCategories)}
              className="pill"
              style={{ padding: "6px 10px", fontSize: 12 }}
              type="button"
            >
              All
            </button>
            {allCategories.map((c) => (
              <button
                key={c}
                onClick={() => toggleCategory(c)}
                type="button"
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "none",
                  fontWeight: 800,
                  fontSize: 12,
                  background: selected.includes(c) ? `${colorFor[c] ?? "#888"}22` : "rgba(255,255,255,0.04)",
                  color: selected.includes(c) ? (colorFor[c] ?? "#fff") : "#fff",
                }}
              >
                {c}
              </button>
            ))}
          </div>
        ) : null}
        {recent.length === 0 ? (
          <div style={{ color: "rgba(255,255,255,0.70)", fontWeight: 750 }}>No activity yet.</div>
        ) : (
          recent.map((e) => (
            <div
              key={e.id}
              style={{
                display: "grid",
                gridTemplateColumns: "64px 74px 1fr",
                gap: 10,
                alignItems: "center",
                padding: "10px 12px",
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.06)",
              }}
              title={e.note}
            >
              <div style={{ fontWeight: 900, color: "rgba(255,255,255,0.82)", fontSize: 12 }}>
                {formatTime(e.timestamp)}
              </div>

              <div
                style={{
                  fontWeight: 950,
                  textAlign: "center",
                  padding: "6px 10px",
                  borderRadius: 999,
                  fontSize: 12,
                  background: e.points >= 0 ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)",
                  border: e.points >= 0 ? "1px solid rgba(34,197,94,0.30)" : "1px solid rgba(239,68,68,0.30)",
                }}
              >
                {e.points > 0 ? `+${e.points}` : e.points}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: 12,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                  }}
                >
                  {e.note}
                </div>
                <div
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 900,
                    background: (colorFor[String(e.category ?? "")] as string) ? `${colorFor[String(e.category ?? "")] }22` : "rgba(255,255,255,0.04)",
                    color: (colorFor[String(e.category ?? "")] as string) ?? "#fff",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {String(e.category ?? "").toUpperCase() || "OTHER"}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

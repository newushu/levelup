"use client";

import { useEffect, useMemo, useState } from "react";
import { useSelectedStudent, type SelectedStudent } from "./StudentContext";

type StudentRow = { id: string; name: string; level: number; points_total: number; is_competition_team: boolean };

export default function StudentPickerBar() {
  const { selected, setSelected } = useSelectedStudent();
  const [all, setAll] = useState<StudentRow[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<StudentRow[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/students/list", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setAll(data.students ?? []);
    })();
  }, []);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch("/api/students/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (res.ok) setResults(data.students ?? []);
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  const dropdownValue = selected?.id ?? "";

  const selectStudent = (s: StudentRow) => {
    setSelected(s as SelectedStudent);
    setOpen(false);
    setQ("");
    setResults([]);
  };

  const selectedLabel = selected ? `${selected.name} • Lv ${selected.level} • ${selected.points_total} pts` : "No student selected";

  return (
    <div
      style={{
        position: "sticky",
        top: 64,
        zIndex: 55,
        borderRadius: 18,
        padding: 12,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(0,0,0,0.38)",
        backdropFilter: "blur(8px)",
        boxShadow: "0 16px 50px rgba(0,0,0,0.35)",
      }}
    >
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div style={{ fontWeight: 1000, fontSize: 14, opacity: 0.92 }}>Selected Student</div>
          <div style={{ opacity: 0.85, fontWeight: 950 }}>{selectedLabel}</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10 }}>
          <select
            value={dropdownValue}
            onChange={(e) => {
              const id = e.target.value;
              const found = all.find((x) => x.id === id);
              if (found) selectStudent(found);
              else if (!id) setSelected(null);
            }}
            style={inp()}
          >
            <option value="">— Select —</option>
            {all.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} (Lv {s.level})
              </option>
            ))}
          </select>

          <div style={{ position: "relative" }}>
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setOpen(true);
              }}
              placeholder="Search name…"
              style={inp()}
            />
            {open && results.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: 44,
                  left: 0,
                  right: 0,
                  borderRadius: 14,
                  background: "rgba(0,0,0,0.92)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  boxShadow: "0 18px 70px rgba(0,0,0,0.50)",
                  overflow: "hidden",
                  zIndex: 80,
                }}
              >
                {results.slice(0, 10).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => selectStudent(s)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      border: "none",
                      background: "transparent",
                      color: "white",
                      cursor: "pointer",
                      fontWeight: 900,
                    }}
                  >
                    {s.name} <span style={{ opacity: 0.7, fontWeight: 700 }}>• Lv {s.level} • {s.points_total} pts</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => setSelected(null)} style={btnGhost()}>
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

function inp(): React.CSSProperties {
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
function btnGhost(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
  };
}

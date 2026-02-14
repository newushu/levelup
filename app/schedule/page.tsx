"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { loadScheduleConfig, saveScheduleConfig, defaultScheduleConfig } from "../../lib/scheduleConfig";

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function buildTimes(startHour = 7, endHour = 22) {
  const times: string[] = [];
  for (let h = startHour; h <= endHour; h++) {
    for (const m of [0, 30]) {
      const hh = ((h + 11) % 12) + 1;
      const ampm = h < 12 ? "AM" : "PM";
      const mm = m === 0 ? "00" : "30";
      times.push(`${hh}:${mm} ${ampm}`);
    }
  }
  return times;
}

export default function SchedulePage() {
  const [mounted, setMounted] = useState(false);
  const [cfg, setCfg] = useState(defaultScheduleConfig);
  const [activeLocId, setActiveLocId] = useState<string>(defaultScheduleConfig.locations[0].id);

  const [newRoom, setNewRoom] = useState("");

  useEffect(() => {
    setMounted(true);
    const loaded = loadScheduleConfig();
    setCfg(loaded);
    setActiveLocId(loaded.locations[0]?.id ?? defaultScheduleConfig.locations[0].id);
  }, []);

  const times = useMemo(() => buildTimes(7, 22), []);
  const loc = useMemo(() => cfg.locations.find((l) => l.id === activeLocId), [cfg, activeLocId]);

  function commit(next: typeof cfg) {
    setCfg(next);
    saveScheduleConfig(next);
  }

  function addRoom() {
    const name = newRoom.trim();
    if (!name || !loc) return;

    const next = {
      ...cfg,
      locations: cfg.locations.map((l) =>
        l.id === loc.id ? { ...l, rooms: Array.from(new Set([...(l.rooms ?? []), name])) } : l
      ),
    };
    commit(next);
    setNewRoom("");
  }

  function removeRoom(room: string) {
    if (!loc) return;
    const next = {
      ...cfg,
      locations: cfg.locations.map((l) =>
        l.id === loc.id ? { ...l, rooms: (l.rooms ?? []).filter((r) => r !== room) } : l
      ),
    };
    commit(next);
  }

  return (
    <main>
      <div className="card" style={{ borderRadius: 28, padding: 16 }}>
        <div style={{ fontSize: 26, fontWeight: 980 }}>Schedule</div>
        <div className="sub" style={{ marginTop: 6 }}>
          30-minute grid • switch locations • configure rooms per location.
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {cfg.locations.map((l) => (
            <button
              key={l.id}
              className="btn"
              onClick={() => setActiveLocId(l.id)}
              style={{
                borderRadius: 999,
                background: l.id === activeLocId ? "rgba(59,130,246,0.22)" : "rgba(255,255,255,0.08)",
              }}
            >
              {l.name}
            </button>
          ))}
        </div>
      </div>

      {/* Room config */}
      <div className="card" style={{ borderRadius: 28, padding: 16, marginTop: 14 }}>
        <div style={{ fontWeight: 980, fontSize: 18 }}>
          Rooms for {loc?.name ?? "—"}
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={newRoom}
            onChange={(e) => setNewRoom(e.target.value)}
            placeholder="Add room (e.g., Studio A)"
            style={{
              width: 260,
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.06)",
              color: "#fff",
              fontWeight: 900,
              outline: "none",
            }}
          />
          <button className="btn btnPrimary" onClick={addRoom}>Add Room</button>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(loc?.rooms ?? []).map((r) => (
              <span key={r} className="pill" style={{ gap: 10 }}>
                {r}
                <button className="btn" style={{ padding: "6px 10px" }} onClick={() => removeRoom(r)}>✕</button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div
        className="card"
        style={{
          borderRadius: 28,
          padding: 12,
          marginTop: 14,
          overflow: "auto",
          background: "rgba(255,255,255,0.04)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "110px repeat(7, minmax(140px, 1fr))",
            gap: 8,
            minWidth: 110 + 7 * 140,
          }}
        >
          <div className="pill" style={{ justifyContent: "center" }}>Time</div>
          {DAYS.map((d) => (
            <div key={d} className="pill" style={{ justifyContent: "center" }}>{d}</div>
          ))}

          {times.map((t) => (
            <Fragment key={`row-${t}`}>
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.04)",
                  fontWeight: 950,
                  fontSize: 12,
                  opacity: 0.9,
                }}
              >
                {t}
              </div>
              {DAYS.map((d) => (
                <div
                  key={`${t}-${d}`}
                  style={{
                    height: 44,
                    borderRadius: 16,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.03)",
                  }}
                  title={`${loc?.name ?? ""} • ${d} ${t}`}
                />
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    </main>
  );
}

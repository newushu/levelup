"use client";

import { useEffect, useMemo, useState } from "react";
import { AppState, getActiveClass } from "../../lib/appState";
import { loadState } from "../../lib/storage";
import EvolvingAvatar from "../../components/EvolvingAvatar";

export default function LeaderboardPage() {
  const [app, setApp] = useState<AppState | null>(null);
  useEffect(() => setApp(loadState()), []);

  const activeClass = useMemo(() => (app ? getActiveClass(app) : null), [app]);

  const ranked = useMemo(() => {
    if (!app || !activeClass) return [];
    return activeClass.studentIds
      .map((id) => app.students[id])
      .filter(Boolean)
      .map((s) => ({
        ...s,
        total: s.leadershipPoints + s.achievementPoints,
      }))
      .sort((a, b) => b.total - a.total);
  }, [app, activeClass]);

  return (
    <main>
      <h1 className="h1">Leaderboard</h1>

      {!activeClass ? (
        <div className="card cardPad" style={{ borderRadius: 24 }}>
          <div style={{ fontWeight: 950 }}>No active class selected</div>
          <div className="sub" style={{ marginTop: 6 }}>
            Create/open a class in <a className="pill" href="/classes">Classes</a> first.
          </div>
        </div>
      ) : (
        <>
          <p className="sub">Ranking for: <strong style={{ color: "#fff" }}>{activeClass.name}</strong></p>

          <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
            {ranked.map((s, idx) => (
              <div
                key={s.id}
                className="card"
                style={{
                  borderRadius: 24,
                  padding: 14,
                  display: "grid",
                  gridTemplateColumns: "52px 72px 1fr auto",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div style={{ fontWeight: 950, fontSize: 18, opacity: 0.9 }}>#{idx + 1}</div>
                <EvolvingAvatar level={s.level} size={56} />
                <div style={{ fontWeight: 950, fontSize: 18 }}>
                  {s.name} {s.isCompetitionTeam ? "★" : ""}
                  <div className="sub" style={{ marginTop: 4 }}>
                    Level {s.level} • Ach {s.achievementPoints} • Lead {s.leadershipPoints}
                  </div>
                </div>
                <div className="pill" style={{ padding: "10px 12px" }}>
                  Total <span style={{ fontWeight: 980, fontSize: 18 }}>{s.total}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}

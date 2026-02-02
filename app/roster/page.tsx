"use client";

import { useEffect, useMemo, useState } from "react";
import { AppState } from "../../lib/appState";
import { loadState } from "../../lib/storage";
import EvolvingAvatar from "../../components/EvolvingAvatar";
import { lifetimeEarnedPoints } from "../../lib/stats";
import { avatarLevelFromLifetime } from "../../lib/avatar";


function prestigeBorder(isComp?: boolean) {
  if (!isComp) return {};
  return {
    border: "1px solid rgba(245,158,11,0.55)",
    boxShadow: "0 0 0 2px rgba(245,158,11,0.18)",
  } as const;
}

export default function RosterPage() {
  const [app, setApp] = useState<AppState | null>(null);
  useEffect(() => setApp(loadState()), []);

  const students = useMemo(() => (app ? Object.values(app.students) : []), [app]);

  return (
    <main>
      <h1 className="h1">Roster</h1>
      <p className="sub">All students in the system (MVP roster). Later this will come from your real roster.</p>

      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {students.map((s) => {
          const total = s.leadershipPoints + s.achievementPoints;
          return (
            <a
              key={s.id}
              href="/dashboard"
              className="card"
              style={{ borderRadius: 24, padding: 14, display: "grid", gridTemplateColumns: "72px 1fr auto", gap: 12, alignItems: "center", ...prestigeBorder(s.isCompetitionTeam) }}
              onClick={() => {
                // set active student before going
                const next = loadState();
                next.activeStudentId = s.id;
                localStorage.setItem("lead-achieve-app", JSON.stringify(next));
              }}
            >
              <div style={{ padding: 8, borderRadius: 24, ...(s.isCompetitionTeam ? { boxShadow: "0 0 0 2px rgba(245,158,11,0.30)" } : {}) }}>
                <EvolvingAvatar level={s.level} size={64} />
              </div>

              <div>
                <div style={{ fontWeight: 950, fontSize: 18 }}>
                  {s.name} {s.isCompetitionTeam ? "★" : ""}
                </div>
                <div className="sub" style={{ marginTop: 6 }}>
                  Age: <strong style={{ color: "#fff" }}>{s.age ?? "—"}</strong> • Rank:{" "}
                  <strong style={{ color: "#fff" }}>{s.rank ?? "—"}</strong>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <span className="pill">Lvl <strong style={{ color: "#fff" }}>{s.level}</strong></span>
                <span className="pill">Total <strong style={{ color: "#fff" }}>{total}</strong></span>
              </div>
            </a>
          );
        })}
      </div>
    </main>
  );
}

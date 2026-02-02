"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { defaultState } from "../lib/appState";
import { loadState, saveState, subscribeToStateChanges } from "../lib/storage";
import { currentTotalPoints, lifetimeEarnedPoints } from "../lib/stats";
import { avatarLevelFromLifetime } from "../lib/avatar";
import EvolvingAvatar from "./EvolvingAvatar";
import { setAvatarBase } from "../lib/actions";

const LOGO_URL =
  "https://newushu.com/uploads/1/1/1/3/111378341/newushu-black-transparent-2.png";

export default function StudentLogBar() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  const [mounted, setMounted] = useState(false);
  const [tick, setTick] = useState(0);
  const [input, setInput] = useState("");

  useEffect(() => {
    setMounted(true);
    const unsub = subscribeToStateChanges(() => setTick((t) => t + 1));
    return unsub;
  }, []);

  const app = useMemo(() => (mounted ? loadState() : defaultState), [mounted, tick]);
  const students = useMemo(() => Object.values(app.students), [app.students]);
  const active = app.students[app.activeStudentId];

  const total = active ? currentTotalPoints(active) : 0;
  const lifetime = active ? lifetimeEarnedPoints(active) : 0;
  const avatarLvl = active ? avatarLevelFromLifetime(lifetime) : 1;

  const catColor: Record<string, string> = {
    achievement: "#06b6d4",
    leadership: "#f59e0b",
  };

  const today = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
  }, []);

  useEffect(() => {
    if (!active) return;
    setInput(active.name);
  }, [app.activeStudentId]);

  function setActiveById(id: string) {
    const next = { ...app, activeStudentId: id };
    saveState(next);
  }

  function setActiveByName(name: string) {
    const n = name.trim().toLowerCase();
    if (!n) return;
    const found = students.find((s) => s.name.trim().toLowerCase() === n);
    if (found) setActiveById(found.id);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setActiveByName(input);
  }

  function commit(next: any) {
    saveState(next);
  }

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 2000,
        background: "rgba(0,0,0,0.78)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.10)",
      }}
    >
      <div className="container" style={{ padding: "12px 0" }}>
        {/* Top row: brand + nav + date */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img
              src={LOGO_URL}
              alt="New England Wushu"
              style={{ height: 26, width: "auto", filter: "invert(1)", opacity: 0.95 }}
            />
            <div style={{ fontWeight: 980, letterSpacing: "-0.02em" }}>
              Lead & Achieve Level Up
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <a className="pill" href="/">Home</a>
            <a className="pill" href="/dashboard">Dashboard</a>
            <a className="pill" href="/classroom">Classroom</a>
            <a className="pill" href="/skills">Skill Tree</a>
            <a className="pill" href="/rewards">Rewards</a>
            <a className="pill" href="/schedule">Schedule</a>
            <a className="pill" href="/curriculum">Curriculum</a>
          </div>

          <div style={{ flex: 1 }} />

          <div className="pill" style={{ opacity: 0.92 }}>
            📅 {today}
          </div>

          {/* Student selector always available (even on Home) */}
          <form onSubmit={onSubmit} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              list="student-names"
              placeholder="Type name…"
              style={{
                width: 200,
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.06)",
                color: "#fff",
                fontWeight: 850,
                outline: "none",
              }}
            />
            <datalist id="student-names">
              {students.map((s) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>

            <button className="btn btnPrimary" type="submit">Select</button>

            <select
              value={app.activeStudentId}
              onChange={(e) => setActiveById(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.06)",
                color: "#fff",
                fontWeight: 900,
              }}
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </form>
        </div>

        {/* Student card + critical notice (HIDDEN on Home) */}
        {!isHome && active && (
          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
              <div
              className="card"
              style={{
                borderRadius: 24,
                padding: "12px 14px",
                background: "linear-gradient(135deg, rgba(6,182,212,0.03), rgba(245,158,11,0.02))",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 280 }}>
                <EvolvingAvatar
                  avatarLevel={avatarLvl}
                  size={52}
                  isCompetitionTeam={active.isCompetitionTeam}
                  base={active.avatarBase}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 980, fontSize: 18, lineHeight: 1.1 }}>
                    {active.name} {active.isCompetitionTeam ? <span style={{ fontSize: 12 }}>★</span> : null}
                  </div>
                  <div className="sub" style={{ marginTop: 4, fontSize: 12 }}>
                    Age: <b style={{ color: "#fff" }}>{active.age ?? "—"}</b> • Rank:{" "}
                    <b style={{ color: "#fff" }}>{active.rank ?? "—"}</b>
                  </div>

                  {/* Avatar base selector */}
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      className="btn"
                      onClick={() => commit(setAvatarBase(app, active.id, "dragon"))}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 999,
                        background: active.avatarBase === "dragon" ? "rgba(59,130,246,0.22)" : "rgba(255,255,255,0.08)",
                      }}
                      type="button"
                    >
                      🐉 Dragon
                    </button>
                    <button
                      className="btn"
                      onClick={() => commit(setAvatarBase(app, active.id, "panda"))}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 999,
                        background: active.avatarBase === "panda" ? "rgba(59,130,246,0.22)" : "rgba(255,255,255,0.08)",
                      }}
                      type="button"
                    >
                      🐼 Panda
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div className="miniStat">
                  <div className="miniLabel">Current</div>
                  <div className="miniValue">{total}</div>
                </div>
                <div className="miniStat">
                  <div className="miniLabel">Level</div>
                  <div className="miniValue">{active.level}</div>
                </div>
                <div className="miniStat">
                  <div className="miniLabel">Lifetime</div>
                  <div className="miniValue">{lifetime}</div>
                </div>
                <div className="miniStat">
                  <div className="miniLabel">Avatar</div>
                  <div className="miniValue">{avatarLvl}</div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: 6 }}>
                  <div style={{ padding: "6px 10px", borderRadius: 999, background: `${catColor.achievement}22`, color: catColor.achievement, fontWeight: 900, fontSize: 12 }}>
                    Achievement: {active?.achievementPoints ?? 0}
                  </div>
                  <div style={{ padding: "6px 10px", borderRadius: 999, background: `${catColor.leadership}22`, color: catColor.leadership, fontWeight: 900, fontSize: 12 }}>
                    Leadership: {active?.leadershipPoints ?? 0}
                  </div>
                </div>
              </div>
            </div>

            {!!app.criticalNotices?.length && (
              <div
                className="card"
                style={{
                  borderRadius: 22,
                  padding: "10px 14px",
                  border: "1px solid rgba(245,158,11,0.55)",
                  background: "linear-gradient(135deg, rgba(245,158,11,0.16), rgba(255,255,255,0.06))",
                  boxShadow: "0 0 0 2px rgba(245,158,11,0.12), 0 0 26px rgba(245,158,11,0.12)",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontWeight: 950 }}>
                  <span style={{ marginRight: 10 }}>⚡</span>
                  {app.criticalNotices[0]?.message}
                </div>
                <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.8 }}>
                  Important Announcement
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

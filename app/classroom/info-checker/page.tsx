"use client";

import { useEffect, useMemo, useState } from "react";
import AuthGate from "../../../components/AuthGate";
import AvatarRender from "../../../components/AvatarRender";

type StudentRow = {
  id: string;
  name: string;
  level: number;
  points_total: number;
  avatar_storage_path?: string | null;
  avatar_zoom_pct?: number | null;
  is_competition_team?: boolean | null;
};

type PanelKey = "skill_tree" | "badges" | "challenges";

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 180)}` } };
  }
}

export default function ClassroomInfoCheckerPage() {
  const [checked, setChecked] = useState(false);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [panel, setPanel] = useState<PanelKey>("skill_tree");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const sj = await safeJson(res);
      if (!sj.ok || sj.json?.role !== "classroom") {
        window.location.href = "/dashboard";
        return;
      }
      setChecked(true);
    })();
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await fetch("/api/students/list", { cache: "no-store" });
      const sj = await safeJson(res);
      if (!mounted) return;
      if (!sj.ok) {
        setMsg(sj.json?.error || "Failed to load students.");
        return;
      }
      const list = (sj.json?.students ?? []) as StudentRow[];
      setStudents(list);
      if (list.length && !selectedId) setSelectedId(list[0].id);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.name.toLowerCase().includes(q));
  }, [students, query]);

  const student = useMemo(() => students.find((s) => s.id === selectedId) ?? null, [students, selectedId]);
  const avatarSrc = resolveAvatarUrl(student?.avatar_storage_path ?? null);

  return (
    <AuthGate>
      <div className="info-checker">
        <style>{pageStyles()}</style>
        <div className="info-checker__surface">
          <header className="info-checker__header">
            <div>
              <div className="info-checker__title">Student Info Checker</div>
              <div className="info-checker__subtitle">Quick points lookup for classroom use.</div>
            </div>
            <div className="info-checker__search">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search student name"
                className="info-checker__input"
              />
              <div className="info-checker__list">
                {filtered.length ? (
                  filtered.slice(0, 8).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedId(s.id)}
                      className={`info-checker__result ${s.id === selectedId ? "is-active" : ""}`}
                    >
                      <span>{s.name}</span>
                      <span className="info-checker__result-meta">Lv {s.level} • {s.points_total} pts</span>
                    </button>
                  ))
                ) : (
                  <div className="info-checker__empty">No matches</div>
                )}
              </div>
            </div>
          </header>

          {checked ? (
            <div className="info-checker__layout">
              <section className="info-checker__left">
                <div className="info-checker__card">
                  <div className="info-checker__avatar">
                    <AvatarRender
                      size={210}
                      bg="rgba(10,15,25,0.9)"
                      avatarSrc={avatarSrc ?? undefined}
                      avatarZoomPct={student?.avatar_zoom_pct ?? 100}
                      showImageBorder={false}
                      fallback={<div style={{ fontWeight: 900, opacity: 0.7 }}>No Avatar</div>}
                    />
                  </div>
                  <div className="info-checker__student-name">{student?.name ?? "Select a student"}</div>
                  <div className="info-checker__stats">
                    <div>
                      <div className="info-checker__stat-label">Level</div>
                      <div className="info-checker__stat-value">{student ? student.level : "-"}</div>
                    </div>
                    <div>
                      <div className="info-checker__stat-label">Points</div>
                      <div className="info-checker__stat-value">{student ? student.points_total : "-"}</div>
                    </div>
                    <div>
                      <div className="info-checker__stat-label">Team</div>
                      <div className="info-checker__stat-value">{student?.is_competition_team ? "Competition" : "Main"}</div>
                    </div>
                  </div>
                </div>

                {msg ? <div className="info-checker__message">{msg}</div> : null}
              </section>

              <aside className="info-checker__right">
                <div className="info-checker__panel-tabs">
                  <button className={panel === "skill_tree" ? "is-active" : ""} onClick={() => setPanel("skill_tree")}>
                    Skill Tree
                  </button>
                  <button className={panel === "badges" ? "is-active" : ""} onClick={() => setPanel("badges")}>
                    Badges
                  </button>
                  <button className={panel === "challenges" ? "is-active" : ""} onClick={() => setPanel("challenges")}>
                    Challenges
                  </button>
                </div>
                <div className="info-checker__panel-body">
                  {panel === "skill_tree" ? (
                    <div>
                      <div className="info-checker__panel-title">Skill Tree</div>
                      <div className="info-checker__panel-text">Display a student-specific skill tree here.</div>
                      <div className="info-checker__panel-placeholder">Select a skill node to preview</div>
                    </div>
                  ) : null}
                  {panel === "badges" ? (
                    <div>
                      <div className="info-checker__panel-title">Badges</div>
                      <div className="info-checker__panel-text">Show earned badges and milestones.</div>
                      <div className="info-checker__panel-placeholder">Badge gallery placeholder</div>
                    </div>
                  ) : null}
                  {panel === "challenges" ? (
                    <div>
                      <div className="info-checker__panel-title">Challenges</div>
                      <div className="info-checker__panel-text">Track active and completed challenges.</div>
                      <div className="info-checker__panel-placeholder">Challenge list placeholder</div>
                    </div>
                  ) : null}
                </div>
              </aside>
            </div>
          ) : (
            <div className="info-checker__loading">Loading classroom view…</div>
          )}
        </div>
      </div>
    </AuthGate>
  );
}

function resolveAvatarUrl(storagePath?: string | null) {
  if (!storagePath) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/avatars/${storagePath}`;
}

function pageStyles() {
  return `
    .info-checker {
      min-height: 80vh;
      padding: 24px;
      display: grid;
      place-items: start center;
    }

    .info-checker__surface {
      width: min(1200px, 100%);
      display: grid;
      gap: 24px;
    }

    .info-checker__header {
      display: flex;
      gap: 20px;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
    }

    .info-checker__title {
      font-size: clamp(26px, 4vw, 36px);
      font-weight: 1000;
    }

    .info-checker__subtitle {
      opacity: 0.7;
      margin-top: 4px;
    }

    .info-checker__search {
      width: min(360px, 100%);
      position: relative;
      display: grid;
      gap: 10px;
    }

    .info-checker__input {
      width: 100%;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid rgba(148,163,184,0.3);
      background: rgba(15,23,42,0.6);
      color: white;
    }

    .info-checker__list {
      display: grid;
      gap: 6px;
      max-height: 260px;
      overflow: auto;
      padding-right: 4px;
    }

    .info-checker__result {
      text-align: left;
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid rgba(148,163,184,0.16);
      background: rgba(2,6,23,0.65);
      color: inherit;
      display: grid;
      gap: 4px;
      cursor: pointer;
    }

    .info-checker__result.is-active {
      border-color: rgba(56,189,248,0.45);
      box-shadow: 0 0 18px rgba(56,189,248,0.18);
    }

    .info-checker__result-meta {
      font-size: 12px;
      opacity: 0.7;
    }

    .info-checker__empty {
      font-size: 13px;
      opacity: 0.6;
    }

    .info-checker__layout {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
      gap: 24px;
      align-items: start;
    }

    .info-checker__left {
      display: grid;
      gap: 16px;
    }

    .info-checker__card {
      border-radius: 24px;
      padding: 24px;
      background: linear-gradient(160deg, rgba(15,23,42,0.96), rgba(2,6,23,0.9));
      border: 1px solid rgba(148,163,184,0.18);
      box-shadow: 0 18px 40px rgba(0,0,0,0.45);
      display: grid;
      gap: 18px;
      justify-items: center;
    }

    .info-checker__avatar {
      border-radius: 28px;
      padding: 14px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      box-shadow: inset 0 0 30px rgba(0,0,0,0.4);
    }

    .info-checker__student-name {
      font-size: clamp(22px, 3vw, 30px);
      font-weight: 900;
      text-align: center;
    }

    .info-checker__stats {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 12px;
      text-align: center;
    }

    .info-checker__stat-label {
      font-size: 12px;
      letter-spacing: 1px;
      text-transform: uppercase;
      opacity: 0.6;
    }

    .info-checker__stat-value {
      font-size: 20px;
      font-weight: 900;
      margin-top: 4px;
    }

    .info-checker__right {
      border-radius: 22px;
      padding: 18px;
      background: rgba(2,6,23,0.75);
      border: 1px solid rgba(148,163,184,0.2);
      display: grid;
      gap: 14px;
      min-height: 360px;
    }

    .info-checker__panel-tabs {
      display: grid;
      gap: 8px;
    }

    .info-checker__panel-tabs button {
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid rgba(148,163,184,0.2);
      background: rgba(15,23,42,0.7);
      color: inherit;
      text-align: left;
      cursor: pointer;
      font-weight: 700;
    }

    .info-checker__panel-tabs button.is-active {
      border-color: rgba(56,189,248,0.4);
      background: rgba(56,189,248,0.12);
      box-shadow: 0 0 18px rgba(56,189,248,0.15);
    }

    .info-checker__panel-body {
      display: grid;
      gap: 12px;
    }

    .info-checker__panel-title {
      font-size: 18px;
      font-weight: 900;
    }

    .info-checker__panel-text {
      opacity: 0.7;
      font-size: 13px;
    }

    .info-checker__panel-placeholder {
      margin-top: 10px;
      padding: 16px;
      border-radius: 14px;
      border: 1px dashed rgba(148,163,184,0.3);
      text-align: center;
      opacity: 0.6;
    }

    .info-checker__message {
      padding: 12px 14px;
      border-radius: 14px;
      background: rgba(239,68,68,0.15);
      border: 1px solid rgba(239,68,68,0.4);
      font-size: 13px;
    }

    .info-checker__loading {
      padding: 20px;
      opacity: 0.7;
    }

    @media (max-width: 900px) {
      .info-checker__layout {
        grid-template-columns: 1fr;
      }

      .info-checker__right {
        min-height: auto;
      }
    }

    @media (max-width: 600px) {
      .info-checker {
        padding: 18px 12px;
      }
    }
  `;
}

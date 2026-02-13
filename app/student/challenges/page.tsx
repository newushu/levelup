"use client";

import { useEffect, useMemo, useState } from "react";
import AuthGate from "@/components/AuthGate";
import StudentWorkspaceTopBar, { studentWorkspaceTopBarStyles } from "@/components/StudentWorkspaceTopBar";

type StudentRow = {
  id: string;
  name: string;
  level?: number | null;
  points_total?: number | null;
  points_balance?: number | null;
  avatar_storage_path?: string | null;
  avatar_zoom_pct?: number | null;
  is_competition_team?: boolean | null;
};

type ChallengeRow = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  tier?: string | null;
};

type StudentChallengeRow = {
  challenge_id: string;
  completed?: boolean | null;
  completed_at?: string | null;
  tier?: string | null;
};

type MedalMap = Record<string, string | null>;

const medalTierOrder = ["bronze", "silver", "gold", "platinum", "diamond", "master"];

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 180)}` } };
  }
}

export default function StudentChallengesPage() {
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [challenges, setChallenges] = useState<ChallengeRow[]>([]);
  const [studentChallenges, setStudentChallenges] = useState<StudentChallengeRow[]>([]);
  const [medalIcons, setMedalIcons] = useState<MedalMap>({});
  const [mvpBadgeUrl, setMvpBadgeUrl] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState("all");
  const [completionFilter, setCompletionFilter] = useState<"all" | "never" | "recent">("all");
  const [recentCutoff, setRecentCutoff] = useState(0);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setRecentCutoff(Date.now() - 14 * 24 * 60 * 60 * 1000);
  }, []);

  useEffect(() => {
    (async () => {
      const listRes = await fetch("/api/students/list", { cache: "no-store" });
      const listJson = await safeJson(listRes);
      if (!listJson.ok) return setMsg(listJson.json?.error || "Failed to load students");
      const list = (listJson.json?.students ?? []) as StudentRow[];
      let selectedId = "";
      try {
        selectedId = localStorage.getItem("active_student_id") || "";
      } catch {}
      const selected = list.find((s) => String(s.id) === String(selectedId));
      if (!selected) {
        setStudent(null);
        return setMsg("Please select student.");
      }
      setStudent(selected);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const [challengesRes, medalsRes, mvpBadgeRes] = await Promise.all([
        fetch("/api/challenges/list", { cache: "no-store" }),
        fetch("/api/challenges/medals", { cache: "no-store" }),
        fetch("/api/student/mvp-badge", { cache: "no-store" }),
      ]);
      const challengesJson = await safeJson(challengesRes);
      if (!challengesJson.ok) return setMsg(challengesJson.json?.error || "Failed to load challenges");
      setChallenges((challengesJson.json?.challenges ?? []) as ChallengeRow[]);

      const medalsJson = await safeJson(medalsRes);
      if (medalsJson.ok) setMedalIcons((medalsJson.json?.medals ?? {}) as MedalMap);

      const badgeJson = await safeJson(mvpBadgeRes);
      if (badgeJson.ok) setMvpBadgeUrl(String(badgeJson.json?.badge_url ?? "") || null);
    })();
  }, []);

  useEffect(() => {
    if (!student?.id) return;
    (async () => {
      const res = await fetch("/api/students/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: student.id }),
      });
      const sj = await safeJson(res);
      if (!sj.ok) return;
      setStudentChallenges((sj.json?.rows ?? []) as StudentChallengeRow[]);
    })();
  }, [student?.id]);

  const completionById = useMemo(() => {
    const map = new Map<string, { completed: boolean; completedAt: string | null }>();
    studentChallenges.forEach((row) => {
      map.set(String(row.challenge_id), { completed: Boolean(row.completed), completedAt: row.completed_at ?? null });
    });
    return map;
  }, [studentChallenges]);

  const recentUnlockSet = useMemo(() => {
    const set = new Set<string>();
    studentChallenges.forEach((row) => {
      const completedAtMs = row.completed_at ? Date.parse(String(row.completed_at)) : Number.NaN;
      if (!row.completed || Number.isNaN(completedAtMs) || completedAtMs < recentCutoff) return;
      set.add(String(row.challenge_id));
    });
    return set;
  }, [studentChallenges, recentCutoff]);

  const grouped = useMemo(() => {
    const map = new Map<string, ChallengeRow[]>();
    challenges.forEach((c) => {
      const id = String(c.id);
      const completion = completionById.get(id);
      const isComplete = Boolean(completion?.completed);
      const tier = String(c.tier ?? "").toLowerCase();
      if (tierFilter !== "all" && tier !== tierFilter) return;
      if (completionFilter === "never" && isComplete) return;
      if (completionFilter === "recent" && !recentUnlockSet.has(id)) return;
      const key = String(c.category ?? "Uncategorized");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [challenges, completionById, completionFilter, recentUnlockSet, tierFilter]);

  const medalCounts = useMemo(() => {
    const base: Record<string, number> = {};
    studentChallenges.forEach((row) => {
      if (!row.completed && row.completed !== undefined) return;
      const tier = String(row.tier ?? "").toLowerCase();
      if (!tier) return;
      base[tier] = (base[tier] ?? 0) + 1;
    });
    return base;
  }, [studentChallenges]);

  function clearSelectedStudent() {
    setStudent(null);
    try {
      localStorage.removeItem("active_student_id");
    } catch {}
  }

  return (
    <AuthGate>
      <div className="student-challenges">
        <style>{pageStyles()}</style>
        <style>{studentWorkspaceTopBarStyles()}</style>
        <div className="student-challenges__inner">
          <StudentWorkspaceTopBar student={student} onClearStudent={clearSelectedStudent} badgeUrl={mvpBadgeUrl} />

          {msg ? <div className="notice">{msg}</div> : null}

          <div className="student-challenges__layout">
            <section className="challenge-list-wrap">
              <div className="challenge-list__title">Challenge Vault</div>
              <div className="challenge-list__sub">All available challenges with your completion status.</div>
              <div className="challenge-filters">
                <button className={`chip ${completionFilter === "all" ? "chip--active" : ""}`} onClick={() => setCompletionFilter("all")}>All</button>
                <button className={`chip ${completionFilter === "never" ? "chip--active" : ""}`} onClick={() => setCompletionFilter("never")}>Never Completed</button>
                <button className={`chip ${completionFilter === "recent" ? "chip--active" : ""}`} onClick={() => setCompletionFilter("recent")}>Just Unlocked</button>
                <button className={`chip ${tierFilter === "all" ? "chip--active" : ""}`} onClick={() => setTierFilter("all")}>All Medals</button>
                {medalTierOrder.map((tier) => (
                  <button key={tier} className={`chip ${tierFilter === tier ? "chip--active" : ""}`} onClick={() => setTierFilter(tier)}>
                    {tier}
                  </button>
                ))}
              </div>
              <div className="challenge-list-scroll">
                {grouped.map(([category, rows]) => (
                  <section key={category} className="challenge-group">
                    <div className="challenge-group__title">{category}</div>
                    <div className="challenge-cards">
                      {rows.map((c) => {
                        const complete = completionById.get(String(c.id))?.completed ?? false;
                        return (
                          <article key={c.id} className={`challenge-card ${complete ? "challenge-card--done" : ""}`}>
                            <div className="challenge-card__head">
                              <div className="challenge-card__name">{c.name}</div>
                              <span className={`challenge-card__status ${complete ? "challenge-card__status--done" : ""}`}>
                                {complete ? "Done" : "Open"}
                              </span>
                            </div>
                            <div className="challenge-card__tier">{c.tier ?? "No tier"}</div>
                            {c.description ? <div className="challenge-card__desc">{c.description}</div> : null}
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </section>

            <aside className="challenge-medals">
              <div className="challenge-medals__title">Challenge Medal Tally</div>
              <div className="challenge-medals__stack">
                {medalTierOrder.map((tier) => (
                  <div key={tier} className={`medal-tile ${["gold", "platinum", "diamond", "master"].includes(tier) ? `medal-tile--sparkle medal-tile--${tier}` : ""}`}>
                    {medalIcons[tier] ? <img src={String(medalIcons[tier])} alt={tier} /> : <span>{tier.slice(0, 1).toUpperCase()}</span>}
                    <div className="medal-count">{medalCounts[tier] ?? 0}</div>
                    <div className="medal-label">{tier}</div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </AuthGate>
  );
}

function pageStyles() {
  return `
    .student-challenges {
      min-height: 80vh;
      padding: 20px 20px 54px 252px;
      display: flex;
      width: 100%;
    }
    .student-challenges__inner {
      width: 100%;
      display: grid;
      gap: 16px;
    }
    .notice {
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid rgba(239,68,68,0.3);
      background: rgba(239,68,68,0.12);
      color: white;
      font-weight: 900;
      font-size: 12px;
    }
    .student-challenges__layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 190px;
      gap: 14px;
      align-items: start;
    }
    .challenge-list-wrap {
      border-radius: 18px;
      background: linear-gradient(160deg, rgba(12,18,32,0.94), rgba(3,9,20,0.94));
      border: 1px solid rgba(148,163,184,0.2);
      padding: 14px;
      display: grid;
      gap: 8px;
    }
    .challenge-list__title {
      font-size: 24px;
      font-weight: 1000;
      letter-spacing: 0.3px;
    }
    .challenge-list__sub {
      opacity: 0.75;
      font-size: 13px;
    }
    .challenge-filters {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      padding: 6px 0 2px;
    }
    .chip {
      border: 1px solid rgba(148,163,184,0.32);
      background: rgba(30,41,59,0.7);
      color: white;
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      cursor: pointer;
    }
    .chip--active {
      border-color: rgba(56,189,248,0.6);
      background: rgba(56,189,248,0.24);
      box-shadow: 0 0 14px rgba(56,189,248,0.25);
    }
    .challenge-list-scroll {
      margin-top: 4px;
      max-height: calc(100vh - 295px);
      overflow: auto;
      padding-right: 6px;
      display: grid;
      gap: 14px;
    }
    .challenge-group {
      display: grid;
      gap: 8px;
    }
    .challenge-group__title {
      font-weight: 1000;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      opacity: 0.8;
      font-size: 12px;
    }
    .challenge-cards {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
    }
    .challenge-card {
      padding: 11px 12px;
      border-radius: 13px;
      border: 1px solid rgba(148,163,184,0.2);
      background: rgba(15,23,42,0.78);
      display: grid;
      gap: 5px;
    }
    .challenge-card--done {
      border-color: rgba(34,197,94,0.45);
      background: linear-gradient(155deg, rgba(20,83,45,0.55), rgba(15,23,42,0.85));
    }
    .challenge-card__head {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      align-items: center;
    }
    .challenge-card__name {
      font-size: 14px;
      font-weight: 900;
    }
    .challenge-card__status {
      border-radius: 999px;
      padding: 3px 8px;
      font-size: 10px;
      font-weight: 1000;
      text-transform: uppercase;
      border: 1px solid rgba(239,68,68,0.5);
      background: rgba(239,68,68,0.2);
      color: #fecaca;
    }
    .challenge-card__status--done {
      border-color: rgba(34,197,94,0.5);
      background: rgba(34,197,94,0.2);
      color: #bbf7d0;
    }
    .challenge-card__tier {
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.6px;
      opacity: 0.75;
      font-weight: 900;
    }
    .challenge-card__desc {
      opacity: 0.75;
      font-size: 12px;
    }
    .challenge-medals {
      border-radius: 18px;
      border: 1px solid rgba(148,163,184,0.2);
      background: rgba(12,18,32,0.9);
      padding: 12px;
      display: grid;
      gap: 10px;
      align-content: start;
      height: calc(100vh - 210px);
      position: sticky;
      top: 24px;
    }
    .challenge-medals__title {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      font-weight: 1000;
      opacity: 0.8;
      text-align: center;
    }
    .challenge-medals__stack {
      display: grid;
      gap: 8px;
      justify-items: center;
      overflow: auto;
      padding-right: 4px;
    }
    .medal-tile {
      width: 120px;
      padding: 8px;
      border-radius: 14px;
      border: 1px solid rgba(148,163,184,0.2);
      background: rgba(15,23,42,0.8);
      display: grid;
      place-items: center;
      gap: 4px;
      position: relative;
      overflow: hidden;
      transition: transform 180ms ease, box-shadow 180ms ease;
    }
    .medal-tile:hover {
      transform: translateY(-2px);
    }
    .medal-tile img {
      width: 45px;
      height: 45px;
      object-fit: contain;
    }
    .medal-count {
      font-size: 20px;
      font-weight: 1000;
      line-height: 1;
    }
    .medal-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      opacity: 0.8;
      font-weight: 900;
    }
    .medal-tile--sparkle::before {
      content: "";
      position: absolute;
      width: 140%;
      height: 140%;
      top: -20%;
      left: -20%;
      background: radial-gradient(circle, rgba(255,255,255,0.35), rgba(255,255,255,0));
      opacity: 0.4;
      animation: medalSparkle 3s ease-in-out infinite;
      pointer-events: none;
    }
    .medal-tile--gold {
      box-shadow: 0 0 20px rgba(250,204,21,0.35);
      border-color: rgba(250,204,21,0.55);
    }
    .medal-tile--platinum {
      box-shadow: 0 0 22px rgba(226,232,240,0.45), inset 0 0 0 1px rgba(226,232,240,0.25);
      border-color: rgba(203,213,225,0.65);
    }
    .medal-tile--diamond {
      box-shadow: 0 0 24px rgba(56,189,248,0.55), 0 0 36px rgba(56,189,248,0.25);
      border-color: rgba(56,189,248,0.62);
    }
    .medal-tile--master {
      box-shadow: 0 0 26px rgba(244,114,182,0.6), 0 0 50px rgba(190,24,93,0.32);
      border-color: rgba(244,114,182,0.72);
      background: radial-gradient(circle at 22% 18%, rgba(244,114,182,0.25), rgba(15,23,42,0.85));
    }
    @media (max-width: 1100px) {
      .student-challenges {
        padding: 16px 10px 36px;
      }
      .student-challenges__layout {
        grid-template-columns: 1fr;
      }
      .challenge-medals {
        height: auto;
        position: static;
      }
      .challenge-medals__stack {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .medal-tile {
        width: 100%;
      }
      .challenge-list-scroll {
        max-height: none;
      }
    }
    @media (max-width: 700px) {
      .challenge-medals__stack {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @keyframes medalSparkle {
      0% { transform: scale(0.8) rotate(0deg); opacity: 0.2; }
      50% { transform: scale(1.08) rotate(30deg); opacity: 0.5; }
      100% { transform: scale(0.8) rotate(0deg); opacity: 0.2; }
    }
  `;
}

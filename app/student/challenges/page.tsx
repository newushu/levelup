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
  points_awarded?: number | null;
  limit_mode?: string | null;
  limit_count?: number | null;
  limit_window_days?: number | null;
};

type StudentChallengeRow = {
  challenge_id: string;
  completed?: boolean | null;
  completed_at?: string | null;
  tier?: string | null;
};

type MedalMap = Record<string, string | null>;
type CompletionRow = {
  challenge_id: string;
  completed_at: string | null;
  tier?: string | null;
  points_awarded?: number | null;
};

const medalTierOrder = ["bronze", "silver", "gold", "platinum", "diamond", "master"];

function windowDaysFor(row: ChallengeRow) {
  const mode = String(row.limit_mode ?? "once").toLowerCase();
  if (mode === "daily") return 1;
  if (mode === "weekly") return 7;
  if (mode === "monthly") return 30;
  if (mode === "yearly") return 365;
  if (mode === "custom") return Math.max(0, Number(row.limit_window_days ?? 0));
  return null;
}

function countInWindow(row: ChallengeRow, completions: string[], nowMs: number) {
  const mode = String(row.limit_mode ?? "once").toLowerCase();
  if (mode === "once" || mode === "lifetime") return completions.length;
  const days = windowDaysFor(row);
  if (!days) return completions.length;
  const windowStart = nowMs - days * 24 * 60 * 60 * 1000;
  return completions.filter((ts) => new Date(ts).getTime() >= windowStart).length;
}

function nextAvailableDateFromCompletions(row: ChallengeRow, completions: string[], nowMs: number) {
  const days = windowDaysFor(row);
  if (!days) return null;
  const windowStart = nowMs - days * 24 * 60 * 60 * 1000;
  const inWindow = completions
    .map((ts) => new Date(ts).getTime())
    .filter((t) => Number.isFinite(t) && t >= windowStart)
    .sort((a, b) => a - b);
  if (!inWindow.length) return null;
  return new Date(inWindow[0] + days * 24 * 60 * 60 * 1000);
}

function unlockedDateFromLatestCompletion(row: ChallengeRow, completions: string[]) {
  const days = windowDaysFor(row);
  if (!days || !completions.length) return null;
  const sorted = completions
    .map((ts) => new Date(ts).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => b - a);
  if (!sorted.length) return null;
  return new Date(sorted[0] + days * 24 * 60 * 60 * 1000);
}

function formatLimit(row: ChallengeRow) {
  const mode = String(row.limit_mode ?? "once").toLowerCase();
  const count = Math.max(1, Number(row.limit_count ?? 1));
  if (mode === "once") return "Limit: 1 time";
  if (mode === "daily") return `Limit: ${count} / day`;
  if (mode === "weekly") return `Limit: ${count} / week`;
  if (mode === "monthly") return `Limit: ${count} / month`;
  if (mode === "yearly") return `Limit: ${count} / year`;
  if (mode === "lifetime") return `Limit: ${count} lifetime`;
  if (mode === "custom") {
    const days = Math.max(0, Number(row.limit_window_days ?? 0));
    return days ? `Limit: ${count} / ${days} days` : `Limit: ${count} / custom window`;
  }
  return `Limit: ${count}`;
}

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 180)}` } };
  }
}

export default function StudentChallengesPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [studentQuery, setStudentQuery] = useState("");
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [challenges, setChallenges] = useState<ChallengeRow[]>([]);
  const [studentChallenges, setStudentChallenges] = useState<StudentChallengeRow[]>([]);
  const [medalIcons, setMedalIcons] = useState<MedalMap>({});
  const [completionMap, setCompletionMap] = useState<Record<string, string[]>>({});
  const [completionRows, setCompletionRows] = useState<CompletionRow[]>([]);
  const [recentMvp, setRecentMvp] = useState(false);
  const [now] = useState(() => Date.now());
  const [tierFilter, setTierFilter] = useState("all");
  const [completionFilter, setCompletionFilter] = useState<"all" | "never" | "recent">("all");
  const [recentCutoff, setRecentCutoff] = useState(0);
  const [msg, setMsg] = useState("");
  const [detailOpen, setDetailOpen] = useState<{
    challengeId: string;
    name: string;
    description: string;
    tier: string;
    medalUrl: string | null;
    status: "open" | "closed" | "locked";
    limit: string;
    totalCompletions: number;
    inWindow: number;
    remainingInWindow: number;
    lastCompletedAt: string | null;
    lastPoints: number;
    defaultPoints: number;
    nextUnlockAt: string | null;
  } | null>(null);

  useEffect(() => {
    setRecentCutoff(Date.now() - 14 * 24 * 60 * 60 * 1000);
  }, []);

  useEffect(() => {
    (async () => {
      const listRes = await fetch("/api/students/list", { cache: "no-store" });
      const listJson = await safeJson(listRes);
      if (!listJson.ok) return setMsg(listJson.json?.error || "Failed to load students");
      const list = (listJson.json?.students ?? []) as StudentRow[];
      setStudents(list);
      let selectedId = "";
      try {
        selectedId = localStorage.getItem("active_student_id") || "";
      } catch {}
      const selected = list.find((s) => String(s.id) === String(selectedId));
      if (!selected) {
        setStudent(null);
        setStudentQuery("");
        return setMsg("Please select student.");
      }
      setStudent(selected);
      setStudentQuery(selected.name);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const [challengesRes, medalsRes] = await Promise.all([
        fetch("/api/challenges/list", { cache: "no-store" }),
        fetch("/api/challenges/medals", { cache: "no-store" }),
      ]);
      const challengesJson = await safeJson(challengesRes);
      if (!challengesJson.ok) return setMsg(challengesJson.json?.error || "Failed to load challenges");
      setChallenges((challengesJson.json?.challenges ?? []) as ChallengeRow[]);

      const medalsJson = await safeJson(medalsRes);
      if (medalsJson.ok) setMedalIcons((medalsJson.json?.medals ?? {}) as MedalMap);
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
      const allCompletions = (sj.json?.completions ?? []) as CompletionRow[];
      setCompletionRows(allCompletions);
      const map: Record<string, string[]> = {};
      allCompletions.forEach((row) => {
        const key = String(row.challenge_id ?? "");
        const ts = row.completed_at ? String(row.completed_at) : "";
        if (!key || !ts) return;
        if (!map[key]) map[key] = [];
        map[key].push(ts);
      });
      setCompletionMap(map);
    })();
  }, [student?.id]);

  useEffect(() => {
    if (!student?.id) {
      setRecentMvp(false);
      return;
    }
    (async () => {
      const start = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      const res = await fetch("/api/mvp/count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: student.id, start_date: start }),
      });
      const sj = await safeJson(res);
      if (!sj.ok) return setRecentMvp(false);
      setRecentMvp(Number(sj.json?.count ?? 0) > 0);
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
    completionRows.forEach((row) => {
      const tier = String(row.tier ?? "").toLowerCase().trim();
      if (!tier) return;
      base[tier] = (base[tier] ?? 0) + 1;
    });
    return base;
  }, [completionRows]);

  const completionLog = useMemo(() => {
    const byId = new Map(challenges.map((c) => [String(c.id), c]));
    const rows: Array<{ id: string; name: string; tier: string; completedAt: string; points: number }> = [];
    completionRows.forEach((row, idx) => {
      const challengeId = String(row.challenge_id ?? "");
      const challenge = byId.get(challengeId);
      if (!challenge || !row.completed_at) return;
      rows.push({
        id: `${challengeId}-${idx}-${row.completed_at}`,
        name: challenge.name ?? "Challenge",
        tier: String(row.tier ?? challenge.tier ?? "none").toLowerCase(),
        completedAt: String(row.completed_at),
        points: Math.max(0, Number(row.points_awarded ?? challenge.points_awarded ?? 0)),
      });
    });
    rows.sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
    return rows;
  }, [completionRows, challenges]);

  function clearSelectedStudent() {
    setStudent(null);
    setStudentQuery("");
    setMsg("Please select student.");
    try {
      localStorage.removeItem("active_student_id");
    } catch {}
  }

  function selectStudentByName(name: string) {
    const match = students.find((s) => String(s.name ?? "").toLowerCase() === String(name ?? "").trim().toLowerCase());
    if (!match) {
      setMsg("Please select student.");
      return;
    }
    setStudent(match);
    setStudentQuery(match.name);
    setMsg("");
    try {
      localStorage.setItem("active_student_id", String(match.id));
    } catch {}
  }

  return (
    <AuthGate>
      <div className="student-challenges">
        <style>{pageStyles()}</style>
        <style>{studentWorkspaceTopBarStyles()}</style>
        <div className="student-challenges__inner">
          <StudentWorkspaceTopBar
            student={student}
            onClearStudent={clearSelectedStudent}
            onSelectStudentByName={selectStudentByName}
            students={students}
            onSelectStudent={() => selectStudentByName(studentQuery)}
            recentMvp={recentMvp}
          />

          {msg ? <div className="notice">{msg}</div> : null}

          <div className="student-challenges__layout">
            <section className="challenge-list-wrap">
              <div className="challenge-list__title">Challenge Vault</div>
              <div className="challenge-list__sub">All available challenges with your completion status.</div>
              <div className="challenge-filters">
                <div className="challenge-filters__row">
                  <button className={`chip ${tierFilter === "all" ? "chip--active" : ""}`} onClick={() => setTierFilter("all")}>All Medals</button>
                  {medalTierOrder.map((tier) => (
                    <button key={tier} className={`chip ${tierFilter === tier ? "chip--active" : ""}`} onClick={() => setTierFilter(tier)}>
                      {tier}
                    </button>
                  ))}
                </div>
                <div className="challenge-filters__row">
                  <button className={`chip ${completionFilter === "all" ? "chip--active" : ""}`} onClick={() => setCompletionFilter("all")}>All</button>
                  <button className={`chip ${completionFilter === "never" ? "chip--active" : ""}`} onClick={() => setCompletionFilter("never")}>Never Completed</button>
                  <button className={`chip ${completionFilter === "recent" ? "chip--active" : ""}`} onClick={() => setCompletionFilter("recent")}>Just Unlocked</button>
                </div>
              </div>

              <div className="challenge-list-scroll">
                {grouped.map(([category, rows]) => (
                  <section key={category} className="challenge-group">
                    <div className="challenge-group__title">{category}</div>
                    <div className="challenge-cards">
                      {rows.map((c) => {
                        const complete = completionById.get(String(c.id))?.completed ?? false;
                        const tierKey = String(c.tier ?? "").toLowerCase();
                        const medalUrl = medalIcons[tierKey] ?? null;
                        const medalGlow = ["gold", "platinum", "diamond", "master"].includes(tierKey);
                        const completions = completionMap[String(c.id)] ?? [];
                        const completionHistory = completionRows
                          .filter((row) => String(row.challenge_id) === String(c.id) && !!row.completed_at)
                          .sort((a, b) => Date.parse(String(b.completed_at)) - Date.parse(String(a.completed_at)));
                        const isRepeatable = String(c.limit_mode ?? "once").toLowerCase() !== "once";
                        const inWindowCount = countInWindow(c, completions, now);
                        const remaining = Math.max(0, Math.max(1, Number(c.limit_count ?? 1)) - inWindowCount);
                        const blocked = remaining <= 0;
                        const availableAt = blocked ? nextAvailableDateFromCompletions(c, completions, now) : null;
                        const unlockedAt = !blocked && isRepeatable ? unlockedDateFromLatestCompletion(c, completions) : null;
                        const showDone = complete && (!isRepeatable || blocked);
                        const status: "open" | "closed" | "locked" = blocked
                          ? "locked"
                          : showDone && !isRepeatable
                            ? "closed"
                            : "open";
                        const lastCompletion = completionHistory[0] ?? null;
                        const lastPoints = Math.max(0, Number(lastCompletion?.points_awarded ?? c.points_awarded ?? 0));
                        const defaultPoints = Math.max(0, Number(c.points_awarded ?? 0));
                        return (
                          <article
                            key={c.id}
                            className={`challenge-card ${showDone ? "challenge-card--done" : ""}`}
                            role="button"
                            tabIndex={0}
                            onClick={() =>
                              setDetailOpen({
                                challengeId: String(c.id),
                                name: String(c.name ?? "Challenge"),
                                description: String(c.description ?? "No extra details available."),
                                tier: tierKey || "none",
                                medalUrl,
                                status,
                                limit: formatLimit(c),
                                totalCompletions: completionHistory.length,
                                inWindow: inWindowCount,
                                remainingInWindow: remaining,
                                lastCompletedAt: lastCompletion?.completed_at ? String(lastCompletion.completed_at) : null,
                                lastPoints,
                                defaultPoints,
                                nextUnlockAt: availableAt ? availableAt.toISOString() : null,
                              })
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setDetailOpen({
                                  challengeId: String(c.id),
                                  name: String(c.name ?? "Challenge"),
                                  description: String(c.description ?? "No extra details available."),
                                  tier: tierKey || "none",
                                  medalUrl,
                                  status,
                                  limit: formatLimit(c),
                                  totalCompletions: completionHistory.length,
                                  inWindow: inWindowCount,
                                  remainingInWindow: remaining,
                                  lastCompletedAt: lastCompletion?.completed_at ? String(lastCompletion.completed_at) : null,
                                  lastPoints,
                                  defaultPoints,
                                  nextUnlockAt: availableAt ? availableAt.toISOString() : null,
                                });
                              }
                            }}
                            aria-label={`Open challenge details for ${c.name}`}
                          >
                            {blocked && availableAt ? (
                              <div className="challenge-card__unlock-overlay">
                                <div className="challenge-card__unlock-label">Unlocks On</div>
                                <div className="challenge-card__unlock-date">{availableAt.toLocaleDateString()}</div>
                              </div>
                            ) : null}
                            <div className="challenge-card__head">
                              <div className="challenge-card__name">{c.name}</div>
                              <span className={`challenge-card__status ${showDone ? "challenge-card__status--done" : ""}`}>
                                {showDone ? "Done" : "Open"}
                              </span>
                            </div>
                            <div className={`challenge-card__medal ${medalGlow ? `challenge-card__medal--glow challenge-card__medal--${tierKey}` : ""}`}>
                              {medalUrl ? <img src={String(medalUrl)} alt={`${c.tier ?? "tier"} medal`} /> : <span>{(c.tier ?? "tier").toString().slice(0, 1)}</span>}
                            </div>
                            <div className="challenge-card__tier">{c.tier ?? "No tier"}</div>
                            <div className="challenge-card__limit">{formatLimit(c)}</div>
                            {isRepeatable && availableAt ? <div className="challenge-card__unlock">Unlocks: {availableAt.toLocaleDateString()}</div> : null}
                            {isRepeatable && !availableAt && unlockedAt ? <div className="challenge-card__unlock">Unlocked: {unlockedAt.toLocaleDateString()}</div> : null}
                            {c.description ? <div className="challenge-card__desc">{c.description}</div> : null}
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </section>

            <aside className="challenge-side">
              <section className="challenge-side__panel">
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
              </section>

              <section className="challenge-side__panel">
                <div className="challenge-medals__title">Completed Log</div>
                <div className="challenge-log">
                  {completionLog.map((row) => (
                    <div key={row.id} className="challenge-log__row">
                      <div className="challenge-log__main">
                        <div className={`challenge-log__medal ${["gold", "platinum", "diamond", "master"].includes(row.tier) ? `challenge-log__medal--glow challenge-log__medal--${row.tier}` : ""}`}>
                          {medalIcons[row.tier] ? <img src={String(medalIcons[row.tier])} alt={row.tier} /> : <span>{row.tier.slice(0, 1).toUpperCase()}</span>}
                        </div>
                        <div className="challenge-log__name">{row.name}</div>
                      </div>
                      <div className="challenge-log__meta">+{row.points} pts</div>
                    </div>
                  ))}
                  {!completionLog.length ? <div className="challenge-log__empty">No completions yet.</div> : null}
                </div>
              </section>
            </aside>
          </div>
        </div>
        {detailOpen ? (
          <div className="challenge-detail-overlay" onClick={() => setDetailOpen(null)}>
            <div className="challenge-detail-bubble" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <button className="challenge-detail-close" onClick={() => setDetailOpen(null)} aria-label="Close details">
                ×
              </button>
              <div className="challenge-detail-head">
                <div className={`challenge-detail-medal ${["gold", "platinum", "diamond", "master"].includes(detailOpen.tier) ? `challenge-detail-medal--${detailOpen.tier}` : ""}`}>
                  {detailOpen.medalUrl ? <img src={detailOpen.medalUrl} alt={`${detailOpen.tier} medal`} /> : <span>{detailOpen.tier.slice(0, 1).toUpperCase()}</span>}
                </div>
                <div>
                  <div className="challenge-detail-title">{detailOpen.name}</div>
                  <div className={`challenge-detail-status challenge-detail-status--${detailOpen.status}`}>{detailOpen.status}</div>
                </div>
              </div>
              <div className="challenge-detail-grid">
                <div className="challenge-detail-line"><span>Tier</span><strong>{detailOpen.tier}</strong></div>
                <div className="challenge-detail-line"><span>Limit</span><strong>{detailOpen.limit}</strong></div>
                <div className="challenge-detail-line"><span>Total Completed</span><strong>{detailOpen.totalCompletions}</strong></div>
                <div className="challenge-detail-line"><span>In Current Window</span><strong>{detailOpen.inWindow}</strong></div>
                <div className="challenge-detail-line"><span>Remaining Now</span><strong>{detailOpen.remainingInWindow}</strong></div>
                <div className="challenge-detail-line"><span>Last Points</span><strong>+{detailOpen.lastPoints} pts</strong></div>
                <div className="challenge-detail-line"><span>Base Points</span><strong>+{detailOpen.defaultPoints} pts</strong></div>
                <div className="challenge-detail-line">
                  <span>Last Done</span>
                  <strong>{detailOpen.lastCompletedAt ? new Date(detailOpen.lastCompletedAt).toLocaleString() : "Never"}</strong>
                </div>
                <div className="challenge-detail-line">
                  <span>Next Unlock</span>
                  <strong>{detailOpen.nextUnlockAt ? new Date(detailOpen.nextUnlockAt).toLocaleDateString() : "Ready now"}</strong>
                </div>
              </div>
              <div className="challenge-detail-desc">{detailOpen.description}</div>
            </div>
          </div>
        ) : null}
      </div>
    </AuthGate>
  );
}

function pageStyles() {
  return `
    .student-challenges {
      min-height: 80vh;
      padding: 20px 4px 54px 70px;
      display: flex;
      width: 100%;
      box-sizing: border-box;
    }
    .student-challenges__inner {
      width: 100%;
      max-width: none;
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
      grid-template-columns: minmax(0, 3.1fr) minmax(360px, 0.86fr);
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
      display: grid;
      gap: 8px;
      padding: 6px 0 2px;
    }
    .challenge-filters__row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
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
      grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
      gap: 8px;
    }
    .challenge-card {
      position: relative;
      overflow: hidden;
      padding: 11px 12px;
      border-radius: 13px;
      border: 1px solid rgba(148,163,184,0.2);
      background: rgba(15,23,42,0.78);
      display: grid;
      gap: 5px;
      cursor: pointer;
      transition: transform 140ms ease, border-color 160ms ease, box-shadow 160ms ease;
    }
    .challenge-card:hover {
      transform: translateY(-1px);
      border-color: rgba(56,189,248,0.45);
      box-shadow: 0 10px 22px rgba(0,0,0,0.3);
    }
    .challenge-card:focus-visible {
      outline: 2px solid rgba(56,189,248,0.72);
      outline-offset: 2px;
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
    .challenge-card__limit {
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.55px;
      opacity: 0.78;
      font-weight: 900;
      color: #cbd5e1;
    }
    .challenge-card__unlock {
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: #bae6fd;
      opacity: 0.92;
    }
    .challenge-card__unlock-overlay {
      position: absolute;
      inset: 0;
      z-index: 3;
      background: rgba(2,6,23,0.76);
      backdrop-filter: blur(1px);
      display: grid;
      gap: 4px;
      place-content: center;
      text-align: center;
      border-radius: 12px;
      border: 1px solid rgba(34,197,94,0.45);
      box-shadow: inset 0 0 0 1px rgba(34,197,94,0.22);
    }
    .challenge-card__unlock-label {
      font-size: 11px;
      font-weight: 1000;
      letter-spacing: 0.7px;
      text-transform: uppercase;
      color: #dcfce7;
    }
    .challenge-card__unlock-date {
      font-size: 18px;
      font-weight: 1000;
      color: #bbf7d0;
      text-shadow: 0 0 10px rgba(34,197,94,0.55);
    }
    .challenge-card__medal {
      width: 58px;
      height: 58px;
      border-radius: 14px;
      border: 1px solid rgba(148,163,184,0.32);
      background: rgba(30,41,59,0.8);
      display: grid;
      place-items: center;
      margin-top: 2px;
    }
    .challenge-card__medal img {
      width: 42px;
      height: 42px;
      object-fit: contain;
    }
    .challenge-card__medal--glow {
      box-shadow: 0 0 18px rgba(250,204,21,0.45);
      border-color: rgba(250,204,21,0.65);
    }
    .challenge-card__medal--gold {
      box-shadow: 0 0 20px rgba(250,204,21,0.35);
      border-color: rgba(250,204,21,0.55);
    }
    .challenge-card__medal--platinum {
      box-shadow: 0 0 22px rgba(226,232,240,0.45), inset 0 0 0 1px rgba(226,232,240,0.25);
      border-color: rgba(203,213,225,0.65);
    }
    .challenge-card__medal--diamond {
      box-shadow: 0 0 24px rgba(56,189,248,0.55), 0 0 36px rgba(56,189,248,0.25);
      border-color: rgba(56,189,248,0.62);
    }
    .challenge-card__medal--master {
      box-shadow: 0 0 26px rgba(244,114,182,0.6), 0 0 50px rgba(190,24,93,0.32);
      border-color: rgba(244,114,182,0.72);
      background: radial-gradient(circle at 22% 18%, rgba(244,114,182,0.25), rgba(15,23,42,0.85));
    }
    .challenge-card__desc {
      opacity: 0.75;
      font-size: 12px;
    }
    .challenge-side {
      border-radius: 18px;
      border: 1px solid rgba(148,163,184,0.2);
      background: rgba(12,18,32,0.9);
      padding: 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 0;
      align-content: start;
      height: calc(100vh - 210px);
      position: sticky;
      top: 24px;
      min-width: 0;
    }
    .challenge-side__panel {
      border-radius: 12px;
      border: 1px solid rgba(148,163,184,0.22);
      background: rgba(2,6,23,0.35);
      padding: 8px;
      display: grid;
      gap: 8px;
      min-height: 0;
      overflow: hidden;
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
      padding-right: 0;
      max-height: 100%;
      min-height: 0;
    }
    .challenge-log {
      margin-top: 2px;
      border-radius: 12px;
      border: 1px solid rgba(148,163,184,0.24);
      background: rgba(15,23,42,0.64);
      max-height: 100%;
      overflow: auto;
      padding: 8px;
      display: grid;
      gap: 6px;
      min-height: 0;
    }
    .challenge-log__row {
      border-radius: 10px;
      border: 1px solid rgba(148,163,184,0.2);
      background: rgba(2,6,23,0.7);
      padding: 7px 8px;
      display: grid;
      gap: 5px;
    }
    .challenge-log__main {
      display: grid;
      grid-template-columns: 30px minmax(0, 1fr);
      gap: 8px;
      align-items: center;
    }
    .challenge-log__medal {
      width: 30px;
      height: 30px;
      border-radius: 9px;
      border: 1px solid rgba(148,163,184,0.26);
      background: rgba(15,23,42,0.72);
      display: grid;
      place-items: center;
    }
    .challenge-log__medal img {
      width: 22px;
      height: 22px;
      object-fit: contain;
    }
    .challenge-log__medal--glow {
      box-shadow: 0 0 14px rgba(250,204,21,0.36);
      border-color: rgba(250,204,21,0.56);
    }
    .challenge-log__medal--platinum {
      box-shadow: 0 0 14px rgba(226,232,240,0.4);
      border-color: rgba(226,232,240,0.65);
    }
    .challenge-log__medal--diamond {
      box-shadow: 0 0 16px rgba(56,189,248,0.5);
      border-color: rgba(56,189,248,0.62);
    }
    .challenge-log__medal--master {
      box-shadow: 0 0 18px rgba(244,114,182,0.54);
      border-color: rgba(244,114,182,0.66);
    }
    .challenge-log__name {
      font-size: 12px;
      font-weight: 900;
      color: #e2e8f0;
      line-height: 1.2;
    }
    .challenge-log__meta {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #86efac;
      font-weight: 900;
    }
    .challenge-log__empty {
      font-size: 11px;
      opacity: 0.7;
      padding: 8px 6px;
      text-align: center;
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
    .challenge-detail-overlay {
      position: fixed;
      inset: 0;
      z-index: 200;
      background: rgba(2,6,23,0.7);
      backdrop-filter: blur(3px);
      display: grid;
      place-items: center;
      padding: 18px;
    }
    .challenge-detail-bubble {
      width: min(760px, 94vw);
      border-radius: 16px;
      border: 1px solid rgba(148,163,184,0.28);
      background: linear-gradient(155deg, rgba(15,23,42,0.98), rgba(2,6,23,0.95));
      padding: 14px;
      position: relative;
      display: grid;
      gap: 10px;
      box-shadow: 0 24px 44px rgba(0,0,0,0.52);
    }
    .challenge-detail-close {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 30px;
      height: 30px;
      border-radius: 999px;
      border: 1px solid rgba(148,163,184,0.32);
      background: rgba(30,41,59,0.72);
      color: #e2e8f0;
      font-size: 20px;
      line-height: 1;
      cursor: pointer;
    }
    .challenge-detail-head {
      display: grid;
      grid-template-columns: 62px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
      padding-right: 28px;
    }
    .challenge-detail-medal {
      width: 62px;
      height: 62px;
      border-radius: 14px;
      border: 1px solid rgba(148,163,184,0.36);
      background: rgba(15,23,42,0.72);
      display: grid;
      place-items: center;
    }
    .challenge-detail-medal img {
      width: 48px;
      height: 48px;
      object-fit: contain;
    }
    .challenge-detail-medal--gold {
      box-shadow: 0 0 20px rgba(250,204,21,0.35);
      border-color: rgba(250,204,21,0.55);
    }
    .challenge-detail-medal--platinum {
      box-shadow: 0 0 20px rgba(226,232,240,0.45);
      border-color: rgba(203,213,225,0.65);
    }
    .challenge-detail-medal--diamond {
      box-shadow: 0 0 22px rgba(56,189,248,0.5);
      border-color: rgba(56,189,248,0.62);
    }
    .challenge-detail-medal--master {
      box-shadow: 0 0 24px rgba(244,114,182,0.52);
      border-color: rgba(244,114,182,0.66);
    }
    .challenge-detail-title {
      font-size: 24px;
      font-weight: 1000;
      line-height: 1.1;
    }
    .challenge-detail-status {
      margin-top: 4px;
      display: inline-flex;
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 1000;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      border: 1px solid rgba(148,163,184,0.35);
    }
    .challenge-detail-status--open {
      background: rgba(59,130,246,0.2);
      border-color: rgba(59,130,246,0.45);
      color: #bfdbfe;
    }
    .challenge-detail-status--closed {
      background: rgba(34,197,94,0.2);
      border-color: rgba(34,197,94,0.5);
      color: #bbf7d0;
    }
    .challenge-detail-status--locked {
      background: rgba(239,68,68,0.2);
      border-color: rgba(239,68,68,0.5);
      color: #fecaca;
    }
    .challenge-detail-grid {
      border-radius: 12px;
      border: 1px solid rgba(148,163,184,0.22);
      background: rgba(15,23,42,0.6);
      padding: 10px;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px 10px;
    }
    .challenge-detail-line {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      font-size: 12px;
      border-bottom: 1px solid rgba(148,163,184,0.16);
      padding-bottom: 4px;
    }
    .challenge-detail-line span {
      color: #94a3b8;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.45px;
    }
    .challenge-detail-line strong {
      color: #e2e8f0;
      font-weight: 900;
      text-align: right;
    }
    .challenge-detail-desc {
      font-size: 13px;
      line-height: 1.35;
      color: #cbd5e1;
      border-radius: 10px;
      border: 1px solid rgba(148,163,184,0.16);
      background: rgba(2,6,23,0.48);
      padding: 9px 10px;
    }

    @media (max-width: 1100px) {
      .student-challenges {
        padding: 16px 10px 110px;
      }
      .student-challenges__inner {
        width: 100%;
      }
      .student-challenges__layout {
        grid-template-columns: 1fr;
      }
      .challenge-side {
        height: auto;
        position: static;
        grid-template-columns: 1fr;
      }
      .challenge-medals__stack {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        max-height: none;
      }
      .medal-tile {
        width: 100%;
      }
      .challenge-list-scroll {
        max-height: none;
      }
      .challenge-log {
        max-height: none;
      }
    }

    @media (max-width: 700px) {
      .challenge-cards {
        grid-template-columns: 1fr;
      }
      .challenge-medals__stack {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .challenge-detail-grid {
        grid-template-columns: 1fr;
      }
    }

    @keyframes medalSparkle {
      0% { transform: scale(0.8) rotate(0deg); opacity: 0.2; }
      50% { transform: scale(1.08) rotate(30deg); opacity: 0.5; }
      100% { transform: scale(0.8) rotate(0deg); opacity: 0.2; }
    }
  `;
}

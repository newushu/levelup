"use client";

import { useEffect, useMemo, useState } from "react";
import { fireFx } from "@/components/GlobalFx";
import AvatarRender from "@/components/AvatarRender";
import { playGlobalSfx } from "@/lib/globalAudio";

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
  daily_limit_count?: number | null;
  enabled?: boolean | null;
};

type StudentChallenge = {
  challenge_id: string;
  completed?: boolean | null;
  completed_at?: string | null;
};

type Props = {
  studentId?: string | null;
  title?: string;
  requireStudent?: boolean;
  allowManage?: boolean;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 180)}` } };
  }
}

function formatLimit(row: ChallengeRow) {
  const mode = String(row.limit_mode ?? "once");
  const count = Number(row.limit_count ?? 1);
  const dailyCap = Math.max(0, Number(row.daily_limit_count ?? 0));
  const withDaily = (txt: string) => (dailyCap > 0 && mode !== "daily" ? `${txt} (max ${dailyCap}/day)` : txt);
  if (mode === "once") return withDaily("Limit: 1 time");
  if (mode === "daily") return `Limit: ${count} / day`;
  if (mode === "weekly") return withDaily(`Limit: ${count} / week`);
  if (mode === "monthly") return withDaily(`Limit: ${count} / month`);
  if (mode === "yearly") return withDaily(`Limit: ${count} / year`);
  if (mode === "lifetime") return withDaily(`Limit: ${count} lifetime`);
  if (mode === "custom") {
    const days = Number(row.limit_window_days ?? 0);
    return withDaily(days ? `Limit: ${count} / ${days} days` : `Limit: ${count} / custom window`);
  }
  return withDaily(`Limit: ${count}`);
}

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

function countInDailyWindow(completions: string[], nowMs: number) {
  const windowStart = nowMs - 24 * 60 * 60 * 1000;
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

function formatUnlockMessage(msLeft: number, availableAt: Date) {
  const oneDay = 24 * 60 * 60 * 1000;
  if (msLeft >= oneDay) {
    return {
      label: "Unlocks On",
      value: availableAt.toLocaleString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  }
  return {
    label: "Unlocks In 24 Hours",
    value: availableAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };
}

export default function ChallengeVaultPanel({ studentId, title = "Challenge Vault", allowManage = false }: Props) {
  const [challenges, setChallenges] = useState<ChallengeRow[]>([]);
  const [medals, setMedals] = useState<Record<string, string | null>>({});
  const [studentChallenges, setStudentChallenges] = useState<StudentChallenge[]>([]);
  const [activeStudentId, setActiveStudentId] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterTier, setFilterTier] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState("");
  const [students, setStudents] = useState<Array<{ id: string; name: string; level?: number | null; points_total?: number | null; points_balance?: number | null; avatar_storage_path?: string | null; avatar_zoom_pct?: number | null }>>([]);
  const [studentQuery, setStudentQuery] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [completionMap, setCompletionMap] = useState<Record<string, string[]>>({});
  const announceActiveStudent = (id: string) => {
    try {
      window.dispatchEvent(new CustomEvent("active-student-change", { detail: { id } }));
    } catch {}
  };

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const stored = studentId ?? (() => {
      try {
        return localStorage.getItem("active_student_id") || "";
      } catch {
        return "";
      }
    })();
    setActiveStudentId(String(stored ?? ""));
  }, [studentId]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/students/list", { cache: "no-store" });
      const sj = await safeJson(res);
      if (sj.ok) setStudents((sj.json?.students ?? []) as Array<{ id: string; name: string }>);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const [cRes, mRes] = await Promise.all([
        fetch("/api/challenges/list", { cache: "no-store" }),
        fetch("/api/challenges/medals", { cache: "no-store" }),
      ]);
      const cJson = await safeJson(cRes);
      if (!cJson.ok) setMsg(cJson.json?.error || "Failed to load challenges");
      else setChallenges((cJson.json?.challenges ?? []) as ChallengeRow[]);
      const mJson = await safeJson(mRes);
      if (mJson.ok) setMedals((mJson.json?.medals ?? {}) as Record<string, string | null>);
    })();
  }, []);

  useEffect(() => {
    if (!activeStudentId) {
      setStudentChallenges([]);
      return;
    }
    (async () => {
      const r = await fetch("/api/students/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: activeStudentId }),
      });
      const sj = await safeJson(r);
      if (!sj.ok) return setMsg(sj.json?.error || "Failed to load student challenges");
      const rows = (sj.json?.rows ?? sj.json?.earned ?? []) as StudentChallenge[];
      setStudentChallenges(rows);
      const completionRows = (sj.json?.completions ?? []) as Array<{ challenge_id: string; completed_at: string | null }>;
      const map: Record<string, string[]> = {};
      completionRows.forEach((row) => {
        const key = String(row.challenge_id ?? "");
        const ts = row.completed_at ? String(row.completed_at) : "";
        if (!key || !ts) return;
        if (!map[key]) map[key] = [];
        map[key].push(ts);
      });
      setCompletionMap(map);
    })();
  }, [activeStudentId]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    challenges.forEach((c) => {
      const cat = String(c.category ?? "").trim();
      if (cat) set.add(cat);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [challenges]);

  const tiers = useMemo(() => {
    const set = new Set<string>();
    challenges.forEach((c) => {
      const t = String(c.tier ?? "").trim().toLowerCase();
      if (t) set.add(t);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [challenges]);

  const completedById = useMemo(() => {
    const map = new Map<string, string>();
    studentChallenges.forEach((row) => {
      if (!row.completed) return;
      const prev = map.get(String(row.challenge_id));
      const next = String(row.completed_at ?? "");
      if (!prev || (next && next > prev)) map.set(String(row.challenge_id), next);
    });
    return map;
  }, [studentChallenges]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return challenges.filter((c) => {
      if (filterCategory !== "all" && String(c.category ?? "") !== filterCategory) return false;
      if (filterTier !== "all" && String(c.tier ?? "").toLowerCase() !== filterTier) return false;
      if (q && !String(c.name ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [challenges, filterCategory, filterTier, search]);

  const selectedStudent = useMemo(() => {
    return students.find((s) => String(s.id) === String(activeStudentId)) ?? null;
  }, [students, activeStudentId]);

  const avatarSrc = useMemo(() => {
    const path = String(selectedStudent?.avatar_storage_path ?? "").trim();
    if (!path) return null;
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return base ? `${base}/storage/v1/object/public/avatars/${path}` : null;
  }, [selectedStudent?.avatar_storage_path]);

  const avatarZoom = Math.max(50, Math.min(100, Number(selectedStudent?.avatar_zoom_pct ?? 100)));

  const grouped = useMemo(() => {
    const map = new Map<string, ChallengeRow[]>();
    filtered.forEach((c) => {
      const key = String(c.category ?? "Uncategorized");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const completedChrono = useMemo(() => {
    const rows = Array.from(completedById.entries()).map(([challenge_id, completed_at]) => {
      const challenge = challenges.find((c) => c.id === challenge_id);
      return { challenge, completed_at };
    });
    return rows
      .filter((r) => r.challenge && r.completed_at)
      .sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)));
  }, [completedById, challenges]);

  async function completeChallenge(challengeId: string, completed: boolean) {
    if (!activeStudentId) return setMsg("Select a student first.");
    const res = await fetch("/api/challenges/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: activeStudentId, challengeId, completed }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to update challenge");
    const row = sj.json?.row as StudentChallenge | undefined;
    if (!row) return;
    setStudentChallenges((prev) => {
      const next = prev.filter((r) => String(r.challenge_id) !== String(row.challenge_id));
      return [...next, row];
    });
    if (completed) {
      const completedAt = String(row.completed_at ?? new Date().toISOString());
      setCompletionMap((prev) => {
        const key = String(row.challenge_id);
        const existing = prev[key] ? [...prev[key]] : [];
        existing.unshift(completedAt);
        return { ...prev, [key]: existing };
      });
    }
    const challengeRow = challenges.find((c) => c.id === challengeId);
    const points = Number(sj.json?.points_awarded ?? challengeRow?.points_awarded ?? 0);
    if (points && completed) {
      setStudents((prev) =>
        prev.map((s) =>
          String(s.id) === String(activeStudentId)
            ? { ...s, points_balance: Number(s.points_balance ?? s.points_total ?? 0) + points }
            : s
        )
      );
    }
    try {
      window.dispatchEvent(
        new CustomEvent("student-challenges-updated", {
          detail: { studentId: activeStudentId, points, tier: String(challengeRow?.tier ?? "").toLowerCase() },
        })
      );
    } catch {}
    try {
      localStorage.setItem("students_refresh_ts", new Date().toISOString());
      window.dispatchEvent(new Event("students-refresh"));
    } catch {}
    fireFx("redeem", points ? `+${points} pts` : "Challenge Complete");
    if (points) playGlobalSfx("points_add");
  }

  async function deleteChallenge(challengeId: string, challengeName: string) {
    if (!allowManage) return;
    const yes = window.confirm(`Delete challenge "${challengeName}"?\n\nThis also removes related student completion rows.`);
    if (!yes) return;
    const res = await fetch("/api/admin/challenges/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: challengeId }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(String(sj.json?.error ?? "Failed to delete challenge"));
    setChallenges((prev) => prev.filter((c) => String(c.id) !== String(challengeId)));
    setStudentChallenges((prev) => prev.filter((r) => String(r.challenge_id) !== String(challengeId)));
    setCompletionMap((prev) => {
      const next = { ...prev };
      delete next[String(challengeId)];
      return next;
    });
    setMsg("Challenge deleted.");
  }

  return (
    <div className="cvault">
      <style>{styles()}</style>
      <div className="cvault__header">
        <div className="cvault__title">{title}</div>
        <div className="cvault__filters">
          <div className="cvault__student">
            <label>Student</label>
            <input
              list="cvault-students"
              value={studentQuery}
              onChange={(e) => setStudentQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const match = students.find((s) => s.name.toLowerCase() === studentQuery.trim().toLowerCase());
                  if (match) {
                    setActiveStudentId(match.id);
                    setStudentQuery(match.name);
                    try {
                      localStorage.setItem("active_student_id", match.id);
                    } catch {}
                    announceActiveStudent(match.id);
                  } else {
                    setMsg("Select a student from the list.");
                  }
                }
              }}
              onBlur={() => {
                const match = students.find((s) => s.name.toLowerCase() === studentQuery.trim().toLowerCase());
                if (match) {
                  setActiveStudentId(match.id);
                  setStudentQuery(match.name);
                  try {
                    localStorage.setItem("active_student_id", match.id);
                  } catch {}
                  announceActiveStudent(match.id);
                }
              }}
              placeholder="Select student..."
            />
            <datalist id="cvault-students">
              {students.map((s) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>
          </div>
          <div className="cvault__category-chips">
            <button
              type="button"
              className={`cvault__category-chip ${filterCategory === "all" ? "is-active" : ""}`}
              onClick={() => setFilterCategory("all")}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                className={`cvault__category-chip ${filterCategory === c ? "is-active" : ""}`}
                onClick={() => setFilterCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <select value={filterTier} onChange={(e) => setFilterTier(e.target.value)}>
            <option value="all">All tiers</option>
            {tiers.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search challenge name..."
          />
          <button
            type="button"
            className="cvault__search-btn"
            onClick={() => setSearch(searchInput)}
          >
            Search
          </button>
        </div>
      </div>

      {msg ? <div className="cvault__msg">{msg}</div> : null}

      {selectedStudent ? (
        <div className="cvault__student-card">
          <AvatarRender
            size={96}
            bg="rgba(15,23,42,0.6)"
            avatarSrc={avatarSrc}
            avatarZoomPct={avatarZoom}
            showImageBorder={false}
            style={{ borderRadius: 16 }}
            fallback={<div className="cvault__student-fallback">{selectedStudent.name.slice(0, 2).toUpperCase()}</div>}
          />
          <div className="cvault__student-meta">
            <div className="cvault__student-name">{selectedStudent.name}</div>
            <div className="cvault__student-sub">Level {selectedStudent.level ?? 1} • {Number(selectedStudent.points_balance ?? selectedStudent.points_total ?? 0).toLocaleString()} pts</div>
          </div>
        </div>
      ) : null}

      <div className="cvault__grid">
        <div className="cvault__column cvault__column--scroll">
          {grouped.map(([category, rows]) => (
            <div key={category} className="cvault__group">
              <div className="cvault__group-title">{category}</div>
              <div className="cvault__list cvault__list--cards">
                {rows.map((c) => {
                  const tierKey = String(c.tier ?? "").toLowerCase();
                  const medalUrl = medals[tierKey] ?? null;
                  const medalGlow = ["gold", "platinum", "diamond", "master"].includes(tierKey);
                  const completedAt = completedById.get(String(c.id)) || "";
                  const isRepeatable = String(c.limit_mode ?? "once") !== "once";
                  const completions = completionMap[String(c.id)] ?? [];
                  const countWindow = countInWindow(c, completions, now);
                  const primaryLimit = Math.max(1, Number(c.limit_count ?? 1));
                  const dailyLimit = Math.max(0, Number(c.daily_limit_count ?? 0));
                  const countDaily = countInDailyWindow(completions, now);
                  const blockedPrimary = countWindow >= primaryLimit;
                  const blockedDaily = dailyLimit > 0 && countDaily >= dailyLimit;
                  const blocked = blockedPrimary || blockedDaily;
                  const showCompletedChip = Boolean(
                    completedAt &&
                      (
                        !isRepeatable || // one-time style completions stay marked
                        blocked // repeatable completions only show while still cooldown-locked
                      )
                  );
                  const remainingPrimary = Math.max(0, primaryLimit - countWindow);
                  const remainingDaily = dailyLimit > 0 ? Math.max(0, dailyLimit - countDaily) : null;
                  const availableAt = blocked ? nextAvailableDateFromCompletions(c, completions, now) : null;
                  const msLeft = availableAt ? availableAt.getTime() - now : null;
                  const unlockMsg = msLeft !== null && availableAt ? formatUnlockMessage(msLeft, availableAt) : null;
                  return (
                    <div
                      key={c.id}
                      className={`cvault__row ${blocked ? "cvault__row--blocked" : ""} ${completedAt ? "cvault__row--completed" : ""}`}
                    >
                      {blocked && availableAt && unlockMsg ? (
                        <div className="cvault__unlock-overlay">
                          <div className="cvault__limit-label cvault__limit-label--bright">{unlockMsg.label}</div>
                          <div className="cvault__limit-countdown cvault__limit-countdown--large">{unlockMsg.value}</div>
                        </div>
                      ) : null}
                        <div className="cvault__info">
                        <div className="cvault__name">{c.name}</div>
                        {c.description ? <div className="cvault__desc">{c.description}</div> : null}
                        {showCompletedChip ? <div className="cvault__chip cvault__chip--center">Completed</div> : null}
                        <div className="cvault__meta">{formatLimit(c)}</div>
                        <div className="cvault__remain-inline">
                          Remaining: {remainingPrimary} / {primaryLimit}
                          {remainingDaily !== null ? ` • Daily: ${remainingDaily} / ${dailyLimit}` : ""}
                        </div>
                      </div>
                      <div className="cvault__footer">
                        <div className={`cvault__medal cvault__medal--inline cvault__medal--offset ${medalGlow ? "cvault__medal--glow" : ""}`}>
                          {medalUrl ? <img src={medalUrl} alt={String(c.tier ?? "tier")} /> : <span>—</span>}
                        </div>
                        <div className="cvault__footer-right">
                          <div className="cvault__points-chip">{c.points_awarded ? `${c.points_awarded} pts` : "0 pts"}</div>
                          {isRepeatable && completedAt ? (
                            <div className="cvault__sub">Last completed: {new Date(completedAt).toLocaleDateString()}</div>
                          ) : completedAt ? (
                            <div className="cvault__sub">Completed: {new Date(completedAt).toLocaleDateString()}</div>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => completeChallenge(c.id, true)}
                            disabled={!activeStudentId || blocked}
                          >
                            Complete
                          </button>
                          {allowManage ? (
                            <button
                              type="button"
                              className="cvault__delete-btn"
                              onClick={() => deleteChallenge(c.id, c.name)}
                            >
                              Delete
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="cvault__column cvault__column--scroll">
          <div className="cvault__group-title">Completed (Most Recent)</div>
          <div className="cvault__list">
            {completedChrono.map((row) => {
              if (!row.challenge) return null;
              const tierKey = String(row.challenge.tier ?? "").toLowerCase();
              const medalUrl = medals[tierKey] ?? null;
              const medalGlow = ["gold", "platinum", "diamond", "master"].includes(tierKey);
              return (
                <div key={`${row.challenge.id}-${row.completed_at}`} className="cvault__row">
                  <div className={`cvault__medal ${medalGlow ? "cvault__medal--glow" : ""}`}>
                    {medalUrl ? <img src={medalUrl} alt={String(row.challenge.tier ?? "tier")} /> : <span>—</span>}
                  </div>
                  <div className="cvault__info">
                    <div className="cvault__name">{row.challenge.name}</div>
                    <div className="cvault__meta">
                      {row.challenge.points_awarded ? `${row.challenge.points_awarded} pts` : "0 pts"} • {formatLimit(row.challenge)}
                    </div>
                    <div className="cvault__sub">Completed: {new Date(row.completed_at).toLocaleDateString()}</div>
                  </div>
                </div>
              );
            })}
            {!completedChrono.length ? <div className="cvault__empty">No completed challenges yet.</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function styles() {
  return `
    .cvault {
      display: grid;
      gap: 16px;
      width: 100%;
    }
    .cvault__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    .cvault__title {
      font-size: 24px;
      font-weight: 1000;
    }
    .cvault__filters {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }
    .cvault__student {
      display: grid;
      gap: 6px;
      font-size: 12px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      opacity: 0.8;
    }
    .cvault__student input {
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid rgba(148,163,184,0.2);
      background: rgba(15,23,42,0.7);
      color: white;
      font-weight: 800;
    }
    .cvault__filters input,
    .cvault__filters select {
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid rgba(148,163,184,0.2);
      background: rgba(15,23,42,0.7);
      color: white;
      font-weight: 800;
    }
    .cvault__category-chips {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
      max-width: min(720px, 100%);
    }
    .cvault__category-chip {
      padding: 7px 10px;
      border-radius: 999px;
      border: 1px solid rgba(148,163,184,0.32);
      background: rgba(15,23,42,0.7);
      color: white;
      font-size: 12px;
      font-weight: 900;
      cursor: pointer;
    }
    .cvault__category-chip.is-active {
      border-color: rgba(45,212,191,0.7);
      background: rgba(13,148,136,0.28);
      box-shadow: 0 0 0 1px rgba(45,212,191,0.28);
    }
    .cvault__search-btn {
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid rgba(56,189,248,0.42);
      background: rgba(56,189,248,0.18);
      color: white;
      font-weight: 900;
      cursor: pointer;
    }
    .cvault__msg {
      padding: 10px 12px;
      border-radius: 12px;
      background: rgba(239,68,68,0.12);
      border: 1px solid rgba(239,68,68,0.3);
      font-weight: 900;
      font-size: 12px;
    }
    .cvault__student-card {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 12px;
      align-items: center;
      padding: 12px;
      border-radius: 16px;
      background: rgba(15,23,42,0.9);
      border: 1px solid rgba(148,163,184,0.18);
      width: min(520px, 100%);
    }
    .cvault__student-meta {
      display: grid;
      gap: 4px;
    }
    .cvault__student-name {
      font-weight: 1000;
      font-size: 18px;
    }
    .cvault__student-sub {
      font-size: 12px;
      opacity: 0.8;
    }
    .cvault__student-fallback {
      width: 96px;
      height: 96px;
      border-radius: 16px;
      display: grid;
      place-items: center;
      font-weight: 900;
      font-size: 28px;
      background: rgba(30,41,59,0.8);
    }
    .cvault__grid {
      display: grid;
      grid-template-columns: 1.35fr 0.65fr;
      gap: 18px;
      align-items: start;
    }
    .cvault__column {
      display: grid;
      gap: 16px;
    }
    .cvault__column--scroll {
      max-height: 72vh;
      overflow-y: auto;
      padding-right: 6px;
    }
    .cvault__group-title {
      font-weight: 1000;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      opacity: 0.8;
      margin-bottom: 8px;
    }
    .cvault__list {
      display: grid;
      gap: 10px;
    }
    .cvault__list--cards {
      grid-template-columns: repeat(4, minmax(220px, 1fr));
    }
    .cvault__row {
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;
      padding: 12px;
      border-radius: 14px;
      background: rgba(15,23,42,0.9);
      border: 1px solid rgba(148,163,184,0.18);
      align-items: center;
      justify-items: center;
      text-align: center;
      position: relative;
    }
    .cvault__row--blocked {
    }
    .cvault__row--blocked .cvault__name {
    }
    .cvault__row--completed {
      outline: 2px solid rgba(34,197,94,0.65);
      box-shadow: 0 0 0 3px rgba(34,197,94,0.08);
    }
    .cvault__row--blocked {
      opacity: 0.5;
      filter: grayscale(0.4);
    }
    .cvault__row--blocked .cvault__name {
      text-decoration: line-through;
    }
    .cvault__medal {
      width: 60px;
      height: 60px;
      border-radius: 12px;
      background: rgba(30,41,59,0.7);
      border: 1px solid rgba(148,163,184,0.2);
      display: grid;
      place-items: center;
    }
    .cvault__medal--inline {
      width: 96px;
      height: 96px;
      border-radius: 16px;
    }
    .cvault__medal--offset {
      justify-self: center;
      margin-top: 0;
      margin-right: 0;
    }
    .cvault__medal img {
      width: 44px;
      height: 44px;
      object-fit: contain;
    }
    .cvault__medal--glow {
      box-shadow: 0 0 18px rgba(251,191,36,0.55), 0 0 28px rgba(250,204,21,0.25);
      border-color: rgba(250,204,21,0.7);
    }
    .cvault__info {
      display: grid;
      gap: 6px;
      justify-items: center;
    }
    .cvault__name {
      font-weight: 1000;
      font-size: 18px;
    }
    .cvault__desc {
      font-size: 13px;
      opacity: 0.82;
    }
    .cvault__chip {
      justify-self: start;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      color: #052e16;
      background: rgba(34,197,94,0.8);
      border: 1px solid rgba(34,197,94,0.85);
    }
    .cvault__chip--center {
      justify-self: center;
    }
    .cvault__meta {
      font-size: 13px;
      font-weight: 900;
      opacity: 0.85;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .cvault__remain-inline {
      font-size: 12px;
      font-weight: 900;
      opacity: 0.8;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .cvault__unlock-overlay {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: grid;
      justify-items: center;
      gap: 6px;
      padding: 14px 16px;
      border-radius: 16px;
      border: 1px solid rgba(148,163,184,0.35);
      background: rgba(2,6,23,0.92);
      box-shadow: 0 8px 20px rgba(0,0,0,0.35);
      z-index: 2;
      min-width: 180px;
    }
    .cvault__limit-label {
      font-size: 12px;
      font-weight: 900;
      opacity: 0.9;
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }
    .cvault__limit-label--bright {
      opacity: 1;
      color: #e2e8f0;
    }
    .cvault__limit-value {
      font-size: 20px;
      font-weight: 1000;
      letter-spacing: 0.4px;
    }
    .cvault__limit-countdown {
      padding: 6px 10px;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 1000;
      letter-spacing: 0.6px;
      background: rgba(15,23,42,0.95);
      border: 1px solid rgba(148,163,184,0.3);
      color: #f8fafc;
      min-width: 92px;
      text-align: center;
    }
    .cvault__limit-countdown--large {
      font-size: 20px;
      padding: 8px 12px;
    }
    .cvault__sub {
      font-size: 11px;
      opacity: 0.7;
    }
    .cvault__sub--blocked {
      color: #fca5a5;
      opacity: 0.95;
      font-weight: 900;
      letter-spacing: 0.4px;
      text-transform: uppercase;
    }
    .cvault__action {
      display: grid;
      gap: 8px;
      justify-items: center;
    }
    .cvault__action--bottom {
      justify-items: center;
    }
    .cvault__footer {
      width: 100%;
      display: grid;
      grid-template-columns: auto minmax(140px, 180px);
      gap: 12px;
      align-items: center;
      justify-items: center;
    }
    .cvault__footer-right {
      display: grid;
      gap: 8px;
      justify-items: center;
      width: 100%;
    }
    .cvault__points-chip {
      padding: 6px 12px;
      border-radius: 12px;
      font-weight: 1000;
      font-size: 16px;
      background: rgba(15,118,110,0.35);
      border: 1px solid rgba(45,212,191,0.55);
      color: #e6fffb;
      letter-spacing: 0.4px;
    }
    .cvault__action button {
      padding: 8px 12px;
      border-radius: 12px;
      border: 1px solid rgba(56,189,248,0.4);
      background: rgba(56,189,248,0.18);
      color: white;
      font-weight: 900;
      cursor: pointer;
    }
    .cvault__delete-btn {
      padding: 8px 12px;
      border-radius: 12px;
      border: 1px solid rgba(248,113,113,0.42);
      background: rgba(248,113,113,0.16);
      color: #ffe4e6;
      font-weight: 900;
      cursor: pointer;
    }
    .cvault__delete-btn:hover {
      background: rgba(248,113,113,0.24);
    }
    .cvault__action button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      background: rgba(148,163,184,0.15);
      border-color: rgba(148,163,184,0.25);
    }
    .cvault__empty {
      font-size: 12px;
      opacity: 0.7;
    }
    @media (max-width: 1100px) {
      .cvault__grid {
        grid-template-columns: 1fr;
      }
      .cvault__list--cards {
        grid-template-columns: repeat(2, minmax(240px, 1fr));
      }
    }
    @media (max-width: 760px) {
      .cvault__list--cards {
        grid-template-columns: 1fr;
      }
    }
  `;
}

"use client";

import { useEffect, useMemo, useState } from "react";
import AuthGate from "@/components/AuthGate";
import { skillSprintPoolDropped, skillSprintPrizeDropPerDay, skillSprintPrizeNow } from "@/lib/skillSprintMath";

type StudentRow = {
  id: string;
  name: string;
  points_total?: number | null;
  points_balance?: number | null;
  gender?: string | null;
};

type SkillSprintRow = {
  id: string;
  source_label: string;
  source_type: "skill_tree" | "skill_pulse" | "manual";
  due_at: string;
  penalty_points_per_day: number;
  reward_points: number;
  charged_days: number;
  assigned_at?: string;
  completed_at?: string | null;
  note?: string | null;
  remaining_ms: number;
  overdue_days: number;
  status: "upcoming" | "overdue" | "completed";
};

type SkillSprintSummary = {
  active_count: number;
  overdue_count: number;
  next_due_at: string | null;
  next_due_in_ms: number | null;
  total_penalty_points_per_day: number;
  total_reward_points: number;
};

const SKILL_STAR_COLORS = ["#f59e0b", "#38bdf8", "#34d399", "#f472b6", "#a78bfa", "#fb7185", "#22d3ee", "#facc15"];

function colorForSkill(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return SKILL_STAR_COLORS[hash % SKILL_STAR_COLORS.length];
}

function formatTimeLeft(ms: number) {
  const abs = Math.abs(ms);
  const totalHours = Math.floor(abs / (60 * 60 * 1000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (ms >= 0) return `${days}d ${hours}h left`;
  return `${days}d ${hours}h overdue`;
}

function sprintProgress(row: SkillSprintRow, nowMs = Date.now()) {
  const assignedMs = Date.parse(String(row.assigned_at ?? ""));
  const dueMs = Date.parse(String(row.due_at ?? ""));
  if (!Number.isFinite(assignedMs) || !Number.isFinite(dueMs) || dueMs <= assignedMs) {
    return row.status === "overdue" ? 1 : 0;
  }
  const total = dueMs - assignedMs;
  const elapsed = Math.min(total, Math.max(0, nowMs - assignedMs));
  return Math.max(0, Math.min(1, elapsed / total));
}

export default function StudentSkillSprintPage() {
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [rows, setRows] = useState<SkillSprintRow[]>([]);
  const [summary, setSummary] = useState<SkillSprintSummary | null>(null);
  const [msg, setMsg] = useState("");
  const [nowMs, setNowMs] = useState(Date.now());
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    (async () => {
      const listRes = await fetch("/api/students/list", { cache: "no-store" });
      const listJson = await listRes.json().catch(() => ({}));
      if (!listRes.ok) return setMsg(String(listJson?.error ?? "Failed to load student"));
      const list = (listJson?.students ?? []) as StudentRow[];
      let activeId = "";
      try {
        activeId = localStorage.getItem("active_student_id") || "";
      } catch {}
      const selected = list.find((s) => String(s.id) === String(activeId)) ?? null;
      if (!selected) return setMsg("Please select student.");
      setStudent(selected);
    })();
  }, []);

  useEffect(() => {
    if (!student?.id) return;
    let cancelled = false;
    const load = async () => {
      const [snapshotRes, listRes] = await Promise.all([
        fetch(`/api/skill-sprint/student?student_id=${encodeURIComponent(String(student.id))}`, { cache: "no-store" }),
        fetch(`/api/skill-sprint/list?student_id=${encodeURIComponent(String(student.id))}`, { cache: "no-store" }),
      ]);
      const [snapshotJson, listJson] = await Promise.all([
        snapshotRes.json().catch(() => ({})),
        listRes.json().catch(() => ({})),
      ]);
      if (!snapshotRes.ok || !listRes.ok) {
        if (!cancelled)
          setMsg(
            String(snapshotJson?.error ?? listJson?.error ?? "Failed to load Skill Sprint")
          );
        return;
      }
      if (cancelled) return;
      const allRows = ((listJson?.rows ?? []) as Array<Partial<SkillSprintRow>>)
        .map((raw) => {
          const dueMs = Date.parse(String(raw?.due_at ?? ""));
          const remainingMs = Number.isFinite(dueMs) ? dueMs - Date.now() : 0;
          const completedAt = raw?.completed_at ? String(raw.completed_at) : null;
          const status: SkillSprintRow["status"] = completedAt
            ? "completed"
            : remainingMs < 0
              ? "overdue"
              : "upcoming";
          const overdueDays = status === "overdue" ? Math.max(0, Math.floor(Math.abs(remainingMs) / (24 * 60 * 60 * 1000))) : 0;
          return {
            id: String(raw?.id ?? ""),
            source_label: String(raw?.source_label ?? "Skill"),
            source_type: (raw?.source_type ?? "manual") as SkillSprintRow["source_type"],
            due_at: String(raw?.due_at ?? ""),
            penalty_points_per_day: Math.max(0, Math.round(Number(raw?.penalty_points_per_day ?? 0))),
            reward_points: Math.max(0, Math.round(Number(raw?.reward_points ?? 0))),
            charged_days: Math.max(0, Math.round(Number(raw?.charged_days ?? 0))),
            assigned_at: raw?.assigned_at ? String(raw.assigned_at) : undefined,
            completed_at: completedAt,
            note: raw?.note ? String(raw.note) : null,
            remaining_ms: remainingMs,
            overdue_days: overdueDays,
            status,
          } as SkillSprintRow;
        })
        .filter((row) => row.id)
        .sort((a, b) => Date.parse(String(b.assigned_at ?? b.due_at ?? "")) - Date.parse(String(a.assigned_at ?? a.due_at ?? "")));
      setRows(allRows);
      setSummary((snapshotJson?.summary ?? null) as SkillSprintSummary | null);
      setMsg("");
    };
    load();
    const timer = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [student?.id]);

  const totals = useMemo(() => {
    const activeRows = rows.filter((row) => !row.completed_at);
    const lost = activeRows.reduce(
      (sum, row) => sum + Math.max(0, Math.round(Number(row.charged_days ?? 0) * Number(row.penalty_points_per_day ?? 0))),
      0
    );
    const prizeNow = activeRows.reduce((sum, row) => sum + skillSprintPrizeNow(row.reward_points, row.assigned_at, row.due_at, nowMs), 0);
    const poolDropped = activeRows.reduce((sum, row) => sum + skillSprintPoolDropped(row.reward_points, row.assigned_at, row.due_at, nowMs), 0);
    return { lost, prizeNow, poolDropped };
  }, [rows, nowMs]);

  const runnerPct = useMemo(() => {
    const longest = rows
      .filter((r) => !r.completed_at)
      .map((r) => ({ row: r, dueMs: Date.parse(String(r.due_at ?? "")) }))
      .filter((r) => Number.isFinite(r.dueMs))
      .sort((a, b) => b.dueMs - a.dueMs)[0]?.row;
    if (!longest) return 0;
    return sprintProgress(longest, nowMs);
  }, [rows, nowMs]);

  const runnerTimeLabel = useMemo(() => {
    const longest = rows
      .filter((r) => !r.completed_at)
      .map((r) => ({ row: r, dueMs: Date.parse(String(r.due_at ?? "")) }))
      .filter((r) => Number.isFinite(r.dueMs))
      .sort((a, b) => b.dueMs - a.dueMs)[0]?.row;
    if (!longest) return "No active sprint";
    return formatTimeLeft(longest.remaining_ms);
  }, [rows, nowMs]);
  const runnerEmoji = useMemo(() => {
    const g = String(student?.gender ?? "").trim().toLowerCase();
    return g === "female" ? "🏃‍♀️" : "🏃‍♂️";
  }, [student?.gender]);

  const skillMarkers = useMemo(() => {
    const parsed = rows
      .filter((row) => !row.completed_at)
      .map((row) => ({ row, dueMs: Date.parse(String(row.due_at ?? "")) }))
      .filter((x) => Number.isFinite(x.dueMs));
    if (!parsed.length) return [] as Array<{ id: string; pct: number; color: string; isLongest: boolean }>;
    const farthestDue = Math.max(...parsed.map((x) => x.dueMs));
    const span = Math.max(1, farthestDue - nowMs);
    return parsed.map((x) => {
      const rawPct = (x.dueMs - nowMs) / span;
      const pct = Math.max(0, Math.min(1, rawPct));
      const isLongest = Math.abs(x.dueMs - farthestDue) < 1000;
      return {
        id: x.row.id,
        pct: isLongest ? 1 : pct,
        color: colorForSkill(String(x.row.id)),
        isLongest,
      };
    });
  }, [rows, nowMs]);

  const starColorById = useMemo(() => {
    const map: Record<string, string> = {};
    skillMarkers.forEach((m) => {
      map[m.id] = m.color;
    });
    return map;
  }, [skillMarkers]);

  return (
    <AuthGate>
      <main className="skill-sprint-page">
        <style>{styles}</style>

        <section className="sprint-hero">
          <div className="sprint-hero__head">
            <h1>Skill Sprint</h1>
            <p>Race the deadline. Complete the skill before your points drain too far.</p>
          </div>

          <div
            className="sprint-track-wrap"
            aria-label="Skill Sprint progress track"
            style={{ "--runner-pct": runnerPct } as React.CSSProperties}
          >
            <div className="sprint-track-line" />
            {skillMarkers.map((marker) => (
              <div
                key={`skill-marker-${marker.id}`}
                className={`sprint-skill-marker ${marker.isLongest ? "sprint-skill-marker--longest" : ""}`}
                style={{ "--skill-pct": marker.pct, "--skill-color": marker.color } as React.CSSProperties}
                aria-hidden="true"
              >
                <span className="sprint-skill-marker__line" />
                <span className="sprint-skill-marker__star">★</span>
              </div>
            ))}
            <div className="sprint-track-marker">
              <span className="sprint-track-marker__line" />
            </div>
            <div className="sprint-track-start">START</div>
            <div className="sprint-track-end">FINISH</div>
            <div className="sprint-runner">
              {runnerEmoji}
            </div>
            <div className="sprint-track-time">{runnerTimeLabel}</div>
          </div>

          <div className="sprint-cards">
            <article className="sprint-card sprint-card--loss">
              <div className="sprint-card__label">Points Lost So Far</div>
              <div className="sprint-card__value">-{totals.lost}</div>
              <div className="sprint-card__meta">Daily loss: -{Math.round(Number(summary?.total_penalty_points_per_day ?? 0))}</div>
            </article>
            <article className="sprint-card sprint-card--prize">
              <div className="sprint-card__label">Current Prize (Decreasing)</div>
              <div className="sprint-card__value">+{totals.prizeNow}</div>
              <div className="sprint-card__meta">Pool dropped so far: {totals.poolDropped}</div>
            </article>
          </div>
        </section>

        {msg ? <div className="sprint-notice">{msg}</div> : null}

        <section className="sprint-list">
          <div className="sprint-list__head">
            <div>My Skill Sprints</div>
            <div>{summary?.active_count ?? 0} active</div>
          </div>
          {!rows.length ? <div className="sprint-empty">No Skill Sprint assigned right now.</div> : null}
          {rows.map((row) => {
            const lost = Math.max(0, Math.round(Number(row.charged_days ?? 0) * Number(row.penalty_points_per_day ?? 0)));
            const prize = Math.round(skillSprintPrizeNow(row.reward_points, row.assigned_at, row.due_at, nowMs));
            const poolDropPerDay = Math.round(skillSprintPrizeDropPerDay(row.reward_points, row.assigned_at, row.due_at));
            const poolDropped = Math.round(skillSprintPoolDropped(row.reward_points, row.assigned_at, row.due_at, nowMs));
            const pct = sprintProgress(row, nowMs);
            const expanded = expandedRowId === row.id;
            return (
              <article
                key={row.id}
                className={`sprint-row ${expanded ? "sprint-row--expanded" : ""}`}
                onClick={() => setExpandedRowId((prev) => (prev === row.id ? null : row.id))}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setExpandedRowId((prev) => (prev === row.id ? null : row.id));
                  }
                }}
              >
                <div className="sprint-row__main">
                  <div className="sprint-row__title">
                    <span className="sprint-row__skill-star" style={{ color: starColorById[row.id] ?? "#facc15" }}>★</span>
                    {row.source_label}
                  </div>
                  <div className="sprint-row__chips">
                    <span className={`chip ${row.status === "overdue" ? "chip--overdue" : "chip--time"}`}>{formatTimeLeft(row.remaining_ms)}</span>
                    <span className="chip chip--tap">{expanded ? "Hide details" : "Tap for details"}</span>
                  </div>
                </div>
                <div className="sprint-row__bar">
                  <span style={{ width: `${Math.round(pct * 100)}%` }} />
                </div>
                {expanded ? (
                  <div className="sprint-row__details">
                    <span className="chip chip--lost">Points lost so far: {lost}</span>
                    <span className="chip chip--prize">Prize pool left: {prize}</span>
                    <span className="chip chip--time">Pool drop/day: {poolDropPerDay}</span>
                    <span className="chip chip--overdue">Pool dropped: {poolDropped}</span>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      </main>
    </AuthGate>
  );
}

const styles = `
.skill-sprint-page {
  min-height: 100vh;
  padding: 16px 14px 26px 252px;
  color: #fff;
  display: grid;
  gap: 14px;
  align-content: start;
  background: radial-gradient(circle at 18% 10%, rgba(56,189,248,0.2), rgba(2,6,23,0.96) 52%);
}
@media (max-width: 1100px) {
  .skill-sprint-page {
    padding: 8px 8px 92px;
  }
}
.sprint-hero {
  border-radius: 16px;
  border: 1px solid rgba(148,163,184,0.28);
  background: linear-gradient(155deg, rgba(15,23,42,0.92), rgba(2,6,23,0.94));
  padding: 12px;
  display: grid;
  gap: 12px;
}
.sprint-hero__head h1 {
  margin: 0;
  font-size: 34px;
  font-weight: 1000;
}
.sprint-hero__head p {
  margin: 4px 0 0;
  opacity: 0.8;
  font-weight: 700;
}
.sprint-track-wrap {
  --track-inset: 30px;
  --runner-pct: 0.5;
  position: relative;
  border-radius: 12px;
  border: 1px solid rgba(56,189,248,0.32);
  background: rgba(2,6,23,0.52);
  padding: 42px 14px 32px;
  overflow: hidden;
}
.sprint-track-line {
  height: 14px;
  width: calc(100% - (var(--track-inset) * 2));
  margin: 0 auto;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(30,64,175,0.9), rgba(16,185,129,0.95));
  box-shadow: 0 0 16px rgba(56,189,248,0.35);
}
.sprint-skill-marker {
  --skill-pct: 0;
  --skill-color: #facc15;
  position: absolute;
  top: 17px;
  left: calc(var(--track-inset) + (100% - (var(--track-inset) * 2)) * var(--skill-pct));
  transform: translateX(-50%);
  display: grid;
  justify-items: center;
  gap: 2px;
  pointer-events: none;
}
.sprint-skill-marker__line {
  width: 2px;
  height: 24px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--skill-color) 65%, white);
  box-shadow: 0 0 8px color-mix(in srgb, var(--skill-color) 80%, white);
}
.sprint-skill-marker__star {
  font-size: 12px;
  line-height: 1;
  color: var(--skill-color);
  text-shadow: 0 0 8px color-mix(in srgb, var(--skill-color) 90%, white);
}
.sprint-skill-marker--longest .sprint-skill-marker__star {
  font-size: 14px;
}
.sprint-track-marker {
  position: absolute;
  top: 17px;
  left: calc(var(--track-inset) + (100% - (var(--track-inset) * 2)) * var(--runner-pct));
  transform: translateX(-50%);
  display: grid;
  justify-items: center;
  gap: 4px;
}
.sprint-track-marker__line {
  width: 3px;
  height: 24px;
  border-radius: 999px;
  background: rgba(255,255,255,0.95);
  box-shadow: 0 0 10px rgba(125,211,252,0.9);
}
.sprint-track-start,
.sprint-track-end {
  position: absolute;
  top: 6px;
  font-size: 11px;
  font-weight: 1000;
  letter-spacing: 0.8px;
}
.sprint-track-start { left: 12px; color: #93c5fd; }
.sprint-track-end { right: 12px; color: #86efac; }
.sprint-track-time {
  position: absolute;
  bottom: 6px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  font-weight: 1000;
  color: #dbeafe;
  padding: 2px 10px;
  border-radius: 999px;
  border: 1px solid rgba(125,211,252,0.45);
  background: rgba(30,64,175,0.42);
  white-space: nowrap;
}
.sprint-runner {
  position: absolute;
  top: 2px;
  left: calc(var(--track-inset) + (100% - (var(--track-inset) * 2)) * var(--runner-pct));
  transform: translateX(-50%) scaleX(-1);
  font-size: 44px;
  filter: drop-shadow(0 0 10px rgba(59,130,246,0.65));
  animation: runnerBounce 0.9s ease-in-out infinite;
}
@keyframes runnerBounce {
  0%, 100% { transform: translateX(-50%) scaleX(-1) translateY(0); }
  50% { transform: translateX(-50%) scaleX(-1) translateY(-4px); }
}
.sprint-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
@media (max-width: 840px) {
  .sprint-cards { grid-template-columns: 1fr; }
}
.sprint-card {
  border-radius: 12px;
  border: 1px solid rgba(148,163,184,0.3);
  padding: 12px;
  display: grid;
  gap: 6px;
}
.sprint-card--loss {
  border-color: rgba(248,113,113,0.5);
  background: linear-gradient(145deg, rgba(127,29,29,0.45), rgba(2,6,23,0.6));
}
.sprint-card--prize {
  border-color: rgba(74,222,128,0.5);
  background: linear-gradient(145deg, rgba(21,128,61,0.34), rgba(2,6,23,0.6));
}
.sprint-card__label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  opacity: 0.86;
  font-weight: 900;
}
.sprint-card__value {
  font-size: 34px;
  line-height: 1;
  font-weight: 1000;
}
.sprint-card__meta {
  font-size: 12px;
  opacity: 0.88;
  font-weight: 800;
}
.sprint-notice {
  border-radius: 10px;
  border: 1px solid rgba(248,113,113,0.45);
  background: rgba(127,29,29,0.45);
  padding: 8px 10px;
  font-weight: 900;
}
.sprint-list {
  border-radius: 16px;
  border: 1px solid rgba(148,163,184,0.28);
  background: rgba(15,23,42,0.7);
  padding: 12px;
  display: grid;
  gap: 10px;
}
.sprint-list__head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
  font-size: 20px;
  font-weight: 1000;
}
.sprint-empty {
  opacity: 0.8;
  font-weight: 800;
}
.sprint-row {
  border-radius: 12px;
  border: 1px solid rgba(148,163,184,0.28);
  background: rgba(2,6,23,0.55);
  padding: 10px;
  display: grid;
  gap: 8px;
  cursor: pointer;
}
.sprint-row--expanded {
  border-color: rgba(56,189,248,0.45);
  background: rgba(10,20,40,0.72);
}
.sprint-row__title {
  font-size: 18px;
  font-weight: 1000;
  display: flex;
  align-items: center;
  gap: 8px;
}
.sprint-row__skill-star {
  font-size: 16px;
  line-height: 1;
  text-shadow: 0 0 10px currentColor;
}
.sprint-row__chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.chip {
  border-radius: 999px;
  padding: 5px 9px;
  font-size: 12px;
  font-weight: 900;
  border: 1px solid rgba(148,163,184,0.4);
}
.chip--time { background: rgba(3,105,161,0.25); border-color: rgba(56,189,248,0.45); color: #bae6fd; }
.chip--overdue { background: rgba(153,27,27,0.45); border-color: rgba(248,113,113,0.55); color: #fecaca; }
.chip--lost { background: rgba(153,27,27,0.35); border-color: rgba(248,113,113,0.5); color: #fecaca; }
.chip--prize { background: rgba(21,128,61,0.28); border-color: rgba(74,222,128,0.45); color: #dcfce7; }
.chip--tap { background: rgba(30,41,59,0.7); border-color: rgba(100,116,139,0.55); color: #e2e8f0; }
.sprint-row__bar {
  height: 8px;
  border-radius: 999px;
  background: rgba(30,41,59,0.7);
  overflow: hidden;
}
.sprint-row__bar > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, rgba(56,189,248,0.9), rgba(34,197,94,0.95));
}
.sprint-row__details {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
`;

"use client";

import { useEffect, useMemo, useState } from "react";
import AuthGate from "../../../components/AuthGate";
import AvatarRender from "@/components/AvatarRender";
import StudentNavPanel, { studentNavStyles } from "@/components/StudentNavPanel";

type StudentRow = {
  id: string;
  name: string;
  level?: number | null;
  points_total?: number | null;
  points_balance?: number | null;
  avatar_storage_path?: string | null;
  avatar_zoom_pct?: number | null;
};

type EarnedBadge = {
  badge_id: string;
  rescinded_at?: string | null;
  achievement_badges?: {
    name?: string | null;
    category?: string | null;
    icon_url?: string | null;
  } | null;
};

type BadgeCatalog = {
  id: string;
  name?: string | null;
  category?: string | null;
  icon_url?: string | null;
};

type ChallengeRow = {
  challenge_id: string;
  completed?: boolean | null;
  tier?: string | null;
};

type MedalMap = Record<string, string | null>;
type PrestigeProgress = Record<string, { progress: number; current: number; target: number; detail?: string }>;

type HighlightsSummary = {
  points_earned: number;
  rule_breaker_count: number;
  rule_keeper_count: number;
  checkins: number;
  taolu_completed: number;
  skill_completed: number;
  battle_completed: number;
};

type AttendanceSummary = {
  awards: Array<{ id: string; award_date: string; name: string; points_awarded: number }>;
  checkins?: Array<{ id: string; checked_in_at: string }>;
};

type TaoluSummary = {
  session_history: Array<{ session_id: string; created_at: string; sections: any[]; deductions: Array<{ occurred_at: string; voided?: boolean | null }> }>;
};

type BattleRow = {
  id: string;
  settled_at?: string | null;
  participant_ids?: string[] | null;
  left_student_id?: string | null;
  right_student_id?: string | null;
};

type SkillTrackerRow = {
  repetitions_target: number;
  attempts: number;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 180)}` } };
  }
}

function getWeekStartUTC(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const offset = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export default function StudentInfoPage() {
  const [checked, setChecked] = useState(false);
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([]);
  const [prestigeCatalog, setPrestigeCatalog] = useState<BadgeCatalog[]>([]);
  const [prestigeProgress, setPrestigeProgress] = useState<PrestigeProgress>({});
  const [earnedChallenges, setEarnedChallenges] = useState<ChallengeRow[]>([]);
  const [medalIcons, setMedalIcons] = useState<MedalMap>({});
  const [highlights, setHighlights] = useState<HighlightsSummary | null>(null);
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
  const [taoluSummary, setTaoluSummary] = useState<TaoluSummary | null>(null);
  const [mvpTotal, setMvpTotal] = useState(0);
  const [mvpWeek, setMvpWeek] = useState(0);
  const [battleTotal, setBattleTotal] = useState(0);
  const [skillCompletedTotal, setSkillCompletedTotal] = useState(0);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const sj = await safeJson(res);
      if (!sj.ok) {
        window.location.href = "/login";
        return;
      }
      const role = String(sj.json?.role ?? "");
      const allowed = ["student", "admin", "coach", "classroom"].includes(role);
      if (!allowed) {
        window.location.href = "/";
        return;
      }
      setChecked(true);
    })();
  }, []);

  useEffect(() => {
    if (!checked) return;
    (async () => {
      setMsg("");
      const listRes = await fetch("/api/students/list", { cache: "no-store" });
      const listJson = await safeJson(listRes);
      if (!listJson.ok) {
        setMsg(listJson.json?.error || "Failed to load student data");
        return;
      }
      const list = (listJson.json?.students ?? []) as StudentRow[];
      let selectedId = "";
      try {
        selectedId = localStorage.getItem("active_student_id") || "";
      } catch {}
      if (!selectedId) {
        setStudent(null);
        setMsg("Please select student.");
        return;
      }
      const selectedStudent = list.find((s) => String(s.id) === String(selectedId));
      if (!selectedStudent?.id) {
        setStudent(null);
        setMsg("Please select student.");
        return;
      }
      setStudent(selectedStudent);

      const weekStart = getWeekStartUTC();
      const weekStartIso = weekStart.toISOString();

      const [badgesRes, prestigeRes, prestigeProgRes, challengesRes, medalsRes, highlightsRes, attendanceRes, mvpTotalRes, mvpWeekRes, taoluRes, battlesRes, trackersRes] =
        await Promise.all([
          fetch("/api/students/badges", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ student_id: selectedStudent.id }),
          }),
          fetch("/api/achievements/badges", { cache: "no-store" }),
          fetch("/api/students/prestige-progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ student_id: selectedStudent.id }),
          }),
          fetch("/api/students/challenges", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ student_id: selectedStudent.id }),
          }),
          fetch("/api/challenges/medals", { cache: "no-store" }),
          fetch("/api/dashboard/highlights", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ student_id: selectedStudent.id }),
          }),
          fetch("/api/students/attendance-summary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ student_id: selectedStudent.id }),
          }),
          fetch("/api/mvp/count", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ student_id: selectedStudent.id }),
          }),
          fetch("/api/mvp/count", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ student_id: selectedStudent.id, start_date: weekStartIso }),
          }),
          fetch(`/api/taolu/student-summary?student_id=${selectedStudent.id}`, { cache: "no-store" }),
          fetch("/api/skill-tracker/battle/list", { cache: "no-store" }),
          fetch(`/api/skill-tracker/list?student_id=${selectedStudent.id}`, { cache: "no-store" }),
        ]);

      const badgesJson = await safeJson(badgesRes);
      if (badgesJson.ok) setEarnedBadges((badgesJson.json?.earned ?? []) as EarnedBadge[]);

      const prestigeJson = await safeJson(prestigeRes);
      if (prestigeJson.ok) setPrestigeCatalog((prestigeJson.json?.badges ?? []) as BadgeCatalog[]);

      const prestigeProgJson = await safeJson(prestigeProgRes);
      if (prestigeProgJson.ok) setPrestigeProgress((prestigeProgJson.json?.progress ?? {}) as PrestigeProgress);

      const challengesJson = await safeJson(challengesRes);
      if (challengesJson.ok) setEarnedChallenges((challengesJson.json?.rows ?? []) as ChallengeRow[]);

      const medalsJson = await safeJson(medalsRes);
      if (medalsJson.ok) setMedalIcons((medalsJson.json?.medals ?? {}) as MedalMap);

      const highlightsJson = await safeJson(highlightsRes);
      if (highlightsJson.ok) setHighlights((highlightsJson.json?.summary ?? null) as HighlightsSummary | null);

      const attendanceJson = await safeJson(attendanceRes);
      if (attendanceJson.ok) setAttendance((attendanceJson.json ?? null) as AttendanceSummary | null);

      const mvpTotalJson = await safeJson(mvpTotalRes);
      if (mvpTotalJson.ok) setMvpTotal(Number(mvpTotalJson.json?.count ?? 0));

      const mvpWeekJson = await safeJson(mvpWeekRes);
      if (mvpWeekJson.ok) setMvpWeek(Number(mvpWeekJson.json?.count ?? 0));

      const taoluJson = await safeJson(taoluRes);
      if (taoluJson.ok) setTaoluSummary((taoluJson.json ?? null) as TaoluSummary | null);

      const battlesJson = await safeJson(battlesRes);
      if (battlesJson.ok) {
        const rows = (battlesJson.json?.battles ?? battlesJson.json?.rows ?? battlesJson.json?.battle ?? battlesJson.json?.data ?? battlesJson.json?.items ?? battlesJson.json?.list ?? battlesJson.json?.results ?? battlesJson.json?.records ?? battlesJson.json?.entries ?? battlesJson.json?.trackers ?? battlesJson.json?.battles_list ?? battlesJson.json?.battle_list ?? battlesJson.json?.battles ?? []) as BattleRow[];
        const count = (rows ?? []).filter((b) => {
          const participants = Array.isArray(b.participant_ids) ? b.participant_ids.map(String) : [];
          const fallback = [b.left_student_id, b.right_student_id].filter(Boolean).map((id) => String(id));
          const all = participants.length ? participants : fallback;
          if (!all.includes(String(selectedStudent.id))) return false;
          return Boolean(b.settled_at);
        }).length;
        setBattleTotal(count);
      }

      const trackersJson = await safeJson(trackersRes);
      if (trackersJson.ok) {
        const rows = (trackersJson.json?.trackers ?? []) as SkillTrackerRow[];
        const completed = rows.filter((t) => Number(t.attempts ?? 0) >= Number(t.repetitions_target ?? 1)).length;
        setSkillCompletedTotal(completed);
      }
    })();
  }, [checked]);

  const avatarSrc = useMemo(() => {
    const path = String(student?.avatar_storage_path ?? "").trim();
    if (!path) return null;
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return base ? `${base}/storage/v1/object/public/avatars/${path}` : null;
  }, [student?.avatar_storage_path]);
  const avatarZoomPct = Math.max(50, Math.min(200, Number(student?.avatar_zoom_pct ?? 100)));
  const pointsDisplay = Number(student?.points_balance ?? student?.points_total ?? 0);
  const levelDisplay = Number(student?.level ?? 1);
  const initials = (student?.name || "").trim().slice(0, 2).toUpperCase() || "LA";
  const earnedBadgeList = earnedBadges.filter((b) => !b.rescinded_at);
  const earnedSet = useMemo(() => new Set(earnedBadgeList.map((b) => String(b.badge_id))), [earnedBadgeList]);
  const prestigeBadges = useMemo(
    () => prestigeCatalog.filter((b) => String(b.category ?? "").toLowerCase() === "prestige"),
    [prestigeCatalog]
  );

  const medalCounts = useMemo(() => {
    const base: Record<string, number> = {};
    earnedChallenges.forEach((row) => {
      if (!row.completed && row.completed !== undefined) return;
      const tier = String(row.tier ?? "").toLowerCase();
      if (!tier) return;
      base[tier] = (base[tier] ?? 0) + 1;
    });
    return base;
  }, [earnedChallenges]);

  const spotlightTotal = attendance?.awards?.length ?? 0;
  const weekStartIso = useMemo(() => getWeekStartUTC().toISOString().slice(0, 10), []);
  const spotlightWeek = useMemo(() => {
    if (!attendance?.awards?.length) return 0;
    return attendance.awards.filter((a) => String(a.award_date ?? "").slice(0, 10) >= weekStartIso).length;
  }, [attendance, weekStartIso]);

  const taoluTotals = useMemo(() => {
    const sessions = taoluSummary?.session_history ?? [];
    const totalSessions = sessions.length;
    const totalSections = sessions.reduce((sum, s) => sum + (Array.isArray(s.sections) ? s.sections.length : 0), 0);
    const weekStart = getWeekStartUTC().getTime();
    let deductionsWeek = 0;
    sessions.forEach((s) => {
      (s.deductions ?? []).forEach((d) => {
        if (d.voided) return;
        const t = new Date(d.occurred_at).getTime();
        if (!Number.isNaN(t) && t >= weekStart) deductionsWeek += 1;
      });
    });
    return { totalSessions, totalSections, deductionsWeek };
  }, [taoluSummary]);

  return (
    <AuthGate>
      <div className="student-info">
        <style>{pageStyles()}</style>
        <style>{studentNavStyles()}</style>
        <StudentNavPanel />
        <div className="student-info__inner">
          <button className="back-btn" onClick={() => window.history.back()}>Back</button>
          <section className="student-info__split">
            <aside className="student-info__left">
              <div className="left-card">
                <div className="left-card__name">{student?.name ?? "Student"}</div>
                <div className="left-card__label">Level {levelDisplay}</div>
                <div className="left-card__points">{pointsDisplay.toLocaleString()} pts</div>
                <div className="left-card__avatar left-card__avatar-wrap">
                  <AvatarRender
                    size={260}
                    bg="rgba(15,23,42,0.75)"
                    avatarSrc={avatarSrc}
                    avatarZoomPct={avatarZoomPct}
                    showImageBorder={false}
                    style={{ borderRadius: 24 }}
                    fallback={<div className="left-card__avatar-fallback">{initials}</div>}
                  />
                </div>
              </div>
            </aside>

            <div className="student-info__right">
              <div className="stats-row">
                <div className="stats-stack">
                  <div className="stats-card">
                    <div className="stats-card__title">This Week</div>
                    <div className="stats-grid">
                      <div className="stats-cell">
                        <div className="stats-label">Points Earned</div>
                        <div className="stats-value">{highlights?.points_earned ?? 0}</div>
                      </div>
                      <div className="stats-cell">
                        <div className="stats-label">Rule Breakers</div>
                        <div className="stats-value">{highlights?.rule_breaker_count ?? 0}</div>
                      </div>
                      <div className="stats-cell">
                        <div className="stats-label">Rule Keepers</div>
                        <div className="stats-value">{highlights?.rule_keeper_count ?? 0}</div>
                      </div>
                      <div className="stats-cell">
                        <div className="stats-label">Check-ins</div>
                        <div className="stats-value">{highlights?.checkins ?? 0}</div>
                      </div>
                      <div className="stats-cell">
                        <div className="stats-label">Spotlight Stars</div>
                        <div className="stats-value">{spotlightWeek}</div>
                      </div>
                      <div className="stats-cell">
                        <div className="stats-label">Battle MVPs</div>
                        <div className="stats-value">{mvpWeek}</div>
                      </div>
                    </div>
                  </div>

                  <div className="stats-card">
                    <div className="stats-card__title">Total Stats</div>
                    <div className="stats-grid">
                      <div className="stats-cell">
                        <div className="stats-label">Battle MVPs</div>
                        <div className="stats-value">{mvpTotal}</div>
                      </div>
                      <div className="stats-cell">
                        <div className="stats-label">Spotlight Stars</div>
                        <div className="stats-value">{spotlightTotal}</div>
                      </div>
                      <div className="stats-cell">
                        <div className="stats-label">Battle Pulses</div>
                        <div className="stats-value">{battleTotal}</div>
                      </div>
                      <div className="stats-cell">
                        <div className="stats-label">Check-ins</div>
                        <div className="stats-value">{attendance?.checkins?.length ?? 0}</div>
                      </div>
                      <div className="stats-cell">
                        <div className="stats-label">Skill Trees</div>
                        <div className="stats-value">{skillCompletedTotal}</div>
                      </div>
                      <div className="stats-cell">
                        <div className="stats-label">Taolu Sessions</div>
                        <div className="stats-value">{taoluTotals.totalSessions}</div>
                      </div>
                    </div>
                  </div>

                  <div className="badge-row-wrap">
                    <div className="badge-block">
                      <div className="block-title">Prestige Badges</div>
                      <div className="badge-row badge-row--prestige">
                        {prestigeBadges.map((b) => {
                          const earned = earnedSet.has(String(b.id));
                          const progress = prestigeProgress[String(b.id)];
                          const pct = Math.max(0, Math.min(1, Number(progress?.progress ?? (earned ? 1 : 0))));
                          return (
                            <div key={b.id} className={`badge-tile badge-tile--prestige ${earned ? "badge-tile--earned" : "badge-tile--locked"}`}>
                              <div className="badge-tile__img">
                                {b.icon_url ? (
                                  <img src={b.icon_url} alt={b.name ?? "Prestige"} />
                                ) : (
                                  <span>{(b.name ?? "?").slice(0, 1)}</span>
                                )}
                              </div>
                              <div className="badge-progress">
                                <span className="badge-progress__fill" style={{ width: `${pct * 100}%` }} />
                              </div>
                              <div className="badge-progress__text">
                                {progress ? `${progress.current}/${progress.target}` : earned ? "Earned" : "Locked"}
                              </div>
                            </div>
                          );
                        })}
                        {!prestigeBadges.length ? <div className="empty-note">No prestige badges yet</div> : null}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="medal-bar">
                  <div className="block-title">Challenge Medals</div>
                  <div className="medal-row medal-row--vertical">
                    {Object.entries(medalIcons).map(([tier, url]) => (
                      <div key={tier} className="medal-tile">
                        {url ? <img src={url} alt={tier} /> : <span>{tier.slice(0, 1).toUpperCase()}</span>}
                        <div className="medal-count">{medalCounts[tier.toLowerCase()] ?? 0}</div>
                        <div className="medal-label">{tier}</div>
                      </div>
                    ))}
                    {!Object.keys(medalIcons).length ? <div className="empty-note">No medals yet</div> : null}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {msg ? <div className="student-info__note">{msg}</div> : null}
        </div>
      </div>
    </AuthGate>
  );
}

function pageStyles() {
  return `
    .student-info {
      min-height: 80vh;
      padding: 36px 40px 60px 260px;
      display: flex;
      justify-content: flex-start;
      width: 100%;
    }

    .student-info__inner {
      width: 100%;
      max-width: none;
      display: grid;
      gap: 20px;
    }

    .back-btn {
      justify-self: start;
      padding: 8px 12px;
      border-radius: 12px;
      border: 1px solid rgba(148,163,184,0.2);
      background: rgba(30,41,59,0.7);
      color: inherit;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      font-size: 11px;
    }

    .student-info__top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }

    .student-info__name {
      font-size: clamp(28px, 4vw, 46px);
      font-weight: 1000;
      letter-spacing: 0.6px;
    }


    .student-info__split {
      display: grid;
      grid-template-columns: minmax(0, 1.05fr) minmax(0, 2.95fr);
      gap: 22px;
      align-items: start;
    }

    .student-info__left {
      display: grid;
      gap: 16px;
    }

    .left-card {
      padding: 22px;
      border-radius: 22px;
      background: rgba(15,23,42,0.95);
      border: 1px solid rgba(148,163,184,0.18);
      display: grid;
      gap: 12px;
      align-content: start;
      min-height: 520px;
      justify-items: center;
      text-align: center;
    }

    .left-card__label {
      font-size: 22px;
      font-weight: 900;
      opacity: 0.85;
    }

    .left-card__points {
      font-size: 34px;
      font-weight: 1000;
    }

    .left-card__avatar {
      margin-top: 10px;
      display: grid;
      place-items: center;
    }

    .left-card__name {
      font-size: clamp(30px, 3.5vw, 48px);
      font-weight: 1000;
      letter-spacing: 0.6px;
    }

    .left-card__avatar-wrap {
      position: relative;
      padding: 16px;
      border-radius: 28px;
      background: radial-gradient(circle at top, rgba(56,189,248,0.15), rgba(15,23,42,0.0));
      box-shadow: 0 0 30px rgba(56,189,248,0.35);
    }

    .left-card__avatar-wrap::before {
      content: "";
      position: absolute;
      inset: 8px;
      border-radius: 22px;
      border: 2px solid rgba(56,189,248,0.4);
      box-shadow: 0 0 16px rgba(56,189,248,0.45);
      pointer-events: none;
    }

    .left-card__avatar-wrap::after {
      content: "";
      position: absolute;
      inset: -6px;
      border-radius: 30px;
      background: radial-gradient(circle, rgba(56,189,248,0.25), rgba(15,23,42,0));
      filter: blur(10px);
      opacity: 0.8;
      pointer-events: none;
    }

    .left-card__avatar-fallback {
      width: 220px;
      height: 220px;
      border-radius: 24px;
      display: grid;
      place-items: center;
      font-weight: 900;
      font-size: 36px;
      background: rgba(30,41,59,0.8);
    }

    .student-info__right {
      display: grid;
      gap: 16px;
    }

    .stats-card {
      padding: 18px;
      border-radius: 20px;
      background: rgba(15,23,42,0.9);
      border: 1px solid rgba(148,163,184,0.18);
      display: grid;
      gap: 12px;
    }

    .stats-card__title {
      font-weight: 900;
      letter-spacing: 0.8px;
      font-size: 14px;
      text-transform: uppercase;
      opacity: 0.8;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
    }

    .stats-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 220px;
      gap: 16px;
      align-items: start;
    }

    .stats-stack {
      display: grid;
      gap: 16px;
    }

    .stats-cell {
      padding: 12px;
      border-radius: 14px;
      background: rgba(30,41,59,0.7);
      border: 1px solid rgba(148,163,184,0.16);
      display: grid;
      gap: 6px;
    }

    .stats-label {
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      opacity: 0.7;
    }

    .stats-value {
      font-size: 20px;
      font-weight: 1000;
    }

    .badge-row-wrap {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 16px;
    }

    .badge-block {
      padding: 18px;
      border-radius: 20px;
      background: rgba(15,23,42,0.9);
      border: 1px solid rgba(148,163,184,0.18);
      display: grid;
      gap: 12px;
    }

    .block-title {
      font-size: 14px;
      font-weight: 900;
      letter-spacing: 1px;
      text-transform: uppercase;
      opacity: 0.8;
    }

    .badge-row {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }

    .badge-tile {
      width: 86px;
      padding: 10px;
      border-radius: 18px;
      position: relative;
      display: grid;
      place-items: center;
      background: rgba(30,41,59,0.7);
      border: 1px solid rgba(148,163,184,0.18);
      overflow: hidden;
      gap: 6px;
      text-align: center;
    }

    .badge-tile__img {
      width: 64px;
      height: 64px;
      display: grid;
      place-items: center;
    }

    .badge-tile img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .badge-tile--prestige {
      box-shadow: 0 0 18px rgba(251,191,36,0.35);
    }

    .badge-tile--locked {
      filter: grayscale(1);
      opacity: 0.45;
    }

    .badge-row--prestige {
      flex-wrap: nowrap;
      overflow-x: auto;
      padding-bottom: 6px;
    }

    .badge-tile--earned::after {
      content: "";
      position: absolute;
      width: 120px;
      height: 120px;
      background: radial-gradient(circle, rgba(56,189,248,0.35), rgba(56,189,248,0));
      animation: sparkle 3s ease-in-out infinite;
      opacity: 0.8;
      pointer-events: none;
    }

    .badge-progress {
      width: 100%;
      height: 6px;
      border-radius: 999px;
      background: rgba(255,255,255,0.12);
      overflow: hidden;
    }

    .badge-progress__fill {
      display: block;
      height: 100%;
      background: linear-gradient(90deg, rgba(56,189,248,0.9), rgba(34,197,94,0.8));
    }

    .badge-progress__text {
      font-size: 10px;
      font-weight: 900;
      opacity: 0.7;
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }

    .medal-row {
      display: flex;
      gap: 18px;
      flex-wrap: wrap;
    }

    .medal-bar {
      padding: 18px 12px;
      border-radius: 20px;
      background: rgba(15,23,42,0.9);
      border: 1px solid rgba(148,163,184,0.18);
      display: grid;
      gap: 12px;
      align-content: start;
      height: 100%;
    }

    .medal-row--vertical {
      flex-direction: column;
      align-items: center;
    }

    .medal-tile {
      width: 110px;
      padding: 12px;
      border-radius: 18px;
      background: rgba(30,41,59,0.7);
      border: 1px solid rgba(148,163,184,0.18);
      display: grid;
      gap: 6px;
      place-items: center;
    }

    .medal-tile img {
      width: 54px;
      height: 54px;
      object-fit: contain;
    }

    .medal-count {
      font-size: 22px;
      font-weight: 1000;
    }

    .medal-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      opacity: 0.7;
    }

    .empty-note {
      font-size: 13px;
      opacity: 0.65;
    }

    .student-info__note {
      padding: 10px 12px;
      border-radius: 14px;
      background: rgba(239,68,68,0.12);
      border: 1px solid rgba(239,68,68,0.3);
      font-weight: 900;
      font-size: 12px;
    }

    @media (max-width: 1100px) {
      .student-info {
        padding: 30px 18px 50px;
      }
      .student-info__split {
        grid-template-columns: 1fr;
      }
      .stats-row {
        grid-template-columns: 1fr;
      }
      .medal-bar {
        height: auto;
      }
    }

    @keyframes sparkle {
      0% { transform: scale(0.9); opacity: 0.4; }
      50% { transform: scale(1.05); opacity: 0.8; }
      100% { transform: scale(0.9); opacity: 0.4; }
    }
  `;
}

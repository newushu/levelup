"use client";

import { useEffect, useMemo, useState } from "react";
import AuthGate from "../../../components/AuthGate";
import AvatarRender from "@/components/AvatarRender";
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
  rule_breaker_points: number;
  rule_keeper_count: number;
  rule_keeper_points: number;
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
type SeasonSettings = {
  start_date?: string | null;
};
type LeaderboardEntry = {
  student_id: string;
  name: string;
  points: number;
  level: number;
  rank?: number;
};
type LeaderboardPayload = {
  total?: LeaderboardEntry[];
  weekly?: LeaderboardEntry[];
  lifetime?: LeaderboardEntry[];
  skill_pulse_today?: LeaderboardEntry[];
  mvp?: LeaderboardEntry[];
  [key: string]: LeaderboardEntry[] | undefined;
};
type DailyRedeemStatus = {
  can_redeem: boolean;
  available_points: number;
  next_redeem_at: string;
  cooldown_ms: number;
  leaderboard_points: number;
  avatar_points: number;
  leaderboard_boards: string[];
  leaderboard_awards?: Array<{ board_key: string; board_points: number; rank: number }>;
  contribution_chips: string[];
  avatar_name: string;
  modifiers: {
    rule_keeper_multiplier: number;
    rule_breaker_multiplier: number;
    spotlight_multiplier: number;
    skill_pulse_multiplier: number;
    daily_free_points: number;
    challenge_completion_bonus_pct: number;
    mvp_bonus_pct: number;
    base_skill_pulse_points_per_rep: number;
    skill_pulse_points_per_rep: number;
  };
};
type UnlockCriteriaDef = {
  key: string;
  label: string;
  description?: string | null;
  enabled?: boolean;
};
type UnlockRequirement = {
  item_type: string;
  item_key: string;
  criteria_key: string;
};
type StudentCriteriaState = {
  criteria_key: string;
  fulfilled?: boolean;
  note?: string | null;
  fulfilled_at?: string | null;
};
const medalTierOrder = ["bronze", "silver", "gold", "platinum", "diamond", "master"];

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
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [studentQuery, setStudentQuery] = useState("");
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
  const [mvpBadgeUrl, setMvpBadgeUrl] = useState<string | null>(null);
  const [recentMvp, setRecentMvp] = useState(false);
  const [seasonSettings, setSeasonSettings] = useState<SeasonSettings | null>(null);
  const [leaderboards, setLeaderboards] = useState<LeaderboardPayload | null>(null);
  const [leaderboardLabels, setLeaderboardLabels] = useState<Record<string, string>>({});
  const [avatarCatalog, setAvatarCatalog] = useState<
    Array<{
      id: string;
      storage_path: string | null;
      enabled?: boolean | null;
      name?: string | null;
      rule_keeper_multiplier?: number | null;
      rule_breaker_multiplier?: number | null;
      skill_pulse_multiplier?: number | null;
      spotlight_multiplier?: number | null;
      daily_free_points?: number | null;
      challenge_completion_bonus_pct?: number | null;
      mvp_bonus_pct?: number | null;
      unlock_level?: number | null;
      unlock_points?: number | null;
      limited_event_only?: boolean | null;
      limited_event_name?: string | null;
      limited_event_description?: string | null;
    }>
  >([]);
  const [avatarId, setAvatarId] = useState("");
  const [avatarBg, setAvatarBg] = useState("rgba(15,23,42,0.75)");
  const [avatarEffectKey, setAvatarEffectKey] = useState<string | null>(null);
  const [cornerBorderKey, setCornerBorderKey] = useState<string | null>(null);
  const [effectCatalog, setEffectCatalog] = useState<Array<{ key: string; name?: string | null; unlock_level?: number | null; unlock_points?: number | null; config?: any; render_mode?: string | null; z_layer?: string | null; html?: string | null; css?: string | null; js?: string | null; enabled?: boolean | null; limited_event_only?: boolean | null; limited_event_name?: string | null; limited_event_description?: string | null }>>([]);
  const [cornerBorders, setCornerBorders] = useState<Array<{ key: string; name?: string | null; image_url?: string | null; render_mode?: string | null; z_layer?: string | null; html?: string | null; css?: string | null; js?: string | null; offset_x?: number | null; offset_y?: number | null; offsets_by_context?: Record<string, { x?: number | null; y?: number | null; scale?: number | null; rotate?: number | null }> | null; unlock_level?: number | null; unlock_points?: number | null; enabled?: boolean | null }>>([]);
  const [customUnlocks, setCustomUnlocks] = useState<Array<{ item_type: string; item_key: string }>>([]);
  const [criteriaDefs, setCriteriaDefs] = useState<UnlockCriteriaDef[]>([]);
  const [itemRequirements, setItemRequirements] = useState<UnlockRequirement[]>([]);
  const [studentCriteria, setStudentCriteria] = useState<StudentCriteriaState[]>([]);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [avatarPickerTab, setAvatarPickerTab] = useState<"avatar" | "effect" | "border">("avatar");
  const [pickerBusyKey, setPickerBusyKey] = useState("");
  const [dailyRedeem, setDailyRedeem] = useState<DailyRedeemStatus | null>(null);
  const [redeemBurst, setRedeemBurst] = useState<{ points: number; text: string } | null>(null);
  const [leaderboardDetailOpen, setLeaderboardDetailOpen] = useState(false);
  const [redeemingDaily, setRedeemingDaily] = useState(false);
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
      setStudents(list);
      let selectedId = "";
      try {
        selectedId = localStorage.getItem("active_student_id") || "";
      } catch {}
      if (!selectedId) {
        setStudent(null);
        setStudentQuery("");
        setMsg("Please select student.");
        return;
      }
      const selectedStudent = list.find((s) => String(s.id) === String(selectedId));
      if (!selectedStudent?.id) {
        setStudent(null);
        setStudentQuery("");
        setMsg("Please select student.");
        return;
      }
      setStudent(selectedStudent);
      setStudentQuery(selectedStudent.name);
    })();
  }, [checked]);

  useEffect(() => {
    (async () => {
      const [avatarsRes, effectsRes, bordersRes] = await Promise.all([
        fetch("/api/avatars/list", { cache: "no-store" }),
        fetch("/api/avatar-effects/list", { cache: "no-store" }),
        fetch("/api/corner-borders", { cache: "no-store" }),
      ]);
      const avatarsJson = await avatarsRes.json().catch(() => ({}));
      if (avatarsRes.ok) setAvatarCatalog((avatarsJson?.avatars ?? []) as any[]);
      const effectsJson = await effectsRes.json().catch(() => ({}));
      if (effectsRes.ok) setEffectCatalog((effectsJson?.effects ?? []) as any[]);
      const bordersJson = await bordersRes.json().catch(() => ({}));
      if (bordersRes.ok) setCornerBorders((bordersJson?.borders ?? []) as any[]);
    })();
  }, []);

  useEffect(() => {
    if (!student?.id) return;
    (async () => {
      const settingsRes = await fetch("/api/avatar/get", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: student.id }),
      });
      const settingsJson = await settingsRes.json().catch(() => ({}));
      if (settingsRes.ok) {
        const s = settingsJson?.settings ?? null;
        setAvatarId(String(s?.avatar_id ?? "").trim());
        const bg = String(s?.bg_color ?? "").trim();
        setAvatarBg(bg || "rgba(15,23,42,0.75)");
        const effectKey = String(s?.particle_style ?? "").trim();
        setAvatarEffectKey(effectKey || null);
        const borderKey = String(s?.corner_border_key ?? "").trim();
        setCornerBorderKey(borderKey || null);
      }
    })();
  }, [student?.id]);

  useEffect(() => {
    if (!student?.id) return;
    (async () => {
      const res = await fetch("/api/unlocks/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: student.id }),
      });
      const sj = await safeJson(res);
      if (!sj.ok) return;
      setCustomUnlocks((sj.json?.custom_unlocks ?? []) as Array<{ item_type: string; item_key: string }>);
      setCriteriaDefs((sj.json?.criteria_definitions ?? []) as UnlockCriteriaDef[]);
      setItemRequirements((sj.json?.item_requirements ?? []) as UnlockRequirement[]);
      setStudentCriteria((sj.json?.student_criteria ?? []) as StudentCriteriaState[]);
    })();
  }, [student?.id]);

  useEffect(() => {
    if (!student?.id) return;
    (async () => {
      const studentId = String(student.id);
      const weekStart = getWeekStartUTC();
      const weekStartIso = weekStart.toISOString();

      const [badgesRes, prestigeRes, prestigeProgRes, challengesRes, medalsRes, highlightsRes, attendanceRes, mvpTotalRes, mvpWeekRes, taoluRes, battlesRes, trackersRes, mvpBadgeRes, dailyStatusRes, seasonRes, leaderboardRes] =
        await Promise.all([
          fetch("/api/students/badges", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ student_id: studentId }),
          }),
          fetch("/api/achievements/badges", { cache: "no-store" }),
          fetch("/api/students/prestige-progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ student_id: studentId }),
          }),
          fetch("/api/students/challenges", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ student_id: studentId }),
          }),
          fetch("/api/challenges/medals", { cache: "no-store" }),
          fetch("/api/dashboard/highlights", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ student_id: studentId }),
          }),
          fetch("/api/students/attendance-summary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ student_id: studentId }),
          }),
          fetch("/api/mvp/count", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ student_id: studentId }),
          }),
          fetch("/api/mvp/count", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ student_id: studentId, start_date: weekStartIso }),
          }),
          fetch(`/api/taolu/student-summary?student_id=${studentId}`, { cache: "no-store" }),
          fetch("/api/skill-tracker/battle/list", { cache: "no-store" }),
          fetch(`/api/skill-tracker/list?student_id=${studentId}`, { cache: "no-store" }),
          fetch("/api/student/mvp-badge", { cache: "no-store" }),
          fetch("/api/avatar/daily-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ student_id: studentId }),
          }),
          fetch("/api/season-settings", { cache: "no-store" }),
          fetch("/api/leaderboard", { cache: "no-store" }),
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
          if (!all.includes(studentId)) return false;
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

      const mvpBadgeJson = await safeJson(mvpBadgeRes);
      if (mvpBadgeJson.ok) setMvpBadgeUrl(String(mvpBadgeJson.json?.badge_url ?? "") || null);
      const dailyStatusJson = await safeJson(dailyStatusRes);
      if (dailyStatusJson.ok) setDailyRedeem((dailyStatusJson.json?.status ?? null) as DailyRedeemStatus | null);
      else setDailyRedeem(null);
      const seasonJson = await safeJson(seasonRes);
      if (seasonJson.ok) setSeasonSettings((seasonJson.json?.settings ?? null) as SeasonSettings | null);
      const leaderboardJson = await safeJson(leaderboardRes);
      if (leaderboardJson.ok) {
        setLeaderboards((leaderboardJson.json?.leaderboards ?? null) as LeaderboardPayload | null);
        setLeaderboardLabels((leaderboardJson.json?.leaderboard_labels ?? {}) as Record<string, string>);
      }
      const recentStart = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      const recentMvpRes = await fetch("/api/mvp/count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: student.id, start_date: recentStart }),
      });
      const recentMvpJson = await safeJson(recentMvpRes);
      setRecentMvp(recentMvpJson.ok ? Number(recentMvpJson.json?.count ?? 0) > 0 : false);
    })();
  }, [student?.id]);

  const avatarSrc = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!base) return null;
    if (avatarId) {
      const row = avatarCatalog.find((a) => String(a.id) === String(avatarId));
      const mapped = String(row?.storage_path ?? "").trim();
      if (mapped) return `${base}/storage/v1/object/public/avatars/${mapped}`;
    }
    const path = String(student?.avatar_storage_path ?? "").trim();
    if (!path) return null;
    return `${base}/storage/v1/object/public/avatars/${path}`;
  }, [avatarId, avatarCatalog, student?.avatar_storage_path]);

  const selectedEffect = useMemo(() => {
    if (!avatarEffectKey) return null;
    return effectCatalog.find((e) => String(e.key) === String(avatarEffectKey)) ?? { key: avatarEffectKey };
  }, [avatarEffectKey, effectCatalog]);

  const selectedBorder = useMemo(() => {
    if (!cornerBorderKey) return null;
    return cornerBorders.find((b) => String(b.key) === String(cornerBorderKey) && b.enabled !== false) ?? null;
  }, [cornerBorderKey, cornerBorders]);
  const selectedAvatarMeta = useMemo(
    () => avatarCatalog.find((a) => String(a.id) === String(avatarId)) ?? null,
    [avatarCatalog, avatarId]
  );
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

  const weeklySpotlightBasePoints = useMemo(
    () => (attendance?.awards ?? []).reduce((sum, a) => sum + Math.max(0, Number(a.points_awarded ?? 0)), 0),
    [attendance]
  );
  const currentRuleBasePoints = useMemo(() => {
    const start = seasonSettings?.start_date ? new Date(`${seasonSettings.start_date}T00:00:00`) : null;
    if (!start || Number.isNaN(start.getTime())) return 5;
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const week = Math.max(1, Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1);
    return Math.min(50, Math.max(5, week * 5));
  }, [seasonSettings?.start_date]);
  const ruleKeeperBasePoints = currentRuleBasePoints;
  const ruleBreakerBasePoints = currentRuleBasePoints;
  const normalizeMultiplier = (value: any, fallback = 1) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const ruleKeeperMultiplier = normalizeMultiplier(
    dailyRedeem?.modifiers?.rule_keeper_multiplier ?? selectedAvatarMeta?.rule_keeper_multiplier ?? 1,
    1
  );
  const ruleBreakerMultiplier = normalizeMultiplier(
    dailyRedeem?.modifiers?.rule_breaker_multiplier ?? selectedAvatarMeta?.rule_breaker_multiplier ?? 1,
    1
  );
  const spotlightMultiplier = normalizeMultiplier(
    dailyRedeem?.modifiers?.spotlight_multiplier ?? selectedAvatarMeta?.spotlight_multiplier ?? 1,
    1
  );
  const challengeBonusPct = Math.max(
    0,
    Number(dailyRedeem?.modifiers?.challenge_completion_bonus_pct ?? selectedAvatarMeta?.challenge_completion_bonus_pct ?? 0)
  );
  const mvpBonusPct = Math.max(0, Number(dailyRedeem?.modifiers?.mvp_bonus_pct ?? selectedAvatarMeta?.mvp_bonus_pct ?? 0));
  const skillPerRepBase = Math.max(0, Number(dailyRedeem?.modifiers?.base_skill_pulse_points_per_rep ?? 2));
  const skillPerRepFinal = Math.max(0, Number(dailyRedeem?.modifiers?.skill_pulse_points_per_rep ?? skillPerRepBase));
  const ruleKeeperFinalPoints = Math.round(ruleKeeperBasePoints * ruleKeeperMultiplier);
  const ruleBreakerFinalPoints = Math.round(ruleBreakerBasePoints * ruleBreakerMultiplier);
  const spotlightFinalPoints = Math.round(weeklySpotlightBasePoints * spotlightMultiplier);
  const ruleKeeperChanged = ruleKeeperFinalPoints !== ruleKeeperBasePoints;
  const ruleBreakerChanged = ruleBreakerFinalPoints !== ruleBreakerBasePoints;
  const leaderboardLabelByKey: Record<string, string> = {
    total: "Total Points",
    weekly: "Weekly Points",
    lifetime: "Lifetime Points",
    skill_pulse_today: "Skill Pulse Today",
    mvp: "Battle MVP",
  };

  const fulfilledCriteriaKeys = useMemo(() => {
    return new Set(
      studentCriteria
        .filter((c) => c.fulfilled !== false)
        .map((c) => String(c.criteria_key ?? "").trim())
        .filter(Boolean)
    );
  }, [studentCriteria]);

  const criteriaByItem = useMemo(() => {
    const map = new Map<string, string[]>();
    itemRequirements.forEach((row) => {
      const itemType = String(row.item_type ?? "").trim();
      const itemKey = String(row.item_key ?? "").trim();
      const criteriaKey = String(row.criteria_key ?? "").trim();
      if (!itemType || !itemKey || !criteriaKey) return;
      const k = `${itemType}:${itemKey}`;
      const arr = map.get(k) ?? [];
      arr.push(criteriaKey);
      map.set(k, arr);
    });
    return map;
  }, [itemRequirements]);

  const customUnlockSet = useMemo(() => {
    return new Set(customUnlocks.map((u) => `${u.item_type}:${u.item_key}`));
  }, [customUnlocks]);

  function getItemUnlockState(itemType: "avatar" | "effect" | "corner_border", itemKey: string, unlockLevel: number, unlockPoints: number) {
    const level = Math.max(1, Number(levelDisplay ?? 1));
    const levelOk = level >= Math.max(1, Number(unlockLevel ?? 1));
    const needsPointsPurchase = Math.max(0, Number(unlockPoints ?? 0)) > 0;
    const customUnlocked = customUnlockSet.has(`${itemType}:${itemKey}`);
    const reqKeys = Array.from(new Set(criteriaByItem.get(`${itemType}:${itemKey}`) ?? []));
    const hasCriteriaReq = reqKeys.length > 0;
    const criteriaMatched = hasCriteriaReq && reqKeys.every((k) => fulfilledCriteriaKeys.has(k));
    const unlockedByDefault = !needsPointsPurchase && levelOk;
    const unlocked = customUnlocked || criteriaMatched || unlockedByDefault;
    return {
      unlocked,
      customUnlocked,
      criteriaMatched,
      hasCriteriaReq,
      requiredCriteriaKeys: reqKeys,
      levelOk,
      needsPointsPurchase,
    };
  }

  async function refreshUnlockContext() {
    if (!student?.id) return;
    const res = await fetch("/api/unlocks/context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: student.id }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return;
    setCustomUnlocks((sj.json?.custom_unlocks ?? []) as Array<{ item_type: string; item_key: string }>);
    setCriteriaDefs((sj.json?.criteria_definitions ?? []) as UnlockCriteriaDef[]);
    setItemRequirements((sj.json?.item_requirements ?? []) as UnlockRequirement[]);
    setStudentCriteria((sj.json?.student_criteria ?? []) as StudentCriteriaState[]);
  }

  async function unlockItem(itemType: "avatar" | "effect" | "corner_border", itemKey: string) {
    if (!student?.id || !itemKey) return;
    setPickerBusyKey(`${itemType}:${itemKey}:unlock`);
    const res = await fetch("/api/unlocks/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: student.id, item_type: itemType, item_key: itemKey }),
    });
    const sj = await safeJson(res);
    setPickerBusyKey("");
    if (!sj.ok) {
      setMsg(String(sj.json?.error ?? "Unlock failed"));
      return;
    }
    setMsg("Unlocked.");
    await refreshUnlockContext();
  }

  async function applyAvatar(avatarIdToUse: string) {
    if (!student?.id || !avatarIdToUse) return;
    setPickerBusyKey(`avatar:${avatarIdToUse}:apply`);
    const res = await fetch("/api/avatar/set", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: student.id, avatar_id: avatarIdToUse }),
    });
    const sj = await safeJson(res);
    setPickerBusyKey("");
    if (!sj.ok) return setMsg(String(sj.json?.error ?? "Failed to apply avatar"));
    setAvatarId(avatarIdToUse);
    setMsg("Avatar updated.");
  }

  async function applyStylePatch(patch: { particle_style?: string; corner_border_key?: string }) {
    if (!student?.id) return;
    setPickerBusyKey(`style:${patch.particle_style ?? patch.corner_border_key ?? "x"}`);
    const res = await fetch("/api/avatar/style", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: student.id, ...patch }),
    });
    const sj = await safeJson(res);
    setPickerBusyKey("");
    if (!sj.ok) return setMsg(String(sj.json?.error ?? "Failed to apply style"));
    if (patch.particle_style !== undefined) setAvatarEffectKey(patch.particle_style === "none" ? null : patch.particle_style);
    if (patch.corner_border_key !== undefined) setCornerBorderKey(patch.corner_border_key === "none" ? null : patch.corner_border_key);
    setMsg("Style updated.");
  }

  async function redeemDailyPoints() {
    if (!student?.id || !dailyRedeem?.can_redeem || redeemingDaily) return;
    setRedeemingDaily(true);
    setMsg("");
    try {
      const res = await fetch("/api/avatar/daily-redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: student.id }),
      });
      const sj = await safeJson(res);
      if (!sj.ok) {
        setMsg(String(sj.json?.error ?? "Redeem failed"));
        return;
      }
      const redeemedPts = Number(sj.json?.points ?? 0);
      setMsg(`✨ Redeemed +${redeemedPts} points`);
      setRedeemBurst({
        points: redeemedPts,
        text: `+${redeemedPts} Redeemed`,
      });
      window.setTimeout(() => setRedeemBurst(null), 1350);

      const [listRes, statusRes, leaderboardRes] = await Promise.all([
        fetch("/api/students/list", { cache: "no-store" }),
        fetch("/api/avatar/daily-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ student_id: student.id }),
        }),
        fetch("/api/leaderboard", { cache: "no-store" }),
      ]);
      const listJson = await safeJson(listRes);
      if (listJson.ok) {
        const list = (listJson.json?.students ?? []) as StudentRow[];
        setStudents(list);
        const selected = list.find((s) => String(s.id) === String(student.id));
        if (selected) setStudent(selected);
      }
      const statusJson = await safeJson(statusRes);
      if (statusJson.ok) setDailyRedeem((statusJson.json?.status ?? null) as DailyRedeemStatus | null);
      const leaderboardJson = await safeJson(leaderboardRes);
      if (leaderboardJson.ok) {
        setLeaderboards((leaderboardJson.json?.leaderboards ?? null) as LeaderboardPayload | null);
        setLeaderboardLabels((leaderboardJson.json?.leaderboard_labels ?? {}) as Record<string, string>);
      }
    } finally {
      setRedeemingDaily(false);
    }
  }

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
      <div className="student-info">
        <style>{pageStyles()}</style>
        <style>{studentWorkspaceTopBarStyles()}</style>
        <div className="student-info__inner">
          <StudentWorkspaceTopBar
            student={student}
            onClearStudent={clearSelectedStudent}
            onSelectStudent={() => selectStudentByName(studentQuery)}
            onSelectStudentByName={selectStudentByName}
            students={students}
            recentMvp={recentMvp}
          />
          <section className="student-info__split">
            <aside className="student-info__left">
              <div className="left-card">
                <div className="left-card__name">{student?.name ?? "Student"}</div>
                <div className="left-card__label">Level {levelDisplay}</div>
                <div className="left-card__points">{pointsDisplay.toLocaleString()} pts</div>
                <div className="left-card__avatar left-card__avatar-wrap">
                  <AvatarRender
                    size={260}
                    bg={avatarBg}
                    avatarSrc={avatarSrc}
                    avatarZoomPct={avatarZoomPct}
                    effect={selectedEffect as any}
                    border={selectedBorder as any}
                    showImageBorder={false}
                    style={{ borderRadius: 24 }}
                    contextKey="student_info"
                    fallback={<div className="left-card__avatar-fallback">{initials}</div>}
                  />
                </div>
                <button
                  type="button"
                  className="redeem-detail-btn"
                  onClick={() => setAvatarPickerOpen(true)}
                  style={{ marginTop: 8 }}
                >
                  Change Avatar Style
                </button>
                <div className="modifier-grid">
                  <div className="modifier-tile modifier-tile--keeper">
                    <div className="modifier-tile__label">Rule Keeper</div>
                    <div className="modifier-tile__value">
                      {ruleKeeperChanged ? <s>+{ruleKeeperBasePoints}</s> : null} +{ruleKeeperFinalPoints}
                    </div>
                  </div>
                  <div className="modifier-tile modifier-tile--breaker">
                    <div className="modifier-tile__label">Rule Breaker</div>
                    <div className="modifier-tile__value">
                      {ruleBreakerChanged ? <s>-{ruleBreakerBasePoints}</s> : null} -{ruleBreakerFinalPoints}
                    </div>
                  </div>
                  <div className="modifier-tile modifier-tile--spotlight">
                    <div className="modifier-tile__label">Spotlight Stars</div>
                    <div className="modifier-tile__value">
                      {spotlightFinalPoints !== weeklySpotlightBasePoints ? <s>{weeklySpotlightBasePoints}</s> : null}
                      {spotlightFinalPoints}
                    </div>
                  </div>
                  <div className="modifier-tile modifier-tile--skill">
                    <div className="modifier-tile__label">Skill Pulse / Rep</div>
                    <div className="modifier-tile__value">
                      {skillPerRepFinal !== skillPerRepBase ? <s>{skillPerRepBase}</s> : null}
                      {skillPerRepFinal}
                    </div>
                  </div>
                  <div className="modifier-tile modifier-tile--challenge">
                    <div className="modifier-tile__label">Challenge Bonus</div>
                    <div className="modifier-tile__value">{Math.round(challengeBonusPct)}%</div>
                  </div>
                  <div className="modifier-tile modifier-tile--mvpbonus">
                    <div className="modifier-tile__label">MVP Bonus</div>
                    <div className="modifier-tile__value">{Math.round(mvpBonusPct)}%</div>
                  </div>
                  <div className="modifier-tile modifier-tile--daily">
                    <div className="modifier-tile__label">Free Daily Points</div>
                    <div className="modifier-tile__value">
                      +{Math.round(Number(dailyRedeem?.modifiers?.daily_free_points ?? selectedAvatarMeta?.daily_free_points ?? 0))}
                    </div>
                  </div>
                </div>
                <div className="redeem-card">
                  <div className="redeem-card__head">
                    <div className="redeem-card__title">Daily Points to Redeem</div>
                    <div className="redeem-card__pts">+{Math.round(Number(dailyRedeem?.available_points ?? 0))}</div>
                  </div>
                  <div className="redeem-card__chips">
                    {(dailyRedeem?.contribution_chips ?? []).map((chip) => (
                      <span key={chip} className="redeem-chip">{chip}</span>
                    ))}
                  </div>
                  <button className="redeem-detail-btn" onClick={() => setLeaderboardDetailOpen(true)}>
                    Leaderboard Details
                  </button>
                  <button
                    className={`redeem-btn ${dailyRedeem?.can_redeem ? "redeem-btn--active" : ""}`}
                    onClick={redeemDailyPoints}
                    disabled={!dailyRedeem?.can_redeem || redeemingDaily}
                  >
                    {redeemingDaily ? "Redeeming..." : dailyRedeem?.can_redeem ? "Redeem Now" : "Not Ready"}
                  </button>
                  {!dailyRedeem?.can_redeem && dailyRedeem?.next_redeem_at ? (
                    <div className="redeem-next">Next: {new Date(dailyRedeem.next_redeem_at).toLocaleString()}</div>
                  ) : null}
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
                      <div className="stats-cell stats-cell--rule-breaker">
                        <div className="stats-label">Rule Breakers</div>
                        <div className="stats-value">{highlights?.rule_breaker_count ?? 0}</div>
                      </div>
                      <div className="stats-cell stats-cell--rule-keeper">
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
                      <div className="stats-cell stats-cell--mvp">
                        <div className="stats-label">Battle MVPs</div>
                        <div className="stats-value stats-value--mvp">
                          {mvpTotal}
                          <span className="mvp-badge-inline">
                            {mvpBadgeUrl ? <img src={mvpBadgeUrl} alt="MVP badge" /> : "MVP"}
                          </span>
                        </div>
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
                          const progressPrimary = progress
                            ? `${Number(progress.current ?? 0).toLocaleString()} / ${Number(progress.target ?? 0).toLocaleString()}`
                            : earned
                            ? "Earned"
                            : "0 / 0";
                          const progressSecondary = progress?.detail
                            ? progress.detail
                            : null;
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
                              <div className="badge-title" title={b.name ?? ""}>{b.name ?? "Prestige"}</div>
                              <div className="badge-progress__text" title={progress?.detail ?? ""}>
                                {progressPrimary}
                              </div>
                              {progressSecondary ? <div className="badge-progress__detail">{progressSecondary}</div> : null}
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
                    {medalTierOrder.map((tier) => (
                      <div key={tier} className={`medal-tile ${tier === "gold" || tier === "platinum" || tier === "diamond" || tier === "master" ? `medal-tile--sparkle medal-tile--${tier}` : ""}`}>
                        {medalIcons[tier] ? <img src={String(medalIcons[tier])} alt={tier} /> : <span>{tier.slice(0, 1).toUpperCase()}</span>}
                        <div className="medal-count">{medalCounts[tier] ?? 0}</div>
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
        {redeemBurst ? (
          <div className="redeem-burst">
            <div className="redeem-burst__card">{redeemBurst.text}</div>
          </div>
        ) : null}
        {leaderboardDetailOpen ? (
          <div className="leaderboard-detail-overlay" onClick={() => setLeaderboardDetailOpen(false)}>
            <div className="leaderboard-detail-panel" onClick={(e) => e.stopPropagation()}>
              <button className="leaderboard-detail-close" onClick={() => setLeaderboardDetailOpen(false)}>×</button>
              <div className="leaderboard-detail-title">Top 10 Leaderboard Details</div>
              {(dailyRedeem?.leaderboard_boards ?? []).length ? (
                <div className="leaderboard-detail-grid">
                  {(dailyRedeem?.leaderboard_boards ?? []).map((key) => {
                    const label = leaderboardLabels[key] ?? leaderboardLabelByKey[key] ?? key;
                    const rows = (leaderboards?.[key as keyof LeaderboardPayload] ?? []) as LeaderboardEntry[];
                    const myIndex = rows.findIndex((row) => String(row.student_id) === String(student?.id ?? ""));
                    return (
                      <div key={key} className="leaderboard-detail-board">
                        <div className="leaderboard-detail-board__title">
                          <span>{label}</span>
                          <span className="leaderboard-detail-board__rank">
                            {myIndex >= 0 ? `You: #${myIndex + 1}` : "You: --"}
                          </span>
                        </div>
                        <div className="leaderboard-detail-board__rows">
                          {rows.slice(0, 10).map((row, idx) => (
                            <div
                              key={`${key}-${row.student_id}`}
                              className={`leaderboard-detail-row ${String(row.student_id) === String(student?.id ?? "") ? "leaderboard-detail-row--me" : ""}`}
                            >
                              <span>#{Number(row.rank ?? idx + 1)} {row.name}</span>
                              <strong>{Math.round(Number(row.points ?? 0))}</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="leaderboard-detail-empty">No top-10 leaderboard eligibility right now.</div>
              )}
            </div>
          </div>
        ) : null}
        {avatarPickerOpen ? (
          <div className="leaderboard-detail-overlay" onClick={() => setAvatarPickerOpen(false)}>
            <div className="avatar-picker-panel" onClick={(e) => e.stopPropagation()}>
              <button className="leaderboard-detail-close" onClick={() => setAvatarPickerOpen(false)}>×</button>
              <div className="leaderboard-detail-title">Avatar and Style Unlocks</div>
              <div className="avatar-picker-tabs">
                <button className={`avatar-picker-tab ${avatarPickerTab === "avatar" ? "avatar-picker-tab--active" : ""}`} onClick={() => setAvatarPickerTab("avatar")}>Avatar</button>
                <button className={`avatar-picker-tab ${avatarPickerTab === "effect" ? "avatar-picker-tab--active" : ""}`} onClick={() => setAvatarPickerTab("effect")}>Effect</button>
                <button className={`avatar-picker-tab ${avatarPickerTab === "border" ? "avatar-picker-tab--active" : ""}`} onClick={() => setAvatarPickerTab("border")}>Border</button>
              </div>
              <div className="avatar-picker-grid">
                {avatarPickerTab === "avatar"
                  ? avatarCatalog.filter((item) => item.enabled !== false).map((item) => {
                      const key = String(item.id ?? "");
                      const state = getItemUnlockState("avatar", key, Number(item.unlock_level ?? 1), Number(item.unlock_points ?? 0));
                      const src = item.storage_path
                        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${String(item.storage_path)}`
                        : "";
                      return (
                        <div key={`av-${key}`} className="avatar-picker-item">
                          <div className="avatar-picker-thumb">
                            {src ? <img src={src} alt={String(item.name ?? "Avatar")} /> : <div className="avatar-picker-empty">No image</div>}
                          </div>
                          <div className="avatar-picker-name">{item.name ?? "Avatar"}</div>
                          <div className="avatar-picker-meta">
                            <span>Lv {Math.max(1, Number(item.unlock_level ?? 1))}</span>
                            <span>{Math.max(0, Number(item.unlock_points ?? 0))} pts</span>
                          </div>
                          {item.limited_event_only ? (
                            <div className="avatar-picker-limited">{item.limited_event_name || "Limited Event"}: {item.limited_event_description || "Special unlock only"}</div>
                          ) : null}
                          <div className="avatar-picker-mods">
                            RK {Math.round(Number(item.rule_keeper_multiplier ?? 1) * 100)}% • RB {Math.round(Number(item.rule_breaker_multiplier ?? 1) * 100)}% • SP {Math.round(Number(item.skill_pulse_multiplier ?? 1) * 100)}%
                          </div>
                          {state.hasCriteriaReq ? (
                            <div className="avatar-picker-criteria">
                              Criteria: {state.requiredCriteriaKeys.map((c) => criteriaDefs.find((d) => d.key === c)?.label ?? c).join(", ")}
                            </div>
                          ) : null}
                          <div className="avatar-picker-actions">
                            {state.unlocked ? (
                              <button disabled={pickerBusyKey === `avatar:${key}:apply`} onClick={() => applyAvatar(key)} className="redeem-detail-btn">
                                {String(avatarId) === key ? "Selected" : "Use"}
                              </button>
                            ) : (
                              <button disabled={pickerBusyKey === `avatar:${key}:unlock`} onClick={() => unlockItem("avatar", key)} className="redeem-btn redeem-btn--active">
                                Unlock
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  : avatarPickerTab === "effect"
                    ? effectCatalog.filter((item) => item.enabled !== false).map((item) => {
                        const key = String(item.key ?? "");
                        const state = getItemUnlockState("effect", key, Number(item.unlock_level ?? 1), Number(item.unlock_points ?? 0));
                        return (
                          <div key={`ef-${key}`} className="avatar-picker-item">
                            <div className="avatar-picker-name">{item.name ?? key}</div>
                            <div className="avatar-picker-meta">
                              <span>Lv {Math.max(1, Number(item.unlock_level ?? 1))}</span>
                              <span>{Math.max(0, Number(item.unlock_points ?? 0))} pts</span>
                            </div>
                            {item.limited_event_only ? (
                              <div className="avatar-picker-limited">{item.limited_event_name || "Limited Event"}: {item.limited_event_description || "Special unlock only"}</div>
                            ) : null}
                            {state.hasCriteriaReq ? (
                              <div className="avatar-picker-criteria">
                                Criteria: {state.requiredCriteriaKeys.map((c) => criteriaDefs.find((d) => d.key === c)?.label ?? c).join(", ")}
                              </div>
                            ) : null}
                            <div className="avatar-picker-actions">
                              {state.unlocked ? (
                                <button disabled={pickerBusyKey === `style:${key}`} onClick={() => applyStylePatch({ particle_style: key })} className="redeem-detail-btn">
                                  {avatarEffectKey === key ? "Selected" : "Use"}
                                </button>
                              ) : (
                                <button disabled={pickerBusyKey === `effect:${key}:unlock`} onClick={() => unlockItem("effect", key)} className="redeem-btn redeem-btn--active">
                                  Unlock
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    : cornerBorders.filter((item) => item.enabled !== false).map((item) => {
                        const key = String(item.key ?? "");
                        const state = getItemUnlockState("corner_border", key, Number(item.unlock_level ?? 1), Number(item.unlock_points ?? 0));
                        return (
                          <div key={`bd-${key}`} className="avatar-picker-item">
                            <div className="avatar-picker-name">{item.name ?? key}</div>
                            <div className="avatar-picker-meta">
                              <span>Lv {Math.max(1, Number(item.unlock_level ?? 1))}</span>
                              <span>{Math.max(0, Number(item.unlock_points ?? 0))} pts</span>
                            </div>
                            {state.hasCriteriaReq ? (
                              <div className="avatar-picker-criteria">
                                Criteria: {state.requiredCriteriaKeys.map((c) => criteriaDefs.find((d) => d.key === c)?.label ?? c).join(", ")}
                              </div>
                            ) : null}
                            <div className="avatar-picker-actions">
                              {state.unlocked ? (
                                <button disabled={pickerBusyKey === `style:${key}`} onClick={() => applyStylePatch({ corner_border_key: key })} className="redeem-detail-btn">
                                  {cornerBorderKey === key ? "Selected" : "Use"}
                                </button>
                              ) : (
                                <button disabled={pickerBusyKey === `corner_border:${key}:unlock`} onClick={() => unlockItem("corner_border", key)} className="redeem-btn redeem-btn--active">
                                  Unlock
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
              </div>
            </div>
          </div>
        ) : null}
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

    .modifier-grid {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .modifier-tile {
      border-radius: 14px;
      border: 1px solid rgba(148,163,184,0.22);
      padding: 10px;
      display: grid;
      gap: 8px;
      text-align: left;
      min-height: 92px;
    }

    .modifier-tile__label {
      font-size: 13px;
      font-weight: 1000;
      letter-spacing: 0.45px;
      text-transform: uppercase;
    }

    .modifier-tile__value {
      font-size: 20px;
      font-weight: 1000;
      color: #f8fafc;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      line-height: 1.05;
      flex-wrap: wrap;
    }

    .modifier-tile__value s {
      opacity: 0.6;
      color: #cbd5e1;
      font-size: 15px;
    }

    .modifier-tile--keeper {
      background: linear-gradient(145deg, rgba(16,185,129,0.22), rgba(6,78,59,0.26));
      border-color: rgba(16,185,129,0.42);
    }

    .modifier-tile--breaker {
      background: linear-gradient(145deg, rgba(239,68,68,0.22), rgba(127,29,29,0.28));
      border-color: rgba(239,68,68,0.42);
    }

    .modifier-tile--spotlight {
      background: linear-gradient(145deg, rgba(251,191,36,0.24), rgba(120,53,15,0.28));
      border-color: rgba(251,191,36,0.45);
    }

    .modifier-tile--skill {
      background: linear-gradient(145deg, rgba(249,115,22,0.24), rgba(124,45,18,0.28));
      border-color: rgba(249,115,22,0.45);
    }

    .modifier-tile--challenge {
      background: linear-gradient(145deg, rgba(59,130,246,0.25), rgba(30,58,138,0.3));
      border-color: rgba(59,130,246,0.45);
    }

    .modifier-tile--daily {
      background: linear-gradient(145deg, rgba(14,165,233,0.25), rgba(15,23,42,0.3));
      border-color: rgba(14,165,233,0.45);
    }

    .modifier-tile--mvpbonus {
      background: linear-gradient(145deg, rgba(250,204,21,0.24), rgba(92,50,12,0.34));
      border-color: rgba(250,204,21,0.45);
    }

    .redeem-card {
      width: 100%;
      border-radius: 18px;
      border: 1px solid rgba(56,189,248,0.35);
      background: linear-gradient(145deg, rgba(2,132,199,0.18), rgba(15,23,42,0.72));
      padding: 12px;
      display: grid;
      gap: 10px;
      text-align: left;
    }

    .redeem-card__title {
      font-size: 15px;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      font-weight: 1000;
      opacity: 0.9;
    }

    .redeem-card__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .redeem-card__pts {
      font-size: 38px;
      font-weight: 1000;
      color: #86efac;
      text-shadow: 0 0 16px rgba(34,197,94,0.28);
    }

    .redeem-card__chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .redeem-chip {
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 11px;
      font-weight: 900;
      border: 1px solid rgba(56,189,248,0.36);
      background: rgba(56,189,248,0.16);
      color: #e0f2fe;
      text-transform: uppercase;
      letter-spacing: 0.45px;
    }

    .redeem-detail-btn {
      border-radius: 10px;
      border: 1px solid rgba(56,189,248,0.4);
      background: rgba(56,189,248,0.18);
      color: #e0f2fe;
      font-size: 12px;
      font-weight: 900;
      padding: 8px 10px;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 0.45px;
    }

    .redeem-btn {
      border-radius: 12px;
      border: 1px solid rgba(148,163,184,0.3);
      background: rgba(30,41,59,0.72);
      color: #cbd5e1;
      font-size: 13px;
      font-weight: 1000;
      padding: 10px 12px;
      cursor: pointer;
    }

    .redeem-btn--active {
      border-color: rgba(34,197,94,0.56);
      background: linear-gradient(140deg, rgba(34,197,94,0.32), rgba(16,185,129,0.2));
      color: #ecfdf5;
      box-shadow: 0 0 22px rgba(34,197,94,0.3);
      animation: redeemShine 1.8s ease-in-out infinite;
    }

    .redeem-next {
      font-size: 11px;
      color: #94a3b8;
      font-weight: 800;
    }
    .redeem-burst {
      position: fixed;
      inset: 0;
      display: grid;
      place-items: center;
      pointer-events: none;
      z-index: 260;
    }
    .redeem-burst__card {
      padding: 16px 22px;
      border-radius: 16px;
      border: 1px solid rgba(34,197,94,0.5);
      background: linear-gradient(145deg, rgba(34,197,94,0.34), rgba(16,185,129,0.24));
      color: #ecfdf5;
      font-weight: 1000;
      font-size: 28px;
      text-shadow: 0 0 14px rgba(255,255,255,0.22);
      box-shadow: 0 18px 44px rgba(16,185,129,0.28);
      animation: redeemPop 1.2s ease forwards;
    }
    .leaderboard-detail-overlay {
      position: fixed;
      inset: 0;
      z-index: 240;
      display: grid;
      place-items: center;
      padding: 14px;
      background: rgba(2,6,23,0.72);
      backdrop-filter: blur(2px);
    }
    .leaderboard-detail-panel {
      width: min(880px, 95vw);
      max-height: 86vh;
      overflow: auto;
      border-radius: 18px;
      border: 1px solid rgba(148,163,184,0.28);
      background: linear-gradient(155deg, rgba(15,23,42,0.98), rgba(2,6,23,0.95));
      padding: 14px;
      display: grid;
      gap: 10px;
      position: relative;
    }
    .leaderboard-detail-close {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 30px;
      height: 30px;
      border-radius: 999px;
      border: 1px solid rgba(148,163,184,0.35);
      background: rgba(30,41,59,0.75);
      color: #f1f5f9;
      font-size: 20px;
      cursor: pointer;
      line-height: 1;
    }
    .leaderboard-detail-title {
      font-size: 20px;
      font-weight: 1000;
      letter-spacing: 0.4px;
      padding-right: 34px;
    }
    .leaderboard-detail-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .leaderboard-detail-board {
      border-radius: 12px;
      border: 1px solid rgba(148,163,184,0.24);
      background: rgba(15,23,42,0.68);
      padding: 9px;
      display: grid;
      gap: 7px;
    }
    .leaderboard-detail-board__title {
      font-size: 12px;
      font-weight: 1000;
      text-transform: uppercase;
      letter-spacing: 0.65px;
      color: #bae6fd;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .leaderboard-detail-board__rank {
      font-size: 10px;
      letter-spacing: 0.35px;
      text-transform: none;
      color: #67e8f9;
      border: 1px solid rgba(103,232,249,0.5);
      background: rgba(6,182,212,0.2);
      border-radius: 999px;
      padding: 2px 8px;
      font-weight: 900;
    }
    .leaderboard-detail-board__rows {
      display: grid;
      gap: 5px;
    }
    .leaderboard-detail-row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: 12px;
      border-bottom: 1px solid rgba(148,163,184,0.14);
      padding-bottom: 4px;
    }
    .leaderboard-detail-row--me {
      border-bottom-color: rgba(56,189,248,0.45);
      color: #e0f2fe;
      font-weight: 900;
      text-shadow: 0 0 10px rgba(56,189,248,0.28);
    }
    .leaderboard-detail-row strong {
      font-weight: 1000;
      color: #f8fafc;
    }
    .leaderboard-detail-empty {
      font-size: 12px;
      opacity: 0.74;
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
      background: linear-gradient(155deg, rgba(51,65,85,0.75), rgba(30,41,59,0.7));
      border: 1px solid rgba(148,163,184,0.16);
      display: grid;
      gap: 6px;
    }

    .stats-cell--rule-breaker {
      border-color: rgba(239,68,68,0.45);
      background: linear-gradient(155deg, rgba(127,29,29,0.6), rgba(68,8,8,0.65));
      box-shadow: inset 0 1px 0 rgba(252,165,165,0.15), 0 10px 20px rgba(127,29,29,0.25);
    }

    .stats-cell--rule-keeper {
      border-color: rgba(34,197,94,0.45);
      background: linear-gradient(155deg, rgba(22,101,52,0.58), rgba(8,52,30,0.68));
      box-shadow: inset 0 1px 0 rgba(134,239,172,0.15), 0 10px 20px rgba(21,128,61,0.24);
    }

    .stats-cell--mvp {
      border-color: rgba(250,204,21,0.5);
      background: linear-gradient(155deg, rgba(113,63,18,0.55), rgba(31,23,8,0.8));
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

    .stats-value--mvp {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .mvp-badge-inline {
      width: 30px;
      height: 30px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(250,204,21,0.5);
      background: radial-gradient(circle, rgba(250,204,21,0.32), rgba(15,23,42,0.75));
      font-size: 10px;
      font-weight: 1000;
    }

    .mvp-badge-inline img {
      width: 92%;
      height: 92%;
      object-fit: contain;
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
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 12px;
    }

    .badge-tile {
      width: 100%;
      padding: 10px;
      border-radius: 18px;
      position: relative;
      display: grid;
      place-items: center;
      background: rgba(30,41,59,0.7);
      border: 1px solid rgba(148,163,184,0.18);
      overflow: hidden;
      gap: 8px;
      text-align: center;
      min-height: 124px;
    }

    .badge-tile__img {
      width: 86px;
      height: 86px;
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
      max-height: 288px;
      overflow-y: auto;
      padding-right: 4px;
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
      font-size: 11px;
      font-weight: 900;
      opacity: 1;
      color: rgba(255,255,255,0.95);
      text-shadow: 0 1px 2px rgba(0,0,0,0.55);
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }

    .badge-title {
      font-size: 11px;
      font-weight: 1000;
      text-transform: uppercase;
      letter-spacing: 0.65px;
      color: #e2e8f0;
    }

    .badge-progress__detail {
      font-size: 10px;
      line-height: 1.15;
      color: #bae6fd;
      opacity: 0.9;
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
      position: relative;
      overflow: hidden;
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
      box-shadow: 0 0 20px rgba(226,232,240,0.4);
      border-color: rgba(203,213,225,0.65);
    }

    .medal-tile--diamond {
      box-shadow: 0 0 20px rgba(56,189,248,0.45);
      border-color: rgba(56,189,248,0.62);
    }

    .medal-tile--master {
      box-shadow: 0 0 24px rgba(244,114,182,0.58), 0 0 44px rgba(190,24,93,0.34);
      border-color: rgba(244,114,182,0.72);
      background: radial-gradient(circle at 22% 18%, rgba(244,114,182,0.25), rgba(15,23,42,0.85));
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

    .avatar-picker-panel {
      width: min(1120px, 96vw);
      max-height: min(86vh, 900px);
      overflow: auto;
      border-radius: 22px;
      padding: 16px;
      border: 1px solid rgba(56,189,248,0.3);
      background: linear-gradient(155deg, rgba(15,23,42,0.98), rgba(2,6,23,0.98));
      display: grid;
      gap: 12px;
      position: relative;
    }

    .avatar-picker-tabs {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .avatar-picker-tab {
      border-radius: 999px;
      border: 1px solid rgba(148,163,184,0.34);
      background: rgba(30,41,59,0.6);
      color: #e2e8f0;
      padding: 7px 12px;
      font-size: 12px;
      font-weight: 900;
      cursor: pointer;
    }

    .avatar-picker-tab--active {
      border-color: rgba(56,189,248,0.72);
      background: rgba(14,165,233,0.25);
      color: #e0f2fe;
    }

    .avatar-picker-grid {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    }

    .avatar-picker-item {
      border-radius: 14px;
      border: 1px solid rgba(148,163,184,0.3);
      background: rgba(15,23,42,0.74);
      padding: 10px;
      display: grid;
      gap: 8px;
      align-content: start;
    }

    .avatar-picker-thumb {
      height: 128px;
      border-radius: 12px;
      border: 1px solid rgba(148,163,184,0.3);
      background: rgba(15,23,42,0.8);
      display: grid;
      place-items: center;
      overflow: hidden;
    }

    .avatar-picker-thumb img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .avatar-picker-name {
      font-size: 14px;
      font-weight: 1000;
    }

    .avatar-picker-meta {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      font-size: 11px;
      opacity: 0.85;
    }

    .avatar-picker-limited {
      border-radius: 9px;
      border: 1px solid rgba(245,158,11,0.42);
      background: rgba(120,53,15,0.4);
      padding: 6px 8px;
      font-size: 11px;
      line-height: 1.3;
      color: #fde68a;
    }

    .avatar-picker-mods,
    .avatar-picker-criteria {
      font-size: 11px;
      opacity: 0.86;
      line-height: 1.3;
    }

    .avatar-picker-actions {
      margin-top: auto;
      display: flex;
      justify-content: flex-end;
    }

    .avatar-picker-empty {
      font-size: 12px;
      opacity: 0.68;
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
      .badge-row {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .modifier-grid {
        grid-template-columns: 1fr;
      }
      .leaderboard-detail-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 640px) {
      .badge-row {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @keyframes sparkle {
      0% { transform: scale(0.9); opacity: 0.4; }
      50% { transform: scale(1.05); opacity: 0.8; }
      100% { transform: scale(0.9); opacity: 0.4; }
    }

    @keyframes medalSparkle {
      0% { transform: scale(0.8) rotate(0deg); opacity: 0.2; }
      50% { transform: scale(1.08) rotate(30deg); opacity: 0.5; }
      100% { transform: scale(0.8) rotate(0deg); opacity: 0.2; }
    }

    @keyframes redeemShine {
      0% { box-shadow: 0 0 0 rgba(34,197,94,0); transform: translateY(0); }
      50% { box-shadow: 0 0 20px rgba(34,197,94,0.42); transform: translateY(-1px); }
      100% { box-shadow: 0 0 0 rgba(34,197,94,0); transform: translateY(0); }
    }
    @keyframes redeemPop {
      0% { transform: scale(0.9); opacity: 0; }
      15% { transform: scale(1.05); opacity: 1; }
      70% { transform: scale(1); opacity: 1; }
      100% { transform: scale(0.98); opacity: 0; }
    }
  `;
}

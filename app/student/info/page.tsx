"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AuthGate from "../../../components/AuthGate";
import AvatarRender from "@/components/AvatarRender";
import StudentWorkspaceTopBar, { studentWorkspaceTopBarStyles } from "@/components/StudentWorkspaceTopBar";
import { supabaseClient } from "@/lib/supabase/client";
import { skillSprintPoolDropped, skillSprintPrizeDropPerDay, skillSprintPrizeNow } from "@/lib/skillSprintMath";

type StudentRow = {
  id: string;
  name: string;
  level?: number | null;
  points_total?: number | null;
  points_balance?: number | null;
  lifetime_points?: number | null;
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
  camp_role_points?: number;
  limited_event_daily_points?: number;
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
type PendingUnlock = {
  item_type: "avatar" | "effect" | "corner_border";
  item_key: string;
  item_name: string;
  unlock_points: number;
};
type LastAction = {
  id: string;
  points: number;
  points_base?: number | null;
  points_multiplier?: number | null;
  note?: string | null;
  category?: string | null;
  created_at?: string | null;
};
type LevelThresholdRow = {
  level: number;
  min_lifetime_points: number;
};
type SkillCountdownSummary = {
  active_count: number;
  overdue_count: number;
  next_due_at: string | null;
  next_due_in_ms: number | null;
  total_penalty_points_per_day: number;
  total_reward_points: number;
};
type SkillCountdownRow = {
  id: string;
  source_type: "skill_tree" | "skill_pulse" | "manual";
  source_label: string;
  note?: string | null;
  assigned_at?: string | null;
  due_at: string;
  penalty_points_per_day: number;
  reward_points: number;
  charged_days: number;
  remaining_ms: number;
  overdue_days: number;
  status: "upcoming" | "overdue";
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

function toColorInputHex(value: string) {
  const raw = String(value ?? "").trim();
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    const v = raw.slice(1).split("").map((c) => `${c}${c}`).join("");
    return `#${v}`.toLowerCase();
  }
  return "#0f172a";
}

function hexToRgb(hex: string) {
  const raw = toColorInputHex(hex);
  const clean = raw.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number) {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function ensureDarkHex(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const maxChannel = Math.max(r, g, b, 1);
  const targetMax = 96;
  const scale = Math.min(1, targetMax / maxChannel);
  const dr = Math.max(8, Math.round(r * scale));
  const dg = Math.max(8, Math.round(g * scale));
  const db = Math.max(8, Math.round(b * scale));
  return rgbToHex(dr, dg, db);
}

function buildDarkAvatarGradientFromHex(hex: string) {
  const darkHex = ensureDarkHex(hex);
  const { r, g, b } = hexToRgb(darkHex);
  const light = `rgba(${Math.min(255, Math.round(r * 1.16))},${Math.min(255, Math.round(g * 1.16))},${Math.min(255, Math.round(b * 1.16))},0.92)`;
  const dark = `rgba(${Math.max(0, Math.round(r * 0.48))},${Math.max(0, Math.round(g * 0.48))},${Math.max(0, Math.round(b * 0.48))},0.98)`;
  return `linear-gradient(160deg, ${light}, ${dark})`;
}

function pickerHexFromAvatarBg(value: string) {
  const raw = String(value ?? "").trim();
  const gradientMatches = Array.from(raw.matchAll(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/gi));
  if (gradientMatches.length) {
    const light = gradientMatches[0];
    const lr = Number(light?.[1] ?? 15);
    const lg = Number(light?.[2] ?? 23);
    const lb = Number(light?.[3] ?? 42);
    // Keep the picker close to the visible top gradient color the student actually sees.
    return ensureDarkHex(rgbToHex(lr, lg, lb));
  }
  return ensureDarkHex(toColorInputHex(raw));
}

function normalizeAvatarBgForDisplay(value: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return buildDarkAvatarGradientFromHex("#0f172a");
  if (/linear-gradient\(/i.test(raw)) return raw;
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw) || /^rgb(a)?\(/i.test(raw)) {
    return buildDarkAvatarGradientFromHex(ensureDarkHex(toColorInputHex(raw)));
  }
  return buildDarkAvatarGradientFromHex("#0f172a");
}

function formatCountdownRemaining(ms: number | null | undefined) {
  const value = Number(ms ?? 0);
  if (!Number.isFinite(value)) return "";
  if (value <= 0) return "Due now";
  const totalHours = Math.floor(value / (60 * 60 * 1000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0) return `${days}d ${hours}h left`;
  return `${Math.max(0, hours)}h left`;
}

const AVATAR_BG_PRESETS = [
  "#0f172a", "#111827", "#172554", "#1e1b4b", "#312e81", "#052e16", "#064e3b", "#14532d",
  "#0c4a6e", "#1e3a8a", "#0f766e", "#365314", "#3f3f46", "#3b0764", "#4c1d95", "#4a044e",
  "#7f1d1d", "#78350f", "#431407", "#374151",
].map(ensureDarkHex);

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
  const [leaderboardMinimums, setLeaderboardMinimums] = useState<Record<string, number>>({});
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
      competition_only?: boolean | null;
      competition_discount_pct?: number | null;
      unlock_level?: number | null;
      unlock_points?: number | null;
      limited_event_only?: boolean | null;
      limited_event_name?: string | null;
      limited_event_description?: string | null;
    }>
  >([]);
  const [avatarId, setAvatarId] = useState("");
  const [avatarBg, setAvatarBg] = useState("rgba(15,23,42,0.75)");
  const [avatarBgInput, setAvatarBgInput] = useState("#0f172a");
  const [avatarEffectKey, setAvatarEffectKey] = useState<string | null>(null);
  const [cornerBorderKey, setCornerBorderKey] = useState<string | null>(null);
  const [effectCatalog, setEffectCatalog] = useState<Array<{ key: string; name?: string | null; unlock_level?: number | null; unlock_points?: number | null; config?: any; render_mode?: string | null; z_layer?: string | null; html?: string | null; css?: string | null; js?: string | null; enabled?: boolean | null; limited_event_only?: boolean | null; limited_event_name?: string | null; limited_event_description?: string | null }>>([]);
  const [cornerBorders, setCornerBorders] = useState<Array<{ key: string; name?: string | null; image_url?: string | null; render_mode?: string | null; z_layer?: string | null; html?: string | null; css?: string | null; js?: string | null; offset_x?: number | null; offset_y?: number | null; offsets_by_context?: Record<string, { x?: number | null; y?: number | null; scale?: number | null; rotate?: number | null }> | null; unlock_level?: number | null; unlock_points?: number | null; enabled?: boolean | null; limited_event_only?: boolean | null; limited_event_name?: string | null; limited_event_description?: string | null }>>([]);
  const [customUnlocks, setCustomUnlocks] = useState<Array<{ item_type: string; item_key: string }>>([]);
  const [criteriaDefs, setCriteriaDefs] = useState<UnlockCriteriaDef[]>([]);
  const [itemRequirements, setItemRequirements] = useState<UnlockRequirement[]>([]);
  const [studentCriteria, setStudentCriteria] = useState<StudentCriteriaState[]>([]);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [avatarPickerTab, setAvatarPickerTab] = useState<"avatar" | "effect" | "border">("avatar");
  const [avatarPickerFilter, setAvatarPickerFilter] = useState<"all" | "unlocked" | "locked" | "limited" | "my_level" | "higher_level">("all");
  const [avatarPickerSort, setAvatarPickerSort] = useState<"level" | "name" | "daily_points" | "mvp_bonus">("level");
  const [pickerPreviewKey, setPickerPreviewKey] = useState("");
  const [pickerBorderHoverKey, setPickerBorderHoverKey] = useState("");
  const [pickerBusyKey, setPickerBusyKey] = useState("");
  const [dailyRedeem, setDailyRedeem] = useState<DailyRedeemStatus | null>(null);
  const [redeemBurst, setRedeemBurst] = useState<{ points: number; text: string } | null>(null);
  const [leaderboardDetailOpen, setLeaderboardDetailOpen] = useState(false);
  const [redeemBreakdownOpen, setRedeemBreakdownOpen] = useState(false);
  const [redeemingDaily, setRedeemingDaily] = useState(false);
  const [pendingUnlock, setPendingUnlock] = useState<PendingUnlock | null>(null);
  const [levelThresholds, setLevelThresholds] = useState<LevelThresholdRow[]>([]);
  const [lastAction, setLastAction] = useState<LastAction | null>(null);
  const [giftCount, setGiftCount] = useState(0);
  const [giftButtonImageUrl, setGiftButtonImageUrl] = useState("");
  const [giftButtonEmoji, setGiftButtonEmoji] = useState("🎁");
  const [countdownSummary, setCountdownSummary] = useState<SkillCountdownSummary | null>(null);
  const [countdownRows, setCountdownRows] = useState<SkillCountdownRow[]>([]);
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
    if (!checked) return;
    (async () => {
      const res = await fetch("/api/gifts/button-settings", { cache: "no-store" });
      const sj = await safeJson(res);
      if (!sj.ok) return;
      setGiftButtonImageUrl(String(sj.json?.settings?.image_url ?? "").trim());
      setGiftButtonEmoji(String(sj.json?.settings?.emoji ?? "🎁").trim() || "🎁");
    })();
  }, [checked]);

  useEffect(() => {
    (async () => {
      const [avatarsRes, effectsRes, bordersRes, levelsRes] = await Promise.all([
        fetch("/api/avatars/list", { cache: "no-store" }),
        fetch("/api/avatar-effects/list", { cache: "no-store" }),
        fetch("/api/corner-borders", { cache: "no-store" }),
        fetch("/api/avatar-levels", { cache: "no-store" }),
      ]);
      const avatarsJson = await avatarsRes.json().catch(() => ({}));
      if (avatarsRes.ok) setAvatarCatalog((avatarsJson?.avatars ?? []) as any[]);
      const effectsJson = await effectsRes.json().catch(() => ({}));
      if (effectsRes.ok) setEffectCatalog((effectsJson?.effects ?? []) as any[]);
      const bordersJson = await bordersRes.json().catch(() => ({}));
      if (bordersRes.ok) setCornerBorders((bordersJson?.borders ?? []) as any[]);
      const levelsJson = await levelsRes.json().catch(() => ({}));
      if (levelsRes.ok) {
        const rows = (levelsJson?.levels ?? []) as Array<{ level?: number; min_lifetime_points?: number }>;
        setLevelThresholds(
          rows
            .map((row) => ({
              level: Number(row.level ?? 1),
              min_lifetime_points: Number(row.min_lifetime_points ?? 0),
            }))
            .filter((row) => Number.isFinite(row.level))
            .sort((a, b) => a.level - b.level)
        );
      }
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
        const normalizedBg = normalizeAvatarBgForDisplay(bg);
        setAvatarBg(normalizedBg);
        setAvatarBgInput(pickerHexFromAvatarBg(normalizedBg));
        const effectKey = String(s?.particle_style ?? "").trim();
        setAvatarEffectKey(effectKey || null);
        const borderKey = String(s?.corner_border_key ?? "").trim();
        setCornerBorderKey(borderKey || null);
      }
    })();
  }, [student?.id]);

  useEffect(() => {
    if (!student?.id) {
      setCountdownSummary(null);
      setCountdownRows([]);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const loadCountdown = async () => {
      const res = await fetch(`/api/skill-sprint/student?student_id=${encodeURIComponent(String(student.id))}`, { cache: "no-store" });
      const sj = await safeJson(res);
      if (!sj.ok || cancelled) return;
      setCountdownSummary((sj.json?.summary ?? null) as SkillCountdownSummary | null);
      setCountdownRows((sj.json?.rows ?? []) as SkillCountdownRow[]);
    };

    loadCountdown();
    timer = setInterval(loadCountdown, 60_000);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
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

      const [badgesRes, prestigeRes, prestigeProgRes, challengesRes, medalsRes, highlightsRes, attendanceRes, mvpTotalRes, mvpWeekRes, taoluRes, battlesRes, trackersRes, mvpBadgeRes, dailyStatusRes, seasonRes, leaderboardRes, lastActionRes, giftsRes] =
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
          fetch(`/api/student/last-action?student_id=${encodeURIComponent(studentId)}`, { cache: "no-store" }),
          fetch(`/api/student/gifts?student_id=${encodeURIComponent(studentId)}`, { cache: "no-store" }),
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
        setLeaderboardMinimums((leaderboardJson.json?.leaderboard_minimums ?? {}) as Record<string, number>);
      }
      const lastActionJson = await safeJson(lastActionRes);
      if (lastActionJson.ok) setLastAction((lastActionJson.json?.last_action ?? null) as LastAction | null);
      else setLastAction(null);
      const giftsJson = await safeJson(giftsRes);
      if (giftsJson.ok) {
        const rows = Array.isArray(giftsJson.json?.gifts) ? giftsJson.json.gifts : [];
        const now = Date.now();
        const count = rows.reduce((sum: number, row: any) => {
          const expiresMs = Date.parse(String(row?.expires_at ?? ""));
          const isExpired = Boolean(row?.is_expired) || Boolean(row?.expired_at) || (Number.isFinite(expiresMs) && expiresMs <= now);
          if (isExpired) return sum;
          return sum + Math.max(0, Number(row?.qty ?? 0) - Number(row?.opened_qty ?? 0));
        }, 0);
        setGiftCount(count);
      } else {
        setGiftCount(0);
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

  useEffect(() => {
    if (!student?.id) return;
    let cancelled = false;
    const studentId = String(student.id);

    async function refreshSelectedStudent() {
      const listRes = await fetch("/api/students/list", { cache: "no-store" });
      const listJson = await safeJson(listRes);
      if (!listJson.ok || cancelled) return;
      const list = (listJson.json?.students ?? []) as StudentRow[];
      if (!list.length) return;
      setStudents(list);
      const selected = list.find((s) => String(s.id) === String(student.id));
      if (selected) {
        setStudent(selected);
        setStudentQuery(selected.name);
      }
    }

    async function refreshDailyStatus() {
      const statusRes = await fetch("/api/avatar/daily-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId }),
      });
      const statusJson = await safeJson(statusRes);
      if (!statusJson.ok || cancelled) return;
      setDailyRedeem((statusJson.json?.status ?? null) as DailyRedeemStatus | null);
    }
    async function refreshLastActionAndGifts() {
      const [lastRes, giftsRes] = await Promise.all([
        fetch(`/api/student/last-action?student_id=${encodeURIComponent(studentId)}`, { cache: "no-store" }),
        fetch(`/api/student/gifts?student_id=${encodeURIComponent(studentId)}`, { cache: "no-store" }),
      ]);
      const lastJson = await safeJson(lastRes);
      if (lastJson.ok && !cancelled) setLastAction((lastJson.json?.last_action ?? null) as LastAction | null);
      const giftsJson = await safeJson(giftsRes);
      if (giftsJson.ok && !cancelled) {
        const rows = Array.isArray(giftsJson.json?.gifts) ? giftsJson.json.gifts : [];
        const now = Date.now();
        const count = rows.reduce((sum: number, row: any) => {
          const expiresMs = Date.parse(String(row?.expires_at ?? ""));
          const isExpired = Boolean(row?.is_expired) || Boolean(row?.expired_at) || (Number.isFinite(expiresMs) && expiresMs <= now);
          if (isExpired) return sum;
          return sum + Math.max(0, Number(row?.qty ?? 0) - Number(row?.opened_qty ?? 0));
        }, 0);
        setGiftCount(count);
      }
    }

    let refreshTimer: number | null = null;
    const scheduleRefresh = () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        if (document.visibilityState !== "visible") return;
        void refreshSelectedStudent();
        void refreshDailyStatus();
        void refreshLastActionAndGifts();
      }, 220);
    };

    void refreshSelectedStudent();
    void refreshDailyStatus();
    void refreshLastActionAndGifts();
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void refreshSelectedStudent();
      void refreshDailyStatus();
      void refreshLastActionAndGifts();
    }, 15000);

    const sb = supabaseClient();
    const channel = sb
      .channel(`student-info-live-${studentId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "students", filter: `id=eq.${studentId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "ledger", filter: `student_id=eq.${studentId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "student_avatar_settings", filter: `student_id=eq.${studentId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "student_leaderboard_bonus_grants", filter: `student_id=eq.${studentId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "student_event_daily_claims", filter: `student_id=eq.${studentId}` }, scheduleRefresh)
      .subscribe();

    const onStudentsRefresh = () => {
      void refreshSelectedStudent();
      void refreshDailyStatus();
      void refreshLastActionAndGifts();
    };
    window.addEventListener("students-refresh", onStudentsRefresh);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      if (refreshTimer) window.clearTimeout(refreshTimer);
      sb.removeChannel(channel);
      window.removeEventListener("students-refresh", onStudentsRefresh);
    };
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
  const pointsDisplay = Number(student?.points_total ?? student?.points_balance ?? 0);
  const levelDisplay = Number(student?.level ?? 1);
  const lifetimePoints = Number(student?.lifetime_points ?? student?.points_total ?? 0);
  const lastActionPoints = Number(lastAction?.points ?? 0);
  const lastActionUp = lastActionPoints >= 0;
  const lastActionCategory = String(lastAction?.category ?? "").trim().toLowerCase();
  const lastActionNote = String(lastAction?.note ?? "").trim();
  const lastActionSourceLabel = useMemo(() => {
    if (!lastActionCategory && !lastActionNote) return "No recent activity";
    if (lastActionCategory === "rule_keeper") return "Rule Keeper";
    if (lastActionCategory === "rule_breaker") return "Rule Breaker";
    if (lastActionCategory === "challenge") return "Challenge";
    if (lastActionCategory === "skill_pulse") return "Skill Pulse";
    if (lastActionCategory === "gift_open") return "Gift Open";
    if (lastActionCategory === "camp_bulk") return lastActionPoints < 0 ? "Camp Classroom Deduction" : "Camp Classroom Award";
    if (lastActionCategory) return lastActionCategory.replace(/_/g, " ");
    return lastActionNote || "Activity";
  }, [lastActionCategory, lastActionNote, lastActionPoints]);
  const lastActionModifier = useMemo(() => {
    const pointsBase = lastAction?.points_base == null ? null : Number(lastAction.points_base);
    const pointsMultiplier = lastAction?.points_multiplier == null ? null : Number(lastAction.points_multiplier);
    const noteLower = lastActionNote.toLowerCase();
    if (lastActionCategory === "rule_breaker" || noteLower.includes("protection")) {
      const protectedPts =
        pointsBase != null && lastActionPoints < 0
          ? Math.max(0, Math.round(Math.abs(pointsBase) - Math.abs(lastActionPoints)))
          : 0;
      if (protectedPts > 0 || noteLower.includes("protection")) {
        return `🛡 protected${protectedPts > 0 ? ` +${protectedPts}` : ""}`;
      }
    }
    if ((pointsMultiplier != null && pointsMultiplier > 1) || noteLower.includes("modifier") || noteLower.includes("boost")) {
      return "boosted";
    }
    return "";
  }, [lastAction, lastActionCategory, lastActionNote, lastActionPoints]);
  const thresholdMap = useMemo(() => {
    const map = new Map<number, number>();
    levelThresholds.forEach((row) => {
      map.set(Number(row.level), Number(row.min_lifetime_points ?? 0));
    });
    return map;
  }, [levelThresholds]);
  const currentLevelMin = thresholdMap.get(levelDisplay) ?? 0;
  const nextThresholdRow = useMemo(
    () => levelThresholds.find((row) => Number(row.level) > levelDisplay) ?? null,
    [levelThresholds, levelDisplay]
  );
  const nextLevelMin = nextThresholdRow ? Number(nextThresholdRow.min_lifetime_points ?? 0) : null;
  const nextLevelNumber = nextThresholdRow ? Number(nextThresholdRow.level ?? levelDisplay + 1) : levelDisplay + 1;
  const nextLevelPointsLeft = nextLevelMin != null ? Math.max(0, nextLevelMin - lifetimePoints) : 0;
  const progressSpan = nextLevelMin != null ? Math.max(1, nextLevelMin - currentLevelMin) : 1;
  const levelProgressValue =
    nextLevelMin != null ? Math.min(1, Math.max(0, (lifetimePoints - currentLevelMin) / progressSpan)) : 1;
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
  const leaderboardUsesDecimalDisplay = (key: string, rows: LeaderboardEntry[], minimumValue: number) => {
    if (!Number.isInteger(minimumValue)) return true;
    return rows.some((row) => !Number.isInteger(Number(row.points ?? 0)));
  };
  const formatLeaderboardValue = (value: number, useDecimals: boolean) => {
    const n = Number(value ?? 0);
    if (!Number.isFinite(n)) return useDecimals ? "0.00" : "0";
    return useDecimals ? n.toFixed(2) : String(Math.round(n));
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

  function getItemUnlockState(
    itemType: "avatar" | "effect" | "corner_border",
    itemKey: string,
    unlockLevel: number,
    unlockPoints: number,
    limitedOnly = false,
    competitionOnly = false
  ) {
    const level = Math.max(1, Number(levelDisplay ?? 1));
    const levelOk = level >= Math.max(1, Number(unlockLevel ?? 1));
    const competitionOk = !competitionOnly || Boolean(student?.is_competition_team);
    const needsPointsPurchase = Math.max(0, Number(unlockPoints ?? 0)) > 0;
    const customUnlocked = customUnlockSet.has(`${itemType}:${itemKey}`);
    const reqKeys = Array.from(new Set(criteriaByItem.get(`${itemType}:${itemKey}`) ?? []));
    const hasCriteriaReq = reqKeys.length > 0;
    const criteriaMatched = hasCriteriaReq && reqKeys.every((k) => fulfilledCriteriaKeys.has(k));
    const unlockedByDefault = !limitedOnly && !needsPointsPurchase && levelOk && competitionOk;
    const eligibilityOk = !hasCriteriaReq || criteriaMatched;
    const limitedBlocked = limitedOnly && !criteriaMatched;
    const unlocked = customUnlocked || unlockedByDefault;
    return {
      unlocked,
      customUnlocked,
      criteriaMatched,
      limitedBlocked,
      eligibilityOk,
      hasCriteriaReq,
      requiredCriteriaKeys: reqKeys,
      levelOk,
      competitionOk,
      needsPointsPurchase,
    };
  }

  function getLockReasonText(
    state: ReturnType<typeof getItemUnlockState>,
    unlockLevel: number,
    unlockPoints: number
  ) {
    if (state.unlocked) return "";
    const reasons: string[] = [];
    if ((state as any).limitedBlocked) reasons.push("Limited event eligibility required");
    if (state.hasCriteriaReq && !state.criteriaMatched) reasons.push("Required criteria not fulfilled");
    if ((state as any).competitionOk === false) reasons.push("Competition team only");
    if (!state.levelOk) reasons.push(`Needs level ${Math.max(1, Number(unlockLevel ?? 1))}`);
    if (state.needsPointsPurchase) reasons.push(`Needs ${Math.max(0, Number(unlockPoints ?? 0))} unlock points`);
    return reasons.join(" • ");
  }

  function avatarModifierPack(meta: {
    rule_keeper_multiplier?: number | null;
    rule_breaker_multiplier?: number | null;
    spotlight_multiplier?: number | null;
    skill_pulse_multiplier?: number | null;
    challenge_completion_bonus_pct?: number | null;
    mvp_bonus_pct?: number | null;
    daily_free_points?: number | null;
  } | null) {
    return {
      ruleKeeperMultiplier: normalizeMultiplier(meta?.rule_keeper_multiplier ?? 1, 1),
      ruleBreakerMultiplier: normalizeMultiplier(meta?.rule_breaker_multiplier ?? 1, 1),
      spotlightMultiplier: normalizeMultiplier(meta?.spotlight_multiplier ?? 1, 1),
      skillPulseMultiplier: normalizeMultiplier(meta?.skill_pulse_multiplier ?? 1, 1),
      challengeBonusPct: Math.max(0, Number(meta?.challenge_completion_bonus_pct ?? 0)),
      mvpBonusPct: Math.max(0, Number(meta?.mvp_bonus_pct ?? 0)),
      dailyFreePoints: Math.max(0, Number(meta?.daily_free_points ?? 0)),
    };
  }

  function matchesPickerFilter(
    state: ReturnType<typeof getItemUnlockState>,
    unlockLevel: number,
    limitedOnly: boolean
  ) {
    if (avatarPickerFilter === "all") return true;
    if (avatarPickerFilter === "unlocked") return state.unlocked;
    if (avatarPickerFilter === "locked") return !state.unlocked;
    if (avatarPickerFilter === "limited") return limitedOnly;
    if (avatarPickerFilter === "my_level") return Math.max(1, Number(unlockLevel ?? 1)) <= Math.max(1, Number(levelDisplay ?? 1));
    if (avatarPickerFilter === "higher_level") return Math.max(1, Number(unlockLevel ?? 1)) > Math.max(1, Number(levelDisplay ?? 1));
    return true;
  }

  useEffect(() => {
    if (!avatarPickerOpen) return;
    setPickerPreviewKey("");
    setPickerBorderHoverKey("");
  }, [avatarPickerTab, avatarPickerOpen]);

  const pickerAvatarRows = useMemo(() => {
    const rows = avatarCatalog
      .filter((item) => item.enabled !== false)
      .map((item) => {
        const key = String(item.id ?? "");
        const unlockLevel = Math.max(1, Number(item.unlock_level ?? 1));
        const unlockPoints = Math.max(0, Number(item.unlock_points ?? 0));
        const state = getItemUnlockState(
          "avatar",
          key,
          unlockLevel,
          unlockPoints,
          Boolean(item.limited_event_only),
          Boolean(item.competition_only)
        );
        return { item, key, unlockLevel, unlockPoints, state };
      })
      .filter((row) => matchesPickerFilter(row.state, row.unlockLevel, Boolean(row.item.limited_event_only)));
    return rows.sort((a, b) => {
      const aLimited = Boolean(a.item.limited_event_only);
      const bLimited = Boolean(b.item.limited_event_only);
      if (aLimited !== bLimited) return aLimited ? -1 : 1;
      if (avatarPickerSort === "name") return String(a.item.name ?? "").localeCompare(String(b.item.name ?? ""));
      if (avatarPickerSort === "daily_points") return Number(b.item.daily_free_points ?? 0) - Number(a.item.daily_free_points ?? 0);
      if (avatarPickerSort === "mvp_bonus") return Number(b.item.mvp_bonus_pct ?? 0) - Number(a.item.mvp_bonus_pct ?? 0);
      return a.unlockLevel - b.unlockLevel || String(a.item.name ?? "").localeCompare(String(b.item.name ?? ""));
    });
  }, [avatarCatalog, avatarPickerFilter, avatarPickerSort, levelDisplay, customUnlockSet, criteriaByItem, fulfilledCriteriaKeys]);

  const pickerEffectRows = useMemo(() => {
    const rows = effectCatalog
      .filter((item) => item.enabled !== false)
      .map((item) => {
        const key = String(item.key ?? "");
        const unlockLevel = Math.max(1, Number(item.unlock_level ?? 1));
        const unlockPoints = Math.max(0, Number(item.unlock_points ?? 0));
        const state = getItemUnlockState("effect", key, unlockLevel, unlockPoints, Boolean(item.limited_event_only));
        return { item, key, unlockLevel, unlockPoints, state };
      })
      .filter((row) => matchesPickerFilter(row.state, row.unlockLevel, Boolean(row.item.limited_event_only)));
    return rows.sort((a, b) => {
      if (avatarPickerSort === "name") return String(a.item.name ?? a.key).localeCompare(String(b.item.name ?? b.key));
      return a.unlockLevel - b.unlockLevel || String(a.item.name ?? a.key).localeCompare(String(b.item.name ?? b.key));
    });
  }, [effectCatalog, avatarPickerFilter, avatarPickerSort, levelDisplay, customUnlockSet, criteriaByItem, fulfilledCriteriaKeys]);

  const pickerBorderRows = useMemo(() => {
    const rows = cornerBorders
      .filter((item) => item.enabled !== false)
      .map((item) => {
        const key = String(item.key ?? "");
        const unlockLevel = Math.max(1, Number(item.unlock_level ?? 1));
        const unlockPoints = Math.max(0, Number(item.unlock_points ?? 0));
        const state = getItemUnlockState("corner_border", key, unlockLevel, unlockPoints, Boolean(item.limited_event_only));
        return { item, key, unlockLevel, unlockPoints, state };
      })
      .filter((row) => matchesPickerFilter(row.state, row.unlockLevel, Boolean(row.item.limited_event_only)));
    return rows.sort((a, b) => {
      if (avatarPickerSort === "name") return String(a.item.name ?? a.key).localeCompare(String(b.item.name ?? b.key));
      return a.unlockLevel - b.unlockLevel || String(a.item.name ?? a.key).localeCompare(String(b.item.name ?? b.key));
    });
  }, [cornerBorders, avatarPickerFilter, avatarPickerSort, levelDisplay, customUnlockSet, criteriaByItem, fulfilledCriteriaKeys]);

  const nextRedeemLabel = useMemo(() => {
    const raw = String(dailyRedeem?.next_redeem_at ?? "").trim();
    if (!raw) return "—";
    const d = new Date(raw);
    if (!Number.isFinite(d.getTime())) return "—";
    return d.toLocaleString();
  }, [dailyRedeem?.next_redeem_at]);

  const previewAvatarMeta = useMemo(
    () => (avatarPickerTab === "avatar" && pickerPreviewKey ? avatarCatalog.find((a) => String(a.id) === pickerPreviewKey) ?? null : selectedAvatarMeta),
    [avatarPickerTab, pickerPreviewKey, avatarCatalog, selectedAvatarMeta]
  );
  const previewEffectMeta = useMemo(
    () => (avatarPickerTab === "effect" && pickerPreviewKey ? effectCatalog.find((e) => String(e.key) === pickerPreviewKey) ?? null : selectedEffect),
    [avatarPickerTab, pickerPreviewKey, effectCatalog, selectedEffect]
  );
  const previewBorderMeta = useMemo(
    () => (avatarPickerTab === "border" && pickerPreviewKey ? cornerBorders.find((b) => String(b.key) === pickerPreviewKey) ?? null : selectedBorder),
    [avatarPickerTab, pickerPreviewKey, cornerBorders, selectedBorder]
  );
  const previewAvatarSrc = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const mapped = String(previewAvatarMeta?.storage_path ?? "").trim();
    if (base && mapped) return `${base}/storage/v1/object/public/avatars/${mapped}`;
    return avatarSrc;
  }, [previewAvatarMeta, avatarSrc]);
  const currentPack = useMemo(() => avatarModifierPack(selectedAvatarMeta), [selectedAvatarMeta]);
  const previewPack = useMemo(() => avatarModifierPack(previewAvatarMeta), [previewAvatarMeta]);
  function renderPreviewStat(
    label: string,
    currentValue: number,
    previewValue: number,
    formatValue: (value: number) => string,
    formatDelta: (delta: number) => string,
    invertDeltaColor = false
  ) {
    const delta = previewValue - currentValue;
    const deltaClass = delta === 0
      ? "avatar-picker-preview-delta--same"
      : invertDeltaColor
        ? delta < 0
          ? "avatar-picker-preview-delta--up"
          : "avatar-picker-preview-delta--down"
        : delta > 0
          ? "avatar-picker-preview-delta--up"
          : "avatar-picker-preview-delta--down";
    return (
      <div className="avatar-picker-preview-stat-row">
        <span>{label}</span>
        <strong>
          {formatValue(currentValue)} → {formatValue(previewValue)}{" "}
          <span className={`avatar-picker-preview-delta ${deltaClass}`}>({formatDelta(delta)})</span>
        </strong>
      </div>
    );
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

  function requestUnlock(
    itemType: "avatar" | "effect" | "corner_border",
    itemKey: string,
    itemName: string,
    unlockPoints: number
  ) {
    if (!student?.id || !itemKey) return;
    setPendingUnlock({
      item_type: itemType,
      item_key: itemKey,
      item_name: itemName,
      unlock_points: Math.max(0, Number(unlockPoints ?? 0)),
    });
  }

  async function unlockItem(
    itemType: "avatar" | "effect" | "corner_border",
    itemKey: string,
    unlockPoints = 0,
    itemName = "Item"
  ) {
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
    setMsg(`Unlocked ${itemName}. Used ${Math.max(0, Number(unlockPoints ?? 0))} points.`);
    await refreshUnlockContext();
  }

  async function confirmUnlock() {
    if (!pendingUnlock) return;
    const unlock = pendingUnlock;
    await unlockItem(unlock.item_type, unlock.item_key, unlock.unlock_points, unlock.item_name);
    setPendingUnlock(null);
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

  async function applyStylePatch(patch: { particle_style?: string; corner_border_key?: string; bg_color?: string }) {
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
    if (patch.bg_color !== undefined) {
      const nextBg = normalizeAvatarBgForDisplay(String(patch.bg_color || "").trim());
      setAvatarBg(nextBg);
      setAvatarBgInput(pickerHexFromAvatarBg(nextBg));
    }
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
        setLeaderboardMinimums((leaderboardJson.json?.leaderboard_minimums ?? {}) as Record<string, number>);
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
            hasGift={giftCount > 0}
            avatarBgOverride={avatarBg}
            avatarSrcOverride={avatarSrc}
            avatarZoomPctOverride={avatarZoomPct}
            avatarEffectOverride={selectedEffect as any}
            cornerBorderOverride={selectedBorder as any}
          />
          <section className="student-info__split">
            <aside className="student-info__left">
              <div className="left-card">
                <div className="left-card__name">{student?.name ?? "Student"}</div>
                <div className="left-card__label">Level {levelDisplay}</div>
                <div className="left-card__points">{pointsDisplay.toLocaleString()} pts</div>
                {lastAction ? (
                  <div className={`left-card__last-chip ${lastActionUp ? "left-card__last-chip--up" : "left-card__last-chip--down"}`}>
                    <span>{lastActionUp ? "▲" : "▼"}</span>
                    <span>{lastActionUp ? "+" : ""}{Math.round(lastActionPoints)} pts</span>
                    <span>•</span>
                    <span>{lastActionSourceLabel}</span>
                    {lastActionModifier ? <span className="left-card__last-mod">{lastActionModifier}</span> : null}
                  </div>
                ) : null}
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
                <div className="level-progress">
                  <div className="level-progress__label">Next Level Progress</div>
                  <div className="level-progress__bar">
                    <span className="level-progress__fill" style={{ width: `${Math.round(levelProgressValue * 100)}%` }} />
                  </div>
                  <div className="level-progress__meta">
                    <span>
                      {nextLevelMin != null ? `${nextLevelPointsLeft} pts left to Level ${nextLevelNumber}` : "Max level reached"}
                    </span>
                    <span>{nextLevelMin != null ? `${lifetimePoints} / ${nextLevelMin}` : lifetimePoints}</span>
                  </div>
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
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {giftCount > 0 ? (
                        <Link href="/student/gifts" className="gift-icon-btn" title="Open Gift Box">
                          {giftButtonImageUrl ? (
                            <img src={giftButtonImageUrl} alt="Gift" className="gift-icon-btn__img" />
                          ) : (
                            <span className="gift-icon-btn__emoji">{giftButtonEmoji || "🎁"}</span>
                          )}
                          <span className="gift-icon-btn__badge">{giftCount}</span>
                        </Link>
                      ) : null}
                      <div className="redeem-card__pts">+{Math.round(Number(dailyRedeem?.available_points ?? 0))}</div>
                    </div>
                  </div>
                  <div className="redeem-next">Points so far: +{Math.round(Number(dailyRedeem?.available_points ?? 0))}</div>
                  <div className="redeem-next">Next redeem: {nextRedeemLabel}</div>
                  <div className="redeem-card__chips">
                    {(dailyRedeem?.contribution_chips ?? []).map((chip) => (
                      <span key={chip} className="redeem-chip">{chip}</span>
                    ))}
                  </div>
                  <button className="redeem-detail-btn" onClick={() => setLeaderboardDetailOpen(true)}>
                    Leaderboard Details
                  </button>
                  <div className="redeem-actions">
                    <button
                      className={`redeem-btn ${dailyRedeem?.can_redeem ? "redeem-btn--active" : ""}`}
                      onClick={redeemDailyPoints}
                      disabled={!dailyRedeem?.can_redeem || redeemingDaily}
                    >
                      {redeemingDaily ? "Redeeming..." : dailyRedeem?.can_redeem ? "Redeem Now" : "Not Ready"}
                    </button>
                    <button className="redeem-detail-btn" onClick={() => setRedeemBreakdownOpen((v) => !v)}>
                      {redeemBreakdownOpen ? "Hide Breakdown" : "Points Breakdown"}
                    </button>
                  </div>
                  {redeemBreakdownOpen ? (
                    <div className="redeem-breakdown">
                      <div className="redeem-breakdown__item">
                        <div className="redeem-breakdown__label">Avatar</div>
                        <div className="redeem-breakdown__value">+{Math.round(Number(dailyRedeem?.avatar_points ?? 0))}</div>
                      </div>
                      <div className="redeem-breakdown__item">
                        <div className="redeem-breakdown__label">Leaderboards</div>
                        <div className="redeem-breakdown__value">+{Math.round(Number(dailyRedeem?.leaderboard_points ?? 0))}</div>
                      </div>
                      <div className="redeem-breakdown__item">
                        <div className="redeem-breakdown__label">Camp Role</div>
                        <div className="redeem-breakdown__value">+{Math.round(Number(dailyRedeem?.camp_role_points ?? 0))}</div>
                      </div>
                      <div className="redeem-breakdown__item">
                        <div className="redeem-breakdown__label">Limited Event Daily</div>
                        <div className="redeem-breakdown__value">+{Math.round(Number(dailyRedeem?.limited_event_daily_points ?? 0))}</div>
                      </div>
                      <div className="redeem-breakdown__item redeem-breakdown__item--total">
                        <div className="redeem-breakdown__label">Total Redeem</div>
                        <div className="redeem-breakdown__value">+{Math.round(Number(dailyRedeem?.available_points ?? 0))}</div>
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="redeem-card">
                  <div className="redeem-card__head">
                    <div className="redeem-card__title">Skill Sprint</div>
                    <div className="redeem-card__pts" style={{ fontSize: 14, minWidth: 108 }}>
                      {countdownSummary?.active_count
                        ? `${countdownSummary.active_count} active`
                        : "None"}
                    </div>
                  </div>
                  {!countdownSummary?.active_count ? (
                    <div className="redeem-next">No Skill Sprint assigned.</div>
                  ) : (
                    <>
                      <div className="redeem-next">
                        {countdownSummary.overdue_count > 0
                          ? `${countdownSummary.overdue_count} overdue`
                          : `Next due: ${formatCountdownRemaining(countdownSummary.next_due_in_ms)}`}
                      </div>
                      <div className="redeem-next">
                        Daily loss: -{Math.round(Number(countdownSummary.total_penalty_points_per_day ?? 0))} pts
                      </div>
                      <div className="redeem-next">
                        Completion reward pool: +{Math.round(Number(countdownSummary.total_reward_points ?? 0))} pts
                      </div>
                      <div className="redeem-card__chips">
                        {countdownRows.slice(0, 5).map((row) => (
                          <span key={row.id} className="redeem-chip">
                            {row.source_label}: {row.status === "overdue" ? `${Math.max(1, Number(row.overdue_days ?? 0))}d overdue` : formatCountdownRemaining(row.remaining_ms)}
                            {row.note ? ` • Req: ${row.note}` : ""}
                            {` • Pool/day: ${Math.round(skillSprintPrizeDropPerDay(row.reward_points, row.assigned_at, row.due_at))}`}
                            {` • Pool left: ${Math.round(skillSprintPrizeNow(row.reward_points, row.assigned_at, row.due_at))}`}
                            {` • Pool dropped: ${Math.round(skillSprintPoolDropped(row.reward_points, row.assigned_at, row.due_at))}`}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
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
                    const minimum = Math.max(0, Number(leaderboardMinimums[key] ?? 0) || 0);
                    const rows = (leaderboards?.[key as keyof LeaderboardPayload] ?? []) as LeaderboardEntry[];
                    const useDecimalDisplay = leaderboardUsesDecimalDisplay(key, rows, minimum);
                    const myIndex = rows.findIndex((row) => String(row.student_id) === String(student?.id ?? ""));
                    const myRow = myIndex >= 0 ? rows[myIndex] : null;
                    const awardRow = (dailyRedeem?.leaderboard_awards ?? []).find((row) => String(row.board_key) === String(key));
                    const awardPoints = Number(awardRow?.board_points ?? 0);
                    const awardRank = Number(awardRow?.rank ?? 0) > 0 ? Number(awardRow?.rank ?? 0) : Number(myRow?.rank ?? 0);
                    return (
                      <div key={key} className="leaderboard-detail-board">
                        <div className="leaderboard-detail-board__title">
                          <span>{label}</span>
                          <span className="leaderboard-detail-board__rank">
                            {myIndex >= 0 ? `You: #${myIndex + 1}` : "You: --"}
                          </span>
                        </div>
                        {minimum > 0 ? (
                          <div className="leaderboard-detail-board__min">Minimum required: {formatLeaderboardValue(minimum, useDecimalDisplay)}</div>
                        ) : null}
                        <div className={`leaderboard-detail-board__bonus ${awardPoints > 0 ? "leaderboard-detail-board__bonus--active" : ""}`}>
                          {awardPoints > 0 ? `Redeem bonus: +${awardPoints} (rank #${awardRank})` : "Redeem bonus: +0"}
                        </div>
                        <div className="leaderboard-detail-board__rows">
                          {rows.slice(0, 10).map((row, idx) => (
                            <div
                              key={`${key}-${row.student_id}`}
                              className={`leaderboard-detail-row ${String(row.student_id) === String(student?.id ?? "") ? "leaderboard-detail-row--me" : ""}`}
                            >
                              <span>#{Number(row.rank ?? idx + 1)} {row.name}</span>
                              <strong>{formatLeaderboardValue(Number(row.points ?? 0), useDecimalDisplay)}</strong>
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
              <div className="avatar-picker-filters">
                <button className={`avatar-picker-tab ${avatarPickerFilter === "all" ? "avatar-picker-tab--active" : ""}`} onClick={() => setAvatarPickerFilter("all")}>All</button>
                <button className={`avatar-picker-tab ${avatarPickerFilter === "unlocked" ? "avatar-picker-tab--active" : ""}`} onClick={() => setAvatarPickerFilter("unlocked")}>Unlocked</button>
                <button className={`avatar-picker-tab ${avatarPickerFilter === "locked" ? "avatar-picker-tab--active" : ""}`} onClick={() => setAvatarPickerFilter("locked")}>Locked</button>
                <button className={`avatar-picker-tab ${avatarPickerFilter === "limited" ? "avatar-picker-tab--active" : ""}`} onClick={() => setAvatarPickerFilter("limited")}>Limited</button>
                <button className={`avatar-picker-tab ${avatarPickerFilter === "my_level" ? "avatar-picker-tab--active" : ""}`} onClick={() => setAvatarPickerFilter("my_level")}>My Level</button>
                <button className={`avatar-picker-tab ${avatarPickerFilter === "higher_level" ? "avatar-picker-tab--active" : ""}`} onClick={() => setAvatarPickerFilter("higher_level")}>Higher Level</button>
                <button className={`avatar-picker-tab ${avatarPickerSort === "level" ? "avatar-picker-tab--active" : ""}`} onClick={() => setAvatarPickerSort("level")}>Sort: Level</button>
                <button className={`avatar-picker-tab ${avatarPickerSort === "name" ? "avatar-picker-tab--active" : ""}`} onClick={() => setAvatarPickerSort("name")}>Sort: Name</button>
                <button className={`avatar-picker-tab ${avatarPickerSort === "daily_points" ? "avatar-picker-tab--active" : ""}`} onClick={() => setAvatarPickerSort("daily_points")}>Sort: Free Points</button>
                <button className={`avatar-picker-tab ${avatarPickerSort === "mvp_bonus" ? "avatar-picker-tab--active" : ""}`} onClick={() => setAvatarPickerSort("mvp_bonus")}>Sort: MVP Bonus</button>
              </div>
              <div className="avatar-bg-row">
                <label className="avatar-bg-label">Avatar BG Color (auto dark gradient)</label>
                <div className="avatar-bg-presets">
                  {AVATAR_BG_PRESETS.map((hex) => (
                    <button
                      key={`bg-${hex}`}
                      id={hex === avatarBgInput ? "avatar-bg-color" : undefined}
                      type="button"
                      className={`avatar-bg-swatch ${hex === avatarBgInput ? "avatar-bg-swatch--active" : ""}`}
                      style={{ background: buildDarkAvatarGradientFromHex(hex) }}
                      onClick={() => {
                        setAvatarBgInput(hex);
                        setAvatarBg(buildDarkAvatarGradientFromHex(hex));
                      }}
                      title={hex}
                      aria-label={`Set avatar background ${hex}`}
                    />
                  ))}
                </div>
                <input
                  value={avatarBgInput}
                  onChange={(e) => {
                    const nextHex = ensureDarkHex(toColorInputHex(e.target.value));
                    setAvatarBgInput(nextHex);
                    setAvatarBg(buildDarkAvatarGradientFromHex(nextHex));
                  }}
                  className="avatar-bg-hex"
                  placeholder="#0f172a"
                />
                <button
                  type="button"
                  className="redeem-detail-btn"
                  onClick={() => applyStylePatch({ bg_color: buildDarkAvatarGradientFromHex(avatarBgInput) })}
                >
                  Save BG
                </button>
              </div>
              <div className="avatar-picker-body">
                <aside className="avatar-picker-preview-panel">
                  <div className="avatar-picker-preview-title">Current Avatar</div>
                  <div className="avatar-picker-preview-tile">
                    <AvatarRender
                      size={146}
                      bg={avatarBg}
                      avatarSrc={avatarSrc}
                      avatarZoomPct={avatarZoomPct}
                      effect={selectedEffect as any}
                      border={selectedBorder as any}
                      showImageBorder={false}
                      contextKey="student_info"
                      fallback={<div className="left-card__avatar-fallback">{initials}</div>}
                    />
                  </div>
                  <div className="avatar-picker-preview-title">Preview</div>
                  <div className="avatar-picker-preview-tile">
                    <AvatarRender
                      size={146}
                      bg={avatarBg}
                      avatarSrc={previewAvatarSrc}
                      avatarZoomPct={avatarZoomPct}
                      effect={previewEffectMeta as any}
                      border={previewBorderMeta as any}
                      showImageBorder={false}
                      contextKey="student_info"
                      fallback={<div className="left-card__avatar-fallback">{initials}</div>}
                    />
                  </div>
                  <div className="avatar-picker-preview-stats">
                    {renderPreviewStat(
                      "Rule Keeper multiplier",
                      currentPack.ruleKeeperMultiplier,
                      previewPack.ruleKeeperMultiplier,
                      (v) => `${v.toFixed(2)}x`,
                      (d) => `${d >= 0 ? "+" : ""}${d.toFixed(2)}x`
                    )}
                    {renderPreviewStat(
                      "Rule Breaker multiplier",
                      currentPack.ruleBreakerMultiplier,
                      previewPack.ruleBreakerMultiplier,
                      (v) => `${v.toFixed(2)}x`,
                      (d) => `${d >= 0 ? "+" : ""}${d.toFixed(2)}x`,
                      true
                    )}
                    {renderPreviewStat(
                      "Spotlight star multiplier",
                      currentPack.spotlightMultiplier,
                      previewPack.spotlightMultiplier,
                      (v) => `${v.toFixed(2)}x`,
                      (d) => `${d >= 0 ? "+" : ""}${d.toFixed(2)}x`
                    )}
                    {renderPreviewStat(
                      "Skill Pulse points per rep multiplier",
                      currentPack.skillPulseMultiplier,
                      previewPack.skillPulseMultiplier,
                      (v) => `${v.toFixed(2)}x`,
                      (d) => `${d >= 0 ? "+" : ""}${d.toFixed(2)}x`
                    )}
                    {renderPreviewStat(
                      "Challenge completion bonus",
                      Math.round(currentPack.challengeBonusPct),
                      Math.round(previewPack.challengeBonusPct),
                      (v) => `${Math.round(v)}%`,
                      (d) => `${d >= 0 ? "+" : ""}${Math.round(d)}%`
                    )}
                    {renderPreviewStat(
                      "Battle MVP bonus",
                      Math.round(currentPack.mvpBonusPct),
                      Math.round(previewPack.mvpBonusPct),
                      (v) => `${Math.round(v)}%`,
                      (d) => `${d >= 0 ? "+" : ""}${Math.round(d)}%`
                    )}
                    {renderPreviewStat(
                      "Free points daily",
                      Math.round(currentPack.dailyFreePoints),
                      Math.round(previewPack.dailyFreePoints),
                      (v) => `${Math.round(v)}`,
                      (d) => `${d >= 0 ? "+" : ""}${Math.round(d)}`
                    )}
                  </div>
                </aside>
                <div className="avatar-picker-grid">
                  {avatarPickerTab === "avatar"
                    ? pickerAvatarRows.map(({ item, key, unlockLevel, unlockPoints, state }) => {
                        const src = item.storage_path
                          ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${String(item.storage_path)}`
                          : "";
                        const blocked =
                          !state.unlocked &&
                          (!state.levelOk ||
                            !state.eligibilityOk ||
                            Boolean((state as any).limitedBlocked) ||
                            Boolean((state as any).competitionOk === false));
                        const isCompetitionOnly = Boolean(item.competition_only);
                        const hasCompetitionDiscount = Number(item.competition_discount_pct ?? 0) > 0;
                        const isCompetitionDiscountApplied = Boolean(student?.is_competition_team) && hasCompetitionDiscount;
                        const discountPct = Math.max(0, Math.min(100, Number(item.competition_discount_pct ?? 0)));
                        const rawDiscountPoints = (unlockPoints * discountPct) / 100;
                        const roundedDiscountPoints = rawDiscountPoints > 0 ? Math.max(10, Math.round(rawDiscountPoints / 10) * 10) : 0;
                        return (
                          <div
                            key={`av-${key}`}
                            className={`avatar-picker-item ${state.unlocked ? "" : "avatar-picker-item--locked"} ${blocked ? "avatar-picker-item--blocked" : ""} ${pickerPreviewKey === key ? "avatar-picker-item--preview" : ""}`}
                            onClick={() => setPickerPreviewKey(key)}
                          >
                            {item.limited_event_only ? <div className="avatar-picker-stamp">LIMITED TIME AVATAR</div> : null}
                            {isCompetitionOnly ? <div className="avatar-picker-competition-only">COMPETITION TEAM ONLY</div> : null}
                            <div className="avatar-picker-thumb">
                              {src ? <img src={src} alt={String(item.name ?? "Avatar")} /> : <div className="avatar-picker-empty">No image</div>}
                            </div>
                            <div className="avatar-picker-name">{item.name ?? "Avatar"}</div>
                            <div className="avatar-picker-meta">
                              <span>Level {unlockLevel}</span>
                              <span>Unlock points {unlockPoints}</span>
                            </div>
                            {hasCompetitionDiscount ? (
                              <div className="avatar-picker-competition-discount">
                                COMPETITION TEAM DISCOUNT - {roundedDiscountPoints} POINTS OFF {isCompetitionDiscountApplied ? "APPLIED" : "AVAILABLE"}
                              </div>
                            ) : null}
                            <div className="avatar-picker-mods">
                              <div>Rule Keeper multiplier: {Number(item.rule_keeper_multiplier ?? 1).toFixed(2)}x</div>
                              <div>Rule Breaker multiplier: {Number(item.rule_breaker_multiplier ?? 1).toFixed(2)}x</div>
                              <div>Spotlight star multiplier: {Number(item.spotlight_multiplier ?? 1).toFixed(2)}x</div>
                              <div>Skill Pulse points per rep multiplier: {Number(item.skill_pulse_multiplier ?? 1).toFixed(2)}x</div>
                              <div>Challenge completion bonus: {Math.round(Number(item.challenge_completion_bonus_pct ?? 0))}%</div>
                              <div>Battle MVP bonus: {Math.round(Number(item.mvp_bonus_pct ?? 0))}%</div>
                              <div>Free points daily: {Math.round(Number(item.daily_free_points ?? 0))}</div>
                            </div>
                            {item.limited_event_only ? (
                              <div className="avatar-picker-limited">{item.limited_event_name || "Limited Event"}: {item.limited_event_description || "Special unlock only"}</div>
                            ) : null}
                            {state.hasCriteriaReq ? (
                              <div className="avatar-picker-criteria">
                                Criteria: {state.requiredCriteriaKeys.map((c) => criteriaDefs.find((d) => d.key === c)?.label ?? c).join(", ")}
                              </div>
                            ) : null}
                            {!state.unlocked ? <div className="avatar-picker-lock-note">{getLockReasonText(state, unlockLevel, unlockPoints)}</div> : null}
                            <div className="avatar-picker-actions">
                              {state.unlocked ? (
                                <button disabled={pickerBusyKey === `avatar:${key}:apply`} onClick={() => applyAvatar(key)} className="redeem-detail-btn">
                                  {String(avatarId) === key ? "Selected" : "Use"}
                                </button>
                              ) : (
                                <button
                                  disabled={blocked || pickerBusyKey === `avatar:${key}:unlock`}
                                  onClick={() => requestUnlock("avatar", key, String(item.name ?? "Avatar"), unlockPoints)}
                                  className="redeem-btn redeem-btn--active"
                                >
                                  {blocked ? "Locked" : "Unlock"}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    : avatarPickerTab === "effect"
                      ? pickerEffectRows.map(({ item, key, unlockLevel, unlockPoints, state }) => (
                          (() => {
                            const blocked = !state.unlocked && (!state.levelOk || !state.eligibilityOk || Boolean((state as any).limitedBlocked));
                            return (
                          <div
                            key={`ef-${key}`}
                            className={`avatar-picker-item ${state.unlocked ? "" : "avatar-picker-item--locked"} ${blocked ? "avatar-picker-item--blocked" : ""} ${pickerPreviewKey === key ? "avatar-picker-item--preview" : ""}`}
                            onClick={() => setPickerPreviewKey(key)}
                          >
                            {item.limited_event_only ? <div className="avatar-picker-stamp">LIMITED TIME EFFECT</div> : null}
                            <div className="avatar-picker-thumb">
                              <AvatarRender
                                size={96}
                                bg={avatarBg}
                                avatarSrc={avatarSrc}
                                avatarZoomPct={avatarZoomPct}
                                effect={{ key } as any}
                                border={selectedBorder as any}
                                showImageBorder={false}
                                contextKey="student_info"
                                fallback={<div className="avatar-picker-empty">FX</div>}
                              />
                            </div>
                            <div className="avatar-picker-name">{item.name ?? key}</div>
                            <div className="avatar-picker-meta">
                              <span>Level {unlockLevel}</span>
                              <span>Unlock points {unlockPoints}</span>
                            </div>
                            {item.limited_event_only ? (
                              <div className="avatar-picker-limited">{item.limited_event_name || "Limited Event"}: {item.limited_event_description || "Special unlock only"}</div>
                            ) : null}
                            {state.hasCriteriaReq ? (
                              <div className="avatar-picker-criteria">
                                Criteria: {state.requiredCriteriaKeys.map((c) => criteriaDefs.find((d) => d.key === c)?.label ?? c).join(", ")}
                              </div>
                            ) : null}
                            {!state.unlocked ? <div className="avatar-picker-lock-note">{getLockReasonText(state, unlockLevel, unlockPoints)}</div> : null}
                            <div className="avatar-picker-actions">
                              {state.unlocked ? (
                                <button disabled={pickerBusyKey === `style:${key}`} onClick={() => applyStylePatch({ particle_style: key })} className="redeem-detail-btn">
                                  {avatarEffectKey === key ? "Selected" : "Use"}
                                </button>
                              ) : (
                                <button
                                  disabled={blocked || pickerBusyKey === `effect:${key}:unlock`}
                                  onClick={() => requestUnlock("effect", key, String(item.name ?? key), unlockPoints)}
                                  className="redeem-btn redeem-btn--active"
                                >
                                  {blocked ? "Locked" : "Unlock"}
                                </button>
                              )}
                            </div>
                          </div>
                          );
                          })()
                        ))
                      : pickerBorderRows.map(({ item, key, unlockLevel, unlockPoints, state }) => (
                          (() => {
                            const blocked = !state.unlocked && (!state.levelOk || !state.eligibilityOk || Boolean((state as any).limitedBlocked));
                            const hasPreviewSelection = avatarPickerTab === "border" && Boolean(pickerPreviewKey);
                            const allowHoverAnimation = !hasPreviewSelection;
                            const cardShouldAnimate = allowHoverAnimation && pickerBorderHoverKey === key;
                            return (
                          <div
                            key={`bd-${key}`}
                            className={`avatar-picker-item ${state.unlocked ? "" : "avatar-picker-item--locked"} ${blocked ? "avatar-picker-item--blocked" : ""} ${pickerPreviewKey === key ? "avatar-picker-item--preview" : ""}`}
                            onClick={() => {
                              setPickerPreviewKey(key);
                              setPickerBorderHoverKey("");
                            }}
                            onMouseEnter={() => {
                              if (allowHoverAnimation) setPickerBorderHoverKey(key);
                            }}
                            onMouseLeave={() => {
                              if (pickerBorderHoverKey === key) setPickerBorderHoverKey("");
                            }}
                          >
                            {item.limited_event_only ? <div className="avatar-picker-stamp">LIMITED TIME BORDER</div> : null}
                            <div className="avatar-picker-thumb">
                              <AvatarRender
                                size={96}
                                bg={avatarBg}
                                avatarSrc={avatarSrc}
                                avatarZoomPct={avatarZoomPct}
                                effect={null}
                                border={cardShouldAnimate ? (item as any) : null}
                                showImageBorder={false}
                                contextKey="student_info"
                                fallback={<div className="avatar-picker-empty">BD</div>}
                              />
                            </div>
                            <div className="avatar-picker-name">{item.name ?? key}</div>
                            <div className="avatar-picker-meta">
                              <span>Level {unlockLevel}</span>
                              <span>Unlock points {unlockPoints}</span>
                            </div>
                            {item.limited_event_only ? (
                              <div className="avatar-picker-limited">{item.limited_event_name || "Limited Event"}: {item.limited_event_description || "Special unlock only"}</div>
                            ) : null}
                            {state.hasCriteriaReq ? (
                              <div className="avatar-picker-criteria">
                                Criteria: {state.requiredCriteriaKeys.map((c) => criteriaDefs.find((d) => d.key === c)?.label ?? c).join(", ")}
                              </div>
                            ) : null}
                            {!state.unlocked ? <div className="avatar-picker-lock-note">{getLockReasonText(state, unlockLevel, unlockPoints)}</div> : null}
                            <div className="avatar-picker-actions">
                              {state.unlocked ? (
                                <button disabled={pickerBusyKey === `style:${key}`} onClick={() => applyStylePatch({ corner_border_key: key })} className="redeem-detail-btn">
                                  {cornerBorderKey === key ? "Selected" : "Use"}
                                </button>
                              ) : (
                                <button
                                  disabled={blocked || pickerBusyKey === `corner_border:${key}:unlock`}
                                  onClick={() => requestUnlock("corner_border", key, String(item.name ?? key), unlockPoints)}
                                  className="redeem-btn redeem-btn--active"
                                >
                                  {blocked ? "Locked" : "Unlock"}
                                </button>
                              )}
                            </div>
                          </div>
                          );
                          })()
                        ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {pendingUnlock ? (
          <div className="leaderboard-detail-overlay" onClick={() => (pickerBusyKey ? null : setPendingUnlock(null))}>
            <div className="leaderboard-detail-panel unlock-confirm-panel" onClick={(e) => e.stopPropagation()}>
              <button className="leaderboard-detail-close" onClick={() => (pickerBusyKey ? null : setPendingUnlock(null))}>×</button>
              <div className="leaderboard-detail-title">Confirm Unlock</div>
              <div className="unlock-confirm-copy">
                First unlock. Are you sure you want to unlock <strong>{pendingUnlock.item_name}</strong>?
              </div>
              <div className="unlock-confirm-points">
                Points used: <strong>{Math.max(0, Number(pendingUnlock.unlock_points ?? 0))}</strong>
              </div>
              <div className="unlock-confirm-actions">
                <button className="redeem-detail-btn" disabled={Boolean(pickerBusyKey)} onClick={() => setPendingUnlock(null)}>
                  Cancel
                </button>
                <button className="redeem-btn redeem-btn--active" disabled={Boolean(pickerBusyKey)} onClick={confirmUnlock}>
                  {pickerBusyKey ? "Unlocking..." : "Yes, Unlock"}
                </button>
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
      grid-template-columns: minmax(320px, 1.05fr) minmax(0, 2.95fr);
      gap: 22px;
      align-items: start;
    }

    .student-info__left {
      display: grid;
      gap: 16px;
      min-width: 0;
      max-width: 100%;
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
      overflow: hidden;
      max-width: 100%;
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

    .left-card__last-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.3px;
      max-width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      border: 1px solid rgba(148,163,184,0.38);
      background: rgba(15,23,42,0.65);
    }
    .left-card__last-chip--up {
      border-color: rgba(74,222,128,0.5);
      background: rgba(20,83,45,0.38);
      color: #dcfce7;
      box-shadow: 0 0 12px rgba(74,222,128,0.2);
    }
    .left-card__last-chip--down {
      border-color: rgba(248,113,113,0.55);
      background: rgba(127,29,29,0.38);
      color: #fee2e2;
      box-shadow: 0 0 12px rgba(248,113,113,0.2);
    }
    .left-card__last-mod {
      color: #bfdbfe;
      font-style: italic;
      text-shadow: 0 0 8px rgba(96,165,250,0.55);
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
      max-width: 100%;
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

    .level-progress {
      width: 100%;
      display: grid;
      gap: 6px;
      margin-top: 2px;
    }
    .level-progress__label {
      font-size: 12px;
      font-weight: 900;
      opacity: 0.82;
      text-align: left;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .level-progress__bar {
      width: 100%;
      height: 10px;
      border-radius: 999px;
      background: rgba(148,163,184,0.22);
      overflow: hidden;
      border: 1px solid rgba(148,163,184,0.25);
    }
    .level-progress__fill {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, rgba(45,212,191,0.95), rgba(56,189,248,0.95));
      transition: width 220ms ease;
    }
    .level-progress__meta {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: 12px;
      opacity: 0.82;
      text-align: left;
    }

    .avatar-bg-row {
      width: 100%;
      display: grid;
      gap: 8px;
      justify-items: center;
    }
    .avatar-bg-label {
      font-size: 12px;
      font-weight: 900;
      opacity: 0.82;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .avatar-bg-presets {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(10, minmax(0, 1fr));
      gap: 6px;
      max-width: 420px;
    }
    .avatar-bg-swatch {
      width: 100%;
      aspect-ratio: 1 / 1;
      border: 1px solid rgba(148,163,184,0.4);
      border-radius: 8px;
      cursor: pointer;
      box-shadow: inset 0 0 8px rgba(255,255,255,0.12);
    }
    .avatar-bg-swatch--active {
      border-color: rgba(125,211,252,0.9);
      box-shadow: 0 0 0 1px rgba(125,211,252,0.35), 0 0 14px rgba(56,189,248,0.34);
    }
    .avatar-bg-hex {
      width: 130px;
      height: 34px;
      border-radius: 8px;
      border: 1px solid rgba(148,163,184,0.45);
      background: rgba(2,6,23,0.72);
      color: rgba(248,250,252,0.95);
      text-align: center;
      font-weight: 800;
      letter-spacing: 0.4px;
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

    .gift-icon-btn {
      width: 50px;
      height: 50px;
      border-radius: 14px;
      border: 1px solid rgba(250,204,21,0.58);
      background: linear-gradient(135deg, rgba(180,83,9,0.9), rgba(146,64,14,0.95));
      color: #fff7ed;
      text-decoration: none;
      display: grid;
      place-items: center;
      position: relative;
      box-shadow: 0 0 18px rgba(250,204,21,0.22);
      animation: giftPulse 1.6s ease-in-out infinite;
      overflow: visible;
      flex: 0 0 auto;
    }
    .gift-icon-btn__img {
      width: 34px;
      height: 34px;
      border-radius: 9px;
      object-fit: cover;
    }
    .gift-icon-btn__emoji {
      font-size: 26px;
      line-height: 1;
    }
    .gift-icon-btn__badge {
      position: absolute;
      top: -7px;
      right: -7px;
      border-radius: 999px;
      min-width: 22px;
      height: 22px;
      padding: 0 6px;
      background: #dc2626;
      color: #fff;
      font-size: 12px;
      font-weight: 1000;
      display: grid;
      place-items: center;
      box-shadow: 0 0 14px rgba(220,38,38,0.42);
      border: 1px solid rgba(255,255,255,0.45);
    }
    @keyframes giftPulse {
      0% { transform: translateY(0) scale(1); box-shadow: 0 0 14px rgba(250,204,21,0.22); }
      50% { transform: translateY(-1px) scale(1.03); box-shadow: 0 0 22px rgba(250,204,21,0.35); }
      100% { transform: translateY(0) scale(1); box-shadow: 0 0 14px rgba(250,204,21,0.22); }
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
    .redeem-actions {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 8px;
    }
    .redeem-breakdown {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .redeem-breakdown__item {
      border-radius: 10px;
      border: 1px solid rgba(56,189,248,0.35);
      background: rgba(15,23,42,0.58);
      padding: 8px;
      display: grid;
      gap: 4px;
      text-align: center;
    }
    .redeem-breakdown__item--total {
      border-color: rgba(34,197,94,0.52);
      background: linear-gradient(140deg, rgba(34,197,94,0.24), rgba(15,23,42,0.62));
    }
    .redeem-breakdown__label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.45px;
      color: #bae6fd;
      font-weight: 900;
    }
    .redeem-breakdown__value {
      font-size: 16px;
      font-weight: 1000;
      color: #ecfeff;
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
    .unlock-confirm-panel {
      width: min(520px, 95vw);
      max-height: none;
      gap: 12px;
    }
    .unlock-confirm-copy {
      border-radius: 12px;
      border: 1px solid rgba(148,163,184,0.3);
      background: rgba(15,23,42,0.7);
      padding: 12px;
      font-size: 14px;
      line-height: 1.4;
      color: #e2e8f0;
    }
    .unlock-confirm-points {
      border-radius: 12px;
      border: 1px solid rgba(34,197,94,0.45);
      background: rgba(22,101,52,0.3);
      color: #dcfce7;
      padding: 10px 12px;
      font-size: 14px;
      font-weight: 900;
    }
    .unlock-confirm-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
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
    .leaderboard-detail-board__min {
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.3px;
      text-transform: uppercase;
      color: #93c5fd;
      border: 1px solid rgba(59,130,246,0.42);
      background: rgba(30,58,138,0.24);
      border-radius: 999px;
      padding: 4px 8px;
      width: fit-content;
    }
    .leaderboard-detail-board__bonus {
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.35px;
      text-transform: uppercase;
      color: #cbd5e1;
      border: 1px solid rgba(148,163,184,0.3);
      background: rgba(30,41,59,0.55);
      border-radius: 999px;
      padding: 4px 8px;
      width: fit-content;
    }
    .leaderboard-detail-board__bonus--active {
      color: #dcfce7;
      border-color: rgba(34,197,94,0.5);
      background: rgba(22,101,52,0.42);
      box-shadow: inset 0 0 10px rgba(34,197,94,0.2);
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
      min-width: 0;
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
      min-width: 0;
    }

    .stats-stack {
      display: grid;
      gap: 16px;
      min-width: 0;
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
      min-width: 0;
      overflow: hidden;
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
      max-height: 360px;
      overflow-y: auto;
      padding-right: 6px;
      grid-template-columns: repeat(auto-fit, minmax(118px, 1fr));
      align-items: stretch;
      gap: 14px;
    }

    .badge-row--prestige .badge-tile {
      min-height: 156px;
      padding: 12px 10px;
      align-content: start;
      gap: 10px;
    }

    .badge-row--prestige .badge-tile__img {
      width: clamp(64px, 8vw, 92px);
      height: clamp(64px, 8vw, 92px);
    }

    .badge-row--prestige .badge-title {
      font-size: 11px;
      line-height: 1.25;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: normal;
      min-height: 28px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .badge-row--prestige .badge-progress__text {
      font-size: 11px;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: normal;
      line-height: 1.25;
      min-height: 30px;
    }

    .badge-row--prestige .badge-progress__detail {
      font-size: 10px;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: normal;
      line-height: 1.25;
      min-height: 24px;
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
    .avatar-picker-filters {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      padding-top: 2px;
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

    .avatar-picker-body {
      display: grid;
      grid-template-columns: minmax(280px, 320px) minmax(0, 1fr);
      gap: 12px;
      align-items: start;
    }
    .avatar-picker-preview-panel {
      border-radius: 14px;
      border: 1px solid rgba(148,163,184,0.3);
      background: rgba(15,23,42,0.75);
      padding: 10px;
      display: grid;
      gap: 9px;
      position: sticky;
      top: 8px;
    }
    .avatar-picker-preview-title {
      font-size: 12px;
      font-weight: 1000;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      color: #bae6fd;
    }
    .avatar-picker-preview-tile {
      min-height: 164px;
      border-radius: 12px;
      border: 1px solid rgba(148,163,184,0.24);
      background: rgba(2,6,23,0.68);
      display: grid;
      place-items: center;
    }
    .avatar-picker-preview-stats {
      border-radius: 12px;
      border: 1px solid rgba(148,163,184,0.2);
      background: rgba(2,6,23,0.58);
      padding: 8px;
      display: grid;
      gap: 6px;
    }
    .avatar-picker-preview-stat-row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: 11px;
      line-height: 1.2;
    }
    .avatar-picker-preview-stat-row span {
      opacity: 0.82;
    }
    .avatar-picker-preview-stat-row strong {
      font-weight: 1000;
      color: #f8fafc;
      text-align: right;
      white-space: nowrap;
    }
    .avatar-picker-preview-delta {
      font-weight: 1000;
    }
    .avatar-picker-preview-delta--up {
      color: #22c55e;
    }
    .avatar-picker-preview-delta--down {
      color: #ef4444;
    }
    .avatar-picker-preview-delta--same {
      color: #94a3b8;
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
      position: relative;
      cursor: pointer;
      transition: border-color 140ms ease, transform 140ms ease, opacity 140ms ease;
    }
    .avatar-picker-item:hover {
      border-color: rgba(56,189,248,0.45);
      transform: translateY(-1px);
    }
    .avatar-picker-item--locked {
      opacity: 0.88;
      background: rgba(15,23,42,0.62);
    }
    .avatar-picker-item--blocked {
      opacity: 0.58;
      background: rgba(15,23,42,0.5);
      border-color: rgba(100,116,139,0.45);
    }
    .avatar-picker-item--preview {
      border-color: rgba(56,189,248,0.8);
      box-shadow: inset 0 0 0 1px rgba(56,189,248,0.3);
    }
    .avatar-picker-stamp {
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 2;
      border-radius: 999px;
      border: 1px solid rgba(245,158,11,0.62);
      background: rgba(120,53,15,0.82);
      color: #fde68a;
      font-size: 10px;
      font-weight: 1000;
      letter-spacing: 0.5px;
      padding: 4px 8px;
      text-transform: uppercase;
    }
    .avatar-picker-competition-only {
      position: absolute;
      top: 0;
      left: 50%;
      transform: translate(-50%, -52%);
      z-index: 2;
      border-radius: 999px;
      border: 1px solid rgba(56, 189, 248, 0.95);
      background: linear-gradient(90deg, rgba(10, 58, 130, 0.96), rgba(30, 98, 190, 0.96));
      color: #dbeafe;
      font-size: 10px;
      font-weight: 1000;
      letter-spacing: 0.52px;
      text-transform: uppercase;
      padding: 4px 10px;
      text-shadow: 0 0 8px rgba(96, 165, 250, 0.95);
      box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.45) inset, 0 0 14px rgba(59, 130, 246, 0.9);
      animation: competitionOnlyPulse 1.3s ease-in-out infinite;
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
    .avatar-picker-lock-note {
      border-radius: 9px;
      border: 1px solid rgba(248,113,113,0.32);
      background: rgba(127,29,29,0.28);
      color: #fecaca;
      padding: 6px 8px;
      font-size: 11px;
      line-height: 1.25;
      font-weight: 900;
    }
    .avatar-picker-competition-discount {
      border-radius: 10px;
      border: 1px solid rgba(254, 42, 42, 0.9);
      background: linear-gradient(90deg, rgba(120, 10, 10, 0.95), rgba(170, 16, 16, 0.92));
      color: #ffe4e6;
      font-size: 11px;
      font-weight: 1000;
      letter-spacing: 0.45px;
      padding: 7px 9px;
      text-transform: uppercase;
      text-shadow: 0 0 8px rgba(248, 113, 113, 0.95), 0 0 16px rgba(239, 68, 68, 0.75);
      box-shadow: 0 0 0 1px rgba(220, 38, 38, 0.35) inset, 0 0 14px rgba(239, 68, 68, 0.75);
      animation: competitionDiscountPulse 1.2s ease-in-out infinite;
    }
    @keyframes competitionDiscountPulse {
      0% { transform: scale(1); box-shadow: 0 0 0 1px rgba(220, 38, 38, 0.35) inset, 0 0 10px rgba(239, 68, 68, 0.62); }
      50% { transform: scale(1.01); box-shadow: 0 0 0 1px rgba(248, 113, 113, 0.6) inset, 0 0 20px rgba(248, 113, 113, 0.95); }
      100% { transform: scale(1); box-shadow: 0 0 0 1px rgba(220, 38, 38, 0.35) inset, 0 0 10px rgba(239, 68, 68, 0.62); }
    }
    @keyframes competitionOnlyPulse {
      0% { transform: translate(-50%, -52%) scale(1); box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.45) inset, 0 0 10px rgba(59, 130, 246, 0.75); }
      50% { transform: translate(-50%, -52%) scale(1.02); box-shadow: 0 0 0 1px rgba(125, 211, 252, 0.7) inset, 0 0 20px rgba(56, 189, 248, 0.95); }
      100% { transform: translate(-50%, -52%) scale(1); box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.45) inset, 0 0 10px rgba(59, 130, 246, 0.75); }
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
      .avatar-picker-body {
        grid-template-columns: 1fr;
      }
      .avatar-picker-preview-panel {
        position: static;
      }
    }

    @media (max-width: 1480px), (max-height: 920px) {
      .student-info {
        padding: 24px 26px 44px 260px;
      }
      .student-info__inner {
        gap: 14px;
      }
      .student-info__split {
        gap: 14px;
      }
      .left-card {
        min-height: 440px;
        padding: 16px;
        gap: 9px;
      }
      .left-card__label {
        font-size: 18px;
      }
      .left-card__points {
        font-size: 28px;
      }
      .left-card__name {
        font-size: clamp(24px, 2.8vw, 36px);
      }
      .left-card__avatar-fallback {
        width: 180px;
        height: 180px;
      }
      .modifier-tile {
        min-height: 78px;
      }
      .modifier-tile__value {
        font-size: 17px;
      }
      .redeem-card__pts {
        font-size: 30px;
      }
      .redeem-actions {
        grid-template-columns: 1fr;
      }
      .redeem-breakdown {
        grid-template-columns: 1fr;
      }
      .stats-card {
        padding: 14px;
      }
      .stats-grid {
        gap: 9px;
      }
      .stats-cell {
        padding: 10px;
      }
      .stats-value {
        font-size: 17px;
      }
      .badge-block {
        padding: 14px;
      }
      .badge-row {
        gap: 8px;
      }
      .badge-tile {
        min-height: 108px;
      }
      .badge-tile__img {
        width: 72px;
        height: 72px;
      }
      .medal-tile {
        width: 96px;
      }
      .medal-tile img {
        width: 46px;
        height: 46px;
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

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AuthGate from "../../components/AuthGate";
import CompetitionPrestigeFrame from "../../components/CompetitionPrestigeFrame";
import EvolvingAvatar from "../../components/EvolvingAvatar";
import AvatarEffectParticles from "@/components/AvatarEffectParticles";
import AvatarRender from "@/components/AvatarRender";
import { playGlobalSfx, setGlobalSounds } from "@/lib/globalAudio";
import { fireFx } from "../../components/GlobalFx";
import { pushAnnouncement } from "../../components/AnnouncementBar";
import ChallengeMedalsGrid from "../../components/ChallengeMedalsGrid";
import StudentTopBar from "@/components/StudentTopBar";
import CriticalNoticeBar from "@/components/CriticalNoticeBar";
import AchievementsRail from "../../components/AchievementsRail";
import Particles from "react-tsparticles";
import type { Engine } from "tsparticles-engine";
import { loadSlim } from "tsparticles-slim";


type Tier = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "master";

type StudentRow = {
  id: string;
  name: string;
  level: number;
  points_total: number;
  points_balance?: number;
  lifetime_points?: number;
  is_competition_team: boolean;
  first_name?: string | null;
  last_name?: string | null;
  dob?: string | null;
  email?: string | null;
  phone?: string | null;
  emergency_contact?: string | null;
  goals?: string | null;
  notes?: string | null;
  enrollment_info?: any;
};

type Challenge = {
  id: string;
  name: string;
  description: string;
  category: string;
  comp_team_only: boolean;
};

type StudentChallenge = { challenge_id: string; tier: Tier };
type EarnedBadge = {
  badge_id: string;
  earned_at: string;
  rescinded_at?: string | null;
  achievement_badges?: { name: string; description: string; icon_url?: string | null; icon_path?: string | null; category?: string | null };
};
type BadgeCatalog = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  icon_url?: string | null;
  icon_path?: string | null;
  icon_zoom?: number | null;
  criteria_type?: string | null;
  criteria_json?: any;
};

type AvatarChoice = {
  id: string;
  name: string;
  storage_path: string | null;
  enabled: boolean;
  unlock_level?: number | null;
  unlock_points?: number | null;
  is_secondary?: boolean;
  rule_keeper_multiplier?: number | null;
  rule_breaker_multiplier?: number | null;
  skill_pulse_multiplier?: number | null;
  spotlight_multiplier?: number | null;
  daily_free_points?: number | null;
  zoom_pct?: number | null;
  competition_only?: boolean | null;
  competition_discount_pct?: number | null;
};

type AvatarEffectChoice = {
  id: string;
  key: string;
  name: string;
  unlock_level: number;
  unlock_points?: number | null;
  config?: {
    density?: number;
    size?: number;
    speed?: number;
    opacity?: number;
  } | null;
  render_mode?: string | null;
  html?: string | null;
  css?: string | null;
  js?: string | null;
  enabled: boolean;
};

type CornerOffsets = { x: number; y: number; size: number };

type CardPlateChoice = {
  id: string;
  key: string;
  name: string;
  image_url?: string | null;
  unlock_level: number;
  unlock_points?: number | null;
  enabled: boolean;
};

type CornerBorderChoice = {
  id: string;
  key: string;
  name: string;
  image_url?: string | null;
  render_mode?: string | null;
  html?: string | null;
  css?: string | null;
  js?: string | null;
  offset_x?: number | null;
  offset_y?: number | null;
  offsets_by_context?: Record<string, { x?: number | null; y?: number | null; scale?: number | null }> | null;
  unlock_level: number;
  unlock_points?: number | null;
  enabled: boolean;
};

type LevelThresholdRow = {
  level: number;
  min_lifetime_points: number;
};

type LevelSettings = {
  base_jump: number;
  difficulty_pct: number;
};

type AvatarSettings = {
  student_id: string;
  avatar_id?: string | null; // IMPORTANT: your schema uses avatar_id
  bg_color?: string | null;
  border_color?: string | null;
  glow_color?: string | null;
  pattern?: string | null;
  particle_style?: string | null;
  aura_style?: string | null;
  planet_style?: string | null;
  corner_border_key?: string | null;
  card_plate_key?: string | null;
  avatar_set_at?: string | null;
  avatar_daily_granted_at?: string | null;
  updated_at?: string | null;
};

type Tab = "Overview" | "Skills" | "Rewards" | "Challenges" | "Badges" | "Skill Pulse" | "Activity" | "Attendance" | "Spotlight" | "Profile" | "Home Quest" | "My Metrics" | "Taolu Tracker";

type SkillHistoryRow = {
  id: string;
  skill_name: string;
  skill_category?: string;
  successes: number;
  attempts: number;
  target: number;
  rate: number;
  created_at: string;
  is_battle?: boolean;
  vs_name?: string | null;
};

type LedgerRow = {
  id?: string;
  points?: number | null;
  note?: string | null;
  category?: string | null;
  source_type?: string | null;
  source_id?: string | null;
  created_at: string;
};

type ActivityItem = {
  id: string;
  title: string;
  subtitle: string;
  created_at: string;
  kind?: "points_up" | "points_down" | "checkin" | "skill" | "badge" | "camp" | "coupon" | "spotlight" | "other" | null;
};
type AttendanceSummary = {
  checkins: { id: string; checked_in_at: string; class_name: string }[];
  checkin_days: { date: string; count: number }[];
  spotlight_days: { date: string; count: number }[];
  awards: { id: string; award_date: string; name: string; points_awarded: number }[];
};
type AwardSummary = {
  total_count: number;
  total_points: number;
  types: Array<{ id: string; name: string; count: number; points: number }>;
  awards?: Array<{
    id: string;
    name: string;
    points_awarded: number;
    award_date?: string | null;
    created_at?: string | null;
    class_name?: string | null;
  }>;
};
type StudentNote = {
  id: string;
  student_id: string;
  body: string;
  category: "note" | "todo";
  urgency: "low" | "medium" | "high" | "critical";
  status: "open" | "done";
  created_at: string;
  completed_at?: string | null;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 180)}` } };
  }
}

function buildCodeDoc(html?: string | null, css?: string | null, js?: string | null) {
  const safeHtml = html ?? "";
  const safeCss = css ?? "";
  const safeJs = js ?? "";
  return `<!doctype html><html><head><meta charset="utf-8"/><style>html,body{margin:0;width:100%;height:100%;overflow:visible;background:transparent;}*{box-sizing:border-box;}img,canvas,svg{max-width:100%;max-height:100%;}</style><style>${safeCss}</style></head><body>${safeHtml}${safeJs ? `<script>${safeJs}</script>` : ""}</body></html>`;
}

function CodePreviewFrame({
  html,
  css,
  js,
  bleed = 0,
  style,
}: {
  html?: string | null;
  css?: string | null;
  js?: string | null;
  bleed?: number;
  style?: React.CSSProperties;
}) {
  const srcDoc = useMemo(() => buildCodeDoc(html, css, js), [html, css, js]);
  const size = bleed * 2;
  return (
    <iframe
      title="code-preview"
      srcDoc={srcDoc}
      sandbox="allow-scripts"
      style={{
        position: "absolute",
        inset: -bleed,
        width: `calc(100% + ${size}px)`,
        height: `calc(100% + ${size}px)`,
        border: "none",
        background: "transparent",
        pointerEvents: "none",
        ...style,
      }}
    />
  );
}

const MAX_LEVEL = 99;

function computeThresholds(baseJump: number, difficultyPct: number) {
  const levels: LevelThresholdRow[] = [];
  let total = 0;
  for (let level = 1; level <= MAX_LEVEL; level += 1) {
    if (level === 1) {
      levels.push({ level, min_lifetime_points: 0 });
      continue;
    }
    const exponent = level - 1;
    const factor = Math.pow(1 + difficultyPct / 100, exponent);
    total += baseJump * factor;
    const rounded = Math.round(total / 10) * 10;
    levels.push({ level, min_lifetime_points: Math.max(0, Math.floor(rounded)) });
  }
  return levels;
}

export default function DashboardPage() {
  return (
    <AuthGate>
      <DashboardInner />
    </AuthGate>
  );
}

export function DashboardInner() {
  const [tab, setTab] = useState<Tab>("Challenges");

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [studentId, setStudentId] = useState<string>("");
  const student = useMemo(() => students.find((s) => s.id === studentId) ?? null, [students, studentId]);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [parentRequest, setParentRequest] = useState<{ student_names: string[] } | null>(null);

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [earnedChallenges, setEarnedChallenges] = useState<StudentChallenge[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([]);
  const [prestigeCatalog, setPrestigeCatalog] = useState<BadgeCatalog[]>([]);
  const [prestigeProgress, setPrestigeProgress] = useState<Record<string, { progress: number; current: number; target: number; detail?: string }>>({});
  const [skillHistory, setSkillHistory] = useState<SkillHistoryRow[]>([]);
  const [checkinCount, setCheckinCount] = useState<number>(0);
  const [activityLedger, setActivityLedger] = useState<LedgerRow[]>([]);
  const [campSummary, setCampSummary] = useState<any | null>(null);
  const [campActivity, setCampActivity] = useState<{ orders: any[]; coupons: any[] }>({ orders: [], coupons: [] });
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [awardSummary, setAwardSummary] = useState<AwardSummary | null>(null);
  const [activityFilter, setActivityFilter] = useState<ActivityItem["kind"] | "all">("all");
  const [auraSummary, setAuraSummary] = useState<{ total_bonus: number; daily_bonus: number; multiplier_bonus: number }>({
    total_bonus: 0,
    daily_bonus: 0,
    multiplier_bonus: 0,
  });
  const [mvpCount, setMvpCount] = useState(0);
  const [medalIcons, setMedalIcons] = useState<Record<Tier, string | null>>({
    bronze: null,
    silver: null,
    gold: null,
    platinum: null,
    diamond: null,
    master: null,
  });
  const [msg, setMsg] = useState("");
  const [dailyClaimOpen, setDailyClaimOpen] = useState(false);
  const [dailyClaimBusy, setDailyClaimBusy] = useState(false);
  const [dailyClaimPayload, setDailyClaimPayload] = useState<{ points: number; avatarName: string } | null>(null);

  const [avatars, setAvatars] = useState<AvatarChoice[]>([]);
  const [avatarSettings, setAvatarSettings] = useState<AvatarSettings | null>(null);
  const [avatarEffects, setAvatarEffects] = useState<AvatarEffectChoice[]>([]);
  const [cornerBorders, setCornerBorders] = useState<CornerBorderChoice[]>([]);
  const [cardPlates, setCardPlates] = useState<CardPlateChoice[]>([]);
  const [cornerOffsets, setCornerOffsets] = useState<CornerOffsets>({ x: -8, y: -8, size: 88 });
  const [plateOffsets, setPlateOffsets] = useState<{ x: number; y: number; size: number }>({ x: 0, y: 0, size: 200 });
  const [avatarUsage, setAvatarUsage] = useState<Record<string, number>>({});
  const [customUnlocks, setCustomUnlocks] = useState<Array<{ item_type: string; item_key: string }>>([]);
  const [levelThresholds, setLevelThresholds] = useState<LevelThresholdRow[]>([]);
  const [levelSettings, setLevelSettings] = useState<LevelSettings>({ base_jump: 50, difficulty_pct: 8 });
  const [seasonSettings, setSeasonSettings] = useState<{ start_date?: string | null; weeks?: number | null }>({});
  const [unlocksLoaded, setUnlocksLoaded] = useState(false);

  const [openAvatarOverlay, setOpenAvatarOverlay] = useState(false);
  const [avatarUnlockToast, setAvatarUnlockToast] = useState<{ id: string; points: number } | null>(null);
  const avatarSettingsReq = useRef(0);
  const [effectUnlockToast, setEffectUnlockToast] = useState<{ key: string; points: number } | null>(null);
  const [cornerBorderUnlockToast, setCornerBorderUnlockToast] = useState<{ key: string; points: number } | null>(null);
  const [cardPlateUnlockToast, setCardPlateUnlockToast] = useState<{ key: string; points: number } | null>(null);
  const [openPaletteOverlay, setOpenPaletteOverlay] = useState(false);
  const [customizeTab, setCustomizeTab] = useState<"Preview" | "Background" | "Particles" | "Corner Badge" | "Nameplate">("Preview");
  const [openSkillsOverlay, setOpenSkillsOverlay] = useState(false);
  const [openSkillHistoryOverlay, setOpenSkillHistoryOverlay] = useState(false);
  const [hasNewAvatarUnlock, setHasNewAvatarUnlock] = useState(false);
  const [historySkillId, setHistorySkillId] = useState<string>("all");
  const [openPrestigeId, setOpenPrestigeId] = useState<string | null>(null);
  const [openTabOverlay, setOpenTabOverlay] = useState(false);
  const [viewerRole, setViewerRole] = useState("student");
  const [viewerStudentId, setViewerStudentId] = useState("");
  const [isNarrowLeft, setIsNarrowLeft] = useState(false);
  const [leftDockOpen, setLeftDockOpen] = useState(false);
  const [perfStats, setPerfStats] = useState<Array<{ id: string; name: string; unit?: string | null; category?: string | null }>>([]);
  const [perfRecords, setPerfRecords] = useState<Array<{ stat_id: string; value: number; recorded_at: string }>>([]);
  const [perfMsg, setPerfMsg] = useState("");
  const [metricCategory, setMetricCategory] = useState("all");
  const [metricQuery, setMetricQuery] = useState("");
  const [metricPick, setMetricPick] = useState("");
  const [taoluSummary, setTaoluSummary] = useState<any | null>(null);
  const [taoluMsg, setTaoluMsg] = useState("");
  const [taoluAgeFilter, setTaoluAgeFilter] = useState("all");
  const [taoluFormFilter, setTaoluFormFilter] = useState("all");
  const [openTaoluReportFormId, setOpenTaoluReportFormId] = useState<string | null>(null);
  const [openTaoluSessionId, setOpenTaoluSessionId] = useState<string | null>(null);
  const [taoluStartDate, setTaoluStartDate] = useState("");
  const [taoluEndDate, setTaoluEndDate] = useState("");
  const [prepsAgeFilter, setPrepsAgeFilter] = useState("all");
  const [prepsFormFilter, setPrepsFormFilter] = useState("all");
  const [prepsStartDate, setPrepsStartDate] = useState("");
  const [prepsEndDate, setPrepsEndDate] = useState("");

  const [flash, setFlash] = useState<null | "add" | "remove">(null);
  const [profileDraft, setProfileDraft] = useState({
    first_name: "",
    last_name: "",
    dob: "",
    email: "",
    phone: "",
    emergency_contact: "",
    goals: "",
    notes: "",
    enrollment_info: "",
  });
  const [profileMsg, setProfileMsg] = useState("");
  const [studentNotes, setStudentNotes] = useState<StudentNote[]>([]);
  const [noteForm, setNoteForm] = useState({ body: "", category: "note", urgency: "medium" });
  const [noteMsg, setNoteMsg] = useState("");
  const [coachTodos, setCoachTodos] = useState<Array<{ id: string; student_name: string; body: string; urgency: string; status: string; created_at: string }>>([]);
  const [todoMsg, setTodoMsg] = useState("");

  async function refreshStudents(keepSelection = false) {
    const r = await fetch("/api/students/list", { cache: "no-store" });
    const sj = await safeJson(r);
    if (!sj.ok) {
      setStudentsLoaded(true);
      return setMsg(sj.json?.error || "Failed to load students");
    }
    const list = (sj.json?.students ?? []) as StudentRow[];
    setStudents(list);
    setStudentsLoaded(true);
    if (!keepSelection) {
      setStudentId(list[0]?.id || "");
    }
  }

  async function refreshPerformanceMetrics(targetId: string) {
    if (!targetId) return;
    setPerfMsg("");
    const statsRes = await fetch("/api/performance-lab/stats", { cache: "no-store" });
    const statsJson = await safeJson(statsRes);
    if (statsJson.ok) setPerfStats((statsJson.json?.stats ?? []) as any[]);

    const recordsRes = await fetch(`/api/performance-lab/records?student_id=${targetId}`, { cache: "no-store" });
    const recordsJson = await safeJson(recordsRes);
    if (!recordsJson.ok) return setPerfMsg(recordsJson.json?.error || "Failed to load metrics");
    setPerfRecords((recordsJson.json?.records ?? []) as any[]);
  }

  async function removePerformanceMetric(statId: string) {
    if (viewerRole !== "admin") return;
    if (!studentId || !statId) return;
    const res = await fetch("/api/performance-lab/records", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId, stat_id: statId }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setPerfMsg(sj.json?.error || "Failed to remove metric");
    await refreshPerformanceMetrics(studentId);
  }

  async function refreshTaoluSummary(targetId: string, range?: { start?: string; end?: string }) {
    if (!targetId) return;
    setTaoluMsg("");
    const params = new URLSearchParams({ student_id: targetId });
    if (range?.start) params.set("start_date", range.start);
    if (range?.end) params.set("end_date", range.end);
    const res = await fetch(`/api/taolu/student-summary?${params.toString()}`, { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return setTaoluMsg(sj.json?.error || "Failed to load Taolu summary");
    setTaoluSummary(sj.json ?? null);
  }

  async function refreshStudentNotes(targetId: string) {
    if (!targetId) return;
    if (viewerRole === "student" || viewerRole === "parent") return;
    const res = await fetch(`/api/student-notes?student_id=${targetId}&limit=60`, { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return setNoteMsg(sj.json?.error || "Failed to load notes");
    setStudentNotes((sj.json?.notes ?? []) as StudentNote[]);
    setNoteMsg("");
  }

  async function refreshCoachTodos() {
    if (viewerRole !== "admin" && viewerRole !== "coach") return;
    if (!studentId) return;
    const res = await fetch(`/api/student-notes/todo?status=open&student_id=${studentId}`, { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return setTodoMsg(sj.json?.error || "Failed to load to-dos");
    setCoachTodos((sj.json?.todos ?? []) as any[]);
    setTodoMsg("");
  }

  function handleParentStudentChange(id: string) {
    setStudentId(id);
    try {
      localStorage.setItem("active_student_id", id);
    } catch {}
  }

  // load students
  useEffect(() => {
    (async () => {
      const meRes = await fetch("/api/auth/me", { cache: "no-store" });
      const me = await safeJson(meRes);
      if (me.ok) {
        setViewerRole(String(me.json?.role ?? "coach"));
        setViewerStudentId(String(me.json?.student_id ?? ""));
      }

      const sfxRes = await fetch("/api/sound-effects/list", { cache: "no-store" });
      const sfxJson = await safeJson(sfxRes);
      if (sfxJson.ok) {
        const map: Record<string, { url: string; volume: number }> = {};
        (sfxJson.json?.effects ?? []).forEach((row: any) => {
          const key = String(row?.key ?? "");
          const url = String(row?.audio_url ?? "");
          if (!key || !url) return;
          map[key] = { url, volume: Math.min(1, Math.max(0, Number(row?.volume ?? 1))) };
        });
        setGlobalSounds(map);
      }

      const r = await fetch("/api/students/list", { cache: "no-store" });
      const sj = await safeJson(r);
      if (!sj.ok) {
        setStudentsLoaded(true);
        return setMsg(sj.json?.error || "Failed to load students");
      }
      const list = (sj.json?.students ?? []) as StudentRow[];
      setStudents(list);
      setStudentsLoaded(true);
      setStudentId((prev) => {
        if (me.ok && me.json?.role === "student" && me.json?.student_id) {
          const sid = String(me.json.student_id);
          if (list.some((s) => s.id === sid)) return sid;
        }
        const saved = (() => {
          try {
            return localStorage.getItem("active_student_id") || "";
          } catch {
            return "";
          }
        })();
        if (prev && list.some((s) => s.id === prev)) return prev;
        if (saved && list.some((s) => s.id === saved)) return saved;
        return list[0]?.id || "";
      });

      if (me.ok && me.json?.role === "parent") {
        const prRes = await fetch("/api/parent/request/status", { cache: "no-store" });
        const prJson = await safeJson(prRes);
        if (prJson.ok) {
          setParentRequest(prJson.json?.request ?? null);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== "students_refresh_ts") return;
      refreshStudents(true);
    }
    function onRefresh() {
      refreshStudents(true);
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener("students-refresh", onRefresh as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("students-refresh", onRefresh as EventListener);
    };
  }, []);

  // load challenge catalog
  useEffect(() => {
    (async () => {
      const r = await fetch("/api/challenges/list", { cache: "no-store" });
      const sj = await safeJson(r);
      if (sj.ok) setChallenges((sj.json?.challenges ?? []) as Challenge[]);
    })();
  }, []);

  const loadPrestigeCatalog = useCallback(async () => {
    const r = await fetch("/api/achievements/badges", { cache: "no-store" });
    const sj = await safeJson(r);
    if (!sj.ok) return;
    setPrestigeCatalog((sj.json?.badges ?? []) as BadgeCatalog[]);
  }, []);

  // load prestige badge catalog
  useEffect(() => {
    loadPrestigeCatalog();
  }, [loadPrestigeCatalog]);

  useEffect(() => {
    const onFocus = () => loadPrestigeCatalog();
    const onVisible = () => {
      if (document.visibilityState === "visible") loadPrestigeCatalog();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadPrestigeCatalog]);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/challenges/medals", { cache: "no-store" });
      const sj = await safeJson(r);
      if (!sj.ok) return;
      setMedalIcons((prev) => ({ ...prev, ...(sj.json?.medals ?? {}) }));
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/avatar-levels", { cache: "no-store" });
      const sj = await safeJson(r);
      if (!sj.ok) return;
      const settings = sj.json?.settings ?? null;
      setLevelSettings({
        base_jump: Math.max(0, Math.floor(Number(settings?.base_jump ?? 50))),
        difficulty_pct: Math.max(0, Math.floor(Number(settings?.difficulty_pct ?? 8))),
      });
      const levels = (sj.json?.levels ?? []) as LevelThresholdRow[];
      setLevelThresholds(levels);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/season-settings", { cache: "no-store" });
      const sj = await safeJson(r);
      if (sj.ok) setSeasonSettings(sj.json?.settings ?? {});
    })();
  }, []);

  async function refreshStudentExtras(sid: string) {
    const r1 = await fetch("/api/students/challenges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: sid }),
    });
    const j1 = await safeJson(r1);
    if (j1.ok) setEarnedChallenges((j1.json?.earned ?? []) as StudentChallenge[]);
    else setMsg(j1.json?.error || "Failed to load student challenges");

    const r2 = await fetch("/api/students/badges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: sid }),
    });
    const j2 = await safeJson(r2);
    if (j2.ok) setEarnedBadges((j2.json?.earned ?? []) as EarnedBadge[]);
    else setMsg(j2.json?.error || "Failed to load student badges");

    const r3 = await fetch("/api/students/prestige-progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: sid }),
    });
    const j3 = await safeJson(r3);
    if (j3.ok) setPrestigeProgress((j3.json?.progress ?? {}) as Record<string, any>);

    const r4 = await fetch("/api/avatar/aura-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: sid }),
    });
    const j4 = await safeJson(r4);
    if (j4.ok) {
      setAuraSummary({
        total_bonus: Number(j4.json?.total_bonus ?? 0),
        daily_bonus: Number(j4.json?.daily_bonus ?? 0),
        multiplier_bonus: Number(j4.json?.multiplier_bonus ?? 0),
      });
    }
  }

  async function refreshSkillHistory(sid: string) {
    const r = await fetch("/api/skill-tracker/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: sid, limit: 12 }),
    });
    const sj = await safeJson(r);
    if (sj.ok) setSkillHistory((sj.json?.history ?? []) as SkillHistoryRow[]);
  }

  async function refreshActivity(sid: string) {
    const r = await fetch("/api/ledger/recent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: sid, limit: 25 }),
    });
    const sj = await safeJson(r);
    if (sj.ok) setActivityLedger((sj.json?.entries ?? []) as LedgerRow[]);

    const campRes = await fetch("/api/camp/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: sid, limit: 12 }),
    });
    const campJson = await safeJson(campRes);
    if (campJson.ok) {
      setCampActivity({
        orders: campJson.json?.orders ?? [],
        coupons: campJson.json?.coupons ?? [],
      });
    }

    const balanceRes = await fetch("/api/camp/balance-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: sid }),
    });
    const balanceJson = await safeJson(balanceRes);
    if (balanceJson.ok) setCampSummary(balanceJson.json ?? null);
  }

  async function refreshAttendance(sid: string) {
    const r = await fetch("/api/students/attendance-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: sid }),
    });
    const sj = await safeJson(r);
    if (sj.ok) setAttendanceSummary((sj.json ?? null) as AttendanceSummary | null);
  }

  async function refreshCheckins(sid: string) {
    const r = await fetch("/api/checkins/count", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: sid }),
    });
    const sj = await safeJson(r);
    if (sj.ok) setCheckinCount(Number(sj.json?.count ?? 0));
  }

  async function refreshMvpCount(sid: string) {
    const r = await fetch("/api/mvp/count", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: sid }),
    });
    const sj = await safeJson(r);
    if (sj.ok) setMvpCount(Number(sj.json?.count ?? 0));
  }

  async function refreshAwardSummary(sid: string) {
    const r = await fetch("/api/awards/student-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: sid }),
    });
    const sj = await safeJson(r);
    if (sj.ok) setAwardSummary((sj.json ?? null) as AwardSummary | null);
  }

  function currentWeek() {
    const start = seasonSettings.start_date ? new Date(`${seasonSettings.start_date}T00:00:00`) : null;
    if (!start || Number.isNaN(start.getTime())) return 1;
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
    return Math.max(1, diffWeeks);
  }

  function ruleBasePoints() {
    const week = currentWeek();
    return Math.min(50, Math.max(5, week * 5));
  }

  async function addOrRemovePoints(delta: number) {
    if (!student) return;
    if (viewerRole === "student" || viewerRole === "parent") return setMsg("Student accounts cannot add points.");
    setMsg("");

    const res = await fetch("/api/ledger/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: student.id, points: delta, note: `Dashboard ${delta > 0 ? "+" : ""}${delta}`, category: "manual" }),
    });

    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to update points");
    if (sj.json?.prestigeAutoError) setMsg(`Prestige auto-award failed: ${sj.json?.prestigeAutoError}`);

    fireFx(delta > 0 ? "add" : "remove");
    setFlash(delta > 0 ? "add" : "remove");
    window.setTimeout(() => setFlash(null), 520);
    if (delta > 0) playGlobalSfx("points_add");

    const r = await fetch("/api/students/list", { cache: "no-store" });
    const jl = await safeJson(r);
    if (jl.ok) setStudents((jl.json?.students ?? []) as StudentRow[]);

    await refreshStudentExtras(student.id);
    await refreshActivity(student.id);
  }

  async function refreshAvatarsAndSettings(sid: string) {
    setUnlocksLoaded(false);
    const reqId = ++avatarSettingsReq.current;
    const targetId = String(sid);
    const rA = await fetch("/api/avatars/list", { cache: "no-store" });
    const jA = await safeJson(rA);
    if (jA.ok) setAvatars((jA.json?.avatars ?? []) as AvatarChoice[]);

    const rU = await fetch("/api/avatars/usage", { cache: "no-store" });
    const jU = await safeJson(rU);
    if (jU.ok) setAvatarUsage((jU.json?.counts ?? {}) as Record<string, number>);

    const rE = await fetch("/api/avatar-effects/list", { cache: "no-store" });
    const jE = await safeJson(rE);
    if (jE.ok) setAvatarEffects((jE.json?.effects ?? []) as AvatarEffectChoice[]);

    const rC = await fetch("/api/corner-borders", { cache: "no-store" });
    const jC = await safeJson(rC);
    if (jC.ok) setCornerBorders((jC.json?.borders ?? []) as CornerBorderChoice[]);

    const rP = await fetch("/api/card-plates", { cache: "no-store" });
    const jP = await safeJson(rP);
    if (jP.ok) setCardPlates((jP.json?.plates ?? []) as CardPlateChoice[]);

    const rPos = await fetch("/api/corner-borders/settings", { cache: "no-store" });
    const jPos = await safeJson(rPos);
    if (jPos.ok && jPos.json?.settings) {
      setCornerOffsets({
        x: Number(jPos.json.settings.dashboard_x ?? -8),
        y: Number(jPos.json.settings.dashboard_y ?? -8),
        size: Number(jPos.json.settings.dashboard_size ?? 88),
      });
    }

    const rPlatePos = await fetch("/api/card-plates/settings", { cache: "no-store" });
    const jPlatePos = await safeJson(rPlatePos);
    if (jPlatePos.ok && jPlatePos.json?.settings) {
      setPlateOffsets({
        x: Number(jPlatePos.json.settings.dashboard_x ?? 0),
        y: Number(jPlatePos.json.settings.dashboard_y ?? 0),
        size: Number(jPlatePos.json.settings.dashboard_size ?? 200),
      });
    }

    const rS = await fetch("/api/avatar/get", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: sid }),
    });
    const jS = await safeJson(rS);
    if (jS.ok && avatarSettingsReq.current === reqId && String(studentId ?? "") === targetId) {
      setAvatarSettings((jS.json?.settings ?? null) as AvatarSettings | null);
    }

    const rUnlocks = await fetch("/api/unlocks/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: sid }),
    });
    const jUnlocks = await safeJson(rUnlocks);
    if (jUnlocks.ok) setCustomUnlocks((jUnlocks.json?.unlocks ?? []) as Array<{ item_type: string; item_key: string }>);
    if (jUnlocks.ok) setUnlocksLoaded(true);
  }

  useEffect(() => {
    if (!student?.id) return;
    setMsg("");
    setAvatarSettings(null);
    setUnlocksLoaded(false);
    refreshStudentExtras(student.id);
    refreshAvatarsAndSettings(student.id);
    refreshSkillHistory(student.id);
    refreshActivity(student.id);
    refreshCheckins(student.id);
    refreshMvpCount(student.id);
    refreshAwardSummary(student.id);
    refreshAttendance(student.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id]);

  useEffect(() => {
    if (!student?.id) return;
    const onAvatarChange = (event: Event) => {
      const detail = (event as CustomEvent).detail ?? {};
      if (String(detail.student_id ?? "") !== String(student.id)) return;
      refreshStudentExtras(student.id);
      refreshAvatarsAndSettings(student.id);
    };
    window.addEventListener("avatar-settings-changed", onAvatarChange as EventListener);
    return () => window.removeEventListener("avatar-settings-changed", onAvatarChange as EventListener);
  }, [student?.id]);

  const unlockSet = useMemo(() => {
    const s = new Set<string>();
    (customUnlocks ?? []).forEach((u) => {
      const type = String(u.item_type ?? "");
      const key = String(u.item_key ?? "");
      if (type && key) s.add(`${type}:${key}`);
    });
    return s;
  }, [customUnlocks]);

  useEffect(() => {
    if (!student || !avatarSettings) return;
    if (!avatarEffects.length) return;
    if (!unlocksLoaded) return;
    const selectedKey = String(avatarSettings.particle_style ?? "").trim();
    if (!selectedKey) return;
    const effect = avatarEffects.find((e) => e.key === selectedKey);
    const unlockLevel = Number(effect?.unlock_level ?? 1);
    const unlockPoints = Number(effect?.unlock_points ?? 0);
    const needsPurchase = unlockPoints > 0 && !unlockSet.has(`effect:${selectedKey}`);
    const enabled = effect?.enabled !== false;
    if (!effect || !enabled || effectiveLevel < unlockLevel || needsPurchase) {
      setAvatarEffect("none");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id, student?.level, avatarSettings?.particle_style, avatarEffects, unlockSet]);

  useEffect(() => {
    if (!student || !avatarSettings) return;
    if (!cornerBorders.length) return;
    if (!unlocksLoaded) return;
    const selectedKey = String(avatarSettings.corner_border_key ?? "").trim();
    if (!selectedKey || selectedKey === "none") return;
    const border = cornerBorders.find((b) => b.key === selectedKey);
    const unlockLevel = Number(border?.unlock_level ?? 1);
    const unlockPoints = Number(border?.unlock_points ?? 0);
    const needsPurchase = unlockPoints > 0 && !unlockSet.has(`corner_border:${selectedKey}`);
    const enabled = border?.enabled !== false;
    if (!border || !enabled || effectiveLevel < unlockLevel || needsPurchase) {
      setCornerBorder("none");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id, student?.level, avatarSettings?.corner_border_key, cornerBorders, unlockSet]);

  useEffect(() => {
    if (!student || !avatarSettings) return;
    if (!cardPlates.length) return;
    if (!unlocksLoaded) return;
    const selectedKey = String(avatarSettings.card_plate_key ?? "").trim();
    if (!selectedKey || selectedKey === "none") return;
    const plate = cardPlates.find((p) => p.key === selectedKey);
    const unlockLevel = Number(plate?.unlock_level ?? 1);
    const unlockPoints = Number(plate?.unlock_points ?? 0);
    const needsPurchase = unlockPoints > 0 && !unlockSet.has(`card_plate:${selectedKey}`);
    const enabled = plate?.enabled !== false;
    if (!plate || !enabled || effectiveLevel < unlockLevel || needsPurchase) {
      setCardPlate("none");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id, student?.level, avatarSettings?.card_plate_key, cardPlates, unlockSet]);

  useEffect(() => {
    if (!student) return;
    setProfileDraft({
      first_name: String(student.first_name ?? ""),
      last_name: String(student.last_name ?? ""),
      dob: String(student.dob ?? ""),
      email: String(student.email ?? ""),
      phone: String(student.phone ?? ""),
      emergency_contact: String(student.emergency_contact ?? ""),
      goals: String(student.goals ?? ""),
      notes: String(student.notes ?? ""),
      enrollment_info:
        student.enrollment_info && typeof student.enrollment_info === "object"
          ? JSON.stringify(student.enrollment_info, null, 2)
          : String(student.enrollment_info ?? ""),
    });
    setProfileMsg("");
  }, [student]);

  const tierMap = useMemo(() => {
    const m = new Map<string, Tier>();
    earnedChallenges.forEach((e) => m.set(e.challenge_id, e.tier));
    return m;
  }, [earnedChallenges]);

  const prestigeDisplay = useMemo(() => {
    return resolvePrestigeBadges(prestigeCatalog, prestigeProgress);
  }, [prestigeCatalog, prestigeProgress]);

  const prestigeEarnedIcons = useMemo(
    () => prestigeDisplay.filter((b) => b.earned && b.icon_url).map((b) => b.icon_url as string),
    [prestigeDisplay]
  );

  const medalCounts = useMemo(() => {
    const base: Record<Tier, number> = { bronze: 0, silver: 0, gold: 0, platinum: 0, diamond: 0, master: 0 };
    earnedChallenges.forEach((e) => (base[e.tier] = (base[e.tier] ?? 0) + 1));
    return base;
  }, [earnedChallenges]);

  const masterStars = useMemo(() => Math.min(10, medalCounts.master), [medalCounts.master]);

  const particlesInit = useCallback(async (engine: Engine) => {
    await loadSlim(engine);
  }, []);

  const badgeSparkleOptions = useMemo(
    () => ({
      fullScreen: { enable: false },
      fpsLimit: 60,
      background: { color: { value: "transparent" } },
      particles: {
        number: { value: 110, density: { enable: true, area: 220 } },
        color: { value: ["#facc15", "#ffffff", "#60a5fa"] },
        shape: { type: ["star", "circle"] },
        opacity: { value: { min: 0.55, max: 1 }, animation: { enable: true, speed: 1.2, minimumValue: 0.35 } },
        size: { value: { min: 1.4, max: 3.8 } },
        move: { enable: true, speed: 0.7, direction: "top", outModes: { default: "out" } },
        shadow: { enable: true, color: "#facc15", blur: 6 },
      },
      interactivity: {
        detectsOn: "window",
        events: { onHover: { enable: true, mode: ["repulse", "bubble"] }, resize: true },
        modes: {
          repulse: { distance: 140, duration: 0.6 },
          bubble: { distance: 140, size: 6, opacity: 1, duration: 0.4 },
        },
      },
      detectRetina: true,
    }),
    []
  );

  const recentBadgeSparkleOptions = useMemo(
    () => ({
      fullScreen: { enable: false },
      fpsLimit: 60,
      background: { color: { value: "transparent" } },
      particles: {
        number: { value: 40, density: { enable: true, area: 260 } },
        color: { value: ["#facc15", "#ffffff", "#60a5fa"] },
        shape: { type: ["star", "circle"] },
        opacity: { value: { min: 0.35, max: 0.85 }, animation: { enable: true, speed: 0.8, minimumValue: 0.25 } },
        size: { value: { min: 1.2, max: 3 } },
        move: { enable: true, speed: 0.45, direction: "top", outModes: { default: "out" } },
        shadow: { enable: true, color: "#facc15", blur: 6 },
      },
      interactivity: { events: { resize: true } },
      detectRetina: true,
    }),
    []
  );

  const medalSparkleBackOptions = useMemo(
    () => ({
      fullScreen: { enable: false },
      fpsLimit: 60,
      background: { color: { value: "transparent" } },
      particles: {
        number: { value: 100, density: { enable: true, area: 160 } },
        color: { value: ["#93c5fd", "#38bdf8", "#ffffff"] },
        shape: { type: ["star"] },
        opacity: { value: { min: 0.2, max: 0.6 }, animation: { enable: true, speed: 1.2, minimumValue: 0.15 } },
        size: { value: { min: 1.28, max: 2.56 } },
        move: { enable: true, speed: 0.8, direction: "top", outModes: { default: "out" } },
        shadow: { enable: true, color: "#facc15", blur: 6 },
      },
      interactivity: { events: { resize: true } },
      detectRetina: true,
    }),
    []
  );

  const medalSparkleFrontOptions = useMemo(
    () => ({
      fullScreen: { enable: false },
      fpsLimit: 60,
      background: { color: { value: "transparent" } },
      particles: {
        number: { value: 50, density: { enable: true, area: 120 } },
        color: { value: ["#ffffff", "#93c5fd", "#38bdf8"] },
        shape: { type: ["star"] },
        opacity: { value: { min: 0.55, max: 1 }, animation: { enable: true, speed: 1.4, minimumValue: 0.35 } },
        size: { value: { min: 1.44, max: 2.88 } },
        move: { enable: true, speed: 1, direction: "top", outModes: { default: "out" } },
        shadow: { enable: true, color: "#facc15", blur: 8 },
      },
      interactivity: { events: { resize: true } },
      detectRetina: true,
    }),
    []
  );

  const activityItems = useMemo(() => {
    const items: ActivityItem[] = [];

    activityLedger.forEach((entry, idx) => {
      const points = Number(entry.points ?? 0);
      const note = String(entry.note ?? "").trim();
      const category = String(entry.category ?? "").trim().toLowerCase();
      let title = points >= 0 ? "Points Earned" : "Points Spent";
      let subtitle = note || "";
      let kind: ActivityItem["kind"] = "other";

      if (category === "redeem" || /^redeemed:/i.test(note)) {
        title = "Reward Redeemed";
      } else if (category === "skill_complete") {
        title = "Skill Completed";
        subtitle = note.replace(/^skill:\s*/i, "");
        kind = "skill";
      }

      if (points > 0 && kind === "other") kind = "points_up";
      if (points < 0 && kind === "other") kind = "points_down";
      if (/check[-\s]?in/i.test(note) || category === "checkin") kind = "checkin";

      const pointsLabel = points ? `${points > 0 ? "+" : ""}${points} pts` : "";
      if (pointsLabel) subtitle = subtitle ? `${subtitle} • ${pointsLabel}` : pointsLabel;

      items.push({
        id: `ledger-${entry.id ?? idx}`,
        title,
        subtitle,
        created_at: entry.created_at,
        kind,
      });
    });

    earnedBadges.forEach((b, i) => {
      items.push({
        id: `badge-${b.badge_id}-${i}`,
        title: "Badge Earned",
        subtitle: b.achievement_badges?.name ?? "Badge",
        created_at: b.earned_at,
        kind: "badge",
      });
    });

    skillHistory.forEach((h) => {
      items.push({
        id: `pulse-${h.id}`,
        title: "Skill Pulse",
        subtitle: `${h.skill_name} • ${h.rate}% (${h.successes}/${h.attempts || 0})`,
        created_at: h.created_at,
        kind: "skill",
      });
    });

    const awards = (attendanceSummary?.awards ?? []) as any[];
    awards.forEach((a) => {
      const title = "Spotlight Star";
      const label = a.name ? String(a.name) : "Spotlight Award";
      const points = Number(a.points_awarded ?? 0);
      const className = String(a.class_name ?? "").trim();
      const subtitle = [label, points ? `+${points} pts` : "", className].filter(Boolean).join(" • ");
      items.push({
        id: `spotlight-${a.id}`,
        title,
        subtitle: subtitle || "Spotlight Award",
        created_at: String(a.award_date ?? a.created_at ?? ""),
        kind: "spotlight",
      });
    });

    campActivity.orders.forEach((o: any, i: number) => {
      items.push({
        id: `camp-order-${o.id ?? i}`,
        title: "Camp Purchase",
        subtitle: `${o.total_points ?? 0} pts`,
        created_at: o.paid_at,
        kind: "camp",
      });
    });

    campActivity.coupons.forEach((c: any, i: number) => {
      const name = c.camp_coupon_types?.name ?? "Coupon";
      const label =
        c.camp_coupon_types?.coupon_type === "points"
          ? `${c.camp_coupon_types?.points_value ?? 0} pts off`
          : "Item coupon";
      items.push({
        id: `camp-coupon-${c.id ?? i}`,
        title: "Camp Coupon Used",
        subtitle: `${name} • ${label} • Qty ${c.qty ?? 1}`,
        created_at: c.redeemed_at,
        kind: "coupon",
      });
    });

    return items
      .filter((i) => i.created_at)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 18);
  }, [activityLedger, earnedBadges, skillHistory, campActivity, attendanceSummary]);

  const activityKinds = useMemo(() => {
    return Array.from(new Set(activityItems.map((item) => item.kind ?? "other")));
  }, [activityItems]);

  useEffect(() => {
    if (activityFilter !== "all" && !activityKinds.includes(activityFilter)) {
      setActivityFilter("all");
    }
  }, [activityFilter, activityKinds]);

  const filteredActivityItems = useMemo(() => {
    if (activityFilter === "all") return activityItems;
    return activityItems.filter((item) => (item.kind ?? "other") === activityFilter);
  }, [activityItems, activityFilter]);

  const ledgerBalanceItems = useMemo(() => {
    const sorted = [...activityLedger].sort(
      (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
    );
    let running = Number(student?.points_total ?? 0);
    return sorted.map((entry) => {
      const points = Number(entry.points ?? 0);
      const after = running;
      running = after - points;
      return {
        ...entry,
        balance_after: after,
      };
    });
  }, [activityLedger, student?.points_total]);

  function openTabOverlayFor(next: Tab) {
    setTab(next);
    setOpenTabOverlay(true);
    if (next === "Spotlight" && student?.id) {
      refreshAwardSummary(student.id);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#my-metrics") {
      openTabOverlayFor("My Metrics");
    }
  }, []);
  useEffect(() => {
    if (!studentId) return;
    if (!viewerRole) return;
    if (viewerRole === "parent") {
      refreshStudentNotes(studentId);
      return;
    }
    const targetId = viewerRole === "student" ? viewerStudentId : studentId;
    if (!targetId) return;
    refreshPerformanceMetrics(targetId);
    refreshTaoluSummary(targetId);
    refreshStudentNotes(targetId);
    refreshCoachTodos();
  }, [studentId, viewerRole, viewerStudentId]);

  async function saveProfile() {
    if (!student) return;
    if (viewerRole === "parent") {
      setProfileMsg("Parents cannot edit student profiles.");
      return;
    }
    setProfileMsg("");
    let enrollmentInfo: any = null;
    const raw = profileDraft.enrollment_info.trim();
    if (raw) {
      try {
        enrollmentInfo = JSON.parse(raw);
      } catch {
        return setProfileMsg("Enrollment info must be valid JSON.");
      }
    }

    const res = await fetch("/api/students/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id: student.id,
        first_name: profileDraft.first_name.trim(),
        last_name: profileDraft.last_name.trim(),
        dob: profileDraft.dob.trim() || null,
        email: profileDraft.email.trim(),
        phone: profileDraft.phone.trim(),
        emergency_contact: profileDraft.emergency_contact.trim(),
        goals: profileDraft.goals.trim(),
        notes: profileDraft.notes.trim(),
        enrollment_info: enrollmentInfo,
      }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setProfileMsg(sj.json?.error || "Failed to save profile");
    setProfileMsg("Saved.");
    refreshStudents(true);
  }

  async function addStudentNote() {
    if (!student) return;
    if (!noteForm.body.trim()) {
      setNoteMsg("Enter a note before saving.");
      return;
    }
    setNoteMsg("");
    const res = await fetch("/api/student-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id: student.id,
        body: noteForm.body.trim(),
        category: noteForm.category,
        urgency: noteForm.urgency,
      }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setNoteMsg(sj.json?.error || "Failed to add note");
    setNoteForm({ body: "", category: "note", urgency: "medium" });
    refreshStudentNotes(student.id);
    refreshCoachTodos();
  }

  async function markNoteDone(id: string) {
    const res = await fetch("/api/student-notes/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "done" }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setTodoMsg(sj.json?.error || "Failed to update note");
    setStudentNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: "done", completed_at: new Date().toISOString() } : n))
    );
    setCoachTodos((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: "done", completed_at: new Date().toISOString() } : n))
    );
  }

  async function removeStudentNote(id: string) {
    const res = await fetch("/api/student-notes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setTodoMsg(sj.json?.error || "Failed to remove note");
    setStudentNotes((prev) => prev.filter((n) => n.id !== id));
    setCoachTodos((prev) => prev.filter((n) => n.id !== id));
  }

  function renderTabContent(activeTab: Tab) {
    if (activeTab === "Badges") {
      const hiddenTerms = ["first check", "horse stance", "attendance", "strength"];
      const visibleBadges = earnedBadges.filter((b) => {
        if (b.rescinded_at) return false;
        const name = String(b.achievement_badges?.name ?? "").trim().toLowerCase();
        return name && !hiddenTerms.some((term) => name.includes(term));
      });
      return (
        <div>
          <div style={{ fontWeight: 1000, marginBottom: 10 }}>Achievement Badges</div>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {visibleBadges.slice(0, 18).map((b) => (
              <div key={b.badge_id} style={card()} title={b.achievement_badges?.description ?? ""}>
                <div style={{ fontWeight: 1000 }}>{b.achievement_badges?.name ?? "Badge"}</div>
                <div style={{ opacity: 0.8, marginTop: 6 }}>{b.achievement_badges?.description ?? ""}</div>
                <div style={{ opacity: 0.7, marginTop: 8, fontSize: 12 }}>Earned: {String(b.earned_at).slice(0, 10)}</div>
              </div>
            ))}
            {!visibleBadges.length && <div style={{ opacity: 0.7 }}>No achievement badges yet.</div>}
          </div>
        </div>
      );
    }

    if (activeTab === "Skill Pulse") {
      return (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <div style={{ fontWeight: 1000 }}>Skill Pulse History</div>
            <button onClick={() => setOpenSkillHistoryOverlay(true)} style={btnGhost()}>
              Open History
            </button>
          </div>
          <div style={{ marginTop: 10, opacity: 0.8 }}>
            {skillHistory.length ? `${skillHistory.length} recent attempts loaded.` : "No Skill Pulse history yet."}
          </div>
        </div>
      );
    }

    if (activeTab === "Skills") {
      return (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", opacity: 0.9 }}>
          <div>Skill Tree opens in a large overlay.</div>
          <button onClick={() => setOpenSkillsOverlay(true)} style={btnGhost()}>
            Open Skill Tree
          </button>
        </div>
      );
    }

    if (activeTab === "Rewards") {
      return (
        <div style={{ height: "70vh", borderRadius: 18, overflow: "hidden", border: "1px solid rgba(255,255,255,0.10)" }}>
          <iframe
            src="/rewards?embed=1"
            title="Rewards"
            style={{ width: "100%", height: "100%", border: "none" }}
          />
        </div>
      );
    }

    if (activeTab === "Home Quest") {
      return (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", opacity: 0.9 }}>
          <div>Home Quest opens as a dedicated student page.</div>
          <button onClick={() => (window.location.href = "/home-quest")} style={btnGhost()}>
            Open Home Quest
          </button>
        </div>
      );
    }

    if (activeTab === "My Metrics") {
      const statById = new Map(perfStats.map((s) => [s.id, s]));
      const categorySet = new Set<string>();
      perfStats.forEach((s) => {
        String(s.category ?? "")
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean)
          .forEach((c) => categorySet.add(c));
      });
      const categoryOptions = ["all", ...Array.from(categorySet).sort()];
      const query = metricPick || metricQuery;
      const filtered = perfRecords.filter((r) => {
        const stat = statById.get(r.stat_id);
        const name = String(stat?.name ?? "").toLowerCase();
        const catList = String(stat?.category ?? "")
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean);
        const matchesCategory = metricCategory === "all" || catList.includes(metricCategory);
        const matchesQuery = !query || name.includes(query.toLowerCase());
        return matchesCategory && matchesQuery;
      });
      const suggestions = perfStats
        .filter((s) => {
          const name = String(s.name ?? "");
          if (!metricQuery.trim() || metricPick) return false;
          return name.toLowerCase().includes(metricQuery.toLowerCase());
        })
        .slice(0, 6);
      return (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 1000 }}>My Metrics</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <select
              value={metricCategory}
              onChange={(e) => setMetricCategory(e.target.value)}
              style={{
                padding: "8px 10px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.06)",
                color: "white",
                fontWeight: 900,
              }}
            >
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c === "all" ? "All categories" : c}
                </option>
              ))}
            </select>
            <div style={{ position: "relative", minWidth: 240 }}>
              <input
                value={metricPick || metricQuery}
                onChange={(e) => {
                  setMetricPick("");
                  setMetricQuery(e.target.value);
                }}
                placeholder="Search metrics..."
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.06)",
                  color: "white",
                  fontWeight: 900,
                }}
              />
              {suggestions.length ? (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    marginTop: 6,
                    background: "rgba(8,12,20,0.95)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 12,
                    padding: 6,
                    display: "grid",
                    gap: 6,
                    zIndex: 5,
                  }}
                >
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setMetricPick(s.name);
                        setMetricQuery(s.name);
                      }}
                      style={{
                        textAlign: "left",
                        padding: "6px 8px",
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.12)",
                        background: "rgba(255,255,255,0.06)",
                        color: "white",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          {perfMsg ? <div style={{ opacity: 0.7 }}>{perfMsg}</div> : null}
          {filtered.length ? (
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              {filtered.map((r) => {
                const stat = statById.get(r.stat_id);
                const label = stat?.name ?? "Metric";
                const unit = stat?.unit ? ` ${stat.unit}` : "";
                return (
                  <div key={r.stat_id} style={card()}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                      <div style={{ fontWeight: 1000 }}>{label}</div>
                      {viewerRole === "admin" ? (
                        <button onClick={() => removePerformanceMetric(r.stat_id)} style={metricRemoveBtn()}>
                          Remove
                        </button>
                      ) : null}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 1000, marginTop: 6 }}>
                      {r.value}{unit}
                    </div>
                    <div style={{ opacity: 0.7, fontSize: 11, marginTop: 6 }}>
                      {new Date(r.recorded_at).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ opacity: 0.75 }}>
              Performance metrics and rankings will show here once they are tracked.
            </div>
          )}
        </div>
      );
    }

    if (activeTab === "Taolu Tracker") {
      const forms = (taoluSummary?.forms ?? []) as any[];
      const ageGroups = (taoluSummary?.age_groups ?? []) as any[];
      const codes = (taoluSummary?.codes ?? []) as any[];
      const windows = (taoluSummary?.windows ?? []) as any[];
      const formCodeTotals = taoluSummary?.form_code_totals ?? {};
      const formSectionCodeTotals = taoluSummary?.form_section_code_totals ?? {};
      const formSectionCodeNotes = taoluSummary?.form_section_code_notes ?? {};
      const windowsSummary = taoluSummary?.windows_summary ?? {};
      const sessionHistory = taoluSummary?.session_history ?? [];
      const prepsHistory = taoluSummary?.preps_session_history ?? [];

      const codeById = new Map<string, any>(codes.map((c: any) => [String(c.id), c]));
      const ageLabelById = new Map<string, any>(ageGroups.map((g: any) => [String(g.id), g.name]));
      const formById = new Map<string, any>(forms.map((f: any) => [String(f.id), f]));
      const prepsLabels: Record<string, string> = {
        P: "Posture",
        R: "Rhythm",
        E: "Eyes",
        O: "Power",
        S: "Stances",
        unknown: "Other",
      };

      const formsForAge = taoluAgeFilter === "all"
        ? forms
        : forms.filter((f: any) => String(f.age_group_id ?? "") === taoluAgeFilter);
      const formsForPrepsAge = prepsAgeFilter === "all"
        ? forms
        : forms.filter((f: any) => String(f.age_group_id ?? "") === prepsAgeFilter);
      const filteredForms = taoluFormFilter === "all"
        ? formsForAge
        : formsForAge.filter((f: any) => String(f.id) === taoluFormFilter);
      const exportTaoluReport = () => {
        const popup = window.open("", "taolu-export");
        if (!popup) return;
        const esc = (value: any) =>
          String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;");
        const header = `
          <h1>Taolu Tracker Report</h1>
          <div class="meta">Generated ${esc(new Date().toLocaleString())}</div>
          <div class="meta">Filters: age ${esc(taoluAgeFilter)}, form ${esc(taoluFormFilter || "all")}, range ${esc(
            taoluStartDate || "—"
          )} to ${esc(taoluEndDate || "—")}</div>
          <div class="meta">PREPS filters: age ${esc(prepsAgeFilter)}, form ${esc(prepsFormFilter || "all")}, range ${esc(
            prepsStartDate || "—"
          )} to ${esc(prepsEndDate || "—")}</div>
        `;
        const formsHtml = formsWithHistory.map((form: any) => {
          const sectionTotals = formSectionCodeTotals[form.id] ?? {};
          const sectionNotes = formSectionCodeNotes[form.id] ?? {};
          const sectionKeys = Object.keys(sectionTotals).sort((a, b) => Number(a) - Number(b));
          const formHistory = historyByForm[String(form.id)] ?? [];
          const ageLabel = form.age_group_id ? ageLabelById.get(String(form.age_group_id)) : "All ages";
          const prepsTotals = prepsTotalsByForm[form.id] ?? {};
          const prepsNotes = prepsNotesByForm[form.id] ?? {};
          const prepsRefPoints = prepsRefPointsByForm[form.id] ?? 0;
          const prepsHistory = prepsHistoryByForm[String(form.id)] ?? [];
          const prepsSessionsRows = prepsHistory
            .map((s: any) => {
              const counts: Record<string, number> = {};
              (s.notes ?? []).forEach((n: any) => {
                const key = String(n.prep_key ?? "unknown");
                counts[key] = (counts[key] ?? 0) + 1;
              });
              const summary = Object.entries(counts)
                .map(([key, count]) => `${prepsLabels[key] ?? key}: ${count}`)
                .join(" • ");
              return `
                <tr>
                  <td>${esc(new Date(s.created_at).toLocaleDateString())}</td>
                  <td>${esc((s.notes ?? []).length)}</td>
                  <td>${esc(summary || "—")}</td>
                  <td>${esc(s.remediation_completed ? `+${s.remediation_points ?? 0}` : "—")}</td>
                </tr>
              `;
            })
            .join("");
          const prepsRows = Object.entries(prepsTotals)
            .map(([key, count]) => {
              const notes = (prepsNotes[key] ?? []) as string[];
              const uniq = Array.from(new Set(notes.map((n) => String(n).trim()).filter(Boolean)));
              return `
                <tr>
                  <td>${esc(prepsLabels[key] ?? key)}</td>
                  <td>${esc(count)}</td>
                  <td>${esc(uniq.join(" • ") || "—")}</td>
                </tr>
              `;
            })
            .join("");
          const sessionsHtml = formHistory.length
            ? `
                <div class="session-grid">
                  ${formHistory
                    .map((s: any) => {
                      const sessionDeductions = (s.deductions ?? []).filter((d: any) => !d.voided);
                      const sessionSections = s.sections ?? [];
                      const sectionsHtml = sessionSections.length
                        ? sessionSections
                            .map((sectionNum: number) => {
                              const sectionList = sessionDeductions.filter(
                                (d: any) => Number(d.section_number ?? 0) === Number(sectionNum)
                              );
                              const rows = sectionList
                                .map((d: any) => {
                                  const code = codeById.get(String(d.code_id ?? ""));
                                  return `
                                    <tr>
                                      <td>${esc(code?.code_number ?? "—")}</td>
                                      <td>${esc(code?.name ?? "Code")}</td>
                                      <td>${esc(d.note ?? "—")}</td>
                                      <td>${esc(new Date(d.occurred_at).toLocaleTimeString())}</td>
                                    </tr>
                                  `;
                                })
                                .join("");
                              return `
                                <div class="section-block">
                                  <div class="section-title">Section ${esc(sectionNum)}</div>
                                  ${
                                    rows
                                      ? `<table class="table">
                                            <thead>
                                              <tr>
                                                <th>Code</th>
                                                <th>Deduction</th>
                                                <th>Note</th>
                                                <th>Time</th>
                                              </tr>
                                            </thead>
                                            <tbody>${rows}</tbody>
                                          </table>`
                                      : `<div class="muted">No deductions in this section.</div>`
                                  }
                                </div>
                              `;
                            })
                            .join("")
                        : `<div class="muted">No sections recorded.</div>`;
                      return `
                        <div class="card">
                          <div class="card-title">${esc(student.name)} • ${esc(form.name)} • ${esc(ageLabel)}</div>
                          <div class="muted">${esc(new Date(s.created_at).toLocaleString())} • Sections ${esc(
                            s.sections?.join(", ") || "—"
                          )} • ${
                            sessionDeductions.length
                          } deductions</div>
                          ${sectionsHtml}
                        </div>
                      `;
                    })
                    .join("")}
                </div>
              `
            : `<div class="muted">No tracked sessions yet.</div>`;

          const lifetimeSectionHtml = sectionKeys.length
            ? sectionKeys
                .map((sectionKey: string) => {
                  const codeTotals = sectionTotals[sectionKey] ?? {};
                  const codeNotes = sectionNotes[sectionKey] ?? {};
                  const entries = Object.entries(codeTotals)
                    .map(([codeId, count]) => ({ codeId, count: count as number }))
                    .sort((a, b) => Number(b.count) - Number(a.count));
                  const rows = entries
                    .map((entry) => {
                      const code = codeById.get(String(entry.codeId));
                      const notes = (codeNotes[String(entry.codeId)] ?? []) as string[];
                      const uniq = Array.from(new Set(notes.map((n) => String(n).trim()).filter(Boolean)));
                      return `
                        <tr>
                          <td>${esc(code?.code_number ?? "—")}</td>
                          <td>${esc(code?.name ?? "Code")}</td>
                          <td>${esc(entry.count)}</td>
                          <td>${esc(uniq.join(" • ") || "—")}</td>
                        </tr>
                      `;
                    })
                    .join("");
                  return `
                    <div class="section-block">
                      <div class="section-title">Section ${esc(sectionKey)}</div>
                      ${
                        rows
                          ? `<table class="table">
                                <thead>
                                  <tr>
                                    <th>Code</th>
                                    <th>Deduction</th>
                                    <th>Total</th>
                                    <th>Notes</th>
                                  </tr>
                                </thead>
                                <tbody>${rows}</tbody>
                              </table>`
                          : `<div class="muted">No deductions logged for this section.</div>`
                      }
                    </div>
                  `;
                })
                .join("")
            : `<div class="muted">No section data yet.</div>`;
          return `
            <section class="form-block">
              <h2>${esc(form.name)}</h2>
              <div class="muted">Sections ${esc(form.sections_count)} • ${esc(ageLabel)}</div>
              <h3>Session History</h3>
              ${sessionsHtml}
              <h3>Lifetime Section Totals • ${esc(form.name)} • ${esc(ageLabel)}</h3>
              ${lifetimeSectionHtml}
              <h3>P.R.E.P.S Summary • ${esc(form.name)} • ${esc(ageLabel)}</h3>
              ${
                Object.keys(prepsTotals).length
                  ? `
                      <div class="card">
                        <div class="muted">Refinement points: ${esc(prepsRefPoints)}</div>
                        <table class="table">
                          <thead>
                            <tr>
                              <th>Category</th>
                              <th>Total</th>
                              <th>Notes</th>
                            </tr>
                          </thead>
                          <tbody>${prepsRows}</tbody>
                        </table>
                      </div>
                    `
                  : `<div class="muted">No PREPS notes logged for this form.</div>`
              }
              <h3>P.R.E.P.S Sessions • ${esc(form.name)} • ${esc(ageLabel)}</h3>
              ${
                prepsSessionsRows
                  ? `
                      <table class="table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Notes</th>
                            <th>Breakdown</th>
                            <th>Refined</th>
                          </tr>
                        </thead>
                        <tbody>${prepsSessionsRows}</tbody>
                      </table>
                    `
                  : `<div class="muted">No PREPS sessions yet.</div>`
              }
            </section>
          `;
        });

        const windowsHtml = windows.length
          ? `
              <section class="form-block">
                <h2>Deductions by Code</h2>
                ${windows
                  .map((w: any) => {
                    const counts = windowsSummary[String(w.id)] ?? {};
                    const entries = Object.entries(counts)
                      .map(([codeId, count]) => ({ codeId, count }))
                      .sort((a, b) => Number(b.count) - Number(a.count));
                    const rows = entries
                      .map((e) => {
                        const code = codeById.get(String(e.codeId));
                        return `
                          <tr>
                            <td>${esc(code?.code_number ?? "—")}</td>
                            <td>${esc(code?.name ?? "Code")}</td>
                            <td>${esc(e.count)}</td>
                          </tr>
                        `;
                      })
                      .join("");
                    return `
                      <div class="card">
                        <div class="card-title">${esc(w.label)}</div>
                        ${
                          rows
                            ? `<table class="table">
                                  <thead>
                                    <tr>
                                      <th>Code</th>
                                      <th>Deduction</th>
                                      <th>Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>${rows}</tbody>
                                </table>`
                            : `<div class="muted">No deductions in this window.</div>`
                        }
                      </div>
                    `;
                  })
                  .join("")}
              </section>
            `
          : "";

        const html = `
          <html>
            <head>
              <title>Taolu Tracker Report</title>
              <style>
                body { font-family: "Times New Roman", serif; color: #111; margin: 28px; }
                h1 { margin: 0 0 6px; font-size: 28px; }
                h2 { margin: 20px 0 6px; font-size: 20px; }
                h3 { margin: 16px 0 8px; font-size: 16px; }
                .meta { font-size: 12px; color: #555; margin-bottom: 6px; }
                .form-block { margin-bottom: 24px; page-break-inside: avoid; }
                .card { border: 1px solid #ddd; border-radius: 10px; padding: 10px 12px; margin-top: 10px; }
                .session-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
                .card-title { font-weight: 700; margin-bottom: 4px; }
                .muted { color: #666; font-size: 12px; margin-top: 4px; }
                .section-block { margin-top: 10px; }
                .section-title { font-weight: 700; margin-bottom: 6px; }
                .table { width: 100%; border-collapse: collapse; font-size: 12px; }
                .table th, .table td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; }
                .table th { background: #f3f3f3; }
              </style>
            </head>
            <body>
              ${header}
              ${formsHtml.join("")}
              ${windowsHtml}
            </body>
          </html>
        `;
        popup.document.open();
        popup.document.write(html);
        popup.document.close();
        popup.focus();
        popup.print();
      };
      const history = sessionHistory.filter((s: any) => {
        const form = formById.get(String(s.taolu_form_id ?? ""));
        if (!form) return false;
        if (taoluAgeFilter !== "all" && String(form.age_group_id ?? "") !== taoluAgeFilter) return false;
        if (taoluFormFilter !== "all" && String(form.id) !== taoluFormFilter) return false;
        if (taoluStartDate) {
          const start = new Date(taoluStartDate).getTime();
          const created = new Date(s.created_at).getTime();
          if (!Number.isNaN(start) && created < start) return false;
        }
        if (taoluEndDate) {
          const end = new Date(taoluEndDate).getTime() + 24 * 60 * 60 * 1000 - 1;
          const created = new Date(s.created_at).getTime();
          if (!Number.isNaN(end) && created > end) return false;
        }
        return true;
      });
      const prepsHistoryFiltered = prepsHistory.filter((s: any) => {
        const form = formById.get(String(s.taolu_form_id ?? ""));
        if (!form) return false;
        if (prepsAgeFilter !== "all" && String(form.age_group_id ?? "") !== prepsAgeFilter) return false;
        if (prepsFormFilter !== "all" && String(form.id) !== prepsFormFilter) return false;
        if (prepsStartDate) {
          const start = new Date(prepsStartDate).getTime();
          const created = new Date(s.created_at).getTime();
          if (!Number.isNaN(start) && created < start) return false;
        }
        if (prepsEndDate) {
          const end = new Date(prepsEndDate).getTime() + 24 * 60 * 60 * 1000 - 1;
          const created = new Date(s.created_at).getTime();
          if (!Number.isNaN(end) && created > end) return false;
        }
        return true;
      });
      const prepsTotalsByForm: Record<string, Record<string, number>> = {};
      const prepsNotesByForm: Record<string, Record<string, string[]>> = {};
      const prepsRefPointsByForm: Record<string, number> = {};
      prepsHistoryFiltered.forEach((s: any) => {
        const formId = String(s.taolu_form_id ?? "");
        if (!formId) return;
        const notes = (s.notes ?? []) as any[];
        notes.forEach((n) => {
          const key = String(n.prep_key ?? "unknown");
          if (!prepsTotalsByForm[formId]) prepsTotalsByForm[formId] = {};
          prepsTotalsByForm[formId][key] = (prepsTotalsByForm[formId][key] ?? 0) + 1;
          if (n.note) {
            if (!prepsNotesByForm[formId]) prepsNotesByForm[formId] = {};
            if (!prepsNotesByForm[formId][key]) prepsNotesByForm[formId][key] = [];
            prepsNotesByForm[formId][key].push(String(n.note));
          }
        });
        if (s.remediation_completed) {
          prepsRefPointsByForm[formId] = (prepsRefPointsByForm[formId] ?? 0) + Number(s.remediation_points ?? 0);
        }
      });
      const historyByForm = history.reduce((acc: Record<string, any[]>, s: any) => {
        const key = String(s.taolu_form_id ?? "");
        if (!acc[key]) acc[key] = [];
        acc[key].push(s);
        return acc;
      }, {});
      const prepsHistoryByForm = prepsHistoryFiltered.reduce((acc: Record<string, any[]>, s: any) => {
        const key = String(s.taolu_form_id ?? "");
        if (!acc[key]) acc[key] = [];
        acc[key].push(s);
        return acc;
      }, {});
      const formsWithHistory = filteredForms.filter((form: any) => {
        const formId = String(form.id);
        if ((historyByForm[formId] ?? []).length > 0) return true;
        if ((prepsHistoryByForm[formId] ?? []).length > 0) return true;
        if (Object.keys(prepsTotalsByForm[formId] ?? {}).length > 0) return true;
        return false;
      });
      const openSession = openTaoluSessionId
        ? sessionHistory.find((s: any) => String(s.session_id) === String(openTaoluSessionId))
        : null;

      return (
        <>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ fontWeight: 1000 }}>Taolu Tracker</div>
            {taoluMsg ? <div style={{ opacity: 0.7 }}>{taoluMsg}</div> : null}
            {forms.length ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select
                  value={taoluAgeFilter}
                  onChange={(e) => setTaoluAgeFilter(e.target.value)}
                  style={select()}
                >
                  <option value="all">All age groups</option>
                  {ageGroups.map((g: any) => (
                    <option key={g.id} value={String(g.id)}>{g.name}</option>
                  ))}
                </select>
                <select
                  value={taoluFormFilter}
                  onChange={(e) => setTaoluFormFilter(e.target.value)}
                  style={select()}
                >
                  <option value="all">All forms</option>
                  {formsForAge.map((f: any) => (
                    <option key={f.id} value={String(f.id)}>{f.name}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={taoluStartDate}
                  onChange={(e) => setTaoluStartDate(e.target.value)}
                  style={select()}
                />
                <input
                  type="date"
                  value={taoluEndDate}
                  onChange={(e) => setTaoluEndDate(e.target.value)}
                  style={select()}
                />
                <button
                  onClick={() => refreshTaoluSummary(studentId, { start: taoluStartDate, end: taoluEndDate })}
                  style={btn()}
                >
                  Apply Range
                </button>
              <button
                onClick={exportTaoluReport}
                style={btn()}
              >
                Export PDF
              </button>
              </div>
            ) : null}
            {forms.length ? (
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontWeight: 1000, fontSize: 12 }}>P.R.E.P.S Filters</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <select
                    value={prepsAgeFilter}
                    onChange={(e) => setPrepsAgeFilter(e.target.value)}
                    style={select()}
                  >
                    <option value="all">All age groups</option>
                    {ageGroups.map((g: any) => (
                      <option key={g.id} value={String(g.id)}>{g.name}</option>
                    ))}
                  </select>
                  <select
                    value={prepsFormFilter}
                    onChange={(e) => setPrepsFormFilter(e.target.value)}
                    style={select()}
                  >
                    <option value="all">All forms</option>
                    {formsForPrepsAge.map((f: any) => (
                      <option key={f.id} value={String(f.id)}>{f.name}</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={prepsStartDate}
                    onChange={(e) => setPrepsStartDate(e.target.value)}
                    style={select()}
                  />
                  <input
                    type="date"
                    value={prepsEndDate}
                    onChange={(e) => setPrepsEndDate(e.target.value)}
                    style={select()}
                  />
                </div>
              </div>
            ) : null}
            {!forms.length ? (
              <div style={{ opacity: 0.75 }}>No Taolu forms configured yet.</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontWeight: 1000 }}>Session History</div>
                  {history.length ? (
                    <div style={{ display: "grid", gap: 10 }}>
                    {history.map((s: any) => {
                      const form = formById.get(String(s.taolu_form_id ?? ""));
                      const ageLabel = form?.age_group_id ? ageLabelById.get(String(form.age_group_id)) : "";
                      const total = (s.deductions ?? []).length;
                      return (
                        <button
                          key={s.session_id}
                          onClick={() => setOpenTaoluSessionId(String(s.session_id))}
                          style={taoluHistoryCard()}
                        >
                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={{ fontWeight: 1000, fontSize: 14 }}>
                              {student.name} • {form?.name ?? "Taolu"}{ageLabel ? ` • ${ageLabel}` : ""}
                            </div>
                            <div style={taoluHistoryMeta()}>
                              <span>{new Date(s.created_at).toLocaleDateString()}</span>
                              <span>•</span>
                              <span>Sections {s.sections?.join(", ") || "—"}</span>
                              <span>•</span>
                              <span>{total} deductions</span>
                            </div>
                          </div>
                            <div style={taoluHistoryAction()}>View</div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ opacity: 0.7, fontSize: 12 }}>No tracked sessions yet.</div>
                  )}
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontWeight: 1000 }}>P.R.E.P.S Session History</div>
                  {prepsHistoryFiltered.length ? (
                    <div style={{ display: "grid", gap: 10 }}>
                      {prepsHistoryFiltered.map((s: any) => {
                        const form = formById.get(String(s.taolu_form_id ?? ""));
                        const ageLabel = form?.age_group_id ? ageLabelById.get(String(form.age_group_id)) : "";
                        const total = (s.notes ?? []).length;
                        return (
                          <div key={s.session_id} style={taoluHistoryCard()}>
                            <div style={{ display: "grid", gap: 6 }}>
                              <div style={{ fontWeight: 1000, fontSize: 14 }}>
                                {student.name} • {form?.name ?? "Taolu"}{ageLabel ? ` • ${ageLabel}` : ""}
                              </div>
                              <div style={taoluHistoryMeta()}>
                                <span>{new Date(s.created_at).toLocaleDateString()}</span>
                                <span>•</span>
                                <span>{total} notes</span>
                                {s.remediation_completed ? (
                                  <>
                                    <span>•</span>
                                    <span>Refined +{s.remediation_points ?? 0}</span>
                                  </>
                                ) : null}
                              </div>
                            </div>
                            <div style={taoluHistoryAction()}>Logged</div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ opacity: 0.7, fontSize: 12 }}>No PREPS sessions yet.</div>
                  )}
                </div>

                {formsWithHistory.map((form: any) => {
                  const sectionTotals = formSectionCodeTotals[form.id] ?? {};
                  const sectionNotes = formSectionCodeNotes[form.id] ?? {};
                  const isReportOpen = openTaoluReportFormId === String(form.id);
                  const sectionKeys = Object.keys(sectionTotals).sort((a, b) => Number(a) - Number(b));
                  const ageLabel = form.age_group_id ? ageLabelById.get(String(form.age_group_id)) : "All ages";
                  const prepsTotals = prepsTotalsByForm[form.id] ?? {};
                  const prepsNotes = prepsNotesByForm[form.id] ?? {};
                  const prepsRefPoints = prepsRefPointsByForm[form.id] ?? 0;
                  return (
                    <div key={form.id} style={card()}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontWeight: 1000 }}>{form.name}</div>
                      <button
                        onClick={() => setOpenTaoluReportFormId(isReportOpen ? null : String(form.id))}
                        style={btn()}
                      >
                        {isReportOpen ? "Hide Report" : "Report"}
                      </button>
                    </div>
                    <div style={{ opacity: 0.75, fontSize: 12 }}>
                      Sections: {form.sections_count} • {ageLabel}
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontWeight: 900, fontSize: 12 }}>
                        Lifetime section totals • {form.name} • {ageLabel}
                      </div>
                      <div style={{ marginTop: 8, display: "grid", gap: 10 }}>
                        {sectionKeys.length ? (
                          sectionKeys.map((sectionKey: string) => {
                            const codeTotals = sectionTotals[sectionKey] ?? {};
                            const codeNotes = sectionNotes[sectionKey] ?? {};
                            const entries = Object.entries(codeTotals)
                              .map(([codeId, count]) => ({ codeId, count: count as number }))
                              .sort((a, b) => Number(b.count) - Number(a.count));
                            return (
                              <div key={sectionKey} style={taoluTotalsCard()}>
                                <div style={{ fontWeight: 900, fontSize: 12 }}>Section {sectionKey}</div>
                                {entries.length ? (
                                  <div style={{ display: "grid", gap: 6 }}>
                                    {entries.map((entry) => {
                                      const code = codeById.get(String(entry.codeId));
                                      return (
                                        <div key={entry.codeId} style={taoluCodeRow()}>
                                          <span style={taoluCodeBadge()}>{code?.code_number ?? "—"}</span>
                                          <span style={taoluCodeLabel()}>{code?.name ?? "Code"}</span>
                                          <span style={taoluCodeCount()}>{entry.count}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div style={{ opacity: 0.7, fontSize: 12 }}>No deductions logged for this section.</div>
                                )}
                                {entries.length ? (
                                  <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
                                    <div style={{ fontWeight: 900, fontSize: 11, opacity: 0.8 }}>Notes</div>
                                    {entries.map((entry) => {
                                      const notes = (codeNotes[String(entry.codeId)] ?? []) as string[];
                                      const uniq = Array.from(new Set(notes.map((n) => String(n).trim()).filter(Boolean)));
                                      const preview = uniq.length ? uniq.slice(0, 6).join(" • ") : "—";
                                      const code = codeById.get(String(entry.codeId));
                                      return (
                                        <div key={`notes-${entry.codeId}`} style={{ fontSize: 11, opacity: 0.8 }}>
                                          {code?.code_number ?? "—"} {code?.name ?? "Code"}: {preview}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })
                        ) : (
                          <div style={{ opacity: 0.7, fontSize: 12 }}>No section data yet.</div>
                        )}
                      </div>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontWeight: 900, fontSize: 12 }}>Lifetime code totals</div>
                      <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                        {Object.entries(formCodeTotals[form.id] ?? {}).length ? (
                          Object.entries(formCodeTotals[form.id] ?? {}).map(([codeId, count]) => {
                            const code = codeById.get(String(codeId));
                            return (
                              <div key={codeId} style={taoluCodeRow()}>
                                <span style={taoluCodeBadge()}>{code?.code_number ?? "—"}</span>
                                <span style={taoluCodeLabel()}>{code?.name ?? "Code"}</span>
                                <span style={taoluCodeCount()}>{count as number}</span>
                              </div>
                            );
                          })
                        ) : (
                          <div style={{ opacity: 0.7, fontSize: 12 }}>No deductions logged yet.</div>
                        )}
                      </div>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontWeight: 900, fontSize: 12 }}>P.R.E.P.S Summary</div>
                      <div style={{ fontSize: 11, opacity: 0.75 }}>
                        Refinement points: {prepsRefPoints || 0}
                      </div>
                      {Object.entries(prepsTotals).length ? (
                        <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                          {Object.entries(prepsTotals).map(([key, count]) => {
                            const notes = (prepsNotes[String(key)] ?? []) as string[];
                            const uniq = Array.from(new Set(notes.map((n) => String(n).trim()).filter(Boolean)));
                            return (
                              <div key={`preps-${form.id}-${key}`} style={taoluCodeRow()}>
                                <span style={taoluCodeBadge()}>{prepsLabels[key] ?? key}</span>
                                <span style={taoluCodeLabel()}>
                                  {uniq.length ? uniq.slice(0, 4).join(" • ") : "No notes"}
                                </span>
                                <span style={taoluCodeCount()}>{count as number}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ opacity: 0.7, fontSize: 12 }}>No PREPS notes logged yet.</div>
                      )}
                    </div>
                    {isReportOpen ? (
                      <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                        <div style={{ fontWeight: 900, fontSize: 12 }}>Watch outs by section</div>
                        {sectionKeys.length ? (
                          sectionKeys.map((sectionKey: string) => {
                            const codeTotals = sectionTotals[sectionKey] ?? {};
                            const codeNotes = sectionNotes[sectionKey] ?? {};
                            const entries = Object.entries(codeTotals)
                              .map(([codeId, count]) => ({ codeId, count: count as number }))
                              .sort((a, b) => Number(b.count) - Number(a.count));
                            return (
                              <div key={`report-${sectionKey}`} style={{ fontSize: 12, opacity: 0.85 }}>
                                <b>Section {sectionKey}</b>
                                <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
                                  {entries.length ? (
                                    entries.map((entry) => {
                                      const code = codeById.get(String(entry.codeId));
                                      const label = code ? `${code.code_number} ${code.name}` : "Code";
                                      const notes = (codeNotes[String(entry.codeId)] ?? []) as string[];
                                      const noteList = notes.length ? notes.slice(0, 6).join(" • ") : "No notes";
                                      return (
                                        <div key={`${sectionKey}-${entry.codeId}`} style={{ fontSize: 11, opacity: 0.85 }}>
                                          <div>
                                            {label} • {entry.count}
                                          </div>
                                          <div style={{ opacity: 0.75 }}>{noteList}</div>
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <div style={{ opacity: 0.7, fontSize: 12 }}>No deductions yet.</div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div style={{ opacity: 0.7, fontSize: 12 }}>No section data yet.</div>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
              </div>
            )}

            {windows.length ? (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ fontWeight: 1000 }}>Deductions by Code</div>
                {windows.map((w: any) => {
                  const counts = windowsSummary[String(w.id)] ?? {};
                  const entries = Object.entries(counts)
                    .map(([codeId, count]) => ({ codeId, count }))
                    .sort((a, b) => Number(b.count) - Number(a.count));
                  return (
                    <div key={w.id} style={card()}>
                      <div style={{ fontWeight: 900 }}>{w.label}</div>
                      <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                        {entries.length ? (
                          entries.map((e) => {
                            const code = codeById.get(String(e.codeId));
                            const label = code ? `${code.code_number} ${code.name}` : "Code";
                            return (
                              <div key={e.codeId} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                                <span>{label}</span>
                                <b>{e.count as number}</b>
                              </div>
                            );
                          })
                        ) : (
                          <div style={{ opacity: 0.7, fontSize: 12 }}>No deductions in this window.</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
          {openTaoluSessionId && openSession ? (
            <CenterOverlay title="Taolu Session Details" onClose={() => setOpenTaoluSessionId(null)}>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ fontWeight: 1000, fontSize: 16 }}>
                  {student.name} • {formById.get(String(openSession.taolu_form_id ?? ""))?.name ?? "Taolu"}
                  {formById.get(String(openSession.taolu_form_id ?? ""))?.age_group_id
                    ? ` • ${ageLabelById.get(String(formById.get(String(openSession.taolu_form_id ?? ""))?.age_group_id))}`
                    : ""}
                </div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  {new Date(openSession.created_at).toLocaleString()} • Sections {openSession.sections?.join(", ") || "—"}
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  {(formById.get(String(openSession.taolu_form_id ?? ""))?.sections_count
                    ? Array.from(
                        { length: Number(formById.get(String(openSession.taolu_form_id ?? ""))?.sections_count ?? 0) },
                        (_, i) => i + 1
                      )
                    : openSession.sections ?? []
                  )
                    .filter((s: number, idx: number, arr: number[]) => arr.indexOf(s) === idx)
                    .sort((a: number, b: number) => a - b)
                    .map((sectionNum: number) => {
                      const sectionDeductions = (openSession.deductions ?? []).filter(
                        (d: any) => Number(d.section_number ?? 0) === Number(sectionNum)
                      );
                      const ordered = [...sectionDeductions].sort(
                        (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
                      );
                      const grouped = sectionDeductions.reduce((acc: Record<string, number>, d: any) => {
                        const key = String(d.code_id ?? "");
                        if (!key) return acc;
                        acc[key] = (acc[key] ?? 0) + 1;
                        return acc;
                      }, {});
                      const entries = Object.entries(grouped)
                        .map(([codeId, count]) => ({ codeId, count }))
                        .sort((a, b) => Number(b.count) - Number(a.count));
                      return (
                        <div key={`session-section-${sectionNum}`} style={taoluTotalsCard()}>
                          <div style={{ fontWeight: 900, fontSize: 12 }}>Section {sectionNum}</div>
                          {entries.length ? (
                            <div style={{ display: "grid", gap: 6 }}>
                              {entries.map((entry) => {
                                const code = codeById.get(String(entry.codeId));
                                return (
                                  <div key={entry.codeId} style={taoluCodeRow()}>
                                    <span style={taoluCodeBadge()}>{code?.code_number ?? "—"}</span>
                                    <span style={taoluCodeLabel()}>{code?.name ?? "Code"}</span>
                                    <span style={taoluCodeCount()}>{entry.count as number}</span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div style={{ opacity: 0.7, fontSize: 12 }}>No deductions in this section.</div>
                          )}
                          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 8 }}>
                            <div style={{ fontWeight: 900, fontSize: 11, opacity: 0.8 }}>Deduction Log</div>
                            {ordered.length ? (
                              <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
                                {ordered.map((d: any) => {
                                  const code = codeById.get(String(d.code_id ?? ""));
                                  const timeLabel = d.occurred_at ? new Date(d.occurred_at).toLocaleTimeString() : "—";
                                  return (
                                    <div key={d.id} style={taoluDeductionRow()}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={taoluCodeBadge()}>{code?.code_number ?? "—"}</span>
                                        <span style={taoluCodeLabel()}>{code?.name ?? "Code"}</span>
                                      </div>
                                      <div style={{ fontSize: 11, opacity: 0.65 }}>{timeLabel}</div>
                                      <div style={{ fontSize: 11, opacity: 0.8 }}>
                                        {d.note ? `Note: ${d.note}` : "Note: —"}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div style={{ opacity: 0.7, fontSize: 12 }}>No deductions logged.</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </CenterOverlay>
          ) : null}
        </>
      );
    }

    if (activeTab === "Spotlight") {
      const awards = awardSummary?.awards ?? [];
      return (
        <div>
          <div style={{ fontWeight: 1000 }}>Spotlight Stars Summary</div>
          <div style={{ opacity: 0.75, marginTop: 6, fontSize: 12 }}>
            Total awards: <b>{spotlightCount}</b> • Points earned: <b>{awardSummary?.total_points ?? 0}</b>
          </div>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {(awardSummary?.types ?? []).map((t) => (
              <div key={t.id} style={card()}>
                <div style={{ fontWeight: 1000 }}>{t.name}</div>
                <div style={{ opacity: 0.8, marginTop: 4, fontSize: 12 }}>
                  {t.count} awards • {t.points} pts
                </div>
              </div>
            ))}
            {!awardSummary?.types?.length && <div style={{ opacity: 0.7 }}>No Spotlight Stars earned yet.</div>}
          </div>
          <div style={{ marginTop: 14, fontWeight: 1000 }}>Award History</div>
          <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
            {awards.map((a) => {
              const rawDate = a.created_at ?? a.award_date ?? "";
              const dateLabel = rawDate ? new Date(rawDate).toLocaleString() : "—";
              return (
              <div key={a.id} style={card()}>
                <div style={{ fontWeight: 1000 }}>{a.name}</div>
                <div style={{ opacity: 0.8, marginTop: 4, fontSize: 12 }}>
                  {a.points_awarded} pts • {a.class_name ?? "Class"}
                </div>
                <div style={{ opacity: 0.7, marginTop: 6, fontSize: 12 }}>
                  {dateLabel}
                </div>
              </div>
              );
            })}
            {!awards.length && <div style={{ opacity: 0.7 }}>No Spotlight Stars awarded yet.</div>}
          </div>
        </div>
      );
    }

    if (activeTab === "Profile") {
      return (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ fontWeight: 1000 }}>Profile Details</div>
          {profileMsg ? <div style={profileNotice()}>{profileMsg}</div> : null}
          <div style={profileGrid()}>
            <div style={profileField()}>
              <div style={profileLabel()}>First Name</div>
              <input
                value={profileDraft.first_name}
                onChange={(e) => setProfileDraft((p) => ({ ...p, first_name: e.target.value }))}
                style={profileInput()}
              />
            </div>
            <div style={profileField()}>
              <div style={profileLabel()}>Last Name</div>
              <input
                value={profileDraft.last_name}
                onChange={(e) => setProfileDraft((p) => ({ ...p, last_name: e.target.value }))}
                style={profileInput()}
              />
            </div>
            <div style={profileField()}>
              <div style={profileLabel()}>Date of Birth</div>
              <input
                type="date"
                value={profileDraft.dob}
                onChange={(e) => setProfileDraft((p) => ({ ...p, dob: e.target.value }))}
                style={profileInput()}
              />
            </div>
            <div style={profileField()}>
              <div style={profileLabel()}>Email</div>
              <input
                value={profileDraft.email}
                onChange={(e) => setProfileDraft((p) => ({ ...p, email: e.target.value }))}
                style={profileInput()}
              />
            </div>
            <div style={profileField()}>
              <div style={profileLabel()}>Phone</div>
              <input
                value={profileDraft.phone}
                onChange={(e) => setProfileDraft((p) => ({ ...p, phone: e.target.value }))}
                style={profileInput()}
              />
            </div>
            <div style={profileField()}>
              <div style={profileLabel()}>Emergency Contact</div>
              <input
                value={profileDraft.emergency_contact}
                onChange={(e) => setProfileDraft((p) => ({ ...p, emergency_contact: e.target.value }))}
                style={profileInput()}
              />
            </div>
            <div style={profileFieldFull()}>
              <div style={profileLabel()}>Goals</div>
              <textarea
                value={profileDraft.goals}
                onChange={(e) => setProfileDraft((p) => ({ ...p, goals: e.target.value }))}
                style={profileTextarea()}
              />
            </div>
            <div style={profileFieldFull()}>
              <div style={profileLabel()}>Notes</div>
              <textarea
                value={profileDraft.notes}
                onChange={(e) => setProfileDraft((p) => ({ ...p, notes: e.target.value }))}
                style={profileTextarea()}
              />
            </div>
            <div style={profileFieldFull()}>
              <div style={profileLabel()}>Enrollment Info (JSON)</div>
              <textarea
                value={profileDraft.enrollment_info}
                onChange={(e) => setProfileDraft((p) => ({ ...p, enrollment_info: e.target.value }))}
                style={profileTextarea()}
              />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={saveProfile} style={profileSaveBtn()}>
              Save Profile
            </button>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 1000 }}>Performance Metrics</div>
            {perfMsg ? <div style={{ opacity: 0.7 }}>{perfMsg}</div> : null}
            {perfRecords.length ? (
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                {perfRecords.map((r) => {
                  const stat = perfStats.find((s) => s.id === r.stat_id);
                  const label = stat?.name ?? "Metric";
                  const unit = stat?.unit ? ` ${stat.unit}` : "";
                  return (
                    <div key={r.stat_id} style={card()}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                        <div style={{ fontWeight: 1000 }}>{label}</div>
                        {viewerRole === "admin" ? (
                          <button onClick={() => removePerformanceMetric(r.stat_id)} style={metricRemoveBtn()}>
                            Remove
                          </button>
                        ) : null}
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 1000, marginTop: 6 }}>
                        {r.value}{unit}
                      </div>
                      <div style={{ opacity: 0.7, fontSize: 11, marginTop: 6 }}>
                        {new Date(r.recorded_at).toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ opacity: 0.75 }}>No performance metrics recorded yet.</div>
            )}
          </div>
          {isStaffView ? (
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <div id="student-notes-anchor" />
              <div style={{ fontWeight: 1000 }}>Coach Notes</div>
              {noteMsg ? <div style={{ opacity: 0.8, fontSize: 12 }}>{noteMsg}</div> : null}
              {viewerRole === "admin" || viewerRole === "coach" ? (
                <div style={noteFormWrap()}>
                  <div style={{ display: "grid", gap: 6 }}>
                    <label style={profileLabel()}>Category</label>
                    <select
                      value={noteForm.category}
                      onChange={(e) => setNoteForm((p) => ({ ...p, category: e.target.value }))}
                      style={profileInput()}
                    >
                      <option value="note">Note</option>
                      <option value="todo">To-Do</option>
                    </select>
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    <label style={profileLabel()}>Urgency</label>
                    <select
                      value={noteForm.urgency}
                      onChange={(e) => setNoteForm((p) => ({ ...p, urgency: e.target.value }))}
                      style={profileInput()}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    <label style={profileLabel()}>Note</label>
                    <textarea
                      value={noteForm.body}
                      onChange={(e) => setNoteForm((p) => ({ ...p, body: e.target.value }))}
                      style={profileTextarea()}
                      placeholder="Add a quick note or to-do for this student."
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button onClick={addStudentNote} style={profileSaveBtn()}>
                      Add Note
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ opacity: 0.7, fontSize: 12 }}>
                  Only coaches and admins can add or edit notes.
                </div>
              )}
              <div style={{ display: "grid", gap: 8 }}>
                {studentNotes.length ? (
                  studentNotes.map((n) => (
                    <div key={n.id} style={noteCard(n.status === "done")}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span style={noteChip(n.category)}>{n.category.toUpperCase()}</span>
                          <span style={noteUrgency(n.urgency)}>{n.urgency.toUpperCase()}</span>
                        </div>
                        <div style={{ opacity: 0.65, fontSize: 11 }}>
                          {new Date(n.created_at).toLocaleString()}
                        </div>
                      </div>
                      <div style={{ fontWeight: 800 }}>{n.body}</div>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                        {n.status === "done" ? (
                          <span style={noteHiddenBadge()}>
                            HIDDEN{n.completed_at ? ` • ${new Date(n.completed_at).toLocaleString()}` : ""}
                          </span>
                        ) : (
                          <button onClick={() => markNoteDone(n.id)} style={noteDoneBtn()}>
                            {n.category === "todo" ? "Mark done" : "Hide"}
                          </button>
                        )}
                        {viewerRole === "admin" ? (
                          <button onClick={() => removeStudentNote(n.id)} style={noteRemoveBtn()}>
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ opacity: 0.7 }}>No notes yet.</div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      );
    }

    if (activeTab === "Activity") {
      return (
        <div style={{ maxHeight: "70vh", overflowY: "auto", display: "grid", gap: 10 }}>
          {viewerRole === "admin" || viewerRole === "coach" ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 1000 }}>Coach To-Do List</div>
              {todoMsg ? <div style={{ opacity: 0.8, fontSize: 12 }}>{todoMsg}</div> : null}
              {coachTodos.length ? (
                coachTodos.map((t) => (
                  <div key={t.id} style={noteCard(t.status === "done")}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontWeight: 900 }}>{t.student_name}</div>
                      <div style={{ opacity: 0.65, fontSize: 11 }}>{new Date(t.created_at).toLocaleString()}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                      <span style={noteUrgency(t.urgency)}>{String(t.urgency).toUpperCase()}</span>
                      <span style={{ fontWeight: 800 }}>{t.body}</span>
                      {t.status === "done" ? (
                        <span style={noteHiddenBadge()}>HIDDEN</span>
                      ) : (
                        <button onClick={() => markNoteDone(t.id)} style={noteDoneBtn()}>
                          Mark done
                        </button>
                      )}
                      {viewerRole === "admin" ? (
                        <button onClick={() => removeStudentNote(t.id)} style={noteRemoveBtn()}>
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
                ) : (
                  <div style={{ opacity: 0.7 }}>No open to-dos.</div>
                )}
            </div>
          ) : null}
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 1000 }}>Activity Filters</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button
                type="button"
                onClick={() => setActivityFilter("all")}
                style={activityChipButton("all", activityFilter === "all")}
              >
                All
              </button>
              {activityKinds.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setActivityFilter(kind)}
                  style={activityChipButton(kind, activityFilter === kind)}
                >
                  {activityChipLabel(kind)}
                </button>
              ))}
            </div>
          </div>
          <div style={{ fontWeight: 1000, marginTop: 2 }}>Highlights</div>
          {campSummary?.student ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontWeight: 1000 }}>Camp</div>
              <div style={activityCard(null)}>
                <div style={{ fontWeight: 900 }}>Balance</div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>{campSummary.balance_points ?? 0} pts</div>
                {campSummary?.aura ? (
                  <div style={{ opacity: 0.8, fontSize: 12 }}>
                    Aura: {campSummary.aura.aura_name || "—"} ({campSummary.aura.discount_points ?? 0} pts off)
                  </div>
                ) : null}
              </div>
              <div style={{ fontWeight: 900, marginTop: 4 }}>Coupons</div>
              <div style={{ display: "grid", gap: 6 }}>
                {(campSummary.coupons ?? []).length ? (
                  campSummary.coupons.map((c: any) => (
                    <div key={c.id} style={activityCard(null)}>
                      <div style={{ fontWeight: 900 }}>{c.type?.name ?? "Coupon"}</div>
                      <div style={{ opacity: 0.7, fontSize: 12 }}>
                        {c.type?.coupon_type === "points"
                          ? `${c.type?.points_value ?? 0} pts off`
                          : "Item coupon"}{" "}
                        • {c.remaining_qty} left
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ opacity: 0.7 }}>No coupons</div>
                )}
              </div>
            </div>
          ) : null}
          {attendanceSummary ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontWeight: 1000 }}>Attendance</div>
              <div style={{ display: "grid", gap: 6 }}>
                {(attendanceSummary.checkins ?? []).slice(0, 12).map((c) => (
                  <div key={c.id} style={activityCard("checkin")}>
                    <div style={{ fontWeight: 900 }}>{c.class_name}</div>
                    <div style={{ opacity: 0.7, fontSize: 11 }}>{new Date(c.checked_in_at).toLocaleString()}</div>
                  </div>
                ))}
                {!attendanceSummary.checkins?.length && <div style={{ opacity: 0.7 }}>No check-ins yet.</div>}
              </div>

              <div style={{ fontWeight: 1000, marginTop: 6 }}>Spotlight Days</div>
              <div style={{ display: "grid", gap: 6 }}>
                {(attendanceSummary.spotlight_days ?? []).slice(0, 10).map((d) => (
                  <div key={d.date} style={activityCard(null)}>
                    <div style={{ fontWeight: 900 }}>{d.date}</div>
                    <div style={{ opacity: 0.7, fontSize: 11 }}>{d.count} spotlight awards</div>
                  </div>
                ))}
                {!attendanceSummary.spotlight_days?.length && <div style={{ opacity: 0.7 }}>No spotlight days yet.</div>}
              </div>
            </div>
          ) : null}
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 1000 }}>Points Ledger</div>
            {ledgerBalanceItems.length ? (
              ledgerBalanceItems.slice(0, 20).map((entry: any, idx: number) => (
                <div key={`ledger-balance-${entry.id ?? idx}`} style={activityCard(null)}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                    <div style={{ fontWeight: 900 }}>{entry.note || entry.category || "Points Update"}</div>
                    <div style={{ opacity: 0.6, fontSize: 11 }}>{new Date(entry.created_at).toLocaleString()}</div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 6 }}>
                    <div style={{ fontWeight: 900 }}>
                      {Number(entry.points ?? 0) >= 0 ? "+" : ""}
                      {Number(entry.points ?? 0)} pts
                    </div>
                    <div style={{ fontWeight: 800, opacity: 0.75 }}>
                      Balance: {Number(entry.balance_after ?? 0)} pts
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ opacity: 0.7 }}>No ledger entries yet.</div>
            )}
          </div>
          <div style={{ fontWeight: 1000, marginTop: 2 }}>Activity Log</div>
          {filteredActivityItems.map((item) => (
            <div key={item.id} style={activityCard(item.kind ?? null)}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <span style={activityChip(item.kind ?? null)}>{activityChipLabel(item.kind ?? null)}</span>
                <span style={{ opacity: 0.6, fontSize: 11 }}>{new Date(item.created_at).toLocaleString()}</span>
              </div>
              <div style={{ fontWeight: 950, marginTop: 6 }}>{item.title}</div>
              <div style={{ opacity: 0.82, marginTop: 6, fontSize: 12 }}>{item.subtitle || "—"}</div>
            </div>
          ))}
          {!filteredActivityItems.length && <div style={{ opacity: 0.7 }}>No activity yet.</div>}
          <div style={{ opacity: 0.55, fontSize: 11 }}>
            Level-up and skill-set milestone history will appear once those events are tracked.
          </div>
        </div>
      );
    }

    if (activeTab === "Attendance") {
      return (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 1000 }}>Attendance & Spotlight Days</div>
          <div style={{ display: "grid", gap: 8 }}>
            {(attendanceSummary?.checkins ?? []).slice(0, 12).map((c) => (
              <div key={c.id} style={card()}>
                <div style={{ fontWeight: 900 }}>{c.class_name}</div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>{new Date(c.checked_in_at).toLocaleString()}</div>
              </div>
            ))}
            {!attendanceSummary?.checkins?.length && <div style={{ opacity: 0.7 }}>No check-ins yet.</div>}
          </div>
          <div style={{ fontWeight: 1000, marginTop: 6 }}>Spotlight Days</div>
          <div style={{ display: "grid", gap: 8 }}>
            {(attendanceSummary?.spotlight_days ?? []).slice(0, 10).map((d) => (
              <div key={d.date} style={card()}>
                <div style={{ fontWeight: 900 }}>{d.date}</div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>{d.count} spotlight awards</div>
              </div>
            ))}
            {!attendanceSummary?.spotlight_days?.length && <div style={{ opacity: 0.7 }}>No spotlight days yet.</div>}
          </div>
        </div>
      );
    }

    return null;
  }

  async function completeChallenge(challenge_id: string, tier: Tier) {
    if (!student) return;
    setMsg("");

    const res = await fetch("/api/challenges/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: student.id, challenge_id, tier }),
    });

    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed");

    pushAnnouncement(`${student.name} earned a ${tier.toUpperCase()} medal`);
    await refreshStudentExtras(student.id);
  }

  // IMPORTANT: your table uses avatar_id
  const selectedAvatarId = String(avatarSettings?.avatar_id ?? "").trim();
  const selectedAvatar = useMemo(() => avatars.find((a) => a.id === selectedAvatarId) ?? null, [avatars, selectedAvatarId]);
  const activeAura = useMemo(() => {
    if (!selectedAvatar) return null;
    return {
      ruleKeeper: Number(selectedAvatar.rule_keeper_multiplier ?? 1),
      ruleBreaker: Number(selectedAvatar.rule_breaker_multiplier ?? 1),
      skillPulse: Number(selectedAvatar.skill_pulse_multiplier ?? 1),
      spotlight: Number(selectedAvatar.spotlight_multiplier ?? 1),
      daily: Number(selectedAvatar.daily_free_points ?? 0),
    };
  }, [selectedAvatar]);
  const baseRulePoints = ruleBasePoints();
  const auraRuleKeeperPoints = Math.ceil(baseRulePoints * (activeAura?.ruleKeeper ?? 1));
  const auraRuleBreakerPoints = Math.ceil(baseRulePoints * (activeAura?.ruleBreaker ?? 1));
  const auraSkillPulseMultiplier = Math.max(1, Math.ceil(activeAura?.skillPulse ?? 1));
  const auraSpotlightMultiplier = Math.max(1, Math.ceil(activeAura?.spotlight ?? 1));
  const auraDailyPoints = Math.ceil(activeAura?.daily ?? 0);
  const hasAuraModifier = Boolean(
    activeAura &&
      ((activeAura.ruleKeeper ?? 1) !== 1 ||
        (activeAura.ruleBreaker ?? 1) !== 1 ||
        (activeAura.skillPulse ?? 1) !== 1 ||
        (activeAura.spotlight ?? 1) !== 1 ||
        (activeAura.daily ?? 0) > 0)
  );
  const dailyBonusNext = useMemo(() => {
    const base = avatarSettings?.avatar_daily_granted_at || avatarSettings?.avatar_set_at;
    if (!base) return { at: null as Date | null, ready: false };
    const baseTime = new Date(base).getTime();
    if (!Number.isFinite(baseTime)) return { at: null as Date | null, ready: false };
    const nextAt = new Date(baseTime + 24 * 60 * 60 * 1000);
    const now = new Date();
    if (nextAt.getTime() <= now.getTime()) return { at: now, ready: true };
    return { at: nextAt, ready: false };
  }, [avatarSettings?.avatar_daily_granted_at, avatarSettings?.avatar_set_at]);
  const dailyBonusNextText =
    auraDailyPoints > 0 && dailyBonusNext.at
      ? dailyBonusNext.ready
        ? "Next drop: Ready now"
        : `Next drop: ${dailyBonusNext.at.toLocaleString()}`
      : null;
  const canRedeemDaily = viewerRole === "admin" || viewerRole === "student";

  async function redeemDailyBonus() {
    if (!student) return;
    if (dailyClaimBusy) return;
    if (!canRedeemDaily) return;
    if (auraDailyPoints <= 0) return setMsg("Daily bonus not configured.");
    if (!dailyBonusNext.ready) return setMsg("Daily bonus not ready yet.");

    setMsg("");
    setDailyClaimBusy(true);

    try {
      const res = await fetch("/api/avatar/daily-redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: student.id }),
      });
      const sj = await safeJson(res);
      if (!sj.ok) return setMsg(sj.json?.error || "Failed to redeem daily bonus");

      const points = Math.max(0, Number(sj.json?.points ?? auraDailyPoints));
      const avatarName = String(sj.json?.avatar_name ?? selectedAvatar?.name ?? "Avatar");
      setDailyClaimPayload({ points, avatarName });
      setDailyClaimOpen(true);
      if (viewerRole === "admin") playGlobalSfx("points_add");

      window.setTimeout(() => {
        setDailyClaimOpen(false);
        setDailyClaimPayload(null);
      }, 2400);

      await refreshStudents(true);
      await refreshStudentExtras(student.id);
      await refreshActivity(student.id);
      await refreshAvatarsAndSettings(student.id);
    } finally {
      setDailyClaimBusy(false);
    }
  }

  // If you made the bucket PUBLIC: use public URL directly (no signer route)
  const avatarImgSrc =
    selectedAvatar?.storage_path
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${selectedAvatar.storage_path}`
      : "";
  const avatarZoomPct = Math.max(50, Math.min(200, Number(selectedAvatar?.zoom_pct ?? 100)));
  const pointsBalance = Number(student?.points_balance ?? student?.points_total ?? 0);
  const lifetimePoints = Number(student?.lifetime_points ?? 0);
  const thresholdMap = useMemo(() => {
    const source = levelThresholds.length
      ? levelThresholds
      : computeThresholds(levelSettings.base_jump, levelSettings.difficulty_pct);
    return new Map(source.map((row) => [row.level, row.min_lifetime_points]));
  }, [levelSettings.base_jump, levelSettings.difficulty_pct, levelThresholds]);
  const effectiveLevel = useMemo(() => {
    const fallback = Number(student?.level ?? 1);
    if (!thresholdMap.size) return fallback;
    let level = 1;
    const sorted = Array.from(thresholdMap.entries()).sort((a, b) => a[0] - b[0]);
    for (const [lvl, min] of sorted) {
      if (lifetimePoints >= Number(min ?? 0)) level = Number(lvl);
    }
    return Math.max(level, 1);
  }, [lifetimePoints, student?.level, thresholdMap]);
  const currentLevel = effectiveLevel;
  const selectedEffect = avatarEffects.find((e) => e.key === String(avatarSettings?.particle_style ?? ""));
  const selectedEffectIsCode = selectedEffect?.render_mode === "code";
  const activeEffectKey = String(avatarSettings?.particle_style ?? "").trim() || null;
  const rawCornerBorderKey = String(avatarSettings?.corner_border_key ?? "").trim();
  const selectedCornerBorderKey = rawCornerBorderKey === "none" ? "" : rawCornerBorderKey;
  const selectedCornerBorder = cornerBorders.find((b) => b.key === selectedCornerBorderKey) ?? null;
  const selectedCornerBorderUnlocked = (() => {
    if (!selectedCornerBorder) return false;
    const unlockLevel = Number(selectedCornerBorder.unlock_level ?? 1);
    const unlockPoints = Number(selectedCornerBorder.unlock_points ?? 0);
    const needsPurchase = unlockPoints > 0 && !unlockSet.has(`corner_border:${selectedCornerBorder.key}`);
    const levelOk = currentLevel >= unlockLevel;
    return selectedCornerBorder.enabled !== false && levelOk && !needsPurchase;
  })();
  const selectedCornerBorderUrl =
    selectedCornerBorderUnlocked && selectedCornerBorder?.render_mode !== "code"
      ? selectedCornerBorder?.image_url ?? null
      : null;
  const selectedCornerBorderIsCode =
    selectedCornerBorderUnlocked && selectedCornerBorder?.render_mode === "code";
  const rawCardPlateKey = String(avatarSettings?.card_plate_key ?? "").trim();
  const selectedCardPlateKey = rawCardPlateKey === "none" ? "" : rawCardPlateKey;
  const selectedCardPlate = cardPlates.find((p) => p.key === selectedCardPlateKey) ?? null;
  const selectedCardPlateUrl = (() => {
    if (!selectedCardPlate) return null;
    const unlockLevel = Number(selectedCardPlate.unlock_level ?? 1);
    const unlockPoints = Number(selectedCardPlate.unlock_points ?? 0);
    const needsPurchase = unlockPoints > 0 && !unlockSet.has(`card_plate:${selectedCardPlate.key}`);
    const levelOk = currentLevel >= unlockLevel;
    return selectedCardPlate.enabled !== false && levelOk && !needsPurchase
      ? selectedCardPlate.image_url ?? null
      : null;
  })();
  const unlockedAvatars = useMemo(
    () =>
      avatars.filter((a) => {
        if (!a.enabled) return false;
        const levelOk = currentLevel >= Number(a.unlock_level ?? 1);
        const unlockPoints = Number(a.unlock_points ?? 0);
        const needsPurchase = unlockPoints > 0 && !unlockSet.has(`avatar:${a.id}`);
        return levelOk && !needsPurchase;
      }),
    [avatars, currentLevel, unlockSet]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!student?.id) return;
    const key = `avatar_unlock_seen_${student.id}`;
    const seen = Number(window.localStorage.getItem(key) ?? "0");
    const maxUnlocked = unlockedAvatars.reduce(
      (max, a) => Math.max(max, Number(a.unlock_level ?? 1)),
      0
    );
    setHasNewAvatarUnlock(maxUnlocked > seen);
  }, [student?.id, unlockedAvatars]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!student?.id) return;
    if (!openAvatarOverlay) return;
    const key = `avatar_unlock_seen_${student.id}`;
    const maxUnlocked = unlockedAvatars.reduce(
      (max, a) => Math.max(max, Number(a.unlock_level ?? 1)),
      0
    );
    window.localStorage.setItem(key, String(maxUnlocked));
    setHasNewAvatarUnlock(false);
  }, [openAvatarOverlay, student?.id, unlockedAvatars]);

  function emitAvatarSettingsChange(next: Partial<AvatarSettings>) {
    if (typeof window === "undefined") return;
    if (!student?.id) return;
    window.dispatchEvent(
      new CustomEvent("avatar-settings-changed", {
        detail: {
          student_id: student.id,
          avatar_id: next.avatar_id ?? avatarSettings?.avatar_id ?? null,
          bg_color: next.bg_color ?? avatarSettings?.bg_color ?? null,
          particle_style: next.particle_style ?? avatarSettings?.particle_style ?? null,
          corner_border_key: next.corner_border_key ?? avatarSettings?.corner_border_key ?? null,
          card_plate_key: next.card_plate_key ?? avatarSettings?.card_plate_key ?? null,
        },
      })
    );
  }

  async function setAvatar(avatarId: string) {
    if (!student) return;

    const id = String(avatarId ?? "").trim();
    if (!id) return setMsg("Missing avatar id");

    setMsg("");
    const res = await fetch("/api/avatar/set", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: student.id, avatar_id: id }), // avatar_id only
    });

    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to set avatar");

    // optimistic UI: update local settings immediately
    setAvatarSettings((prev) => ({ ...(prev ?? { student_id: student.id }), avatar_id: id }));
    emitAvatarSettingsChange({ avatar_id: id });
    await refreshAvatarsAndSettings(student.id);
    await refreshStudentExtras(student.id);
    setOpenAvatarOverlay(false);
  }

  async function setBgColor(color: string) {
    if (!student) return;
    const c = String(color ?? "").trim();
    if (!c) return;

    setMsg("");

    // optimistic UI so it changes instantly
    setAvatarSettings((prev) => ({ ...(prev ?? { student_id: student.id }), bg_color: c }));
    emitAvatarSettingsChange({ bg_color: c });

    const res = await fetch("/api/avatar/style", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: student.id, bg_color: c }),
    });

    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to save style");

    // keep server truth
    setAvatarSettings((sj.json?.settings ?? null) as AvatarSettings | null);
    emitAvatarSettingsChange({ bg_color: (sj.json?.settings ?? null)?.bg_color });
  }

  async function setAvatarEffect(effectKey: string) {
    if (!student) return;
    const key = String(effectKey ?? "").trim();
    if (!key) return;

    setMsg("");
    setAvatarSettings((prev) => ({ ...(prev ?? { student_id: student.id }), particle_style: key }));
    emitAvatarSettingsChange({ particle_style: key });

    const res = await fetch("/api/avatar/style", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: student.id, particle_style: key }),
    });

    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to save effect");
    setAvatarSettings((sj.json?.settings ?? null) as AvatarSettings | null);
    emitAvatarSettingsChange({ particle_style: (sj.json?.settings ?? null)?.particle_style });
  }

  async function setCornerBorder(borderKey: string) {
    if (!student) return;
    const key = String(borderKey ?? "").trim();
    if (!key) return;

    setMsg("");
    setAvatarSettings((prev) => ({ ...(prev ?? { student_id: student.id }), corner_border_key: key }));
    emitAvatarSettingsChange({ corner_border_key: key });

    const res = await fetch("/api/avatar/style", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: student.id, corner_border_key: key }),
    });

    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to save corner border");
    setAvatarSettings((sj.json?.settings ?? null) as AvatarSettings | null);
    emitAvatarSettingsChange({ corner_border_key: (sj.json?.settings ?? null)?.corner_border_key });
  }

  async function setCardPlate(plateKey: string) {
    if (!student) return;
    const key = String(plateKey ?? "").trim();
    if (!key) return;

    setMsg("");
    setAvatarSettings((prev) => ({ ...(prev ?? { student_id: student.id }), card_plate_key: key }));
    emitAvatarSettingsChange({ card_plate_key: key });

    const res = await fetch("/api/avatar/style", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: student.id, card_plate_key: key }),
    });

    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to save card plate");
    setAvatarSettings((sj.json?.settings ?? null) as AvatarSettings | null);
    emitAvatarSettingsChange({ card_plate_key: (sj.json?.settings ?? null)?.card_plate_key });
  }

  async function purchaseUnlock(itemType: string, itemKey: string) {
    if (!student) return false;
    setMsg("");
    const res = await fetch("/api/unlocks/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: student.id, item_type: itemType, item_key: itemKey }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) {
      setMsg(sj.json?.error || "Failed to unlock");
      return false;
    }
    if (sj.json?.student) {
      setStudents((prev) =>
        prev.map((s) => (s.id === student.id ? { ...s, ...sj.json.student } : s))
      );
    }
    setCustomUnlocks((prev) => {
      const next = prev ?? [];
      if (next.some((u) => u.item_type === itemType && u.item_key === itemKey)) return next;
      return [...next, { item_type: itemType, item_key: itemKey }];
    });
    const rU = await fetch("/api/unlocks/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: student.id }),
    });
    const jU = await safeJson(rU);
    if (jU.ok) setCustomUnlocks((jU.json?.unlocks ?? []) as Array<{ item_type: string; item_key: string }>);
    if (jU.ok) setUnlocksLoaded(true);
    return true;
  }

  function flashAvatarUnlock(id: string, points: number) {
    setAvatarUnlockToast({ id, points });
    window.setTimeout(() => setAvatarUnlockToast(null), 1800);
  }

function flashEffectUnlock(key: string, points: number) {
  setEffectUnlockToast({ key, points });
  window.setTimeout(() => setEffectUnlockToast(null), 1800);
}

function flashCornerBorderUnlock(key: string, points: number) {
  setCornerBorderUnlockToast({ key, points });
  window.setTimeout(() => setCornerBorderUnlockToast(null), 1800);
}

function flashCardPlateUnlock(key: string, points: number) {
  setCardPlateUnlockToast({ key, points });
  window.setTimeout(() => setCardPlateUnlockToast(null), 1800);
}

  const isComp = !!student?.is_competition_team;
  const isParentView = viewerRole === "parent";
  const isStudentView = viewerRole === "student" || isParentView;
  const isStaffView = ["admin", "coach", "classroom"].includes(viewerRole);
  const isReadOnlyView = isStudentView;
  const compCrestUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/badges/prestige/compteam.png`
    : "";
  const spotlightCount = Number(awardSummary?.total_count ?? 0);
  const badgeCountDisplay = Math.max(earnedBadges.length, isComp ? 1 : 0);
  const currentLevelMin = thresholdMap.get(effectiveLevel) ?? 0;
  const nextLevelMin = thresholdMap.get(effectiveLevel + 1) ?? null;
  const nextLevelPointsLeft = nextLevelMin ? Math.max(0, nextLevelMin - lifetimePoints) : 0;
  const progressSpan = nextLevelMin ? Math.max(1, nextLevelMin - currentLevelMin) : 1;
  const progressValue = nextLevelMin
    ? Math.min(1, Math.max(0, (lifetimePoints - currentLevelMin) / progressSpan))
    : 1;

  // bg_color applies ONLY to avatar box
  const avatarBoxBg = String(avatarSettings?.bg_color ?? "").trim() || "rgba(0,0,0,0.55)";
  const showRecentBadgeSparkles = (earnedBadges ?? []).length > 0;

  const tabItems = useMemo(() => {
    const base = [
      { key: "Activity", label: "Activity" },
      { key: "Attendance", label: "Attendance" },
      { key: "Badges", label: "Badges" },
      { key: "Challenges", label: "Challenge Vault" },
      { key: "Home Quest", label: "Home Quest" },
      { key: "My Metrics", label: "My Metrics" },
      { key: "Profile", label: "Profile" },
      { key: "Rewards", label: "Rewards" },
      { key: "Skills", label: "Skills" },
      { key: "Spotlight", label: "Spotlight Stars" },
      { key: "Taolu Tracker", label: "Taolu Tracker" },
    ];

    if (!isStudentView) {
      base.push({ key: "Skill Pulse", label: "Skill Pulse" });
    }

    if (isParentView) {
      const allowed = new Set(["Activity", "Attendance", "Badges", "Skills", "Spotlight", "Home Quest"]);
      return base.filter((t) => allowed.has(t.key));
    }

    base.sort((a, b) => a.label.localeCompare(b.label));
    const profileIndex = base.findIndex((t) => t.key === "Profile");
    if (profileIndex >= 0) {
      const [profile] = base.splice(profileIndex, 1);
      base.unshift(profile);
    }
    return base;
  }, [isParentView, isStudentView]);

  useEffect(() => {
    if (!isParentView) return;
    const allowed = new Set(["Activity", "Attendance", "Badges", "Skills", "Spotlight", "Home Quest"]);
    if (!allowed.has(tab)) {
      setTab("Activity");
    }
  }, [isParentView, tab]);

  const customizeTabLabels: Record<"Preview" | "Background" | "Particles" | "Corner Badge" | "Nameplate", string> = {
    Preview: "Preview",
    Background: "Background",
    Particles: "BG Particles",
    "Corner Badge": "Corner Badge",
    Nameplate: "Nameplate",
  };

  const tabSplitIndex = Math.ceil(tabItems.length / 2);
  const topTabs = tabItems.slice(0, tabSplitIndex);
  const bottomTabs = tabItems.slice(tabSplitIndex);
  const hideLeftDock = tab === "Rewards";
  const showLeftDock = !hideLeftDock && (!isNarrowLeft || leftDockOpen);

  useEffect(() => {
    const onResize = () => setIsNarrowLeft(window.innerWidth < 1280);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!isNarrowLeft) {
      setLeftDockOpen(true);
    } else {
      setLeftDockOpen(false);
    }
  }, [isNarrowLeft]);

  if (isParentView && studentsLoaded && !students.length) {
    return (
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ fontSize: 28, fontWeight: 1000 }}>Dashboard</div>
        <div style={pendingCard()}>
          <div style={{ fontWeight: 900 }}>Pending approval</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Please allow up to 24 hours for pairing.</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            Requested students: {parentRequest?.student_names?.length ? parentRequest.student_names.join(", ") : "None provided"}
          </div>
        </div>
      </div>
    );
  }

  if (!student) return <div style={{ opacity: 0.8 }}>Loading…</div>;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {!hideLeftDock && isNarrowLeft && !leftDockOpen ? (
        <button
          onClick={() => setLeftDockOpen(true)}
          style={leftDockHandle()}
        >
          ☰ Student Panel
        </button>
      ) : null}
      {showLeftDock ? (
        <div
          style={{ position: "fixed", left: 12, top: 150, width: 320, zIndex: 400, display: "grid", gap: 12 }}
          onMouseEnter={() => {
            if (isNarrowLeft) setLeftDockOpen(true);
          }}
          onMouseLeave={() => {
            if (isNarrowLeft) setLeftDockOpen(false);
          }}
        >
          <StudentTopBar
            students={students}
            activeStudentId={studentId}
            onChangeStudent={setStudentId}
            sticky={false}
            dock="left"
            autoHide={false}
            prestigeBadges={prestigeEarnedIcons}
            readonly={isReadOnlyView}
            quickPoints={isStaffView ? [1, 2, 5, 10, 15, -1, -2, -5, -10, -15] : undefined}
            onQuickPoints={isStaffView ? addOrRemovePoints : undefined}
          />
          <div style={recentBadgesBar()}>
            {showRecentBadgeSparkles ? (
              <div style={recentBadgesSparkles()}>
                <Particles
                  id="recent-badges-sparkles"
                  init={particlesInit}
                  options={recentBadgeSparkleOptions as any}
                  style={{ position: "absolute", inset: 0 }}
                />
              </div>
            ) : null}
            <div style={recentBadgesLabel()}>Recent badges</div>
            {(earnedBadges ?? [])
              .filter((b) => !b.rescinded_at)
              .filter((b) => {
                const name = String(b.achievement_badges?.name ?? "").trim().toLowerCase();
                return name && !["first check", "horse stance", "attendance", "strength"].some((term) => name.includes(term));
              })
              .slice(0, 5)
              .map((b) => (
              <div key={b.badge_id} style={recentBadgeSlot()}>
                {b.achievement_badges?.icon_url ? (
                  <img src={b.achievement_badges.icon_url} alt={b.achievement_badges?.name ?? "Badge"} style={recentBadgeImg()} />
                ) : (
                  <div style={recentBadgeFallback()}>{(b.achievement_badges?.name ?? "?").slice(0, 1)}</div>
                )}
              </div>
            ))}
            {!earnedBadges.length ? <div style={recentBadgesEmpty()}>No badges yet</div> : null}
          </div>
          <CriticalNoticeBar
            dock="left"
            studentId={student?.id}
            recentActivity={activityItems.slice(0, 3)}
          />
        </div>
      ) : null}
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
          <div style={{ fontSize: 28, fontWeight: 1000 }}>Dashboard</div>
          {isParentView ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.7 }}>Student</div>
              <select
                value={studentId}
                onChange={(e) => handleParentStudentChange(e.target.value)}
                style={parentStudentSelect()}
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        {msg && <div style={errorBox()}>{msg}</div>}

        <div style={outerWrap(isComp, flash)}>
          <div style={{ display: "grid", gridTemplateColumns: "520px 1fr", gap: 14 }}>
            {/* LEFT */}
          <CompetitionPrestigeFrame
            show={isComp}
            masterStars={masterStars}
            badges={[]}
            badgeSize={72}
            badgeGlow
            showCrest={false}
            badgePosition="bottom"
            labelPosition="left"
            badgeSparkles
          >
            <div style={profilePanel(isComp)}>
              {selectedCardPlateUrl ? <img src={selectedCardPlateUrl} alt="" style={cardPlateStyle(plateOffsets)} /> : null}
              <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 14, alignItems: "center" }}>
                <div style={{ display: "grid", justifyItems: "center", gap: 10 }}>
                  <div style={{ width: "100%" }}>
                    <div style={levelBig()}>
                      <div style={{ opacity: 0.85, fontWeight: 950, fontSize: 12 }}>LEVEL</div>
                      <div style={{ fontSize: 56, fontWeight: 1100, lineHeight: 0.95, textShadow: "0 10px 30px rgba(0,0,0,0.50)" }}>
                        {effectiveLevel}
                      </div>
                    </div>
                  </div>
                  {isComp && compCrestUrl ? (
                    <div style={compCrestBox()}>
                      <img src={compCrestUrl} alt="Competition Team Crest" style={{ width: 48, height: 48, objectFit: "contain" }} />
                    </div>
                  ) : null}
                  <button
                    onClick={() => setOpenAvatarOverlay(true)}
                    title="Change avatar"
                    style={avatarFrameBtn(isComp)}
                  >
                    {hasNewAvatarUnlock ? <div style={avatarUnlockBadge()} /> : null}
                    {/* avatar bg ONLY here */}
                    <AvatarRender
                      size={150}
                      bg="transparent"
                      style={avatarBox(avatarBoxBg, isComp)}
                      border={selectedCornerBorder ?? undefined}
                      effect={selectedEffect ? { ...selectedEffect, key: activeEffectKey } : { key: activeEffectKey }}
                      avatarSrc={avatarImgSrc || null}
                      avatarZoomPct={avatarZoomPct}
                      cornerOffsets={cornerOffsets}
                      bleed={24}
                      contextKey="dashboard"
                      fallback={<EvolvingAvatar level={effectiveLevel} size={132} variant="dragon" />}
                    />
                  </button>

                  <div style={{ opacity: 0.85, fontWeight: 950, fontSize: 12 }}>
                    {selectedAvatar ? selectedAvatar.name : "Default Avatar"}
                  </div>

                  <button
                    onClick={() => {
                      setCustomizeTab("Preview");
                      setOpenPaletteOverlay(true);
                    }}
                    style={btnGhost()}
                  >
                    Customize
                  </button>
                  {student.goals ? (
                    <div style={goalsPlaque()} title={String(student.goals)}>
                      {String(student.goals)}
                    </div>
                  ) : null}
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ fontSize: 26, fontWeight: 1000, lineHeight: 1.05 }}>{student.name}</div>

                  <div style={{ marginTop: 6, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
                    <div style={statBig()}>
                      <div style={{ opacity: 0.85, fontWeight: 950, fontSize: 12 }}>POINTS BALANCE</div>
                      <div style={{ fontSize: 30, fontWeight: 1050 }}>{pointsBalance.toLocaleString()}</div>
                    </div>

                    <div style={statBig()}>
                      <div style={{ opacity: 0.85, fontWeight: 950, fontSize: 12 }}>LIFETIME POINTS</div>
                      <div style={{ fontSize: 30, fontWeight: 1050 }}>{lifetimePoints.toLocaleString()}</div>
                    </div>

                    <div style={statBig()}>
                      <div style={{ opacity: 0.85, fontWeight: 950, fontSize: 12 }}>TEAM MVPs</div>
                      <div style={{ fontSize: 30, fontWeight: 1050 }}>{mvpCount.toLocaleString()}</div>
                    </div>

                    <div style={auraStatBig(hasAuraModifier)}>
                      <div style={{ opacity: 0.85, fontWeight: 950, fontSize: 12 }}>AVATAR AURA BOOST</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        Daily bonus +{Math.max(0, auraDailyPoints)}
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <div style={auraGrid()}>
                          <div style={auraTile("rgba(34,197,94,0.85)", auraRuleKeeperPoints !== baseRulePoints)}>
                            <div style={auraTileLabel()}>Rule Keeper</div>
                            {auraRuleKeeperPoints !== baseRulePoints ? (
                              <div style={auraTileOldValue()}>+{baseRulePoints}</div>
                            ) : null}
                            <div style={auraTileValue()}>
                              +{auraRuleKeeperPoints}
                              {auraRuleKeeperPoints > baseRulePoints ? <span style={auraArrow("up")}>↑</span> : null}
                            </div>
                          </div>
                          <div style={auraTile("rgba(239,68,68,0.85)", auraRuleBreakerPoints !== baseRulePoints)}>
                            <div style={auraTileLabel()}>Rule Breaker</div>
                            {auraRuleBreakerPoints !== baseRulePoints ? (
                              <div style={auraTileOldValue()}>-{baseRulePoints}</div>
                            ) : null}
                            <div style={auraTileValue()}>
                              -{auraRuleBreakerPoints}
                              {auraRuleBreakerPoints < baseRulePoints ? <span style={auraArrow("down")}>↓</span> : null}
                            </div>
                          </div>
                          <div style={auraTile("rgba(59,130,246,0.85)", auraSkillPulseMultiplier !== 1)}>
                            <div style={auraTileLabel()}>Skill Pulse</div>
                            <div style={auraTileValue()}>x{auraSkillPulseMultiplier}</div>
                          </div>
                          <div style={auraTile("rgba(250,204,21,0.85)", auraSpotlightMultiplier !== 1)}>
                            <div style={auraTileLabel()}>Spotlight</div>
                            <div style={auraTileValue()}>x{auraSpotlightMultiplier}</div>
                          </div>
                          <div style={auraTile("rgba(14,165,233,0.85)", auraDailyPoints > 0)}>
                            <div style={auraTileLabel()}>Daily Bonus</div>
                            <div style={auraTileValue()}>+{Math.max(0, auraDailyPoints)}</div>
                            {dailyBonusNextText ? <div style={auraTileNote()}>{dailyBonusNextText}</div> : null}
                            {auraDailyPoints > 0 && canRedeemDaily ? (
                              <button
                                onClick={redeemDailyBonus}
                                disabled={!dailyBonusNext.ready || dailyClaimBusy}
                                style={dailyBonusBtn(dailyBonusNext.ready && !dailyClaimBusy)}
                              >
                                {dailyBonusNext.ready ? (dailyClaimBusy ? "Claiming..." : "Redeem") : "Locked"}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.8 }}>Next Level Progress</div>
                    <div style={levelProgressBar()}>
                      <div style={levelProgressFill(progressValue)} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, opacity: 0.78 }}>
                      <span>
                        {nextLevelMin
                          ? `${nextLevelPointsLeft} pts left to Level ${effectiveLevel + 1}`
                          : "Max level reached"}
                      </span>
                      <span>{nextLevelMin ? `${lifetimePoints} / ${nextLevelMin}` : lifetimePoints}</span>
                    </div>
                  </div>
                  {isStaffView ? (
                    <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                      <button
                        onClick={() => {
                          openTabOverlayFor("Profile");
                          window.setTimeout(() => {
                            document.getElementById("student-notes-anchor")?.scrollIntoView({ behavior: "smooth" });
                          }, 120);
                        }}
                        style={noteQuickBtn()}
                      >
                        Add Coach Note
                      </button>
                    </div>
                  ) : null}

                  <div style={{ marginTop: 12 }}>
                    <div style={miniStatGrid()}>
                      <div style={miniStatCard("rgba(34,197,94,0.8)")}>
                        <div style={miniStatLabel()}>
                          <span aria-hidden>✅</span>
                          <span>Check-ins</span>
                        </div>
                        <div style={miniStatValue()}>{checkinCount}</div>
                      </div>
                      <div style={miniStatCard("rgba(59,130,246,0.8)")}>
                        <div style={miniStatLabel()}>
                          <span aria-hidden>🏅</span>
                          <span>Challenge Vault</span>
                        </div>
                        <div style={miniStatValue()}>{earnedChallenges.length}</div>
                      </div>
                      <div style={miniStatCard("rgba(250,204,21,0.85)")}>
                        <div style={miniStatLabel()}>
                          <span aria-hidden>🎖️</span>
                          <span>Badges</span>
                        </div>
                        <div style={miniStatValue()}>{badgeCountDisplay}</div>
                      </div>
                      <div style={miniStatCard("rgba(236,72,153,0.85)")}>
                        <div style={miniStatLabel()}>
                          <span aria-hidden>✨</span>
                          <span>Spotlight Stars</span>
                        </div>
                        <div style={miniStatValue()}>{spotlightCount}</div>
                      </div>
                      <div style={miniStatCard("rgba(250,204,21,0.85)")}>
                        <div style={miniStatLabel()}>
                          <span aria-hidden>🏆</span>
                          <span>Team MVPs</span>
                        </div>
                        <div style={miniStatValue()}>{mvpCount}</div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </CompetitionPrestigeFrame>

          {/* RIGHT */}
          <div style={panel()}>
            <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ display: "grid", gap: 12, flex: 1 }}>
                  <div style={tabGrid()}>
                    <div style={tabRow()}>
                      {topTabs.map((t) => (
                        <TabBtn key={t.key} on={tab === t.key} onClick={() => openTabOverlayFor(t.key as Tab)}>
                          {t.label}
                        </TabBtn>
                      ))}
                    </div>
                    <div style={tabRow()}>
                      {bottomTabs.map((t) => (
                        <TabBtn key={t.key} on={tab === t.key} onClick={() => openTabOverlayFor(t.key as Tab)}>
                          {t.label}
                        </TabBtn>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 12 }}>
                    <div style={prestigePanel()} onClick={() => setOpenPrestigeId(null)}>
                      <div style={{ fontWeight: 1000, opacity: 0.92 }}>Prestige Badges</div>
                      <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                        Prestige badges represent some of the most difficult achievements to earn.
                      </div>
                      <div
                        style={{
                          marginTop: 12,
                          display: "grid",
                        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                          gap: 12,
                          rowGap: 34,
                        }}
                      >
                        {prestigeDisplay.map((slot) => {
                          const progress = prestigeProgress[slot.id];
                          return (
                          <div key={slot.id} style={prestigeSlotWrap()}>
                            <button
                              type="button"
                              title={slot.description}
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenPrestigeId((prev) => (prev === slot.id ? null : slot.id));
                              }}
                              style={prestigeTile(slot.earned)}
                              aria-label={`${slot.name}: ${slot.description}`}
                            >
                              <div style={prestigeBadgeWrap()}>
                                {slot.icon_url ? (
                                  <img
                                    src={slot.icon_url}
                                    alt={slot.name}
                                    style={prestigeBadgeImg(slot.earned, slot.icon_zoom ?? 1)}
                                  />
                                ) : (
                                  <div style={prestigeBadgeFallback(slot.earned)}>{slot.name}</div>
                                )}
                                {slot.earned ? (
                                  <div style={prestigeBadgeSparkles()}>
                                    <Particles
                                      id={`prestige-sparkles-${slot.id}`}
                                      init={particlesInit}
                                      options={badgeSparkleOptions as any}
                                      style={{ position: "absolute", inset: 0 }}
                                    />
                                  </div>
                                ) : null}
                              </div>
                              <div style={prestigeName(slot.earned)}>{slot.name}</div>
                              {slot.earned ? <span style={prestigeSparkle()} aria-hidden="true" /> : null}
                            </button>
                            {!slot.earned && progress ? (
                              <div style={prestigeProgressWrap()}>
                                <div style={prestigeProgressBar()}>
                                  <span style={prestigeProgressFill(progress.progress)} />
                                </div>
                                <div style={prestigeProgressText()}>
                                  {progress.detail ?? `${progress.current}/${progress.target ?? 0}`}
                                </div>
                              </div>
                            ) : null}
                            {openPrestigeId === slot.id && (
                              <div style={prestigeBubble()} onClick={(e) => e.stopPropagation()}>
                                <div style={{ fontWeight: 900, marginBottom: 4 }}>{slot.name}</div>
                                <div style={{ opacity: 0.85, fontSize: 11 }}>{slot.description}</div>
                                {!slot.earned && (
                                  <div style={{ opacity: 0.7, fontSize: 10, marginTop: 6 }}>
                                    {progress?.detail ?? "Requirement to unlock"}
                                  </div>
                                )}
                                <div style={prestigeBubbleCaret()} />
                              </div>
                            )}
                          </div>
                        );
                        })}
                      </div>
                    </div>

                    <div style={medalSummaryCard()}>
                      <div style={{ fontWeight: 1000, opacity: 0.92 }}>Challenge Medals</div>
                      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                        {renderMedalRow("Bronze", "🥉", medalCounts.bronze, medalIcons.bronze)}
                        {renderMedalRow("Silver", "🥈", medalCounts.silver, medalIcons.silver)}
                        {renderMedalRow("Gold", "🥇", medalCounts.gold, medalIcons.gold)}
                        {renderMedalRow(
                          "Platinum",
                          "💎",
                          medalCounts.platinum,
                          medalIcons.platinum,
                          true,
                          particlesInit,
                          medalSparkleBackOptions,
                          medalSparkleFrontOptions
                        )}
                        {renderMedalRow(
                          "Diamond",
                          "🔷",
                          medalCounts.diamond,
                          medalIcons.diamond,
                          true,
                          particlesInit,
                          medalSparkleBackOptions,
                          medalSparkleFrontOptions
                        )}
                        {renderMedalRow(
                          "Master",
                          "👑",
                          medalCounts.master,
                          medalIcons.master,
                          true,
                          particlesInit,
                          medalSparkleBackOptions,
                          medalSparkleFrontOptions
                        )}
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>


          </div>
          </div>
        </div>
      </div>

      {/* AVATAR PICKER OVERLAY */}
      {openAvatarOverlay && (
        <Overlay title="Choose Avatar" onClose={() => setOpenAvatarOverlay(false)}>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center", padding: 12, borderRadius: 16, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", position: "relative" }}>
              {selectedCardPlateUrl ? <img src={selectedCardPlateUrl} alt="" style={cardPlateStyle(plateOffsets)} /> : null}
              <div style={{ width: 160, height: 160 }}>
                <AvatarRender
                  size={160}
                  bg="transparent"
                  style={{ ...avatarBox(avatarBoxBg, isComp), width: 160, height: 160 }}
                  border={selectedCornerBorder ?? undefined}
                  effect={selectedEffect ? { ...selectedEffect, key: activeEffectKey } : { key: activeEffectKey }}
                  avatarSrc={avatarImgSrc || null}
                  avatarZoomPct={avatarZoomPct}
                  cornerOffsets={cornerOffsets}
                  bleed={24}
                  contextKey="picker"
                  fallback={<EvolvingAvatar level={effectiveLevel} size={132} variant="dragon" />}
                />
                {avatarUnlockToast && avatarUnlockToast.id === selectedAvatarId ? (
                  <div style={unlockToast()}>
                    Unlocked -{avatarUnlockToast.points} pts
                  </div>
                ) : null}
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 1000, fontSize: 14 }}>Live Preview</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  Changes apply instantly for <b>{student.name}</b>.
                </div>
                <div style={{ fontWeight: 900 }}>{selectedAvatar?.name ?? "Default Avatar"}</div>
              </div>
            </div>
            <div style={{ opacity: 0.75, fontSize: 12 }}>
              Click an avatar to select it for <b>{student.name}</b>. Locked avatars show the unlock cost.
            </div>

            {(() => {
              const enabledAvatars = avatars.filter((a) => a.enabled);
              const byLevel = enabledAvatars.reduce((acc: Record<string, AvatarChoice[]>, a) => {
                const key = String(Number(a.unlock_level ?? 1));
                if (!acc[key]) acc[key] = [];
                acc[key].push(a);
                return acc;
              }, {});
              const levels = Object.keys(byLevel).sort((a, b) => Number(a) - Number(b));
              return (
                <div style={{ display: "grid", gap: 14 }}>
                  {levels.map((level) => (
                    <div key={`avatar-level-${level}`} style={levelGroupRow()}>
                      <div style={{ fontWeight: 1000, fontSize: 12 }}>Level {level}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
                        {byLevel[level].map((a) => {
                          const src = a.storage_path
                            ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${a.storage_path}`
                            : "";
                          const isSelected = a.id === selectedAvatarId;
                          const unlockLevel = Number(a.unlock_level ?? 1);
                          const unlockPoints = Number(a.unlock_points ?? 0);
                          const levelOk = currentLevel >= unlockLevel;
                          const needsPurchase = unlockPoints > 0 && !unlockSet.has(`avatar:${a.id}`);
                          const hasFunds = pointsBalance >= unlockPoints;
                          const isUnlocked = levelOk && !needsPurchase;

                          return (
                            <button
                              key={a.id}
                              onClick={async () => {
                                if (isUnlocked) {
                                  await setAvatar(a.id);
                                  return;
                                }
                                if (levelOk && needsPurchase && !hasFunds) {
                                  setMsg(`Need ${unlockPoints} points to unlock ${a.name}.`);
                                  return;
                                }
                                if (levelOk && needsPurchase) {
                                  const confirm = window.confirm(`Unlock ${a.name} for ${unlockPoints} points?`);
                                  if (!confirm) return;
                                  const ok = await purchaseUnlock("avatar", a.id);
                                  if (ok) {
                                    flashAvatarUnlock(a.id, unlockPoints);
                                    await setAvatar(a.id);
                                  }
                                }
                              }}
                              disabled={!levelOk}
                              style={{
                                borderRadius: 16,
                                border: isSelected ? "1px solid rgba(34,197,94,0.40)" : "1px solid rgba(255,255,255,0.12)",
                                background: isSelected ? "rgba(34,197,94,0.10)" : "rgba(255,255,255,0.06)",
                                padding: 12,
                                cursor: levelOk ? "pointer" : "not-allowed",
                                color: "white",
                                textAlign: "left",
                                opacity: levelOk ? (needsPurchase ? 0.55 : 1) : 0.4,
                              }}
                            >
                      <div
                        style={{
                          height: 110,
                          borderRadius: 14,
                          background: "rgba(0,0,0,0.50)",
                          border: "1px solid rgba(255,255,255,0.12)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "visible",
                          position: "relative",
                          filter: needsPurchase ? "grayscale(1)" : "none",
                        }}
                      >
                        {needsPurchase ? (
                          <div style={unlockPriceTag()}>
                            Unlock -{unlockPoints} pts
                          </div>
                        ) : null}
                        <AvatarRender
                          size={110}
                          bg="transparent"
                          style={{ width: 110, height: 110 }}
                          border={selectedCornerBorderUnlocked ? selectedCornerBorder ?? undefined : undefined}
                          effect={selectedEffect ? { ...selectedEffect, key: activeEffectKey } : { key: activeEffectKey }}
                          avatarSrc={src || null}
                          cornerOffsets={cornerOffsets}
                          bleed={20}
                          contextKey="picker"
                          fallback={<div style={{ opacity: 0.75, fontWeight: 900, fontSize: 12 }}>No image: {a.name}</div>}
                        />
                        {avatarUnlockToast && avatarUnlockToast.id === a.id ? (
                          <div style={unlockToast()}>
                            Unlocked -{avatarUnlockToast.points} pts
                          </div>
                        ) : null}
                              </div>

                              <div style={{ marginTop: 10, fontWeight: 1000 }}>{a.name}</div>
                              <div style={{ opacity: levelOk ? 0.7 : 0.55, fontSize: 12, marginTop: 4, display: "flex", gap: 6, alignItems: "center" }}>
                                {!isUnlocked ? <span style={{ filter: "grayscale(1)" }}>🔒</span> : null}
                                <span>Unlocks at level {unlockLevel}</span>
                              </div>
                              {unlockPoints > 0 ? (
                                <div style={{ opacity: 0.6, fontSize: 11, marginTop: 4 }}>
                                  Cost: {unlockPoints} points {needsPurchase ? "to unlock" : "· unlocked"}
                                </div>
                              ) : null}
                              <div style={{ opacity: 0.6, fontSize: 11, marginTop: 4 }}>
                                Used by {avatarUsage[a.id] ?? 0} students
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </Overlay>
      )}

      {openTabOverlay && (
        <Overlay title={`${tabLabel(tab)} Details`} onClose={() => setOpenTabOverlay(false)}>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={tabGrid()}>
              <div style={tabRow()}>
                {topTabs.map((t) => (
                  <TabBtn key={t.key} on={tab === t.key} onClick={() => setTab(t.key as Tab)}>
                    {t.label}
                  </TabBtn>
                ))}
              </div>
              <div style={tabRow()}>
                {bottomTabs.map((t) => (
                  <TabBtn key={t.key} on={tab === t.key} onClick={() => setTab(t.key as Tab)}>
                    {t.label}
                  </TabBtn>
                ))}
              </div>
            </div>
            {tab === "Challenges" ? (
              <div style={{ opacity: 0.8 }}>Challenge Vault entries will return here soon.</div>
            ) : (
              renderTabContent(tab)
            )}
          </div>
        </Overlay>
      )}

      {/* PALETTE OVERLAY */}
      {openPaletteOverlay && (
        <Overlay title="Dashboard Custom" onClose={() => setOpenPaletteOverlay(false)}>
            <div style={{ display: "grid", gap: 12 }}>
            <div style={customTabRow()}>
              {(["Preview", "Background", "Particles", "Corner Badge", "Nameplate"] as const).map((tabName) => (
                <button
                  key={tabName}
                  onClick={() => setCustomizeTab(tabName)}
                  style={customTabBtn(customizeTab === tabName)}
                >
                  {customizeTabLabels[tabName]}
                </button>
              ))}
            </div>

            {customizeTab === "Preview" ? (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={customPreviewCard()}>
                  {selectedCardPlateUrl ? <img src={selectedCardPlateUrl} alt="" style={cardPlateStyle(plateOffsets)} /> : null}
                  <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                    <AvatarRender
                      size={150}
                      bg="transparent"
                      style={{ ...avatarBox(avatarBoxBg, isComp), width: 150, height: 150 }}
                      border={selectedCornerBorder ?? undefined}
                      effect={selectedEffect ? { ...selectedEffect, key: activeEffectKey } : { key: activeEffectKey }}
                      avatarSrc={avatarImgSrc || null}
                      avatarZoomPct={avatarZoomPct}
                      cornerOffsets={cornerOffsets}
                      bleed={24}
                      contextKey="dashboard"
                      fallback={<EvolvingAvatar level={effectiveLevel} size={132} variant="dragon" />}
                    />
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontWeight: 1000, fontSize: 14 }}>Dashboard Card Preview</div>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>
                        See your background, BG particles, and border effect together.
                      </div>
                      <div style={{ fontWeight: 900 }}>{selectedAvatar?.name ?? "Default Avatar"}</div>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>
                        BG: {avatarSettings?.bg_color ?? "default"} · BG Particles: {selectedEffect?.name ?? "None"} · Border Effect: {selectedCornerBorder?.name ?? "None"} · Plate: {selectedCardPlate?.name ?? "None"}
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ display: "grid", gap: 8, fontSize: 12, opacity: 0.75 }}>
                  Pick a category above to edit just one effect at a time.
                </div>
              </div>
            ) : null}

            {customizeTab === "Background" ? (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  This changes ONLY the <b>avatar box background</b> (behind the PNG).
                </div>
                <div style={customPreviewCard()}>
                  {selectedCardPlateUrl ? <img src={selectedCardPlateUrl} alt="" style={cardPlateStyle(plateOffsets)} /> : null}
                  <AvatarRender
                    size={150}
                    bg="transparent"
                    style={{ ...avatarBox(avatarBoxBg, isComp), width: 150, height: 150 }}
                    border={selectedCornerBorder ?? undefined}
                    effect={selectedEffect ? { ...selectedEffect, key: activeEffectKey } : { key: activeEffectKey }}
                    avatarSrc={avatarImgSrc || null}
                    avatarZoomPct={avatarZoomPct}
                    cornerOffsets={cornerOffsets}
                    bleed={24}
                    contextKey="dashboard"
                    fallback={<EvolvingAvatar level={effectiveLevel} size={132} variant="dragon" />}
                  />
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontWeight: 900 }}>Live Preview</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>Current background: {avatarSettings?.bg_color ?? "default"}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {darkPalette().map((c) => (
                    <button
                      key={c}
                      onClick={() => setBgColor(c)}
                      style={paletteSwatch(c)}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {customizeTab === "Particles" ? (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ fontWeight: 900, fontSize: 12 }}>BG Particles</div>
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
                  <button
                    onClick={() => setAvatarEffect("none")}
                    style={effectTile(!avatarSettings?.particle_style || avatarSettings?.particle_style === "none")}
                  >
                    <div style={effectPreviewNone()} />
                    <div style={{ marginTop: 8, fontWeight: 900, fontSize: 12 }}>None</div>
                  </button>
                  {avatarEffects.length ? (
                    avatarEffects.filter((effect) => effect.enabled !== false).map((effect) => {
                      const unlockLevel = Number(effect.unlock_level ?? 1);
                      const unlockPoints = Number(effect.unlock_points ?? 0);
                      const levelOk = currentLevel >= unlockLevel;
                      const needsPurchase = unlockPoints > 0 && !unlockSet.has(`effect:${effect.key}`);
                      const isUnlocked = levelOk && !needsPurchase;
                      const isSelected = String(avatarSettings?.particle_style ?? "") === String(effect.key ?? "");
                      return (
                        <button
                          key={effect.id ?? effect.key}
                          onClick={async () => {
                            if (isUnlocked) {
                              await setAvatarEffect(effect.key);
                              return;
                            }
                            if (levelOk && needsPurchase && pointsBalance < unlockPoints) {
                              setMsg(`Need ${unlockPoints} points to unlock ${effect.name}.`);
                              return;
                            }
                            if (levelOk && needsPurchase) {
                              const confirm = window.confirm(`Unlock ${effect.name} for ${unlockPoints} points?`);
                              if (!confirm) return;
                              const ok = await purchaseUnlock("effect", effect.key);
                              if (ok) {
                                flashEffectUnlock(effect.key, unlockPoints);
                                await setAvatarEffect(effect.key);
                              }
                            }
                          }}
                          disabled={!levelOk}
                          style={effectTile(isSelected, levelOk)}
                        >
                          <div style={effect.render_mode === "code" ? { ...effectPreview(isUnlocked), overflow: "visible" } : effectPreview(isUnlocked)}>
                            {effect.render_mode === "code" ? (
                              <CodePreviewFrame
                                html={effect.html}
                                css={effect.css}
                                js={effect.js}
                                bleed={20}
                                style={{ zIndex: 0 }}
                              />
                            ) : (
                              <AvatarEffectParticles effectKey={effect.key} config={effect.config ?? undefined} />
                            )}
                            {avatarImgSrc ? (
                              <img
                                src={avatarImgSrc}
                                alt={selectedAvatar?.name ?? "Avatar"}
                                style={{
                                  width: "85%",
                                  height: "85%",
                                  objectFit: "contain",
                                  position: "relative",
                                  zIndex: 1,
                                  transform: `scale(${avatarZoomPct / 100})`,
                                  transformOrigin: "center",
                                }}
                              />
                            ) : null}
                            {effectUnlockToast && effectUnlockToast.key === effect.key ? (
                              <div style={unlockToast()}>
                                Unlocked -{effectUnlockToast.points} pts
                              </div>
                            ) : null}
                          </div>
                          <div style={{ marginTop: 8, fontWeight: 900, fontSize: 12 }}>{effect.name}</div>
                          <div style={{ fontSize: 11, opacity: 0.7 }}>
                            {!isUnlocked ? "🔒 " : ""}Unlocks at level {unlockLevel}
                          </div>
                          {isSelected && isUnlocked && unlockPoints > 0 ? (
                            <div style={{ fontSize: 11, fontWeight: 900, color: "rgba(34,197,94,0.9)" }}>
                              Unlocked
                            </div>
                          ) : null}
                          {unlockPoints > 0 ? (
                            <div style={{ fontSize: 11, opacity: 0.65 }}>
                              Cost: {unlockPoints} points {needsPurchase ? "to unlock" : "· unlocked"}
                            </div>
                          ) : null}
                        </button>
                      );
                    })
                  ) : (
                    <div style={{ fontSize: 12, opacity: 0.7 }}>No BG particles available yet.</div>
                  )}
                </div>
              </div>
            ) : null}

            {customizeTab === "Corner Badge" ? (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  Choose a border effect for your dashboard cards and display screens.
                </div>
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
                  <button
                    onClick={() => setCornerBorder("none")}
                    style={effectTile(!selectedCornerBorderKey)}
                  >
                    <div style={cornerPreviewNone()} />
                    <div style={{ marginTop: 8, fontWeight: 900, fontSize: 12 }}>None</div>
                  </button>
                  {cornerBorders.filter((border) => border.enabled !== false).map((border) => {
                    const unlockLevel = Number(border.unlock_level ?? 1);
                    const unlockPoints = Number(border.unlock_points ?? 0);
                    const levelOk = currentLevel >= unlockLevel;
                    const needsPurchase = unlockPoints > 0 && !unlockSet.has(`corner_border:${border.key}`);
                    const isUnlocked = levelOk && !needsPurchase;
                    const isSelected = selectedCornerBorderKey === border.key;
                    return (
                      <button
                        key={border.id ?? border.key}
                        onClick={async () => {
                          if (isUnlocked) {
                            await setCornerBorder(border.key);
                            return;
                          }
                          if (levelOk && needsPurchase && pointsBalance < unlockPoints) {
                            setMsg(`Need ${unlockPoints} points to unlock ${border.name}.`);
                            return;
                          }
                          if (levelOk && needsPurchase) {
                            const confirm = window.confirm(`Unlock ${border.name} for ${unlockPoints} points?`);
                            if (!confirm) return;
                            const ok = await purchaseUnlock("corner_border", border.key);
                            if (ok) {
                              flashCornerBorderUnlock(border.key, unlockPoints);
                              await setCornerBorder(border.key);
                            }
                          }
                        }}
                        disabled={!levelOk}
                        style={effectTile(isSelected, levelOk)}
                      >
                        <div style={border.render_mode === "code" ? { ...cornerPreviewTile(isUnlocked), overflow: "visible" } : cornerPreviewTile(isUnlocked)}>
                          {border.render_mode === "code" ? (
                            <CodePreviewFrame
                              html={border.html}
                              css={border.css}
                              js={border.js}
                              bleed={20}
                              style={{
                                zIndex: 0,
                                transform: `translate(${Number(border.offset_x ?? 0)}px, ${Number(border.offset_y ?? 0)}px)`,
                              }}
                            />
                          ) : border.image_url ? (
                            <>
                              <img src={border.image_url} alt={border.name} style={customCornerTopLeft()} />
                              <img src={border.image_url} alt="" style={customCornerBottomRight()} />
                            </>
                          ) : (
                            <div style={{ fontSize: 12, opacity: 0.7 }}>No image</div>
                          )}
                          {cornerBorderUnlockToast && cornerBorderUnlockToast.key === border.key ? (
                            <div style={unlockToast()}>
                              Unlocked -{cornerBorderUnlockToast.points} pts
                            </div>
                          ) : null}
                        </div>
                        <div style={{ marginTop: 8, fontWeight: 900, fontSize: 12 }}>{border.name}</div>
                        <div style={{ fontSize: 11, opacity: 0.7 }}>
                          {!isUnlocked ? "🔒 " : ""}Unlocks at level {unlockLevel}
                        </div>
                        {unlockPoints > 0 ? (
                          <div style={{ fontSize: 11, opacity: 0.65 }}>
                            Cost: {unlockPoints} points {needsPurchase ? "to unlock" : "· unlocked"}
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {customizeTab === "Nameplate" ? (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  Choose a nameplate border that sits across the dashboard card.
                </div>
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
                  <button
                    onClick={() => setCardPlate("none")}
                    style={effectTile(!selectedCardPlateKey)}
                  >
                    <div style={nameplatePreviewNone()} />
                    <div style={{ marginTop: 8, fontWeight: 900, fontSize: 12 }}>None</div>
                  </button>
                  {cardPlates.filter((plate) => plate.enabled !== false).map((plate) => {
                    const unlockLevel = Number(plate.unlock_level ?? 1);
                    const unlockPoints = Number(plate.unlock_points ?? 0);
                    const levelOk = currentLevel >= unlockLevel;
                    const needsPurchase = unlockPoints > 0 && !unlockSet.has(`card_plate:${plate.key}`);
                    const isUnlocked = levelOk && !needsPurchase;
                    const isSelected = selectedCardPlateKey === plate.key;
                    return (
                      <button
                        key={plate.id ?? plate.key}
                        onClick={async () => {
                          if (isUnlocked) {
                            await setCardPlate(plate.key);
                            return;
                          }
                          if (levelOk && needsPurchase && pointsBalance < unlockPoints) {
                            setMsg(`Need ${unlockPoints} points to unlock ${plate.name}.`);
                            return;
                          }
                          if (levelOk && needsPurchase) {
                            const confirm = window.confirm(`Unlock ${plate.name} for ${unlockPoints} points?`);
                            if (!confirm) return;
                            const ok = await purchaseUnlock("card_plate", plate.key);
                            if (ok) {
                              flashCardPlateUnlock(plate.key, unlockPoints);
                              await setCardPlate(plate.key);
                            }
                          }
                        }}
                        disabled={!levelOk}
                        style={effectTile(isSelected, levelOk)}
                      >
                        <div style={nameplatePreviewTile(isUnlocked)}>
                          {plate.image_url ? (
                            <img src={plate.image_url} alt={plate.name} style={nameplatePreviewLine()} />
                          ) : (
                            <div style={{ fontSize: 12, opacity: 0.7 }}>No image</div>
                          )}
                          {cardPlateUnlockToast && cardPlateUnlockToast.key === plate.key ? (
                            <div style={unlockToast()}>
                              Unlocked -{cardPlateUnlockToast.points} pts
                            </div>
                          ) : null}
                        </div>
                        <div style={{ marginTop: 8, fontWeight: 900, fontSize: 12 }}>{plate.name}</div>
                        <div style={{ fontSize: 11, opacity: 0.7 }}>
                          {!isUnlocked ? "🔒 " : ""}Unlocks at level {unlockLevel}
                        </div>
                        {unlockPoints > 0 ? (
                          <div style={{ fontSize: 11, opacity: 0.65 }}>
                            Cost: {unlockPoints} points {needsPurchase ? "to unlock" : "· unlocked"}
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setOpenPaletteOverlay(false)} style={btnGhost()}>
                Done
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {/* SKILL TREE OVERLAY */}
      {openSkillsOverlay && (
        <Overlay title="Skill Tree" onClose={() => setOpenSkillsOverlay(false)} maxWidth={1800}>
          <div
            style={{
              height: "82vh",
              borderRadius: 18,
              overflowX: "auto",
              overflowY: "hidden",
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(0,0,0,0.2)",
              display: "flex",
              justifyContent: "flex-start",
            }}
          >
            <div style={{ minWidth: 1200, width: "100%", height: "100%" }}>
              <iframe
                src="/skills?embed=1"
                title="Skill Tree"
                style={{ width: "100%", minWidth: 1200, height: "100%", border: "none", display: "block" }}
              />
            </div>
          </div>
        </Overlay>
      )}

      {openSkillHistoryOverlay && (
        <Overlay title="Skill Pulse History" onClose={() => setOpenSkillHistoryOverlay(false)}>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 1000 }}>Trend by Skill</div>
              <select
                value={historySkillId}
                onChange={(e) => setHistorySkillId(e.target.value)}
                style={select()}
              >
                <option value="all">All skills</option>
                {Array.from(new Map(skillHistory.map((h) => [h.skill_name, h])).values()).map((h) => (
                  <option key={h.skill_name} value={h.skill_name}>
                    {h.skill_name}
                  </option>
                ))}
              </select>
            </div>

            <TrendGraph
              logs={skillHistory}
              filterSkill={historySkillId === "all" ? null : historySkillId}
            />
            <div style={{ display: "grid", gap: 8 }}>
              {skillHistory.map((h) => (
                <div key={h.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                  <div style={{ fontWeight: 900 }}>
                    {h.skill_name} • {h.rate}% ({h.successes}/{h.attempts || 0})
                    {h.is_battle && h.vs_name ? ` • VS ${h.vs_name}` : ""}
                  </div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>{new Date(h.created_at).toLocaleString()}</div>
                </div>
              ))}
              {!skillHistory.length && <div style={{ opacity: 0.7 }}>No Skill Pulse history yet.</div>}
            </div>
          </div>
        </Overlay>
      )}

      {dailyClaimOpen && dailyClaimPayload ? (
        <div
          className="daily-claim-overlay"
          onClick={() => {
            setDailyClaimOpen(false);
            setDailyClaimPayload(null);
          }}
        >
          <div className="daily-claim-card" onClick={(event) => event.stopPropagation()}>
            <div className="daily-claim-burst" />
            <div className="daily-claim-title">Aura Boost Redeemed</div>
            <div className="daily-claim-points">+{dailyClaimPayload.points} pts</div>
            <div className="daily-claim-sub">from {dailyClaimPayload.avatarName}</div>
            <div className="daily-claim-meta">Daily Aura Bonus</div>
            <div className="daily-claim-sparks">
              <span className="spark s1" />
              <span className="spark s2" />
              <span className="spark s3" />
              <span className="spark s4" />
              <span className="spark s5" />
            </div>
          </div>
        </div>
      ) : null}

      <style>{`
        @keyframes auraPulse {
          0% { box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 0 10px rgba(34,197,94,0.15), 0 14px 40px rgba(0,0,0,0.30); }
          50% { box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 0 26px rgba(34,197,94,0.45), 0 18px 50px rgba(0,0,0,0.35); }
          100% { box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 0 10px rgba(34,197,94,0.15), 0 14px 40px rgba(0,0,0,0.30); }
        }

        @keyframes dailyClaimPop {
          0% { transform: scale(0.85); opacity: 0; }
          60% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }

        @keyframes dailyClaimGlow {
          0% { opacity: 0; transform: scale(0.9); }
          50% { opacity: 0.9; transform: scale(1); }
          100% { opacity: 0.2; transform: scale(1.08); }
        }

        @keyframes dailyClaimSpark {
          0% { transform: translateY(0) scale(0.6); opacity: 0; }
          40% { opacity: 1; }
          100% { transform: translateY(-24px) scale(1); opacity: 0; }
        }

        @keyframes dailyClaimFade {
          0% { opacity: 0; }
          10% { opacity: 1; }
          85% { opacity: 1; }
          100% { opacity: 0; }
        }

        .daily-claim-overlay {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(3, 7, 18, 0.58);
          z-index: 9999;
          animation: dailyClaimFade 2.4s ease-out both;
        }

        .daily-claim-card {
          position: relative;
          width: min(360px, 90vw);
          padding: 22px 26px;
          border-radius: 24px;
          background: radial-gradient(140px 140px at 50% 0%, rgba(56, 189, 248, 0.65), transparent 70%),
            linear-gradient(140deg, rgba(14, 165, 233, 0.85), rgba(15, 23, 42, 0.92));
          border: 1px solid rgba(148, 163, 184, 0.35);
          color: #f8fafc;
          text-align: center;
          box-shadow: 0 20px 45px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.12);
          animation: dailyClaimPop 1.2s ease-out both;
          overflow: hidden;
        }

        .daily-claim-burst {
          position: absolute;
          inset: -20px;
          border-radius: 28px;
          background: radial-gradient(circle, rgba(251, 191, 36, 0.5), transparent 70%);
          animation: dailyClaimGlow 1.2s ease-out both;
          pointer-events: none;
        }

        .daily-claim-title {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          opacity: 0.8;
        }

        .daily-claim-points {
          margin-top: 8px;
          font-size: 34px;
          font-weight: 1100;
          text-shadow: 0 0 18px rgba(14, 165, 233, 0.65);
        }

        .daily-claim-sub {
          margin-top: 6px;
          font-size: 13px;
          opacity: 0.85;
        }

        .daily-claim-meta {
          margin-top: 8px;
          font-size: 10px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          opacity: 0.7;
        }

        .daily-claim-sparks .spark {
          position: absolute;
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.95), rgba(56, 189, 248, 0.6));
          animation: dailyClaimSpark 1.4s ease-out infinite;
          pointer-events: none;
        }

        .daily-claim-sparks .s1 { top: 22px; left: 32px; animation-delay: 0s; }
        .daily-claim-sparks .s2 { top: 24px; right: 40px; animation-delay: 0.2s; }
        .daily-claim-sparks .s3 { bottom: 26px; left: 54px; animation-delay: 0.4s; }
        .daily-claim-sparks .s4 { bottom: 30px; right: 58px; animation-delay: 0.6s; }
        .daily-claim-sparks .s5 { top: 52px; left: 50%; transform: translateX(-50%); animation-delay: 0.8s; }
      `}</style>

    </div>
  );
}

function avatarBox(bg: string, isComp: boolean): React.CSSProperties {
  return {
    width: "100%",
    height: "100%",
    borderRadius: 22,
    position: "relative",
    overflow: "visible",
    background: isComp
      ? `radial-gradient(140px 140px at 45% 40%, rgba(255,255,255,0.14), rgba(0,0,0,0.62) 60%), ${bg}`
      : bg,
    border: isComp ? "1px solid rgba(59,130,246,0.35)" : "1px solid rgba(255,255,255,0.14)",
    boxShadow: isComp
      ? "inset 0 -20px 40px rgba(0,0,0,0.55), inset 0 18px 30px rgba(255,255,255,0.08), 0 0 24px rgba(59,130,246,0.28)"
      : "inset 0 1px 0 rgba(255,255,255,0.06)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

function compCrestBox(): React.CSSProperties {
  return {
    width: 90,
    height: 64,
    borderRadius: 16,
    display: "grid",
    placeItems: "center",
    background:
      "linear-gradient(160deg, rgba(255,255,255,0.18), rgba(15,23,42,0.9)), radial-gradient(circle at top, rgba(59,130,246,0.35), transparent 60%)",
    border: "1px solid rgba(148,163,184,0.4)",
    boxShadow:
      "inset 0 -10px 20px rgba(0,0,0,0.45), inset 0 8px 18px rgba(255,255,255,0.08), 0 16px 32px rgba(0,0,0,0.35)",
  };
}

type PrestigeSlot = {
  id: string;
  name: string;
  description: string;
  shape: "circle" | "diamond" | "rhombus" | "hex" | "star";
  earned: boolean;
  icon_url?: string | null;
  icon_zoom?: number | null;
};

function resolvePrestigeBadges(
  catalog: BadgeCatalog[],
  progress: Record<string, { progress: number; current: number; target: number; detail?: string }>
): PrestigeSlot[] {
  const shapes: PrestigeSlot["shape"][] = [
    "hex",
    "diamond",
    "circle",
    "star",
    "rhombus",
    "hex",
    "diamond",
    "circle",
    "star",
    "rhombus",
  ];

  const prestige = catalog.filter((b) => (b.category ?? "").toLowerCase() === "prestige");
  return prestige.map((b: any, i) => {
    const prog = progress?.[String(b.id ?? "")];
    const hasProgress = prog && Number.isFinite(prog.current) && Number.isFinite(prog.target) && prog.target > 0;
    const earnedByProgress = hasProgress ? prog.current >= prog.target : false;
    return {
    ...b,
    shape: shapes[i % shapes.length],
    earned: earnedByProgress,
    icon_url: resolveBadgeIconUrl(b),
    icon_zoom: Number(b.icon_zoom ?? 1) || 1,
    };
  });
}

function resolveBadgeIconUrl(badge: BadgeCatalog): string | null {
  const direct = String(badge?.icon_url ?? "").trim();
  if (direct) return direct;
  const path = String(badge?.icon_path ?? "").trim();
  if (!path) return null;
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) return null;
  const clean = path.replace(/^\/+/, "");
  const fullPath = clean.startsWith("badges/") ? clean : `badges/${clean}`;
  return `${baseUrl}/storage/v1/object/public/${fullPath}`;
}

function prestigeTile(earned: boolean): React.CSSProperties {
  return {
    appearance: "none",
    cursor: "pointer",
    height: 150,
    width: "100%",
    borderRadius: 16,
    display: "grid",
    placeItems: "center",
    textAlign: "center",
    fontWeight: 1100,
    color: "white",
    position: "relative",
    overflow: "hidden",
    background: earned
      ? "linear-gradient(145deg, rgba(245,158,11,0.2), rgba(59,130,246,0.16), rgba(15,23,42,0.9))"
      : "linear-gradient(145deg, rgba(15,23,42,0.55), rgba(2,6,23,0.65))",
    border: earned ? "1px solid rgba(245,158,11,0.45)" : "1px solid rgba(255,255,255,0.12)",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -8px 16px rgba(0,0,0,0.35), 0 12px 30px rgba(0,0,0,0.35)",
    padding: 12,
  };
}

function prestigeBadgeWrap(): React.CSSProperties {
  return {
    width: 88,
    height: 88,
    borderRadius: 12,
    display: "grid",
    placeItems: "center",
    background: "rgba(0,0,0,0.25)",
    border: "1px solid rgba(255,255,255,0.12)",
    position: "relative",
    overflow: "hidden",
  };
}

function prestigeBadgeSparkles(): React.CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    zIndex: 4,
    pointerEvents: "none",
  };
}

function prestigeBadgeImg(earned: boolean, zoom = 1): React.CSSProperties {
  return {
    width: 68,
    height: 68,
    objectFit: "contain",
    opacity: earned ? 1 : 0.45,
    filter: earned ? "drop-shadow(0 4px 8px rgba(0,0,0,0.45))" : "grayscale(1)",
    transform: `scale(${zoom})`,
    transformOrigin: "center",
  };
}

function prestigeBadgeFallback(earned: boolean): React.CSSProperties {
  return {
    fontWeight: 900,
    fontSize: 11,
    opacity: earned ? 1 : 0.45,
    padding: "0 4px",
  };
}

function prestigeName(earned: boolean): React.CSSProperties {
  return {
    marginTop: 6,
    fontSize: 11,
    fontWeight: 900,
    opacity: earned ? 0.9 : 0.45,
    minHeight: 28,
    lineHeight: "14px",
    display: "grid",
    placeItems: "center",
    textAlign: "center",
  };
}

function prestigeSparkle(): React.CSSProperties {
  return {
    position: "absolute",
    top: -8,
    right: -10,
    width: 28,
    height: 28,
    borderRadius: 999,
    background: "radial-gradient(circle at 40% 40%, rgba(255,255,255,0.95), rgba(250,204,21,0.35), rgba(250,204,21,0.02))",
    boxShadow: "0 0 18px rgba(250,204,21,0.45)",
    animation: "badgeSparkle 2.4s ease-in-out infinite",
    pointerEvents: "none",
  };
}

function prestigeSlotWrap(): React.CSSProperties {
  return {
    position: "relative",
    display: "grid",
    placeItems: "center",
    minHeight: 160,
  };
}

function prestigeProgressWrap(): React.CSSProperties {
  return {
    position: "absolute",
    bottom: -30,
    left: 0,
    right: 0,
    display: "grid",
    gap: 6,
    alignItems: "center",
    justifyItems: "center",
    padding: "0 6px",
  };
}

function prestigeProgressBar(): React.CSSProperties {
  return {
    width: "100%",
    height: 6,
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  };
}

function prestigeProgressFill(progress: number): React.CSSProperties {
  const pct = Math.max(2, Math.min(100, Math.round(progress * 100)));
  return {
    display: "block",
    height: "100%",
    width: `${pct}%`,
    borderRadius: 999,
    background: "linear-gradient(90deg, rgba(59,130,246,0.9), rgba(34,197,94,0.9))",
    boxShadow: "0 0 10px rgba(34,197,94,0.35)",
  };
}

function prestigeProgressText(): React.CSSProperties {
  return {
    fontSize: 10,
    fontWeight: 900,
    opacity: 0.7,
    textAlign: "center",
  };
}

function prestigeBubble(): React.CSSProperties {
  return {
    position: "absolute",
    bottom: "calc(100% + 10px)",
    left: "50%",
    transform: "translateX(-50%)",
    width: 180,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(10,12,18,0.96)",
    boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
    zIndex: 5,
    textAlign: "left",
  };
}

function prestigeBubbleCaret(): React.CSSProperties {
  return {
    position: "absolute",
    left: "50%",
    bottom: -6,
    width: 12,
    height: 12,
    transform: "translateX(-50%) rotate(45deg)",
    background: "rgba(10,12,18,0.96)",
    borderRight: "1px solid rgba(255,255,255,0.18)",
    borderBottom: "1px solid rgba(255,255,255,0.18)",
  };
}

function prestigePanel(): React.CSSProperties {
  return {
    borderRadius: 20,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background:
      "linear-gradient(145deg, rgba(15,23,42,0.92), rgba(2,6,23,0.92)), repeating-linear-gradient(45deg, rgba(255,255,255,0.03), rgba(255,255,255,0.03) 4px, transparent 4px, transparent 8px)",
    boxShadow:
      "inset 0 2px 10px rgba(0,0,0,0.55), inset 0 -6px 16px rgba(255,255,255,0.05), 0 20px 50px rgba(0,0,0,0.45)",
  };
}

function taoluHistoryCard(): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: "10px 12px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "white",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    textAlign: "left",
    cursor: "pointer",
  };
}

function taoluHistoryMeta(): React.CSSProperties {
  return {
    display: "flex",
    gap: 6,
    fontSize: 11,
    opacity: 0.75,
    alignItems: "center",
    flexWrap: "wrap",
  };
}

function taoluHistoryAction(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(59,130,246,0.18)",
    fontSize: 11,
    fontWeight: 900,
  };
}

function taoluTotalsCard(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    display: "grid",
    gap: 8,
  };
}

function taoluCodeRow(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr) auto",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
  };
}

function taoluCodeBadge(): React.CSSProperties {
  return {
    minWidth: 44,
    textAlign: "center",
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.08)",
    fontWeight: 900,
    fontSize: 11,
  };
}

function taoluCodeLabel(): React.CSSProperties {
  return {
    fontWeight: 900,
    opacity: 0.85,
  };
}

function taoluCodeCount(): React.CSSProperties {
  return {
    padding: "4px 8px",
    borderRadius: 10,
    border: "1px solid rgba(34,197,94,0.35)",
    background: "rgba(34,197,94,0.18)",
    fontWeight: 900,
    fontSize: 11,
  };
}

function taoluDeductionRow(): React.CSSProperties {
  return {
    display: "grid",
    gap: 6,
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
  };
}

function Overlay({
  title,
  onClose,
  children,
  maxWidth,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.72)",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "flex-end",
        paddingTop: 152,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: maxWidth ? `min(${maxWidth}px, 90vw)` : "min(760px, 50vw)",
          height: "calc(100% - 152px)",
          borderRadius: "18px 0 0 18px",
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(5,7,11,0.96)",
          backdropFilter: "blur(10px)",
          boxShadow: "0 22px 90px rgba(0,0,0,0.60)",
          padding: 16,
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 1100 }}>{title}</div>
          <button onClick={onClose} style={btnGhost()}>
            Close
          </button>
        </div>
        <div style={{ marginTop: 12 }}>{children}</div>
      </div>
    </div>
  );
}

function CenterOverlay({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(560px, 92vw)",
          maxHeight: "80vh",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(5,7,11,0.96)",
          boxShadow: "0 22px 90px rgba(0,0,0,0.60)",
          padding: 16,
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 1100 }}>{title}</div>
          <button onClick={onClose} style={btnGhost()}>
            Close
          </button>
        </div>
        <div style={{ marginTop: 12 }}>{children}</div>
      </div>
    </div>
  );
}

function tierIcon(t: Tier) {
  if (t === "platinum") return "⬒";
  if (t === "diamond") return "◆";
  if (t === "master") return "✦";
  return "★";
}
function tierGradient(t: Tier) {
  if (t === "bronze") return "linear-gradient(90deg, rgba(180,83,9,0.45), rgba(180,83,9,0.15))";
  if (t === "silver") return "linear-gradient(90deg, rgba(148,163,184,0.40), rgba(148,163,184,0.12))";
  if (t === "gold") return "linear-gradient(90deg, rgba(250,204,21,0.40), rgba(250,204,21,0.12))";
  if (t === "platinum") return "linear-gradient(90deg, rgba(203,213,225,0.35), rgba(203,213,225,0.12))";
  if (t === "diamond") return "linear-gradient(90deg, rgba(59,130,246,0.38), rgba(59,130,246,0.12))";
  return "linear-gradient(90deg, rgba(59,130,246,0.45), rgba(147,197,253,0.10))";
}

function outerWrap(isComp: boolean, flash: null | "add" | "remove"): React.CSSProperties {
  const flashGlow =
    flash === "add"
      ? "0 0 0 2px rgba(34,197,94,0.55), 0 0 50px rgba(34,197,94,0.25)"
      : flash === "remove"
      ? "0 0 0 2px rgba(239,68,68,0.55), 0 0 50px rgba(239,68,68,0.22)"
      : "";

  return {
    borderRadius: 26,
    padding: 14,
    border: isComp ? "1px solid rgba(59,130,246,0.28)" : "1px solid rgba(255,255,255,0.12)",
    background: isComp ? "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(147,197,253,0.06), rgba(0,0,0,0.30))" : "rgba(255,255,255,0.04)",
    boxShadow: `${isComp ? "0 18px 80px rgba(59,130,246,0.10)" : "0 18px 80px rgba(0,0,0,0.35)"}${flashGlow ? `, ${flashGlow}` : ""}`,
    transition: "box-shadow 160ms ease",
    marginLeft: -24,
    marginRight: -330,
  };
}

function profilePanel(isComp: boolean): React.CSSProperties {
  return {
    borderRadius: 22,
    padding: 14,
    background: isComp ? "linear-gradient(135deg, rgba(59,130,246,0.16), rgba(147,197,253,0.10)), rgba(255,255,255,0.06)" : "rgba(255,255,255,0.06)",
    border: isComp ? "1px solid rgba(59,130,246,0.26)" : "1px solid rgba(255,255,255,0.12)",
    boxShadow: isComp ? "0 18px 70px rgba(59,130,246,0.12)" : "0 14px 50px rgba(0,0,0,0.25)",
    position: "relative",
    overflow: "visible",
  };
}

function cornerBadgeTopLeft(offset: CornerOffsets): React.CSSProperties {
  return {
    position: "absolute",
    top: offset.y,
    left: offset.x,
    width: offset.size,
    height: offset.size,
    objectFit: "contain",
    pointerEvents: "none",
    zIndex: 3,
  };
}

function cornerBadgeBottomRight(offset: CornerOffsets): React.CSSProperties {
  return {
    position: "absolute",
    bottom: offset.y,
    right: offset.x,
    width: offset.size,
    height: offset.size,
    objectFit: "contain",
    transform: "rotate(180deg)",
    pointerEvents: "none",
    zIndex: 3,
  };
}

function avatarFrameBtn(isComp: boolean): React.CSSProperties {
  return {
    width: 190,
    height: 190,
    borderRadius: 28,
    border: isComp ? "1px solid rgba(59,130,246,0.45)" : "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.18)",
    cursor: "pointer",
    padding: 8,
    position: "relative",
    boxShadow: isComp ? "0 0 30px rgba(59,130,246,0.35), 0 22px 70px rgba(0,0,0,0.45)" : "0 22px 70px rgba(0,0,0,0.45)",
  };
}

function avatarUnlockBadge(): React.CSSProperties {
  return {
    position: "absolute",
    top: 6,
    right: 6,
    width: 14,
    height: 14,
    borderRadius: 999,
    background: "rgba(34,197,94,0.95)",
    boxShadow: "0 0 12px rgba(34,197,94,0.7)",
  };
}

function unlockPriceTag(): React.CSSProperties {
  return {
    position: "absolute",
    top: 8,
    right: 8,
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 900,
    background: "rgba(15,23,42,0.85)",
    border: "1px solid rgba(250,204,21,0.7)",
    color: "rgba(250,204,21,0.95)",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    zIndex: 2,
  };
}

function unlockToast(): React.CSSProperties {
  return {
    position: "absolute",
    inset: 8,
    borderRadius: 12,
    display: "grid",
    placeItems: "center",
    fontWeight: 1000,
    fontSize: 13,
    background: "linear-gradient(140deg, rgba(250,204,21,0.92), rgba(34,197,94,0.85))",
    color: "#111827",
    textAlign: "center",
    zIndex: 3,
    boxShadow: "0 10px 28px rgba(0,0,0,0.35)",
  };
}

function levelGroupRow(): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    display: "grid",
    gap: 10,
  };
}

function levelBig(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: "10px 12px",
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.20)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 14px 40px rgba(0,0,0,0.30)",
    minWidth: 120,
    textAlign: "center",
    display: "grid",
    justifyItems: "center",
  };
}

function statBig(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: "10px 12px",
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.20)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 14px 40px rgba(0,0,0,0.30)",
    minWidth: 160,
  };
}

function auraStatBig(active: boolean): React.CSSProperties {
  return {
    ...statBig(),
    border: active ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(255,255,255,0.14)",
    boxShadow: active
      ? "inset 0 1px 0 rgba(255,255,255,0.08), 0 0 30px rgba(34,197,94,0.35), 0 14px 40px rgba(0,0,0,0.30)"
      : "inset 0 1px 0 rgba(255,255,255,0.08), 0 14px 40px rgba(0,0,0,0.30)",
    animation: active ? "auraPulse 2.4s ease-in-out infinite" : "none",
  };
}

function levelProgressBar(): React.CSSProperties {
  return {
    height: 10,
    borderRadius: 999,
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.14)",
    overflow: "hidden",
  };
}

function levelProgressFill(progress: number): React.CSSProperties {
  return {
    height: "100%",
    width: `${Math.round(progress * 100)}%`,
    background: "linear-gradient(90deg, rgba(59,130,246,0.85), rgba(34,197,94,0.7))",
    boxShadow: "0 0 12px rgba(59,130,246,0.45)",
    transition: "width 0.3s ease",
  };
}

function panel(): React.CSSProperties {
  return {
    borderRadius: 22,
    padding: 14,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 14px 50px rgba(0,0,0,0.25)",
    marginRight: 40,
  };
}
function card(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: 12,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
  };
}

function metricRemoveBtn(): React.CSSProperties {
  return {
    borderRadius: 999,
    border: "1px solid rgba(239,68,68,0.45)",
    background: "rgba(239,68,68,0.14)",
    color: "white",
    fontWeight: 900,
    fontSize: 11,
    padding: "4px 10px",
    cursor: "pointer",
  };
}

function noteFormWrap(): React.CSSProperties {
  return {
    display: "grid",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(15,23,42,0.55)",
  };
}

function noteCard(done = false): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    display: "grid",
    gap: 6,
    opacity: done ? 0.6 : 1,
  };
}

function noteChip(kind: "note" | "todo"): React.CSSProperties {
  return {
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 0.6,
    background: kind === "todo" ? "rgba(59,130,246,0.2)" : "rgba(148,163,184,0.2)",
    border: `1px solid ${kind === "todo" ? "rgba(59,130,246,0.5)" : "rgba(148,163,184,0.4)"}`,
  };
}

function noteUrgency(level: "low" | "medium" | "high" | "critical" | string): React.CSSProperties {
  const map: Record<string, string> = {
    low: "rgba(16,185,129,0.18)",
    medium: "rgba(250,204,21,0.18)",
    high: "rgba(249,115,22,0.2)",
    critical: "rgba(239,68,68,0.2)",
  };
  const border: Record<string, string> = {
    low: "rgba(16,185,129,0.55)",
    medium: "rgba(250,204,21,0.55)",
    high: "rgba(249,115,22,0.55)",
    critical: "rgba(239,68,68,0.55)",
  };
  return {
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 0.4,
    background: map[level],
    border: `1px solid ${border[level]}`,
  };
}

function noteQuickBtn(): React.CSSProperties {
  return {
    borderRadius: 12,
    border: "1px solid rgba(59,130,246,0.5)",
    background: "rgba(59,130,246,0.18)",
    color: "white",
    padding: "8px 12px",
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
    boxShadow: "0 10px 22px rgba(0,0,0,0.25)",
  };
}

function noteDoneBtn(): React.CSSProperties {
  return {
    marginLeft: "auto",
    borderRadius: 999,
    border: "1px solid rgba(34,197,94,0.6)",
    background: "rgba(34,197,94,0.2)",
    color: "white",
    padding: "4px 10px",
    fontSize: 10,
    fontWeight: 900,
    cursor: "pointer",
  };
}

function noteDoneBadge(): React.CSSProperties {
  return {
    marginLeft: "auto",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.5)",
    background: "rgba(148,163,184,0.2)",
    color: "white",
    padding: "4px 10px",
    fontSize: 10,
    fontWeight: 900,
  };
}

function noteHiddenBadge(): React.CSSProperties {
  return {
    marginLeft: "auto",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.5)",
    background: "rgba(148,163,184,0.2)",
    color: "white",
    padding: "4px 10px",
    fontSize: 10,
    fontWeight: 900,
  };
}

function noteRemoveBtn(): React.CSSProperties {
  return {
    borderRadius: 999,
    border: "1px solid rgba(248,113,113,0.6)",
    background: "rgba(248,113,113,0.18)",
    color: "white",
    padding: "4px 10px",
    fontSize: 10,
    fontWeight: 900,
    cursor: "pointer",
  };
}

function medalCard(): React.CSSProperties {
  return {
    borderRadius: 20,
    padding: 14,
    background:
      "linear-gradient(155deg, rgba(59,130,246,0.18), rgba(15,23,42,0.92)), radial-gradient(80% 80% at 100% 0%, rgba(34,197,94,0.18), transparent 60%)",
    border: "1px solid rgba(148,163,184,0.22)",
    boxShadow: "0 18px 45px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)",
  };
}

function medalSummaryCard(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: 12,
    background: "rgba(10,15,25,0.65)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
    minHeight: 320,
    marginRight: 0,
  };
}

function renderMedalRow(
  label: string,
  icon: string,
  count: number,
  iconUrl?: string | null,
  showSparkles = false,
  particlesInit?: (engine: Engine) => Promise<void>,
  sparkleBackOptions?: any,
  sparkleFrontOptions?: any
) {
  return (
    <div style={medalRowWrap()}>
      <div style={{ display: "grid", gap: 6, justifyItems: "center" }}>
        <div style={medalIconWrap()}>
          {showSparkles && particlesInit && sparkleBackOptions ? (
            <div style={medalSparkles()}>
              <Particles
                id={`medal-sparkles-back-${label}`}
                init={particlesInit}
                options={sparkleBackOptions}
                style={{ position: "absolute", inset: 0 }}
              />
            </div>
          ) : null}
          {iconUrl ? (
            <img src={iconUrl} alt={label} style={medalIconImg()} />
          ) : (
            <span aria-hidden style={{ fontSize: 20 }}>{icon}</span>
          )}
          {showSparkles && particlesInit && sparkleFrontOptions ? (
            <div style={medalSparklesFront()}>
              <Particles
                id={`medal-sparkles-front-${label}`}
                init={particlesInit}
                options={sparkleFrontOptions}
                style={{ position: "absolute", inset: 0 }}
              />
            </div>
          ) : null}
        </div>
        <span style={{ fontWeight: 900, fontSize: 12, textAlign: "center" }}>{label}</span>
      </div>
      <span style={{ fontWeight: 1100, fontSize: 22 }}>{count}</span>
    </div>
  );
}

function recentBadgesBar(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: "10px 10px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
    position: "relative",
    overflow: "hidden",
  };
}

function recentBadgesLabel(): React.CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.02em",
    textTransform: "uppercase",
    opacity: 0.7,
    position: "relative",
    zIndex: 2,
  };
}

function recentBadgesSparkles(): React.CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    zIndex: 1,
    pointerEvents: "none",
  };
}

function recentBadgesEmpty(): React.CSSProperties {
  return {
    fontSize: 11,
    opacity: 0.6,
    position: "relative",
    zIndex: 2,
  };
}

function leftDockHandle(): React.CSSProperties {
  return {
    position: "fixed",
    left: 12,
    top: 220,
    zIndex: 410,
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(15,23,42,0.85)",
    color: "white",
    fontWeight: 900,
    letterSpacing: "0.02em",
    cursor: "pointer",
  };
}

function parentStudentSelect(): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(8,10,15,0.8)",
    color: "white",
    fontSize: 13,
    fontWeight: 800,
  };
}

function tabGrid(): React.CSSProperties {
  return {
    display: "grid",
    gap: 8,
  };
}

function tabRow(): React.CSSProperties {
  return {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  };
}

function medalIconWrap(): React.CSSProperties {
  return {
    width: 52,
    height: 52,
    borderRadius: 12,
    border: "1px solid transparent",
    background: "transparent",
    display: "grid",
    placeItems: "center",
    position: "relative",
    overflow: "visible",
  };
}

function medalIconImg(): React.CSSProperties {
  return {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    position: "relative",
    zIndex: 1,
  };
}

function medalSparkles(): React.CSSProperties {
  return {
    position: "absolute",
    inset: -6,
    zIndex: 2,
    pointerEvents: "none",
  };
}

function medalSparklesFront(): React.CSSProperties {
  return {
    position: "absolute",
    inset: -4,
    zIndex: 3,
    pointerEvents: "none",
  };
}

function medalRowWrap(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "64px auto",
    alignItems: "center",
    gap: 8,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "linear-gradient(145deg, rgba(15,23,42,0.7), rgba(2,6,23,0.85))",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 24px rgba(0,0,0,0.35)",
    justifyContent: "space-between",
  };
}

function recentBadgeSlot(): React.CSSProperties {
  return {
    width: 44,
    height: 44,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.3)",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    position: "relative",
    zIndex: 2,
  };
}

function recentBadgeImg(): React.CSSProperties {
  return {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  };
}

function recentBadgeFallback(): React.CSSProperties {
  return {
    fontWeight: 900,
    fontSize: 12,
    opacity: 0.75,
    position: "relative",
    zIndex: 2,
  };
}

function activityChipLabel(kind: ActivityItem["kind"] | null) {
  switch (kind) {
    case "points_up":
      return "Points +";
    case "points_down":
      return "Points -";
    case "checkin":
      return "Check-in";
    case "skill":
      return "Skill Pulse";
    case "badge":
      return "Badge";
    case "camp":
      return "Camp";
    case "coupon":
      return "Coupon";
    case "spotlight":
      return "Spotlight";
    case "other":
      return "Other";
    default:
      return "Activity";
  }
}

function activityChip(kind: ActivityItem["kind"] | null): React.CSSProperties {
  const palette =
    kind === "points_up"
      ? { border: "1px solid rgba(34,197,94,0.55)", background: "rgba(34,197,94,0.16)", color: "#bbf7d0" }
      : kind === "points_down"
        ? { border: "1px solid rgba(248,113,113,0.55)", background: "rgba(248,113,113,0.18)", color: "#fecaca" }
        : kind === "checkin"
          ? { border: "1px solid rgba(59,130,246,0.55)", background: "rgba(59,130,246,0.16)", color: "#bfdbfe" }
          : kind === "skill"
            ? { border: "1px solid rgba(56,189,248,0.55)", background: "rgba(56,189,248,0.16)", color: "#bae6fd" }
            : kind === "badge"
              ? { border: "1px solid rgba(245,158,11,0.55)", background: "rgba(245,158,11,0.16)", color: "#fde68a" }
              : kind === "spotlight"
                ? { border: "1px solid rgba(250,204,21,0.6)", background: "rgba(250,204,21,0.16)", color: "#fef08a" }
              : kind === "camp"
                ? { border: "1px solid rgba(16,185,129,0.55)", background: "rgba(16,185,129,0.16)", color: "#a7f3d0" }
                : kind === "coupon"
                  ? { border: "1px solid rgba(251,113,133,0.55)", background: "rgba(251,113,133,0.16)", color: "#fecdd3" }
                  : { border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.08)", color: "white" };
  return {
    ...palette,
    padding: "2px 10px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  };
}

function activityChipButton(kind: ActivityItem["kind"] | "all", active: boolean): React.CSSProperties {
  const base = kind === "all" ? activityChip("other") : activityChip(kind);
  return {
    ...base,
    cursor: "pointer",
    opacity: active ? 1 : 0.6,
    boxShadow: active ? "0 0 0 2px rgba(255,255,255,0.08)" : "none",
    background: active ? base.background : "rgba(255,255,255,0.04)",
  };
}

function activityCard(kind: ActivityItem["kind"] | null): React.CSSProperties {
  let border = "1px solid rgba(255,255,255,0.12)";
  if (kind === "points_up") border = "1px solid rgba(34,197,94,0.55)";
  if (kind === "points_down") border = "1px solid rgba(239,68,68,0.55)";
  if (kind === "checkin") border = "1px solid rgba(59,130,246,0.55)";
  if (kind === "skill") border = "1px solid rgba(56,189,248,0.55)";
  if (kind === "badge") border = "1px solid rgba(245,158,11,0.55)";
  if (kind === "spotlight") border = "1px solid rgba(250,204,21,0.6)";
  if (kind === "camp") border = "1px solid rgba(16,185,129,0.55)";
  if (kind === "coupon") border = "1px solid rgba(251,113,133,0.55)";

  return {
    borderRadius: 16,
    padding: 12,
    background: "linear-gradient(135deg, rgba(15,23,42,0.65), rgba(15,23,42,0.35))",
    border,
    boxShadow: "0 10px 28px rgba(0,0,0,0.25)",
    display: "grid",
    gap: 6,
  };
}
function errorBox(): React.CSSProperties {
  return {
    padding: 10,
    borderRadius: 14,
    background: "rgba(239,68,68,0.15)",
    border: "1px solid rgba(255,255,255,0.10)",
  };
}
function tabLabel(tab: Tab): string {
  if (tab === "Challenges") return "Challenge Vault";
  return tab;
}
function TabBtn({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "9px 12px",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.14)",
        background: on ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
        color: "white",
        fontWeight: 950,
        fontSize: 12,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
function pill(): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 999,
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
    fontSize: 11,
  };
}
function btn(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "linear-gradient(90deg, rgba(34,197,94,0.90), rgba(59,130,246,0.70))",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
  };
}
function btnDanger(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "linear-gradient(90deg, rgba(239,68,68,0.85), rgba(124,58,237,0.60))",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
  };
}

function btnGhost(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
  };
}

function customTabRow(): React.CSSProperties {
  return {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  };
}

function customTabBtn(active: boolean): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 999,
    border: active ? "1px solid rgba(59,130,246,0.6)" : "1px solid rgba(255,255,255,0.16)",
    background: active ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  };
}

function customPreviewCard(): React.CSSProperties {
  return {
    position: "relative",
    borderRadius: 16,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(10,12,18,0.96)",
    display: "flex",
    alignItems: "center",
    gap: 12,
    overflow: "visible",
  };
}

function cardPlateStyle(offset: { x: number; y: number; size: number }): React.CSSProperties {
  return {
    position: "absolute",
    top: offset.y,
    left: offset.x,
    width: offset.size,
    height: "auto",
    objectFit: "contain",
    pointerEvents: "none",
    zIndex: 8,
  };
}

function pendingCard(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 14,
    border: "1px solid rgba(250,204,21,0.35)",
    background: "rgba(250,204,21,0.08)",
    display: "grid",
    gap: 6,
    maxWidth: 520,
  };
}

function customCornerTopLeft(): React.CSSProperties {
  return {
    position: "absolute",
    top: -10,
    left: -10,
    width: 76,
    height: 76,
    objectFit: "contain",
    pointerEvents: "none",
    zIndex: 2,
  };
}

function customCornerBottomRight(): React.CSSProperties {
  return {
    position: "absolute",
    bottom: -10,
    right: -10,
    width: 76,
    height: 76,
    objectFit: "contain",
    transform: "rotate(180deg)",
    pointerEvents: "none",
    zIndex: 2,
  };
}

function nameplatePreviewNone(): React.CSSProperties {
  return {
    height: 90,
    borderRadius: 14,
    border: "1px dashed rgba(255,255,255,0.25)",
    background: "rgba(0,0,0,0.45)",
  };
}

function nameplatePreviewTile(unlocked: boolean): React.CSSProperties {
  return {
    height: 90,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.45)",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    filter: unlocked ? "none" : "grayscale(1)",
    position: "relative",
  };
}

function nameplatePreviewLine(): React.CSSProperties {
  return {
    width: "90%",
    height: "auto",
    objectFit: "contain",
  };
}

function paletteSwatch(color: string): React.CSSProperties {
  return {
    width: 44,
    height: 44,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.16)",
    background: color,
    cursor: "pointer",
    boxShadow: "0 14px 40px rgba(0,0,0,0.35)",
  };
}

function effectTile(selected: boolean, unlocked = true): React.CSSProperties {
  return {
    borderRadius: 12,
    border: selected ? "2px solid rgba(59,130,246,0.85)" : "1px solid rgba(255,255,255,0.14)",
    background: unlocked ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.55)",
    padding: 10,
    color: "white",
    textAlign: "left",
    cursor: unlocked ? "pointer" : "not-allowed",
    opacity: unlocked ? 1 : 0.55,
    boxShadow: selected ? "0 0 0 2px rgba(59,130,246,0.35)" : "none",
  };
}

function effectPreviewNone(): React.CSSProperties {
  return {
    height: 70,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.35)",
  };
}

function effectPreview(unlocked: boolean): React.CSSProperties {
  return {
    position: "relative",
    height: 140,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.35)",
    overflow: "hidden",
    display: "grid",
    placeItems: "center",
    filter: unlocked ? "none" : "grayscale(1)",
  };
}

function cornerPreviewNone(): React.CSSProperties {
  return {
    height: 70,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.35)",
  };
}

function cornerPreviewTile(unlocked: boolean): React.CSSProperties {
  return {
    position: "relative",
    height: 140,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.35)",
    overflow: "hidden",
    display: "grid",
    placeItems: "center",
    filter: unlocked ? "none" : "grayscale(1)",
  };
}

function select(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.30)",
    color: "white",
    outline: "none",
    fontWeight: 900,
  };
}

function TrendGraph({ logs, filterSkill }: { logs: SkillHistoryRow[]; filterSkill: string | null }) {
  const width = 360;
  const height = 120;
  const pad = 10;
  const allSkills = Array.from(new Set(logs.map((l) => l.skill_name)));
  const palette = [
    "rgba(34,197,94,0.95)",
    "rgba(59,130,246,0.95)",
    "rgba(249,115,22,0.95)",
    "rgba(236,72,153,0.95)",
    "rgba(168,85,247,0.95)",
    "rgba(245,158,11,0.95)",
  ];
  const colorBySkill = new Map<string, string>();
  allSkills.forEach((s, i) => colorBySkill.set(s, palette[i % palette.length]));

  const visibleLogs = filterSkill ? logs.filter((l) => l.skill_name === filterSkill) : logs;
  if (!visibleLogs.length) {
    return (
      <div
        style={{
          height,
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.04)",
          display: "grid",
          placeItems: "center",
          fontSize: 12,
          opacity: 0.7,
        }}
      >
        No trend yet
      </div>
    );
  }

  const series = (filterSkill ? [filterSkill] : allSkills).map((skill) => {
    const items = visibleLogs.filter((l) => l.skill_name === skill);
    const points = items.map((l, i) => {
      const rate = Math.round(l.rate ?? 0);
      const attempts = Number(l.attempts ?? 0);
      const x = pad + (i / Math.max(1, items.length - 1)) * (width - pad * 2);
      const y = pad + ((100 - rate) / 100) * (height - pad * 2);
      const date = new Date(l.created_at).toLocaleDateString();
      const vs = l.is_battle && l.vs_name ? `VS ${l.vs_name}` : "";
      return {
        x,
        y,
        label: `${rate}% (${l.successes}/${l.attempts || 0}) ${vs}`.trim(),
        date,
        isValid: attempts > 2,
      };
    });
    return { skill, points, color: colorBySkill.get(skill) ?? "rgba(34,197,94,0.95)" };
  });

  const validLogs = visibleLogs.filter((l) => Number(l.attempts ?? 0) > 2);
  const totalReps = validLogs.reduce((sum, l) => sum + Number(l.attempts ?? 0), 0);
  const avgRate = validLogs.length
    ? Math.round(validLogs.reduce((sum, l) => sum + Number(l.rate ?? 0), 0) / validLogs.length)
    : 0;
  const avgY = pad + ((100 - avgRate) / 100) * (height - pad * 2);

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {(filterSkill ? [filterSkill] : allSkills).map((s) => (
          <div key={s} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11, opacity: 0.85 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: colorBySkill.get(s) }} />
            {s}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 11, opacity: 0.8 }}>
        <div>Total reps (attempts ≥ 3): <b>{totalReps}</b></div>
        <div>Average: <b>{avgRate}%</b></div>
      </div>
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        style={{ borderRadius: 16, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", overflow: "visible" }}
      >
        {validLogs.length ? (
          <line
            x1={pad}
            x2={width - pad}
            y1={avgY}
            y2={avgY}
            stroke="rgba(255,255,255,0.35)"
            strokeDasharray="4 4"
            strokeWidth="1.5"
          />
        ) : null}
        {series.map((s) => (
          <polyline
            key={s.skill}
            points={s.points.filter((p) => p.isValid).map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={s.color}
            strokeWidth="2.5"
          />
        ))}
        {series.map((s) =>
          s.points.map((p, i) => (
            <g key={`${s.skill}-${i}`}>
              <circle
                cx={p.x}
                cy={p.y}
                r={4}
                fill={p.isValid ? s.color : "rgba(148,163,184,0.9)"}
              />
              <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="3" fill="rgba(255,255,255,0.85)">
                <tspan x={p.x} dy="0">{p.label}</tspan>
                <tspan x={p.x} dy="4">{p.date}</tspan>
              </text>
            </g>
          ))
        )}
      </svg>
    </div>
  );
}

// DARK palette (good for white line art)
function darkPalette() {
  return [
    "rgba(0,0,0,0.55)",
    "rgba(15,23,42,0.75)",  // slate
    "rgba(2,6,23,0.72)",    // near black
    "rgba(30,41,59,0.72)",  // steel
    "rgba(3,7,18,0.62)",
    "rgba(30,58,138,0.60)", // deep blue
    "rgba(29,78,216,0.55)", // blue
    "rgba(14,116,144,0.55)",// teal
    "rgba(22,163,74,0.50)", // green
    "rgba(180,83,9,0.45)",  // bronze-ish
    "rgba(88,28,135,0.55)", // purple
    "rgba(190,18,60,0.48)", // crimson
  ];
}

function profileGrid(): React.CSSProperties {
  return {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  };
}

function profileField(): React.CSSProperties {
  return {
    display: "grid",
    gap: 6,
  };
}

function profileFieldFull(): React.CSSProperties {
  return {
    display: "grid",
    gap: 6,
    gridColumn: "1 / -1",
  };
}

function profileLabel(): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.85,
  };
}

function profileInput(): React.CSSProperties {
  return {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.28)",
    color: "white",
    outline: "none",
    fontSize: 14,
    fontWeight: 900,
  };
}

function profileTextarea(): React.CSSProperties {
  return {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.28)",
    color: "white",
    outline: "none",
    fontSize: 14,
    fontWeight: 900,
    minHeight: 110,
    resize: "vertical",
  };
}

function profileSaveBtn(): React.CSSProperties {
  return {
    padding: "10px 16px",
    borderRadius: 12,
    border: "1px solid rgba(59,130,246,0.35)",
    background: "linear-gradient(90deg, rgba(59,130,246,0.85), rgba(14,165,233,0.65))",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
  };
}

function auraGrid(): React.CSSProperties {
  return {
    display: "grid",
    gap: 8,
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  };
}

function auraTile(accent: string, highlight = false): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: "8px 10px",
    border: "1px solid rgba(255,255,255,0.16)",
    background: `linear-gradient(140deg, ${accent}, rgba(8,12,20,0.65))`,
    boxShadow: highlight
      ? `inset 0 1px 0 rgba(255,255,255,0.12), 0 0 18px ${accent}`
      : "inset 0 1px 0 rgba(255,255,255,0.12)",
    display: "grid",
    gap: 6,
  };
}

function auraTileLabel(): React.CSSProperties {
  return { fontSize: 11, fontWeight: 900, opacity: 0.85 };
}

function auraTileValue(): React.CSSProperties {
  return { fontSize: 16, fontWeight: 1000, textAlign: "right" };
}

function auraTileOldValue(): React.CSSProperties {
  return { fontSize: 11, fontWeight: 900, opacity: 0.65, textAlign: "right", textDecoration: "line-through" };
}

function auraArrow(direction: "up" | "down"): React.CSSProperties {
  return {
    marginLeft: 6,
    fontSize: 14,
    color: direction === "up" ? "rgba(34,197,94,0.95)" : "rgba(239,68,68,0.95)",
    fontWeight: 1100,
  };
}

function auraTileNote(): React.CSSProperties {
  return { fontSize: 10, opacity: 0.75, textAlign: "right" };
}

function dailyBonusBtn(enabled: boolean): React.CSSProperties {
  return {
    marginTop: 4,
    padding: "6px 10px",
    borderRadius: 999,
    border: enabled ? "1px solid rgba(56,189,248,0.6)" : "1px solid rgba(148,163,184,0.3)",
    background: enabled
      ? "linear-gradient(90deg, rgba(56,189,248,0.9), rgba(14,165,233,0.8))"
      : "rgba(15,23,42,0.35)",
    color: enabled ? "rgba(8,12,20,0.95)" : "rgba(148,163,184,0.7)",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    cursor: enabled ? "pointer" : "not-allowed",
    transition: "transform 0.12s ease, box-shadow 0.12s ease",
    boxShadow: enabled ? "0 8px 20px rgba(14,165,233,0.4)" : "none",
  };
}

function miniStatGrid(): React.CSSProperties {
  return {
    display: "grid",
    gap: 10,
    gridTemplateColumns: "1fr",
  };
}

function miniStatCard(accent: string): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: "10px 12px",
    border: "1px solid rgba(255,255,255,0.16)",
    background: `linear-gradient(140deg, ${accent}, rgba(15,23,42,0.85))`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 12px 30px rgba(0,0,0,0.25)",
  };
}

function miniStatLabel(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.9,
  };
}

function miniStatValue(): React.CSSProperties {
  return { fontSize: 18, fontWeight: 1000, textAlign: "right", minWidth: 90 };
}

function profileNotice(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(34,197,94,0.18)",
    color: "white",
    fontWeight: 900,
    fontSize: 12,
  };
}

function goalsPlaque(): React.CSSProperties {
  return {
    width: 150,
    padding: "8px 10px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.16)",
    background:
      "linear-gradient(145deg, rgba(255,255,255,0.08), rgba(0,0,0,0.45)), rgba(3,7,18,0.6)",
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    fontWeight: 900,
    textAlign: "center",
    textTransform: "none",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    boxShadow:
      "inset 0 2px 4px rgba(255,255,255,0.08), inset 0 -4px 8px rgba(0,0,0,0.45), 0 10px 24px rgba(0,0,0,0.35)",
    textShadow: "0 1px 0 rgba(0,0,0,0.6)",
  };
}

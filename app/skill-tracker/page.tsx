"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fireFx } from "@/components/GlobalFx";
import Particles from "react-tsparticles";
import type { Engine } from "tsparticles-engine";
import { loadSlim } from "tsparticles-slim";
import AvatarEffectParticles from "@/components/AvatarEffectParticles";
import AvatarRender from "@/components/AvatarRender";
import { supabaseClient } from "@/lib/supabase/client";
import { fadeOutGlobalMusic, playGlobalMusic, playGlobalSfx, setGlobalSounds } from "@/lib/globalAudio";

type StudentRow = {
  id: string;
  name: string;
  level: number;
  points_total: number;
  is_competition_team: boolean;
};

type SkillRow = {
  id: string;
  name: string;
  category?: string | null;
  enabled?: boolean | null;
  base_name?: string | null;
  quality?: string | null;
  supplement?: string | null;
  landing?: string | null;
  rotation?: string | null;
};

type SkillElement = {
  id: string;
  element_type: string;
  label: string;
  enabled?: boolean | null;
};

type TrackerRow = {
  id: string;
  group_id?: string | null;
  student_id: string;
  student_name: string;
  student_level?: number;
  student_points?: number;
  student_is_competition?: boolean;
  avatar_path?: string | null;
  avatar_bg?: string | null;
  avatar_effect?: string | null;
  corner_border_url?: string | null;
  corner_border_render_mode?: string | null;
  corner_border_html?: string | null;
  corner_border_css?: string | null;
  corner_border_js?: string | null;
  corner_border_offset_x?: number | null;
  corner_border_offset_y?: number | null;
  corner_border_offsets_by_context?: Record<string, { x?: number | null; y?: number | null; scale?: number | null }> | null;
  card_plate_url?: string | null;
  created_by?: string | null;
  creator_role?: string | null;
  skill_id: string;
  skill_name: string;
  skill_category?: string | null;
  repetitions_target: number;
  points_per_rep?: number;
  points_per_rep_base?: number;
  points_per_rep_effective?: number;
  skill_pulse_multiplier?: number;
  attempts: number;
  successes: number;
  rate: number;
  last_rate: number;
  lifetime_attempts?: number;
  lifetime_successes?: number;
  lifetime_rate?: number;
  last30_attempts?: number;
  last30_successes?: number;
  last30_rate?: number;
  recent_attempts?: Array<{ id: string; success: boolean; created_at: string; failure_reason?: string }>;
  failure_reasons?: string[];
  points_earned?: number;
  created_at: string;
};

type BattleRow = {
  id: string;
  battle_mode?: string;
  participant_ids?: string[];
  team_a_ids?: string[];
  team_b_ids?: string[];
  battle_meta?: any;
  participants?: Array<{
    id: string;
    name: string;
    level?: number;
    points?: number;
    avatar_path?: string | null;
    avatar_bg?: string | null;
    avatar_effect?: string | null;
    attempts?: number;
    successes?: number;
    attempts_list?: boolean[];
    history_attempts?: number;
    history_successes?: number;
    history_rate?: number;
    history_last30_attempts?: number;
    history_last30_successes?: number;
    history_last30_rate?: number;
  }>;
  left_student_id: string;
  right_student_id: string;
  left_name: string;
  right_name: string;
  left_level?: number;
  right_level?: number;
  left_points?: number;
  right_points?: number;
  left_avatar_path?: string | null;
  right_avatar_path?: string | null;
  left_avatar_bg?: string | null;
  right_avatar_bg?: string | null;
  left_avatar_effect?: string | null;
  right_avatar_effect?: string | null;
  skill_id: string;
  skill_name: string;
  repetitions_target: number;
  wager_amount: number;
  points_per_rep?: number;
  left_attempts: number;
  right_attempts: number;
  left_successes: number;
  right_successes: number;
  left_attempts_list?: boolean[];
  right_attempts_list?: boolean[];
  left_history_attempts?: number;
  left_history_successes?: number;
  left_history_rate?: number;
  left_history_last30_attempts?: number;
  left_history_last30_successes?: number;
  left_history_last30_rate?: number;
  right_history_attempts?: number;
  right_history_successes?: number;
  right_history_rate?: number;
  right_history_last30_attempts?: number;
  right_history_last30_successes?: number;
  right_history_last30_rate?: number;
  settled_at?: string | null;
  winner_id?: string | null;
  mvp_ids?: string[];
  points_delta_by_id?: Record<string, number>;
};

type HistoryLog = {
  id: string;
  successes: number;
  attempts: number;
  target: number;
  created_at: string;
  rate: number;
  is_battle?: boolean;
  vs_name?: string | null;
  skill_name?: string;
};

type RepLog = {
  id: string;
  success: boolean;
  failure_reason?: string | null;
  created_at: string;
};

type ComparePoint = {
  created_at: string;
  rate: number;
  successes: number;
  attempts: number;
  is_battle?: boolean;
  vs_name?: string | null;
};

type CompareSeries = {
  student_id: string;
  student_name: string;
  avatar_storage_path?: string | null;
  avatar_bg?: string | null;
  avatar_effect?: string | null;
  is_competition_team?: boolean;
  points: ComparePoint[];
};

type FeedItem = {
  type: "tracker" | "battle";
  created_at: string;
  title: string;
  subtitle: string;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 180)}` } };
  }
}

function parseReasons(input?: string | null) {
  return String(input ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function SkillTrackerPage() {
  const [msg, setMsg] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [mvpCountById, setMvpCountById] = useState<Record<string, number>>({});
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [elements, setElements] = useState<SkillElement[]>([]);
  const [formSkillSearch, setFormSkillSearch] = useState("");
  const [groupSkillSearch, setGroupSkillSearch] = useState("");
  const [battleSkillSearch, setBattleSkillSearch] = useState("");
  const [compareSkillSearch, setCompareSkillSearch] = useState("");
  const [trackers, setTrackers] = useState<TrackerRow[]>([]);
  const [battles, setBattles] = useState<BattleRow[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [effectConfigByKey, setEffectConfigByKey] = useState<Record<string, { config?: any }>>({});
  const [cornerPositionSettings, setCornerPositionSettings] = useState<Record<string, number> | null>(null);
  const [cardPlatePositionSettings, setCardPlatePositionSettings] = useState<Record<string, number> | null>(null);
  const [studentId, setStudentId] = useState<string>("");

  const [openOverlay, setOpenOverlay] = useState(false);
  const [editTrackerId, setEditTrackerId] = useState<string | null>(null);
  const [formStudentId, setFormStudentId] = useState<string>("");
  const [formStudentQuery, setFormStudentQuery] = useState("");
  const [formSkillId, setFormSkillId] = useState<string>("");
  const [formReps, setFormReps] = useState<number>(5);
  const [formFilters, setFormFilters] = useState({
    base_name: "",
    quality: "",
    supplement: "",
    rotation: "",
    landing: "",
  });
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupStudentIds, setGroupStudentIds] = useState<string[]>([]);
  const [groupStudentQuery, setGroupStudentQuery] = useState("");
  const [groupSkillId, setGroupSkillId] = useState<string>("");
  const [groupReps, setGroupReps] = useState<number>(5);
  const [groupFilters, setGroupFilters] = useState({
    base_name: "",
    quality: "",
    supplement: "",
    rotation: "",
    landing: "",
  });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<HistoryLog[]>([]);
  const [historyTracker, setHistoryTracker] = useState<TrackerRow | null>(null);
  const [historyAllOpen, setHistoryAllOpen] = useState(false);
  const [historyAllLogs, setHistoryAllLogs] = useState<HistoryLog[]>([]);
  const [repLogsOpen, setRepLogsOpen] = useState(false);
  const [repLogs, setRepLogs] = useState<RepLog[]>([]);
  const [repTitle, setRepTitle] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState("");
  const [confirmAction, setConfirmAction] = useState<null | (() => void)>(null);
  const [flash, setFlash] = useState<null | { id: string; type: "add" | "remove" }>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareSkillId, setCompareSkillId] = useState<string>("");
  const [compareStudentIds, setCompareStudentIds] = useState<string[]>([]);
  const [compareInput, setCompareInput] = useState("");
  const [compareSeries, setCompareSeries] = useState<CompareSeries[]>([]);
  const [battleOpen, setBattleOpen] = useState(false);
  const [battleLeftId, setBattleLeftId] = useState<string>("");
  const [battleRightId, setBattleRightId] = useState<string>("");
  const [battleLeftQuery, setBattleLeftQuery] = useState("");
  const [battleRightQuery, setBattleRightQuery] = useState("");
  const [battleMode, setBattleMode] = useState<"duel" | "ffa" | "teams" | "lanes">("duel");
  const [battleParticipantIdsState, setBattleParticipantIdsState] = useState<string[]>([]);
  const [battleParticipantQuery, setBattleParticipantQuery] = useState("");
  const [battleTeamAIds, setBattleTeamAIds] = useState<string[]>([]);
  const [battleTeamBIds, setBattleTeamBIds] = useState<string[]>([]);
  const [battleTeamCIds, setBattleTeamCIds] = useState<string[]>([]);
  const [battleTeamDIds, setBattleTeamDIds] = useState<string[]>([]);
  const [battleTeamAQuery, setBattleTeamAQuery] = useState("");
  const [battleTeamBQuery, setBattleTeamBQuery] = useState("");
  const [battleTeamCQuery, setBattleTeamCQuery] = useState("");
  const [battleTeamDQuery, setBattleTeamDQuery] = useState("");
  const [battleSkillId, setBattleSkillId] = useState<string>("");
  const [battleReps, setBattleReps] = useState<number>(5);
  const [battleLaneCategories, setBattleLaneCategories] = useState<string[]>([]);
  const [battleLaneAssignments, setBattleLaneAssignments] = useState<Record<string, string[]>>({});
  const [battleLaneSkills, setBattleLaneSkills] = useState<Record<string, string[]>>({});
  const [battleFilters, setBattleFilters] = useState({
    base_name: "",
    quality: "",
    supplement: "",
    rotation: "",
    landing: "",
  });
  const [battleWagerOn, setBattleWagerOn] = useState(false);
  const [battleWagerAmount, setBattleWagerAmount] = useState<number>(10);
  const [battlePointsPerRep, setBattlePointsPerRep] = useState<number>(5);
  const [resultOpen, setResultOpen] = useState(false);
  const [resultTracker, setResultTracker] = useState<TrackerRow | null>(null);
  const [battleResultOpen, setBattleResultOpen] = useState(false);
  const [battleResult, setBattleResult] = useState<BattleRow | null>(null);
  const [laneSuccessPulse, setLaneSuccessPulse] = useState<{ battleId: string; playerId: string; at: number } | null>(null);
  const [battleTurnState, setBattleTurnState] = useState<
    Record<
      string,
      {
        order: string[];
        index: number;
        mode: "duel" | "ffa" | "teams" | "lanes";
        label?: string;
      }
    >
  >({});
  const [battleCoinState, setBattleCoinState] = useState<Record<string, { label: string; at: number }>>({});
  const autoSettleInFlight = useRef<Set<string>>(new Set());
  const [clearOpen, setClearOpen] = useState(false);
  const [clearCompleted, setClearCompleted] = useState(false);
  const [clearCompletedBattles, setClearCompletedBattles] = useState(false);
  const [clearOld, setClearOld] = useState(false);
  const [clearAll, setClearAll] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);
  const [annotateOpen, setAnnotateOpen] = useState(false);
  const [annotateTracker, setAnnotateTracker] = useState<TrackerRow | null>(null);
  const [annotateSaving, setAnnotateSaving] = useState<Record<string, boolean>>({});
  const [annotateDrafts, setAnnotateDrafts] = useState<Record<string, string[]>>({});
  const [openReasonId, setOpenReasonId] = useState<string | null>(null);
  const [reasonQueries, setReasonQueries] = useState<Record<string, string>>({});
  const [customReasons, setCustomReasons] = useState<string[]>([]);
  const [adminEditMode, setAdminEditMode] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminLogs, setAdminLogs] = useState<RepLog[]>([]);
  const [adminSaving, setAdminSaving] = useState<Record<string, boolean>>({});
  const [adminMsg, setAdminMsg] = useState("");
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [quickEditTracker, setQuickEditTracker] = useState<TrackerRow | null>(null);
  const [quickEditLogs, setQuickEditLogs] = useState<RepLog[]>([]);
  const [quickEditSaving, setQuickEditSaving] = useState<Record<string, boolean>>({});
  const [viewerRole, setViewerRole] = useState("coach");
  const [studentBlocked, setStudentBlocked] = useState(false);
  const [isTabletRoute, setIsTabletRoute] = useState(false);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [tabletCreateOpen, setTabletCreateOpen] = useState(false);
  const [selectedTrackerId, setSelectedTrackerId] = useState<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTabletRouteRef = useRef(false);
  const battleMusicActive = useRef(false);
  const battleWinSounded = useRef(new Set<string>());
  const [battleIntroOpen, setBattleIntroOpen] = useState(false);
  const battleIntroTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [battleCreateIntro, setBattleCreateIntro] = useState(false);
  const battleCreateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [battleCreateId, setBattleCreateId] = useState<string | null>(null);
  const pendingLogCounts = useRef<Map<string, number>>(new Map());
  const pendingLogSuccessCounts = useRef<Map<string, number>>(new Map());
  const logQueue = useRef<Map<string, Promise<void>>>(new Map());
  const pendingBattleLogCounts = useRef<Map<string, number>>(new Map());
  const battleLogQueue = useRef<Map<string, Promise<void>>>(new Map());

  const compCrestUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/badges/prestige/compteam.png`
    : "";

  useEffect(() => {
    (async () => {
      const path = typeof window !== "undefined" ? window.location.pathname : "";
      const tablet = path === "/skill-pulse" || path === "/classroom/skill-pulse";
      setIsTabletRoute(tablet);
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await safeJson(res);
      if (!data.ok) return;
      const role = String(data.json?.role ?? "coach");
      setViewerRole(role);
      const canUseTablet = tablet && ["skill_user", "skill_pulse", "classroom"].includes(role);
      if (!["admin", "coach"].includes(role) && !canUseTablet) setStudentBlocked(true);
    })();
  }, []);

  useEffect(() => {
    isTabletRouteRef.current = isTabletRoute;
  }, [isTabletRoute]);

  useEffect(() => {
    const syncViewport = () => {
      if (typeof window === "undefined") return;
      setIsCompactViewport(window.innerWidth <= 1024);
    };
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  async function refreshStudents(preserveSelected = true) {
    const r = await fetch("/api/students/list", { cache: "no-store" });
    const sj = await safeJson(r);
    if (!sj.ok) {
      setMsg(sj.json?.error || "Failed to load students");
      return;
    }
    const list = (sj.json?.students ?? []) as StudentRow[];
    setStudents(list);
    if (list.length) {
      refreshMvpCounts(list.map((s) => s.id));
    }

    if (!preserveSelected) return;
    const saved = (() => {
      try {
        return localStorage.getItem("active_student_id") || "";
      } catch {
        return "";
      }
    })();
    setStudentId((prev) => {
      if (prev && list.some((s) => s.id === prev)) return prev;
      if (saved && list.some((s) => s.id === saved)) return saved;
      return list[0]?.id || "";
    });
  }

  async function refreshSkills() {
    const r = await fetch("/api/tracker-skills/list", { cache: "no-store" });
    const sj = await safeJson(r);
    if (!sj.ok) {
      setMsg(sj.json?.error || "Failed to load skills");
      return;
    }
    setSkills(
      ((sj.json?.skills ?? []) as SkillRow[]).filter((s) => {
        const baseName = String(s.base_name ?? "").trim();
        const hasComboElements = [s.quality, s.supplement, s.rotation, s.landing].some((v) =>
          String(v ?? "").trim()
        );
        return s.enabled !== false && baseName && hasComboElements;
      })
    );
  }

  async function refreshElements() {
    const r = await fetch("/api/tracker-skill-elements/list", { cache: "no-store" });
    const sj = await safeJson(r);
    if (!sj.ok) return;
    setElements((sj.json?.elements ?? []) as SkillElement[]);
  }

  async function refreshMvpCounts(ids: string[]) {
    if (!ids.length) return;
    const res = await fetch("/api/mvp/counts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_ids: ids }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return;
    setMvpCountById(sj.json?.counts ?? {});
  }

  async function refreshTrackers() {
    const qs = isTabletRouteRef.current ? "?source=skill_pulse" : "";
    const r = await fetch(`/api/skill-tracker/list${qs}`, { cache: "no-store" });
    const sj = await safeJson(r);
    if (!sj.ok) {
      setMsg(sj.json?.error || "Failed to load trackers");
      return;
    }
    const rows = (sj.json?.trackers ?? []) as TrackerRow[];
    setTrackers((prev) => {
      if (!prev.length) return rows;
      const prevById = new Map(prev.map((t) => [t.id, t]));
      return rows.map((t) => {
        const pending = pendingLogCounts.current.get(t.id) ?? 0;
        if (!pending) return t;
        const prevRow = prevById.get(t.id);
        if (prevRow) {
          const prevAttempts = Number(prevRow.attempts ?? 0);
          const nextAttempts = Number(t.attempts ?? 0);
          const prevSuccesses = Number(prevRow.successes ?? 0);
          const nextSuccesses = Number(t.successes ?? 0);
          if (nextAttempts >= prevAttempts && nextSuccesses >= prevSuccesses) {
            pendingLogCounts.current.set(t.id, 0);
            pendingLogSuccessCounts.current.set(t.id, 0);
            return t;
          }
          if (prevAttempts > nextAttempts || (prevAttempts === nextAttempts && prevSuccesses >= nextSuccesses)) {
            return prevRow;
          }
        }
        const pendingSuccess = pendingLogSuccessCounts.current.get(t.id) ?? 0;
        const attempts = Number(t.attempts ?? 0) + pending;
        const successes = Number(t.successes ?? 0) + pendingSuccess;
        const rate = attempts ? Math.round((successes / attempts) * 100) : 0;
        return {
          ...t,
          attempts,
          successes,
          rate,
          recent_attempts: prevRow?.recent_attempts ?? t.recent_attempts,
        };
      });
    });
  }

  async function refreshBattles() {
    const qs = isTabletRouteRef.current ? "?source=skill_pulse" : "";
    const r = await fetch(`/api/skill-tracker/battle/list${qs}`, { cache: "no-store" });
    const sj = await safeJson(r);
    if (!sj.ok) {
      setMsg(sj.json?.error || "Failed to load battles");
      return;
    }
    const nextBattles = (sj.json?.battles ?? []) as BattleRow[];
    setBattles(nextBattles);
    if (!isTabletRouteRef.current) {
      queueAutoSettle(nextBattles);
    }
    if (students.length) {
      refreshMvpCounts(students.map((s) => s.id));
    }
  }

  async function refreshFeed() {
    const qs = isTabletRouteRef.current ? "?source=skill_pulse" : "";
    const r = await fetch(`/api/skill-tracker/feed${qs}`, { cache: "no-store" });
    const sj = await safeJson(r);
    if (!sj.ok) return;
    setFeed((sj.json?.feed ?? []) as FeedItem[]);
  }

  useEffect(() => {
    refreshStudents(true);
    refreshSkills();
    refreshElements();
    refreshTrackers();
    refreshBattles();
    refreshFeed();
  }, []);

  useEffect(() => {
    if (!students.length) return;
    refreshMvpCounts(students.map((s) => s.id));
  }, [students]);

  useEffect(() => {
    if (!isTabletRoute) return;
    refreshTrackers();
    refreshBattles();
    refreshFeed();
  }, [isTabletRoute]);

  useEffect(() => {
    const scheduleRefresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        refreshTrackers();
        refreshBattles();
        refreshFeed();
      }, 200);
    };

    const supabase = supabaseClient();
    const channel = supabase
      .channel("skill-tracker-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "skill_trackers" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "skill_tracker_logs" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "battle_trackers" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "battle_tracker_logs" }, scheduleRefresh)
      .subscribe();

    const fallback = setInterval(() => {
      refreshTrackers();
      refreshBattles();
      refreshFeed();
    }, 60000);

    return () => {
      if (fallback) clearInterval(fallback);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/avatar-effects/list", { cache: "no-store" });
      const sj = await safeJson(r);
      if (!sj.ok) return;
      const list = (sj.json?.effects ?? []) as Array<{ key: string; config?: any }>;
      const map: Record<string, { config?: any }> = {};
      list.forEach((e) => {
        if (e?.key) map[String(e.key)] = { config: e.config };
      });
      setEffectConfigByKey(map);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/sound-effects/list", { cache: "no-store" });
      const sj = await safeJson(r);
      if (!sj.ok) return;
      const map: Record<string, { url: string; volume: number }> = {};
      (sj.json?.effects ?? []).forEach((row: any) => {
        const key = String(row?.key ?? "");
        const url = String(row?.audio_url ?? "");
        if (!key || !url) return;
        map[key] = { url, volume: Math.min(1, Math.max(0, Number(row?.volume ?? 1))) };
      });
      setGlobalSounds(map);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/corner-borders/settings", { cache: "no-store" });
      const sj = await safeJson(r);
      if (!sj.ok) return;
      setCornerPositionSettings((sj.json?.settings ?? null) as Record<string, number> | null);
    })();
    (async () => {
      const r = await fetch("/api/card-plates/settings", { cache: "no-store" });
      const sj = await safeJson(r);
      if (!sj.ok) return;
      setCardPlatePositionSettings((sj.json?.settings ?? null) as Record<string, number> | null);
    })();
  }, []);

  useEffect(() => {
    if (!studentId) return;
    try {
      localStorage.setItem("active_student_id", studentId);
    } catch {}
  }, [studentId]);

  useEffect(() => {
    if (!battles.length) {
      if (battleMusicActive.current) {
        fadeOutGlobalMusic(1400);
        battleMusicActive.current = false;
      }
      return;
    }
    const hasActive = battles.some((b) => !isBattleDone(b));
    if (hasActive) {
      playGlobalMusic("battle_pulse_music");
      battleMusicActive.current = true;
    } else if (battleMusicActive.current) {
      fadeOutGlobalMusic(1400);
      battleMusicActive.current = false;
    }
  }, [battles]);

  useEffect(() => {
    battles.forEach((b) => {
      if (!isBattleDone(b) || !b.winner_id) return;
      if (battleWinSounded.current.has(b.id)) return;
      playWinnerSound();
      battleWinSounded.current.add(b.id);
    });
  }, [battles]);

  useEffect(() => {
    if (!battleOpen) return;
    setBattleIntroOpen(true);
    playGlobalSfx("battle_pulse_swords");
    if (battleIntroTimer.current) clearTimeout(battleIntroTimer.current);
    battleIntroTimer.current = setTimeout(() => setBattleIntroOpen(false), 1600);
    return () => {
      if (battleIntroTimer.current) clearTimeout(battleIntroTimer.current);
    };
  }, [battleOpen]);

  useEffect(() => {
    return () => {
      if (battleCreateTimer.current) clearTimeout(battleCreateTimer.current);
    };
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!selectedTrackerId) return;
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (!["<", ">", ",", "."].includes(event.key)) return;
      const tracker = trackers.find((t) => t.id === selectedTrackerId);
      if (!tracker) return;
      if (isSkillUserSource(tracker) && ["admin", "coach"].includes(viewerRole)) return;
      const attemptsCount = Number(tracker.attempts ?? 0);
      const target = Number(tracker.repetitions_target ?? 0);
      if (target > 0 && attemptsCount >= target) return;
      event.preventDefault();
      logAttempt(selectedTrackerId, event.key === "<" || event.key === ",");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedTrackerId, trackers, viewerRole]);

  function getStudentName(id: string) {
    return students.find((s) => s.id === id)?.name ?? "";
  }

  function isBattleDone(b: BattleRow) {
    const target = Number(b.repetitions_target ?? 0);
    if ((b.battle_mode ?? "duel") !== "duel") {
      const participants = b.participants ?? [];
      if (!participants.length) return false;
      return participants.every((p) => (p.attempts_list?.length ?? 0) >= target);
    }
    const leftAttempts = b.left_attempts_list?.length ?? b.left_attempts ?? 0;
    const rightAttempts = b.right_attempts_list?.length ?? b.right_attempts ?? 0;
    return leftAttempts >= target && rightAttempts >= target;
  }

  function playSound(key: string) {
    playGlobalSfx(key);
  }

  function playWinnerSound() {
    if (!playGlobalSfx("battle_pulse_winner")) {
      playGlobalSfx("battle_pulse_win");
    }
  }

  function studentSuggestions(query: string, excludeIds: string[] = []) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return students
      .filter((s) => !excludeIds.includes(s.id))
      .filter((s) => s.name.toLowerCase().includes(q))
      .slice(0, 6);
  }

  function renderStudentSuggestion(s: StudentRow) {
    const mvpCount = mvpCountById[s.id] ?? 0;
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span>{s.name}</span>
        <span style={{ fontSize: 11, fontWeight: 900, color: "#facc15" }}>MVP: {mvpCount}</span>
      </div>
    );
  }

  function hasExactStudentMatch(query: string) {
    const q = query.trim().toLowerCase();
    if (!q) return false;
    return students.some((s) => s.name.toLowerCase() === q);
  }

  function normalizeLaneCategoryList(value: unknown): string[] {
    if (Array.isArray(value)) {
      const seen = new Set<string>();
      return value
        .map((entry) => String(entry ?? "").trim())
        .filter((entry) => entry)
        .filter((entry) => {
          if (seen.has(entry)) return false;
          seen.add(entry);
          return true;
        });
    }
    const single = String(value ?? "").trim();
    return single ? [single] : [];
  }

  function normalizeLaneAssignments(raw: Record<string, unknown> | null | undefined): Record<string, string[]> {
    if (!raw || typeof raw !== "object") return {};
    const next: Record<string, string[]> = {};
    Object.entries(raw).forEach(([id, value]) => {
      const cats = normalizeLaneCategoryList(value);
      if (cats.length) next[id] = cats;
    });
    return next;
  }

  function getAssignedLaneCategories(assignments: Record<string, unknown>, id: string): string[] {
    return normalizeLaneCategoryList(assignments[id]);
  }

  function getPrimaryLaneCategory(assignments: Record<string, unknown>, id: string): string {
    return getAssignedLaneCategories(assignments, id)[0] ?? "";
  }

  function buildLaneSkillPool(categorySkills: Record<string, unknown> | null | undefined, cats: string[]) {
    const pool: Array<{ cat: string; skillId: string }> = [];
    cats.forEach((cat) => {
      const list = Array.isArray((categorySkills as any)?.[cat]) ? (categorySkills as any)[cat] : [];
      list.forEach((skillId: unknown) => {
        const clean = String(skillId ?? "").trim();
        if (clean) pool.push({ cat, skillId: clean });
      });
    });
    return pool;
  }

  function addBattleParticipant(id: string) {
    const sid = String(id ?? "").trim();
    if (!sid) return;
    setBattleParticipantIdsState((prev) => {
      if (prev.includes(sid)) return prev;
      return [...prev, sid];
    });
  }

  function removeBattleParticipant(id: string) {
    setBattleParticipantIdsState((prev) => prev.filter((pid) => pid !== id));
  }

  function addBattleTeamMember(team: "a" | "b" | "c" | "d", id: string) {
    const sid = String(id ?? "").trim();
    if (!sid) return;
    if (team === "a") {
      setBattleTeamAIds((prev) => {
        if (prev.includes(sid)) return prev;
        return [...prev, sid];
      });
      setBattleTeamBIds((prev) => prev.filter((pid) => pid !== sid));
      setBattleTeamCIds((prev) => prev.filter((pid) => pid !== sid));
      setBattleTeamDIds((prev) => prev.filter((pid) => pid !== sid));
    } else if (team === "b") {
      setBattleTeamBIds((prev) => {
        if (prev.includes(sid)) return prev;
        return [...prev, sid];
      });
      setBattleTeamAIds((prev) => prev.filter((pid) => pid !== sid));
      setBattleTeamCIds((prev) => prev.filter((pid) => pid !== sid));
      setBattleTeamDIds((prev) => prev.filter((pid) => pid !== sid));
    } else if (team === "c") {
      setBattleTeamCIds((prev) => {
        if (prev.includes(sid)) return prev;
        return [...prev, sid];
      });
      setBattleTeamAIds((prev) => prev.filter((pid) => pid !== sid));
      setBattleTeamBIds((prev) => prev.filter((pid) => pid !== sid));
      setBattleTeamDIds((prev) => prev.filter((pid) => pid !== sid));
    } else {
      setBattleTeamDIds((prev) => {
        if (prev.includes(sid)) return prev;
        return [...prev, sid];
      });
      setBattleTeamAIds((prev) => prev.filter((pid) => pid !== sid));
      setBattleTeamBIds((prev) => prev.filter((pid) => pid !== sid));
      setBattleTeamCIds((prev) => prev.filter((pid) => pid !== sid));
    }
  }

  function removeBattleTeamMember(team: "a" | "b" | "c" | "d", id: string) {
    if (team === "a") setBattleTeamAIds((prev) => prev.filter((pid) => pid !== id));
    else if (team === "b") setBattleTeamBIds((prev) => prev.filter((pid) => pid !== id));
    else if (team === "c") setBattleTeamCIds((prev) => prev.filter((pid) => pid !== id));
    else setBattleTeamDIds((prev) => prev.filter((pid) => pid !== id));
    setBattleLaneAssignments((prev) => {
      if (!prev[id]) return prev;
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  }

  function openCreate() {
    setEditTrackerId(null);
    setFormStudentId(studentId || "");
    setFormStudentQuery(studentId ? getStudentName(studentId) : "");
    setFormSkillSearch("");
    setFormSkillId(skills[0]?.id || "");
    setFormReps(5);
    setOpenOverlay(true);
  }

  function openGroup() {
    setGroupStudentIds([]);
    setGroupStudentQuery("");
    setGroupSkillSearch("");
    setGroupSkillId(skills[0]?.id || "");
    setGroupReps(5);
    setGroupOpen(true);
  }

  function openEdit(t: TrackerRow) {
    setAdminEditMode(false);
    setAdminUnlocked(false);
    setAdminPin("");
    setAdminLogs([]);
    setAdminMsg("");
    setEditTrackerId(t.id);
    setFormStudentId(t.student_id);
    setFormStudentQuery(getStudentName(t.student_id));
    setFormSkillSearch("");
    setFormSkillId(t.skill_id);
    setFormReps(t.repetitions_target);
    setOpenOverlay(true);
  }

  function openAdminEdit(t: TrackerRow) {
    setAdminEditMode(true);
    setAdminUnlocked(false);
    setAdminPin("");
    setAdminLogs([]);
    setAdminMsg("");
    setEditTrackerId(t.id);
    setFormStudentId(t.student_id);
    setFormSkillSearch("");
    setFormSkillId(t.skill_id);
    setFormReps(t.repetitions_target);
    setOpenOverlay(true);
  }

  async function loadAdminLogs(trackerId: string) {
    const res = await fetch(`/api/skill-tracker/rep-logs?tracker_id=${encodeURIComponent(trackerId)}`);
    const sj = await safeJson(res);
    if (!sj.ok) {
      setAdminMsg(sj.json?.error || "Failed to load reps");
      return;
    }
    setAdminLogs((sj.json?.logs ?? []) as RepLog[]);
  }

  function isSkillUserSource(t?: TrackerRow | null) {
    const role = String(t?.creator_role ?? "").toLowerCase();
    return role === "skill_user" || role === "skill_pulse";
  }

  async function loadQuickLogs(trackerId: string) {
    const res = await fetch(`/api/skill-tracker/rep-logs?tracker_id=${encodeURIComponent(trackerId)}`);
    const sj = await safeJson(res);
    if (!sj.ok) {
      setMsg(sj.json?.error || "Failed to load reps");
      return;
    }
    setQuickEditLogs((sj.json?.logs ?? []) as RepLog[]);
  }

  async function openQuickEdit(t: TrackerRow) {
    setQuickEditTracker(t);
    setQuickEditOpen(true);
    await loadQuickLogs(t.id);
  }

  async function updateQuickLog(log: RepLog) {
    if (!quickEditTracker) return;
    setQuickEditSaving((prev) => ({ ...prev, [log.id]: true }));
    const res = await fetch("/api/skill-tracker/admin/update-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tracker_id: quickEditTracker.id,
        log_id: log.id,
        action: "toggle",
        success: !log.success,
      }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) {
      setQuickEditSaving((prev) => ({ ...prev, [log.id]: false }));
      return setMsg(sj.json?.error || "Failed to update rep");
    }
    await loadQuickLogs(quickEditTracker.id);
    await refreshTrackers();
    await refreshFeed();
    if (historyOpen && historyTracker?.id === quickEditTracker.id) {
      await openHistory(historyTracker);
    }
    setQuickEditSaving((prev) => ({ ...prev, [log.id]: false }));
  }

  async function verifyAdminPin() {
    if (!editTrackerId) return;
    setAdminMsg("");
    const res = await fetch("/api/skill-tracker/settings/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: adminPin }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) {
      setAdminUnlocked(false);
      return setAdminMsg(sj.json?.error || "Invalid admin PIN");
    }
    setAdminUnlocked(true);
    await loadAdminLogs(editTrackerId);
  }

  async function updateAdminLog(action: "toggle" | "delete", log: RepLog) {
    if (!editTrackerId) return;
    setAdminSaving((prev) => ({ ...prev, [log.id]: true }));
    const res = await fetch("/api/skill-tracker/admin/update-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tracker_id: editTrackerId,
        log_id: log.id,
        action,
        success: action === "toggle" ? !log.success : undefined,
        pin: adminPin,
      }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) {
      setAdminSaving((prev) => ({ ...prev, [log.id]: false }));
      return setAdminMsg(sj.json?.error || "Failed to update rep");
    }
    await loadAdminLogs(editTrackerId);
    await refreshTrackers();
    await refreshFeed();
    if (historyOpen && historyTracker?.id === editTrackerId) {
      await openHistory(historyTracker);
    }
    setAdminSaving((prev) => ({ ...prev, [log.id]: false }));
  }

  async function saveTracker() {
    if (!formStudentId || !formSkillId) return;
    setMsg("");

    if (editTrackerId) {
      const res = await fetch("/api/skill-tracker/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tracker_id: editTrackerId,
          skill_id: formSkillId,
          repetitions_target: formReps,
        }),
      });
      const sj = await safeJson(res);
      if (!sj.ok) return setMsg(sj.json?.error || "Failed to update tracker");
    } else {
      const created_source = isTabletRoute ? "skill_pulse" : undefined;
      const res = await fetch("/api/skill-tracker/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: formStudentId,
          skill_id: formSkillId,
          repetitions_target: formReps,
          created_source,
        }),
      });
      const sj = await safeJson(res);
      if (!sj.ok) return setMsg(sj.json?.error || "Failed to create tracker");
    }

    setOpenOverlay(false);
    await refreshTrackers();
  }

  async function saveGroupTracker() {
    if (!groupSkillId || groupStudentIds.length === 0) return;
    setMsg("");
    const created_source = isTabletRoute ? "skill_pulse" : undefined;
    const res = await fetch("/api/skill-tracker/group/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_ids: groupStudentIds,
        skill_id: groupSkillId,
        repetitions_target: groupReps,
        created_source,
      }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to create group tracker");
    setGroupOpen(false);
    await refreshTrackers();
  }

  async function clearTrackers() {
    if (!clearCompleted && !clearCompletedBattles && !clearOld && !clearAll) {
      setMsg("Choose at least one clear option.");
      return;
    }
    setClearBusy(true);
    setMsg("");
    const res = await fetch("/api/skill-tracker/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clear_completed: clearCompleted,
        clear_completed_battles: clearCompletedBattles,
        clear_old: clearOld,
        clear_all: clearAll,
      }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) {
      setMsg(sj.json?.error || "Failed to clear trackers");
    } else {
      setClearOpen(false);
      setClearCompleted(false);
      setClearCompletedBattles(false);
      setClearOld(false);
      setClearAll(false);
      await refreshTrackers();
    }
    setClearBusy(false);
  }

  async function removeGroup(groupId: string) {
    setMsg("");
    const res = await fetch("/api/skill-tracker/group/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group_id: groupId }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to remove group");
    await refreshTrackers();
  }

  async function logAttempt(trackerId: string, success: boolean) {
    setMsg("");
    const tracker = trackers.find((t) => t.id === trackerId);
    if (tracker) {
      const inflight = pendingLogCounts.current.get(trackerId) ?? 0;
      const attemptsCount = Number(tracker.attempts ?? 0) + inflight;
      const target = Number(tracker.repetitions_target ?? 0);
      if (target > 0 && attemptsCount >= target) return;
    }
    pendingLogCounts.current.set(trackerId, (pendingLogCounts.current.get(trackerId) ?? 0) + 1);
    pendingLogSuccessCounts.current.set(
      trackerId,
      (pendingLogSuccessCounts.current.get(trackerId) ?? 0) + (success ? 1 : 0)
    );
    setFlash({ id: trackerId, type: success ? "add" : "remove" });
    setTrackers((prev) =>
      prev.map((t) => {
        if (t.id !== trackerId) return t;
        const attemptsCount = Number(t.attempts ?? 0);
        const successesCount = Number(t.successes ?? 0);
        const target = Number(t.repetitions_target ?? 0);
        if (target > 0 && attemptsCount >= target) return t;
        const nextAttempts = attemptsCount + 1;
        const nextSuccesses = successesCount + (success ? 1 : 0);
        const nextRate = nextAttempts ? Math.round((nextSuccesses / nextAttempts) * 100) : 0;
        const recent = [...(t.recent_attempts ?? []), { id: `optimistic-${Date.now()}-${Math.random()}`, success, created_at: new Date().toISOString() }];
        const cap = Math.max(1, Math.min(20, target || 20));
        return {
          ...t,
          attempts: nextAttempts,
          successes: nextSuccesses,
          rate: nextRate,
          last_rate: t.rate,
          recent_attempts: recent.slice(-cap),
        };
      })
    );
    const prev = logQueue.current.get(trackerId) ?? Promise.resolve();
    const next = prev
      .catch(() => undefined)
      .then(() => sendLogAttempt(trackerId, success));
    logQueue.current.set(trackerId, next);
    next.catch(() => undefined);
  }

  async function sendLogAttempt(trackerId: string, success: boolean) {
    const res = await fetch("/api/skill-tracker/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tracker_id: trackerId, success }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) {
      const inflight = pendingLogCounts.current.get(trackerId) ?? 1;
      const nextInflight = Math.max(0, inflight - 1);
      pendingLogCounts.current.set(trackerId, nextInflight);
      const inflightSuccess = pendingLogSuccessCounts.current.get(trackerId) ?? 0;
      pendingLogSuccessCounts.current.set(trackerId, Math.max(0, inflightSuccess - (success ? 1 : 0)));
      setFlash(null);
      await refreshTrackers();
      setMsg(sj.json?.error || "Failed to log attempt");
      return;
    }
    const inflight = pendingLogCounts.current.get(trackerId) ?? 1;
    const nextInflight = Math.max(0, inflight - 1);
    pendingLogCounts.current.set(trackerId, nextInflight);
    const inflightSuccess = pendingLogSuccessCounts.current.get(trackerId) ?? 0;
    pendingLogSuccessCounts.current.set(trackerId, Math.max(0, inflightSuccess - (success ? 1 : 0)));
    if (nextInflight === 0) {
      setTimeout(() => {
        refreshTrackers();
        refreshFeed();
      }, 120);
    }
    setFlash(null);
  }

  async function undoAttempt(trackerId: string) {
    setMsg("");

    const res = await fetch("/api/skill-tracker/undo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tracker_id: trackerId }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) {
      return setMsg(sj.json?.error || "Failed to undo");
    }

    await refreshTrackers();
    await refreshFeed();
    if (historyOpen && historyTracker?.id === trackerId) {
      await openHistory(historyTracker);
    }
  }

  async function openAnnotate(t: TrackerRow) {
    setAnnotateTracker(t);
    const nextDrafts: Record<string, string[]> = {};
    (t.recent_attempts ?? []).forEach((a) => {
      if (a?.id) nextDrafts[a.id] = parseReasons(a.failure_reason);
    });
    setAnnotateDrafts(nextDrafts);
    setAnnotateOpen(true);

    const res = await fetch(`/api/skill-tracker/rep-logs?tracker_id=${encodeURIComponent(t.id)}`);
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to load reps");
    const logs = (sj.json?.logs ?? []) as RepLog[];
    const recent_attempts = logs.slice(-Math.max(1, Math.min(20, Number(t.repetitions_target ?? 1)))).map((l) => ({
      id: l.id,
      success: l.success,
      created_at: l.created_at,
      failure_reason: l.failure_reason ?? "",
    }));
    setAnnotateTracker((prev) => (prev ? { ...prev, recent_attempts } : prev));
    const updatedDrafts: Record<string, string[]> = {};
    recent_attempts.forEach((a) => {
      if (a?.id) updatedDrafts[a.id] = parseReasons(a.failure_reason);
    });
    setAnnotateDrafts(updatedDrafts);
  }

  async function saveAnnotate(logId: string, reasons: string[]) {
    if (!logId) return;
    setAnnotateSaving((prev) => ({ ...prev, [logId]: true }));
    const res = await fetch("/api/skill-tracker/annotate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ log_id: logId, failure_reason: reasons.join(", ") }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) {
      setMsg(sj.json?.error || "Failed to save reason");
    } else {
      await refreshTrackers();
      setAnnotateTracker((prev) => {
        if (!prev) return prev;
        const nextAttempts = (prev.recent_attempts ?? []).map((a) =>
          a.id === logId ? { ...a, failure_reason: reasons.join(", ") } : a
        );
        return { ...prev, recent_attempts: nextAttempts };
      });
    }
    setAnnotateSaving((prev) => ({ ...prev, [logId]: false }));
  }

  async function logBattleAttempt(battleId: string, studentIdForLog: string, success: boolean) {
    setMsg("");
    setFlash({ id: battleId, type: success ? "add" : "remove" });
    playSound(success ? "battle_pulse_check" : "battle_pulse_x");
    const battle = battles.find((b) => b.id === battleId);
    if (!canLogBattleAttempt(battle, studentIdForLog)) return;
    pendingBattleLogCounts.current.set(
      battleId,
      (pendingBattleLogCounts.current.get(battleId) ?? 0) + 1
    );
    setBattles((prev) => applyOptimisticBattleAttempt(prev, battleId, studentIdForLog, success));
    if (success && (battle?.battle_mode ?? "duel") === "lanes") {
      setLaneSuccessPulse({ battleId, playerId: studentIdForLog, at: Date.now() });
    }
    if ((battle?.battle_mode ?? "duel") === "lanes") {
      nextBattleTurn(battleId);
    }
    const prev = battleLogQueue.current.get(battleId) ?? Promise.resolve();
    const next = prev
      .catch(() => undefined)
      .then(() => sendBattleLogAttempt(battleId, studentIdForLog, success));
    battleLogQueue.current.set(battleId, next);
    next.catch(() => undefined);
  }

  function buildAttemptList(existing: boolean[] | undefined, attempts = 0, successes = 0) {
    if (Array.isArray(existing)) return [...existing];
    const clampedAttempts = Math.max(0, Number(attempts ?? 0));
    const clampedSuccesses = Math.max(0, Math.min(clampedAttempts, Number(successes ?? 0)));
    return [
      ...Array.from({ length: clampedSuccesses }, () => true),
      ...Array.from({ length: Math.max(0, clampedAttempts - clampedSuccesses) }, () => false),
    ];
  }

  function canLogBattleAttempt(battle: BattleRow | undefined, studentIdForLog: string) {
    if (!battle) return false;
    const target = Math.max(1, Number(battle.repetitions_target ?? 1));
    const mode = (battle.battle_mode ?? "duel") as "duel" | "ffa" | "teams" | "lanes";
    if (mode === "duel") {
      if (studentIdForLog === battle.left_student_id) {
        return buildAttemptList(battle.left_attempts_list, battle.left_attempts, battle.left_successes).length < target;
      }
      if (studentIdForLog === battle.right_student_id) {
        return buildAttemptList(battle.right_attempts_list, battle.right_attempts, battle.right_successes).length < target;
      }
      return false;
    }
    const participant = (battle.participants ?? []).find((p) => p.id === studentIdForLog);
    if (!participant) return false;
    return buildAttemptList(participant.attempts_list, participant.attempts, participant.successes).length < target;
  }

  function applyOptimisticBattleAttempt(
    rows: BattleRow[],
    battleId: string,
    studentIdForLog: string,
    success: boolean
  ) {
    return rows.map((battle) => {
      if (battle.id !== battleId) return battle;
      const target = Math.max(1, Number(battle.repetitions_target ?? 1));
      const mode = (battle.battle_mode ?? "duel") as "duel" | "ffa" | "teams" | "lanes";
      if (mode === "duel") {
        if (studentIdForLog === battle.left_student_id) {
          const nextList = buildAttemptList(battle.left_attempts_list, battle.left_attempts, battle.left_successes);
          if (nextList.length >= target) return battle;
          nextList.push(success);
          return {
            ...battle,
            left_attempts_list: nextList,
            left_attempts: nextList.length,
            left_successes: nextList.filter(Boolean).length,
          };
        }
        if (studentIdForLog === battle.right_student_id) {
          const nextList = buildAttemptList(battle.right_attempts_list, battle.right_attempts, battle.right_successes);
          if (nextList.length >= target) return battle;
          nextList.push(success);
          return {
            ...battle,
            right_attempts_list: nextList,
            right_attempts: nextList.length,
            right_successes: nextList.filter(Boolean).length,
          };
        }
        return battle;
      }
      const nextParticipants = (battle.participants ?? []).map((participant) => {
        if (participant.id !== studentIdForLog) return participant;
        const nextList = buildAttemptList(participant.attempts_list, participant.attempts, participant.successes);
        if (nextList.length >= target) return participant;
        nextList.push(success);
        return {
          ...participant,
          attempts_list: nextList,
          attempts: nextList.length,
          successes: nextList.filter(Boolean).length,
        };
      });
      return { ...battle, participants: nextParticipants };
    });
  }

  async function sendBattleLogAttempt(battleId: string, studentIdForLog: string, success: boolean) {
    const res = await fetch("/api/skill-tracker/battle/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ battle_id: battleId, student_id: studentIdForLog, success }),
    });
    const sj = await safeJson(res);
    const inflight = pendingBattleLogCounts.current.get(battleId) ?? 1;
    const nextInflight = Math.max(0, inflight - 1);
    pendingBattleLogCounts.current.set(battleId, nextInflight);
    if (!sj.ok) {
      await refreshBattles();
      await refreshFeed();
      setFlash(null);
      setMsg(sj.json?.error || "Failed to log battle attempt");
      return;
    }
    if (nextInflight === 0) {
      setTimeout(() => {
        refreshBattles();
        refreshFeed();
      }, 80);
    }
    setFlash(null);
  }

  async function undoBattleAttempt(battleId: string, studentIdForLog: string) {
    setMsg("");
    const res = await fetch("/api/skill-tracker/battle/undo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ battle_id: battleId, student_id: studentIdForLog }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) {
      return setMsg(sj.json?.error || "Failed to undo battle attempt");
    }
    await refreshBattles();
    await refreshFeed();
  }

  async function openHistory(t: TrackerRow) {
    setMsg("");
    const res = await fetch(`/api/skill-tracker/logs?tracker_id=${encodeURIComponent(t.id)}&limit=7`, {
      cache: "no-store",
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to load history");
    setHistoryTracker(t);
    setHistoryLogs((sj.json?.logs ?? []) as HistoryLog[]);
    setHistoryOpen(true);
  }

  async function openRepLogs(entry: HistoryLog) {
    if (entry.is_battle) return;
    setRepTitle(`${entry.skill_name ?? "Skill"} • ${new Date(entry.created_at).toLocaleString()}`);
    const res = await fetch(`/api/skill-tracker/rep-logs?tracker_id=${encodeURIComponent(entry.id)}`);
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to load reps");
    setRepLogs((sj.json?.logs ?? []) as RepLog[]);
    setRepLogsOpen(true);
  }

  async function openHistoryAll() {
    if (!studentId) return;
    setMsg("");
    const res = await fetch("/api/skill-tracker/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId, limit: 12 }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to load history");
    setHistoryAllLogs((sj.json?.history ?? []) as HistoryLog[]);
    setHistoryAllOpen(true);
  }

  function requestCloseHistory() {
    setHistoryOpen(false);
    setHistoryTracker(null);
    setHistoryLogs([]);
  }

  function requestRemoveTracker(t: TrackerRow) {
    const incomplete = t.attempts < t.repetitions_target;
    setConfirmMsg(incomplete ? "This tracker is incomplete. Remove it anyway?" : "Remove this tracker?");
    setConfirmAction(() => async () => {
      const res = await fetch("/api/skill-tracker/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracker_id: t.id }),
      });
      const sj = await safeJson(res);
      if (!sj.ok) {
        setMsg(sj.json?.error || "Failed to remove tracker");
        return;
      }
      await refreshTrackers();
    });
    setConfirmOpen(true);
  }

  function openCompare() {
    setCompareSkillSearch("");
    setCompareSkillId((prev) => prev || skills[0]?.id || "");
    setCompareStudentIds((prev) => (prev.length ? prev : studentId ? [studentId] : []));
    setCompareOpen(true);
  }

  async function runCompare() {
    if (!compareSkillId || compareStudentIds.length < 1) return;
    setMsg("");
    const res = await fetch("/api/skill-tracker/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_ids: compareStudentIds, skill_id: compareSkillId, limit: 30 }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to compare");
    setCompareSeries((sj.json?.series ?? []) as CompareSeries[]);
  }

  function addCompareStudent(id: string) {
    const next = String(id ?? "").trim();
    if (!next) return;
    setCompareStudentIds((prev) => (prev.includes(next) ? prev : [...prev, next]));
    setCompareInput("");
  }

  function removeCompareStudent(id: string) {
    setCompareStudentIds((prev) => prev.filter((x) => x !== id));
  }

  function openResult(t: TrackerRow) {
    setResultTracker(t);
    setResultOpen(true);
    playSound("skill_pulse");
  }

  function openBattleResult(b: BattleRow) {
    setBattleResult(b);
    setBattleResultOpen(true);
    if (b.winner_id && !battleWinSounded.current.has(b.id)) {
      playWinnerSound();
      battleWinSounded.current.add(b.id);
    }
  }

  function openBattle() {
    setBattleLeftId(studentId || "");
    setBattleRightId("");
    setBattleLeftQuery(studentId ? getStudentName(studentId) : "");
    setBattleRightQuery("");
    setBattleMode("duel");
    setBattleParticipantIdsState([]);
    setBattleParticipantQuery("");
    setBattleTeamAIds([]);
    setBattleTeamBIds([]);
    setBattleTeamCIds([]);
    setBattleTeamDIds([]);
    setBattleTeamAQuery("");
    setBattleTeamBQuery("");
    setBattleTeamCQuery("");
    setBattleTeamDQuery("");
    setBattleSkillSearch("");
    setBattleSkillId(skills[0]?.id || "");
    setBattleReps(5);
    setBattleWagerOn(false);
    setBattleWagerAmount(10);
    setBattlePointsPerRep(5);
    setBattleLaneCategories([]);
    setBattleLaneAssignments({});
    setBattleLaneSkills({});
    setBattleOpen(true);
  }

  function openRematch(b: BattleRow) {
    const mode = (b.battle_mode ?? "duel") as "duel" | "ffa" | "teams" | "lanes";
    setBattleMode(mode);
    setBattleLeftId(b.left_student_id);
    setBattleRightId(b.right_student_id);
    setBattleLeftQuery(b.left_name ?? getStudentName(b.left_student_id));
    setBattleRightQuery(b.right_name ?? getStudentName(b.right_student_id));
    setBattleParticipantIdsState(b.participant_ids ?? []);
    setBattleParticipantQuery("");
    const metaTeams = Array.isArray(b.battle_meta?.team_ids) ? b.battle_meta?.team_ids : [];
    const metaA = Array.isArray(metaTeams?.[0]) ? metaTeams[0] : [];
    const metaB = Array.isArray(metaTeams?.[1]) ? metaTeams[1] : [];
    const metaC = Array.isArray(metaTeams?.[2]) ? metaTeams[2] : [];
    const metaD = Array.isArray(metaTeams?.[3]) ? metaTeams[3] : [];
    setBattleTeamAIds(metaA.length ? metaA : b.team_a_ids ?? []);
    setBattleTeamBIds(metaB.length ? metaB : b.team_b_ids ?? []);
    setBattleTeamCIds(metaC ?? []);
    setBattleTeamDIds(metaD ?? []);
    setBattleTeamAQuery("");
    setBattleTeamBQuery("");
    setBattleTeamCQuery("");
    setBattleTeamDQuery("");
    setBattleSkillId(b.skill_id);
    setBattleReps(b.repetitions_target || 5);
    setBattleWagerOn(Number(b.wager_amount ?? 0) > 0);
    setBattleWagerAmount(Number(b.wager_amount ?? 0) || 10);
    setBattlePointsPerRep(Math.max(3, Number(b.points_per_rep ?? 5)));
    if (mode === "lanes") {
      const meta = b.battle_meta ?? {};
      const cats = Array.isArray(meta.categories) ? meta.categories : [];
      const assignments = normalizeLaneAssignments(meta.assignments ?? {});
      const catSkills = meta.category_skills ?? {};
      setBattleLaneCategories(cats);
      setBattleLaneAssignments(assignments);
      setBattleLaneSkills(catSkills);
    } else {
      setBattleLaneCategories([]);
      setBattleLaneAssignments({});
      setBattleLaneSkills({});
    }
    setBattleOpen(true);
  }

  async function saveBattle() {
    const participantIds =
      battleMode === "duel"
        ? [battleLeftId, battleRightId].filter(Boolean)
        : battleMode === "teams" || battleMode === "lanes"
        ? Array.from(new Set([...battleTeamAIds, ...battleTeamBIds, ...battleTeamCIds, ...battleTeamDIds]))
        : battleParticipantIdsState;
    let laneAssignmentsForSave = battleLaneAssignments;
    const defaultLaneSkill =
      battleMode === "lanes"
        ? battleLaneSkills[battleLaneCategories[0] ?? ""]?.[0] ?? ""
        : "";
    const effectiveSkillId = battleMode === "lanes" ? battleSkillId || defaultLaneSkill : battleSkillId;
    if (!participantIds.length || !effectiveSkillId) return;
    if (participantIds.length < 2) {
      return setMsg("Battle needs at least 2 students.");
    }
    if ((battleMode === "teams" || battleMode === "lanes") && (!battleTeamAIds.length || !battleTeamBIds.length)) {
      return setMsg("Both teams need at least one student.");
    }
    if (battleMode === "teams") {
      const teamGroups = [battleTeamAIds, battleTeamBIds, battleTeamCIds, battleTeamDIds].filter((t) => t.length);
      if (teamGroups.length < 2) {
        return setMsg("Battle Pulse teams need at least two teams.");
      }
    }
    if (battleMode === "lanes") {
      if (battleTeamAIds.length < 2 || battleTeamBIds.length < 2) {
        return setMsg("Skill Lanes needs at least 2 players per team.");
      }
      if (battleTeamAIds.length !== battleTeamBIds.length) {
        return setMsg("Skill Lanes teams must be the same size.");
      }
      if (battleLaneCategories.length < 1) {
        return setMsg("Select at least 1 category.");
      }
      const allowed = new Set(battleLaneCategories);
      const allIds = new Set([...battleTeamAIds, ...battleTeamBIds]);
      const cleanedAssignments: Record<string, string[]> = {};
      for (const id of allIds) {
        const cats = getAssignedLaneCategories(battleLaneAssignments, id).filter((cat) => allowed.has(cat));
        if (!cats.length) return setMsg("Every player needs at least one category.");
        cleanedAssignments[id] = cats;
      }
      laneAssignmentsForSave = cleanedAssignments;
      const laneSkillMin = Math.max(1, Math.max(battleTeamAIds.length, battleTeamBIds.length) > 3 ? 3 : 1);
      if (!battleLaneCategories.every((cat) => (battleLaneSkills[cat] ?? []).length >= laneSkillMin)) {
        return setMsg(`Each category must have at least ${laneSkillMin} skill${laneSkillMin === 1 ? "" : "s"} selected.`);
      }
    }
    if (battleMode === "ffa" && !battleWagerOn) {
      return setMsg("FFA battles must use wager mode.");
    }
    if (battleMode !== "lanes" && battleWagerInsufficient) {
      return setMsg("All participants need at least 15 points to wager.");
    }
    if (battleMode === "lanes") {
      setBattleWagerOn(false);
      setBattleWagerAmount(0);
    }
    const created_source = isTabletRoute ? "skill_pulse" : undefined;
    const res = await fetch("/api/skill-tracker/battle/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          left_student_id: battleLeftId,
          right_student_id: battleRightId,
          battle_mode: battleMode,
          participant_ids: participantIds,
          team_a_ids: battleMode === "teams" || battleMode === "lanes" ? battleTeamAIds : [],
          team_b_ids: battleMode === "teams" || battleMode === "lanes" ? battleTeamBIds : [],
          team_c_ids: battleMode === "teams" ? battleTeamCIds : [],
          team_d_ids: battleMode === "teams" ? battleTeamDIds : [],
          skill_id: effectiveSkillId,
          repetitions_target: battleReps,
          wager_amount: battleWagerOn ? battleWagerAmount : 0,
          points_per_rep: Math.max(3, battlePointsPerRep),
          battle_meta:
            battleMode === "lanes"
              ? {
                  categories: battleLaneCategories,
                  assignments: laneAssignmentsForSave,
                  category_skills: battleLaneSkills,
                }
              : battleMode === "teams"
                ? {
                    team_ids: [battleTeamAIds, battleTeamBIds, battleTeamCIds, battleTeamDIds].filter((t) => t.length),
                  }
                : null,
          created_source,
        }),
      });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to create battle");
    setBattleOpen(false);
    const createdId = String(sj.json?.battle?.id ?? "");
    if (createdId) setBattleCreateId(createdId);
    setBattleCreateIntro(true);
    playGlobalSfx("battle_pulse_swords");
    if (battleCreateTimer.current) clearTimeout(battleCreateTimer.current);
    battleCreateTimer.current = setTimeout(() => {
      setBattleCreateIntro(false);
      setBattleCreateId(null);
    }, 1600);
    await refreshBattles();
    await refreshFeed();
  }

  function requestSaveBattle() {
    if (battleWagerAllIn) {
      setConfirmMsg("This is an all-in wager for at least one student. Start Battle Pulse anyway?");
      setConfirmAction(() => async () => {
        await saveBattle();
      });
      setConfirmOpen(true);
      return;
    }
    saveBattle();
  }

  async function removeBattle(battleId: string) {
    const res = await fetch("/api/skill-tracker/battle/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ battle_id: battleId }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to remove battle");
    await refreshBattles();
    await refreshFeed();
  }

  async function settleBattle(battleId: string) {
    if (!battleId) return;
    setMsg("");
    const res = await fetch("/api/skill-tracker/battle/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ battle_id: battleId }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) {
      setMsg(sj.json?.error || "Failed to settle battle");
      return;
    }
    await refreshBattles();
    await refreshFeed();
  }

  function queueAutoSettle(battlesToCheck: BattleRow[]) {
    battlesToCheck.forEach((b) => {
      if (b.settled_at) return;
      const participants = b.participants ?? [];
      if (!participants.length) return;
      const target = Number(b.repetitions_target ?? 0);
      if (target <= 0) return;
      const allDone = participants.every((p) => Number(p.attempts ?? 0) >= target);
      if (!allDone) return;
      if (autoSettleInFlight.current.has(b.id)) return;
      autoSettleInFlight.current.add(b.id);
      settleBattle(b.id).finally(() => {
        autoSettleInFlight.current.delete(b.id);
      });
    });
  }

  const skillsByCategory = useMemo(() => {
    const map = new Map<string, SkillRow[]>();
    for (const s of skills) {
      const key = s.category ?? "Other";
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [skills]);

  const skillNameById = useMemo(() => {
    const map = new Map<string, string>();
    skills.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [skills]);

  const matchesSkillQuery = useCallback((skill: SkillRow, query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const haystack = [
      skill.name,
      skill.base_name,
      skill.quality,
      skill.supplement,
      skill.landing,
      skill.rotation,
      skill.category,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  }, []);

  const filterSkillsByCategory = useCallback(
    (query: string) => {
      const q = query.trim().toLowerCase();
      if (!q) return skillsByCategory;
      return skillsByCategory
        .map(([cat, rows]) => [cat, rows.filter((s) => matchesSkillQuery(s, q))] as const)
        .filter(([, rows]) => rows.length);
    },
    [skillsByCategory, matchesSkillQuery]
  );

  const filteredFormSkillsByCategory = useMemo(
    () => filterSkillsByCategory(formSkillSearch),
    [filterSkillsByCategory, formSkillSearch]
  );
  const filteredGroupSkillsByCategory = useMemo(
    () => filterSkillsByCategory(groupSkillSearch),
    [filterSkillsByCategory, groupSkillSearch]
  );
  const filteredBattleSkillsByCategory = useMemo(
    () => filterSkillsByCategory(battleSkillSearch),
    [filterSkillsByCategory, battleSkillSearch]
  );
  const filteredCompareSkills = useMemo(
    () => filterSkillsByCategory(compareSkillSearch).flatMap(([, rows]) => rows),
    [filterSkillsByCategory, compareSkillSearch]
  );

  const groupedItems = useMemo(() => {
    if (isTabletRoute) {
      return trackers.map((t) => ({ type: "single" as const, tracker: t }));
    }
    const groupMap = new Map<string, TrackerRow[]>();
    for (const t of trackers) {
      if (!t.group_id) continue;
      const gid = String(t.group_id);
      groupMap.set(gid, [...(groupMap.get(gid) ?? []), t]);
    }

    const seen = new Set<string>();
    const items: Array<
      | { type: "group"; group_id: string; trackers: TrackerRow[] }
      | { type: "single"; tracker: TrackerRow }
    > = [];

    for (const t of trackers) {
      if (t.group_id) {
        const gid = String(t.group_id);
        if (seen.has(gid)) continue;
        seen.add(gid);
        items.push({ type: "group", group_id: gid, trackers: groupMap.get(gid) ?? [] });
      } else {
        items.push({ type: "single", tracker: t });
      }
    }
    return items;
  }, [trackers, isTabletRoute]);

  const formStudentSuggestions = studentSuggestions(formStudentQuery);
  const showFormStudentSuggestions =
    !editTrackerId && formStudentSuggestions.length > 0 && !hasExactStudentMatch(formStudentQuery);
  const battleLeftSuggestions = studentSuggestions(battleLeftQuery, [battleRightId].filter(Boolean));
  const battleRightSuggestions = studentSuggestions(battleRightQuery, [battleLeftId].filter(Boolean));
  const battleParticipantSuggestions = studentSuggestions(battleParticipantQuery, battleParticipantIdsState);
  const battleTeamTakenIds = Array.from(new Set([...battleTeamAIds, ...battleTeamBIds, ...battleTeamCIds, ...battleTeamDIds]));
  const battleTeamASuggestions = studentSuggestions(battleTeamAQuery, battleTeamTakenIds);
  const battleTeamBSuggestions = studentSuggestions(battleTeamBQuery, battleTeamTakenIds);
  const battleTeamCSuggestions = studentSuggestions(battleTeamCQuery, battleTeamTakenIds);
  const battleTeamDSuggestions = studentSuggestions(battleTeamDQuery, battleTeamTakenIds);

  const allFailureReasons = useMemo(() => {
    const set = new Set<string>();
    trackers.forEach((t) => {
      (t.failure_reasons ?? []).forEach((r) => {
        const clean = String(r ?? "").trim();
        if (clean) set.add(clean);
      });
    });
    customReasons.forEach((r) => {
      const clean = String(r ?? "").trim();
      if (clean) set.add(clean);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [trackers, customReasons]);
  const showBattleLeftSuggestions = battleLeftSuggestions.length > 0 && !hasExactStudentMatch(battleLeftQuery);
  const showBattleRightSuggestions = battleRightSuggestions.length > 0 && !hasExactStudentMatch(battleRightQuery);
  const showBattleParticipantSuggestions = battleParticipantSuggestions.length > 0 && !hasExactStudentMatch(battleParticipantQuery);
  const showBattleTeamASuggestions = battleTeamASuggestions.length > 0 && !hasExactStudentMatch(battleTeamAQuery);
  const showBattleTeamBSuggestions = battleTeamBSuggestions.length > 0 && !hasExactStudentMatch(battleTeamBQuery);
  const showBattleTeamCSuggestions = battleTeamCSuggestions.length > 0 && !hasExactStudentMatch(battleTeamCQuery);
  const showBattleTeamDSuggestions = battleTeamDSuggestions.length > 0 && !hasExactStudentMatch(battleTeamDQuery);
  const battleParticipantIds =
    battleMode === "duel"
      ? [battleLeftId, battleRightId].filter(Boolean)
      : battleMode === "teams" || battleMode === "lanes"
      ? Array.from(new Set([...battleTeamAIds, ...battleTeamBIds, ...battleTeamCIds, ...battleTeamDIds]))
      : battleParticipantIdsState;
  const battleLeftBalance = students.find((s) => s.id === battleLeftId)?.points_total ?? 0;
  const battleRightBalance = students.find((s) => s.id === battleRightId)?.points_total ?? 0;
  const battleMinBalance =
    battleParticipantIds.length > 0
      ? Math.min(...battleParticipantIds.map((id) => students.find((s) => s.id === id)?.points_total ?? 0))
      : 0;
  const battleNormalMaxPerRep = battleMinBalance > 0 ? Math.floor(battleMinBalance / Math.max(1, battleReps)) : 0;
  const battleMinWager = 15;
  const battleMaxWager = 100;
  const battleWagerInsufficient =
    battleWagerOn &&
    battleParticipantIds.length > 0 &&
    battleParticipantIds.some((id) => (students.find((s) => s.id === id)?.points_total ?? 0) < battleMinWager);
  const battleWagerAllIn = battleWagerOn && battleMinBalance > 0 && battleWagerAmount >= battleMinBalance;
  const battleWagerOverMax = battleWagerOn && battleWagerAmount > battleMaxWager;
  const battleWagerTooLow = battleWagerOn && battleWagerAmount > 0 && battleWagerAmount < battleMinWager;
  const battleNormalInsufficient =
    !battleWagerOn && (!!battleLeftId || !!battleRightId) && battleNormalMaxPerRep > 0 && battleNormalMaxPerRep < 3;
  const laneSkillMin = Math.max(1, Math.max(battleTeamAIds.length, battleTeamBIds.length) > 3 ? 3 : 1);
  const laneAssignmentsComplete = (() => {
    if (battleMode !== "lanes") return true;
    const ids = [...battleTeamAIds, ...battleTeamBIds];
    return ids.every((id) => getAssignedLaneCategories(battleLaneAssignments, id).length > 0);
  })();
  const laneSkillsValid = (() => {
    if (battleMode !== "lanes") return true;
    if (battleLaneCategories.length < 1) return false;
    return battleLaneCategories.every((cat) => (battleLaneSkills[cat] ?? []).length >= laneSkillMin);
  })();
  const laneCategoryCountsValid = (() => {
    if (battleMode !== "lanes") return true;
    if (battleLaneCategories.length < 1) return false;
    if (battleTeamAIds.length < 2 || battleTeamBIds.length < 2) return false;
    if (battleTeamAIds.length !== battleTeamBIds.length) return false;
    const allowed = new Set(battleLaneCategories);
    const ids = [...battleTeamAIds, ...battleTeamBIds];
    if (
      ids.some((id) =>
        getAssignedLaneCategories(battleLaneAssignments, id).some((cat) => !allowed.has(cat))
      )
    )
      return false;
    return true;
  })();
  const laneErrors =
    battleMode === "lanes"
      ? buildLaneErrors({
          teamAIds: battleTeamAIds,
          teamBIds: battleTeamBIds,
          categories: battleLaneCategories,
          assignmentsComplete: laneAssignmentsComplete,
          skillsValid: laneSkillsValid,
          countsValid: laneCategoryCountsValid,
          skillMin: laneSkillMin,
        })
      : [];

  const canAssignLaneCategory = useCallback(
    (_teamIds: string[], _playerId: string, cat: string) => {
      if (!cat || !battleLaneCategories.includes(cat)) return false;
      return true;
    },
    [battleLaneCategories]
  );
  const battleParticipantInvalid =
    battleParticipantIds.length < 2 ||
    (battleMode === "duel" && (!battleLeftId || !battleRightId)) ||
    ((battleMode === "teams" || battleMode === "lanes") && (!battleTeamAIds.length || !battleTeamBIds.length)) ||
    (battleMode === "lanes" && (!laneAssignmentsComplete || !laneCategoryCountsValid || !laneSkillsValid));
  const battleCreateDisabled =
    battleParticipantInvalid ||
    (battleMode !== "lanes" && battleWagerInsufficient) ||
    (battleMode !== "lanes" && battleWagerTooLow) ||
    (battleMode !== "lanes" && battleWagerOn && battleWagerAmount <= 0) ||
    (battleMode !== "lanes" && battleNormalInsufficient);

  useEffect(() => {
    if (battleWagerOn) return;
    if (battleNormalMaxPerRep >= 3) {
      setBattlePointsPerRep((prev) => Math.max(3, Math.min(battleNormalMaxPerRep, prev)));
    }
  }, [battleWagerOn, battleNormalMaxPerRep]);

  useEffect(() => {
    if (battleMode === "ffa" && !battleWagerOn) {
      setBattleWagerOn(true);
    }
  }, [battleMode, battleWagerOn]);

  useEffect(() => {
    if (battleMode !== "lanes") {
      setBattleLaneCategories([]);
      setBattleLaneAssignments({});
      setBattleLaneSkills({});
    }
  }, [battleMode]);

  const particlesInit = useCallback(async (engine: Engine) => {
    await loadSlim(engine);
  }, []);

  const battleParticlesOptions = useMemo(
    () => ({
      fullScreen: { enable: false },
      fpsLimit: 60,
      background: { color: { value: "transparent" } },
      particles: {
        number: { value: 26, density: { enable: true, area: 600 } },
        color: { value: ["#facc15", "#38bdf8", "#f97316"] },
        shape: { type: ["circle", "star"] },
        opacity: { value: 0.6, animation: { enable: true, speed: 0.6, minimumValue: 0.2 } },
        size: { value: { min: 1, max: 3 } },
        move: { enable: true, speed: 0.4, direction: "top", outModes: { default: "out" } },
        shadow: { enable: true, color: "#facc15", blur: 4 },
      },
      interactivity: {
        events: { onHover: { enable: false }, onClick: { enable: false }, resize: true },
      },
      detectRetina: true,
    }),
    []
  );

  useEffect(() => {
    if (!battles.length) return;
    setBattleTurnState((prev) => {
      let changed = false;
      const next = { ...prev };
      battles.forEach((b) => {
        if ((b.battle_mode ?? "duel") !== "lanes") return;
        if (next[b.id]?.order?.length) return;
        const meta = b.battle_meta ?? {};
        const assignments = meta.assignments ?? {};
        const categories = Array.isArray(meta.categories) ? meta.categories : [];
        const teamAIds = b.team_a_ids ?? [];
        const teamBIds = b.team_b_ids ?? [];
        if (!categories.length || !teamAIds.length || !teamBIds.length) return;
        const order: string[] = [];
        categories.forEach((cat: string) => {
          const aIds = teamAIds.filter((id) => getPrimaryLaneCategory(assignments, id) === cat);
          const bIds = teamBIds.filter((id) => getPrimaryLaneCategory(assignments, id) === cat);
          const max = Math.max(aIds.length, bIds.length);
          for (let i = 0; i < max; i += 1) {
            if (aIds[i]) order.push(aIds[i]);
            if (bIds[i]) order.push(bIds[i]);
          }
        });
        if (!order.length) return;
        next[b.id] = { order, index: 0, mode: "lanes" };
        changed = true;
      });
      return changed ? next : prev;
    });
  }, [battles]);

  const cryptoRand = useCallback((max: number) => {
    if (max <= 0) return 0;
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] % max;
  }, []);

  const shuffleList = useCallback(
    <T,>(list: T[]) => {
      const copy = [...list];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = cryptoRand(i + 1);
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
    [cryptoRand]
  );

  const setTurnOrderForBattle = useCallback(
    (battle: BattleRow, mode: "duel" | "ffa" | "teams" | "lanes", order: string[], label?: string) => {
      setBattleTurnState((prev) => ({
        ...prev,
        [battle.id]: {
          order,
          index: 0,
          mode,
          label,
        },
      }));
    },
    []
  );

  const nextBattleTurn = useCallback((battleId: string, order?: string[]) => {
    setBattleTurnState((prev) => {
      const current = prev[battleId];
      const activeOrder = order ?? current?.order ?? [];
      if (!activeOrder.length || activeOrder.length <= 1) return prev;
      const nextIndex = ((current?.index ?? 0) + 1) % activeOrder.length;
      return {
        ...prev,
        [battleId]: {
          order: activeOrder,
          index: nextIndex,
          mode: current?.mode ?? "duel",
          label: current?.label,
        },
      };
    });
  }, []);

  const isTabletMode = isTabletRoute;
  const avatarContextKey = isTabletMode ? "skill_pulse_tracker" : "skill_pulse";
  const cornerOffsets = {
    x: Number((cornerPositionSettings as any)?.[`${avatarContextKey}_x`] ?? -10),
    y: Number((cornerPositionSettings as any)?.[`${avatarContextKey}_y`] ?? -10),
    size: Number((cornerPositionSettings as any)?.[`${avatarContextKey}_size`] ?? 72),
  };
  const plateOffsets = {
    x: Number((cardPlatePositionSettings as any)?.[`${avatarContextKey}_x`] ?? 0),
    y: Number((cardPlatePositionSettings as any)?.[`${avatarContextKey}_y`] ?? 0),
    size: Number((cardPlatePositionSettings as any)?.[`${avatarContextKey}_size`] ?? 200),
  };

  if (studentBlocked) {
    return (
      <main style={{ padding: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Skill Pulse access only.</div>
        <div style={{ opacity: 0.7, marginTop: 6 }}>
          This login can only use Skill Pulse with approved accounts.
        </div>
      </main>
    );
  }

  return (
    <>
      {battleCreateIntro ? (
        <div className="battle-open-intro battle-open-intro-global">
          <div className="battle-open-glow" />
          <div className="battle-open-sword left" />
          <div className="battle-open-sword right" />
          <div className="battle-open-label">Battle Pulse</div>
        </div>
      ) : null}
      <main>
      <div style={{ display: "grid", gridTemplateColumns: isTabletMode ? "1fr" : "1fr 210px", gap: 16, alignItems: "start", marginTop: 12 }}>
        <div>
          <div style={headerSticky()}>
          {isTabletMode ? (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ fontSize: 28, fontWeight: 1000 }}>Skill Pulse</div>
                <div style={{ display: "flex", gap: 12 }}>
                  <a href="/login" style={{ fontWeight: 900, textDecoration: "none", opacity: 0.85 }}>
                    Log in
                  </a>
                  <a href="/logout" style={{ fontWeight: 900, textDecoration: "none", opacity: 0.85 }}>
                    Log out
                  </a>
                </div>
              </div>
              <button
                onClick={() => setTabletCreateOpen((prev) => !prev)}
                style={{
                  padding: "18px 22px",
                  borderRadius: 22,
                  background: "linear-gradient(135deg, rgba(56,189,248,0.85), rgba(34,197,94,0.85))",
                  border: "1px solid rgba(255,255,255,0.25)",
                  color: "#fff",
                  fontSize: 20,
                  fontWeight: 1000,
                  boxShadow: "0 18px 40px rgba(15,23,42,0.25)",
                }}
              >
                + Create Tracker
              </button>
              {tabletCreateOpen ? (
                <div
                  style={{
                    padding: 14,
                    borderRadius: 18,
                    background: "rgba(15,23,42,0.6)",
                    border: "1px solid rgba(148,163,184,0.25)",
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div style={{ fontWeight: 900, fontSize: 14, opacity: 0.8 }}>Choose a tracker type</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    <button
                      onClick={() => {
                        setTabletCreateOpen(false);
                        openCreate();
                      }}
                      style={btn()}
                    >
                      Individual Tracker
                    </button>
                    <button
                      onClick={() => {
                        setTabletCreateOpen(false);
                        openGroup();
                      }}
                      style={groupBtn()}
                    >
                      Group Tracker
                    </button>
                    <button
                      onClick={() => {
                        setTabletCreateOpen(false);
                        openBattle();
                      }}
                      style={battlePulseBtn()}
                    >
                      Battle Pulse Tracker
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 26, fontWeight: 1000 }}>Skill Pulse Tracker</div>
                <div style={{ opacity: 0.75, fontSize: 13, fontWeight: 900 }}>
                  Tap ✓ or ✕ to record each rep. Click a card to edit skill + reps.
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={() => setClearOpen(true)} style={clearBtn()}>
                  🧹 Clear
                </button>
                <button onClick={openBattle} style={battlePulseBtn()}>
                  ⚔️ Battle Pulse
                </button>
                <a href="/admin/skill-strike" style={skillStrikeBtn()}>
                  🎴 Skill Strike
                </a>
                <button onClick={openGroup} style={groupBtn()}>
                  👥 Group Tracker
                </button>
                <button onClick={openCompare} style={compareBtn()}>
                  📈 Compare Quest
                </button>
                <button onClick={openCreate} style={btn()}>
                  + Add Tracker
                </button>
              </div>
            </div>
          )}
          </div>

        {msg ? (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 18,
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(255,255,255,0.10)",
              boxShadow: "0 18px 50px rgba(0,0,0,0.25)",
              fontWeight: 900,
            }}
          >
            {msg}
          </div>
        ) : null}

      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: isTabletMode ? "repeat(3, minmax(0, 1fr))" : "repeat(2, minmax(0, 1fr))",
          gridAutoFlow: "row dense",
          gap: 18,
        }}
      >
        {battles.map((b) => {
          const isMulti = (b.battle_mode ?? "duel") !== "duel";
          if (isMulti) {
            const participants = b.participants ?? [];
            const battleMode = (b.battle_mode ?? "duel") as "duel" | "ffa" | "teams" | "lanes";
            const seedTeamA = b.team_a_ids ?? [];
            const seedTeamB = b.team_b_ids ?? [];
            let teamAIds = seedTeamA.length
              ? seedTeamA
              : participants.slice(0, Math.max(1, Math.ceil(participants.length / 2))).map((p) => p.id);
            let teamBIds = seedTeamB.length
              ? seedTeamB
              : participants.filter((p) => !teamAIds.includes(p.id)).map((p) => p.id);
            const metaTeamsRaw = Array.isArray(b.battle_meta?.team_ids) ? (b.battle_meta?.team_ids as any[]) : [];
            const metaTeams = metaTeamsRaw
              .map((team) => (Array.isArray(team) ? team.map((id) => String(id ?? "").trim()).filter(Boolean) : []))
              .filter((team) => team.length);
            const teamGroups = battleMode === "teams" && metaTeams.length ? metaTeams : [teamAIds, teamBIds].filter((t) => t.length);
            if (battleMode === "teams" && teamGroups.length) {
              teamAIds = teamGroups[0] ?? [];
              teamBIds = teamGroups[1] ?? [];
            }
            const teamA = participants.filter((p) => teamAIds.includes(p.id));
            const teamB = participants.filter((p) => teamBIds.includes(p.id));
            const teamKeys = ["a", "b", "c", "d"] as const;
            const teamStats = teamGroups.map((ids, idx) => {
              const key = teamKeys[idx] ?? "a";
              const members = participants.filter((p) => ids.includes(p.id));
              const attempts = members.reduce((sum, p) => sum + (p.attempts_list?.length ?? 0), 0);
              const successes = members.reduce((sum, p) => sum + Number(p.successes ?? 0), 0);
              const remaining = Math.max(0, Number(b.repetitions_target ?? 0) * members.length - attempts);
              const potential = successes + remaining;
              const fails = Math.max(0, attempts - successes);
              return {
                key,
                label: `Team ${key.toUpperCase()}`,
                ids,
                members,
                attempts,
                successes,
                remaining,
                potential,
                fails,
              };
            });
            const teamASuccesses = teamA.reduce((sum, p) => sum + Number(p.successes ?? 0), 0);
            const teamBSuccesses = teamB.reduce((sum, p) => sum + Number(p.successes ?? 0), 0);
            const teamADone = teamA.reduce((sum, p) => sum + (p.attempts_list?.length ?? 0), 0);
            const teamBDone = teamB.reduce((sum, p) => sum + (p.attempts_list?.length ?? 0), 0);
            const teamARemaining = Math.max(0, Number(b.repetitions_target ?? 0) * teamA.length - teamADone);
            const teamBRemaining = Math.max(0, Number(b.repetitions_target ?? 0) * teamB.length - teamBDone);
            const teamAPotential = teamASuccesses + teamARemaining;
            const teamBPotential = teamBSuccesses + teamBRemaining;
            const teamAFails = Math.max(0, teamADone - teamASuccesses);
            const teamBFails = Math.max(0, teamBDone - teamBSuccesses);
            const done = participants.length > 0 && participants.every((p) => (p.attempts_list?.length ?? 0) >= b.repetitions_target);
            const isSettled = Boolean(b.settled_at);
            const teamHp = (team: typeof teamA, otherTeam: typeof teamB) => {
              const target = Math.max(1, Number(b.repetitions_target ?? 1));
              const teamSuccesses = team.reduce((sum, p) => sum + Number(p.successes ?? 0), 0);
              const otherSuccesses = otherTeam.reduce((sum, p) => sum + Number(p.successes ?? 0), 0);
              const teamAttempts = team.reduce((sum, p) => sum + (p.attempts_list?.length ?? 0), 0);
              const otherAttempts = otherTeam.reduce((sum, p) => sum + (p.attempts_list?.length ?? 0), 0);
              const total = Math.max(1, target * team.length);
              const otherTotal = Math.max(1, target * otherTeam.length);
              const remaining = Math.max(0, total - teamAttempts);
              const otherRemaining = Math.max(0, otherTotal - otherAttempts);
              const hpRaw = teamSuccesses + remaining - otherSuccesses;
              const tiePossible = teamSuccesses + remaining >= otherSuccesses && otherSuccesses + otherRemaining >= teamSuccesses;
              const hp = hpRaw <= 0 && tiePossible ? 1 : Math.max(0, hpRaw);
              return hp;
            };
            const teamHpA = teamHp(teamA, teamB);
            const teamHpB = teamHp(teamB, teamA);
            const liveWinnerLabel = (() => {
              if (battleMode === "teams" && teamGroups.length > 2) {
                const sorted = [...teamStats].sort((a, b) => b.successes - a.successes);
                if (sorted.length < 2 || sorted[0].successes === sorted[1].successes) return "";
                return sorted[0].label;
              }
              return teamHpA <= 0 && teamHpB > 0 ? "Team B" : teamHpB <= 0 && teamHpA > 0 ? "Team A" : "";
            })();
            const flashType = flash?.id === b.id ? flash.type : null;
            const mvpIds = Array.isArray(b.mvp_ids) ? b.mvp_ids.map(String) : [];
            const turnState = battleTurnState[b.id];
            const currentTurnId = turnState?.order?.[turnState.index] ?? "";
            const turnOrderNames = (turnState?.order ?? [])
              .map((id) => participants.find((p) => p.id === id)?.name ?? "Student")
              .join(" → ");
            const coinLabel = battleCoinState[b.id]?.label ?? "";
            function flipCoin() {
              if (battleMode === "teams") {
                const teamCount = Math.max(2, teamGroups.length || 2);
                const startIndex = cryptoRand(teamCount);
                const label = `Team ${teamKeys[startIndex]?.toUpperCase() ?? "A"} starts`;
                setBattleCoinState((prev) => ({ ...prev, [b.id]: { label, at: Date.now() } }));
                return;
              }
              if (battleMode === "lanes") {
                const start = cryptoRand(2) === 0 ? "Team A" : "Team B";
                setBattleCoinState((prev) => ({ ...prev, [b.id]: { label: `${start} starts`, at: Date.now() } }));
                return;
              }
              if (participants.length) {
                const pick = participants[cryptoRand(participants.length)];
                const name = pick?.name ?? "Player";
                setBattleCoinState((prev) => ({ ...prev, [b.id]: { label: `${name} starts`, at: Date.now() } }));
              }
            }
            function pickTurnOrder() {
              if (!participants.length) return;
              if (battleMode === "ffa") {
                const order = shuffleList(participants.map((p) => p.id));
                setTurnOrderForBattle(b, "ffa", order, "Order set");
                setBattleCoinState((prev) => ({ ...prev, [b.id]: { label: "Turn order set", at: Date.now() } }));
                return;
              }
              if (battleMode === "teams" || battleMode === "lanes") {
                const startTeam = cryptoRand(2) === 0 ? "a" : "b";
                const order: string[] = [];
                if (battleMode === "lanes") {
                  const meta = b.battle_meta ?? {};
                  const assignments = meta.assignments ?? {};
                  const categories = Array.isArray(meta.categories) ? meta.categories : [];
                  categories.forEach((cat: string) => {
                    const aIds = teamAIds.filter((id) => getPrimaryLaneCategory(assignments, id) === cat);
                    const bIds = teamBIds.filter((id) => getPrimaryLaneCategory(assignments, id) === cat);
                    const max = Math.max(aIds.length, bIds.length);
                    for (let i = 0; i < max; i += 1) {
                      if (startTeam === "a") {
                        if (aIds[i]) order.push(aIds[i]);
                        if (bIds[i]) order.push(bIds[i]);
                      } else {
                        if (bIds[i]) order.push(bIds[i]);
                        if (aIds[i]) order.push(aIds[i]);
                      }
                    }
                  });
                } else {
                  const teamsForOrder = teamGroups.length ? teamGroups : [teamAIds, teamBIds].filter((t) => t.length);
                  const teamOrders = teamsForOrder.map((ids) => shuffleList(ids));
                  const maxLen = Math.max(0, ...teamOrders.map((list) => list.length));
                  const startIndex = startTeam === "a" ? 0 : 1;
                  for (let i = 0; i < maxLen; i += 1) {
                    for (let t = 0; t < teamOrders.length; t += 1) {
                      const idx = (startIndex + t) % teamOrders.length;
                      const pick = teamOrders[idx]?.[i];
                      if (pick) order.push(pick);
                    }
                  }
                }
                setTurnOrderForBattle(
                  b,
                  battleMode,
                  order,
                  `${startTeam === "a" ? "Team A" : "Team B"} starts`
                );
                setBattleCoinState((prev) => ({
                  ...prev,
                  [b.id]: { label: `${startTeam === "a" ? "Team A" : "Team B"} starts`, at: Date.now() },
                }));
              }
            }
            const pointsDeltaById = new Map<string, number>(
              Object.entries(b.points_delta_by_id ?? {}).map(([key, value]) => [String(key), Number(value)])
            );
            const pointsDeltaSummary = Array.from(pointsDeltaById.entries())
              .map(([id, delta]) => {
                const name = participants.find((p) => p.id === id)?.name ?? "Student";
                const sign = delta > 0 ? "+" : "";
                return `${name} ${sign}${delta}`;
              })
              .join(" • ");
            const debugLaneData = !isTabletMode
              ? {
                  id: b.id,
                  battle_mode: b.battle_mode,
                  repetitions_target: b.repetitions_target,
                  wager_amount: b.wager_amount,
                  points_per_rep: b.points_per_rep,
                  settled_at: b.settled_at,
                  winner_id: b.winner_id,
                  team_a_ids: teamAIds,
                  team_b_ids: teamBIds,
                  participant_ids: participants.map((p) => p.id),
                  participant_stats: participants.map((p) => ({
                    id: p.id,
                    name: p.name,
                    attempts: p.attempts,
                    successes: p.successes,
                  })),
                  mvp_ids: mvpIds,
                  points_delta_by_id: Object.fromEntries(pointsDeltaById.entries()),
                }
              : null;
            if (b.battle_mode === "lanes") {
              const meta = b.battle_meta ?? {};
              const assignments = meta.assignments ?? {};
              const laneCats = Array.isArray(meta.categories) ? meta.categories : [];
                      const teamAOrdered = teamAIds.map((id) => teamA.find((p) => p.id === id)).filter(Boolean) as typeof teamA;
                      const teamBOrdered = teamBIds.map((id) => teamB.find((p) => p.id === id)).filter(Boolean) as typeof teamB;
              const scoreFromParticipant = (p: BattleRow["participants"][number]) => {
                const attemptsCount = p.attempts_list?.length ?? (p.attempts ?? 0);
                const successesCount = typeof p.successes === "number" ? p.successes : p.attempts_list?.filter((v) => v).length ?? 0;
                return { attemptsCount, successesCount };
              };
              const deriveOrder = () => {
                if (turnState?.order?.length) return turnState.order;
                const order: string[] = [];
                laneCats.forEach((cat: string) => {
                  const aIds = teamAIds.filter((id) => getPrimaryLaneCategory(assignments, id) === cat);
                  const bIds = teamBIds.filter((id) => getPrimaryLaneCategory(assignments, id) === cat);
                  const max = Math.max(aIds.length, bIds.length);
                  for (let i = 0; i < max; i += 1) {
                    if (aIds[i]) order.push(aIds[i]);
                    if (bIds[i]) order.push(bIds[i]);
                  }
                });
                return order.length ? order : [...teamAIds, ...teamBIds];
              };
              const deriveMvpIds = () => {
                if (mvpIds.length) return mvpIds;
                if (!done) return [];
                const pickTeamMvp = (ids: string[]) => {
                  const eligible = teamAOrdered
                    .concat(teamBOrdered)
                    .filter((p) => ids.includes(p.id))
                    .map((p) => {
                      const attempts = p.attempts_list?.length ?? Number(p.attempts ?? 0);
                      const successes = Number(p.successes ?? 0);
                      const rate = attempts > 0 ? successes / attempts : 0;
                      return { id: p.id, successes, rate };
                    })
                    .filter((row) => row.rate >= 0.6 && row.successes > 0);
                  if (!eligible.length) return [];
                  const top = Math.max(...eligible.map((row) => row.successes));
                  return eligible.filter((row) => row.successes === top).map((row) => row.id);
                };
                return [...pickTeamMvp(teamAIds), ...pickTeamMvp(teamBIds)];
              };
              const laneMvpIds = deriveMvpIds();
              const buildLaneSuccessColors = (teamKey: "a" | "b", teamList: typeof teamAOrdered) => {
                const order = deriveOrder();
                const maxSegments = teamList.length * Math.max(1, Number(b.repetitions_target ?? 1));
                const successColors: string[] = [];
                const attemptIndex = new Map<string, number>();
                let guard = 0;
                while (successColors.length < maxSegments && guard < maxSegments * 8) {
                  guard += 1;
                  let progressed = false;
                  for (const pid of order) {
                    const teamForPlayer = teamAIds.includes(pid) ? "a" : teamBIds.includes(pid) ? "b" : null;
                    if (teamForPlayer !== teamKey) continue;
                    const p = teamList.find((x) => x.id === pid);
                    if (!p) continue;
                    const idx = attemptIndex.get(pid) ?? 0;
                    const attemptsList = p.attempts_list ?? [];
                    if (idx >= attemptsList.length) continue;
                    const success = attemptsList[idx] === true;
                    attemptIndex.set(pid, idx + 1);
                    if (success) {
                      const assignedCats = getAssignedLaneCategories(assignments, pid);
                      const primaryCat = assignedCats[0] ?? "Category";
                      const pool = buildLaneSkillPool(meta.category_skills, assignedCats);
                      const pick = pool.length ? pool[idx % pool.length] : null;
                      const cat = pick?.cat ?? primaryCat;
                      successColors.push(laneColor(cat, laneCats));
                    }
                    progressed = true;
                    if (successColors.length >= maxSegments) break;
                  }
                  if (!progressed) break;
                }
                return { colors: successColors, total: maxSegments };
              };
              const renderLaneRow = (teamKey: "a" | "b", teamList: typeof teamAOrdered) => {
                const built = buildLaneSuccessColors(teamKey, teamList);
                return (
                  <div className={`lane-row lane-row-${teamKey}`}>
                    {Array.from({ length: built.total }).map((_, idx) => {
                      const color = built.colors[idx];
                      const filled = Boolean(color);
                      const flashActive =
                        laneSuccessPulse?.battleId === b.id &&
                        laneSuccessPulse?.playerId &&
                        filled &&
                        idx === built.colors.length - 1 &&
                        Date.now() - laneSuccessPulse.at < 1400;
                      return (
                        <span
                          key={`${teamKey}-${idx}`}
                          className={`lane-segment ${flashActive ? "lane-segment-flash" : ""}`}
                          style={{
                            background: filled ? color : "rgba(255,255,255,0.08)",
                            boxShadow: filled ? `0 0 10px ${color}` : undefined,
                          }}
                        />
                      );
                    })}
                  </div>
                );
              };
              const countFilled = (teamKey: "a" | "b", teamList: typeof teamAOrdered) => {
                const built = buildLaneSuccessColors(teamKey, teamList);
                return { filled: built.colors.length, total: built.total };
              };
              const currentTurnPlayer = participants.find((p) => p.id === currentTurnId) ?? null;
              const currentTurnSkill = (() => {
                if (!currentTurnPlayer) return "";
                const assignedCats = getAssignedLaneCategories(assignments, currentTurnPlayer.id);
                const pool = buildLaneSkillPool(meta.category_skills, assignedCats);
                if (!pool.length) return "";
                const attemptsList = currentTurnPlayer.attempts_list ?? [];
                const pick = pool[attemptsList.length % pool.length];
                return pick ? skillNameById.get(pick.skillId) ?? "" : "";
              })();
              return (
                <div key={b.id} style={{ ...battleCard(flashType, done), gridColumn: "1 / -1" }}>
                  <div style={{ ...battleCardContent() }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeBattle(b.id);
                      }}
                      style={closeBtnBottom()}
                      title="Remove battle"
                    >
                      ✖
                    </button>
                    <div style={{ fontWeight: 1000, fontSize: 18, textAlign: "center" }}>SKILL LANES</div>
                    <div style={{ textAlign: "center", fontSize: 11, opacity: 0.6 }}>ID: {b.id}</div>
                    <div style={{ textAlign: "center", fontSize: 12, opacity: 0.8 }}>
                      Categories: {laneCats.join(", ") || "—"} • Reps {b.repetitions_target}
                    </div>
                    <div style={{ textAlign: "center", fontSize: 11, opacity: 0.55 }}>
                      Points delta: {pointsDeltaSummary || "—"}
                    </div>
                    {!isTabletMode ? (
                      <details style={debugDetails()}>
                        <summary style={debugSummary()}>Debug</summary>
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                          <button onClick={() => settleBattle(b.id)} style={debugBtn()}>
                            Force settle
                          </button>
                        </div>
                        <pre style={debugPre()}>{JSON.stringify(debugLaneData, null, 2)}</pre>
                      </details>
                    ) : null}
                    <div className="battle-turn-controls">
                      <button type="button" className="battle-coin-btn" onClick={flipCoin}>
                        COIN FLIP
                      </button>
                      <button type="button" className="battle-order-btn" onClick={pickTurnOrder}>
                        HELP ME PICK THE ORDER
                      </button>
                      {turnState?.order?.length ? (
                        <button type="button" className="battle-order-btn" onClick={() => nextBattleTurn(b.id)}>
                          NEXT TURN
                        </button>
                      ) : null}
                    </div>
                    {coinLabel ? <div className="battle-coin-result">{coinLabel}</div> : null}
                    <div className="lane-mini-summary">
                      <div className="lane-mini-box">
                        <div className="lane-mini-title">Team A</div>
                        {teamAOrdered.map((p) => {
                          const attemptsList = p.attempts_list ?? [];
                          const successCount = attemptsList.filter((v) => v).length;
                          const failCount = attemptsList.length - successCount;
                          const useNumbers = Number(b.repetitions_target ?? 0) > 8;
                          return (
                            <div key={`mini-a-${p.id}`} className="lane-mini-row">
                              <span className="lane-mini-name">
                                {p.name}
                                {laneMvpIds.includes(p.id) ? <span className="lane-mini-mvp">MVP</span> : null}
                              </span>
                              {useNumbers ? (
                                <span className="lane-mini-counts">
                                  {successCount}✓ {failCount}✕
                                </span>
                              ) : (
                                <span className="lane-mini-dots">
                                  {attemptsList.map((ok, idx) => (
                                    <span
                                      key={`a-${p.id}-${idx}`}
                                      className={`lane-mini-dot ${ok ? "lane-mini-dot-good" : "lane-mini-dot-bad"}`}
                                    />
                                  ))}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="lane-mini-box">
                        <div className="lane-mini-title">Team B</div>
                        {teamBOrdered.map((p) => {
                          const attemptsList = p.attempts_list ?? [];
                          const successCount = attemptsList.filter((v) => v).length;
                          const failCount = attemptsList.length - successCount;
                          const useNumbers = Number(b.repetitions_target ?? 0) > 8;
                          return (
                            <div key={`mini-b-${p.id}`} className="lane-mini-row">
                              <span className="lane-mini-name">
                                {p.name}
                                {laneMvpIds.includes(p.id) ? <span className="lane-mini-mvp">MVP</span> : null}
                              </span>
                              {useNumbers ? (
                                <span className="lane-mini-counts">
                                  {successCount}✓ {failCount}✕
                                </span>
                              ) : (
                                <span className="lane-mini-dots">
                                  {attemptsList.map((ok, idx) => (
                                    <span
                                      key={`b-${p.id}-${idx}`}
                                      className={`lane-mini-dot ${ok ? "lane-mini-dot-good" : "lane-mini-dot-bad"}`}
                                    />
                                  ))}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="lane-board">
                      <div className="lane-team lane-team-a">
                        <div className="lane-team-header">Team A remaining: {teamARemaining}</div>
                        {teamAOrdered.map((p) => {
                          const assignedCats = getAssignedLaneCategories(assignments, p.id);
                          const primaryCat = assignedCats[0] ?? "Category";
                          const catLabel = assignedCats.length ? assignedCats.join(" + ") : "Category";
                          const color = laneColor(primaryCat, laneCats);
                          const attemptsList = p.attempts_list ?? [];
                          const doneP = attemptsList.length >= b.repetitions_target;
                          const remainingP = Math.max(0, Number(b.repetitions_target ?? 0) - attemptsList.length);
                          const delta = pointsDeltaById.get(p.id) ?? 0;
                          const beforePoints = p.points !== undefined && p.points !== null ? Number(p.points ?? 0) - delta : null;
                          const pulseActive =
                            laneSuccessPulse?.battleId === b.id &&
                            laneSuccessPulse?.playerId === p.id &&
                            Date.now() - laneSuccessPulse.at < 1400;
                          const pool = buildLaneSkillPool(meta.category_skills, assignedCats);
                          const skillPick = pool.length ? pool[attemptsList.length % pool.length] : null;
                          const skillName = skillPick ? skillNameById.get(skillPick.skillId) ?? "Skill" : "No skill selected";
                          return (
                            <div
                              key={p.id}
                              className={`lane-player ${currentTurnId === p.id ? "lane-player-active" : ""}`}
                              style={{ position: "relative" }}
                            >
                              {isSettled ? (
                                <div style={netPointsOverlayContainer()}>
                                  <div style={netPointsChangeChip(delta)}>
                                    <span>{formatPointsValue(beforePoints)}</span>
                                    <span>{delta >= 0 ? "▲" : "▼"}</span>
                                    <span>{formatPointsValue(p.points)}</span>
                                  </div>
                                  <div style={netDeltaChip(delta)}>{formatNetDelta(delta)}</div>
                                </div>
                              ) : null}
                              <div className="lane-player-header">
                                <div className="lane-player-name">
                                  {p.name}
                                  {laneMvpIds.includes(p.id) ? <span className="lane-mvp-chip">MVP</span> : null}
                                </div>
                                <div className="lane-player-level">Lv {p.level ?? 0} • {p.points ?? 0} pts</div>
                                <div className="lane-player-remaining">Remaining: {remainingP}</div>
                              </div>
                              {done && delta !== 0 ? (
                                <div className={`lane-points-chip ${delta > 0 ? "lane-points-win" : "lane-points-loss"}`}>
                                  <span className="lane-points-before">{beforePoints}</span>
                                  <span className="lane-points-arrow">{delta > 0 ? "▲" : "▼"}</span>
                                  <span className="lane-points-after">{p.points ?? 0}</span>
                                </div>
                              ) : null}
                              <div className="lane-player-cat" style={{ color, borderColor: color }}>
                                {catLabel}
                              </div>
                              <div className="lane-player-skill">Next: {skillName}</div>
                              {done ? (
                                <div
                                  className="lane-player-points"
                                  style={{
                                    borderColor: (pointsDeltaById.get(p.id) ?? 0) >= 0 ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)",
                                    background:
                                      (pointsDeltaById.get(p.id) ?? 0) >= 0 ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)",
                                    color:
                                      (pointsDeltaById.get(p.id) ?? 0) >= 0 ? "rgba(34,197,94,0.95)" : "rgba(239,68,68,0.95)",
                                  }}
                                >
                                  {(pointsDeltaById.get(p.id) ?? 0) >= 0 ? "+" : ""}
                                  {pointsDeltaById.get(p.id) ?? 0} pts
                                </div>
                              ) : null}
                              {currentTurnId === p.id ? <div className="lane-turn">YOUR TURN</div> : null}
                              <div className="lane-controls">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!doneP) logBattleAttempt(b.id, p.id, true);
                                  }}
                                  style={{ ...battleBtn("good", doneP), width: 40, height: 40, fontSize: 18 }}
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!doneP) logBattleAttempt(b.id, p.id, false);
                                  }}
                                  style={{ ...battleBtn("bad", doneP), width: 40, height: 40, fontSize: 18 }}
                                >
                                  ✕
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (attemptsList.length > 0) undoBattleAttempt(b.id, p.id);
                                  }}
                                  style={{ ...battleUndoBtn(attemptsList.length <= 0), width: 40, height: 40, fontSize: 16 }}
                                  title="Undo"
                                >
                                  ↩
                                </button>
                              </div>
                              <div
                                className={`lane-connector ${pulseActive ? "lane-connector-active" : ""}`}
                                style={{ background: color }}
                              />
                            </div>
                          );
                        })}
                      </div>
                      <div className="lane-middle">
                        {(() => {
                          const aCount = countFilled("a", teamAOrdered);
                          return (
                            <div className="lane-score lane-score-a">
                              {aCount.filled}/{aCount.total}
                            </div>
                          );
                        })()}
                        {renderLaneRow("a", teamAOrdered)}
                        {renderLaneRow("b", teamBOrdered)}
                        {(() => {
                          const bCount = countFilled("b", teamBOrdered);
                          return (
                            <div className="lane-score lane-score-b">
                              {bCount.filled}/{bCount.total}
                            </div>
                          );
                        })()}
                        <div className="lane-remaining">
                          Remaining reps: {Math.max(0, b.repetitions_target * (teamAOrdered.length + teamBOrdered.length) - (teamADone + teamBDone))}
                        </div>
                        {currentTurnPlayer ? (
                          <div className="lane-current-turn">
                            <div className="lane-current-name">{currentTurnPlayer.name}</div>
                            <div className="lane-current-skill">{currentTurnSkill || "Skill"}</div>
                          </div>
                        ) : null}
                      </div>
                      <div className="lane-team lane-team-b">
                        <div className="lane-team-header">Team B remaining: {teamBRemaining}</div>
                        {teamBOrdered.map((p) => {
                          const assignedCats = getAssignedLaneCategories(assignments, p.id);
                          const primaryCat = assignedCats[0] ?? "Category";
                          const catLabel = assignedCats.length ? assignedCats.join(" + ") : "Category";
                          const color = laneColor(primaryCat, laneCats);
                          const attemptsList = p.attempts_list ?? [];
                          const doneP = attemptsList.length >= b.repetitions_target;
                          const remainingP = Math.max(0, Number(b.repetitions_target ?? 0) - attemptsList.length);
                          const delta = pointsDeltaById.get(p.id) ?? 0;
                          const beforePoints = p.points !== undefined && p.points !== null ? Number(p.points ?? 0) - delta : null;
                          const pulseActive =
                            laneSuccessPulse?.battleId === b.id &&
                            laneSuccessPulse?.playerId === p.id &&
                            Date.now() - laneSuccessPulse.at < 1400;
                          const pool = buildLaneSkillPool(meta.category_skills, assignedCats);
                          const skillPick = pool.length ? pool[attemptsList.length % pool.length] : null;
                          const skillName = skillPick ? skillNameById.get(skillPick.skillId) ?? "Skill" : "No skill selected";
                          return (
                            <div
                              key={p.id}
                              className={`lane-player ${currentTurnId === p.id ? "lane-player-active" : ""}`}
                              style={{ position: "relative" }}
                            >
                              {isSettled ? (
                                <div style={netPointsOverlayContainer()}>
                                  <div style={netPointsChangeChip(delta)}>
                                    <span>{formatPointsValue(beforePoints)}</span>
                                    <span>{delta >= 0 ? "▲" : "▼"}</span>
                                    <span>{formatPointsValue(p.points)}</span>
                                  </div>
                                  <div style={netDeltaChip(delta)}>{formatNetDelta(delta)}</div>
                                </div>
                              ) : null}
                              <div className="lane-player-header">
                                <div className="lane-player-name">
                                  {p.name}
                                  {laneMvpIds.includes(p.id) ? <span className="lane-mvp-chip">MVP</span> : null}
                                </div>
                                <div className="lane-player-level">Lv {p.level ?? 0} • {p.points ?? 0} pts</div>
                                <div className="lane-player-remaining">Remaining: {remainingP}</div>
                              </div>
                              {done && delta !== 0 ? (
                                <div className={`lane-points-chip ${delta > 0 ? "lane-points-win" : "lane-points-loss"}`}>
                                  <span className="lane-points-before">{beforePoints}</span>
                                  <span className="lane-points-arrow">{delta > 0 ? "▲" : "▼"}</span>
                                  <span className="lane-points-after">{p.points ?? 0}</span>
                                </div>
                              ) : null}
                              <div className="lane-player-cat" style={{ color, borderColor: color }}>
                                {catLabel}
                              </div>
                              <div className="lane-player-skill">Next: {skillName}</div>
                              {done ? (
                                <div
                                  className="lane-player-points"
                                  style={{
                                    borderColor: (pointsDeltaById.get(p.id) ?? 0) >= 0 ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)",
                                    background:
                                      (pointsDeltaById.get(p.id) ?? 0) >= 0 ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)",
                                    color:
                                      (pointsDeltaById.get(p.id) ?? 0) >= 0 ? "rgba(34,197,94,0.95)" : "rgba(239,68,68,0.95)",
                                  }}
                                >
                                  {(pointsDeltaById.get(p.id) ?? 0) >= 0 ? "+" : ""}
                                  {pointsDeltaById.get(p.id) ?? 0} pts
                                </div>
                              ) : null}
                              {currentTurnId === p.id ? <div className="lane-turn">YOUR TURN</div> : null}
                              <div className="lane-controls">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!doneP) logBattleAttempt(b.id, p.id, true);
                                  }}
                                  style={{ ...battleBtn("good", doneP), width: 40, height: 40, fontSize: 18 }}
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!doneP) logBattleAttempt(b.id, p.id, false);
                                  }}
                                  style={{ ...battleBtn("bad", doneP), width: 40, height: 40, fontSize: 18 }}
                                >
                                  ✕
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (attemptsList.length > 0) undoBattleAttempt(b.id, p.id);
                                  }}
                                  style={{ ...battleUndoBtn(attemptsList.length <= 0), width: 40, height: 40, fontSize: 16 }}
                                  title="Undo"
                                >
                                  ↩
                                </button>
                              </div>
                              <div
                                className={`lane-connector ${pulseActive ? "lane-connector-active" : ""}`}
                                style={{ background: color }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {turnOrderNames ? <div className="lane-order">Turn order: {turnOrderNames}</div> : null}
                  </div>
                </div>
              );
            }
            const teamBattleContent =
              b.battle_mode === "teams" ? (
                teamStats.length > 2 ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                    {teamStats.map((team) => (
                      <div key={team.key} style={{ display: "grid", gap: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 6px" }}>
                          <div style={{ fontWeight: 900, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.7 }}>
                            {team.label} total
                          </div>
                          {renderTeamScore(team.successes, team.potential)}
                        </div>
                        <div style={teamGroupWrap(team.key)}>
                          {team.members.length ? (
                            team.members.map((p) => {
                              const attemptsList = p.attempts_list ?? [];
                              const doneP = attemptsList.length >= b.repetitions_target;
                              const stats = scoreFromParticipant(p);
                              const histAttempts = p.history_attempts ?? 0;
                              const histSuccesses = p.history_successes ?? 0;
                              const histRate = p.history_rate ?? (histAttempts ? Math.round((histSuccesses / histAttempts) * 100) : 0);
                              const hist30Attempts = p.history_last30_attempts ?? 0;
                              const hist30Successes = p.history_last30_successes ?? 0;
                              const hist30Rate = p.history_last30_rate ?? (hist30Attempts ? Math.round((hist30Successes / hist30Attempts) * 100) : 0);
                              const delta = pointsDeltaById.get(p.id) ?? 0;
                              return (
                                <div
                                  key={p.id}
                                  style={{
                                    ...teamMemberCard(team.key),
                                    ...(currentTurnId === p.id ? turnHighlightCard(team.key) : null),
                                    position: "relative",
                                  }}
                                >
                                  <div style={{ fontWeight: 1000, fontSize: 18, display: "flex", justifyContent: "space-between", gap: 8 }}>
                                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      {p.name}
                                      {mvpIds.includes(p.id) ? <span style={mvpChip()}>MVP</span> : null}
                                    </span>
                                    <span style={{ fontSize: 11, opacity: 0.7 }}>
                                      Lv {p.level ?? 0} • {p.points ?? 0} pts
                                    </span>
                                  </div>
                                  {isSettled ? (
                                    <div style={netPointsRow()}>
                                      <div style={netPointsChangeChip(delta)}>
                                        <span>{formatPointsValue((p.points ?? 0) - delta)}</span>
                                        <span>{delta >= 0 ? "▲" : "▼"}</span>
                                        <span>{formatPointsValue(p.points)}</span>
                                      </div>
                                      <div style={netDeltaChip(delta)}>{formatNetDelta(delta)}</div>
                                    </div>
                                  ) : null}
                                  {currentTurnId === p.id ? <div style={turnBadge()}>YOUR TURN</div> : null}
                                  <div style={{ fontSize: 11, opacity: 0.7 }}>{team.label}</div>
                                  {renderBattleScore(stats.successesCount, stats.attemptsCount)}
                                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                                    {Array.from({ length: b.repetitions_target }).map((_, i) => {
                                      const filled = i < attemptsList.length;
                                      const success = attemptsList[i] === true;
                                      const bg = filled
                                        ? success
                                          ? "rgba(34,197,94,0.85)"
                                          : "rgba(239,68,68,0.85)"
                                        : "rgba(148,163,184,0.30)";
                                      return (
                                        <span
                                          key={i}
                                          style={{
                                            width: 12,
                                            height: 12,
                                            borderRadius: 999,
                                            background: bg,
                                            border: "1px solid rgba(255,255,255,0.20)",
                                          }}
                                        />
                                      );
                                    })}
                                  </div>
                                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!doneP) logBattleAttempt(b.id, p.id, true);
                                      }}
                                      style={{ ...battleBtn("good", doneP), width: 48, height: 48, fontSize: 20 }}
                                    >
                                      ✓
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!doneP) logBattleAttempt(b.id, p.id, false);
                                      }}
                                      style={{ ...battleBtn("bad", doneP), width: 48, height: 48, fontSize: 20 }}
                                    >
                                      ✕
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (attemptsList.length > 0) undoBattleAttempt(b.id, p.id);
                                      }}
                                      style={{ ...battleUndoBtn(attemptsList.length <= 0), width: 48, height: 48, fontSize: 18 }}
                                      title="Undo"
                                    >
                                      ↩
                                    </button>
                                  </div>
                                  <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                                    History {histSuccesses}/{histAttempts} • {histRate}%
                                    <div style={{ fontSize: 11, opacity: 0.7 }}>
                                      30d {hist30Successes}/{hist30Attempts} • {hist30Rate}%
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div style={{ padding: 16, borderRadius: 14, border: "1px dashed rgba(255,255,255,0.2)", opacity: 0.6 }}>
                              Empty {team.label}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 6px" }}>
                      <div style={{ fontWeight: 900, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.7 }}>
                        Team A total
                      </div>
                      {renderTeamScore(teamASuccesses, teamAPotential)}
                    </div>
                    <div style={teamGroupWrap("a")}>
                      {participants
                        .filter((p) => teamAIds.includes(p.id))
                        .map((p) => {
                          const attemptsList = p.attempts_list ?? [];
                          const doneP = attemptsList.length >= b.repetitions_target;
                          const stats = scoreFromParticipant(p);
                          const histAttempts = p.history_attempts ?? 0;
                          const histSuccesses = p.history_successes ?? 0;
                          const histRate = p.history_rate ?? (histAttempts ? Math.round((histSuccesses / histAttempts) * 100) : 0);
                          const hist30Attempts = p.history_last30_attempts ?? 0;
                          const hist30Successes = p.history_last30_successes ?? 0;
                          const hist30Rate = p.history_last30_rate ?? (hist30Attempts ? Math.round((hist30Successes / hist30Attempts) * 100) : 0);
                          const delta = pointsDeltaById.get(p.id) ?? 0;
                          return (
                            <div
                              key={p.id}
                              style={{
                                ...teamMemberCard("a"),
                                ...(currentTurnId === p.id ? turnHighlightCard("a") : null),
                                position: "relative",
                              }}
                            >
                              <div style={{ fontWeight: 1000, fontSize: 18, display: "flex", justifyContent: "space-between", gap: 8 }}>
                                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  {p.name}
                                  {mvpIds.includes(p.id) ? <span style={mvpChip()}>MVP</span> : null}
                                </span>
                                <span style={{ fontSize: 11, opacity: 0.7 }}>
                                  Lv {p.level ?? 0} • {p.points ?? 0} pts
                                </span>
                              </div>
                              {isSettled ? (
                                <div style={netPointsRow()}>
                                  <div style={netPointsChangeChip(delta)}>
                                    <span>{formatPointsValue((p.points ?? 0) - delta)}</span>
                                    <span>{delta >= 0 ? "▲" : "▼"}</span>
                                    <span>{formatPointsValue(p.points)}</span>
                                  </div>
                                  <div style={netDeltaChip(delta)}>{formatNetDelta(delta)}</div>
                                </div>
                              ) : null}
                              {currentTurnId === p.id ? <div style={turnBadge()}>YOUR TURN</div> : null}
                              <div style={{ fontSize: 11, opacity: 0.7 }}>Team A</div>
                              {renderBattleScore(stats.successesCount, stats.attemptsCount)}
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                                {Array.from({ length: b.repetitions_target }).map((_, i) => {
                                  const filled = i < attemptsList.length;
                                  const success = attemptsList[i] === true;
                                  const bg = filled
                                    ? success
                                      ? "rgba(34,197,94,0.85)"
                                      : "rgba(239,68,68,0.85)"
                                    : "rgba(148,163,184,0.30)";
                                  return <span key={i} style={{ width: 12, height: 12, borderRadius: 999, background: bg, border: "1px solid rgba(255,255,255,0.20)" }} />;
                                })}
                              </div>
                              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!doneP) logBattleAttempt(b.id, p.id, true);
                                  }}
                                  style={{ ...battleBtn("good", doneP), width: 48, height: 48, fontSize: 20 }}
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!doneP) logBattleAttempt(b.id, p.id, false);
                                  }}
                                  style={{ ...battleBtn("bad", doneP), width: 48, height: 48, fontSize: 20 }}
                                >
                                  ✕
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (attemptsList.length > 0) undoBattleAttempt(b.id, p.id);
                                  }}
                                  style={{ ...battleUndoBtn(attemptsList.length <= 0), width: 48, height: 48, fontSize: 18 }}
                                  title="Undo"
                                >
                                  ↩
                                </button>
                              </div>
                              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                                History {histSuccesses}/{histAttempts} • {histRate}%
                                <div style={{ fontSize: 11, opacity: 0.7 }}>30d {hist30Successes}/{hist30Attempts} • {hist30Rate}%</div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                    <div style={{ display: "grid", placeItems: "center" }}>
                      <div className="battle-vs-glow">VS</div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 6px" }}>
                      <div style={{ fontWeight: 900, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.7 }}>
                        Team B total
                      </div>
                      {renderTeamScore(teamBSuccesses, teamBPotential)}
                    </div>
                    <div style={teamGroupWrap("b")}>
                      {participants
                        .filter((p) => teamBIds.includes(p.id))
                        .map((p) => {
                          const attemptsList = p.attempts_list ?? [];
                          const doneP = attemptsList.length >= b.repetitions_target;
                          const stats = scoreFromParticipant(p);
                          const histAttempts = p.history_attempts ?? 0;
                          const histSuccesses = p.history_successes ?? 0;
                          const histRate = p.history_rate ?? (histAttempts ? Math.round((histSuccesses / histAttempts) * 100) : 0);
                          const hist30Attempts = p.history_last30_attempts ?? 0;
                          const hist30Successes = p.history_last30_successes ?? 0;
                          const hist30Rate = p.history_last30_rate ?? (hist30Attempts ? Math.round((hist30Successes / hist30Attempts) * 100) : 0);
                          const delta = pointsDeltaById.get(p.id) ?? 0;
                          return (
                            <div
                              key={p.id}
                              style={{
                                ...teamMemberCard("b"),
                                ...(currentTurnId === p.id ? turnHighlightCard("b") : null),
                                position: "relative",
                              }}
                            >
                              <div style={{ fontWeight: 1000, fontSize: 18, display: "flex", justifyContent: "space-between", gap: 8 }}>
                                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  {p.name}
                                  {mvpIds.includes(p.id) ? <span style={mvpChip()}>MVP</span> : null}
                                </span>
                                <span style={{ fontSize: 11, opacity: 0.7 }}>
                                  Lv {p.level ?? 0} • {p.points ?? 0} pts
                                </span>
                              </div>
                              {isSettled ? (
                                <div style={netPointsRow(true)}>
                                  <div style={netPointsChangeChip(delta)}>
                                    <span>{formatPointsValue((p.points ?? 0) - delta)}</span>
                                    <span>{delta >= 0 ? "▲" : "▼"}</span>
                                    <span>{formatPointsValue(p.points)}</span>
                                  </div>
                                  <div style={netDeltaChip(delta)}>{formatNetDelta(delta)}</div>
                                </div>
                              ) : null}
                              {currentTurnId === p.id ? <div style={turnBadge()}>YOUR TURN</div> : null}
                              <div style={{ fontSize: 11, opacity: 0.7 }}>Team B</div>
                              {renderBattleScore(stats.successesCount, stats.attemptsCount)}
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                                {Array.from({ length: b.repetitions_target }).map((_, i) => {
                                  const filled = i < attemptsList.length;
                                  const success = attemptsList[i] === true;
                                  const bg = filled
                                    ? success
                                      ? "rgba(34,197,94,0.85)"
                                      : "rgba(239,68,68,0.85)"
                                    : "rgba(148,163,184,0.30)";
                                  return <span key={i} style={{ width: 12, height: 12, borderRadius: 999, background: bg, border: "1px solid rgba(255,255,255,0.20)" }} />;
                                })}
                              </div>
                              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!doneP) logBattleAttempt(b.id, p.id, true);
                                  }}
                                  style={{ ...battleBtn("good", doneP), width: 48, height: 48, fontSize: 20 }}
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!doneP) logBattleAttempt(b.id, p.id, false);
                                  }}
                                  style={{ ...battleBtn("bad", doneP), width: 48, height: 48, fontSize: 20 }}
                                >
                                  ✕
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (attemptsList.length > 0) undoBattleAttempt(b.id, p.id);
                                  }}
                                  style={{ ...battleUndoBtn(attemptsList.length <= 0), width: 48, height: 48, fontSize: 18 }}
                                  title="Undo"
                                >
                                  ↩
                                </button>
                              </div>
                              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                                History {histSuccesses}/{histAttempts} • {histRate}%
                                <div style={{ fontSize: 11, opacity: 0.7 }}>30d {hist30Successes}/{hist30Attempts} • {hist30Rate}%</div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </>
                )
              ) : null;
            function renderBattleScore(successesCount: number, attemptsCount: number) {
              const remaining = Math.max(0, Number(b.repetitions_target ?? 0) - attemptsCount);
              const potential = successesCount + remaining;
              return (
                <div style={{ display: "inline-flex", alignItems: "baseline", gap: 6, fontWeight: 1000 }}>
                  <div style={{ fontSize: 28, color: "rgba(34,197,94,0.95)", textShadow: "0 0 12px rgba(34,197,94,0.35)" }}>
                    {successesCount}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>({potential})</div>
                </div>
              );
            }
            function renderTeamScore(successesCount: number, potentialCount: number) {
              return (
                <div style={{ display: "inline-flex", alignItems: "baseline", gap: 6, fontWeight: 1000 }}>
                  <div style={{ fontSize: 30, color: "rgba(34,197,94,0.95)", textShadow: "0 0 12px rgba(34,197,94,0.35)" }}>
                    {successesCount}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>({potentialCount})</div>
                </div>
              );
            }
            function scoreFromParticipant(p: BattleRow["participants"][number]) {
              const attemptsCount = p.attempts_list?.length ?? (p.attempts ?? 0);
              const successesCount = typeof p.successes === "number" ? p.successes : p.attempts_list?.filter((v) => v).length ?? 0;
              return { attemptsCount, successesCount };
            }
            const teamWinner = (() => {
              if (battleMode !== "teams") {
                return {
                  label: teamASuccesses > teamBSuccesses ? "Team A" : teamBSuccesses > teamASuccesses ? "Team B" : "No winner",
                  ids: teamASuccesses > teamBSuccesses ? teamAIds : teamBSuccesses > teamASuccesses ? teamBIds : [],
                };
              }
              const sorted = [...teamStats].sort((a, b) => b.successes - a.successes);
              if (sorted.length < 2 || sorted[0].successes === sorted[1].successes) return { label: "No winner", ids: [] as string[] };
              return { label: sorted[0].label, ids: sorted[0].ids };
            })();
            const teamWinnerLabel = teamWinner.label;
            const teamWinnerIds = teamWinner.ids;
            const perPersonEarned = (() => {
              const lead = (() => {
                if (battleMode !== "teams") return Math.abs(teamASuccesses - teamBSuccesses);
                const sorted = [...teamStats].sort((a, b) => b.successes - a.successes);
                if (sorted.length < 2 || sorted[0].successes === sorted[1].successes) return 0;
                return sorted[0].successes - sorted[1].successes;
              })();
              if (!lead || !teamWinnerIds.length) return 0;
              if (b.wager_amount > 0) {
                const gross = Math.floor((Number(b.wager_amount ?? 0) * participants.length) / Math.max(1, teamWinnerIds.length));
                return Math.max(0, gross - Number(b.wager_amount ?? 0));
              }
              return Math.floor((lead * Math.max(3, Number(b.points_per_rep ?? 5))) / Math.max(1, teamWinnerIds.length));
            })();
            const teamSummaryLine =
              battleMode === "teams" && teamStats.length > 2
                ? teamStats.map((team) => `${team.label} ${team.successes}✓ ${team.fails}✕`).join(" • ")
                : `Team A ${teamASuccesses}✓ ${teamAFails}✕ • Team B ${teamBSuccesses}✓ ${teamBFails}✕`;
            const flipCoinLegacy = () => {
              if (battleMode === "teams" || battleMode === "lanes") {
                const start = cryptoRand(2) === 0 ? "Team A" : "Team B";
                setBattleCoinState((prev) => ({ ...prev, [b.id]: { label: `${start} starts`, at: Date.now() } }));
                return;
              }
              if (participants.length) {
                const pick = participants[cryptoRand(participants.length)];
                const name = pick?.name ?? "Player";
                setBattleCoinState((prev) => ({ ...prev, [b.id]: { label: `${name} starts`, at: Date.now() } }));
              }
            };
            const pickTurnOrderLegacy = () => {
              if (!participants.length) return;
              if (battleMode === "ffa") {
                const order = shuffleList(participants.map((p) => p.id));
                setTurnOrderForBattle(b, "ffa", order, "Order set");
                setBattleCoinState((prev) => ({ ...prev, [b.id]: { label: "Turn order set", at: Date.now() } }));
                return;
              }
              if (battleMode === "teams" || battleMode === "lanes") {
                const aOrder = shuffleList(teamAIds);
                const bOrder = shuffleList(teamBIds);
                const startTeam = cryptoRand(2) === 0 ? "a" : "b";
                const order: string[] = [];
                let ai = 0;
                let bi = 0;
                while (ai < aOrder.length || bi < bOrder.length) {
                  if (startTeam === "a") {
                    if (ai < aOrder.length) order.push(aOrder[ai++]);
                    if (bi < bOrder.length) order.push(bOrder[bi++]);
                  } else {
                    if (bi < bOrder.length) order.push(bOrder[bi++]);
                    if (ai < aOrder.length) order.push(aOrder[ai++]);
                  }
                }
                setTurnOrderForBattle(
                  b,
                  "teams",
                  order,
                  `${startTeam === "a" ? "Team A" : "Team B"} starts`
                );
                setBattleCoinState((prev) => ({
                  ...prev,
                  [b.id]: { label: `${startTeam === "a" ? "Team A" : "Team B"} starts`, at: Date.now() },
                }));
              }
            };
            if (!pointsDeltaById.size && done && b.battle_mode === "ffa" && b.wager_amount > 0) {
              const wager = Number(b.wager_amount ?? 0);
              const ranked = participants
                .map((p) => ({ id: p.id, successes: p.successes ?? 0 }))
                .sort((a, b) => b.successes - a.successes);
              const top = ranked[0]?.successes ?? 0;
              const tiedTop = ranked.filter((r) => r.successes === top);
              const winnerIds = tiedTop.length === 1 ? [tiedTop[0].id] : [];
              const payoutTotal = wager * participants.length;
              const share = winnerIds.length ? Math.floor(payoutTotal / winnerIds.length) : 0;
              participants.forEach((p) => {
                if (winnerIds.includes(p.id)) pointsDeltaById.set(p.id, Math.max(0, share - wager));
                else pointsDeltaById.set(p.id, -wager);
              });
            }
            return (
              <div key={b.id} style={{ ...battleCard(flashType, done), gridColumn: "1 / -1" }} onClick={() => null}>
                {battleCreateId === b.id ? (
                  <div className="battle-card-intro">
                    <div className="battle-open-glow" />
                    <div className="battle-open-sword left" />
                    <div className="battle-open-sword right" />
                  </div>
                ) : null}
                <div style={battleParticlesWrap()}>
                  <Particles
                    id={`battle-particles-${b.id}`}
                    init={particlesInit}
                    options={battleParticlesOptions as any}
                    style={{ position: "absolute", inset: 0 }}
                  />
                </div>
                <div style={{ ...battleCardContent(), ...(done ? { opacity: 0.55 } : null) }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeBattle(b.id);
                    }}
                    style={closeBtnBottom()}
                    title="Remove battle"
                  >
                    ✖
                  </button>

                  <div style={{ fontWeight: 1000, fontSize: 18, textAlign: "center" }}>
                    {b.battle_mode === "teams" ? "TEAM BATTLE PULSE" : "FREE-FOR-ALL BATTLE PULSE"}
                  </div>
                  <div style={{ textAlign: "center", fontSize: 11, opacity: 0.6 }}>ID: {b.id}</div>
                  <div style={{ textAlign: "center", fontSize: 12, opacity: 0.8 }}>
                    {b.skill_name} • Reps {b.repetitions_target}
                    {b.wager_amount > 0
                      ? (() => {
                          const pool = b.wager_amount * participants.length;
                          const winnerCount =
                            b.battle_mode === "teams"
                              ? Math.max(1, teamWinnerIds.length || Math.floor(participants.length / Math.max(1, teamGroups.length || 2)))
                              : 1;
                          const perWinnerGross = Math.floor(pool / winnerCount);
                          const perWinnerNet = Math.max(0, perWinnerGross - b.wager_amount);
                          return ` • Wager ${b.wager_amount} pts each • Net +${perWinnerNet} pts per winner • Losers -${b.wager_amount} pts`;
                        })()
                      : b.battle_mode === "teams"
                        ? ` • Winner: ${teamWinnerLabel} • ${teamSummaryLine}${perPersonEarned ? ` • +${perPersonEarned} pts per person` : ""}`
                        : ` • +${b.points_per_rep ?? 5} pts per rep lead`}
                  </div>
                  <div style={{ textAlign: "center", fontSize: 11, opacity: 0.55 }}>
                    Points delta: {pointsDeltaSummary || "—"}
                  </div>
                  {!isTabletMode ? (
                    <details style={debugDetails()}>
                      <summary style={debugSummary()}>Debug</summary>
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                        <button onClick={() => settleBattle(b.id)} style={debugBtn()}>
                          Force settle
                        </button>
                      </div>
                      <pre style={debugPre()}>
                        {JSON.stringify(
                          {
                            id: b.id,
                            battle_mode: b.battle_mode,
                            repetitions_target: b.repetitions_target,
                            wager_amount: b.wager_amount,
                            points_per_rep: b.points_per_rep,
                            settled_at: b.settled_at,
                            winner_id: b.winner_id,
                            team_a_ids: teamAIds,
                            team_b_ids: teamBIds,
                            participant_ids: participants.map((p) => p.id),
                            participant_stats: participants.map((p) => ({
                              id: p.id,
                              name: p.name,
                              attempts: p.attempts,
                              successes: p.successes,
                            })),
                            mvp_ids: mvpIds,
                            points_delta_by_id: Object.fromEntries(pointsDeltaById.entries()),
                          },
                          null,
                          2
                        )}
                      </pre>
                    </details>
                  ) : null}
                  <div className="battle-turn-controls">
                    <button type="button" className="battle-coin-btn" onClick={flipCoin}>
                      COIN FLIP
                    </button>
                    <button type="button" className="battle-order-btn" onClick={pickTurnOrder}>
                      HELP ME PICK THE ORDER
                    </button>
                    {turnState?.order?.length ? (
                      <button type="button" className="battle-order-btn" onClick={() => nextBattleTurn(b.id)}>
                        NEXT TURN
                      </button>
                    ) : null}
                    {coinLabel ? <div className="battle-coin-result">{coinLabel}</div> : null}
                  </div>
                  {turnOrderNames ? <div className="battle-turn-order">Turn order: {turnOrderNames}</div> : null}
                  {!done && liveWinnerLabel ? (
                    <div
                      style={{
                        marginTop: 8,
                        textAlign: "center",
                        fontWeight: 1000,
                        fontSize: 16,
                        padding: "6px 12px",
                        borderRadius: 999,
                        background: "rgba(15,23,42,0.7)",
                        border: "1px solid rgba(255,255,255,0.2)",
                      }}
                    >
                      Winner: {liveWinnerLabel}
                    </div>
                  ) : null}

                  <div
                    style={{
                      marginTop: 14,
                      display: "grid",
                      gridTemplateRows: b.battle_mode === "teams" ? "auto auto auto" : undefined,
                      gap: 12,
                    }}
                  >
                    {b.battle_mode === "teams" ? (
                      teamBattleContent
                    ) : b.battle_mode === "ffa" ? (
                      <div className="ffa-grid">
                        <div
                          className="ffa-row"
                          style={{ gridTemplateColumns: `repeat(${Math.min(3, Math.max(1, participants.slice(0, 3).length))}, minmax(0, 1fr))` }}
                        >
                          {participants.slice(0, 3).map((p) => {
                            const attemptsList = p.attempts_list ?? [];
                            const doneP = attemptsList.length >= b.repetitions_target;
                            const stats = scoreFromParticipant(p);
                            const histAttempts = p.history_attempts ?? 0;
                            const histSuccesses = p.history_successes ?? 0;
                            const histRate = p.history_rate ?? (histAttempts ? Math.round((histSuccesses / histAttempts) * 100) : 0);
                            const hist30Attempts = p.history_last30_attempts ?? 0;
                            const hist30Successes = p.history_last30_successes ?? 0;
                            const hist30Rate = p.history_last30_rate ?? (hist30Attempts ? Math.round((hist30Successes / hist30Attempts) * 100) : 0);
                            const delta = pointsDeltaById.get(p.id) ?? 0;
                            return (
                              <div key={p.id} className="ffa-card">
                                <div style={{ fontWeight: 1000, fontSize: 18, display: "flex", justifyContent: "space-between", gap: 8 }}>
                                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    {p.name}
                                    {mvpIds.includes(p.id) ? <span style={mvpChip()}>MVP</span> : null}
                                  </span>
                                  <span style={{ fontSize: 11, opacity: 0.7 }}>
                                    Lv {p.level ?? 0} • {p.points ?? 0} pts
                                  </span>
                                </div>
                                {renderBattleScore(stats.successesCount, stats.attemptsCount)}
                                {done && delta !== 0 ? (
                                  <div
                                    style={{
                                      marginTop: 6,
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 6,
                                      padding: "4px 8px",
                                      borderRadius: 999,
                                      fontWeight: 900,
                                      fontSize: 12,
                                      border: "1px solid rgba(255,255,255,0.25)",
                                      background: delta > 0 ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)",
                                      color: delta > 0 ? "rgba(34,197,94,0.95)" : "rgba(239,68,68,0.95)",
                                    }}
                                  >
                                    {delta > 0 ? `+${delta}` : delta} pts
                                  </div>
                                ) : null}
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                                  {Array.from({ length: b.repetitions_target }).map((_, i) => {
                                    const filled = i < attemptsList.length;
                                    const success = attemptsList[i] === true;
                                    const bg = filled ? (success ? "rgba(34,197,94,0.85)" : "rgba(239,68,68,0.85)") : "rgba(148,163,184,0.30)";
                                    return <span key={i} style={{ width: 12, height: 12, borderRadius: 999, background: bg, border: "1px solid rgba(255,255,255,0.20)" }} />;
                                  })}
                                </div>
                                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!doneP) logBattleAttempt(b.id, p.id, true);
                                    }}
                                    style={{ ...battleBtn("good", doneP), width: 48, height: 48, fontSize: 20 }}
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!doneP) logBattleAttempt(b.id, p.id, false);
                                    }}
                                    style={{ ...battleBtn("bad", doneP), width: 48, height: 48, fontSize: 20 }}
                                  >
                                    ✕
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (attemptsList.length > 0) undoBattleAttempt(b.id, p.id);
                                    }}
                                    style={{ ...battleUndoBtn(attemptsList.length <= 0), width: 48, height: 48, fontSize: 18 }}
                                    title="Undo"
                                  >
                                    ↩
                                  </button>
                                </div>
                                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                                  History {histSuccesses}/{histAttempts} • {histRate}%
                                  <div style={{ fontSize: 11, opacity: 0.7 }}>30d {hist30Successes}/{hist30Attempts} • {hist30Rate}%</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="ffa-vs">
                          <div className="battle-vs-glow">VS</div>
                          <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>{b.skill_name}</div>
                        </div>
                        <div
                          className="ffa-row"
                          style={{ gridTemplateColumns: `repeat(${Math.min(3, Math.max(1, participants.slice(3).length))}, minmax(0, 1fr))` }}
                        >
                          {participants.slice(3).map((p) => {
                            const attemptsList = p.attempts_list ?? [];
                            const doneP = attemptsList.length >= b.repetitions_target;
                            const stats = scoreFromParticipant(p);
                            const histAttempts = p.history_attempts ?? 0;
                            const histSuccesses = p.history_successes ?? 0;
                            const histRate = p.history_rate ?? (histAttempts ? Math.round((histSuccesses / histAttempts) * 100) : 0);
                            const hist30Attempts = p.history_last30_attempts ?? 0;
                            const hist30Successes = p.history_last30_successes ?? 0;
                            const hist30Rate = p.history_last30_rate ?? (hist30Attempts ? Math.round((hist30Successes / hist30Attempts) * 100) : 0);
                            const delta = pointsDeltaById.get(p.id) ?? 0;
                            return (
                              <div key={p.id} className="ffa-card" style={currentTurnId === p.id ? turnHighlightCard("ffa") : undefined}>
                                <div style={{ fontWeight: 1000, fontSize: 18, display: "flex", justifyContent: "space-between" }}>
                                  <span>{p.name}</span>
                                  <span style={{ fontSize: 11, opacity: 0.7 }}>
                                    Lv {p.level ?? 0} • {p.points ?? 0} pts
                                  </span>
                                </div>
                                {currentTurnId === p.id ? <div style={turnBadge()}>YOUR TURN</div> : null}
                                {renderBattleScore(stats.successesCount, stats.attemptsCount)}
                                {done && delta !== 0 ? (
                                  <div
                                    style={{
                                      marginTop: 6,
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 6,
                                      padding: "4px 8px",
                                      borderRadius: 999,
                                      fontWeight: 900,
                                      fontSize: 12,
                                      border: "1px solid rgba(255,255,255,0.25)",
                                      background: delta > 0 ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)",
                                      color: delta > 0 ? "rgba(34,197,94,0.95)" : "rgba(239,68,68,0.95)",
                                    }}
                                  >
                                    {delta > 0 ? `+${delta}` : delta} pts
                                  </div>
                                ) : null}
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                                  {Array.from({ length: b.repetitions_target }).map((_, i) => {
                                    const filled = i < attemptsList.length;
                                    const success = attemptsList[i] === true;
                                    const bg = filled ? (success ? "rgba(34,197,94,0.85)" : "rgba(239,68,68,0.85)") : "rgba(148,163,184,0.30)";
                                    return <span key={i} style={{ width: 12, height: 12, borderRadius: 999, background: bg, border: "1px solid rgba(255,255,255,0.20)" }} />;
                                  })}
                                </div>
                                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!doneP) logBattleAttempt(b.id, p.id, true);
                                    }}
                                    style={{ ...battleBtn("good", doneP), width: 48, height: 48, fontSize: 20 }}
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!doneP) logBattleAttempt(b.id, p.id, false);
                                    }}
                                    style={{ ...battleBtn("bad", doneP), width: 48, height: 48, fontSize: 20 }}
                                  >
                                    ✕
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (attemptsList.length > 0) undoBattleAttempt(b.id, p.id);
                                    }}
                                    style={{ ...battleUndoBtn(attemptsList.length <= 0), width: 48, height: 48, fontSize: 18 }}
                                    title="Undo"
                                  >
                                    ↩
                                  </button>
                                </div>
                                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                                  History {histSuccesses}/{histAttempts} • {histRate}%
                                  <div style={{ fontSize: 11, opacity: 0.7 }}>30d {hist30Successes}/{hist30Attempts} • {hist30Rate}%</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      participants.map((p) => {
                      const attemptsList = p.attempts_list ?? [];
                      const doneP = attemptsList.length >= b.repetitions_target;
                      const isSettled = Boolean(b.settled_at);
                      const stats = scoreFromParticipant(p);
                      const histAttempts = p.history_attempts ?? 0;
                      const histSuccesses = p.history_successes ?? 0;
                      const histRate = p.history_rate ?? (histAttempts ? Math.round((histSuccesses / histAttempts) * 100) : 0);
                      const hist30Attempts = p.history_last30_attempts ?? 0;
                      const hist30Successes = p.history_last30_successes ?? 0;
                      const hist30Rate = p.history_last30_rate ?? (hist30Attempts ? Math.round((hist30Successes / hist30Attempts) * 100) : 0);
                      const delta = pointsDeltaById.get(p.id) ?? 0;
                      return (
                        <div
                          key={p.id}
                          style={{
                            position: "relative",
                            padding: 12,
                            borderRadius: 18,
                            border: "1px solid rgba(255,255,255,0.14)",
                            background: "rgba(2,6,23,0.55)",
                            ...(currentTurnId === p.id ? turnHighlightCard("ffa") : null),
                          }}
                        >
                          {isSettled ? (
                            <div style={netPointsOverlayContainer()}>
                              <div style={netPointsChangeChip(delta)}>
                                <span>{formatPointsValue((p.points ?? 0) - delta)}</span>
                                <span>{delta >= 0 ? "▲" : "▼"}</span>
                                <span>{formatPointsValue(p.points)}</span>
                              </div>
                              <div style={netDeltaChip(delta)}>{formatNetDelta(delta)}</div>
                            </div>
                          ) : null}
                          <div style={{ fontWeight: 1000, fontSize: 18, display: "flex", justifyContent: "space-between" }}>
                            <span>{p.name}</span>
                            <span style={{ fontSize: 11, opacity: 0.7 }}>
                              Lv {p.level ?? 0} • {p.points ?? 0} pts
                            </span>
                          </div>
                          {currentTurnId === p.id ? <div style={turnBadge()}>YOUR TURN</div> : null}
                          {renderBattleScore(stats.successesCount, stats.attemptsCount)}
                          {done && delta !== 0 ? (
                            <div
                              style={{
                                marginTop: 6,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "4px 8px",
                                borderRadius: 999,
                                fontWeight: 900,
                                fontSize: 12,
                                border: "1px solid rgba(255,255,255,0.25)",
                                background: delta > 0 ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)",
                                color: delta > 0 ? "rgba(34,197,94,0.95)" : "rgba(239,68,68,0.95)",
                              }}
                            >
                              {delta > 0 ? `+${delta}` : delta} pts
                            </div>
                          ) : null}
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                            {Array.from({ length: b.repetitions_target }).map((_, i) => {
                              const filled = i < attemptsList.length;
                              const success = attemptsList[i] === true;
                              const bg = filled ? (success ? "rgba(34,197,94,0.85)" : "rgba(239,68,68,0.85)") : "rgba(148,163,184,0.30)";
                              return <span key={i} style={{ width: 12, height: 12, borderRadius: 999, background: bg, border: "1px solid rgba(255,255,255,0.20)" }} />;
                            })}
                          </div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!doneP) logBattleAttempt(b.id, p.id, true);
                              }}
                              style={{ ...battleBtn("good", doneP), width: 48, height: 48, fontSize: 20 }}
                            >
                              ✓
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!doneP) logBattleAttempt(b.id, p.id, false);
                              }}
                              style={{ ...battleBtn("bad", doneP), width: 48, height: 48, fontSize: 20 }}
                            >
                              ✕
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (attemptsList.length > 0) undoBattleAttempt(b.id, p.id);
                              }}
                              style={{ ...battleUndoBtn(attemptsList.length <= 0), width: 48, height: 48, fontSize: 18 }}
                              title="Undo"
                            >
                              ↩
                            </button>
                          </div>
                          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                            History {histSuccesses}/{histAttempts} • {histRate}%
                            <div style={{ fontSize: 11, opacity: 0.7 }}>30d {hist30Successes}/{hist30Attempts} • {hist30Rate}%</div>
                          </div>
                        </div>
                      );
                    })
                    )}
                  </div>

                  {done ? (
                    <div style={battleCompletedOverlay()}>
                      <div>Completed</div>
                      {b.battle_mode === "teams" ? (
                        <div style={{ fontSize: 28, fontWeight: 1000 }}>
                          {teamWinnerLabel === "No winner" ? "Tie Game" : `Winner: ${teamWinnerLabel}`}
                        </div>
                      ) : b.battle_mode === "ffa" && b.winner_id ? (
                        <>
                          <div style={{ fontSize: 28, fontWeight: 1000 }}>
                            {participants.find((p) => p.id === b.winner_id)?.name ?? "Winner"}
                          </div>
                          <div style={{ fontSize: 22, fontWeight: 900, color: "rgba(34,197,94,0.95)" }}>
                            {(() => {
                              const delta = pointsDeltaById.get(b.winner_id) ?? 0;
                              return delta > 0 ? `+${delta} pts` : "";
                            })()}
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: 28, fontWeight: 1000 }}>
                          {b.winner_id
                            ? `Winner: ${participants.find((p) => p.id === b.winner_id)?.name ?? "Winner"}`
                            : "Tie Game"}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          }
          const leftList = b.left_attempts_list ?? [];
          const rightList = b.right_attempts_list ?? [];
          const leftCount = leftList.length;
          const rightCount = rightList.length;
          const leftSuccesses = leftList.filter((x) => x).length;
          const rightSuccesses = rightList.filter((x) => x).length;
          const leftPotential = leftSuccesses + Math.max(0, Number(b.repetitions_target ?? 0) - leftCount);
          const rightPotential = rightSuccesses + Math.max(0, Number(b.repetitions_target ?? 0) - rightCount);
          const leftDone = leftList.length >= b.repetitions_target;
          const rightDone = rightList.length >= b.repetitions_target;
          const done = leftDone && rightDone;
          const isSettled = Boolean(b.settled_at);
          const flashType = flash?.id === b.id ? flash.type : null;
          const leftHistAttempts = b.left_history_attempts ?? 0;
          const rightHistAttempts = b.right_history_attempts ?? 0;
          const leftHistSuccesses = b.left_history_successes ?? 0;
          const rightHistSuccesses = b.right_history_successes ?? 0;
          const leftHistRate = b.left_history_rate ?? (leftHistAttempts ? Math.round((leftHistSuccesses / leftHistAttempts) * 100) : 0);
          const rightHistRate = b.right_history_rate ?? (rightHistAttempts ? Math.round((rightHistSuccesses / rightHistAttempts) * 100) : 0);
          const leftHistLabel = leftHistAttempts ? `${leftHistSuccesses}/${leftHistAttempts} • ${leftHistRate}%` : "0/0 • 0%";
          const rightHistLabel = rightHistAttempts ? `${rightHistSuccesses}/${rightHistAttempts} • ${rightHistRate}%` : "0/0 • 0%";
          const leftHist30Attempts = b.left_history_last30_attempts ?? 0;
          const rightHist30Attempts = b.right_history_last30_attempts ?? 0;
          const duelPointsDeltaById = new Map<string, number>(
            Object.entries(b.points_delta_by_id ?? {}).map(([key, value]) => [String(key), Number(value)])
          );
          const leftDelta = duelPointsDeltaById.get(b.left_student_id) ?? 0;
          const rightDelta = duelPointsDeltaById.get(b.right_student_id) ?? 0;
          const leftHist30Successes = b.left_history_last30_successes ?? 0;
          const rightHist30Successes = b.right_history_last30_successes ?? 0;
          const leftHist30Rate = b.left_history_last30_rate ?? (leftHist30Attempts ? Math.round((leftHist30Successes / leftHist30Attempts) * 100) : 0);
          const rightHist30Rate = b.right_history_last30_rate ?? (rightHist30Attempts ? Math.round((rightHist30Successes / rightHist30Attempts) * 100) : 0);
          const leftHist30Label = leftHist30Attempts ? `${leftHist30Successes}/${leftHist30Attempts} • ${leftHist30Rate}%` : "0/0 • 0%";
          const rightHist30Label = rightHist30Attempts ? `${rightHist30Successes}/${rightHist30Attempts} • ${rightHist30Rate}%` : "0/0 • 0%";
          const turnState = battleTurnState[b.id];
          const currentTurnId = turnState?.order?.[turnState.index] ?? "";
          const coinLabel = battleCoinState[b.id]?.label ?? "";
          const duelParticipants = [
            { id: b.left_student_id, name: b.left_name },
            { id: b.right_student_id, name: b.right_name },
          ];
          const turnOrderNames = (turnState?.order ?? [])
            .map((id) => duelParticipants.find((p) => p.id === id)?.name ?? "Student")
            .join(" → ");
          const flipCoin = () => {
            const pick = cryptoRand(2) === 0 ? duelParticipants[0] : duelParticipants[1];
            const label = `${pick?.name ?? "Player"} starts`;
            setBattleCoinState((prev) => ({ ...prev, [b.id]: { label, at: Date.now() } }));
            setTurnOrderForBattle(
              b,
              "duel",
              pick?.id ? [pick.id, duelParticipants.find((p) => p.id !== pick.id)?.id ?? pick.id] : [],
              label
            );
          };
          const pickTurnOrder = () => {
            const order = shuffleList(duelParticipants.map((p) => p.id));
            const firstName = duelParticipants.find((p) => p.id === order[0])?.name ?? "Player";
            const label = `${firstName} starts`;
            setTurnOrderForBattle(b, "duel", order, label);
            setBattleCoinState((prev) => ({ ...prev, [b.id]: { label, at: Date.now() } }));
          };
          return (
            <div key={b.id} style={{ ...battleCard(flashType, done), gridColumn: "1 / -1" }} onClick={() => null}>
              {battleCreateId === b.id ? (
                <div className="battle-card-intro">
                  <div className="battle-open-glow" />
                  <div className="battle-open-sword left" />
                  <div className="battle-open-sword right" />
                </div>
              ) : null}
              <div style={battleParticlesWrap()}>
                <Particles
                  id={`battle-particles-${b.id}`}
                  init={particlesInit}
                  options={battleParticlesOptions as any}
                  style={{ position: "absolute", inset: 0 }}
                />
              </div>
              <div style={{ ...battleCardContent(), ...(done ? { opacity: 0.55 } : null) }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeBattle(b.id);
                  }}
                  style={closeBtnBottom()}
                  title="Remove battle"
                >
                  ✖
                </button>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 1fr", alignItems: "center", gap: 14 }}>
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontWeight: 1000, fontSize: 24, textShadow: "0 0 16px rgba(59,130,246,0.35)" }}>
                    {b.left_name} <span style={{ fontSize: 13, opacity: 0.75 }}>Lv {b.left_level ?? 0} • {b.left_points ?? 0} pts</span>
                  </div>
                  {isSettled ? (
                    <div style={netPointsRow()}>
                      <div style={netPointsChangeChip(leftDelta)}>
                        <span>{formatPointsValue((b.left_points ?? 0) - leftDelta)}</span>
                        <span>{leftDelta >= 0 ? "▲" : "▼"}</span>
                        <span>{formatPointsValue(b.left_points)}</span>
                      </div>
                      <div style={netDeltaChip(leftDelta)}>{formatNetDelta(leftDelta)}</div>
                    </div>
                  ) : null}
                  {currentTurnId === b.left_student_id ? <div style={turnBadge()}>YOUR TURN</div> : null}
                  <div style={{ display: "inline-flex", alignItems: "baseline", gap: 6, fontWeight: 1000 }}>
                    <div style={{ fontSize: 30, color: "rgba(34,197,94,0.95)", textShadow: "0 0 12px rgba(34,197,94,0.35)" }}>
                      {leftSuccesses}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>({leftPotential})</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {Array.from({ length: b.repetitions_target }).map((_, i) => {
                      const filled = i < leftList.length;
                      const success = leftList[i] === true;
                      const bg = filled ? (success ? "rgba(34,197,94,0.85)" : "rgba(239,68,68,0.85)") : "rgba(148,163,184,0.30)";
                      return <span key={i} style={{ width: 14, height: 14, borderRadius: 999, background: bg, border: "1px solid rgba(255,255,255,0.20)" }} />;
                    })}
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!leftDone) logBattleAttempt(b.id, b.left_student_id, true);
                      }}
                      style={{ ...battleBtn("good", leftDone), width: 56, height: 56, fontSize: 22 }}
                    >
                      ✓
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!leftDone) logBattleAttempt(b.id, b.left_student_id, false);
                      }}
                      style={{ ...battleBtn("bad", leftDone), width: 56, height: 56, fontSize: 22 }}
                    >
                      ✕
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (leftCount > 0) undoBattleAttempt(b.id, b.left_student_id);
                      }}
                      style={{ ...battleUndoBtn(leftCount <= 0), width: 56, height: 56, fontSize: 18 }}
                      title="Undo"
                    >
                      ↩
                    </button>
                    <div style={{ display: "grid", alignItems: "center", fontSize: 13, fontWeight: 1000, opacity: 0.9 }}>
                      History {leftHistLabel}
                      <div style={{ fontSize: 11, opacity: 0.75 }}>30d {leftHist30Label}</div>
                    </div>
                  </div>
                </div>

                {done ? (
                  <div style={battlePulseActionsOverlay()}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openBattleResult(b);
                      }}
                      style={{ ...battlePulseActionBtn(), justifySelf: "end", marginRight: 30, pointerEvents: "auto" }}
                    >
                      Results
                    </button>
                    <div />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openRematch(b);
                      }}
                      style={{ ...battlePulseActionBtn("rematch"), justifySelf: "start", marginLeft: 30, pointerEvents: "auto" }}
                    >
                      Rematch
                    </button>
                  </div>
                ) : null}

                <div style={battleDivider()}>
                  <div
                    style={{
                      display: "grid",
                      placeItems: "center",
                      gap: 8,
                      padding: "14px 18px",
                      borderRadius: 18,
                      border: "1px solid rgba(255,255,255,0.18)",
                      background: "linear-gradient(180deg, rgba(15,23,42,0.75), rgba(2,6,23,0.65))",
                      minWidth: 220,
                      width: "fit-content",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 1000,
                        fontSize: 15,
                        letterSpacing: 2,
                        textShadow: "0 0 16px rgba(250,204,21,0.6)",
                        textAlign: "center",
                        width: "100%",
                        whiteSpace: "nowrap",
                        opacity: 0.95,
                      }}
                    >
                      BATTLE PULSE
                    </div>
                    <div className="battle-vs-glow">
                      <span className="battle-vs-icon">⚔️</span> VS <span className="battle-vs-icon">⚔️</span>
                    </div>
                    <div className="battle-turn-controls">
                      <button type="button" className="battle-coin-btn" onClick={flipCoin}>
                        COIN FLIP
                      </button>
                      <button type="button" className="battle-order-btn" onClick={pickTurnOrder}>
                        HELP ME PICK THE ORDER
                      </button>
                      {turnState?.order?.length ? (
                        <button type="button" className="battle-order-btn" onClick={() => nextBattleTurn(b.id)}>
                          NEXT TURN
                        </button>
                      ) : null}
                    </div>
                    {coinLabel ? <div className="battle-coin-result">{coinLabel}</div> : null}
                    {turnOrderNames ? <div className="battle-turn-order">Turn order: {turnOrderNames}</div> : null}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                  <div style={{ fontWeight: 1000, fontSize: 24, textShadow: "0 0 16px rgba(239,68,68,0.35)" }}>
                    {b.right_name} <span style={{ fontSize: 13, opacity: 0.75 }}>Lv {b.right_level ?? 0} • {b.right_points ?? 0} pts</span>
                  </div>
                  {isSettled ? (
                    <div style={netPointsRow(true)}>
                      <div style={netPointsChangeChip(rightDelta)}>
                        <span>{formatPointsValue((b.right_points ?? 0) - rightDelta)}</span>
                        <span>{rightDelta >= 0 ? "▲" : "▼"}</span>
                        <span>{formatPointsValue(b.right_points)}</span>
                      </div>
                      <div style={netDeltaChip(rightDelta)}>{formatNetDelta(rightDelta)}</div>
                    </div>
                  ) : null}
                  {currentTurnId === b.right_student_id ? <div style={turnBadge()}>YOUR TURN</div> : null}
                  <div style={{ display: "inline-flex", alignItems: "baseline", gap: 6, fontWeight: 1000 }}>
                    <div style={{ fontSize: 30, color: "rgba(34,197,94,0.95)", textShadow: "0 0 12px rgba(34,197,94,0.35)" }}>
                      {rightSuccesses}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>({rightPotential})</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {Array.from({ length: b.repetitions_target }).map((_, i) => {
                      const filled = i < rightList.length;
                      const success = rightList[i] === true;
                      const bg = filled ? (success ? "rgba(34,197,94,0.85)" : "rgba(239,68,68,0.85)") : "rgba(148,163,184,0.30)";
                      return <span key={i} style={{ width: 14, height: 14, borderRadius: 999, background: bg, border: "1px solid rgba(255,255,255,0.20)" }} />;
                    })}
                  </div>
                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", alignItems: "center" }}>
                    <div style={{ display: "grid", alignItems: "center", fontSize: 13, fontWeight: 1000, opacity: 0.9 }}>
                      History {rightHistLabel}
                      <div style={{ fontSize: 11, opacity: 0.75 }}>30d {rightHist30Label}</div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!rightDone) logBattleAttempt(b.id, b.right_student_id, true);
                      }}
                      style={{ ...battleBtn("good", rightDone), width: 56, height: 56, fontSize: 22 }}
                    >
                      ✓
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!rightDone) logBattleAttempt(b.id, b.right_student_id, false);
                      }}
                      style={{ ...battleBtn("bad", rightDone), width: 56, height: 56, fontSize: 22 }}
                    >
                      ✕
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (rightCount > 0) undoBattleAttempt(b.id, b.right_student_id);
                      }}
                      style={{ ...battleUndoBtn(rightCount <= 0), width: 56, height: 56, fontSize: 18 }}
                      title="Undo"
                    >
                      ↩
                    </button>
                  </div>
                </div>
                </div>

                <div style={{ marginTop: 10, opacity: 0.8, fontSize: 12, fontWeight: 900, textAlign: "center" }}>
                  {b.skill_name} • Reps {b.repetitions_target}
                  {b.wager_amount > 0
                    ? ` • Wager ${b.wager_amount} pts each • Net +${b.wager_amount} pts winner • -${b.wager_amount} pts loser`
                    : ` • +${b.points_per_rep ?? 5} pts per rep lead`}
                </div>
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                  Score: {leftList.filter((x) => x).length} - {rightList.filter((x) => x).length}
                </div>

                {done ? (
                  <div style={battleCompletedOverlay()}>
                    <div>Completed</div>
                    <div style={{ fontSize: 28, fontWeight: 1000 }}>
                      {b.winner_id
                        ? `Winner: ${b.winner_id === b.left_student_id ? b.left_name : b.winner_id === b.right_student_id ? b.right_name : "Winner"}`
                        : "Tie Game"}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}

        {groupedItems.map((item) => {
          if (item.type === "group") {
            const groupTrackers = item.trackers ?? [];
            const skillName = groupTrackers[0]?.skill_name ?? "Group Skill";
            const repsTarget = groupTrackers[0]?.repetitions_target ?? 0;
            return (
              <div key={`group-${item.group_id}`} style={{ ...groupCard(), gridColumn: "1 / -1", gridRow: "span 2" }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeGroup(item.group_id);
                  }}
                  style={groupCloseBtn()}
                  title="Remove group"
                >
                  ✖
                </button>
                <div style={groupHeader()}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontWeight: 1000, fontSize: 26, letterSpacing: 0.6 }}>Group Tracker</div>
                    <div style={{ fontSize: 14, opacity: 0.85, fontWeight: 900 }}>
                      {skillName} • Reps {repsTarget}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{item.trackers.length} students</div>
                  </div>
                </div>

                <div style={groupGrid()}>
                  {groupTrackers.map((t) => {
                    const attemptsCount = Number(t.attempts ?? 0);
                    const successesCount = Number(t.successes ?? 0);
                    const target = Number(t.repetitions_target ?? 0);
                    const done = target > 0 && attemptsCount >= target;
                    const rateVal = attemptsCount ? Math.round((successesCount / attemptsCount) * 100) : 0;
                    const lifetimeAttempts = Number(t.lifetime_attempts ?? 0);
                    const lifetimeSuccesses = Number(t.lifetime_successes ?? 0);
                    const lifetimeRate = lifetimeAttempts ? Math.round((lifetimeSuccesses / lifetimeAttempts) * 100) : 0;
                    const pointsPerRepBase = Math.max(1, Number(t.points_per_rep_base ?? t.points_per_rep ?? 2));
                    const pointsPerRepEffective = Math.max(1, Number(t.points_per_rep_effective ?? t.points_per_rep ?? pointsPerRepBase));
                    const hasPerRepBoost = pointsPerRepEffective !== pointsPerRepBase;
                    const perfectBonus = done && successesCount === target ? successesCount : 0;
                    const earnedPoints = done && pointsPerRepEffective > 0 ? successesCount * pointsPerRepEffective + perfectBonus : 0;
                    const viewOnly = isSkillUserSource(t) && ["admin", "coach"].includes(viewerRole);
                    const canEdit = !viewOnly;
                    const pendingCount = pendingLogCounts.current.get(t.id) ?? 0;
                    const avatarPath = t.avatar_path ?? "";
                    const avatarBg = t.avatar_bg ?? "rgba(0,0,0,0.4)";
                    const avatarEffect = t.avatar_effect ?? null;
                    const avatarSrc = avatarPath
                      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${avatarPath}`
                      : "";
                    const effectConfig = effectConfigByKey[avatarEffect ?? ""]?.config;
                    const borderAsset =
                      t.corner_border_url || t.corner_border_html || t.corner_border_css || t.corner_border_js
                        ? {
                            render_mode: t.corner_border_render_mode ?? "image",
                            image_url: t.corner_border_url ?? null,
                            html: t.corner_border_html ?? null,
                            css: t.corner_border_css ?? null,
                            js: t.corner_border_js ?? null,
                            offset_x: t.corner_border_offset_x ?? 0,
                            offset_y: t.corner_border_offset_y ?? 0,
                            offsets_by_context: t.corner_border_offsets_by_context ?? {},
                          }
                        : null;
                    const avatarSize = isTabletMode ? 120 : 96;
                    return (
                      <div
                        key={t.id}
                        style={groupMini(done, flash?.id === t.id ? flash.type : null, selectedTrackerId === t.id)}
                        onClick={() => setSelectedTrackerId(t.id)}
                      >
                        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 14, alignItems: "center" }}>
                          <div style={{ display: "grid", gap: 8, justifyItems: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontWeight: 900, fontSize: 16, textAlign: "center" }}>
                              <span>{t.student_name}</span>
                              {t.student_is_competition && compCrestUrl ? (
                                <img src={compCrestUrl} alt="Comp Crest" style={crestBadgeSmall()} />
                              ) : null}
                            </div>
                            <div
                              style={{
                                position: "relative",
                                width: avatarSize,
                                height: avatarSize,
                                display: "grid",
                                placeItems: "center",
                                borderRadius: 16,
                                background:
                                  "linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,64,175,0.35) 55%, rgba(16,185,129,0.25))",
                                border: "1px solid rgba(148,163,184,0.3)",
                                boxShadow: "0 18px 36px rgba(0,0,0,0.45), inset 0 0 18px rgba(59,130,246,0.25)",
                                overflow: "visible",
                                padding: 6,
                              }}
                            >
                              {t.card_plate_url ? (
                                <img src={t.card_plate_url} alt="" style={cardPlateStyle(plateOffsets)} />
                              ) : null}
                              <AvatarRender
                                size={avatarSize}
                                bg={avatarBg}
                                avatarSrc={avatarSrc}
                                border={borderAsset}
                                effect={avatarEffect ? { key: avatarEffect, config: effectConfig } : null}
                                cornerOffsets={cornerOffsets}
                                contextKey={avatarContextKey}
                                bleed={18}
                                style={{ borderRadius: 10 }}
                                fallback={<span style={{ fontSize: 12, opacity: 0.7 }}>{t.student_name.slice(0, 1)}</span>}
                              />
                            </div>
                          </div>
                          <div style={{ display: "grid", gap: 6, justifyItems: "end", textAlign: "right" }}>
                            <div style={{ fontSize: 34, fontWeight: 1000, textShadow: "0 0 18px rgba(34,197,94,0.25)" }}>
                              {rateVal}%
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 900, opacity: 0.9 }}>
                              {successesCount} successes
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.7 }}>
                              Reps {Math.min(attemptsCount, target)}/{target}
                            </div>
                            <div style={perRepBadgeWrap()}>
                              <div style={perRepBadgeLabel()}>PTS/REP</div>
                              <div style={perRepBadgeMain()}>
                                {hasPerRepBoost ? <span style={perRepBadgeStrike()}>{pointsPerRepBase}</span> : null}
                                <span style={perRepBadgeValue()}>{pointsPerRepEffective}</span>
                              </div>
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.7 }}>
                              Lv {t.student_level ?? 0} • {t.student_points ?? 0} pts
                            </div>
                          </div>
                        </div>
                        {done ? (
                          <div style={pointsAwardBox()} className="points-award-sparkle">
                            <span style={{ fontSize: 14, fontWeight: 1000, letterSpacing: 0.4 }}>🏆 Earned</span>
                            <span style={{ fontSize: 24, fontWeight: 1000 }}>+{earnedPoints} pts</span>
                          </div>
                        ) : null}
                        <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.85 }}>Skill history</div>
                        <div style={{ fontSize: 12, opacity: 0.75 }}>
                          Lifetime {lifetimeSuccesses}/{lifetimeAttempts} • {lifetimeRate}%
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>
                          30d {t.last30_successes ?? 0}/{t.last30_attempts ?? 0} • {t.last30_attempts ? t.last30_rate : 0}%
                        </div>
                        <div style={groupMiniDots(pendingCount > 0)}>
                          {Array.from({ length: Math.min(20, target) }).map((_, i) => {
                            const ev = (t.recent_attempts ?? [])[i];
                            const bg = ev ? (ev.success ? "rgba(34,197,94,0.85)" : "rgba(239,68,68,0.85)") : "rgba(148,163,184,0.35)";
                            return <span key={i} style={{ width: 18, height: 18, borderRadius: 999, background: bg, border: "1px solid rgba(255,255,255,0.18)", transition: "background-color 80ms linear, transform 80ms ease" }} />;
                          })}
                        </div>
                        {pendingCount > 0 ? (
                          <div style={{ fontSize: 11, opacity: 0.7 }}>Syncing {pendingCount}…</div>
                        ) : null}
                        <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!done && canEdit) logAttempt(t.id, true);
                            }}
                            style={groupMiniBtn("good", done || viewOnly)}
                            title="Success"
                          >
                            ✓
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!done && canEdit) logAttempt(t.id, false);
                            }}
                            style={groupMiniBtn("bad", done || viewOnly)}
                            title="Missed"
                          >
                            ✕
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (attemptsCount > 0 && canEdit) undoAttempt(t.id);
                            }}
                            style={groupMiniAction(attemptsCount <= 0 || viewOnly)}
                            title="Undo"
                          >
                            ↩
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openHistory(t);
                            }}
                            style={groupMiniAction(false)}
                            title="History"
                          >
                            🕘
                          </button>
                          {!isTabletMode ? (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openAnnotate(t);
                                }}
                                style={groupMiniAction(false)}
                                title="Annotate reps"
                              >
                                📝
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!done && canEdit) openEdit(t);
                                }}
                                style={groupMiniAction(done || viewOnly)}
                                title={done ? "Completed - use admin edit" : "Edit tracker"}
                              >
                                ✎
                              </button>
                              {viewOnly ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openQuickEdit(t);
                                  }}
                                  style={groupMiniAction(false)}
                                  title="Quick edit"
                                >
                                  ⚡
                                </button>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openAdminEdit(t);
                                  }}
                                  style={groupMiniAction(false)}
                                  title="Admin edit"
                                >
                                  🔒
                                </button>
                              )}
                            </>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {groupTrackers.length === 0 ? (
                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>No students yet</div>
                ) : null}
              </div>
            );
          }

          const t = item.tracker;
          const attemptsCount = Number(t.attempts ?? 0);
          const successesCount = Number(t.successes ?? 0);
          const target = Number(t.repetitions_target ?? 0);
          const remaining = Math.max(0, target - attemptsCount);
          const potential = successesCount + remaining;
          const rate = attemptsCount > 0 ? (successesCount / attemptsCount) * 100 : 0;
          const done = target > 0 && attemptsCount >= target;
          const attempts = t.recent_attempts ?? [];
          const flashType = flash?.id === t.id ? flash.type : null;
          const showWow = successesCount >= target && target > 0;
          const viewOnly = isSkillUserSource(t) && ["admin", "coach"].includes(viewerRole);
          const canEdit = !viewOnly;
          const canOpenEdit = canEdit && !isTabletMode;
          const pendingCount = pendingLogCounts.current.get(t.id) ?? 0;
          const avatarPath = t.avatar_path ?? "";
          const avatarBg = t.avatar_bg ?? "rgba(0,0,0,0.4)";
          const avatarEffect = t.avatar_effect ?? null;
          const avatarSrc = avatarPath
            ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${avatarPath}`
            : "";
          const effectConfig = effectConfigByKey[avatarEffect ?? ""]?.config;
          const borderAsset =
            t.corner_border_url || t.corner_border_html || t.corner_border_css || t.corner_border_js
              ? {
                  render_mode: t.corner_border_render_mode ?? "image",
                  image_url: t.corner_border_url ?? null,
                  html: t.corner_border_html ?? null,
                  css: t.corner_border_css ?? null,
                  js: t.corner_border_js ?? null,
                  offset_x: t.corner_border_offset_x ?? 0,
                  offset_y: t.corner_border_offset_y ?? 0,
                  offsets_by_context: t.corner_border_offsets_by_context ?? {},
                }
              : null;
          const avatarSize = isTabletMode ? 192 : 156;
          const lifetimeAttempts = Number(t.lifetime_attempts ?? 0);
          const lifetimeSuccesses = Number(t.lifetime_successes ?? 0);
          const lifetimeRate = lifetimeAttempts ? Math.round((lifetimeSuccesses / lifetimeAttempts) * 100) : 0;
          const pointsPerRepBase = Math.max(1, Number(t.points_per_rep_base ?? t.points_per_rep ?? 2));
          const pointsPerRepEffective = Math.max(1, Number(t.points_per_rep_effective ?? t.points_per_rep ?? pointsPerRepBase));
          const hasPerRepBoost = pointsPerRepEffective !== pointsPerRepBase;
          return (
            <div
              key={t.id}
              style={card(flashType, done, showWow, selectedTrackerId === t.id)}
              onClick={() => {
                setSelectedTrackerId(t.id);
              }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  requestRemoveTracker(t);
                }}
                style={closeBtn()}
                title="Remove tracker"
              >
                ✖
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!done && canEdit) logAttempt(t.id, true);
                }}
                style={sideBtn("left", done || viewOnly)}
                title="Success"
              >
                ✓
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!done && canEdit) logAttempt(t.id, false);
                }}
                style={sideBtn("right", done || viewOnly)}
                title="Missed"
              >
                ✕
              </button>

              <div style={{ display: "grid", gap: 6, textAlign: "center", padding: "0 46px" }}>
                <div style={{ fontWeight: 1000, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
                  <div
                    style={{
                      position: "relative",
                      width: avatarSize,
                      height: avatarSize,
                      display: "grid",
                      placeItems: "center",
                      borderRadius: 16,
                      background:
                        "linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,64,175,0.35) 55%, rgba(16,185,129,0.25))",
                      border: "1px solid rgba(148,163,184,0.3)",
                      boxShadow: "0 18px 36px rgba(0,0,0,0.45), inset 0 0 18px rgba(59,130,246,0.25)",
                      overflow: "visible",
                      padding: 8,
                    }}
                  >
                    {t.card_plate_url ? <img src={t.card_plate_url} alt="" style={cardPlateStyle(plateOffsets)} /> : null}
                    <AvatarRender
                      size={avatarSize}
                      bg={avatarBg}
                      avatarSrc={avatarSrc}
                      border={borderAsset}
                      effect={avatarEffect ? { key: avatarEffect, config: effectConfig } : null}
                      cornerOffsets={cornerOffsets}
                      contextKey={avatarContextKey}
                      bleed={22}
                      style={{ borderRadius: 12 }}
                      fallback={<span style={{ fontSize: 14, opacity: 0.7 }}>{t.student_name.slice(0, 1)}</span>}
                    />
                  </div>
                  <span>{t.student_name}</span>
                  {t.student_is_competition && compCrestUrl ? (
                    <img src={compCrestUrl} alt="Comp Crest" style={crestBadge()} />
                  ) : null}
                  <span style={{ fontSize: 11, opacity: 0.75 }}>Lv {t.student_level ?? 0} • {t.student_points ?? 0} pts</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!done && canOpenEdit) openEdit(t);
                  }}
                  style={{
                    appearance: "none",
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    margin: 0,
                    cursor: canOpenEdit ? "pointer" : "default",
                    font: "inherit",
                    color: "inherit",
                    opacity: 0.8,
                    fontSize: 13,
                  }}
                  type="button"
                >
                  {t.skill_name}
                </button>
                {viewOnly ? (
                  <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.7 }}>
                    Tablet Tracker
                  </div>
                ) : null}
                {t.failure_reasons?.length ? (
                  <div style={{ fontSize: 11, opacity: 0.7 }}>
                    Fail reasons: {t.failure_reasons.join(", ")}
                  </div>
                ) : null}
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <div style={perRepBadgeWrap()}>
                    <div style={perRepBadgeLabel()}>PTS/REP</div>
                    <div style={perRepBadgeMain()}>
                      {hasPerRepBoost ? <span style={perRepBadgeStrike()}>{pointsPerRepBase}</span> : null}
                      <span style={perRepBadgeValue()}>{pointsPerRepEffective}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "center", alignItems: "baseline", gap: 12, fontWeight: 1000 }}>
                  <div style={{ fontSize: 42, color: "rgba(34,197,94,0.95)", textShadow: "0 0 14px rgba(34,197,94,0.35)" }}>
                    {successesCount}
                  </div>
                  <div style={{ fontSize: 22, opacity: 0.85 }}>{Math.round(rate)}%</div>
                  <div style={{ fontSize: 14, opacity: 0.7 }}>({potential})</div>
                </div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>
                  Reps: <b>{Math.min(attemptsCount, target)}</b> / {target}
                </div>
                {done ? (
                  <div style={pointsAwardBox()} className="points-award-sparkle">
                    <span style={{ fontSize: 16, fontWeight: 1000, letterSpacing: 0.4 }}>🏆 Earned</span>
                    <span style={{ fontSize: 28, fontWeight: 1000 }}>{pointsEarnedLabel(t)}</span>
                  </div>
                ) : null}
                <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
                  {Array.from({ length: t.repetitions_target }).map((_, i) => {
                    const ev = attempts[i];
                    const bg = ev ? (ev.success ? "rgba(34,197,94,0.85)" : "rgba(239,68,68,0.85)") : "rgba(148,163,184,0.35)";
                    return <span key={i} style={{ width: 18, height: 18, borderRadius: 999, background: bg, border: "1px solid rgba(255,255,255,0.18)", transition: "background-color 80ms linear, transform 80ms ease" }} />;
                  })}
                </div>
                {pendingCount > 0 ? (
                  <div style={{ fontSize: 11, opacity: 0.7 }}>Syncing {pendingCount}…</div>
                ) : null}
                <div style={{ opacity: 0.8, fontSize: 12 }}>
                  Current: <b>{t.rate}%</b> • Last: <b>{t.last_rate}%</b>
                </div>
                <div style={{ opacity: 0.8, fontSize: 12 }}>
                  Lifetime: <b>{lifetimeSuccesses}/{lifetimeAttempts}</b> • <b>{lifetimeRate}%</b>
                </div>
                <div style={{ opacity: 0.8, fontSize: 12 }}>
                  30d: <b>{t.last30_successes ?? 0}/{t.last30_attempts ?? 0}</b> • <b>{t.last30_attempts ? t.last30_rate : 0}%</b>
                </div>
                {done ? (
                  <div style={{ fontSize: 11, opacity: 0.75 }}>Target reached</div>
                ) : null}
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openHistory(t);
                }}
                style={historyBtn()}
              >
                🕘 History
              </button>

              {!isTabletMode ? (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openAnnotate(t);
                    }}
                    style={annotateBtn()}
                    title="Annotate reps"
                  >
                    📝
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (t.attempts > 0 && canEdit) undoAttempt(t.id);
                    }}
                    style={undoBtn(t.attempts <= 0 || viewOnly)}
                    title="Undo last attempt"
                  >
                    ↩
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!done && canEdit) openEdit(t);
                    }}
                    style={editBtn(done || viewOnly)}
                    title={done ? "Completed - use admin edit" : "Edit tracker"}
                  >
                    ✎
                  </button>

                  {viewOnly ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openQuickEdit(t);
                      }}
                      style={adminBtn()}
                      title="Quick edit"
                    >
                      ⚡
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openAdminEdit(t);
                      }}
                      style={adminBtn()}
                      title="Admin edit"
                    >
                      🔒
                    </button>
                  )}
                </>
              ) : null}

              {done ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openResult(t);
                  }}
                  style={resultsBtn()}
                >
                  Results
                </button>
              ) : null}

                {done ? (
                  <>
                    <div style={completedOverlay()}>Completed</div>
                    <div style={completedPointsOverlay()}>{pointsEarnedLabel(t)}</div>
                  </>
                ) : null}
            </div>
          );
        })}
      </div>

      {openOverlay && (
        <Overlay
          title={editTrackerId ? "Edit Tracker" : "Add Tracker"}
          onClose={() => {
            setOpenOverlay(false);
            setAdminEditMode(false);
            setAdminUnlocked(false);
            setAdminPin("");
            setAdminLogs([]);
            setAdminMsg("");
          }}
        >
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={formLabel()}>Student</div>
              <div style={{ position: "relative" }}>
                <input
                  value={formStudentQuery}
                  onChange={(e) => {
                    setFormStudentQuery(e.target.value);
                    const match = students.find((s) => s.name.toLowerCase() === e.target.value.toLowerCase());
                    setFormStudentId(match?.id ?? "");
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    const suggestion = studentSuggestions(formStudentQuery)[0];
                    if (suggestion) {
                      setFormStudentId(suggestion.id);
                      setFormStudentQuery(suggestion.name);
                    }
                  }}
                  disabled={!!editTrackerId}
                  placeholder="Type student name"
                  style={select()}
                />
                {showFormStudentSuggestions ? (
                  <div style={suggestBox()}>
                    {formStudentSuggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setFormStudentId(s.id);
                          setFormStudentQuery(s.name);
                        }}
                        style={suggestItem()}
                      >
                        {renderStudentSuggestion(s)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={formLabel()}>Skill</div>
              <input
                value={formSkillSearch}
                onChange={(e) => setFormSkillSearch(e.target.value)}
                placeholder="Search skills"
                style={select()}
              />
              <select value={formSkillId} onChange={(e) => setFormSkillId(e.target.value)} style={select()}>
                <option value="">Select skill</option>
                {filteredFormSkillsByCategory.map(([cat, rows]) => (
                  <optgroup key={cat} label={cat}>
                    {rows.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={formLabel()}>Repetitions (1-20)</div>
              <input
                type="number"
                min={1}
                max={20}
                value={formReps}
                onChange={(e) => setFormReps(Math.max(1, Math.min(20, Number(e.target.value))))}
                style={select()}
              />
            </div>

            {editTrackerId ? (
              <div style={{ display: "grid", gap: 8, padding: "10px 12px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div style={{ fontWeight: 900 }}>Admin Edit</div>
                  {!adminEditMode ? (
                    <button onClick={() => setAdminEditMode(true)} style={btnGhost()}>
                      Enable Admin Edit
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setAdminEditMode(false);
                        setAdminUnlocked(false);
                        setAdminPin("");
                        setAdminLogs([]);
                        setAdminMsg("");
                      }}
                      style={btnGhost()}
                    >
                      Close Admin Edit
                    </button>
                  )}
                </div>

                {adminEditMode ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                      Admin edit unlocks rep result changes for completed trackers.
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: isCompactViewport ? "1fr" : "1fr auto", gap: 10 }}>
                      <input
                        type="password"
                        value={adminPin}
                        onChange={(e) => setAdminPin(e.target.value)}
                        placeholder="Admin PIN"
                        style={select()}
                      />
                      <button onClick={verifyAdminPin} style={btn()}>
                        {adminUnlocked ? "Unlocked" : "Unlock"}
                      </button>
                    </div>
                    {adminMsg ? <div style={{ fontSize: 12, color: "rgba(239,68,68,0.9)" }}>{adminMsg}</div> : null}

                    {adminUnlocked ? (
                      <div style={{ display: "grid", gap: 8 }}>
                        <div style={{ fontWeight: 900 }}>Rep Results</div>
                        <div style={{ display: "grid", gap: 8 }}>
                          {adminLogs.map((log, idx) => (
                            <div
                              key={log.id}
                              style={{
                                display: "grid",
                                gridTemplateColumns: isCompactViewport ? "1fr" : "80px 1fr auto auto",
                                gap: 10,
                                alignItems: "center",
                              }}
                            >
                              <div style={{ fontWeight: 800 }}>Rep {idx + 1}</div>
                              <div style={{ opacity: 0.75 }}>{log.success ? "Success" : "Failure"}</div>
                              <button
                                onClick={() => updateAdminLog("toggle", log)}
                                style={btnGhost()}
                                disabled={!!adminSaving[log.id]}
                              >
                                Toggle
                              </button>
                              <button
                                onClick={() => updateAdminLog("delete", log)}
                                style={btnGhost()}
                                disabled={!!adminSaving[log.id]}
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                          {!adminLogs.length ? <div style={{ opacity: 0.7 }}>No reps logged yet.</div> : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => {
                  setOpenOverlay(false);
                  setAdminEditMode(false);
                  setAdminUnlocked(false);
                  setAdminPin("");
                  setAdminLogs([]);
                  setAdminMsg("");
                }}
                style={btnGhost()}
              >
                Cancel
              </button>
              <button onClick={saveTracker} style={btn()}>
                Save
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {groupOpen && (
        <Overlay title="Group Tracker" onClose={() => setGroupOpen(false)}>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={formLabel()}>Skill</div>
              <input
                value={groupSkillSearch}
                onChange={(e) => setGroupSkillSearch(e.target.value)}
                placeholder="Search skills"
                style={select()}
              />
              <select value={groupSkillId} onChange={(e) => setGroupSkillId(e.target.value)} style={select()}>
                <option value="">Select skill</option>
                {filteredGroupSkillsByCategory.map(([cat, rows]) => (
                  <optgroup key={cat} label={cat}>
                    {rows.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={formLabel()}>Repetitions (1-20)</div>
              <input
                type="number"
                min={1}
                max={20}
                value={groupReps}
                onChange={(e) => setGroupReps(Math.max(1, Math.min(20, Number(e.target.value))))}
                style={select()}
              />
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={formLabel()}>Students</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{groupStudentIds.length} selected</div>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  value={groupStudentQuery}
                  onChange={(e) => setGroupStudentQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    const suggestion = studentSuggestions(groupStudentQuery, groupStudentIds)[0];
                    if (!suggestion) return;
                    setGroupStudentIds((prev) => [...prev, suggestion.id]);
                    setGroupStudentQuery("");
                  }}
                  placeholder="Type a student name and press Enter"
                  style={select()}
                />
                {studentSuggestions(groupStudentQuery, groupStudentIds).length > 0 ? (
                  <div style={suggestBox()}>
                    {studentSuggestions(groupStudentQuery, groupStudentIds).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setGroupStudentIds((prev) => [...prev, s.id]);
                          setGroupStudentQuery("");
                        }}
                        style={suggestItem()}
                      >
                        {renderStudentSuggestion(s)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {groupStudentIds.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setGroupStudentIds((prev) => prev.filter((sid) => sid !== id))}
                    style={chip()}
                  >
                    {getStudentName(id)} ✕
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setGroupOpen(false)} style={btnGhost()}>
                Cancel
              </button>
              <button onClick={saveGroupTracker} style={btn()}>
                Save Group
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {quickEditOpen && quickEditTracker && (
        <Overlay
          title="Quick Edit Reps"
          onClose={() => {
            setQuickEditOpen(false);
            setQuickEditTracker(null);
            setQuickEditLogs([]);
            setQuickEditSaving({});
          }}
        >
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 900 }}>
              {quickEditTracker.student_name} • {quickEditTracker.skill_name}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Tap a row to flip success/failure. Changes apply immediately.
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {quickEditLogs.map((log, idx) => (
                <button
                  key={log.id}
                  type="button"
                  onClick={() => updateQuickLog(log)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "70px 1fr auto",
                    gap: 10,
                    alignItems: "center",
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(15,23,42,0.6)",
                    color: "white",
                    textAlign: "left",
                    cursor: "pointer",
                    opacity: quickEditSaving[log.id] ? 0.6 : 1,
                  }}
                  disabled={!!quickEditSaving[log.id]}
                >
                  <span style={{ fontWeight: 900 }}>Rep {idx + 1}</span>
                  <span style={{ opacity: 0.75 }}>{log.success ? "Success" : "Failure"}</span>
                  <span style={{ fontWeight: 900 }}>{log.success ? "✓" : "✕"}</span>
                </button>
              ))}
              {!quickEditLogs.length ? <div style={{ opacity: 0.7 }}>No reps logged yet.</div> : null}
            </div>
          </div>
        </Overlay>
      )}

      {clearOpen && (
        <Overlay title="Clear Trackers" onClose={() => setClearOpen(false)}>
          <div style={{ display: "grid", gap: 12 }}>
            <label style={clearOption()}>
              <input
                type="checkbox"
                checked={clearCompleted}
                onChange={(e) => setClearCompleted(e.target.checked)}
              />
              Clear completed trackers
            </label>
            <label style={clearOption()}>
              <input
                type="checkbox"
                checked={clearCompletedBattles}
                onChange={(e) => setClearCompletedBattles(e.target.checked)}
              />
              Clear completed battle trackers only
            </label>
            <label style={clearOption()}>
              <input
                type="checkbox"
                checked={clearOld}
                onChange={(e) => setClearOld(e.target.checked)}
              />
              Clear trackers older than 24 hours
            </label>
            <label style={clearOption()}>
              <input
                type="checkbox"
                checked={clearAll}
                onChange={(e) => setClearAll(e.target.checked)}
              />
              Clear all trackers
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setClearOpen(false)} style={btnGhost()}>
                Cancel
              </button>
              <button onClick={clearTrackers} style={btn()} disabled={clearBusy}>
                {clearBusy ? "Clearing..." : "Submit"}
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {annotateOpen && annotateTracker && (
        <Overlay title="Annotate Reps" onClose={() => setAnnotateOpen(false)}>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ fontWeight: 1000 }}>
              {annotateTracker.student_name} • {annotateTracker.skill_name}
            </div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Select a reason for failed reps. Success reps stay blank.
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {(annotateTracker.recent_attempts ?? []).map((a, idx) => {
                const isSuccess = !!a.success;
                const selectedReasons = annotateDrafts[a.id] ?? parseReasons(a.failure_reason);
                return (
                  <div key={a.id || idx} style={annotateRow()}>
                    <div style={{ fontWeight: 900 }}>Rep {idx + 1}</div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                      {isSuccess ? "Success" : "Failure"}
                      {!isSuccess ? (
                        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                          Reasons: {selectedReasons.length ? selectedReasons.join(", ") : "—"}
                        </div>
                      ) : null}
                    </div>
                    <div style={{ position: "relative", display: "grid", justifyItems: "start" }}>
                      <button
                        onClick={() => {
                          if (isSuccess) return;
                          setOpenReasonId((prev) => (prev === a.id ? null : a.id));
                          setReasonQueries((prev) => ({ ...prev, [a.id]: "" }));
                        }}
                        disabled={isSuccess}
                        style={annotateReasonBtn(isSuccess)}
                        title="Set failure reason"
                      >
                        Reason
                      </button>
                      {openReasonId === a.id && !isSuccess && (
                        <div style={reasonPopover()}>
                          <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Failure Reason</div>
                          <div style={{ display: "grid", gap: 6 }}>
                            <input
                              value={reasonQueries[a.id] ?? ""}
                              onChange={(e) => setReasonQueries((prev) => ({ ...prev, [a.id]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key !== "Enter") return;
                                const nextLabel = String(reasonQueries[a.id] ?? "").trim();
                                if (!nextLabel) return;
                                const next = selectedReasons.includes(nextLabel)
                                  ? selectedReasons
                                  : [...selectedReasons, nextLabel];
                                setAnnotateDrafts((prev) => ({ ...prev, [a.id]: next }));
                                saveAnnotate(a.id, next);
                                setCustomReasons((prev) =>
                                  prev.some((r) => r.toLowerCase() === nextLabel.toLowerCase()) ? prev : [...prev, nextLabel]
                                );
                                setReasonQueries((prev) => ({ ...prev, [a.id]: "" }));
                              }}
                              placeholder="Type a reason and press Enter"
                              style={annotateSelect(false)}
                            />
                            {(() => {
                              const q = String(reasonQueries[a.id] ?? "").trim().toLowerCase();
                              const filtered = q
                                ? allFailureReasons.filter((r) => r.toLowerCase().includes(q))
                                : allFailureReasons;
                              return filtered;
                            })().map((r) => (
                              <button
                                key={r}
                                onClick={() => {
                                  const next = selectedReasons.includes(r)
                                    ? selectedReasons.filter((item) => item !== r)
                                    : [...selectedReasons, r];
                                  setAnnotateDrafts((prev) => ({ ...prev, [a.id]: next }));
                                  saveAnnotate(a.id, next);
                                }}
                                style={reasonOption(selectedReasons.includes(r))}
                              >
                                {r}
                              </button>
                            ))}
                            {(() => {
                              const q = String(reasonQueries[a.id] ?? "").trim();
                              if (!q) return null;
                              const exists = allFailureReasons.some((r) => r.toLowerCase() === q.toLowerCase());
                              if (exists) return null;
                              return (
                                <button
                                  onClick={() => {
                                    const next = selectedReasons.includes(q) ? selectedReasons : [...selectedReasons, q];
                                    setAnnotateDrafts((prev) => ({ ...prev, [a.id]: next }));
                                    saveAnnotate(a.id, next);
                                    setCustomReasons((prev) =>
                                      prev.some((r) => r.toLowerCase() === q.toLowerCase()) ? prev : [...prev, q]
                                    );
                                    setReasonQueries((prev) => ({ ...prev, [a.id]: "" }));
                                  }}
                                  style={reasonOption(false)}
                                >
                                  Add “{q}”
                                </button>
                              );
                            })()}
                            {!allFailureReasons.length && (
                              <div style={{ opacity: 0.7, fontSize: 12 }}>No reasons configured yet.</div>
                            )}
                          </div>
                          <div style={reasonPopoverCaret()} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {!annotateTracker.recent_attempts?.length && (
                <div style={{ opacity: 0.7 }}>No reps logged yet.</div>
              )}
            </div>
          </div>
        </Overlay>
      )}

      {historyOpen && historyTracker && (
        <Overlay title="Skill Pulse History" onClose={requestCloseHistory}>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ fontWeight: 1000 }}>
              {historyTracker.student_name} • {historyTracker.skill_name}
            </div>

            <TrendGraph logs={historyLogs} />

            <div style={{ display: "grid", gap: 8 }}>
              {historyLogs.map((h) => (
                <div key={h.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div style={{ fontWeight: 900 }}>
                    {h.rate}% ({h.successes}/{h.attempts || 0}){h.is_battle && h.vs_name ? ` • VS ${h.vs_name}` : ""}
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    {!h.is_battle && (
                      <button onClick={() => openRepLogs(h)} style={repBtn()}>
                        📝 Reps
                      </button>
                    )}
                    <div style={{ opacity: 0.7, fontSize: 12 }}>
                      {new Date(h.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
              {!historyLogs.length && <div style={{ opacity: 0.7 }}>No attempts yet.</div>}
            </div>
          </div>
        </Overlay>
      )}

      {historyAllOpen && (
        <Overlay title="Skill Pulse History" onClose={() => setHistoryAllOpen(false)}>
          <div style={{ display: "grid", gap: 12 }}>
            <TrendGraph logs={historyAllLogs} wide />
            <div style={{ display: "grid", gap: 8 }}>
              {historyAllLogs.map((h) => (
                <div key={h.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div style={{ fontWeight: 900 }}>
                    {h.rate}% ({h.successes}/{h.attempts || 0}){h.is_battle && h.vs_name ? ` • VS ${h.vs_name}` : ""}
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    {!h.is_battle && (
                      <button onClick={() => openRepLogs(h)} style={repBtn()}>
                        📝 Reps
                      </button>
                    )}
                    <div style={{ opacity: 0.7, fontSize: 12 }}>
                      {new Date(h.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
              {!historyAllLogs.length && <div style={{ opacity: 0.7 }}>No attempts yet.</div>}
            </div>
          </div>
        </Overlay>
      )}

      {repLogsOpen && (
        <Overlay title="Rep Annotations" onClose={() => setRepLogsOpen(false)}>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 1000 }}>{repTitle}</div>
            <div style={{ display: "grid", gap: 6 }}>
              {repLogs.map((r, idx) => (
                <div key={r.id} style={repRow()}>
                  <div style={{ fontWeight: 900 }}>Rep {idx + 1}</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>{r.success ? "Success" : "Failure"}</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>{r.failure_reason || "—"}</div>
                </div>
              ))}
              {!repLogs.length && <div style={{ opacity: 0.7 }}>No reps logged yet.</div>}
            </div>
          </div>
        </Overlay>
      )}

      {compareOpen && (
        <OverlayWide title="Compare Quest" onClose={() => setCompareOpen(false)}>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 1000 }}>Pick Skill</div>
              <input
                value={compareSkillSearch}
                onChange={(e) => setCompareSkillSearch(e.target.value)}
                placeholder="Search skills"
                style={select()}
              />
              <select value={compareSkillId} onChange={(e) => setCompareSkillId(e.target.value)} style={select()}>
                <option value="">Select skill</option>
                {filteredCompareSkills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 1000 }}>Add Students</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  list="compare-students"
                  value={compareInput}
                  onChange={(e) => setCompareInput(e.target.value)}
                  placeholder="Type or select a student…"
                  style={{ ...select(), minWidth: 260 }}
                />
                <datalist id="compare-students">
                  {students.map((s) => (
                    <option key={s.id} value={s.name} />
                  ))}
                </datalist>
                <button
                  onClick={() => {
                    const match = students.find(
                      (s) => s.name.toLowerCase() === compareInput.toLowerCase()
                    );
                    addCompareStudent(match?.id ?? "");
                  }}
                  style={btn()}
                >
                  Add
                </button>
                <button onClick={runCompare} style={btnGhost()}>
                  Run Compare
                </button>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {compareStudentIds.map((id) => {
                  const s = students.find((x) => x.id === id);
                  return (
                    <span key={id} style={chip()}>
                      {s?.name ?? "Student"}
                      <button onClick={() => removeCompareStudent(id)} style={chipX()}>
                        ✕
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>

            <ComparePanel series={compareSeries} effectConfigByKey={effectConfigByKey} />
          </div>
        </OverlayWide>
      )}

      {battleOpen && (
        <OverlayWide title="Battle Pulse" onClose={() => setBattleOpen(false)}>
          <div style={{ display: "grid", gap: 12, fontSize: 14 }}>
            {battleIntroOpen ? (
              <div className="battle-open-intro">
                <div className="battle-open-glow" />
                <div className="battle-open-sword left" />
                <div className="battle-open-sword right" />
                <div className="battle-open-label">Battle Pulse</div>
              </div>
            ) : null}
            <div style={{ display: "grid", gap: 6 }}>
              <div style={formLabel()}>Battle Mode</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => setBattleMode("duel")} style={modeBtn(battleMode === "duel")}>
                  2-Person
                </button>
                <button onClick={() => setBattleMode("ffa")} style={modeBtn(battleMode === "ffa")}>
                  6-Way Free-For-All
                </button>
                <button onClick={() => setBattleMode("teams")} style={modeBtn(battleMode === "teams")}>
                  Teams
                </button>
                <button onClick={() => setBattleMode("lanes")} style={modeBtn(battleMode === "lanes")}>
                  Skill Lanes
                </button>
              </div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                No max students. Wager is per participant; pool splits evenly among winners. Ties = no winner.
              </div>
            </div>

            {battleMode === "duel" ? (
              <div style={{ display: "grid", gridTemplateColumns: isCompactViewport ? "1fr" : "1fr 1fr", gap: 12 }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={formLabel()}>Left Student</div>
                  <div style={{ position: "relative" }}>
                    <input
                      value={battleLeftQuery}
                      onChange={(e) => {
                        setBattleLeftQuery(e.target.value);
                        const match = students.find((s) => s.name.toLowerCase() === e.target.value.toLowerCase());
                        setBattleLeftId(match?.id ?? "");
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        const suggestion = studentSuggestions(battleLeftQuery, [battleRightId].filter(Boolean));
                        if (suggestion[0]) {
                          setBattleLeftId(suggestion[0].id);
                          setBattleLeftQuery(suggestion[0].name);
                        }
                      }}
                      placeholder="Type student name"
                      style={select()}
                    />
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                      Balance: {battleLeftBalance} pts
                    </div>
                    {showBattleLeftSuggestions ? (
                      <div style={suggestBox()}>
                        {battleLeftSuggestions.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setBattleLeftId(s.id);
                              setBattleLeftQuery(s.name);
                            }}
                            style={suggestItem()}
                          >
                            {renderStudentSuggestion(s)}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={formLabel()}>Right Student</div>
                  <div style={{ position: "relative" }}>
                    <input
                      value={battleRightQuery}
                      onChange={(e) => {
                        setBattleRightQuery(e.target.value);
                        const match = students.find((s) => s.name.toLowerCase() === e.target.value.toLowerCase());
                        setBattleRightId(match?.id ?? "");
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        const suggestion = studentSuggestions(battleRightQuery, [battleLeftId].filter(Boolean));
                        if (suggestion[0]) {
                          setBattleRightId(suggestion[0].id);
                          setBattleRightQuery(suggestion[0].name);
                        }
                      }}
                      placeholder="Type student name"
                      style={select()}
                    />
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                      Balance: {battleRightBalance} pts
                    </div>
                    {showBattleRightSuggestions ? (
                      <div style={suggestBox()}>
                        {battleRightSuggestions.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setBattleRightId(s.id);
                              setBattleRightQuery(s.name);
                            }}
                            style={suggestItem()}
                          >
                            {renderStudentSuggestion(s)}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : battleMode === "ffa" ? (
              <div style={{ display: "grid", gap: 8 }}>
                <div style={formLabel()}>Participants (2-4)</div>
                <div style={{ position: "relative" }}>
                  <input
                    value={battleParticipantQuery}
                    onChange={(e) => setBattleParticipantQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      const suggestion = studentSuggestions(battleParticipantQuery, battleParticipantIdsState);
                      if (suggestion[0]) {
                        addBattleParticipant(suggestion[0].id);
                        setBattleParticipantQuery("");
                      }
                    }}
                    placeholder="Type student name"
                    style={select()}
                  />
                  {showBattleParticipantSuggestions ? (
                    <div style={suggestBox()}>
                      {battleParticipantSuggestions.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            addBattleParticipant(s.id);
                            setBattleParticipantQuery("");
                          }}
                          style={suggestItem()}
                        >
                          {renderStudentSuggestion(s)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {battleParticipantIdsState.map((id) => {
                    const s = students.find((x) => x.id === id);
                    return (
                      <span key={id} style={chip()}>
                        {s?.name ?? "Student"}
                        <button onClick={() => removeBattleParticipant(id)} style={chipX()}>
                          ✕
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : battleMode === "lanes" ? (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: isCompactViewport ? "1fr" : "1fr 1fr", gap: 12 }}>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={formLabel()}>Team A (min 2)</div>
                    <div style={{ position: "relative" }}>
                      <input
                        value={battleTeamAQuery}
                        onChange={(e) => setBattleTeamAQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          const suggestion = studentSuggestions(battleTeamAQuery, battleTeamTakenIds);
                          if (suggestion[0]) {
                            addBattleTeamMember("a", suggestion[0].id);
                            setBattleTeamAQuery("");
                          }
                        }}
                        placeholder="Add team A student"
                        style={select()}
                      />
                      {showBattleTeamASuggestions ? (
                        <div style={suggestBox()}>
                          {battleTeamASuggestions.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                addBattleTeamMember("a", s.id);
                                setBattleTeamAQuery("");
                              }}
                              style={suggestItem()}
                            >
                              {renderStudentSuggestion(s)}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {battleTeamAIds.map((id) => {
                        const s = students.find((x) => x.id === id);
                        return (
                          <span key={id} style={chip()}>
                            {s?.name ?? "Student"}
                            <button onClick={() => removeBattleTeamMember("a", id)} style={chipX()}>
                              ✕
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={formLabel()}>Team B (min 2)</div>
                    <div style={{ position: "relative" }}>
                      <input
                        value={battleTeamBQuery}
                        onChange={(e) => setBattleTeamBQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          const suggestion = studentSuggestions(battleTeamBQuery, battleTeamTakenIds);
                          if (suggestion[0]) {
                            addBattleTeamMember("b", suggestion[0].id);
                            setBattleTeamBQuery("");
                          }
                        }}
                        placeholder="Add team B student"
                        style={select()}
                      />
                      {showBattleTeamBSuggestions ? (
                        <div style={suggestBox()}>
                          {battleTeamBSuggestions.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                addBattleTeamMember("b", s.id);
                                setBattleTeamBQuery("");
                              }}
                              style={suggestItem()}
                            >
                              {renderStudentSuggestion(s)}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {battleTeamBIds.map((id) => {
                        const s = students.find((x) => x.id === id);
                        return (
                          <span key={id} style={chip()}>
                            {s?.name ?? "Student"}
                            <button onClick={() => removeBattleTeamMember("b", id)} style={chipX()}>
                              ✕
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <div style={formLabel()}>Skill Lanes Categories (min 1)</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {skillsByCategory.map(([cat]) => {
                      const active = battleLaneCategories.includes(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() =>
                            setBattleLaneCategories((prev) => {
                              if (prev.includes(cat)) {
                                setBattleLaneSkills((skills) => {
                                  const copy = { ...skills };
                                  delete copy[cat];
                                  return copy;
                                });
                                setBattleLaneAssignments((assignments) => {
                                  const next: Record<string, string[]> = {};
                                  Object.entries(assignments).forEach(([id, list]) => {
                                    const cleaned = normalizeLaneCategoryList(list).filter((entry) => entry !== cat);
                                    if (cleaned.length) next[id] = cleaned;
                                  });
                                  return next;
                                });
                                return prev.filter((c) => c !== cat);
                              }
                              return [...prev, cat];
                            })
                          }
                          style={chip(active)}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <div style={formLabel()}>Assign Categories Per Player (multi-select)</div>
                  <div style={{ display: "grid", gridTemplateColumns: isCompactViewport ? "1fr" : "1fr 1fr", gap: 12 }}>
                    {(["a", "b"] as const).map((teamKey) => {
                      const teamIds = teamKey === "a" ? battleTeamAIds : battleTeamBIds;
                      return (
                        <div
                          key={teamKey}
                          style={{
                            display: "grid",
                            gap: 8,
                            padding: 10,
                            borderRadius: 12,
                            border: "1px solid rgba(255,255,255,0.12)",
                            background: "rgba(2,6,23,0.45)",
                          }}
                        >
                          <div style={{ fontWeight: 900, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.75 }}>
                            Team {teamKey === "a" ? "A" : "B"}
                          </div>
                          <div style={{ display: "grid", gap: 8 }}>
                            {teamIds.map((id) => {
                              const s = students.find((x) => x.id === id);
                              const selected = getAssignedLaneCategories(battleLaneAssignments, id);
                              return (
                                <div key={id} style={{ display: "grid", gap: 6 }}>
                                  <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.85 }}>
                                    {s?.name ?? "Student"}
                                  </div>
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                    {battleLaneCategories.map((cat) => {
                                      const active = selected.includes(cat);
                                      const allowed = canAssignLaneCategory(teamIds, id, cat);
                                      const color = laneColor(cat, battleLaneCategories);
                                      return (
                                        <button
                                          key={cat}
                                          type="button"
                                          onClick={() => {
                                            if (!allowed) return;
                                            setBattleLaneAssignments((prev) => {
                                              const current = getAssignedLaneCategories(prev, id);
                                              const next = current.includes(cat)
                                                ? current.filter((entry) => entry !== cat)
                                                : [...current, cat];
                                              return { ...prev, [id]: next };
                                            });
                                          }}
                                          style={{
                                            padding: "4px 10px",
                                            borderRadius: 999,
                                            border: `1px solid ${active ? color : "rgba(255,255,255,0.18)"}`,
                                            background: active ? `linear-gradient(135deg, ${color}, rgba(15,23,42,0.6))` : "rgba(15,23,42,0.5)",
                                            color: active ? "#0b0f19" : "white",
                                            fontSize: 11,
                                            fontWeight: 900,
                                            letterSpacing: "0.08em",
                                            textTransform: "uppercase",
                                            opacity: allowed ? 1 : 0.35,
                                            cursor: allowed ? "pointer" : "not-allowed",
                                            boxShadow: active ? `0 0 12px ${color}` : "none",
                                          }}
                                          title={!allowed ? "Category not available" : ""}
                                        >
                                          {cat}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <div style={formLabel()}>Select Skills Per Category (min {laneSkillMin})</div>
                  <div style={{ display: "grid", gap: 12 }}>
                    {battleLaneCategories.map((cat) => {
                      const row = skillsByCategory.find(([name]) => name === cat);
                      const skillsForCat = row ? row[1] : [];
                      const selectedSkills = battleLaneSkills[cat] ?? [];
                      return (
                        <div key={cat} style={{ padding: 10, borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)" }}>
                          <div style={{ fontWeight: 900, marginBottom: 6 }}>{cat}</div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 6 }}>
                            {skillsForCat.map((skill) => {
                              const checked = selectedSkills.includes(skill.id);
                              return (
                                <label key={skill.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() =>
                                      setBattleLaneSkills((prev) => {
                                        const list = prev[cat] ?? [];
                                        const next = checked ? list.filter((id) => id !== skill.id) : [...list, skill.id];
                                        return { ...prev, [cat]: next };
                                      })
                                    }
                                  />
                                  <span>{skill.name}</span>
                                </label>
                              );
                            })}
                          </div>
                          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 6 }}>
                            Selected: {selectedSkills.length}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {battleMode === "lanes" && laneErrors.length ? (
                  <div style={{ color: "rgba(248,113,113,0.95)", fontWeight: 900, fontSize: 12 }}>
                    {laneErrors.map((err) => (
                      <div key={err}>{err}</div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: isCompactViewport ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={formLabel()}>Team A</div>
                  <div style={{ position: "relative" }}>
                    <input
                      value={battleTeamAQuery}
                      onChange={(e) => setBattleTeamAQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        const suggestion = studentSuggestions(battleTeamAQuery, battleTeamTakenIds);
                        if (suggestion[0]) {
                          addBattleTeamMember("a", suggestion[0].id);
                          setBattleTeamAQuery("");
                        }
                      }}
                      placeholder="Add team A student"
                      style={select()}
                    />
                    {showBattleTeamASuggestions ? (
                      <div style={suggestBox()}>
                        {battleTeamASuggestions.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              addBattleTeamMember("a", s.id);
                              setBattleTeamAQuery("");
                            }}
                            style={suggestItem()}
                          >
                            {renderStudentSuggestion(s)}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {battleTeamAIds.map((id) => {
                      const s = students.find((x) => x.id === id);
                      return (
                        <span key={id} style={chip()}>
                          {s?.name ?? "Student"}
                          <button onClick={() => removeBattleTeamMember("a", id)} style={chipX()}>
                            ✕
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={formLabel()}>Team B</div>
                  <div style={{ position: "relative" }}>
                    <input
                      value={battleTeamBQuery}
                      onChange={(e) => setBattleTeamBQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        const suggestion = studentSuggestions(battleTeamBQuery, battleTeamTakenIds);
                        if (suggestion[0]) {
                          addBattleTeamMember("b", suggestion[0].id);
                          setBattleTeamBQuery("");
                        }
                      }}
                      placeholder="Add team B student"
                      style={select()}
                    />
                    {showBattleTeamBSuggestions ? (
                      <div style={suggestBox()}>
                        {battleTeamBSuggestions.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              addBattleTeamMember("b", s.id);
                              setBattleTeamBQuery("");
                            }}
                            style={suggestItem()}
                          >
                            {renderStudentSuggestion(s)}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {battleTeamBIds.map((id) => {
                      const s = students.find((x) => x.id === id);
                      return (
                        <span key={id} style={chip()}>
                          {s?.name ?? "Student"}
                          <button onClick={() => removeBattleTeamMember("b", id)} style={chipX()}>
                            ✕
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={formLabel()}>Team C</div>
                  <div style={{ position: "relative" }}>
                    <input
                      value={battleTeamCQuery}
                      onChange={(e) => setBattleTeamCQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        const suggestion = studentSuggestions(battleTeamCQuery, battleTeamTakenIds);
                        if (suggestion[0]) {
                          addBattleTeamMember("c", suggestion[0].id);
                          setBattleTeamCQuery("");
                        }
                      }}
                      placeholder="Add team C student"
                      style={select()}
                    />
                    {showBattleTeamCSuggestions ? (
                      <div style={suggestBox()}>
                        {battleTeamCSuggestions.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              addBattleTeamMember("c", s.id);
                              setBattleTeamCQuery("");
                            }}
                            style={suggestItem()}
                          >
                            {renderStudentSuggestion(s)}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {battleTeamCIds.map((id) => {
                      const s = students.find((x) => x.id === id);
                      return (
                        <span key={id} style={chip()}>
                          {s?.name ?? "Student"}
                          <button onClick={() => removeBattleTeamMember("c", id)} style={chipX()}>
                            ✕
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={formLabel()}>Team D</div>
                  <div style={{ position: "relative" }}>
                    <input
                      value={battleTeamDQuery}
                      onChange={(e) => setBattleTeamDQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        const suggestion = studentSuggestions(battleTeamDQuery, battleTeamTakenIds);
                        if (suggestion[0]) {
                          addBattleTeamMember("d", suggestion[0].id);
                          setBattleTeamDQuery("");
                        }
                      }}
                      placeholder="Add team D student"
                      style={select()}
                    />
                    {showBattleTeamDSuggestions ? (
                      <div style={suggestBox()}>
                        {battleTeamDSuggestions.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              addBattleTeamMember("d", s.id);
                              setBattleTeamDQuery("");
                            }}
                            style={suggestItem()}
                          >
                            {renderStudentSuggestion(s)}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {battleTeamDIds.map((id) => {
                      const s = students.find((x) => x.id === id);
                      return (
                        <span key={id} style={chip()}>
                          {s?.name ?? "Student"}
                          <button onClick={() => removeBattleTeamMember("d", id)} style={chipX()}>
                            ✕
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: "grid", gap: 6 }}>
              <div style={formLabel()}>Skill</div>
              <input
                value={battleSkillSearch}
                onChange={(e) => setBattleSkillSearch(e.target.value)}
                placeholder="Search skills"
                style={select()}
              />
              <select value={battleSkillId} onChange={(e) => setBattleSkillId(e.target.value)} style={select()}>
                <option value="">Select skill</option>
                {filteredBattleSkillsByCategory.map(([cat, rows]) => (
                  <optgroup key={cat} label={cat}>
                    {rows.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {battleMode === "lanes" ? (
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  Skill Lanes uses categories per player. This skill is a default label for stats.
                </div>
              ) : null}
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={formLabel()}>Repetitions (1-20)</div>
              <input
                type="number"
                min={1}
                max={20}
                value={battleReps}
                onChange={(e) => {
                  const next = Math.max(1, Math.min(20, Number(e.target.value)));
                  setBattleReps(next);
                  if (!battleWagerOn) {
                    const maxPerRep = battleMinBalance > 0 ? Math.floor(battleMinBalance / Math.max(1, next)) : 0;
                    if (maxPerRep >= 3) {
                      setBattlePointsPerRep((prev) => Math.max(3, Math.min(maxPerRep, prev)));
                    }
                  }
                }}
                style={select()}
              />
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <div style={formLabel()}>Mode</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => setBattleWagerOn(false)}
                  style={modeBtn(!battleWagerOn)}
                  disabled={battleMode === "ffa"}
                >
                  Normal
                </button>
                <button onClick={() => setBattleWagerOn(true)} style={modeBtn(battleWagerOn)}>
                  Wager
                </button>
              </div>
              {battleMode === "ffa" ? (
                <div style={{ fontSize: 12, opacity: 0.75 }}>FFA requires wager mode.</div>
              ) : null}

              {battleWagerOn ? (
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={formLabel()}>Wager Amount (max 100)</div>
                    <input
                      type="number"
                      min={15}
                      max={100}
                      value={battleWagerAmount}
                      onChange={(e) => {
                        const raw = Number(e.target.value);
                        const maxAffordable = battleMinBalance > 0 ? Math.min(battleMinBalance, battleMaxWager) : battleMaxWager;
                        const next = Math.max(battleMinWager, Math.min(maxAffordable, raw));
                        setBattleWagerAmount(Number.isFinite(next) ? next : 0);
                      }}
                      style={select()}
                    />
                  </div>
                  <div style={{ opacity: 0.75, fontSize: 12 }}>
                    Pool: {battleWagerAmount * Math.max(2, battleParticipantIds.length || 2)} pts • Split among winners
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={formLabel()}>Points per rep lead (min 3)</div>
                    <input
                      type="number"
                      min={3}
                      max={50}
                      value={battlePointsPerRep}
                      onChange={(e) => {
                        const raw = Number(e.target.value);
                        const maxPerRep = battleNormalMaxPerRep >= 3 ? battleNormalMaxPerRep : 3;
                        const next = Math.max(3, Math.min(maxPerRep, Math.min(50, raw)));
                        setBattlePointsPerRep(Number.isFinite(next) ? next : 3);
                      }}
                      style={select()}
                    />
                  </div>
                  <div style={{ opacity: 0.75, fontSize: 12 }}>
                    Winner earns {Math.max(3, battlePointsPerRep)} pts per rep lead from the loser.
                  </div>
                </div>
              )}

              {battleWagerOn ? (
                <div style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.8 }}>
                  {battleWagerInsufficient ? (
                    <div>⚠️ All participants need at least 15 points to wager.</div>
                  ) : null}
                  {battleWagerTooLow ? <div>⚠️ Minimum wager is 15 pts.</div> : null}
                  {battleWagerAmount >= battleMaxWager ? (
                    <div>⚠️ Max wager is 100 pts; higher values are capped.</div>
                  ) : null}
                  {battleWagerAllIn ? (
                    <div>⚠️ All-in wager based on lowest balance.</div>
                  ) : null}
                </div>
              ) : (
                <div style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.8 }}>
                  {battleNormalMaxPerRep > 0 ? (
                    <div>Max per rep based on lowest balance: {battleNormalMaxPerRep}</div>
                  ) : null}
                  {battleNormalInsufficient ? (
                    <div>⚠️ Not enough balance for min 3 per rep (needs {battleReps * 3} pts).</div>
                  ) : null}
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setBattleOpen(false)} style={btnGhost()}>
                Cancel
              </button>
              <button
                onClick={requestSaveBattle}
                style={{ ...btn(), opacity: battleCreateDisabled ? 0.5 : 1, cursor: battleCreateDisabled ? "not-allowed" : "pointer" }}
                disabled={battleCreateDisabled}
              >
                Create Battle
              </button>
            </div>
          </div>
        </OverlayWide>
      )}

      {resultOpen && resultTracker && (
        <Overlay title="Skill Pulse Results" onClose={() => setResultOpen(false)}>
          <div style={{ display: "grid", gap: 12, background: "rgba(0,0,0,0.75)", borderRadius: 16, padding: 12, border: "1px solid rgba(255,255,255,0.12)" }}>
            <div style={{ fontWeight: 1000 }}>
              {resultTracker.student_name} • {resultTracker.skill_name}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(resultTracker.recent_attempts ?? []).map((a, i) => (
                <span
                  key={i}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 999,
                    background: a.success ? "rgba(34,197,94,0.85)" : "rgba(239,68,68,0.85)",
                    border: "1px solid rgba(255,255,255,0.18)",
                  }}
                />
              ))}
            </div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              ✓ {resultTracker.successes} • ✕ {Math.max(0, resultTracker.attempts - resultTracker.successes)} • {resultTracker.successes} pts • Reps {resultTracker.attempts}/{resultTracker.repetitions_target}
            </div>
          </div>
        </Overlay>
      )}

      {battleResultOpen && battleResult && (
        <Overlay title="Battle Pulse Results" onClose={() => setBattleResultOpen(false)}>
          <div
            style={{
              display: "grid",
              gap: 12,
              background: "linear-gradient(135deg, rgba(15,23,42,0.92), rgba(2,6,23,0.78))",
              borderRadius: 16,
              padding: 14,
              border: "1px solid rgba(255,255,255,0.14)",
              boxShadow: "0 0 26px rgba(59,130,246,0.22)",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 1fr", gap: 10, alignItems: "center" }}>
              <ResultSide
                name={battleResult.left_name}
                avatarPath={battleResult.left_avatar_path ?? ""}
                avatarBg={battleResult.left_avatar_bg ?? "rgba(0,0,0,0.4)"}
                avatarEffect={battleResult.left_avatar_effect ?? null}
                effectConfig={effectConfigByKey[battleResult.left_avatar_effect ?? ""]?.config}
                successes={battleResult.left_attempts_list?.filter((x) => x).length ?? 0}
                attempts={battleResult.left_attempts_list?.length ?? 0}
              />
              <div className="battle-vs-glow" style={{ textAlign: "center" }}>
                <span className="battle-vs-icon">⚔️</span> VS <span className="battle-vs-icon">⚔️</span>
              </div>
              <ResultSide
                name={battleResult.right_name}
                avatarPath={battleResult.right_avatar_path ?? ""}
                avatarBg={battleResult.right_avatar_bg ?? "rgba(0,0,0,0.4)"}
                avatarEffect={battleResult.right_avatar_effect ?? null}
                effectConfig={effectConfigByKey[battleResult.right_avatar_effect ?? ""]?.config}
                successes={battleResult.right_attempts_list?.filter((x) => x).length ?? 0}
                attempts={battleResult.right_attempts_list?.length ?? 0}
              />
            </div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              Skill: {battleResult.skill_name} • Reps {battleResult.repetitions_target}
            </div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              {battleWinnerLabel(battleResult)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 12 }}>
              <div style={{ textAlign: "left" }}>{battlePointsSummary(battleResult).left}</div>
              <div style={{ textAlign: "right" }}>{battlePointsSummary(battleResult).right}</div>
            </div>
          </div>
        </Overlay>
      )}

      {confirmOpen && (
        <ConfirmOverlay
          message={confirmMsg}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => {
            setConfirmOpen(false);
            confirmAction?.();
            setConfirmAction(null);
          }}
        />
      )}
        </div>

        {!isTabletMode && (
          <aside style={{ position: "sticky", top: 88, display: "grid", gap: 12 }}>
            <div style={{ fontWeight: 1000 }}>Pulse Log</div>
            <div style={{ display: "grid", gap: 10 }}>
              {feed.map((f, i) => (
                <div key={`${f.created_at}-${i}`} style={feedCard()}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={feedChip(f.type)}>{feedLabel(f.type)}</span>
                    <span style={{ fontSize: 10, opacity: 0.55, letterSpacing: 0.4 }}>
                      {new Date(f.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ fontWeight: 900 }}>{f.title}</div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>{f.subtitle}</div>
                </div>
              ))}
              {!feed.length && <div style={{ opacity: 0.7, fontSize: 12 }}>No recent activity.</div>}
            </div>
          </aside>
        )}
      </div>
      </main>
      <style>{`
      @keyframes battlePulseShift {
        0% {
          background-position: 0% 50%;
        }
        50% {
          background-position: 100% 50%;
        }
        100% {
          background-position: 0% 50%;
        }
      }
      @keyframes pendingPulse {
        0% { box-shadow: 0 0 10px rgba(59,130,246,0.25); }
        50% { box-shadow: 0 0 20px rgba(59,130,246,0.45); }
        100% { box-shadow: 0 0 10px rgba(59,130,246,0.25); }
      }
      @keyframes completedPulse {
        0% { transform: scale(1); opacity: 0.85; }
        50% { transform: scale(1.02); opacity: 1; }
        100% { transform: scale(1); opacity: 0.85; }
      }
      @keyframes sparkleTwinkle {
        0% { opacity: 0.25; filter: blur(0px); }
        50% { opacity: 0.85; filter: blur(0.5px); }
        100% { opacity: 0.25; filter: blur(0px); }
      }
      .points-award-sparkle {
        position: relative;
        overflow: hidden;
      }
      .points-award-sparkle::after {
        content: "";
        position: absolute;
        inset: -20%;
        background:
          radial-gradient(circle at 20% 30%, rgba(255,255,255,0.8) 0 2px, transparent 3px),
          radial-gradient(circle at 80% 25%, rgba(34,197,94,0.9) 0 2px, transparent 3px),
          radial-gradient(circle at 30% 80%, rgba(59,130,246,0.8) 0 2px, transparent 3px),
          radial-gradient(circle at 70% 75%, rgba(250,204,21,0.85) 0 2px, transparent 3px);
        animation: sparkleTwinkle 1.4s ease-in-out infinite;
        opacity: 0.65;
        pointer-events: none;
        mix-blend-mode: screen;
      }
      .points-award-sparkle::before {
        content: "★";
        position: absolute;
        left: 50%;
        top: 50%;
        font-size: 14px;
        color: rgba(250,204,21,0.9);
        text-shadow: 0 0 12px rgba(250,204,21,0.7);
        animation: starBurst 1.4s ease-out infinite;
        pointer-events: none;
      }
      @keyframes starBurst {
        0% { transform: translate(-50%, -50%) scale(0.6); opacity: 0; }
        30% { opacity: 1; }
        100% { transform: translate(-50%, -140%) scale(1.4); opacity: 0; }
      }
      .battle-open-intro {
        position: relative;
        height: 120px;
        border-radius: 18px;
        border: 1px solid rgba(255,255,255,0.12);
        background:
          radial-gradient(circle at center, rgba(15,23,42,0.9), rgba(2,6,23,0.5) 60%, rgba(2,6,23,0.1));
        overflow: hidden;
        display: grid;
        place-items: center;
        animation: battleOpenFade 1600ms ease forwards;
      }
      .battle-open-intro-global {
        position: fixed;
        top: 120px;
        left: 50%;
        transform: translateX(-50%);
        width: min(720px, 92vw);
        z-index: 80;
        pointer-events: none;
      }
      .battle-open-glow {
        position: absolute;
        inset: 10%;
        border-radius: 999px;
        border: 2px solid rgba(248,113,113,0.45);
        box-shadow: 0 0 40px rgba(248,113,113,0.45), 0 0 80px rgba(59,130,246,0.35);
        animation: battleOpenGlow 1600ms ease forwards;
      }
      .battle-open-sword {
        position: absolute;
        width: 12px;
        height: 90px;
        border-radius: 10px;
        background: linear-gradient(180deg, rgba(248,250,252,0.95), rgba(148,163,184,0.85));
        box-shadow: 0 10px 24px rgba(15,23,42,0.45);
      }
      .battle-open-sword::after {
        content: "";
        position: absolute;
        left: -10px;
        bottom: -8px;
        width: 32px;
        height: 10px;
        border-radius: 12px;
        background: linear-gradient(90deg, rgba(250,204,21,0.9), rgba(234,179,8,0.6));
        box-shadow: 0 6px 14px rgba(234,179,8,0.35);
      }
      .battle-open-sword.left {
        transform-origin: 50% 90%;
        animation: battleOpenSwordLeft 1600ms ease forwards;
      }
      .battle-open-sword.right {
        transform-origin: 50% 90%;
        animation: battleOpenSwordRight 1600ms ease forwards;
      }
      .battle-card-intro {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        z-index: 3;
        pointer-events: none;
        animation: battleOpenFade 1600ms ease forwards;
      }
      .battle-open-label {
        position: relative;
        z-index: 2;
        font-weight: 1000;
        font-size: 26px;
        letter-spacing: 1px;
        padding: 6px 14px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.2);
        background: rgba(15,23,42,0.7);
      }
      @keyframes battleOpenFade {
        0% { opacity: 0; transform: translateY(8px) scale(0.98); }
        15% { opacity: 1; transform: translateY(0) scale(1); }
        80% { opacity: 1; }
        100% { opacity: 0; transform: translateY(6px) scale(0.99); }
      }
      @keyframes battleOpenGlow {
        0% { opacity: 0; transform: scale(0.7); }
        40% { opacity: 1; transform: scale(1); }
        100% { opacity: 0; transform: scale(1.2); }
      }
      @keyframes battleOpenSwordLeft {
        0% { opacity: 0; transform: translate(-100px, -80px) rotate(-120deg); }
        30% { opacity: 1; }
        60% { transform: translate(-6px, 0px) rotate(-45deg); }
        100% { opacity: 0; transform: translate(-6px, 6px) rotate(-45deg); }
      }
      @keyframes battleOpenSwordRight {
        0% { opacity: 0; transform: translate(100px, -80px) rotate(120deg); }
        30% { opacity: 1; }
        60% { transform: translate(6px, 0px) rotate(45deg); }
        100% { opacity: 0; transform: translate(6px, 6px) rotate(45deg); }
      }
      .battle-vs-glow {
        font-weight: 1000;
        font-size: 34px;
        letter-spacing: 3px;
        padding: 8px 14px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.28);
        background: linear-gradient(135deg, rgba(249,115,22,0.35), rgba(239,68,68,0.25));
        color: rgba(255,245,238,0.98);
        text-shadow: 0 10px 20px rgba(249,115,22,0.65), 0 0 18px rgba(249,115,22,0.75);
        box-shadow: 0 0 24px rgba(249,115,22,0.45), inset 0 0 12px rgba(255,255,255,0.12);
        animation: battleVsPulse 2.4s ease-in-out infinite;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        justify-content: center;
      }
      .battle-vs-icon {
        font-size: 22px;
        filter: drop-shadow(0 0 10px rgba(250,204,21,0.7));
      }
      .ffa-grid {
        display: grid;
        gap: 14px;
      }
      .ffa-row {
        display: grid;
        gap: 12px;
      }
      .ffa-vs {
        display: grid;
        justify-items: center;
        gap: 6px;
        text-align: center;
      }
      .ffa-card {
        padding: 12px;
        border-radius: 18px;
        border: 1px solid rgba(255,255,255,0.18);
        background: linear-gradient(135deg, rgba(30,41,59,0.65), rgba(2,6,23,0.7));
        box-shadow: 0 14px 30px rgba(0,0,0,0.35), 0 0 28px rgba(239,68,68,0.25);
        animation: ffaCardPulse 6s ease-in-out infinite;
      }
      .lane-board {
        --lane-gap: 14px;
        margin-top: 14px;
        display: grid;
        grid-template-columns: 220px 1fr 220px;
        gap: var(--lane-gap);
        align-items: center;
        position: relative;
      }
      .lane-team {
        display: grid;
        gap: 10px;
      }
      .lane-team-header {
        font-size: 12px;
        font-weight: 900;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        opacity: 0.75;
        text-align: center;
      }
      .lane-player {
        position: relative;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(2,6,23,0.6);
        overflow: visible;
      }
      .lane-player-active {
        box-shadow: 0 0 0 2px rgba(250,204,21,0.7), 0 0 24px rgba(250,204,21,0.45);
      }
      .lane-player-name {
        font-weight: 900;
        font-size: 14px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .lane-player-header {
        display: grid;
        gap: 4px;
      }
      .lane-player-remaining {
        font-size: 11px;
        font-weight: 900;
        opacity: 0.8;
        white-space: normal;
        text-align: right;
      }
      .lane-mvp-chip {
        padding: 2px 6px;
        border-radius: 999px;
        border: 1px solid rgba(250,204,21,0.7);
        background: rgba(250,204,21,0.2);
        font-size: 10px;
        letter-spacing: 0.08em;
      }
      .lane-player-cat {
        margin-top: 4px;
        display: inline-flex;
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.2);
        font-size: 11px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .lane-player-level {
        margin-left: 8px;
        font-size: 11px;
        font-weight: 900;
        opacity: 0.8;
      }
      .lane-mini-summary {
        margin-top: 10px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }
      .lane-mini-box {
        padding: 8px 10px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.15);
        background: rgba(2,6,23,0.55);
        display: grid;
        gap: 6px;
      }
      .lane-mini-title {
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        opacity: 0.7;
      }
      .lane-mini-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-size: 11px;
        font-weight: 900;
      }
      .lane-mini-name {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        white-space: normal;
      }
      .lane-mini-mvp {
        margin-left: 6px;
        padding: 1px 6px;
        border-radius: 999px;
        border: 1px solid rgba(250,204,21,0.7);
        background: rgba(250,204,21,0.2);
        font-size: 9px;
        font-weight: 900;
        letter-spacing: 0.08em;
      }
      .lane-mini-dots {
        display: inline-flex;
        gap: 4px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .lane-mini-dot {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.25);
      }
      .lane-mini-dot-good {
        background: rgba(34,197,94,0.9);
        box-shadow: 0 0 6px rgba(34,197,94,0.5);
      }
      .lane-mini-dot-bad {
        background: rgba(239,68,68,0.9);
        box-shadow: 0 0 6px rgba(239,68,68,0.5);
      }
      .lane-mini-counts {
        opacity: 0.85;
      }
      .lane-points-chip {
        position: absolute;
        top: 50%;
        right: 8px;
        transform: translateY(-50%);
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 8px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.3);
        font-size: 11px;
        font-weight: 900;
        z-index: 2;
        box-shadow: 0 10px 20px rgba(0,0,0,0.35);
        max-width: calc(100% - 16px);
        white-space: normal;
        text-align: center;
      }
      .lane-points-win {
        background: rgba(22,163,74,0.95);
        color: #fff;
      }
      .lane-points-loss {
        background: rgba(185,28,28,0.95);
        color: #fff;
      }
      .lane-points-before {
        text-decoration: line-through;
        opacity: 0.6;
      }
      .lane-points-arrow {
        font-size: 12px;
      }
      .lane-points-after {
        font-size: 12px;
      }
      .lane-player-skill {
        margin-top: 6px;
        font-size: 11px;
        font-weight: 900;
        opacity: 0.8;
      }
      .lane-turn {
        margin-top: 6px;
        font-size: 11px;
        font-weight: 900;
        color: #facc15;
      }
      .lane-controls {
        display: flex;
        gap: 6px;
        margin-top: 8px;
        flex-wrap: wrap;
      }
      .lane-connector {
        position: absolute;
        top: 50%;
        right: calc(-1 * (var(--lane-gap) + 10px));
        width: calc(var(--lane-gap) + 10px);
        height: 2px;
        border-radius: 999px;
        filter: drop-shadow(0 0 8px rgba(255,255,255,0.35));
        animation: laneFlow 2.8s ease-in-out infinite;
        z-index: 1;
      }
      .lane-team-b .lane-connector {
        left: calc(-1 * (var(--lane-gap) + 10px));
        right: auto;
      }
      .lane-connector::after {
        content: "";
        position: absolute;
        top: -2px;
        width: 6px;
        height: 6px;
        border-radius: 999px;
        background: rgba(255,255,255,0.7);
        opacity: 0;
      }
      .lane-connector-active::after {
        opacity: 1;
        animation: laneParticle 0.9s ease-in-out forwards;
      }
      .lane-team-b .lane-connector-active::after {
        right: 0;
      }
      .lane-team-a .lane-connector-active::after {
        left: 0;
      }
      .lane-middle {
        display: grid;
        gap: 12px;
        padding: 10px;
        border-radius: 16px;
        border: 1px solid rgba(255,255,255,0.18);
        background: rgba(2,6,23,0.7);
        position: relative;
      }
      .lane-score {
        font-size: 28px;
        font-weight: 1000;
        letter-spacing: 1px;
        text-shadow: 0 0 18px rgba(250,204,21,0.4);
        position: absolute;
        z-index: 2;
      }
      .lane-score-a {
        top: -28px;
        left: 10px;
      }
      .lane-score-b {
        bottom: -28px;
        right: 10px;
      }
      .lane-remaining {
        margin-top: 8px;
        text-align: center;
        font-size: 14px;
        font-weight: 900;
        opacity: 0.75;
      }
      .lane-current-turn {
        margin-top: 10px;
        text-align: center;
        padding: 8px 10px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.18);
        background: rgba(15,23,42,0.6);
      }
      .lane-current-name {
        font-size: 18px;
        font-weight: 1000;
      }
      .lane-current-skill {
        margin-top: 4px;
        font-size: 12px;
        font-weight: 900;
        opacity: 0.85;
      }
      .lane-row {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: minmax(12px, 1fr);
        gap: 4px;
      }
      .lane-segment {
        display: block;
        height: 12px;
        border-radius: 6px;
        border: 1px solid rgba(255,255,255,0.18);
        background: rgba(255,255,255,0.08);
      }
      .lane-segment-flash {
        animation: laneFlash 0.9s ease-in-out;
      }
      .lane-row-b {
        direction: rtl;
      }
      .lane-order {
        margin-top: 10px;
        text-align: center;
        font-weight: 900;
        font-size: 12px;
        opacity: 0.8;
      }
      @keyframes laneFlow {
        0% { transform: translateX(0); opacity: 0.4; }
        50% { transform: translateX(6px); opacity: 1; }
        100% { transform: translateX(0); opacity: 0.4; }
      }
      @keyframes laneParticle {
        0% { transform: translateX(0); opacity: 0.3; }
        100% { transform: translateX(20px); opacity: 0; }
      }
      .lane-team-b .lane-connector-active::after {
        animation: laneParticleRtl 0.9s ease-in-out forwards;
      }
      @keyframes laneParticleRtl {
        0% { transform: translateX(0); opacity: 0.3; }
        100% { transform: translateX(-20px); opacity: 0; }
      }
      @keyframes laneFlash {
        0% { transform: scale(1); box-shadow: 0 0 0 rgba(250,204,21,0); }
        40% { transform: scale(1.1); box-shadow: 0 0 18px rgba(250,204,21,0.7); }
        100% { transform: scale(1); box-shadow: 0 0 0 rgba(250,204,21,0); }
      }
      .battle-turn-controls {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: center;
        align-items: center;
        margin-top: 10px;
      }
      .battle-coin-btn,
      .battle-order-btn {
        border: 1px solid rgba(255,255,255,0.18);
        border-radius: 999px;
        padding: 8px 12px;
        font-weight: 900;
        font-size: 12px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: white;
        cursor: pointer;
        background: linear-gradient(135deg, rgba(59,130,246,0.45), rgba(34,197,94,0.35));
        box-shadow: 0 12px 24px rgba(15,23,42,0.35), inset 0 0 10px rgba(255,255,255,0.12);
        transition: transform 0.12s ease, box-shadow 0.12s ease, filter 0.12s ease;
      }
      .battle-order-btn {
        background: linear-gradient(135deg, rgba(249,115,22,0.35), rgba(239,68,68,0.35));
      }
      .battle-coin-btn:active,
      .battle-order-btn:active {
        transform: translateY(2px) scale(0.98);
        box-shadow: 0 6px 14px rgba(15,23,42,0.45), inset 0 0 12px rgba(255,255,255,0.1);
        filter: saturate(1.2);
      }
      .battle-coin-result,
      .battle-turn-order {
        text-align: center;
        font-weight: 900;
        font-size: 12px;
        opacity: 0.85;
      }
      .battle-coin-result {
        padding: 4px 10px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.2);
        background: rgba(15,23,42,0.75);
      }
      @keyframes battleVsPulse {
        0% { transform: scale(1); box-shadow: 0 0 16px rgba(249,115,22,0.35); }
        50% { transform: scale(1.04); box-shadow: 0 0 30px rgba(239,68,68,0.6); }
        100% { transform: scale(1); box-shadow: 0 0 16px rgba(249,115,22,0.35); }
      }
      @keyframes ffaCardPulse {
        0% { box-shadow: 0 14px 30px rgba(0,0,0,0.35), 0 0 18px rgba(239,68,68,0.2); }
        50% { box-shadow: 0 18px 36px rgba(0,0,0,0.45), 0 0 30px rgba(249,115,22,0.45); }
        100% { box-shadow: 0 14px 30px rgba(0,0,0,0.35), 0 0 18px rgba(239,68,68,0.2); }
      }
      `}</style>
    </>
  );
}

function card(flashType?: "add" | "remove" | null, done?: boolean, wow?: boolean, selected?: boolean): React.CSSProperties {
  const flashGlow =
    flashType === "add"
      ? "0 0 0 2px rgba(34,197,94,0.55), 0 0 50px rgba(34,197,94,0.25)"
      : flashType === "remove"
      ? "0 0 0 2px rgba(239,68,68,0.55), 0 0 50px rgba(239,68,68,0.22)"
      : "";
  const doneGlow = done ? "0 0 0 2px rgba(250,204,21,0.35), 0 0 60px rgba(250,204,21,0.20)" : "";
  const wowGlow = wow ? "0 0 0 2px rgba(59,130,246,0.55), 0 0 70px rgba(59,130,246,0.35)" : "";
  const selectGlow = selected ? "0 0 0 2px rgba(96,165,250,0.55), 0 0 60px rgba(59,130,246,0.35)" : "";
  const baseBorder = "1px solid rgba(255,255,255,0.12)";
  const wowBorder = wow ? "1px solid rgba(59,130,246,0.45)" : baseBorder;
  const selectedBorder = selected ? "1px solid rgba(96,165,250,0.6)" : wowBorder;

  return {
    position: "relative",
    borderRadius: 26,
    padding: 20,
    minHeight: 150,
    border: selectedBorder,
    background: wow
      ? "linear-gradient(155deg, rgba(59,130,246,0.28), rgba(15,23,42,0.92) 60%, rgba(2,6,23,0.95))"
      : "linear-gradient(155deg, rgba(30,41,59,0.9), rgba(15,23,42,0.92) 60%, rgba(2,6,23,0.96))",
    boxShadow: `${selectGlow}${selectGlow ? ", " : ""}${wowGlow}${wowGlow ? ", " : ""}${doneGlow}${doneGlow ? ", " : ""}${flashGlow ? `${flashGlow}, ` : ""}0 24px 70px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -22px 40px rgba(0,0,0,0.35)`,
    cursor: "pointer",
    display: "grid",
    alignItems: "center",
    transition: "box-shadow 140ms ease, transform 140ms ease",
  };
}

function sideBtn(side: "left" | "right", disabled: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    width: 54,
    height: 54,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.18)",
    color: "white",
    fontWeight: 1000,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
    fontSize: 20,
    boxShadow: "0 14px 34px rgba(0,0,0,0.28)",
  };
  if (side === "left") {
    return {
      ...base,
      left: 12,
      background: "linear-gradient(135deg, rgba(34,197,94,0.55), rgba(34,197,94,0.18))",
    };
  }
  return {
    ...base,
    right: 12,
    background: "linear-gradient(135deg, rgba(239,68,68,0.55), rgba(239,68,68,0.18))",
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

function compareBtn(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "linear-gradient(90deg, rgba(59,130,246,0.45), rgba(14,116,144,0.35))",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
  };
}

function battlePulseBtn(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "linear-gradient(90deg, rgba(239,68,68,0.45), rgba(250,204,21,0.35))",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
  };
}

function skillStrikeBtn(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "linear-gradient(90deg, rgba(147,51,234,0.45), rgba(59,130,246,0.45))",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  };
}

function clearBtn(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
  };
}

function groupBtn(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "linear-gradient(90deg, rgba(14,116,144,0.55), rgba(34,197,94,0.45))",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
  };
}

function historyBtn(): React.CSSProperties {
  return {
    position: "absolute",
    bottom: 10,
    right: 10,
    padding: "6px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(59,130,246,0.22)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  };
}

function annotateBtn(): React.CSSProperties {
  return {
    position: "absolute",
    top: 10,
    left: 10,
    padding: "6px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  };
}

function groupCard(): React.CSSProperties {
  return {
    position: "relative",
    borderRadius: 24,
    padding: 18,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "linear-gradient(155deg, rgba(30,41,59,0.92), rgba(15,23,42,0.9) 60%, rgba(2,6,23,0.96))",
    boxShadow: "0 22px 70px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
    display: "grid",
    gap: 12,
    minHeight: 280,
  };
}

function groupCloseBtn(): React.CSSProperties {
  return {
    position: "absolute",
    top: 12,
    right: 12,
    width: 30,
    height: 30,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function groupHeader(): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    textAlign: "center",
  };
}

function groupGrid(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
  };
}

function groupMini(done: boolean, flashType?: "add" | "remove" | null, selected?: boolean): React.CSSProperties {
  const flashGlow =
    flashType === "add"
      ? "0 0 0 2px rgba(34,197,94,0.55), 0 0 36px rgba(34,197,94,0.28)"
      : flashType === "remove"
      ? "0 0 0 2px rgba(239,68,68,0.55), 0 0 36px rgba(239,68,68,0.25)"
      : "";
  const selectedGlow = selected ? "0 0 0 2px rgba(59,130,246,0.6), 0 0 28px rgba(59,130,246,0.3)" : "";
  return {
    borderRadius: 18,
    padding: 16,
    border: selected ? "1px solid rgba(59,130,246,0.65)" : done ? "1px solid rgba(34,197,94,0.50)" : "1px solid rgba(255,255,255,0.12)",
    background: done
      ? "linear-gradient(155deg, rgba(34,197,94,0.22), rgba(15,23,42,0.65))"
      : "linear-gradient(155deg, rgba(148,163,184,0.12), rgba(15,23,42,0.65))",
    boxShadow: `${selectedGlow ? `${selectedGlow}, ` : ""}${flashGlow ? `${flashGlow}, ` : ""}${done ? "0 0 26px rgba(34,197,94,0.18)" : "0 0 22px rgba(59,130,246,0.12)"}, inset 0 1px 0 rgba(255,255,255,0.06)`,
    display: "grid",
    gap: 8,
    cursor: "pointer",
    color: "white",
  };
}

function groupMiniBtn(kind: "good" | "bad", disabled: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    width: 62,
    height: 62,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.18)",
    color: "white",
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
    fontSize: 26,
    display: "grid",
    placeItems: "center",
    boxShadow: "0 10px 22px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.16)",
  };
  if (kind === "good") {
    return { ...base, background: "linear-gradient(135deg, rgba(34,197,94,0.55), rgba(34,197,94,0.18))" };
  }
  return { ...base, background: "linear-gradient(135deg, rgba(239,68,68,0.55), rgba(239,68,68,0.18))" };
}

function groupMiniAction(disabled: boolean): React.CSSProperties {
  return {
    width: 40,
    height: 40,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 16,
    display: "grid",
    placeItems: "center",
    opacity: disabled ? 0.5 : 1,
  };
}

function groupMiniDots(pending: boolean): React.CSSProperties {
  return {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    borderRadius: 12,
    padding: pending ? 6 : 0,
    background: pending ? "rgba(59,130,246,0.12)" : "transparent",
    boxShadow: pending ? "0 0 18px rgba(59,130,246,0.35)" : "none",
    animation: pending ? "pendingPulse 1.4s ease-in-out infinite" : "none",
  };
}

function groupSelectGrid(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 10,
  };
}

function groupStudentBtn(selected: boolean): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: selected ? "1px solid rgba(34,197,94,0.55)" : "1px solid rgba(255,255,255,0.12)",
    background: selected ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    textAlign: "left",
  };
}

function clearOption(): React.CSSProperties {
  return {
    display: "flex",
    gap: 10,
    alignItems: "center",
    fontWeight: 900,
  };
}

function annotateRow(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "90px 100px 1fr 110px",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
  };
}

function annotateSelect(disabled: boolean): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: disabled ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.24)",
    color: "white",
    outline: "none",
    fontWeight: 900,
    fontSize: 12,
    cursor: disabled ? "not-allowed" : "text",
  };
}

function annotateReasonBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: disabled ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 900,
    fontSize: 12,
    cursor: disabled ? "not-allowed" : "pointer",
    display: "grid",
    placeItems: "center",
  };
}

function reasonPopover(): React.CSSProperties {
  return {
    position: "absolute",
    top: "calc(100% + 8px)",
    right: 0,
    width: 220,
    borderRadius: 12,
    padding: 10,
    background: "rgba(12,14,20,0.96)",
    border: "1px solid rgba(255,255,255,0.16)",
    boxShadow: "0 12px 30px rgba(0,0,0,0.45)",
    zIndex: 20,
  };
}

function reasonPopoverCaret(): React.CSSProperties {
  return {
    position: "absolute",
    top: -6,
    right: 18,
    width: 12,
    height: 12,
    transform: "rotate(45deg)",
    background: "rgba(12,14,20,0.96)",
    borderLeft: "1px solid rgba(255,255,255,0.16)",
    borderTop: "1px solid rgba(255,255,255,0.16)",
  };
}

function reasonOption(selected: boolean): React.CSSProperties {
  return {
    padding: "6px 8px",
    borderRadius: 10,
    border: selected ? "1px solid rgba(34,197,94,0.55)" : "1px solid rgba(255,255,255,0.12)",
    background: selected ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
    textAlign: "left",
  };
}

function pointsEarnedLabel(t: TrackerRow): string {
  const attempts = Number(t.attempts ?? 0);
  const successes = Number(t.successes ?? 0);
  const target = Number(t.repetitions_target ?? 0);
  if (!target || attempts < target) return "+0 points";
  const perSuccess = successes === target ? 3 : 2;
  const points = successes * perSuccess;
  return `+${points} pts`;
}

function perRepBadgeWrap(): React.CSSProperties {
  return {
    display: "grid",
    gap: 2,
    justifyItems: "center",
    borderRadius: 14,
    border: "1px solid rgba(56,189,248,0.45)",
    background: "linear-gradient(145deg, rgba(2,132,199,0.2), rgba(15,23,42,0.75))",
    padding: "6px 12px",
    minWidth: 112,
  };
}

function perRepBadgeLabel(): React.CSSProperties {
  return {
    fontSize: 10,
    letterSpacing: "0.1em",
    fontWeight: 900,
    opacity: 0.8,
    textTransform: "uppercase",
  };
}

function perRepBadgeMain(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontWeight: 1000,
  };
}

function perRepBadgeStrike(): React.CSSProperties {
  return {
    fontSize: 20,
    opacity: 0.6,
    textDecoration: "line-through",
    textDecorationThickness: 2,
    textDecorationColor: "rgba(248,113,113,0.95)",
  };
}

function perRepBadgeValue(): React.CSSProperties {
  return {
    fontSize: 36,
    lineHeight: 1,
    color: "rgba(125,211,252,0.98)",
    textShadow: "0 0 16px rgba(56,189,248,0.45)",
  };
}

function undoBtn(disabled?: boolean): React.CSSProperties {
  return {
    position: "absolute",
    bottom: 10,
    left: 10,
    padding: "6px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(15,23,42,0.45)",
    color: "white",
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 12,
    width: 36,
    height: 36,
    display: "grid",
    placeItems: "center",
    opacity: disabled ? 0.5 : 0.95,
  };
}

function editBtn(disabled?: boolean): React.CSSProperties {
  return {
    position: "absolute",
    bottom: 10,
    right: 10,
    padding: "6px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(15,23,42,0.45)",
    color: "white",
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 12,
    width: 36,
    height: 36,
    display: "grid",
    placeItems: "center",
    opacity: disabled ? 0.5 : 0.95,
  };
}

function adminBtn(): React.CSSProperties {
  return {
    position: "absolute",
    bottom: 10,
    right: 124,
    padding: "6px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(2,6,23,0.75)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
    width: 36,
    height: 36,
    display: "grid",
    placeItems: "center",
  };
}

function crestBadge(): React.CSSProperties {
  return {
    width: 20,
    height: 20,
    objectFit: "contain",
    filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.5))",
  };
}

function crestBadgeSmall(): React.CSSProperties {
  return {
    width: 16,
    height: 16,
    objectFit: "contain",
    filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.45))",
  };
}

function historyTopBtn(): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(59,130,246,0.22)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  };
}

function repBtn(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  };
}

function repRow(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "80px 90px 1fr",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
  };
}
function resultsBtn(): React.CSSProperties {
  return {
    position: "absolute",
    bottom: 10,
    left: "50%",
    transform: "translateX(calc(-50% - 120px))",
    padding: "6px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  };
}

function battleResultsRow(): React.CSSProperties {
  return {
    position: "absolute",
    bottom: 10,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    gap: 8,
    alignItems: "center",
  };
}

function battleResultsBtn(kind: "primary" | "rematch" = "primary"): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 12,
    border:
      kind === "rematch"
        ? "1px solid rgba(34,197,94,0.35)"
        : "1px solid rgba(255,255,255,0.14)",
    background:
      kind === "rematch"
        ? "rgba(34,197,94,0.18)"
        : "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  };
}

function closeBtn(): React.CSSProperties {
  return {
    position: "absolute",
    top: 10,
    right: 10,
    padding: "6px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  };
}

function closeBtnBottom(): React.CSSProperties {
  return {
    position: "absolute",
    bottom: 10,
    right: 10,
    padding: "6px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(239,68,68,0.20)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
    zIndex: 2,
  };
}

function battleCard(flashType?: "add" | "remove" | null, done?: boolean): React.CSSProperties {
  const flashGlow =
    flashType === "add"
      ? "0 0 0 2px rgba(34,197,94,0.55), 0 0 50px rgba(34,197,94,0.25)"
      : flashType === "remove"
      ? "0 0 0 2px rgba(239,68,68,0.55), 0 0 50px rgba(239,68,68,0.22)"
      : "";
  const doneGlow = done ? "0 0 0 2px rgba(250,204,21,0.35), 0 0 60px rgba(250,204,21,0.20)" : "";
  return {
    position: "relative",
    borderRadius: 22,
    padding: 18,
    minHeight: 180,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "linear-gradient(135deg, rgba(59,130,246,0.14), rgba(34,197,94,0.10), rgba(15,23,42,0.70))",
    backgroundSize: "200% 200%",
    backgroundPosition: "0% 50%",
    boxShadow: `${doneGlow}${doneGlow ? ", " : ""}${flashGlow}${flashGlow ? ", " : ""}0 18px 70px rgba(0,0,0,0.45)`,
    display: "grid",
    gap: 8,
    gridColumn: "span 2",
    borderImage: "linear-gradient(90deg, rgba(59,130,246,0.55), rgba(34,197,94,0.55)) 1",
    animation: "battlePulseShift 12s ease-in-out infinite",
  };
}

function battleParticlesWrap(): React.CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    borderRadius: 22,
    overflow: "hidden",
    zIndex: 0,
    pointerEvents: "none",
  };
}

function battleCardContent(): React.CSSProperties {
  return {
    position: "relative",
    zIndex: 1,
  };
}

function battleBtn(kind: "good" | "bad", disabled: boolean): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.18)",
    background: kind === "good" ? "rgba(34,197,94,0.30)" : "rgba(239,68,68,0.30)",
    color: "white",
    fontWeight: 1000,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
  };
}

function battleUndoBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.10)",
    color: "white",
    fontWeight: 1000,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
  };
}

function laneColor(category: string, categories: string[]) {
  const palette = ["#38bdf8", "#f97316", "#facc15", "#34d399", "#c084fc", "#fb7185"];
  const idx = Math.max(0, categories.indexOf(category));
  return palette[idx % palette.length];
}

function battleDivider(): React.CSSProperties {
  return {
    height: "100%",
    width: "auto",
    borderRadius: 18,
    background: "transparent",
    border: "none",
    display: "grid",
    placeItems: "center",
    boxShadow: "none",
    padding: 0,
  };
}

function battlePulseActionsOverlay(): React.CSSProperties {
  return {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    transform: "translateY(-50%)",
    display: "grid",
    gridTemplateColumns: "1fr 170px 1fr",
    alignItems: "center",
    pointerEvents: "none",
  };
}

function battlePulseActionBtn(kind: "primary" | "rematch" = "primary"): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 12,
    border:
      kind === "rematch"
        ? "1px solid rgba(34,197,94,0.35)"
        : "1px solid rgba(255,255,255,0.14)",
    background:
      kind === "rematch"
        ? "rgba(34,197,94,0.18)"
        : "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  };
}

function teamPalette(team: "a" | "b" | "c" | "d") {
  if (team === "a") {
    return {
      glow: "rgba(59,130,246,0.45)",
      border: "rgba(59,130,246,0.55)",
      cardBorder: "rgba(59,130,246,0.35)",
      cardBg: "linear-gradient(135deg, rgba(30,58,138,0.32), rgba(2,6,23,0.65))",
      cardShadow: "0 10px 20px rgba(30,64,175,0.25)",
      highlight: "rgba(59,130,246,0.85)",
    };
  }
  if (team === "b") {
    return {
      glow: "rgba(249,115,22,0.45)",
      border: "rgba(249,115,22,0.55)",
      cardBorder: "rgba(249,115,22,0.35)",
      cardBg: "linear-gradient(135deg, rgba(124,45,18,0.32), rgba(2,6,23,0.65))",
      cardShadow: "0 10px 20px rgba(194,65,12,0.25)",
      highlight: "rgba(249,115,22,0.85)",
    };
  }
  if (team === "c") {
    return {
      glow: "rgba(34,197,94,0.45)",
      border: "rgba(34,197,94,0.55)",
      cardBorder: "rgba(34,197,94,0.35)",
      cardBg: "linear-gradient(135deg, rgba(22,101,52,0.32), rgba(2,6,23,0.65))",
      cardShadow: "0 10px 20px rgba(22,163,74,0.25)",
      highlight: "rgba(34,197,94,0.85)",
    };
  }
  return {
    glow: "rgba(244,63,94,0.45)",
    border: "rgba(244,63,94,0.55)",
    cardBorder: "rgba(244,63,94,0.35)",
    cardBg: "linear-gradient(135deg, rgba(190,18,60,0.32), rgba(2,6,23,0.65))",
    cardShadow: "0 10px 20px rgba(190,18,60,0.25)",
    highlight: "rgba(244,63,94,0.85)",
  };
}

function teamGroupWrap(team: "a" | "b" | "c" | "d"): React.CSSProperties {
  const { glow, border } = teamPalette(team);
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
    padding: 10,
    borderRadius: 20,
    border: `1px solid ${border}`,
    boxShadow: `0 0 0 1px ${border}, 0 0 26px ${glow}`,
    background: "rgba(2,6,23,0.35)",
  };
}

function teamMemberCard(team: "a" | "b" | "c" | "d"): React.CSSProperties {
  const { cardBorder, cardBg, cardShadow } = teamPalette(team);
  return {
    padding: 12,
    borderRadius: 18,
    border: `1px solid ${cardBorder}`,
    background: cardBg,
    boxShadow: cardShadow,
  };
}

function turnHighlightCard(kind: "a" | "b" | "c" | "d" | "ffa"): React.CSSProperties {
  const glow = kind === "ffa" ? "rgba(250,204,21,0.85)" : teamPalette(kind).highlight;
  return {
    border: `1px solid ${glow}`,
    boxShadow: `0 0 0 2px ${glow}, 0 0 30px ${glow}`,
  };
}

function turnBadge(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.35)",
    background: "linear-gradient(135deg, rgba(250,204,21,0.35), rgba(251,146,60,0.35))",
    color: "white",
    fontWeight: 1000,
    fontSize: 12,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    boxShadow: "0 8px 20px rgba(250,204,21,0.35)",
    width: "fit-content",
  };
}

function battleWinnerBadge(side: "left" | "right"): React.CSSProperties {
  return {
    position: "absolute",
    bottom: 12,
    left: side === "left" ? 98 : undefined,
    right: side === "right" ? 98 : undefined,
    display: "grid",
    gap: 6,
    padding: "8px 12px",
    borderRadius: 14,
    border: "1px solid rgba(34,197,94,0.55)",
    background: "rgba(2,6,23,0.85)",
    color: "white",
    textAlign: "center",
    boxShadow: "0 10px 26px rgba(34,197,94,0.25)",
  };
}

function battleWinnerName(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 10,
    background: "rgba(15,23,42,0.9)",
    border: "1px solid rgba(255,255,255,0.12)",
    fontWeight: 1000,
    fontSize: 12,
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
    fontSize: 14,
    fontWeight: 900,
  };
}

function suggestBox(): React.CSSProperties {
  return {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: 0,
    right: 0,
    zIndex: 20,
    background: "rgba(5,7,11,0.98)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: 6,
    display: "grid",
    gap: 4,
    boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
  };
}

function suggestItem(): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(15,23,42,0.7)",
    color: "white",
    textAlign: "left",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function debugDetails(): React.CSSProperties {
  return {
    marginTop: 8,
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(2,6,23,0.6)",
  };
}

function debugSummary(): React.CSSProperties {
  return {
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.85,
    listStyle: "none",
  };
}

function debugPre(): React.CSSProperties {
  return {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 1.4,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    opacity: 0.85,
  };
}

function debugBtn(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid rgba(250,204,21,0.5)",
    background: "rgba(250,204,21,0.15)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 11,
  };
}

function formatPointsValue(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat().format(n);
}

function formatNetDelta(value: number): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n === 0) return "0";
  return `${n > 0 ? "+" : ""}${n}`;
}

function netPointsOverlayContainer(): React.CSSProperties {
  return {
    position: "absolute",
    top: 10,
    right: 10,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    zIndex: 6,
    pointerEvents: "none",
  };
}

function netPointsChangeChip(delta: number): React.CSSProperties {
  const isPositive = delta > 0;
  const isNegative = delta < 0;
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 16,
    fontWeight: 1000,
    border: "1px solid rgba(255,255,255,0.25)",
    background: isPositive
      ? "rgba(34,197,94,0.25)"
      : isNegative
        ? "rgba(239,68,68,0.25)"
        : "rgba(148,163,184,0.25)",
    color: isPositive ? "rgba(34,197,94,0.95)" : isNegative ? "rgba(239,68,68,0.95)" : "rgba(148,163,184,0.95)",
  };
}

function netDeltaChip(delta: number): React.CSSProperties {
  const isPositive = delta > 0;
  const isNegative = delta < 0;
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 16,
    fontWeight: 1000,
    border: "1px solid rgba(255,255,255,0.25)",
    background: isPositive
      ? "rgba(34,197,94,0.35)"
      : isNegative
        ? "rgba(239,68,68,0.35)"
        : "rgba(148,163,184,0.35)",
    color: isPositive ? "rgba(34,197,94,0.95)" : isNegative ? "rgba(239,68,68,0.95)" : "rgba(148,163,184,0.95)",
  };
}

function netPointsRow(alignRight = false): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    justifySelf: alignRight ? "end" : "start",
    zIndex: 6,
  };
}

function formLabel(): React.CSSProperties {
  return {
    fontWeight: 900,
    fontSize: 14,
  };
}

function completedOverlay(): React.CSSProperties {
  return {
    position: "absolute",
    top: -12,
    left: "50%",
    transform: "translateX(-50%)",
    padding: "6px 14px",
    borderRadius: 999,
    border: "1px solid rgba(34,197,94,0.45)",
    background: "rgba(2,6,23,0.85)",
    display: "grid",
    placeItems: "center",
    textAlign: "center",
    pointerEvents: "none",
    fontWeight: 1000,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    fontSize: 12,
    color: "white",
    textShadow: "0 0 18px rgba(34,197,94,0.35)",
    boxShadow: "0 12px 28px rgba(0,0,0,0.35)",
    animation: "completedPulse 1.8s ease-in-out infinite",
  };
}

function battleCompletedOverlay(): React.CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
    textAlign: "center",
    padding: 12,
    borderRadius: 18,
    background: "rgba(0,0,0,0.55)",
    border: "1px solid rgba(255,255,255,0.12)",
    fontWeight: 1000,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    pointerEvents: "none",
    animation: "completedPulse 1.8s ease-in-out infinite",
    zIndex: 2,
  };
}

function completedPointsOverlay(): React.CSSProperties {
  return {
    position: "absolute",
    top: 10,
    left: 10,
    padding: "6px 10px",
    borderRadius: 14,
    background: "rgba(2,6,23,0.85)",
    border: "1px solid rgba(255,255,255,0.14)",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0.3,
    textTransform: "uppercase",
    pointerEvents: "none",
    color: "rgba(240,253,244,0.92)",
    textShadow: "0 0 12px rgba(34,197,94,0.35)",
  };
}

function pointsAwardBox(): React.CSSProperties {
  return {
    marginTop: 6,
    padding: "10px 14px",
    borderRadius: 18,
    border: "1px solid rgba(34,197,94,0.35)",
    background: "linear-gradient(135deg, rgba(34,197,94,0.22), rgba(16,185,129,0.08))",
    display: "grid",
    gap: 4,
    justifyItems: "center",
    textTransform: "uppercase",
    color: "rgba(240,253,244,0.95)",
    textShadow: "0 0 14px rgba(34,197,94,0.35)",
    boxShadow: "0 12px 26px rgba(0,0,0,0.35), inset 0 0 12px rgba(34,197,94,0.18)",
  };
}

function ResultSide({
  name,
  avatarPath,
  avatarBg,
  avatarEffect,
  effectConfig,
  successes,
  attempts,
}: {
  name: string;
  avatarPath: string;
  avatarBg: string;
  avatarEffect?: string | null;
  effectConfig?: any;
  successes: number;
  attempts: number;
}) {
  const avatarSrc = avatarPath
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${avatarPath}`
    : "";
  return (
    <div style={{ display: "grid", gap: 6, justifyItems: "center" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div
          style={{
            width: 54,
            height: 54,
            borderRadius: 999,
            background: avatarBg,
            border: "1px solid rgba(255,255,255,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            boxShadow: "0 0 18px rgba(59,130,246,0.35)",
            position: "relative",
          }}
        >
          <AvatarEffectParticles effectKey={avatarEffect ?? null} config={effectConfig} />
          {avatarSrc ? (
            <img src={avatarSrc} alt={name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          ) : (
            <span style={{ fontSize: 16, opacity: 0.7 }}>{name.slice(0, 1)}</span>
          )}
        </div>
        <div style={{ fontWeight: 1000, fontSize: 18 }}>{name}</div>
      </div>
      <div style={{ fontSize: 13, opacity: 0.85 }}>✓ {successes} • ✕ {Math.max(0, attempts - successes)}</div>
      <div style={{ fontSize: 13, opacity: 0.85 }}>Reps {attempts}</div>
    </div>
  );
}

function battleWinnerLabel(b: BattleRow) {
  const left = b.left_attempts_list?.filter((x) => x).length ?? b.left_successes ?? 0;
  const right = b.right_attempts_list?.filter((x) => x).length ?? b.right_successes ?? 0;
  if (left === right) return "Completed";
  return left > right ? `Winner: ${b.left_name}` : `Winner: ${b.right_name}`;
}

function battlePointsSummary(b: BattleRow) {
  const leftSuccesses = b.left_attempts_list?.filter((x) => x).length ?? b.left_successes ?? 0;
  const rightSuccesses = b.right_attempts_list?.filter((x) => x).length ?? b.right_successes ?? 0;
  const lead = Math.abs(leftSuccesses - rightSuccesses);
  if (!b.winner_id || lead === 0) {
    return { left: "Left: 0 pts", right: "Right: 0 pts" };
  }
  if (b.wager_amount > 0) {
    const net = b.wager_amount;
    const leftNet = b.winner_id === b.left_student_id ? net : -net;
    const rightNet = b.winner_id === b.right_student_id ? net : -net;
    return {
      left: `Left: ${leftNet >= 0 ? "+" : ""}${leftNet} pts`,
      right: `Right: ${rightNet >= 0 ? "+" : ""}${rightNet} pts`,
    };
  }
  const pointsPerRep = Math.max(3, Number(b.points_per_rep ?? 5));
  const net = lead * pointsPerRep;
  const leftNet = b.winner_id === b.left_student_id ? net : -net;
  const rightNet = b.winner_id === b.right_student_id ? net : -net;
  return {
    left: `Left: ${leftNet >= 0 ? "+" : ""}${leftNet} pts`,
    right: `Right: ${rightNet >= 0 ? "+" : ""}${rightNet} pts`,
  };
}

function TrendGraph({ logs, wide = false }: { logs: HistoryLog[]; wide?: boolean }) {
  const width = wide ? 520 : 360;
  const height = wide ? 220 : 190;
  const pad = 20;
  const minAttempts = 3;
  const [now, setNow] = useState(0);

  useEffect(() => {
    setNow(Date.now());
  }, [logs.length]);
  if (!logs.length) {
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

  const points = logs.map((l, i) => {
    const x = pad + (i / Math.max(1, logs.length - 1)) * (width - pad * 2);
    const y = pad + ((100 - l.rate) / 100) * (height - pad * 2);
    const date = new Date(l.created_at).toLocaleDateString();
    const vs = l.is_battle && l.vs_name ? ` VS ${l.vs_name}` : "";
    return { x, y, label: `${l.rate}% (${l.successes}/${l.attempts})${vs}`, date, attempts: l.attempts };
  });
  const trend = points.filter((p) => p.attempts >= minAttempts);
  const validLogs = logs.filter((l) => l.attempts >= minAttempts);
  const totalAttempts = validLogs.reduce((sum, l) => sum + l.attempts, 0);
  const totalSuccesses = validLogs.reduce((sum, l) => sum + l.successes, 0);
  const avgRate = totalAttempts ? Math.round((totalSuccesses / totalAttempts) * 100) : 0;
  const avgY = pad + ((100 - avgRate) / 100) * (height - pad * 2);

  const times = logs.map((l) => new Date(l.created_at).getTime()).filter((t) => Number.isFinite(t));
  const minX = times.length ? Math.min(...times) : now;
  const maxX = times.length ? Math.max(...times) : now;
  const xTicks = timeAxisTicks(minX, maxX, width, pad, [0, 0.5, 1]);

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ borderRadius: 16, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", overflow: "visible", marginBottom: 6 }}>
      {[0, 25, 50, 75, 100].map((v) => {
        const y = pad + ((100 - v) / 100) * (height - pad * 2);
        return <line key={v} x1={pad} y1={y} x2={width - pad} y2={y} stroke="rgba(255,255,255,0.06)" />;
      })}
      {[0, 0.33, 0.66, 1].map((v, i) => {
        const x = pad + v * (width - pad * 2);
        return <line key={i} x1={x} y1={pad} x2={x} y2={height - pad} stroke="rgba(255,255,255,0.06)" />;
      })}
      {trend.length >= 2 && (
        <polyline points={trend.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="rgba(59,130,246,0.9)" strokeWidth="2.5" />
      )}
      {totalAttempts > 0 && (
        <line x1={pad} y1={avgY} x2={width - pad} y2={avgY} stroke="rgba(255,255,255,0.4)" strokeDasharray="4 4" />
      )}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={4} fill={p.attempts < minAttempts ? "rgba(148,163,184,0.7)" : "rgba(34,197,94,0.9)"} />
          <title>{`${p.label} • ${p.date}`}</title>
          <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="3" fill="rgba(255,255,255,0.85)">
            <tspan x={p.x} dy="0">{p.label}</tspan>
            <tspan x={p.x} dy="4">{p.date}</tspan>
          </text>
        </g>
      ))}
      <g>
        <rect
          x={width - pad - 92}
          y={pad - 4}
          width={92}
          height={32}
          rx={8}
          fill="rgba(12,14,20,0.9)"
          stroke="rgba(255,255,255,0.16)"
        />
        <text x={width - pad - 46} y={pad + 8} fontSize="7" textAnchor="middle" fill="rgba(255,255,255,0.8)">
          Avg {avgRate}%
        </text>
        <text x={width - pad - 46} y={pad + 18} fontSize="6" textAnchor="middle" fill="rgba(255,255,255,0.6)">
          Total {totalSuccesses}/{totalAttempts}
        </text>
      </g>
      {xTicks.map((t, i) => (
        <text key={i} x={t.x} y={height - 6} fontSize="7" textAnchor={t.anchor} fill="rgba(255,255,255,0.7)">
          {t.label}
        </text>
      ))}
      <text x={12} y={height / 2} fontSize="7" fill="rgba(255,255,255,0.7)" textAnchor="middle" transform={`rotate(-90 12 ${height / 2})`}>
        Probability %
      </text>
      <text x={width / 2} y={height - pad + 2} fontSize="7" textAnchor="middle" fill="rgba(255,255,255,0.7)">
        Time
      </text>
    </svg>
  );
}

function ComparePanel({
  series,
  effectConfigByKey,
}: {
  series: CompareSeries[];
  effectConfigByKey: Record<string, { config?: any }>;
}) {
  const width = 760;
  const height = 320;
  const pad = 36;
  const minAttempts = 3;
  const [now, setNow] = useState(0);
  const palette = [
    "rgba(34,197,94,0.95)",
    "rgba(59,130,246,0.95)",
    "rgba(249,115,22,0.95)",
    "rgba(236,72,153,0.95)",
    "rgba(168,85,247,0.95)",
    "rgba(245,158,11,0.95)",
  ];

  useEffect(() => {
    setNow(Date.now());
  }, [series.length]);

  const allPoints = series.flatMap((s) => s.points.map((p) => ({ ...p, student_id: s.student_id })));
  const times = allPoints.map((p) => new Date(p.created_at).getTime()).filter((t) => Number.isFinite(t));
  const minX = times.length ? Math.min(...times) : now;
  const maxX = times.length ? Math.max(...times) : now;

  const colorByStudent = new Map<string, string>();
  series.forEach((s, i) => colorByStudent.set(s.student_id, palette[i % palette.length]));
  const xTicks = timeAxisTicks(minX, maxX, width, pad, [0, 0.33, 0.66, 1]);

  function xFor(ts: number) {
    if (maxX === minX) return pad;
    return pad + ((ts - minX) / (maxX - minX)) * (width - pad * 2);
  }
  function yFor(rate: number) {
    return pad + ((100 - rate) / 100) * (height - pad * 2);
  }

  const stats = series.map((s) => {
    const validPoints = s.points.filter((p) => p.attempts >= minAttempts);
    const rates = validPoints.map((p) => p.rate);
    const avg = rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0;
    const last = rates.length ? rates[rates.length - 1] : 0;
    const std = rates.length
      ? Math.round(
          Math.sqrt(rates.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / rates.length)
        )
      : 0;
    const nowTs = now;
    const month = 30 * 24 * 3600 * 1000;
    function avgInRange(start: number, end: number) {
      const subset = s.points.filter((p) => {
        const t = new Date(p.created_at).getTime();
        return t >= start && t < end && p.attempts >= minAttempts;
      });
      if (!subset.length) return 0;
      return Math.round(subset.reduce((sum, p) => sum + p.rate, 0) / subset.length);
    }
    const last30 = avgInRange(nowTs - month, nowTs);
    const prev30 = avgInRange(nowTs - month * 2, nowTs - month);
    const last90 = avgInRange(nowTs - month * 3, nowTs);
    const prev90 = avgInRange(nowTs - month * 6, nowTs - month * 3);
    return {
      student_id: s.student_id,
      student_name: s.student_name,
      avg,
      last,
      std,
      totalAttempts: validPoints.reduce((sum, p) => sum + p.attempts, 0),
      totalSuccesses: validPoints.reduce((sum, p) => sum + p.successes, 0),
      improve30: last30 - prev30,
      improve90: last90 - prev90,
    };
  });

  const mostImproved30 = stats.slice().sort((a, b) => b.improve30 - a.improve30)[0];
  const mostImproved90 = stats.slice().sort((a, b) => b.improve90 - a.improve90)[0];
  const topAvg = stats.slice().sort((a, b) => b.avg - a.avg).slice(0, 3);
  const topRecent = stats.slice().sort((a, b) => b.last - a.last).slice(0, 3);
  const topConsistent = stats.slice().sort((a, b) => a.std - b.std).slice(0, 3);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.6fr 0.9fr", gap: 16 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontWeight: 1000, fontSize: 16 }}>Trend Arena (Skill Pulse)</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {series.map((s) => (
            <div key={s.student_id} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11, opacity: 0.85 }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: colorByStudent.get(s.student_id) }} />
              {s.student_name}
            </div>
          ))}
        </div>
        <svg
          width="100%"
          viewBox={`0 0 ${width} ${height}`}
          style={{ borderRadius: 16, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)" }}
        >
          {[0, 25, 50, 75, 100].map((v) => {
            const y = yFor(v);
            return <line key={v} x1={pad} y1={y} x2={width - pad} y2={y} stroke="rgba(255,255,255,0.06)" />;
          })}
          {[0, 0.33, 0.66, 1].map((v, i) => {
            const x = pad + v * (width - pad * 2);
            return <line key={i} x1={x} y1={pad} x2={x} y2={height - pad} stroke="rgba(255,255,255,0.06)" />;
          })}

          {series.map((s) => {
            const points = s.points.map((p) => {
              const x = xFor(new Date(p.created_at).getTime());
              const y = yFor(p.rate);
              return { x, y, attempts: p.attempts };
            });
            const trend = points.filter((p) => p.attempts >= minAttempts);
            return (
              <polyline
                key={s.student_id}
                points={trend.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke={colorByStudent.get(s.student_id)}
                strokeWidth="2.5"
              />
            );
          })}
          {stats.map((s) => {
            if (!s.totalAttempts) return null;
            const y = yFor(s.avg);
            return (
              <line
                key={`${s.student_id}-avg`}
                x1={pad}
                y1={y}
                x2={width - pad}
                y2={y}
                stroke={colorByStudent.get(s.student_id)}
                strokeOpacity={0.35}
                strokeDasharray="4 4"
              />
            );
          })}
          {series.map((s) =>
            s.points.map((p, i) => {
              const x = xFor(new Date(p.created_at).getTime());
              const y = yFor(p.rate);
              const color = colorByStudent.get(s.student_id);
              const date = new Date(p.created_at).toLocaleDateString();
              const vs = p.is_battle && p.vs_name ? ` VS ${p.vs_name}` : "";
              return (
                <g key={`${s.student_id}-${i}`}>
                  <circle cx={x} cy={y} r={4} fill={p.attempts < minAttempts ? "rgba(148,163,184,0.7)" : color} />
                  <title>{`${p.rate}% (${p.successes}/${p.attempts})${vs} • ${date}`}</title>
                  <text x={x} y={y - 10} textAnchor="middle" fontSize="6" fill="rgba(255,255,255,0.85)">
                    <tspan x={x} dy="0">{`${p.rate}% (${p.successes}/${p.attempts})${vs}`}</tspan>
                    <tspan x={x} dy="6">{date}</tspan>
                  </text>
                </g>
              );
            })
          )}
          <g>
            <rect
              x={width - pad - 170}
              y={pad - 8}
              width={170}
              height={20 + stats.length * 10}
              rx={8}
              fill="rgba(12,14,20,0.9)"
              stroke="rgba(255,255,255,0.16)"
            />
            <text x={width - pad - 85} y={pad + 6} fontSize="7" textAnchor="middle" fill="rgba(255,255,255,0.8)">
              Average Rate
            </text>
            {stats.map((s, idx) => (
              <text
                key={`${s.student_id}-avg-box`}
                x={width - pad - 10}
                y={pad + 16 + idx * 9}
                fontSize="7"
                textAnchor="end"
                fill={colorByStudent.get(s.student_id)}
              >
                {s.student_name}: {s.avg}% ({s.totalSuccesses}/{s.totalAttempts})
              </text>
            ))}
          </g>

          {xTicks.map((t, i) => (
            <text key={i} x={t.x} y={height - 6} fontSize="8" textAnchor={t.anchor} fill="rgba(255,255,255,0.7)">
              {t.label}
            </text>
          ))}
          <text x={14} y={height / 2} fontSize="8" fill="rgba(255,255,255,0.7)" textAnchor="middle" transform={`rotate(-90 14 ${height / 2})`}>
            Probability %
          </text>
          <text x={width / 2} y={height - 18} fontSize="8" textAnchor="middle" fill="rgba(255,255,255,0.7)">
            Time
          </text>
        </svg>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <StatRow
          title="Most Improved (30d)"
          value={`${mostImproved30?.improve30 ?? 0}%`}
          student={mostImproved30?.student_name}
          series={series}
          effectConfigByKey={effectConfigByKey}
        />
        <StatRow
          title="Most Improved (90d)"
          value={`${mostImproved90?.improve90 ?? 0}%`}
          student={mostImproved90?.student_name}
          series={series}
          effectConfigByKey={effectConfigByKey}
        />
        <TopThreeBox title="Best Average" metricKey="avg" rows={topAvg} series={series} suffix="%" effectConfigByKey={effectConfigByKey} />
        <TopThreeBox title="Best Recent Session" metricKey="last" rows={topRecent} series={series} suffix="%" effectConfigByKey={effectConfigByKey} />
        <TopThreeBox title="Most Consistent" metricKey="std" rows={topConsistent} series={series} prefix="±" effectConfigByKey={effectConfigByKey} />
      </div>
    </div>
  );
}

function StatRow({
  title,
  value,
  student,
  series,
  effectConfigByKey,
}: {
  title: string;
  value: string;
  student?: string;
  series: CompareSeries[];
  effectConfigByKey: Record<string, { config?: any }>;
}) {
  const s = series.find((x) => x.student_name === student);
  const avatarPath = s?.avatar_storage_path ?? "";
  const avatarBg = s?.avatar_bg ?? "rgba(0,0,0,0.4)";
  const isComp = !!s?.is_competition_team;
  const avatarEffect = s?.avatar_effect ?? null;
  const avatarSrc = avatarPath
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${avatarPath}`
    : "";
  const effectConfig = effectConfigByKey[avatarEffect ?? ""]?.config;

  return (
    <div style={statBox()}>
      <div style={statLabel()}>{title}</div>
      <StatLine
        name={student ?? "—"}
        value={value}
        avatarSrc={avatarSrc}
        avatarBg={avatarBg}
        avatarEffect={avatarEffect}
        effectConfig={effectConfig}
        isComp={isComp}
        rank={1}
      />
    </div>
  );
}

function TopThreeBox({
  title,
  metricKey,
  rows,
  series,
  suffix,
  prefix,
  effectConfigByKey,
}: {
  title: string;
  metricKey: "avg" | "last" | "std";
  rows: Array<{ student_name: string; avg: number; last: number; std: number }>;
  series: CompareSeries[];
  suffix?: string;
  prefix?: string;
  effectConfigByKey: Record<string, { config?: any }>;
}) {
  return (
    <div style={statBox()}>
      <div style={statLabel()}>{title}</div>
      <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
        {rows.map((r, i) => {
          const s = series.find((x) => x.student_name === r.student_name);
          const avatarPath = s?.avatar_storage_path ?? "";
          const avatarBg = s?.avatar_bg ?? "rgba(0,0,0,0.4)";
          const isComp = !!s?.is_competition_team;
          const avatarEffect = s?.avatar_effect ?? null;
          const effectConfig = effectConfigByKey[avatarEffect ?? ""]?.config;
          const avatarSrc = avatarPath
            ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${avatarPath}`
            : "";
          const raw = metricKey === "avg" ? r.avg : metricKey === "last" ? r.last : r.std;
          const value = `${prefix ?? ""}${raw}${suffix ?? ""}`;
          return (
            <div key={`${r.student_name}-${i}`} style={{ flex: "1 1 30%", minWidth: 0 }}>
              <StatLine
                name={r.student_name}
                value={value}
                avatarSrc={avatarSrc}
                avatarBg={avatarBg}
                avatarEffect={avatarEffect}
                effectConfig={effectConfig}
                isComp={isComp}
                rank={i + 1}
              />
            </div>
          );
        })}
        {!rows.length && <div style={{ fontSize: 11, opacity: 0.7 }}>No data</div>}
      </div>
    </div>
  );
}

function StatLine({
  name,
  value,
  avatarSrc,
  avatarBg,
  avatarEffect,
  effectConfig,
  isComp,
  rank,
}: {
  name: string;
  value: string;
  avatarSrc: string;
  avatarBg: string;
  avatarEffect?: string | null;
  effectConfig?: any;
  isComp: boolean;
  rank: number;
}) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 999,
          background: avatarBg,
          border: isComp ? "1px solid rgba(59,130,246,0.55)" : "1px solid rgba(255,255,255,0.12)",
          boxShadow: isComp ? "0 0 14px rgba(59,130,246,0.35)" : "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {isComp ? <span style={compGlow()} /> : null}
        <AvatarEffectParticles effectKey={avatarEffect ?? null} config={effectConfig} />
        {avatarSrc ? (
          <img src={avatarSrc} alt={name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        ) : (
          <span style={{ fontSize: 11, opacity: 0.7 }}>{name.slice(0, 1)}</span>
        )}
      </div>
      <div style={{ display: "grid", gap: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 900 }}>{rank}. {name}</div>
        <div style={{ fontSize: 10, opacity: 0.8 }}>{value}</div>
      </div>
    </div>
  );
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
    zIndex: 0,
  };
}

function timeAxisTicks(minX: number, maxX: number, width: number, pad: number, marks: number[]) {
  const rangeMs = Math.max(0, maxX - minX);
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return marks.map((v) => {
    const t = minX + clamp(v) * rangeMs;
    const label = formatTimeLabel(new Date(t), rangeMs);
    const anchor: "start" | "middle" | "end" = v === 0 ? "start" : v === 1 ? "end" : "middle";
    const x = pad + v * (width - pad * 2);
    return { x, label, anchor };
  });
}

function formatTimeLabel(d: Date, rangeMs: number) {
  const day = 24 * 3600 * 1000;
  const rangeDays = rangeMs / day;
  if (rangeDays <= 90) {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  if (rangeDays <= 365) {
    return d.toLocaleDateString(undefined, { month: "short" });
  }
  return d.toLocaleDateString(undefined, { year: "numeric" });
}

function statBox(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
  };
}

function compGlow(): React.CSSProperties {
  return {
    position: "absolute",
    inset: -4,
    borderRadius: 999,
    background: "conic-gradient(from 90deg, rgba(59,130,246,0.35), rgba(147,197,253,0.15), rgba(59,130,246,0.35))",
    filter: "blur(6px)",
    animation: "spin 3s linear infinite",
  };
}

function statLabel(): React.CSSProperties {
  return { fontSize: 10, opacity: 0.7, fontWeight: 900 };
}

function statValue(): React.CSSProperties {
  return { fontSize: 12, fontWeight: 1000 };
}

function chip(active?: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    gap: 8,
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    border: active ? "1px solid rgba(96,165,250,0.65)" : "1px solid rgba(255,255,255,0.12)",
    background: active ? "rgba(59,130,246,0.25)" : "rgba(255,255,255,0.06)",
    color: "white",
    fontSize: 12,
    fontWeight: 900,
  };
}

function mvpChip(): React.CSSProperties {
  return {
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid rgba(251,191,36,0.6)",
    background: "rgba(251,191,36,0.2)",
    color: "#fde68a",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 0.4,
  };
}

function chipX(): React.CSSProperties {
  return {
    border: "none",
    background: "transparent",
    color: "white",
    cursor: "pointer",
    fontWeight: 900,
  };
}

function feedLabel(type: FeedItem["type"]) {
  if (type === "battle") return "Battle";
  return "Skill Tracker";
}

function feedChip(type: FeedItem["type"]): React.CSSProperties {
  const palette =
    type === "battle"
      ? {
          border: "1px solid rgba(248,113,113,0.55)",
          background: "rgba(248,113,113,0.18)",
          color: "#fecaca",
        }
      : {
          border: "1px solid rgba(34,197,94,0.55)",
          background: "rgba(34,197,94,0.16)",
          color: "#bbf7d0",
        };
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

function feedCard(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "linear-gradient(140deg, rgba(15,23,42,0.7), rgba(15,23,42,0.35))",
    boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
    display: "grid",
    gap: 6,
  };
}

function toggle(on: boolean): React.CSSProperties {
  return {
    width: 52,
    height: 28,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.16)",
    background: on ? "rgba(34,197,94,0.35)" : "rgba(255,255,255,0.08)",
    display: "flex",
    alignItems: "center",
    padding: 3,
    cursor: "pointer",
  };
}

function toggleKnob(on: boolean): React.CSSProperties {
  return {
    width: 22,
    height: 22,
    borderRadius: 999,
    background: on ? "rgba(34,197,94,0.85)" : "rgba(148,163,184,0.65)",
    transform: `translateX(${on ? 24 : 0}px)`,
    transition: "transform 180ms ease",
  };
}

function modeBtn(active: boolean): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 12,
    border: active ? "1px solid rgba(34,197,94,0.45)" : "1px solid rgba(255,255,255,0.14)",
    background: active ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  };
}

function headerSticky(): React.CSSProperties {
  return {
    position: "sticky",
    top: 0,
    zIndex: 40,
    paddingTop: 12,
    paddingBottom: 12,
    background: "linear-gradient(180deg, rgba(5,7,11,0.98), rgba(5,7,11,0.85) 70%, rgba(5,7,11,0.45))",
    backdropFilter: "blur(8px)",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  };
}

function Overlay({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.72)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "clamp(8px, 2.8vw, 18px)",
        overflowY: "auto",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(760px, calc(100vw - 12px))",
          maxHeight: "92vh",
          overflowY: "auto",
          overflowX: "hidden",
          borderRadius: 22,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(5,7,11,0.96)",
          backdropFilter: "blur(10px)",
          boxShadow: "0 22px 90px rgba(0,0,0,0.60)",
          padding: 14,
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

function OverlayWide({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.72)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "clamp(8px, 2.8vw, 18px)",
        overflowY: "auto",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(1400px, calc(100vw - 10px))",
          maxHeight: "92vh",
          overflowY: "auto",
          overflowX: "hidden",
          borderRadius: 22,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(5,7,11,0.96)",
          backdropFilter: "blur(10px)",
          boxShadow: "0 22px 90px rgba(0,0,0,0.60)",
          padding: 16,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 1100 }}>{title}</div>
          <button onClick={onClose} style={btnGhost()}>
            Close
          </button>
        </div>
        <div style={{ marginTop: 12 }}>{children}</div>
      </div>
    </div>
  );
}

function ConfirmOverlay({
  message,
  onCancel,
  onConfirm,
}: {
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 260,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 18,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          width: "min(420px, 100%)",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(5,7,11,0.98)",
          boxShadow: "0 22px 90px rgba(0,0,0,0.60)",
          padding: 16,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontWeight: 1000, fontSize: 15 }}>Are you sure?</div>
        <div style={{ marginTop: 8, opacity: 0.8 }}>{message}</div>
        <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onCancel} style={btnGhost()}>
            Cancel
          </button>
          <button onClick={onConfirm} style={btnDanger()}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
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

function buildLaneErrors({
  teamAIds,
  teamBIds,
  categories,
  assignmentsComplete,
  skillsValid,
  countsValid,
  skillMin,
}: {
  teamAIds: string[];
  teamBIds: string[];
  categories: string[];
  assignmentsComplete: boolean;
  skillsValid: boolean;
  countsValid: boolean;
  skillMin: number;
}) {
  const errors: string[] = [];
  if (teamAIds.length < 2 || teamBIds.length < 2) errors.push("Teams must have at least 2 players.");
  if (teamAIds.length !== teamBIds.length) errors.push("Teams must be the same size.");
  if (categories.length < 1) errors.push("Select at least 1 category.");
  if (!assignmentsComplete) errors.push("Each player must be assigned at least one category.");
  if (!skillsValid) errors.push(`Each category needs at least ${skillMin} selected skill${skillMin === 1 ? "" : "s"}.`);
  if (!countsValid) {
    errors.push("All assigned categories must be valid for this battle.");
  }
  return errors;
}

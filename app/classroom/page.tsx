"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { fireFx } from "../../components/GlobalFx";
import { playGlobalSfx, setGlobalSounds } from "@/lib/globalAudio";
import CompetitionPrestigeFrame from "../../components/CompetitionPrestigeFrame";
import { supabaseClient } from "@/lib/supabase/client";
import AvatarRender from "@/components/AvatarRender";
import GroupPointsOverlay from "@/components/GroupPointsOverlay";

type ClassRow = { id: string; name: string; class_color?: string | null };
type ScheduleCard = {
  id: string;
  session_id: string;
  instance_id: string;
  class_id: string;
  name: string;
  time: string;
  start_time?: string | null;
  end_time?: string | null;
  instructors: string[];
  image_url?: string | null;
  room_name?: string | null;
  pass_names?: string[];
  class_color?: string | null;
};
type ScheduleEntry = {
  id: string;
  schedule_entry_id?: string | null;
  class_id: string;
  session_date?: string | null;
  start_time: string;
  end_time?: string | null;
  instructor_name?: string | null;
  room_name?: string | null;
  class_name?: string | null;
};
type AwardType = { id: string; name: string; points: number; enabled: boolean };
type AwardAssignment = {
  id: string;
  award_type_id: string;
  student_id: string;
  student_name: string;
  points_awarded: number;
};
type SpotlightCount = { count: number; points: number };
type TrackerSkillRow = { id: string; name: string; category?: string | null };

type RosterRow = {
  checkin_id: string;
  checked_in_at: string;
  student: {
    id: string;
    name: string;
    level: number;
    points_total: number;
    is_competition_team: boolean;
    avatar_storage_path?: string | null;
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
    prestige_badges?: string[];
  };
  badgeCount: number;
  challengeCount: number;
  masterStars: number;
  checkinCount: number;
};

function toLocalDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function Card({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ borderRadius: 18, padding: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ fontWeight: 950 }}>{title}</div>
        {actions ? <div>{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export default function ClassroomPage() {
  const searchParams = useSearchParams();
  const lockInstanceId = String(searchParams.get("lock_instance_id") ?? "").trim();
  const lockClassId = String(searchParams.get("lock_class_id") ?? "").trim();
  const isLocked = !!lockInstanceId;
  const router = useRouter();
  const [studentBlocked, setStudentBlocked] = useState(false);
  const [adminBlocked, setAdminBlocked] = useState(false);
  const [viewerRole, setViewerRole] = useState("student");
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState<string>("");
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [msg, setMsg] = useState("");
  const [rosterLoading, setRosterLoading] = useState(false);
  const [classCounts, setClassCounts] = useState<Record<string, number>>({});
  const [instanceCounts, setInstanceCounts] = useState<Record<string, number>>({});
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [todaySessions, setTodaySessions] = useState<ScheduleCard[]>([]);
  const [passAccess, setPassAccess] = useState<Record<string, string[]>>({});
  const [awardTypes, setAwardTypes] = useState<AwardType[]>([]);
  const [awardAssignments, setAwardAssignments] = useState<Record<string, AwardAssignment[]>>({});
  const [awardLoading, setAwardLoading] = useState(false);
  const [spotlightCounts, setSpotlightCounts] = useState<Record<string, SpotlightCount>>({});
  const [openAwardTypeId, setOpenAwardTypeId] = useState<string | null>(null);
  const [groupPointsOpen, setGroupPointsOpen] = useState(false);
  const [bulkPointsOpen, setBulkPointsOpen] = useState(false);
  const [bulkPointsPin, setBulkPointsPin] = useState("");
  const [bulkPointsValue, setBulkPointsValue] = useState("");
  const [bulkPointsMsg, setBulkPointsMsg] = useState("");
  const [bulkPointsBusy, setBulkPointsBusy] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [multiSelect, setMultiSelect] = useState(false);
  const [seasonSettings, setSeasonSettings] = useState<{ start_date?: string | null; weeks?: number | null }>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [clearingRoster, setClearingRoster] = useState(false);
  const [navLinksEnabled, setNavLinksEnabled] = useState(false);
  const [activeInstanceId, setActiveInstanceId] = useState<string>("");
  const [classEndedById, setClassEndedById] = useState<Record<string, boolean>>({});
  const [rosterQuery, setRosterQuery] = useState("");
  const [rosterResults, setRosterResults] = useState<Array<{ id: string; name: string; level: number }>>([]);
  const [rosterSearching, setRosterSearching] = useState(false);
  const [cornerOffsets, setCornerOffsets] = useState<{ x: number; y: number; size: number }>({ x: -8, y: -8, size: 72 });
  const [plateOffsets, setPlateOffsets] = useState<{ x: number; y: number; size: number }>({ x: 0, y: 0, size: 200 });
  const [effectConfigByKey, setEffectConfigByKey] = useState<
    Record<
      string,
      {
        config?: {
          density?: number;
          size?: number;
          speed?: number;
          opacity?: number;
          frequency?: number;
        } | null;
        render_mode?: string | null;
        html?: string | null;
        css?: string | null;
        js?: string | null;
      }
    >
  >({});

  const [flash, setFlash] = useState<Record<string, "green" | "red" | "">>({});
  const [quickTool, setQuickTool] = useState<"none" | "skill_lookup" | "group_tracker">("none");
  const [trackerSkills, setTrackerSkills] = useState<TrackerSkillRow[]>([]);
  const [skillQuery, setSkillQuery] = useState("");
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [selectedSkillName, setSelectedSkillName] = useState("");
  const [lookupRows, setLookupRows] = useState<Array<{ student_id: string; successes: number; attempts: number; last_at?: string | null }>>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMsg, setLookupMsg] = useState("");
  const [groupSkillId, setGroupSkillId] = useState("");
  const [groupSkillQuery, setGroupSkillQuery] = useState("");
  const [groupRosterQuery, setGroupRosterQuery] = useState("");
  const [groupReps, setGroupReps] = useState<number>(5);
  const [groupSelectedIds, setGroupSelectedIds] = useState<string[]>([]);
  const [groupBusy, setGroupBusy] = useState(false);
  const [groupMsg, setGroupMsg] = useState("");
  const scheduleOverrides: Record<string, Omit<ScheduleCard, "id" | "name">> = {
    class_a: { session_id: "class_a", instance_id: "class_a", class_id: "class_a", time: "4:30 PM", instructors: ["Coach Mia"] },
    class_b: { session_id: "class_b", instance_id: "class_b", class_id: "class_b", time: "6:00 PM", instructors: ["Coach Leo"] },
  };
  const todayKey = useMemo(() => toLocalDateKey(new Date()), []);
  const activeRosterCount = useMemo(() => {
    const uniqueIds = new Set(roster.map((r) => String(r.student?.id ?? r.checkin_id ?? "")).filter(Boolean));
    return uniqueIds.size;
  }, [roster]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/avatar-effects/list", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!mounted) return;
        const list = (data?.effects ?? []) as Array<{ key: string; config?: any; render_mode?: string | null; html?: string | null; css?: string | null; js?: string | null }>;
        const map: Record<string, { config?: any; render_mode?: string | null; html?: string | null; css?: string | null; js?: string | null }> = {};
        list.forEach((effect) => {
          if (effect?.key) map[String(effect.key)] = { config: effect.config, render_mode: effect.render_mode ?? null, html: effect.html ?? null, css: effect.css ?? null, js: effect.js ?? null };
        });
        setEffectConfigByKey(map);
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/sound-effects/list", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!mounted || !res.ok) return;
        const map: Record<string, { url: string; volume: number }> = {};
        (data.effects ?? []).forEach((row: any) => {
          const key = String(row?.key ?? "");
          const url = String(row?.audio_url ?? "");
          if (!key || !url) return;
          map[key] = { url, volume: Math.min(1, Math.max(0, Number(row?.volume ?? 1))) };
        });
        setGlobalSounds(map);
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json();
        if (data?.ok) setViewerRole(String(data?.role ?? "student"));
        if (data?.ok && data?.role === "student") setStudentBlocked(true);
        if (data?.ok && !["admin", "classroom"].includes(String(data?.role ?? ""))) setAdminBlocked(true);
      } catch {}
    })();
  }, []);

  const blockedView = studentBlocked ? (
    <main style={{ padding: 18 }}>
      <div style={{ fontSize: 22, fontWeight: 900 }}>Classroom is coach-only.</div>
      <div style={{ opacity: 0.7, marginTop: 6 }}>Student accounts cannot access this page.</div>
    </main>
  ) : adminBlocked ? (
    <main style={{ padding: 18 }}>
      <div style={{ fontSize: 22, fontWeight: 900 }}>Classroom is admin-only.</div>
      <div style={{ opacity: 0.7, marginTop: 6 }}>Admin or classroom accounts can access classroom tools.</div>
    </main>
  ) : null;

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/classes/list", { cache: "no-store" });
      const data = await res.json();
      setClasses(data.classes ?? []);
      const first = (data.classes ?? [])[0];
      if (first?.id) setClassId(first.id);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/awards/types", { cache: "no-store" });
        const data = await res.json();
        if (res.ok) setAwardTypes((data.types ?? []) as AwardType[]);
      } catch {}
    })();
  }, []);

  const loadSchedule = async () => {
    try {
      const today = toLocalDateKey(new Date());
      const res = await fetch(`/api/schedule/list?date=${today}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        const entries = (data.entries ?? []) as ScheduleEntry[];
        const cleaned = entries.filter((e) => {
          const id = String(e.id ?? "").trim();
          return id && id !== "null" && id !== "undefined";
        });
        setScheduleEntries(cleaned);
      }
    } catch {}
  };

  useEffect(() => {
    loadSchedule();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/season-settings", { cache: "no-store" });
        const data = await res.json();
        if (res.ok) setSeasonSettings(data.settings ?? {});
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/classes/pass-access", { cache: "no-store" });
        const data = await res.json();
        if (res.ok) setPassAccess((data.access ?? {}) as Record<string, string[]>);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/corner-borders/settings", { cache: "no-store" });
        const data = await res.json();
        if (res.ok) {
          setCornerOffsets({
            x: Number(data?.settings?.roster_x ?? -8),
            y: Number(data?.settings?.roster_y ?? -8),
            size: Number(data?.settings?.roster_size ?? 72),
          });
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/card-plates/settings", { cache: "no-store" });
        const data = await res.json();
        if (res.ok) {
          setPlateOffsets({
            x: Number(data?.settings?.roster_x ?? 0),
            y: Number(data?.settings?.roster_y ?? 0),
            size: Number(data?.settings?.roster_size ?? 200),
          });
        }
      } catch {}
    })();
  }, []);

  const loadTodaySessions = async () => {
    try {
      const res = await fetch("/api/class-sessions/today", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        const sessions = (data.sessions ?? []) as Array<{
          session_id: string;
          instance_id?: string;
          class_id: string;
          class_name: string;
          start_time: string;
          end_time?: string | null;
          instructor_name?: string | null;
          room_name?: string | null;
        }>;
        if (data?.today) {
          const dateValue = new Date(`${data.today}T00:00:00`);
          if (!Number.isNaN(dateValue.getTime())) {
            setTodayLabel(dateValue.toLocaleDateString());
          }
        }
        const colorByClass = new Map(
          classes.map((c) => [String(c.id), c.class_color ?? null])
        );
        setTodaySessions(
          sessions
            .filter((s) => {
              const id = String(s.instance_id ?? s.class_id ?? "").trim();
              return id && id !== "null" && id !== "undefined";
            })
            .map((s) => ({
              id: s.instance_id ?? s.class_id,
              session_id: s.session_id,
              instance_id: s.instance_id ?? "",
              class_id: s.class_id,
              name: s.class_name,
              time: s.start_time ? formatTime(s.start_time) : "TBD",
              start_time: s.start_time ?? null,
              end_time: s.end_time ?? null,
              instructors: s.instructor_name ? [s.instructor_name] : ["Coach"],
              room_name: s.room_name ?? null,
              pass_names: passAccess[s.class_id] ?? [],
              class_color: colorByClass.get(String(s.class_id)) ?? null,
            }))
        );
      }
    } catch {}
  };

  useEffect(() => {
    loadTodaySessions();
  }, [classes, passAccess]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase() ?? "";
      if (target?.isContentEditable || ["input", "textarea", "select"].includes(tag)) return;
      if (!selectedStudentIds.length) return;
      const key = e.key.toLowerCase();
      if (key === "b") {
        e.preventDefault();
        selectedStudentIds.forEach((id) => applyRuleBreaker(id));
      } else if (key === "k") {
        e.preventDefault();
        selectedStudentIds.forEach((id) => applyRuleKeeper(id));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedStudentIds]);

  const scheduleCards = useMemo(() => {
    if (!scheduleEntries.length) return todaySessions;
    const colorByClass = new Map(classes.map((c) => [String(c.id), c.class_color ?? null]));
    return scheduleEntries.map((entry, idx) => {
      const className = entry.class_name ?? classes.find((c) => c.id === entry.class_id)?.name ?? "Class";
      const base = scheduleOverrides[entry.class_id] ?? scheduleOverrides[className.toLowerCase()] ?? null;
      return {
        id: entry.id,
        session_id: "",
        instance_id: entry.id,
        class_id: entry.class_id,
        name: className,
        time: entry.start_time ? formatTime(entry.start_time) : base?.time ?? (idx % 2 === 0 ? "5:00 PM" : "6:30 PM"),
        start_time: entry.start_time ?? null,
        end_time: entry.end_time ?? null,
        instructors: entry.instructor_name
          ? [entry.instructor_name]
          : base?.instructors ?? ["Coach Kai"],
        image_url: base?.image_url ?? null,
        room_name: entry.room_name ?? null,
        pass_names: passAccess[entry.class_id] ?? [],
        class_color: colorByClass.get(String(entry.class_id)) ?? null,
      } as ScheduleCard;
    });
  }, [classes, scheduleEntries, todaySessions, passAccess]);

  const lockedScheduleCards = useMemo(() => {
    if (!isLocked) return scheduleCards;
    const byInstance = scheduleCards.filter((c) => String(c.instance_id ?? "") === lockInstanceId);
    if (byInstance.length) return byInstance;
    const byClass = scheduleCards.filter((c) => String(c.class_id ?? "") === lockClassId);
    return byClass.length ? byClass : scheduleCards;
  }, [isLocked, scheduleCards, lockInstanceId, lockClassId]);

  const selectedCard = useMemo(() => lockedScheduleCards.find((c) => c.id === classId) ?? null, [lockedScheduleCards, classId]);
  const selectedClassId = selectedCard?.class_id ?? "";

  const sortedScheduleCards = useMemo(() => {
    return [...lockedScheduleCards].sort((a, b) => timeSort(a.start_time ?? "", b.start_time ?? ""));
  }, [lockedScheduleCards]);

  useEffect(() => {
    if (!sortedScheduleCards.length) return;
    if (!classId || !sortedScheduleCards.some((c) => c.id === classId)) {
      const first = sortedScheduleCards[0];
      setClassId(first.id);
      setActiveInstanceId(first.instance_id || "");
    }
  }, [classId, sortedScheduleCards]);

  useEffect(() => {
    if (!isLocked) return;
    if (lockInstanceId) {
      setClassId(lockInstanceId);
      setActiveInstanceId(lockInstanceId);
    }
  }, [isLocked, lockInstanceId]);

  useEffect(() => {
    if (!scheduleCards.length) return;
    const tick = () => {
      const now = new Date();
      const today = new Date();
      let shouldEndActive = false;
      scheduleCards.forEach((c) => {
        if (!c.end_time) return;
        const parts = String(c.end_time).split(":").map(Number);
        if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return;
        const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), parts[0], parts[1], 0);
        end.setMinutes(end.getMinutes() + 60);
        if (now >= end && c.id === classId && !classEndedById[c.id]) {
          shouldEndActive = true;
        }
      });
      setClassEndedById((prev) => {
        let changed = false;
        const next = { ...prev };
        scheduleCards.forEach((c) => {
          if (!c.end_time) return;
          const parts = String(c.end_time).split(":").map(Number);
          if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return;
          const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), parts[0], parts[1], 0);
          end.setMinutes(end.getMinutes() + 60);
          if (now >= end && !next[c.id]) {
            next[c.id] = true;
            changed = true;
          }
        });
        return changed ? next : prev;
      });
      if (shouldEndActive) {
        endClassSession();
      }
    };
    tick();
    const timer = window.setInterval(tick, 60000);
    return () => window.clearInterval(timer);
  }, [classEndedById, classId, scheduleCards]);

  async function loadRoster(instanceIdOverride?: string) {
    const instanceId = instanceIdOverride ?? activeInstanceId;
    if (!instanceId) return;
    setRosterLoading(true);
    const res = await fetch("/api/classroom/roster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instance_id: instanceId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setRosterLoading(false);
      return setMsg(data?.error || "Failed to load roster");
    }
    setRoster(data.roster ?? []);
    await loadSpotlightCounts((data.roster ?? []) as RosterRow[]);
    setInstanceCounts((prev) => ({ ...prev, [instanceId]: (data.roster ?? []).length }));
    setRosterLoading(false);
  }

  async function loadAwardAssignments(classIdOverride?: string) {
    const classIdForQuery = classIdOverride ?? selectedClassId;
    if (!classIdForQuery) return;
    setAwardAssignments({});
    setAwardLoading(true);
    try {
      const res = await fetch("/api/awards/class-today", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ class_id: classIdForQuery }),
      });
      const data = await res.json();
      if (res.ok) {
        const map: Record<string, AwardAssignment[]> = {};
        (data.awards ?? []).forEach((row: AwardAssignment) => {
          map[row.award_type_id] = [...(map[row.award_type_id] ?? []), row];
        });
        setAwardAssignments(map);
      } else {
        setMsg(data?.error || "Failed to load awards");
      }
    } finally {
      setAwardLoading(false);
    }
  }

  async function loadSpotlightCounts(rows: RosterRow[]) {
    const ids = rows.map((r) => r.student.id);
    if (!ids.length) return setSpotlightCounts({});
    const res = await fetch("/api/awards/student-counts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_ids: ids }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setSpotlightCounts((data.counts ?? {}) as Record<string, SpotlightCount>);
  }

  useEffect(() => {
    if (!classId) return;
    setMsg("");
    setRoster([]);
    setAwardAssignments({});
    loadRoster(activeInstanceId);
    loadAwardAssignments(selectedClassId);
    return () => {};
  }, [classId, activeInstanceId, selectedClassId]);

  useEffect(() => {
    if (!classId) return;
    if (selectedCard?.instance_id) setActiveInstanceId(selectedCard.instance_id);
    else setActiveInstanceId("");
  }, [classId, selectedCard]);

  useEffect(() => {
    const read = () => {
      try {
        setNavLinksEnabled(localStorage.getItem("nav_student_links") === "true");
      } catch {}
    };
    read();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "nav_student_links") read();
    };
    const onCustom = () => read();
    window.addEventListener("storage", onStorage);
    window.addEventListener("nav-links-changed", onCustom as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("nav-links-changed", onCustom as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!rosterQuery.trim()) {
      setRosterResults([]);
      setRosterSearching(false);
      return;
    }
    const q = rosterQuery.trim();
    const t = setTimeout(async () => {
      setRosterSearching(true);
      try {
        const res = await fetch("/api/students/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q }),
        });
        const data = await res.json();
        if (res.ok) setRosterResults((data.students ?? []) as any[]);
      } catch {}
      setRosterSearching(false);
    }, 200);
    return () => clearTimeout(t);
  }, [rosterQuery]);

  useEffect(() => {
    if (!selectedClassId) return;
    const supabase = supabaseClient();
    if (!activeInstanceId) return;
    const channel = supabase
      .channel(`classroom-checkins-${activeInstanceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_checkins", filter: `instance_id=eq.${activeInstanceId}` },
        async () => {
          await loadRoster(activeInstanceId);
          const res = await fetch(`/api/classroom/counts?date=${todayKey}`, { cache: "no-store" });
          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            setClassCounts((data.counts ?? {}) as Record<string, number>);
            setInstanceCounts((data.counts_by_instance ?? {}) as Record<string, number>);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeInstanceId, selectedClassId]);

  useEffect(() => {
    if (!scheduleCards.length) return;
    setInstanceCounts({});
    setClassCounts({});
    (async () => {
      try {
        const res = await fetch(`/api/classroom/counts?date=${todayKey}`, { cache: "no-store" });
        const data = await res.json();
        if (res.ok) {
          setClassCounts((data.counts ?? {}) as Record<string, number>);
          setInstanceCounts((data.counts_by_instance ?? {}) as Record<string, number>);
        }
      } catch {}
    })();
  }, [scheduleCards]);

  async function applyPoints(studentIds: string[], pts: number) {
    setMsg("");
    if (viewerRole === "classroom") {
      return setMsg("Classroom mode cannot award points.");
    }
    const ids = (studentIds ?? []).filter(Boolean);
    if (!ids.length) return setMsg("Select a student first.");
    let played = false;
    for (const studentId of ids) {
      setFlash((p) => ({ ...p, [studentId]: pts > 0 ? "green" : "red" }));
      setTimeout(() => setFlash((p) => ({ ...p, [studentId]: "" })), 420);
      fireFx(pts > 0 ? "add" : "remove");

      const res = await fetch("/api/ledger/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          points: pts,
          note: `Classroom ${pts > 0 ? "+" : ""}${pts}`,
          category: "classroom",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data?.error || "Failed to update points");
        continue;
      }
      if (!played && pts > 0) {
        playGlobalSfx("points_add");
        played = true;
      }

    }

    // refresh roster to reflect updated points_total
    loadRoster(activeInstanceId);
    setSelectedStudentIds([]);
  }

  function currentWeek() {
    const start = seasonSettings.start_date ? new Date(`${seasonSettings.start_date}T00:00:00`) : null;
    if (!start || Number.isNaN(start.getTime())) return 1;
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
    return Math.max(1, diffWeeks);
  }

  function ruleBreakerPenalty() {
    const week = currentWeek();
    return Math.min(50, Math.max(5, week * 5));
  }

  function ruleKeeperBonus() {
    return ruleBreakerPenalty();
  }

  function weekRangeLabel(weekNumber: number) {
    const start = seasonSettings.start_date ? new Date(`${seasonSettings.start_date}T00:00:00`) : null;
    if (!start || Number.isNaN(start.getTime())) return `Week ${weekNumber}`;
    const startDate = new Date(start);
    startDate.setDate(startDate.getDate() + (weekNumber - 1) * 7);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${fmt(startDate)} - ${fmt(endDate)}`;
  }

  function ruleTooltipText() {
    const week = currentWeek();
    const nextWeek = week + 1;
    const nextPoints = Math.min(50, Math.max(5, nextWeek * 5));
    const nextRange = weekRangeLabel(nextWeek);
    return `Rule points increase by 5 each week (max 50 at Week 10). Next week (${nextRange}) is +5: ${nextPoints} pts.`;
  }

  function playRuleBreakerTone() {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.value = 240;
      gain.gain.value = 0.12;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
      osc.onended = () => ctx.close();
    } catch {}
  }

  async function applyRuleBreaker(studentId: string) {
    setMsg("");
    if (viewerRole === "classroom") {
      return setMsg("Classroom mode cannot award points.");
    }
    const penalty = ruleBreakerPenalty();
    const week = currentWeek();
    setFlash((p) => ({ ...p, [studentId]: "red" }));
    setTimeout(() => setFlash((p) => ({ ...p, [studentId]: "" })), 420);
    fireFx("remove");
    const res = await fetch("/api/ledger/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id: studentId,
        points: -penalty,
        note: `Rule Breaker Week ${week} (-${penalty})`,
        category: "rule_breaker",
      }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data?.error || "Failed to apply rule breaker");
    loadRoster(activeInstanceId);
    setSelectedStudentIds([]);
  }

  async function applyRuleKeeper(studentId: string) {
    setMsg("");
    if (viewerRole === "classroom") {
      return setMsg("Classroom mode cannot award points.");
    }
    const bonus = ruleKeeperBonus();
    const week = currentWeek();
    setFlash((p) => ({ ...p, [studentId]: "green" }));
    setTimeout(() => setFlash((p) => ({ ...p, [studentId]: "" })), 420);
    fireFx("keeper");
    const res = await fetch("/api/ledger/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id: studentId,
        points: bonus,
        note: `Rule Keeper Week ${week} (+${bonus})`,
        category: "rule_keeper",
      }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data?.error || "Failed to apply rule keeper");
    loadRoster(activeInstanceId);
    setSelectedStudentIds([]);
  }

  async function verifyPin(pin: string) {
    const res = await fetch("/api/skill-tracker/settings/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: pin.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBulkPointsMsg(data?.error || "PIN verification failed");
      return false;
    }
    return true;
  }

  async function applyPointsToAll() {
    if (!roster.length) return setBulkPointsMsg("Roster is empty.");
    const delta = Number(bulkPointsValue);
    if (!Number.isFinite(delta) || delta === 0) return setBulkPointsMsg("Enter a non-zero points value.");
    if (!bulkPointsPin.trim()) return setBulkPointsMsg("Admin PIN required.");
    if (bulkPointsBusy) return;
    setBulkPointsBusy(true);
    setBulkPointsMsg("");
    const okPin = await verifyPin(bulkPointsPin);
    if (!okPin) {
      setBulkPointsBusy(false);
      return;
    }
    setBulkPointsOpen(false);
    roster.forEach((r) => {
      setFlash((p) => ({ ...p, [r.student.id]: delta > 0 ? "green" : "red" }));
      setTimeout(() => setFlash((p) => ({ ...p, [r.student.id]: "" })), 420);
      fireFx(delta > 0 ? "add" : "remove");
    });
    await Promise.all(
      roster.map((r) =>
        fetch("/api/ledger/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            student_id: r.student.id,
            points: delta,
            note: `Classroom all ${delta > 0 ? "+" : ""}${delta}`,
            category: "classroom_all",
          }),
        })
      )
    );
    setBulkPointsMsg(`Applied ${delta > 0 ? "+" : ""}${delta} to everyone.`);
    setBulkPointsBusy(false);
    loadRoster(activeInstanceId);
  }

  async function awardStudent(awardTypeId: string, studentId: string) {
    setMsg("");
    const res = await fetch("/api/awards/award", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ class_id: selectedClassId, student_id: studentId, award_type_id: awardTypeId }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data?.error || "Failed to award");
    await loadAwardAssignments(selectedClassId);
    await loadRoster(activeInstanceId);
  }

  async function unawardStudent(awardTypeId: string, studentId: string) {
    setMsg("");
    const res = await fetch("/api/awards/unaward", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ class_id: selectedClassId, student_id: studentId, award_type_id: awardTypeId }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data?.error || "Failed to remove award");
    await loadAwardAssignments(selectedClassId);
    await loadRoster(activeInstanceId);
  }

  async function uncheckStudent(checkinId: string, studentId: string, studentName: string) {
    setMsg("");
    const prev = roster;
    setRoster((r) => r.filter((row) => row.student.id !== studentId));
    const res = await fetch("/api/checkin/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkin_id: checkinId, class_id: selectedClassId, student_id: studentId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setRoster(prev);
      return setMsg(data?.error || "Failed to uncheck");
    }
    setMsg(`✅ ${studentName} un-checked`);
    loadRoster(activeInstanceId);
  }

  async function endClassSession() {
    setMsg("");
    const res = await fetch("/api/classroom/end", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ class_id: selectedClassId, instance_id: activeInstanceId }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data?.error || "Failed to end class");
    setClassEndedById((prev) => ({ ...prev, [classId]: true }));
    setMsg("Class ended. Roster locked.");
  }

  async function clearRoster() {
    if (!classId || clearingRoster) return;
    if (!window.confirm("Clear all checked-in students from this class?")) return;
    setClearingRoster(true);
    setMsg("");
    const res = await fetch("/api/checkin/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ class_id: selectedClassId, instance_id: activeInstanceId }),
    });
    const data = await res.json().catch(() => ({}));
    setClearingRoster(false);
    if (!res.ok) return setMsg(data?.error || "Failed to clear roster");
    setRoster([]);
    setMsg("Roster cleared.");
  }

  function openDashboard(studentId: string) {
    try {
      localStorage.setItem("active_student_id", studentId);
      window.dispatchEvent(new CustomEvent("active-student-changed", { detail: { student_id: studentId } }));
    } catch {}
    router.push("/dashboard");
  }

  const compCrestUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/badges/prestige/compteam.png`
    : "";

  async function checkInFromClassroom(studentId: string, studentName: string) {
    if (classEndedById[classId]) {
      setMsg("Class is ended. Check-ins are locked.");
      return;
    }
    if (!activeInstanceId) {
      setMsg("Select a class session to check students in.");
      return;
    }
    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instance_id: activeInstanceId, student_id: studentId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data?.error || "Check-in failed");
    setMsg(`✅ ${studentName} checked in.`);
    setRosterQuery("");
    setRosterResults([]);
    await loadRoster(activeInstanceId);
    try {
      const countsRes = await fetch(`/api/classroom/counts?date=${todayKey}`, { cache: "no-store" });
      const countsData = await countsRes.json().catch(() => ({}));
      if (countsRes.ok) {
        setClassCounts((countsData.counts ?? {}) as Record<string, number>);
        setInstanceCounts((countsData.counts_by_instance ?? {}) as Record<string, number>);
      }
    } catch {}
  }

  async function refreshClassroom() {
    await loadSchedule();
    await loadTodaySessions();
    try {
      const countsRes = await fetch(`/api/classroom/counts?date=${todayKey}`, { cache: "no-store" });
      const countsData = await countsRes.json().catch(() => ({}));
      if (countsRes.ok) {
        setClassCounts((countsData.counts ?? {}) as Record<string, number>);
        setInstanceCounts((countsData.counts_by_instance ?? {}) as Record<string, number>);
      }
    } catch {}
  }

  const classEnded = !!classEndedById[classId];
  const [todayLabel, setTodayLabel] = useState("");
  const rosterStudents = useMemo(
    () =>
      roster.map((r) => ({
        id: r.student.id,
        name: r.student.name,
        level: r.student.level,
        points_total: r.student.points_total,
        is_competition_team: r.student.is_competition_team,
      })),
    [roster]
  );
  const rosterIds = useMemo(() => roster.map((r) => r.student.id).filter(Boolean), [roster]);
  useEffect(() => {
    if (!todayLabel) setTodayLabel(new Date().toLocaleDateString());
  }, [todayLabel]);

  useEffect(() => {
    if (quickTool !== "group_tracker") return;
    setGroupSelectedIds((prev) => {
      if (!rosterIds.length) return [];
      if (!prev.length) return rosterIds;
      const next = prev.filter((id) => rosterIds.includes(id));
      return next.length ? next : rosterIds;
    });
  }, [quickTool, rosterIds]);

  const filteredGroupSkills = useMemo(() => {
    const q = groupSkillQuery.trim().toLowerCase();
    if (!q) return trackerSkills;
    return trackerSkills.filter((s) => `${s.name ?? ""} ${s.category ?? ""}`.toLowerCase().includes(q));
  }, [groupSkillQuery, trackerSkills]);

  const groupSkillsByCategory = useMemo(() => {
    const map = new Map<string, TrackerSkillRow[]>();
    filteredGroupSkills.forEach((s) => {
      const key = String(s.category ?? "Skills").trim() || "Skills";
      map.set(key, [...(map.get(key) ?? []), s]);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredGroupSkills]);

  const filteredGroupRoster = useMemo(() => {
    const q = groupRosterQuery.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter((r) => r.student.name.toLowerCase().includes(q));
  }, [groupRosterQuery, roster]);

  useEffect(() => {
    if (!["skill_lookup", "group_tracker"].includes(quickTool) || trackerSkills.length) return;
    (async () => {
      try {
        const res = await fetch("/api/tracker-skills/list", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;
        setTrackerSkills((data.skills ?? []) as TrackerSkillRow[]);
      } catch {}
    })();
  }, [quickTool, trackerSkills.length]);

  async function runSkillLookup(skillId: string) {
    if (!skillId) return;
    if (!roster.length) {
      setLookupMsg("Roster is empty.");
      return;
    }
    setLookupLoading(true);
    setLookupMsg("");
    try {
      const ids = roster.map((r) => r.student.id).filter(Boolean);
      const res = await fetch("/api/classroom/skill-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill_id: skillId, student_ids: ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLookupMsg(data?.error || "Failed to load skill stats.");
        return;
      }
      setLookupRows((data.stats ?? []) as any[]);
    } catch (err: any) {
      setLookupMsg(err?.message || "Failed to load skill stats.");
    } finally {
      setLookupLoading(false);
    }
  }

  function selectSkill(skill: TrackerSkillRow | null) {
    if (!skill) return;
    setSelectedSkillId(skill.id);
    setSelectedSkillName(skill.name);
    setSkillQuery(skill.name);
    runSkillLookup(skill.id);
  }

  function toggleGroupStudent(id: string) {
    setGroupSelectedIds((prev) => (prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]));
  }

  function selectAllGroupStudents() {
    setGroupSelectedIds(rosterIds);
  }

  function clearGroupStudents() {
    setGroupSelectedIds([]);
  }

  async function createGroupTracker() {
    setGroupMsg("");
    if (!groupSkillId) return setGroupMsg("Select a skill first.");
    if (!groupSelectedIds.length) return setGroupMsg("Select at least one student.");
    setGroupBusy(true);
    const res = await fetch("/api/skill-tracker/group/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_ids: groupSelectedIds,
        skill_id: groupSkillId,
        repetitions_target: groupReps,
      }),
    });
    const sj = await res.json().catch(() => ({}));
    setGroupBusy(false);
    if (!res.ok) return setGroupMsg(sj?.error || "Failed to create group tracker.");
    setGroupMsg(`Created group tracker for ${groupSelectedIds.length} students.`);
  }

  return (
    <main style={{ padding: "0 0 4px" }}>
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 26, fontWeight: 1000 }}>Lead Achieve</div>
            <button onClick={() => setMenuOpen(true)} style={btnSmallGhost()}>
              Menu
            </button>
          </div>
          <div
            style={{
              fontWeight: 1000,
              fontSize: 20,
              padding: "6px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.08)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
            }}
            suppressHydrationWarning
          >
            {todayLabel}
          </div>
        </div>

      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 1000, fontSize: 16, opacity: 0.9 }}>Select a class</div>
          <button onClick={refreshClassroom} style={btnSmallGhost()}>
            Refresh
          </button>
        </div>
        {(() => {
          const baseSlots = 1 + sortedScheduleCards.length;
          const totalSlots = Math.max(4, Math.ceil(baseSlots / 4) * 4);
          const placeholders = totalSlots - baseSlots;
          return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
              <div
                style={{
                  borderRadius: 16,
                  padding: 14,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.06)",
                  minHeight: 140,
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ fontWeight: 950, fontSize: 13, opacity: 0.9 }}>Admin Check-in</div>
                <input
                  value={rosterQuery}
                  onChange={(e) => setRosterQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    if (rosterResults.length === 1) {
                      e.preventDefault();
                      const pick = rosterResults[0];
                      checkInFromClassroom(pick.id, pick.name);
                    }
                  }}
                  disabled={classEnded}
                  placeholder='Type a student name (ex: "Eva")'
                  style={inp()}
                />
                {rosterSearching ? <div style={{ opacity: 0.7, fontSize: 12 }}>Searching…</div> : null}
                {rosterResults.length ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {rosterResults.slice(0, 4).map((s) => (
                      <button
                        key={s.id}
                        disabled={classEnded}
                        onClick={() => checkInFromClassroom(s.id, s.name)}
                        style={btnSmallGhost()}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              {sortedScheduleCards.map((c) => {
                const isActive = c.id === classId;
                const count = c.instance_id === activeInstanceId ? activeRosterCount : instanceCounts[c.instance_id] ?? 0;
                const classColor = c.class_color ?? "#2563eb";
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setClassId(c.id);
                      setActiveInstanceId(c.instance_id || "");
                    }}
                    style={{
                      textAlign: "left",
                      borderRadius: 16,
                      padding: 12,
                      border: isActive ? `1px solid ${withAlpha(classColor, 0.55)}` : "1px solid rgba(255,255,255,0.12)",
                      background: isActive
                        ? `linear-gradient(135deg, ${withAlpha(classColor, 0.3)}, rgba(15,23,42,0.92))`
                        : `linear-gradient(135deg, ${withAlpha(classColor, 0.15)}, rgba(255,255,255,0.06))`,
                      boxShadow: isActive ? `0 12px 36px ${withAlpha(classColor, 0.25)}` : "0 10px 24px rgba(0,0,0,0.22)",
                      color: "white",
                      cursor: "pointer",
                      minHeight: 140,
                    }}
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "72px 1fr", gap: 10, alignItems: "center" }}>
                      <div
                        style={{
                          width: 72,
                          height: 72,
                          borderRadius: 12,
                          border: `1px solid ${withAlpha(classColor, 0.35)}`,
                          background: c.image_url
                            ? `url(${c.image_url}) center/cover no-repeat`
                            : `linear-gradient(135deg, ${withAlpha(classColor, 0.35)}, rgba(15,23,42,0.92))`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 1000,
                          fontSize: 10,
                          letterSpacing: 0.4,
                          textTransform: "uppercase",
                        }}
                      >
                        {!c.image_url ? "Class" : null}
                      </div>
                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 1000 }}>{c.time}</div>
                        <div style={{ fontWeight: 1000, fontSize: 12 }}>{c.name}</div>
                        <div style={{ opacity: 0.8, fontSize: 10 }}>{c.instructors.join(", ")}</div>
                        {c.pass_names?.length ? (
                          <div style={{ fontWeight: 900, fontSize: 9, opacity: 0.85 }}>
                            Pass: {c.pass_names.join(", ")}
                          </div>
                        ) : null}
                        {c.room_name ? <div style={{ opacity: 0.65, fontSize: 10 }}>Room {c.room_name}</div> : null}
                        <div style={{ fontWeight: 1000, fontSize: 10 }}>{count} checked in</div>
                      </div>
                    </div>
                  </button>
                );
              })}
              {Array.from({ length: placeholders }).map((_, idx) => (
                <div
                  key={`placeholder-${idx}`}
                  style={{
                    borderRadius: 16,
                    minHeight: 140,
                    border: "1px dashed rgba(255,255,255,0.22)",
                    background: "rgba(255,255,255,0.02)",
                  }}
                />
              ))}
            </div>
          );
        })()}
        {!scheduleCards.length && (
          <div style={{ opacity: 0.7 }}>
            No classes yet. Add classes and schedule entries in the schedule admin.
          </div>
        )}
        <div style={{ opacity: 0.8, fontSize: 12 }}>
          Roster auto-populates from <b>Check-in</b>. No duplicates allowed.
        </div>
      </div>

      {msg && (
        <div style={{ padding: 10, borderRadius: 14, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(255,255,255,0.10)" }}>
          {msg}
        </div>
      )}

      <div style={{ display: "grid", gap: 6 }}>
        <div
          style={{
            fontSize: 11,
            opacity: 0.75,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace",
            userSelect: "text",
            WebkitUserSelect: "text",
          }}
        >
          ID #{classId || "—"}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ fontWeight: 1000, fontSize: 16 }}>
          Roster ({roster.length}) {classEnded ? "• Ended" : ""}
        </div>
        <button onClick={endClassSession} disabled={classEnded} style={btnSmallGhost()}>
          {classEnded ? "Class Ended" : "End Class"}
        </button>
      </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(240px, 320px)", gap: 12, alignItems: "start" }}>
        <Card
          title="Roster"
          actions={
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={clearRoster}
                disabled={!classId || rosterLoading || clearingRoster || !roster.length}
                style={btnSmallGhost()}
              >
                Clear all
              </button>
            </div>
          }
        >
          <div style={{ display: "grid", gap: 12, paddingBottom: 48 }}>
          {viewerRole !== "classroom" ? (
            <div
              style={{
                display: "grid",
                gap: 8,
                padding: 12,
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(0,0,0,0.2)",
              }}
            >
              <div style={{ fontWeight: 1000 }}>Class Squad Points</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Apply points to every student currently checked in.
              </div>
              <button
                onClick={() => setBulkPointsOpen(true)}
                disabled={!classId || !roster.length}
                style={classSquadBtn()}
              >
                Open Class Squad Points
              </button>
            </div>
          ) : null}
          {viewerRole !== "classroom" ? (
            <div
              style={{
                display: "grid",
                gap: 8,
                padding: 12,
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(0,0,0,0.2)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div style={{ fontWeight: 1000 }}>Quick Add Points</div>
                <button onClick={() => setMultiSelect((v) => !v)} style={btnSmallGhost()}>
                  {multiSelect ? "Multi-select On" : "Multi-select Off"}
                </button>
              </div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {selectedStudentIds.length
                  ? multiSelect
                    ? `Selected: ${selectedStudentIds.length} students`
                    : `Selected: ${roster.find((r) => r.student.id === selectedStudentIds[0])?.student.name ?? "Student"}`
                  : "Select a student card to enable quick points."}
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                {[1, 2, 5, 10, 15, -1, -2, -5, -10, -15].map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      if (!selectedStudentIds.length) return setMsg("Select a student first.");
                      applyPoints(selectedStudentIds, p);
                    }}
                    disabled={!selectedStudentIds.length}
                    style={p < 0 ? quickNegBtn() : btnSmall()}
                  >
                    {p > 0 ? `+${p}` : p}
                  </button>
                ))}
                {selectedStudentIds.length ? (
                  <button onClick={() => setSelectedStudentIds([])} style={btnSmallGhost()}>
                    Deselect
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(345px, 1fr))",
              columnGap: 28,
              rowGap: 48,
            }}
          >
          {rosterLoading && !roster.length && (
            <div style={{ opacity: 0.75 }}>Loading roster…</div>
          )}
          {roster
            .slice()
            .sort((a, b) => a.student.name.localeCompare(b.student.name))
            .map((r) => {
              const s = r.student;
              const f = flash[s.id] || "";
              const isComp = !!s.is_competition_team;
              const spotlight = spotlightCounts[s.id]?.count ?? 0;
              const nameParts = String(s.name ?? "").trim().split(/\s+/).filter(Boolean);
              const firstName = nameParts.shift() ?? s.name ?? "";
              const lastName = nameParts.join(" ");
              const prestigeIcons = (s.prestige_badges ?? []).length
                ? s.prestige_badges ?? []
                : isComp && compCrestUrl
                ? [compCrestUrl]
                : [];
              const badgeCountDisplay = Math.max(r.badgeCount, prestigeIcons.length, isComp ? 1 : 0);

              return (
                <CompetitionPrestigeFrame
                  key={r.checkin_id}
                  show={isComp}
                  masterStars={r.masterStars}
                  badges={[]}
                  badgeSize={56}
                  badgeGlow={false}
                  crestPosition="bottom-left"
                  crestSize={42}
                  crestGlow
                  labelPosition="center"
                  labelSize={8}
                >
                  <div
                    onClick={() => {
                      setSelectedStudentIds((prev) => {
                        const exists = prev.includes(s.id);
                        if (multiSelect) {
                          return exists ? prev.filter((id) => id !== s.id) : [...prev, s.id];
                        }
                        return exists ? [] : [s.id];
                      });
                    }}
                    style={{
                      position: "relative",
                      padding: 20,
                      paddingBottom: 48,
                      borderRadius: 22,
                      border:
                        selectedStudentIds.includes(s.id)
                          ? "2px solid rgba(59,130,246,0.75)"
                          : "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(0,0,0,0.22)",
                      display: "grid",
                      gap: 16,
                      minHeight: 260,
                      minWidth: 0,
                      overflow: "visible",
                      opacity: classEnded ? 0.4 : 1,
                      filter: classEnded ? "grayscale(1)" : "none",
                      pointerEvents: classEnded ? "none" : "auto",
                      boxShadow:
                        f === "green"
                          ? "0 0 0 2px rgba(34,197,94,0.55), 0 0 18px rgba(34,197,94,0.22)"
                          : f === "red"
                          ? "0 0 0 2px rgba(239,68,68,0.55), 0 0 18px rgba(239,68,68,0.22)"
                          : "none",
                      transition: "box-shadow 0.2s ease",
                      cursor: "pointer",
                    }}
                  >
                    {s.card_plate_url ? (
                      <img src={s.card_plate_url} alt="" style={cardPlateStyle(plateOffsets)} />
                    ) : null}
                    <div style={{ display: "grid", gap: 14 }}>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(0, 1fr) minmax(200px, 240px) minmax(0, 1fr)",
                          gap: 18,
                          alignItems: "start",
                        }}
                      >
                        <div style={{ display: "grid", justifyItems: "start", gap: 6 }}>
                          <div style={{ fontSize: 12, opacity: 0.6, textTransform: "uppercase", letterSpacing: 0.6 }}>
                            Points
                          </div>
                          <div style={{ fontSize: 20, fontWeight: 1000 }}>{formatPoints(s.points_total)}</div>
                        </div>
                        <div style={{ display: "grid", justifyItems: "center", gap: 10 }}>
                          <AvatarRender
                            size={180}
                            bg={avatarBackground(s.avatar_bg ?? null)}
                            border={buildBorderFromStudent(s)}
                            effect={buildEffectFromKey(s.avatar_effect, effectConfigByKey)}
                            avatarSrc={resolveAvatarUrl(s.avatar_storage_path) ?? undefined}
                            cornerOffsets={cornerOffsets}
                            bleed={24}
                            contextKey="classroom"
                            style={avatarFrameStyle()}
                            fallback={
                              <div style={{ fontSize: 12, opacity: 0.7, textAlign: "center", padding: "0 8px" }}>
                                No avatar selected
                              </div>
                            }
                          />
                        <div style={{ textAlign: "center", fontWeight: 1000, fontSize: 28, lineHeight: 1.05 }}>
                          <div>{firstName}</div>
                          {lastName ? <div>{lastName}</div> : null}
                        </div>
                        </div>
                        <div style={{ display: "grid", justifyItems: "end", gap: 6 }}>
                          <div style={{ fontSize: 12, opacity: 0.6, textTransform: "uppercase", letterSpacing: 0.6 }}>
                            Lvl
                          </div>
                          <div style={{ fontSize: 22, fontWeight: 1000 }}>{s.level}</div>
                        </div>
                      </div>

                      {prestigeIcons.length ? (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
                          {prestigeIcons.slice(0, 6).map((url, idx) => (
                            <img
                              key={`${url}-${idx}`}
                              src={url}
                              alt="Prestige badge"
                              style={{ width: 42, height: 42, objectFit: "contain", opacity: 0.95 }}
                            />
                          ))}
                        </div>
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            borderRadius: 12,
                            border: "1px dashed rgba(255,255,255,0.22)",
                            padding: "10px 8px",
                            fontSize: 11,
                            opacity: 0.6,
                            textAlign: "center",
                          }}
                        >
                          Badges
                        </div>
                      )}

                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ fontSize: 11, opacity: 0.75 }}>Spotlight Stars {spotlight}</div>
                        <div style={{ fontSize: 11, opacity: 0.72 }}>
                          Check-ins {r.checkinCount} • Badges {badgeCountDisplay} • Challenges {r.challengeCount}
                        </div>
                        <div style={{ fontSize: 10, opacity: 0.55, wordBreak: "break-word" }}>
                          Check-in ID: {r.checkin_id}
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        gap: 10,
                        paddingTop: 8,
                        borderTop: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      {viewerRole !== "classroom" ? (
                        <div style={{ display: "grid", gap: 6 }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              applyRuleBreaker(s.id);
                            }}
                            title={ruleTooltipText()}
                            style={btnSmallRule()}
                          >
                            Rule Breaker -{ruleBreakerPenalty()}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              applyRuleKeeper(s.id);
                            }}
                            title={ruleTooltipText()}
                            style={btnSmallReward()}
                          >
                            Rule Keeper +{ruleKeeperBonus()}
                          </button>
                        </div>
                      ) : null}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          uncheckStudent(r.checkin_id, s.id, s.name);
                        }}
                        style={btnSmallGhost()}
                      >
                        Uncheck
                      </button>
                    </div>
                  </div>
                </CompetitionPrestigeFrame>
              );
            })}

          {!rosterLoading && !roster.length && (
            <div style={{ opacity: 0.75 }}>No one checked in yet. Use the Check-in page.</div>
          )}
          </div>
          </div>
        </Card>
        <Card title="Quick Functions">
          <div style={{ display: "grid", gap: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.7 }}>Select a tool</label>
            <select value={quickTool} onChange={(e) => setQuickTool(e.target.value as any)} style={inp()}>
              <option value="none">Choose a function</option>
              <option value="skill_lookup">Roster Skill Lookup</option>
              <option value="group_tracker">Create Group Tracker</option>
            </select>

            {quickTool === "skill_lookup" ? (
              <div style={{ display: "grid", gap: 10 }}>
                <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.7 }}>Pick a skill</label>
                <input
                  value={skillQuery}
                  onChange={(e) => setSkillQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    const match =
                      trackerSkills.find((s) => s.name.toLowerCase() === skillQuery.trim().toLowerCase()) ||
                      trackerSkills.find((s) => s.name.toLowerCase().includes(skillQuery.trim().toLowerCase()));
                    if (match) {
                      e.preventDefault();
                      selectSkill(match);
                    }
                  }}
                  placeholder='Type a skill (ex: "Tornado Kick")'
                  style={inp()}
                />
                <select
                  value={selectedSkillId}
                  onChange={(e) => {
                    const next = trackerSkills.find((s) => s.id === e.target.value) ?? null;
                    selectSkill(next);
                  }}
                  style={inp()}
                >
                  <option value="">Select a skill</option>
                  {trackerSkills.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                {selectedSkillName ? (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Showing roster stats for: {selectedSkillName}</div>
                ) : null}
                {lookupMsg ? <div style={{ fontSize: 12, opacity: 0.75 }}>{lookupMsg}</div> : null}
                {lookupLoading ? <div style={{ fontSize: 12, opacity: 0.7 }}>Loading roster stats...</div> : null}
                {!lookupLoading && selectedSkillId ? (
                  <div style={{ display: "grid", gap: 6 }}>
                    {roster.map((r) => {
                      const stat = lookupRows.find((row) => row.student_id === r.student.id);
                      const attempts = stat?.attempts ?? 0;
                      const successes = stat?.successes ?? 0;
                      const last = stat?.last_at ? new Date(stat.last_at).toLocaleDateString() : "—";
                      return (
                        <div
                          key={`skill-${r.student.id}`}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr auto auto",
                            gap: 8,
                            alignItems: "center",
                            padding: "8px 10px",
                            borderRadius: 10,
                            border: "1px solid rgba(255,255,255,0.12)",
                            background: "rgba(15,23,42,0.4)",
                          }}
                        >
                          <div style={{ fontWeight: 900, fontSize: 12 }}>{r.student.name}</div>
                          <div style={{ fontSize: 11, opacity: 0.8 }}>
                            {attempts ? `${successes}/${attempts}` : "0/0"}
                          </div>
                          <div style={{ fontSize: 11, opacity: 0.7 }}>{last}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
            {quickTool === "group_tracker" ? (
              <div style={{ display: "grid", gap: 10 }}>
                <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.7 }}>Pick a skill</label>
                <input
                  value={groupSkillQuery}
                  onChange={(e) => setGroupSkillQuery(e.target.value)}
                  placeholder="Search skills"
                  style={inp()}
                />
                <select value={groupSkillId} onChange={(e) => setGroupSkillId(e.target.value)} style={inp()}>
                  <option value="">Select a skill</option>
                  {groupSkillsByCategory.map(([cat, rows]) => (
                    <optgroup key={cat} label={cat}>
                      {rows.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                <div style={{ display: "grid", gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.7 }}>Repetitions (1-20)</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={groupReps}
                    onChange={(e) => setGroupReps(Math.max(1, Math.min(20, Number(e.target.value))))}
                    style={inp()}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.7 }}>Roster picks</label>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{groupSelectedIds.length} selected</div>
                </div>
                <input
                  value={groupRosterQuery}
                  onChange={(e) => setGroupRosterQuery(e.target.value)}
                  placeholder="Filter roster names"
                  style={inp()}
                />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={selectAllGroupStudents} style={btnSmall()} type="button">
                    Select all
                  </button>
                  <button onClick={clearGroupStudents} style={btnSmallGhost()} type="button">
                    Clear
                  </button>
                </div>
                <div
                  style={{
                    display: "grid",
                    gap: 6,
                    maxHeight: 220,
                    overflowY: "auto",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(15,23,42,0.45)",
                    padding: 8,
                  }}
                >
                  {filteredGroupRoster.map((r) => {
                    const checked = groupSelectedIds.includes(r.student.id);
                    return (
                      <label key={`group-${r.student.id}`} style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 800 }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleGroupStudent(r.student.id)}
                        />
                        <span>{r.student.name}</span>
                      </label>
                    );
                  })}
                  {!filteredGroupRoster.length && <div style={{ opacity: 0.7 }}>No roster matches.</div>}
                </div>
                <button onClick={createGroupTracker} style={btn()} disabled={groupBusy}>
                  {groupBusy ? "Creating..." : "Create Group Tracker"}
                </button>
                {groupMsg ? <div style={{ fontSize: 12, opacity: 0.75 }}>{groupMsg}</div> : null}
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      {!!awardTypes.length && (
        <div style={{ marginTop: 50, opacity: classEnded ? 0.45 : 1, pointerEvents: classEnded ? "none" : "auto" }}>
          <Card title="Spotlight Stars">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              {awardTypes
                .filter((a) => a.enabled)
                .map((a) => {
                  const assigned = awardAssignments[a.id] ?? [];
                  return (
                    <button
                      key={a.id}
                      onClick={() => setOpenAwardTypeId(a.id)}
                      style={awardCardButton()}
                    >
                      <div style={{ fontWeight: 950 }}>{a.name}</div>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>{a.points} pts</div>
                      <div style={{ fontSize: 11, opacity: 0.65, marginTop: 6 }}>
                        Selected: {assigned.length}/2
                      </div>
                      <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                        {assigned.length ? assigned.map((s) => s.student_name).join(", ") : "No selections yet"}
                      </div>
                    </button>
                  );
                })}
            </div>
          </Card>
        </div>
      )}

      {openAwardTypeId && (
        <div style={overlayBackdrop()} onClick={() => setOpenAwardTypeId(null)}>
          <div style={overlayPanel()} onClick={(e) => e.stopPropagation()}>
            <div style={spotlightCorner()}>
              <span role="img" aria-label="Spotlight star">🌟</span>
            </div>
            {(() => {
              const award = awardTypes.find((a) => a.id === openAwardTypeId);
              if (!award) return null;
              const assigned = awardAssignments[award.id] ?? [];
              const takenIds = new Set(assigned.map((x) => x.student_id));
              return (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div style={{ fontWeight: 1000 }}>{award.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{award.points} pts • select up to 2</div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                    {roster
                      .slice()
                      .sort((a, b) => a.student.name.localeCompare(b.student.name))
                      .map((r) => {
                        const s = r.student;
                        const spotlight = spotlightCounts[s.id]?.count ?? 0;
                        const selected = takenIds.has(s.id);
                        const disabled = assigned.length >= 2 && !selected;
                        return (
                          <button
                            key={s.id}
                            disabled={disabled || awardLoading}
                            onClick={() => (selected ? unawardStudent(award.id, s.id) : awardStudent(award.id, s.id))}
                            style={awardStudentCard(selected, disabled)}
                          >
                            <AvatarRender
                              size={46}
                              bg={avatarBackground(s.avatar_bg ?? null)}
                              border={buildBorderFromStudent(s)}
                              effect={buildEffectFromKey(s.avatar_effect, effectConfigByKey)}
                              avatarSrc={resolveAvatarUrl(s.avatar_storage_path) ?? undefined}
                              cornerOffsets={cornerOffsets}
                              bleed={12}
                              contextKey="classroom"
                              style={avatarFrameStyle()}
                              fallback={
                                <div style={{ fontSize: 8, opacity: 0.7, textAlign: "center", padding: "0 4px" }}>
                                  No avatar
                                </div>
                              }
                            />
                            <div style={{ display: "grid", gap: 4 }}>
                              <div style={{ fontWeight: 900 }}>{s.name}</div>
                              <div style={{ fontSize: 11, opacity: 0.8 }}>
                                Lvl {s.level} • {formatPoints(s.points_total)} pts • Spotlight Stars {spotlight}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
      {menuOpen && (
        <div style={overlayBackdrop()} onClick={() => setMenuOpen(false)}>
          <div style={menuPanel()} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 1000, fontSize: 16 }}>Menu</div>
            <div style={{ display: "grid", gap: 8 }}>
              <button onClick={() => goToMenu("/", setMenuOpen)} style={menuButton()}>
                Home
              </button>
              <button onClick={() => goToMenu("/dashboard", setMenuOpen)} style={menuButton()}>
                Dashboard
              </button>
              <button onClick={() => goToMenu("/checkin", setMenuOpen)} style={menuButton()}>
                Check-in
              </button>
              <button onClick={() => goToMenu("/classroom/roster", setMenuOpen)} style={menuButton()}>
                Classroom Display
              </button>
              <button onClick={() => goToMenu("/admin/custom", setMenuOpen)} style={menuButton()}>
                Admin Custom
              </button>
              <button onClick={() => goToMenu("/logout", setMenuOpen)} style={menuButton()}>
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
      {bulkPointsOpen && (
        <div style={overlayBackdrop()} onClick={() => setBulkPointsOpen(false)}>
          <div style={overlayPanel()} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 1000 }}>Class Squad Points</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  Applies the same points change to the full roster.
                </div>
              </div>
              <button onClick={() => setBulkPointsOpen(false)} style={btnSmallGhost()}>
                ✕
              </button>
            </div>
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <input
                value={bulkPointsPin}
                onChange={(e) => setBulkPointsPin(e.target.value)}
                placeholder="Admin PIN"
                type="password"
                style={inp()}
              />
              <input
                value={bulkPointsValue}
                onChange={(e) => setBulkPointsValue(e.target.value)}
                placeholder="Points (ex: 5 or -5)"
                style={inp()}
              />
              {bulkPointsMsg ? <div style={{ fontSize: 12, opacity: 0.75 }}>{bulkPointsMsg}</div> : null}
              <button onClick={applyPointsToAll} style={btn()} disabled={bulkPointsBusy}>
                Apply Squad Points
              </button>
            </div>
          </div>
        </div>
      )}
      {viewerRole !== "classroom" ? (
        <GroupPointsOverlay
          open={groupPointsOpen}
          onClose={() => setGroupPointsOpen(false)}
          students={rosterStudents}
          title="Squad Points • Classroom"
          contextLabel="Select roster names, then choose points and enter admin PIN."
          onApplied={() => {
            if (classId) loadRoster(activeInstanceId);
          }}
        />
      ) : null}
      </div>
    </main>
  );
}

function inp(): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.24)",
    color: "white",
    outline: "none",
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

function btnSmall(): React.CSSProperties {
  return {
    width: 68,
    height: 68,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "linear-gradient(145deg, rgba(10,70,32,0.95), rgba(20,120,58,0.8))",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
    fontSize: 15,
    display: "grid",
    placeItems: "center",
    boxShadow: "inset 0 2px 4px rgba(255,255,255,0.12), 0 8px 16px rgba(0,0,0,0.4)",
  };
}

function quickNegBtn(): React.CSSProperties {
  return {
    width: 68,
    height: 68,
    borderRadius: 999,
    border: "1px solid rgba(239,68,68,0.65)",
    background: "linear-gradient(145deg, rgba(120,16,16,0.95), rgba(170,38,38,0.8))",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
    fontSize: 15,
    display: "grid",
    placeItems: "center",
    boxShadow: "inset 0 2px 4px rgba(255,255,255,0.12), 0 8px 16px rgba(0,0,0,0.4)",
  };
}

function classSquadBtn(): React.CSSProperties {
  return {
    width: "100%",
    borderRadius: 10,
    padding: "10px 14px",
    border: "1px solid rgba(255,255,255,0.18)",
    background: "linear-gradient(90deg, rgba(34,197,94,0.2), rgba(59,130,246,0.2))",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function btnSmallDanger(): React.CSSProperties {
  return {
    width: 60,
    height: 60,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "linear-gradient(145deg, rgba(120,16,16,0.95), rgba(170,38,38,0.8))",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
    fontSize: 14,
    display: "grid",
    placeItems: "center",
    boxShadow: "inset 0 2px 4px rgba(255,255,255,0.12), 0 8px 16px rgba(0,0,0,0.4)",
  };
}

function btnSmallGhost(): React.CSSProperties {
  return {
    padding: "6px 8px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 11,
  };
}

function btnSmallRule(): React.CSSProperties {
  return {
    padding: "16px 24px",
    borderRadius: 16,
    border: "1px solid rgba(239,68,68,0.6)",
    background: "linear-gradient(135deg, rgba(239,68,68,0.85), rgba(127,29,29,0.85))",
    color: "white",
    fontWeight: 1000,
    cursor: "pointer",
    fontSize: 16,
    minWidth: 180,
    textAlign: "center",
    boxShadow: "0 8px 16px rgba(127,29,29,0.35)",
  };
}

function btnSmallReward(): React.CSSProperties {
  return {
    padding: "16px 24px",
    borderRadius: 16,
    border: "1px solid rgba(34,197,94,0.6)",
    background: "linear-gradient(135deg, rgba(34,197,94,0.85), rgba(15,118,110,0.85))",
    color: "white",
    fontWeight: 1000,
    cursor: "pointer",
    fontSize: 16,
    minWidth: 180,
    textAlign: "center",
    boxShadow: "0 8px 16px rgba(15,118,110,0.35)",
  };
}

function nameLink(): React.CSSProperties {
  return {
    background: "none",
    border: "none",
    padding: 0,
    margin: 0,
    fontWeight: 1000,
    fontSize: 18,
    color: "white",
    cursor: "pointer",
    textAlign: "left",
  };
}

function formatPoints(value: number | null | undefined) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString();
}

function awardCardButton(): React.CSSProperties {
  return {
    textAlign: "left",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    padding: 12,
    background: "rgba(0,0,0,0.26)",
    color: "white",
    cursor: "pointer",
    display: "grid",
    gap: 4,
  };
}

function overlayBackdrop(): React.CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 120,
    padding: 16,
  };
}

function overlayPanel(): React.CSSProperties {
  return {
    width: "min(1060px, 100%)",
    maxHeight: "80vh",
    overflowY: "auto",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(7,10,16,0.96)",
    padding: 18,
    boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
    position: "relative",
  };
}

function menuPanel(): React.CSSProperties {
  return {
    width: "min(360px, 90vw)",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(8,12,20,0.96)",
    padding: 16,
    display: "grid",
    gap: 12,
    boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
  };
}

function menuButton(): React.CSSProperties {
  return {
    textAlign: "left",
    borderRadius: 12,
    padding: "10px 12px",
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function goToMenu(href: string, close: (open: boolean) => void) {
  close(false);
  window.location.href = href;
}

function spotlightCorner(): React.CSSProperties {
  return {
    position: "absolute",
    top: 10,
    right: 14,
    fontSize: 32,
    filter: "drop-shadow(0 8px 18px rgba(250,204,21,0.4))",
  };
}

function awardStudentCard(selected: boolean, disabled: boolean): React.CSSProperties {
  return {
    textAlign: "left",
    display: "grid",
    gridTemplateColumns: "46px 1fr",
    gap: 10,
    alignItems: "center",
    padding: 10,
    borderRadius: 14,
    border: selected ? "1px solid rgba(34,197,94,0.5)" : "1px solid rgba(255,255,255,0.12)",
    background: selected ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.06)",
    color: "white",
    opacity: disabled ? 0.55 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

function formatTime(input: string) {
  const parts = String(input ?? "").split(":").map(Number);
  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return input;
  const h = parts[0];
  const m = parts[1];
  const suffix = h >= 12 ? "PM" : "AM";
  const hr = ((h + 11) % 12) + 1;
  return `${hr}:${String(m).padStart(2, "0")} ${suffix}`;
}

function timeSort(a: string, b: string) {
  const toMin = (v: string) => {
    const parts = String(v ?? "").split(":").map(Number);
    if (parts.length < 2) return 0;
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  };
  return toMin(a) - toMin(b);
}

function withAlpha(hex: string, alpha: number) {
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6) return `rgba(37,99,235,${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function resolveAvatarUrl(storagePath?: string | null) {
  const clean = String(storagePath ?? "").trim();
  if (!clean) return "";
  if (/^https?:\/\//i.test(clean)) return clean;
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) return "";
  const normalized = clean.replace(/^\/+/, "");
  if (normalized.startsWith("storage/v1/object/public/")) {
    return `${baseUrl}/${normalized}`;
  }
  const fullPath = normalized.startsWith("avatars/") ? normalized : `avatars/${normalized}`;
  return `${baseUrl}/storage/v1/object/public/${fullPath}`;
}

function avatarBackground(bg: string | null) {
  return bg
    ? `linear-gradient(135deg, rgba(255,255,255,0.2), rgba(0,0,0,0.35)), ${bg}`
    : "linear-gradient(135deg, rgba(255,255,255,0.25), rgba(0,0,0,0.35))";
}

function avatarFrameStyle(): React.CSSProperties {
  return {
    border: "1px solid rgba(255,255,255,0.22)",
    boxShadow:
      "inset 0 2px 10px rgba(255,255,255,0.12), inset 0 -10px 16px rgba(0,0,0,0.45), 0 16px 28px rgba(0,0,0,0.4)",
  };
}

function buildBorderFromStudent(student: {
  corner_border_url?: string | null;
  corner_border_render_mode?: string | null;
  corner_border_html?: string | null;
  corner_border_css?: string | null;
  corner_border_js?: string | null;
  corner_border_offset_x?: number | null;
  corner_border_offset_y?: number | null;
}) {
  return {
    render_mode: student.corner_border_render_mode ?? null,
    image_url: student.corner_border_url ?? null,
    html: student.corner_border_html ?? null,
    css: student.corner_border_css ?? null,
    js: student.corner_border_js ?? null,
    offset_x: student.corner_border_offset_x ?? null,
    offset_y: student.corner_border_offset_y ?? null,
  };
}

function buildEffectFromKey(
  key: string | null | undefined,
  map: Record<
    string,
    {
      config?: {
        density?: number;
        size?: number;
        speed?: number;
        opacity?: number;
        frequency?: number;
      } | null;
      render_mode?: string | null;
      html?: string | null;
      css?: string | null;
      js?: string | null;
    }
  >
) {
  const effect = key ? map[String(key)] : undefined;
  return {
    key: key ?? null,
    config: effect?.config ?? null,
    render_mode: effect?.render_mode ?? null,
    html: effect?.html ?? null,
    css: effect?.css ?? null,
    js: effect?.js ?? null,
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

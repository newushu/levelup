"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import { supabaseClient } from "@/lib/supabase/client";

type StudentRow = {
  id: string;
  name: string;
  points_total?: number | null;
  level?: number | null;
  avatar_storage_path?: string | null;
  avatar_bg?: string | null;
  badgeCount?: number | null;
};

type RosterRow = {
  checkin_id: string;
  checked_in_at?: string | null;
  badgeCount?: number | null;
  student: StudentRow;
};

type SessionRow = {
  instance_id: string;
  class_id: string;
  class_name: string;
  start_time: string;
  end_time?: string | null;
};

export default function CoachClassroomPage() {
  const params = useSearchParams();
  const lockInstanceId = String(params.get("lock_instance_id") ?? "").trim();
  const lockClassId = String(params.get("lock_class_id") ?? "").trim();
  const [todaySessions, setTodaySessions] = useState<SessionRow[]>([]);
  const [now, setNow] = useState<Date>(new Date());
  const [resolvedClassId, setResolvedClassId] = useState<string>("");
  const [activeInstanceId, setActiveInstanceId] = useState<string>("");
  const [activeClassId, setActiveClassId] = useState<string>("");
  const [blocked, setBlocked] = useState(false);
  const [msg, setMsg] = useState("");
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [seasonSettings, setSeasonSettings] = useState<{ start_date?: string | null; weeks?: number | null }>({});
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [flash, setFlash] = useState<Record<string, "red" | "green" | "">>({});
  const [deltaFlash, setDeltaFlash] = useState<Record<string, { text: string; at: number }>>({});
  const [pointsByStudent, setPointsByStudent] = useState<Record<string, { green: number; red: number }>>({});
  const [spotlightCounts, setSpotlightCounts] = useState<Record<string, { count: number }>>({});
  const [spotlightTypes, setSpotlightTypes] = useState<Array<{ id: string; name: string; points: number }>>([]);
  const [spotlightTypeId, setSpotlightTypeId] = useState("");
  const [spotlightAwardPoints, setSpotlightAwardPoints] = useState<Record<string, number>>({});
  const [spotlightAwards, setSpotlightAwards] = useState<Array<{ student_id: string; award_type_id: string; points_awarded: number }>>([]);
  const [spotlightSelectMode, setSpotlightSelectMode] = useState(false);
  const [spotlightSelectedIds, setSpotlightSelectedIds] = useState<string[]>([]);
  const [spotlightLimit, setSpotlightLimit] = useState(2);
  const [spotlightLocked, setSpotlightLocked] = useState(false);
  const [spotlightLockAt, setSpotlightLockAt] = useState<number | null>(null);
  const [quickBusy, setQuickBusy] = useState(false);
  const [checkinName, setCheckinName] = useState("");
  const [checkinMatch, setCheckinMatch] = useState<{ id: string; name: string } | null>(null);
  const [checkinMsg, setCheckinMsg] = useState("");
  const [checkinBusy, setCheckinBusy] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isInstanceActiveNow = (session: SessionRow, ref: Date) => {
    if (!session?.start_time) return false;
    const today = ref.toLocaleDateString("en-CA");
    const [sh, sm, ss] = String(session.start_time ?? "00:00:00").split(":").map((v) => Number(v || 0));
    const start = new Date(`${today}T00:00:00`);
    start.setHours(sh || 0, sm || 0, ss || 0, 0);
    const [eh, em, es] = String(session.end_time ?? "").split(":").map((v) => Number(v || 0));
    const end = new Date(start);
    if (session.end_time) end.setHours(eh || 0, em || 0, es || 0, 0);
    else end.setMinutes(end.getMinutes() + 60);
    const windowStart = new Date(start.getTime() - 10 * 60 * 1000);
    const windowEnd = new Date(end.getTime() + 30 * 60 * 1000);
    return ref >= windowStart && ref <= windowEnd;
  };

  const pickActiveSession = (sessions: SessionRow[], ref: Date) => {
    const candidates = sessions.filter((s) => isInstanceActiveNow(s, ref));
    if (candidates.length) {
      return candidates.sort((a, b) => String(b.start_time).localeCompare(String(a.start_time)))[0];
    }
    const today = ref.toLocaleDateString("en-CA");
    const upcoming = sessions
      .map((s) => {
        if (!s.start_time) return null;
        const [h, m, sec] = String(s.start_time ?? "00:00:00").split(":").map((v) => Number(v || 0));
        const start = new Date(`${today}T00:00:00`);
        start.setHours(h || 0, m || 0, sec || 0, 0);
        return { session: s, start };
      })
      .filter(Boolean) as Array<{ session: SessionRow; start: Date }>;
    const next = upcoming
      .filter((row) => row.start >= ref)
      .sort((a, b) => a.start.getTime() - b.start.getTime())[0];
    return next?.session ?? null;
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        const role = String(data?.role ?? "");
        if (!data?.ok || (role !== "admin" && role !== "coach")) setBlocked(true);
      } catch {
        setBlocked(true);
      }
    })();
  }, []);

  useEffect(() => {
    const name = checkinName.trim();
    if (!name) {
      setCheckinMatch(null);
      return;
    }
    let active = true;
    const t = setTimeout(async () => {
      try {
        const lookup = await fetch(`/api/students/lookup?name=${encodeURIComponent(`%${name}%`)}`, { cache: "no-store" });
        const lookupJson = await lookup.json().catch(() => ({}));
        if (!active) return;
        if (lookup.ok && lookupJson?.ok && lookupJson?.student?.id) {
          setCheckinMatch({ id: String(lookupJson.student.id), name: String(lookupJson.student.name ?? "") });
        } else {
          setCheckinMatch(null);
        }
      } catch {
        if (active) setCheckinMatch(null);
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [checkinName]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/season-settings", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (res.ok) setSeasonSettings(data?.settings ?? {});
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (blocked) return;
    (async () => {
      try {
        const res = await fetch("/api/class-sessions/today?include_ended=1", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!data?.ok) return;
        setTodaySessions((data.sessions ?? []) as SessionRow[]);
      } catch {}
    })();
  }, [blocked]);

  useEffect(() => {
    if (blocked) return;
    if (!todaySessions.length) {
      if (lockInstanceId) {
        setActiveInstanceId(lockInstanceId);
        setActiveClassId(lockClassId || "");
      }
      return;
    }
    const lockSession = todaySessions.find((s) => String(s.instance_id) === lockInstanceId);
    if (lockInstanceId && lockSession && isInstanceActiveNow(lockSession, now)) {
      setActiveInstanceId(lockInstanceId);
      setActiveClassId(lockClassId || lockSession.class_id || "");
      return;
    }
    const active = pickActiveSession(todaySessions, now);
    if (active?.instance_id) {
      setActiveInstanceId(String(active.instance_id));
      setActiveClassId(String(active.class_id ?? ""));
      return;
    }
    if (lockInstanceId) {
      setActiveInstanceId(lockInstanceId);
      setActiveClassId(lockClassId || lockSession?.class_id || "");
      return;
    }
    const first = todaySessions[0];
    if (first?.instance_id) {
      setActiveInstanceId(String(first.instance_id));
      setActiveClassId(String(first.class_id ?? ""));
    }
  }, [blocked, todaySessions, lockInstanceId, lockClassId, now]);

  useEffect(() => {
    if (lockClassId) {
      setResolvedClassId(lockClassId);
      return;
    }
    if (!activeInstanceId) {
      setResolvedClassId("");
      setRoster([]);
      setSelectedIds([]);
      setSpotlightSelectedIds([]);
      setMsg("");
      return;
    }
    (async () => {
      try {
        if (activeClassId) {
          setResolvedClassId(activeClassId);
          return;
        }
        const res = await fetch("/api/class-sessions/today?include_ended=1", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;
        const match = (data.sessions ?? []).find((s: any) => String(s.instance_id ?? "") === activeInstanceId);
        if (match?.class_id) setResolvedClassId(String(match.class_id));
      } catch {}
    })();
  }, [lockClassId, activeInstanceId, activeClassId]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/awards/types", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(data?.types) && data.types.length) {
          const list = data.types as Array<{ id: string; name: string; points: number }>;
          setSpotlightTypes(list.map((t) => ({ id: String(t.id), name: String(t.name ?? "Spotlight"), points: Number(t.points ?? 0) })));
          setSpotlightLimit(list.length);
          if (!spotlightTypeId) setSpotlightTypeId(String(list[0]?.id ?? ""));
        }
      } catch {}
    })();
  }, [spotlightTypeId]);

  useEffect(() => {
    if (!spotlightTypes.length) return;
    if (!spotlightTypes.find((t) => t.id === spotlightTypeId)) {
      setSpotlightTypeId(String(spotlightTypes[0]?.id ?? ""));
    }
  }, [spotlightTypes, spotlightTypeId]);

  useEffect(() => {
    if (!activeInstanceId) {
      setSpotlightLocked(false);
      setSpotlightLockAt(null);
      return;
    }
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/class-sessions/today?include_ended=1", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;
        const match = (data.sessions ?? []).find((s: any) => String(s.instance_id ?? "") === activeInstanceId);
        const endTime = String(match?.end_time ?? "").trim();
        const day = String(data?.today ?? "").trim() || new Date().toISOString().slice(0, 10);
        if (!endTime) return;
        const [h, m, s] = endTime.split(":").map((v) => Number(v || 0));
        const endDate = new Date(`${day}T00:00:00`);
        endDate.setHours(h || 0, m || 0, s || 0, 0);
        const lockAt = endDate.getTime() + 30 * 60 * 1000;
        if (!active) return;
        setSpotlightLockAt(lockAt);
        setSpotlightLocked(Date.now() >= lockAt);
      } catch {}
    })();
    return () => {
      active = false;
    };
  }, [activeInstanceId]);

  useEffect(() => {
    if (spotlightLockAt == null) return;
    const timer = setInterval(() => {
      setSpotlightLocked(Date.now() >= spotlightLockAt);
    }, 5000);
    return () => clearInterval(timer);
  }, [spotlightLockAt]);

  useEffect(() => {
    if (spotlightLocked && spotlightSelectMode) {
      setSpotlightSelectMode(false);
      setSpotlightSelectedIds([]);
    }
  }, [spotlightLocked, spotlightSelectMode]);

  const loadRoster = async () => {
    if (!activeInstanceId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/classroom/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instance_id: activeInstanceId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error || "Failed to load roster");
        setLoading(false);
        return;
      }
      const nextRoster = (data?.roster ?? []) as RosterRow[];
      setRoster(nextRoster);
      await loadDailyTotals(nextRoster);
      await loadSpotlightCounts(nextRoster);
      await loadSpotlightAwards();
      setMsg("");
    } catch (err: any) {
      setMsg(err?.message ?? "Failed to load roster");
    } finally {
      setLoading(false);
    }
  };

  async function uncheckStudent(checkinId: string, studentId: string, studentName: string) {
    if (!activeInstanceId || !resolvedClassId) {
      setMsg("Select a class in the coach dashboard.");
      return;
    }
    if (!window.confirm(`Uncheck ${studentName}?`)) return;
    setMsg("");
    const prev = roster;
    setRoster((r) => r.filter((row) => row.student.id !== studentId));
    const res = await fetch("/api/checkin/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkin_id: checkinId, class_id: resolvedClassId, student_id: studentId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setRoster(prev);
      return setMsg(data?.error || "Failed to uncheck");
    }
    setMsg(`✅ ${studentName} un-checked`);
    loadRoster();
  }

  async function checkInByName(override?: { id: string; name: string }) {
    setCheckinMsg("");
    const name = checkinName.trim();
    if (!name) {
      setCheckinMsg("Type a student name first.");
      return;
    }
    if (!activeInstanceId) {
      setCheckinMsg("Select a class in the coach dashboard.");
      return;
    }
    setCheckinBusy(true);
    try {
      let student = override;
      if (!student?.id) {
        const lookup = await fetch(`/api/students/lookup?name=${encodeURIComponent(`%${name}%`)}`, { cache: "no-store" });
        const lookupJson = await lookup.json().catch(() => ({}));
        if (!lookup.ok || !lookupJson?.ok) {
          setCheckinMsg(lookupJson?.error || "Student lookup failed.");
          return;
        }
        student = lookupJson?.student ?? null;
      }
      if (!student?.id) {
        setCheckinMsg("No matching student found.");
        return;
      }
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instance_id: activeInstanceId, student_id: student.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setCheckinMsg(data?.error || "Check-in failed.");
        return;
      }
      setCheckinMsg(`✅ ${student.name} checked in.`);
      setCheckinName("");
      loadRoster();
    } catch (err: any) {
      setCheckinMsg(err?.message ?? "Check-in failed.");
    } finally {
      setCheckinBusy(false);
    }
  }

  const loadDailyTotals = async (rows: RosterRow[]) => {
    const ids = rows.map((r) => r.student.id).filter(Boolean);
    if (!ids.length) return setPointsByStudent({});
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const res = await fetch("/api/coach/classroom/daily-totals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_ids: ids, time_zone: timeZone }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setPointsByStudent((data?.totals ?? {}) as Record<string, { green: number; red: number }>);
  };

  const loadSpotlightCounts = async (rows: RosterRow[]) => {
    const ids = rows.map((r) => r.student.id).filter(Boolean);
    if (!ids.length) return setSpotlightCounts({});
    const res = await fetch("/api/awards/student-counts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_ids: ids }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setSpotlightCounts((data?.counts ?? {}) as Record<string, { count: number }>);
  };

  const loadSpotlightAwards = async () => {
    const classId = await resolveAwardsClassId();
    if (!classId) return setSpotlightAwards([]);
    const res = await fetch("/api/awards/class-today", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ class_id: classId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return;
    const awards = (data?.awards ?? []) as Array<{ student_id: string; award_type_id: string; points_awarded: number }>;
    const normalized = awards.map((a) => ({
      student_id: String(a.student_id ?? ""),
      award_type_id: String(a.award_type_id ?? ""),
      points_awarded: Number(a.points_awarded ?? 0),
    }));
    setSpotlightAwards(normalized);
    const nextPoints: Record<string, number> = {};
    normalized.forEach((a) => {
      if (a.award_type_id === spotlightType?.id) {
        nextPoints[a.student_id] = a.points_awarded;
      }
    });
    if (Object.keys(nextPoints).length) {
      setSpotlightAwardPoints((prev) => ({ ...prev, ...nextPoints }));
    }
  };

  useEffect(() => {
    if (!activeInstanceId) return;
    loadRoster();
    const timer = setInterval(loadRoster, 8000);
    return () => clearInterval(timer);
  }, [activeInstanceId]);

  useEffect(() => {
    if (!resolvedClassId) {
      setSpotlightAwards([]);
      return;
    }
    loadSpotlightAwards();
  }, [resolvedClassId, spotlightTypeId]);

  useEffect(() => {
    setSelectedIds([]);
    setPointsByStudent({});
  }, [activeInstanceId]);

  useEffect(() => {
    if (!activeInstanceId || blocked) return;
    const supabase = supabaseClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const scheduleRefresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => loadRoster(), 150);
    };
    const setupChannel = async () => {
      const session = await supabase.auth.getSession();
      if (session.data?.session?.access_token) {
        supabase.realtime.setAuth(session.data.session.access_token);
      }
      if (channel) await supabase.removeChannel(channel);
      channel = supabase
        .channel(`coach-classroom-${activeInstanceId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "attendance_checkins", filter: `instance_id=eq.${activeInstanceId}` },
          scheduleRefresh
        )
        .subscribe();
    };
    setupChannel();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);
      setupChannel();
      scheduleRefresh();
    });
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      if (authListener?.subscription) authListener.subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, [activeInstanceId, blocked]);

  const sortedRoster = useMemo(() => {
    return [...roster].sort((a, b) => a.student.name.localeCompare(b.student.name));
  }, [roster]);

  const spotlightType = useMemo(() => {
    if (!spotlightTypes.length) return null;
    return spotlightTypes.find((t) => t.id === spotlightTypeId) ?? spotlightTypes[0];
  }, [spotlightTypes, spotlightTypeId]);

  const spotlightTypeNameById = useMemo(() => {
    const map = new Map<string, string>();
    spotlightTypes.forEach((t) => map.set(String(t.id), String(t.name ?? "Spotlight")));
    return map;
  }, [spotlightTypes]);

  const selectedSession = useMemo(() => {
    if (!todaySessions.length) return null;
    return todaySessions.find((s) => String(s.instance_id) === String(activeInstanceId)) ?? null;
  }, [todaySessions, activeInstanceId]);

  const countdownText = useMemo(() => {
    if (!selectedSession?.start_time) return "";
    const today = new Date().toISOString().slice(0, 10);
    const startAt = toDateTime(today, selectedSession.start_time);
    if (!startAt) return "";
    const diffMs = startAt.getTime() - now.getTime();
    if (diffMs <= 0 || diffMs > 10 * 60 * 1000) return "";
    const totalSeconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [selectedSession, now]);

  const spotlightAwardedIdsForType = useMemo(() => {
    if (!spotlightType) return [];
    return spotlightAwards.filter((a) => a.award_type_id === spotlightType.id).map((a) => a.student_id);
  }, [spotlightAwards, spotlightType]);

  const spotlightAwardsOtherCount = useMemo(() => {
    if (!spotlightType) return spotlightAwards.length;
    return spotlightAwards.filter((a) => a.award_type_id !== spotlightType.id).length;
  }, [spotlightAwards, spotlightType]);

  const normalizeIds = (ids: string[]) =>
    Array.from(new Set(ids.map((id) => String(id ?? "").trim()).filter(Boolean)));

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

  async function applyRule(studentId: string, kind: "rule_breaker" | "rule_keeper") {
    const week = currentWeek();
    const points = kind === "rule_breaker" ? -ruleBreakerPenalty() : ruleKeeperBonus();
    const label = kind === "rule_breaker" ? "Rule Breaker" : "Rule Keeper";
    const note =
      kind === "rule_breaker"
        ? `${label} Week ${week} (-${Math.abs(points)})`
        : `${label} Week ${week} (+${Math.abs(points)})`;
    setFlash((p) => ({ ...p, [studentId]: kind === "rule_breaker" ? "red" : "green" }));
    setTimeout(() => setFlash((p) => ({ ...p, [studentId]: "" })), 420);
    setDeltaFlash((p) => ({ ...p, [studentId]: { text: points > 0 ? `+${points}` : `${points}`, at: Date.now() } }));
    setTimeout(() => setDeltaFlash((p) => {
      const next = { ...p };
      delete next[studentId];
      return next;
    }), 900);
    const res = await fetch("/api/ledger/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId, points, note, category: kind }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data?.error || "Failed to save");
      return;
    }
    loadDailyTotals(roster);
    loadRoster();
  }

  async function applyQuickPoints(points: number) {
    if (!selectedIds.length || quickBusy) return;
    setQuickBusy(true);
    const uniqueIds = Array.from(new Set(selectedIds));
    for (const studentId of uniqueIds) {
      const note = points >= 0 ? `Quick points +${points}` : `Quick points ${points}`;
      const res = await fetch("/api/ledger/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId, points, note, category: "classroom" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error || "Failed to add points");
      } else {
        loadDailyTotals(roster);
        setDeltaFlash((p) => ({ ...p, [studentId]: { text: points > 0 ? `+${points}` : `${points}`, at: Date.now() } }));
        setTimeout(() => setDeltaFlash((p) => {
          const next = { ...p };
          delete next[studentId];
          return next;
        }), 900);
      }
    }
    loadRoster();
    setSelectedIds([]);
    setQuickBusy(false);
  }

  async function awardSpotlight() {
    const classId = await resolveAwardsClassId();
    if (!spotlightType) {
      setMsg("No Spotlight Star award type enabled.");
      return;
    }
    if (!spotlightSelectedIds.length && !spotlightAwardedIdsForType.length) {
      setMsg("Select at least one student.");
      return;
    }
    if (!classId) {
      setMsg("Select a class in the coach dashboard first.");
      return;
    }
    if (spotlightLocked) {
      setMsg("Spotlight selections are locked 30 minutes after class ends.");
      return;
    }
    const uniqueSelected = Array.from(new Set(spotlightSelectedIds));
    const existingForType = new Set(spotlightAwardedIdsForType);
    const toAdd = uniqueSelected.filter((id) => !existingForType.has(id));
    const toRemove = Array.from(existingForType).filter((id) => !uniqueSelected.includes(id));
    const desiredTotal = spotlightAwardsOtherCount + uniqueSelected.length;
    if (desiredTotal > spotlightLimit) {
      setMsg(`Spotlight limit reached (${spotlightLimit}). Remove someone first.`);
      return;
    }
    for (const studentId of toRemove) {
      const res = await fetch("/api/awards/unaward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ class_id: classId, student_id: studentId, award_type_id: spotlightType.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error || "Failed to remove spotlight");
      }
    }
    for (const studentId of toAdd) {
      const res = await fetch("/api/awards/award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ class_id: classId, student_id: studentId, award_type_id: spotlightType.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && !data?.already) {
        setMsg(data?.error || "Failed to award spotlight");
      } else if (data?.already) {
        setMsg("Spotlight already awarded for this student.");
      } else {
        const points = Number(data?.points_awarded ?? spotlightType.points ?? 0);
        setSpotlightAwardPoints((prev) => ({ ...prev, [studentId]: points }));
      }
    }
    await loadSpotlightCounts(roster);
    await loadSpotlightAwards();
    setSpotlightSelectedIds([]);
    setSpotlightSelectMode(false);
  }

  async function removeSpotlight(studentId: string) {
    const classId = await resolveAwardsClassId();
    if (!spotlightType || !classId) return;
    if (spotlightLocked) {
      setMsg("Spotlight selections are locked 30 minutes after class ends.");
      return;
    }
    const res = await fetch("/api/awards/unaward", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ class_id: classId, student_id: studentId, award_type_id: spotlightType.id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data?.error || "Failed to remove spotlight");
      return;
    }
    setSpotlightAwards((prev) =>
      prev.filter(
        (a) => !(String(a.student_id) === String(studentId) && String(a.award_type_id) === String(spotlightType.id))
      )
    );
    setSpotlightAwardPoints((prev) => {
      const next = { ...prev };
      delete next[String(studentId)];
      return next;
    });
    setSpotlightCounts((prev) => {
      const current = prev[String(studentId)]?.count ?? 0;
      if (!current) return prev;
      return { ...prev, [String(studentId)]: { count: Math.max(0, current - 1) } };
    });
    await loadSpotlightCounts(roster);
    await loadSpotlightAwards();
    setSpotlightSelectedIds((prev) => prev.filter((id) => String(id) !== String(studentId)));
  }

  async function removeAllSpotlight() {
    const classId = await resolveAwardsClassId();
    if (!spotlightType || !classId) return;
    if (spotlightLocked) {
      setMsg("Spotlight selections are locked 30 minutes after class ends.");
      return;
    }
    if (!spotlightAwardedIdsForType.length) {
      setMsg("No Spotlight Stars to remove.");
      return;
    }
    for (const studentId of spotlightAwardedIdsForType) {
      await removeSpotlight(studentId);
    }
  }

  async function resolveAwardsClassId() {
    if (resolvedClassId) return resolvedClassId;
    if (lockClassId) return lockClassId;
    if (!activeInstanceId) return "";
    try {
      const res = await fetch("/api/class-sessions/today?include_ended=1", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return "";
      const match = (data.sessions ?? []).find((s: any) => String(s.instance_id ?? "") === activeInstanceId);
      const classId = String(match?.class_id ?? "");
      if (classId) setResolvedClassId(classId);
      return classId;
    } catch {
      return "";
    }
  }

  return (
    <AuthGate>
      {blocked ? (
        <div style={blockedStyle()}>Coach classroom is coach-only.</div>
      ) : (
        <main style={page()}>
          <div style={headerButtons()}>
            {spotlightType ? (
              <div style={spotlightBadge()}>
                <div style={{ fontSize: 10, opacity: 0.8 }}>Awarding</div>
                <div style={{ fontSize: 12, fontWeight: 900 }}>
                  {spotlightType.name} • +{spotlightType.points}
                </div>
              </div>
            ) : null}
            {spotlightTypes.length > 1 ? (
              <select
                value={spotlightType?.id ?? ""}
                onChange={(e) => {
                  const next = e.target.value;
                  setSpotlightTypeId(next);
                  if (spotlightSelectMode) {
                    const existing = spotlightAwards.filter((a) => a.award_type_id === next).map((a) => a.student_id);
                    setSpotlightSelectedIds(normalizeIds(existing));
                  }
                }}
                style={chipSelect()}
              >
                {spotlightTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            ) : null}
            {spotlightSelectMode ? (
              <>
                <button
                  style={chipBtn()}
                  onClick={awardSpotlight}
                >
                  OK
                </button>
                <button
                  style={chipBtn()}
                  onClick={() => {
                    setSpotlightSelectMode(false);
                    setSpotlightSelectedIds([]);
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                style={chipBtn()}
                onClick={() => {
                  if (spotlightLocked) {
                    setMsg("Spotlight selections are locked 30 minutes after class ends.");
                    return;
                  }
                  if (!spotlightType || spotlightLimit <= 0) {
                    setMsg("No Spotlight Star awards are enabled. Configure them in Admin → Custom → Spotlight.");
                    return;
                  }
                  setSpotlightSelectMode(true);
                  setSpotlightSelectedIds(normalizeIds(spotlightAwardedIdsForType));
                }}
              >
                {spotlightAwardedIdsForType.length ? "Edit Spotlight Stars" : "Select Spotlight Stars"}
              </button>
            )}
            {spotlightAwardedIdsForType.length ? (
              <button style={chipBtn()} onClick={removeAllSpotlight}>
                Remove All Stars
              </button>
            ) : null}
            <button style={chipBtn()} onClick={() => setSelectedIds([])}>
              Clear Selection
            </button>
          </div>
          <div style={header()}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={subtitle()}>
                {activeInstanceId ? "Class locked for this view" : "Select a class in the coach dashboard"}
              </div>
              <div style={msgStyle()}>
                Spotlight: {spotlightSelectedIds.length}/{spotlightLimit} selected • awarded {spotlightAwards.length}
                {spotlightLocked ? " • Locked (30 minutes after class end)" : ""}
                {spotlightSelectMode ? " • Selection mode ON" : ""}
              </div>
            </div>
            {countdownText ? (
              <div style={countdownBadge()}>
                <div style={{ fontSize: 10, opacity: 0.7, letterSpacing: 1 }}>CLASS STARTS IN</div>
                <div style={{ fontSize: 20, fontWeight: 1000 }}>{countdownText}</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{selectedSession?.class_name || "Class"}</div>
              </div>
            ) : null}
          </div>

          <div style={checkinRow()}>
            <input
              value={checkinName}
              onChange={(e) => setCheckinName(e.target.value)}
              placeholder="Quick check-in by name"
              style={checkinInput()}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                if (!checkinBusy) checkInByName(checkinMatch ?? undefined);
              }}
            />
            {checkinMatch ? <div style={checkinMatchStyle()}>Match: {checkinMatch.name}</div> : null}
            <button style={chipBtn()} onClick={() => checkInByName(checkinMatch ?? undefined)} disabled={checkinBusy}>
              Check in
            </button>
            {checkinMsg ? <div style={checkinMsgStyle()}>{checkinMsg}</div> : null}
          </div>

          {msg ? <div style={msgStyle()}>{msg}</div> : null}
          {selectedIds.length ? (
            <div style={selectedCountStyle()}>
              {selectedIds.length} student{selectedIds.length === 1 ? "" : "s"} selected
            </div>
          ) : null}
          <div style={debugStyle()}>
            Debug • lock_instance_id: {activeInstanceId || "—"} • roster: {sortedRoster.length} • loading:{" "}
            {loading ? "yes" : "no"}
          </div>

          {loading && !sortedRoster.length ? <div style={msgStyle()}>Loading roster...</div> : null}

          <style>{`
            @keyframes chipPulse {
              0% { transform: scale(1); box-shadow: 0 0 0 rgba(34,197,94,0.6); }
              50% { transform: scale(1.08); box-shadow: 0 0 18px rgba(34,197,94,0.6); }
              100% { transform: scale(1); box-shadow: 0 0 0 rgba(34,197,94,0); }
            }
          `}</style>
          <div style={stickyBar()}>
            <div style={{ fontWeight: 900, textAlign: "center" }}>Quick Points</div>
            <div style={quickRow()}>
              {[1, 2, 5, 10, -1, -2, -5, -10].map((p) => (
                <button key={p} style={quickBtn(p, quickBusy)} onClick={() => applyQuickPoints(p)} disabled={quickBusy}>
                  {p > 0 ? `+${p}` : `${p}`}
                </button>
              ))}
            </div>
          </div>

          <div style={grid()}>
            {sortedRoster.length ? (
              sortedRoster.map((row) => (
                <div
                  key={row.checkin_id}
                  style={card(
                    selectedIds.includes(row.student.id),
                    flash[row.student.id],
                    spotlightSelectedIds.includes(row.student.id),
                    spotlightSelectMode
                  )}
                  onClick={() => {
                    if (spotlightSelectMode) {
                      const studentId = String(row.student.id ?? "").trim();
                      setSpotlightSelectedIds((prev) => {
                        const set = new Set(normalizeIds(prev));
                        if (set.has(studentId)) {
                          set.delete(studentId);
                          return Array.from(set);
                        }
                        const desiredTotal = spotlightAwardsOtherCount + set.size + 1;
                        if (desiredTotal > spotlightLimit) {
                          setMsg(`Spotlight limit reached (${spotlightLimit}). Remove someone first.`);
                          return Array.from(set);
                        }
                        set.add(studentId);
                        return Array.from(set);
                      });
                      return;
                    }
                    setSelectedIds((prev) =>
                      prev.includes(row.student.id)
                        ? prev.filter((id) => id !== row.student.id)
                        : [...prev, row.student.id]
                    );
                  }}
                >
                  {deltaFlash[row.student.id] ? (
                    <div style={deltaBadge()}>{deltaFlash[row.student.id].text}</div>
                  ) : null}
                  <div style={avatarWrap()}>
                    {row.student.avatar_storage_path ? (
                      <img
                        src={resolveAvatarUrl(row.student.avatar_storage_path)}
                        alt={row.student.name}
                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                      />
                    ) : (
                      <span style={{ fontSize: 18 }}>👤</span>
                    )}
                  </div>
                  <div style={name()}>{row.student.name}</div>
                  <div style={meta()}>
                    <span>Lvl {row.student.level ?? "—"}</span>
                    <span>{formatPoints(row.student.points_total)} pts</span>
                    <span>{Number(row.badgeCount ?? row.student.badgeCount ?? 0)} badges</span>
                    <span>Spotlight {spotlightCounts[row.student.id]?.count ?? 0}</span>
                  </div>
                  {spotlightAwards.some((a) => String(a.student_id) === String(row.student.id)) ? (
                    <div style={starWrap()}>
                      <div style={starBadge()}>
                        ★
                        <span style={starPoints()}>
                          +{sumSpotlightPoints(spotlightAwards, row.student.id)}
                        </span>
                      </div>
                      <div style={starNote()}>
                        {spotlightLabelForStudent(spotlightAwards, row.student.id, spotlightTypeNameById)}
                      </div>
                      {spotlightSelectMode && spotlightAwardedIdsForType.includes(row.student.id) ? (
                        <button
                          style={starRemove()}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSpotlight(row.student.id);
                          }}
                          aria-label="Remove spotlight"
                          title="Remove spotlight"
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  <div style={chipRow()}>
                    <div style={chip("red", pointsByStudent[row.student.id]?.red ?? 0)}>
                      -{pointsByStudent[row.student.id]?.red ?? 0}
                    </div>
                    <div
                      style={{
                        ...chip("green", pointsByStudent[row.student.id]?.green ?? 0),
                        animation:
                          shouldFlashGreen(pointsByStudent, row.student.id) ? "chipPulse 0.9s ease-in-out infinite" : "none",
                      }}
                    >
                      +{pointsByStudent[row.student.id]?.green ?? 0}
                    </div>
                  </div>
                  <div style={actions()}>
                    <button
                      style={redBtn()}
                      onClick={(e) => {
                        e.stopPropagation();
                        applyRule(row.student.id, "rule_breaker");
                      }}
                    >
                      Rule Breaker
                    </button>
                    <button
                      style={greenBtn()}
                      onClick={(e) => {
                        e.stopPropagation();
                        applyRule(row.student.id, "rule_keeper");
                      }}
                    >
                      Rule Keeper
                    </button>
                    <button
                      style={neutralBtn()}
                      onClick={(e) => {
                        e.stopPropagation();
                        uncheckStudent(row.checkin_id, row.student.id, row.student.name);
                      }}
                    >
                      Uncheck
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div style={empty()}>No students yet.</div>
            )}
          </div>
        </main>
      )}
    </AuthGate>
  );
}

function page(): React.CSSProperties {
  return {
    minHeight: "100vh",
    padding: 18,
    color: "white",
    background: "radial-gradient(circle at top, rgba(59,130,246,0.18), rgba(2,6,23,0.95))",
  };
}

function header(): React.CSSProperties {
  return { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" };
}

function title(): React.CSSProperties {
  return { fontSize: 22, fontWeight: 1000 };
}

function subtitle(): React.CSSProperties {
  return { fontSize: 12, opacity: 0.7 };
}

function msgStyle(): React.CSSProperties {
  return { fontSize: 12, opacity: 0.8, marginTop: 6 };
}

function selectedCountStyle(): React.CSSProperties {
  return {
    fontSize: 22,
    fontWeight: 1000,
    marginTop: 8,
    color: "#fbbf24",
    textAlign: "center",
  };
}

function debugStyle(): React.CSSProperties {
  return { fontSize: 11, opacity: 0.55, marginTop: 6 };
}

function headerButtons(): React.CSSProperties {
  return { display: "flex", gap: 8, alignItems: "center" };
}

function countdownBadge(): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: "10px 12px",
    border: "1px solid rgba(56,189,248,0.45)",
    background: "rgba(14,165,233,0.16)",
    display: "grid",
    gap: 4,
    textAlign: "center",
    minWidth: 160,
    boxShadow: "0 12px 28px rgba(56,189,248,0.2)",
  };
}

function chipBtn(): React.CSSProperties {
  return {
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "linear-gradient(180deg, rgba(148,163,184,0.25), rgba(71,85,105,0.2))",
    color: "white",
    fontWeight: 900,
    fontSize: 11,
    padding: "6px 10px",
    boxShadow: "0 6px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2)",
    cursor: "pointer",
  };
}

function chipSelect(): React.CSSProperties {
  return {
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(2,6,23,0.6)",
    color: "white",
    fontWeight: 900,
    fontSize: 11,
    padding: "6px 10px",
    boxShadow: "0 6px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2)",
    cursor: "pointer",
  };
}

function spotlightBadge(): React.CSSProperties {
  return {
    borderRadius: 10,
    border: "1px solid rgba(250,204,21,0.6)",
    background: "rgba(250,204,21,0.15)",
    color: "white",
    padding: "6px 10px",
    display: "grid",
    gap: 2,
    boxShadow: "0 0 16px rgba(250,204,21,0.25)",
    minWidth: 120,
    textAlign: "center",
  };
}

function checkinRow(): React.CSSProperties {
  return {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  };
}

function checkinInput(): React.CSSProperties {
  return {
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(2,6,23,0.7)",
    color: "white",
    padding: "8px 12px",
    minWidth: 220,
    fontWeight: 700,
  };
}

function checkinMsgStyle(): React.CSSProperties {
  return { fontSize: 12, opacity: 0.8 };
}

function checkinMatchStyle(): React.CSSProperties {
  return { fontSize: 12, opacity: 0.8 };
}

function stickyBar(): React.CSSProperties {
  return {
    position: "sticky",
    top: 0,
    zIndex: 2,
    backdropFilter: "blur(6px)",
    background: "rgba(2,6,23,0.85)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: "10px 12px",
    display: "grid",
    gap: 6,
  };
}

function quickRow(): React.CSSProperties {
  return { display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" };
}

function quickBtn(points: number, disabled?: boolean): React.CSSProperties {
  return {
    borderRadius: 12,
    border: `1px solid ${points >= 0 ? "rgba(34,197,94,0.75)" : "rgba(248,113,113,0.75)"}`,
    background:
      points >= 0
        ? "linear-gradient(180deg, rgba(34,197,94,0.45), rgba(16,185,129,0.2))"
        : "linear-gradient(180deg, rgba(248,113,113,0.45), rgba(239,68,68,0.2))",
    color: "white",
    fontWeight: 900,
    fontSize: 13,
    padding: "8px 12px",
    boxShadow: "0 6px 14px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.25)",
    opacity: disabled ? 0.6 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

function grid(): React.CSSProperties {
  return {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: 10,
  };
}

function card(
  selected: boolean,
  flashState?: "red" | "green" | "",
  spotlightSelected = false,
  spotlightMode = false
): React.CSSProperties {
  const flashColor =
    flashState === "red"
      ? "rgba(248,113,113,0.55)"
      : flashState === "green"
      ? "rgba(34,197,94,0.55)"
      : null;
  const spotlightBorder = spotlightSelected ? "2px solid rgba(250,204,21,0.9)" : null;
  const modeBorder = spotlightMode ? "1px solid rgba(250,204,21,0.55)" : null;
  return {
    borderRadius: 14,
    border:
      spotlightBorder ||
      (selected ? "2px solid rgba(59,130,246,0.8)" : modeBorder || "1px solid rgba(255,255,255,0.14)"),
    background: flashColor
      ? flashColor
      : spotlightMode
      ? "linear-gradient(180deg, rgba(30,41,59,0.9), rgba(2,6,23,0.85))"
      : "linear-gradient(180deg, rgba(15,23,42,0.7), rgba(2,6,23,0.7))",
    padding: 10,
    display: "grid",
    gap: 6,
    textAlign: "left",
    position: "relative",
    overflow: "hidden",
    cursor: "pointer",
    transition: "transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease, background 120ms ease",
    transform: spotlightMode ? "translateY(-1px)" : "none",
    boxShadow: spotlightSelected
      ? "0 0 18px rgba(250,204,21,0.35), 0 10px 24px rgba(0,0,0,0.35)"
      : spotlightMode
      ? "0 8px 20px rgba(250,204,21,0.22), inset 0 1px 0 rgba(255,255,255,0.08)"
      : "0 10px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)",
  };
}

function deltaBadge(): React.CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
    fontSize: 36,
    fontWeight: 1000,
    color: "white",
    textShadow: "0 6px 16px rgba(0,0,0,0.6)",
    pointerEvents: "none",
  };
}

function avatarWrap(): React.CSSProperties {
  return {
    width: 52,
    height: 52,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    margin: "0 auto",
  };
}

function name(): React.CSSProperties {
  return { fontSize: 14, fontWeight: 900, textAlign: "center" };
}

function meta(): React.CSSProperties {
  return {
    display: "flex",
    gap: 8,
    fontSize: 11,
    opacity: 0.75,
    fontWeight: 800,
    flexWrap: "wrap",
    justifyContent: "center",
  };
}

function chipRow(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 2 };
}

function chip(kind: "red" | "green", value: number): React.CSSProperties {
  const isGreen = kind === "green";
  const isHigh = isGreen && value >= 40;
  return {
    borderRadius: 999,
    border: `1px solid ${
      isGreen ? (isHigh ? "rgba(148,163,184,0.9)" : "rgba(45,212,191,0.75)") : "rgba(244,63,94,0.7)"
    }`,
    background: isGreen
      ? isHigh
        ? "linear-gradient(180deg, rgba(148,163,184,0.85), rgba(100,116,139,0.4))"
        : "linear-gradient(180deg, rgba(45,212,191,0.55), rgba(16,185,129,0.22))"
      : "linear-gradient(180deg, rgba(244,63,94,0.55), rgba(225,29,72,0.25))",
    color: "white",
    fontWeight: 900,
    fontSize: 11,
    padding: "4px 8px",
    textAlign: "center",
    boxShadow: "0 6px 12px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.2)",
  };
}

function shouldFlashGreen(pointsByStudent: Record<string, { green: number; red: number }>, studentId: string) {
  const current = Number(pointsByStudent[studentId]?.green ?? 0);
  const unique = Array.from(
    new Set(
      Object.values(pointsByStudent)
        .map((v) => Number(v.green ?? 0))
        .filter((v) => Number.isFinite(v))
    )
  ).sort((a, b) => a - b);
  if (!unique.length) return false;
  const idx = unique.findIndex((v) => v === current);
  if (idx !== 0) return false;
  const nextHigher = unique[1];
  if (nextHigher === undefined) return false;
  return nextHigher - current >= 10;
}

function actions(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 4 };
}

function redBtn(): React.CSSProperties {
  return {
    borderRadius: 12,
    border: "1px solid rgba(248,113,113,0.75)",
    background: "linear-gradient(180deg, rgba(248,113,113,0.45), rgba(239,68,68,0.2))",
    color: "white",
    fontWeight: 900,
    fontSize: 11,
    padding: "7px 8px",
    boxShadow: "0 6px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
  };
}

function greenBtn(): React.CSSProperties {
  return {
    borderRadius: 12,
    border: "1px solid rgba(34,197,94,0.75)",
    background: "linear-gradient(180deg, rgba(34,197,94,0.45), rgba(16,185,129,0.2))",
    color: "white",
    fontWeight: 900,
    fontSize: 11,
    padding: "7px 8px",
    boxShadow: "0 6px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
  };
}

function neutralBtn(): React.CSSProperties {
  return {
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.55)",
    background: "linear-gradient(180deg, rgba(148,163,184,0.35), rgba(71,85,105,0.2))",
    color: "white",
    fontWeight: 900,
    fontSize: 11,
    padding: "7px 8px",
    boxShadow: "0 6px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
  };
}

function starWrap(): React.CSSProperties {
  return { position: "relative", display: "grid", justifyContent: "center", marginTop: 2 };
}

function starBadge(): React.CSSProperties {
  return {
    position: "relative",
    width: 46,
    height: 46,
    borderRadius: 14,
    background: "linear-gradient(180deg, rgba(253,224,71,0.9), rgba(245,158,11,0.55))",
    display: "grid",
    placeItems: "center",
    fontSize: 22,
    fontWeight: 900,
    color: "#0b0f1a",
    boxShadow: "0 10px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.35)",
  };
}

function starPoints(): React.CSSProperties {
  return {
    position: "absolute",
    bottom: -6,
    right: -6,
    fontSize: 11,
    fontWeight: 900,
    color: "white",
    background: "rgba(15,23,42,0.85)",
    borderRadius: 999,
    padding: "2px 6px",
    border: "1px solid rgba(255,255,255,0.2)",
  };
}

function starNote(): React.CSSProperties {
  return {
    marginTop: 6,
    fontSize: 11,
    fontWeight: 800,
    opacity: 0.75,
    textAlign: "center",
    maxWidth: 140,
  };
}

function starRemove(): React.CSSProperties {
  return {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 999,
    border: "1px solid rgba(248,113,113,0.75)",
    background: "rgba(239,68,68,0.85)",
    color: "white",
    fontWeight: 900,
    fontSize: 14,
    display: "grid",
    placeItems: "center",
    boxShadow: "0 6px 12px rgba(0,0,0,0.35)",
    cursor: "pointer",
  };
}

function empty(): React.CSSProperties {
  return { fontSize: 12, opacity: 0.7 };
}

function blockedStyle(): React.CSSProperties {
  return { padding: 20, fontSize: 18, fontWeight: 900 };
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

function formatPoints(value?: number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat().format(n);
}

function sumSpotlightPoints(
  awards: Array<{ student_id: string; award_type_id: string; points_awarded: number }>,
  studentId: string
) {
  return awards
    .filter((a) => String(a.student_id) === String(studentId))
    .reduce((sum, a) => sum + Number(a.points_awarded ?? 0), 0);
}

function spotlightLabelForStudent(
  awards: Array<{ student_id: string; award_type_id: string; points_awarded: number }>,
  studentId: string,
  names: Map<string, string>
) {
  const types = Array.from(
    new Set(
      awards
        .filter((a) => String(a.student_id) === String(studentId))
        .map((a) => String(a.award_type_id))
    )
  )
    .map((id) => names.get(id) || "Spotlight")
    .join(", ");
  return types ? `For: ${types}` : "Spotlight";
}

function toDateTime(date: string, time: string) {
  const clean = String(time ?? "").trim();
  if (!clean) return null;
  const parts = clean.split(":");
  const hh = parts[0] ?? "00";
  const mm = parts[1] ?? "00";
  const ss = parts[2] ?? "00";
  return new Date(`${date}T${hh.padStart(2, "0")}:${mm.padStart(2, "0")}:${ss.padStart(2, "0")}`);
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import AvatarRender from "@/components/AvatarRender";
import { supabaseClient } from "@/lib/supabase/client";

type DisplayState = {
  tool_key: "default" | "lesson_forge" | "timers" | "warmup" | "classroom_roster" | "taolu_tracker";
  tool_payload?: any | null;
};

type SessionRow = {
  instance_id: string;
  class_id: string;
  class_name: string;
  start_time: string;
  end_time?: string | null;
};

type RosterRow = {
  checkin_id: string;
  checked_in_at?: string | null;
  student: {
    id: string;
    name: string;
    level?: number | null;
    points_total?: number | null;
    is_competition_team?: boolean | null;
    avatar_storage_path?: string | null;
    avatar_bg?: string | null;
    avatar_effect?: string | null;
    avatar_zoom_pct?: number | null;
    corner_border_url?: string | null;
    corner_border_render_mode?: string | null;
    corner_border_html?: string | null;
    corner_border_css?: string | null;
    corner_border_js?: string | null;
    corner_border_offset_x?: number | null;
    corner_border_offset_y?: number | null;
    corner_border_offsets_by_context?: Record<string, { x?: number | null; y?: number | null; scale?: number | null }> | null;
  };
};

type ActivityItem = {
  id: string;
  student_id: string;
  student_name: string;
  title: string;
  detail: string;
  time: string;
  tone: "win" | "loss" | "badge" | "rank" | "skill" | "skilltree" | "redeem" | "unlock" | "roulette";
  event_type?: string;
};

type ScreenPreset = "compact" | "standard" | "wide";

export default function CoachDisplayPage() {
  const params = useSearchParams();
  const [blocked, setBlocked] = useState(false);
  const [role, setRole] = useState<string>("");
  const [coachUserId, setCoachUserId] = useState<string>("");
  const [displaySlots, setDisplaySlots] = useState<
    Array<{ slot_key: string; label: string; coach_user_id?: string | null; coach_name?: string | null; coach_email?: string | null }>
  >([]);
  const [selectedSlotKey, setSelectedSlotKey] = useState<string>("");
  const [state, setState] = useState<DisplayState>({ tool_key: "default" });
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [now, setNow] = useState<Date>(new Date());
  const [activePlan, setActivePlan] = useState<{ id: string; name: string } | null>(null);
  const [activeSections, setActiveSections] = useState<
    Array<{ id: string; label: string; duration_minutes: number; color: string; sort_order: number }>
  >([]);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [coachActivityTypes, setCoachActivityTypes] = useState<string[]>([]);
  const [lessonTimerDuration, setLessonTimerDuration] = useState(0);
  const [lessonTimerRemaining, setLessonTimerRemaining] = useState(0);
  const [lessonTimerRunning, setLessonTimerRunning] = useState(false);
  const [msg, setMsg] = useState("");
  const [screenPreset, setScreenPreset] = useState<ScreenPreset>("compact");
  const channelRef = useRef<any>(null);
  const [effectConfigByKey, setEffectConfigByKey] = useState<
    Record<string, { config?: any; render_mode?: string | null; html?: string | null; css?: string | null; js?: string | null }>
  >({});
  const cornerOffsets = useMemo(() => ({ x: -10, y: -10, size: 72 }), []);
  const sizing = useMemo(() => getSizing(screenPreset), [screenPreset]);

  const lockedInstanceId = String(state.tool_payload?.lock_instance_id ?? "").trim();
  const lockedClassId = String(state.tool_payload?.lock_class_id ?? "").trim();
  const rosterRefreshAt = Number(state.tool_payload?.refresh_at ?? 0) || 0;

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        const nextRole = String(data?.role ?? "");
        if (!data?.ok || (nextRole !== "admin" && nextRole !== "coach" && nextRole !== "display")) {
          setBlocked(true);
          return;
        }
        setRole(nextRole);
        const requestedSlot = String(params.get("slot") ?? "").trim();
        const slotsRes = await fetch("/api/coach-display-slots", { cache: "no-store" });
        const slotsJson = await slotsRes.json().catch(() => ({}));
        if (slotsRes.ok && slotsJson?.ok) {
          const slots = (slotsJson.slots ?? []) as Array<{
            slot_key: string;
            label: string;
            coach_user_id?: string | null;
            coach_name?: string | null;
            coach_email?: string | null;
          }>;
          setDisplaySlots(slots);
          const assigned = slots.find((s) => s.coach_user_id && String(s.coach_user_id) === String(data?.user?.id ?? ""));
          const savedSlot = (() => {
            try {
              return localStorage.getItem("coach_display_slot") || "";
            } catch {
              return "";
            }
          })();
          const preferred = requestedSlot || savedSlot || assigned?.slot_key || slots[0]?.slot_key || "";
          setSelectedSlotKey(preferred);
          if (preferred) {
            try {
              localStorage.setItem("coach_display_slot", preferred);
            } catch {}
          }
          const slotCoach = slots.find((s) => s.slot_key === preferred)?.coach_user_id;
          if (slotCoach) setCoachUserId(String(slotCoach));
          return;
        }
        setCoachUserId(String(data?.user?.id ?? ""));
      } catch {
        setBlocked(true);
      }
    })();
  }, [params]);

  useEffect(() => {
    if (!selectedSlotKey || !displaySlots.length) return;
    const slot = displaySlots.find((s) => s.slot_key === selectedSlotKey);
    if (!slot?.coach_user_id) {
      setMsg("Selected display has no coach assigned.");
      return;
    }
    setCoachUserId(String(slot.coach_user_id));
    try {
      localStorage.setItem("coach_display_slot", selectedSlotKey);
    } catch {}
  }, [selectedSlotKey, displaySlots]);

  useEffect(() => {
    try {
      const saved = String(localStorage.getItem("coach_display_screen_preset") || "").trim();
      if (saved === "compact" || saved === "standard" || saved === "wide") {
        setScreenPreset(saved);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("coach_display_screen_preset", screenPreset);
    } catch {}
  }, [screenPreset]);

  useEffect(() => {
    if (!coachUserId) return;
    const loadState = async () => {
      const qs = role === "admin" && coachUserId ? `?coach_user_id=${encodeURIComponent(coachUserId)}` : "";
      const res = await fetch(`/api/coach/display-state${qs}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!data?.ok) {
        setMsg(data?.error || "Failed to load display state");
        return;
      }
      setState({
        tool_key: data?.state?.tool_key ?? "default",
        tool_payload: data?.state?.tool_payload ?? null,
      });
    };
    loadState();

    const supabase = supabaseClient();
    const setupChannel = async () => {
      const session = await supabase.auth.getSession();
      if (session.data?.session?.access_token) {
        supabase.realtime.setAuth(session.data.session.access_token);
      }
      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current);
      }
      channelRef.current = supabase
        .channel("coach-display-state")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "coach_display_state" },
          (payload) => {
            const nextId = String((payload as any)?.new?.coach_user_id ?? "");
            if (nextId && nextId === coachUserId) loadState();
          }
        )
        .subscribe();
    };
    setupChannel();
    const poll = window.setInterval(loadState, 15000);
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);
      setupChannel();
      loadState();
    });
    return () => {
      if (authListener?.subscription) authListener.subscription.unsubscribe();
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      window.clearInterval(poll);
    };
  }, [coachUserId, role]);

  useEffect(() => {
    if (blocked) return;
    const loadSchedule = async () => {
      const res = await fetch("/api/class-sessions/today?include_ended=1", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!data?.ok) return;
      setSessions((data.sessions ?? []) as SessionRow[]);
    };
    loadSchedule();
    const timer = window.setInterval(loadSchedule, 60 * 1000);
    return () => window.clearInterval(timer);
  }, [blocked]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await fetch("/api/avatar-effects/list", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!active || !data?.ok) return;
      const list = (data.effects ?? []) as Array<{
        key: string;
        config?: any;
        render_mode?: string | null;
        html?: string | null;
        css?: string | null;
        js?: string | null;
      }>;
      const map: Record<string, { config?: any; render_mode?: string | null; html?: string | null; css?: string | null; js?: string | null }> = {};
      list.forEach((e) => {
        if (e?.key) map[String(e.key)] = { config: e.config, render_mode: e.render_mode ?? null, html: e.html ?? null, css: e.css ?? null, js: e.js ?? null };
      });
      setEffectConfigByKey(map);
    })();
    return () => {
      active = false;
    };
  }, []);

  const nextSession = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = sessions
      .map((s) => ({ ...s, startAt: toDateTime(today, s.start_time) }))
      .filter((s) => s.startAt && s.startAt.getTime() > now.getTime())
      .sort((a, b) => (a.startAt?.getTime() ?? 0) - (b.startAt?.getTime() ?? 0));
    return upcoming[0] ?? null;
  }, [sessions, now]);

  const activeSession = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const withTimes = sessions.map((s) => {
      const startAt = toDateTime(today, s.start_time);
      const endAt = s.end_time ? toDateTime(today, s.end_time) : null;
      return { ...s, startAt, endAt };
    });
    if (lockedInstanceId) {
      const locked = withTimes.find((s) => String(s.instance_id) === lockedInstanceId);
      if (locked) return locked;
    }
    if (!lockedInstanceId && lockedClassId) {
      const byClass = withTimes.find((s) => String(s.class_id) === lockedClassId);
      if (byClass) return byClass;
    }
    const active = withTimes
      .filter((s) => s.startAt && now.getTime() >= s.startAt.getTime())
      .filter((s) => (s.endAt ? now.getTime() <= s.endAt.getTime() : true))
      .sort((a, b) => (a.startAt?.getTime() ?? 0) - (b.startAt?.getTime() ?? 0));
    return active[0] ?? null;
  }, [sessions, now, lockedInstanceId, lockedClassId]);

  const countdown = useMemo(() => {
    if (!nextSession?.startAt) return "";
    const diffMs = Math.max(0, nextSession.startAt.getTime() - now.getTime());
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours ? `${hours}h ` : ""}${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  }, [nextSession, now]);

  const displayUrl =
    state.tool_payload?.display_url ||
    (state.tool_key === "lesson_forge"
      ? "/tools/lesson-forge?display=1"
      : state.tool_key === "timers"
      ? "/tools/timers?display=1"
      : "");

  useEffect(() => {
    if (state.tool_key !== "lesson_forge") {
      setLessonTimerDuration(0);
      setLessonTimerRemaining(0);
      setLessonTimerRunning(false);
      return;
    }
    const nextSeconds = Math.max(0, Number(state.tool_payload?.timer_seconds ?? 0) || 0);
    setLessonTimerDuration(nextSeconds);
    setLessonTimerRemaining(nextSeconds);
    setLessonTimerRunning(false);
  }, [state.tool_key, state.tool_payload?.timer_seconds]);

  useEffect(() => {
    if (!lessonTimerRunning) return;
    if (lessonTimerRemaining <= 0) return;
    const timer = window.setInterval(() => {
      setLessonTimerRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lessonTimerRunning, lessonTimerRemaining]);

  useEffect(() => {
    if (state.tool_key !== "lesson_forge") return;
    if (!lessonTimerDuration) return;
    function onKey(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || (event.target as HTMLElement)?.isContentEditable) {
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        setLessonTimerRunning((prev) => !prev);
        return;
      }
      if (event.code === "KeyR") {
        event.preventDefault();
        setLessonTimerRunning(false);
        setLessonTimerRemaining(lessonTimerDuration);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.tool_key, lessonTimerDuration]);

  useEffect(() => {
    if (!activeSession?.class_id) {
      setActivePlan(null);
      setActiveSections([]);
      return;
    }
    (async () => {
      const res = await fetch(`/api/class-time-plans/for-class?class_id=${encodeURIComponent(activeSession.class_id)}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) return;
      setActivePlan(data.plan ?? null);
      setActiveSections((data.sections ?? []) as any[]);
    })();
  }, [activeSession?.class_id]);

  useEffect(() => {
    if (blocked) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/display/settings", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        const types = Array.isArray(data?.settings?.coach_display_activity_types)
          ? data.settings.coach_display_activity_types
          : [];
        setCoachActivityTypes(types);
      } catch {}
    })();
    return () => {
      active = false;
    };
  }, [blocked]);

  useEffect(() => {
    const instanceId = lockedInstanceId || activeSession?.instance_id || "";
    if (!instanceId) {
      setRoster([]);
      return;
    }
    let active = true;
    const loadRoster = async () => {
      try {
        const res = await fetch("/api/classroom/roster", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instance_id: instanceId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) return;
        setRoster((data?.roster ?? []) as RosterRow[]);
      } catch {}
    };
    loadRoster();
    const timer = window.setInterval(loadRoster, 20000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [activeSession?.instance_id, lockedInstanceId, rosterRefreshAt]);

  useEffect(() => {
    if (blocked) return;
    let active = true;
    const loadActivity = async () => {
      try {
        const rosterIds = new Set(roster.map((r) => String(r.student.id)));
        if (!rosterIds.size) {
          if (active) setActivity([]);
          return;
        }
        const typesParam = coachActivityTypes.length
          ? `&types=${encodeURIComponent(coachActivityTypes.join(","))}`
          : "";
        const res = await fetch(`/api/display/live-activity?limit=80&include_all=1${typesParam}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!active || !res.ok) return;
        const items = (data?.items ?? []) as ActivityItem[];
        const filtered = items.filter((item) => rosterIds.has(String(item.student_id)));
        setActivity(filtered.slice(0, 8));
      } catch {}
    };
    loadActivity();
    const timer = window.setInterval(loadActivity, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [blocked, roster, coachActivityTypes]);

  const timeline = useMemo(() => {
    if (!activeSession?.startAt || !activeSections.length) return null;
    const startAt = activeSession.startAt;
    const endAt = activeSession.endAt;
    const totalPlanMinutes = activeSections.reduce((acc, s) => acc + Math.max(1, Number(s.duration_minutes || 0)), 0);
    const actualTotalMinutes = endAt
      ? Math.max(1, Math.round((endAt.getTime() - startAt.getTime()) / 60000))
      : totalPlanMinutes;
    const scale = totalPlanMinutes > 0 ? actualTotalMinutes / totalPlanMinutes : 1;
    const segments = activeSections.map((s) => ({
      ...s,
      actual_minutes: Math.max(1, Math.round(Number(s.duration_minutes || 1) * scale)),
    }));
    const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - startAt.getTime()) / 60000));
    let cursor = 0;
    const enriched = segments.map((s) => {
      const start = cursor;
      const end = cursor + s.actual_minutes;
      cursor = end;
      const progress = elapsedMinutes <= start ? 0 : elapsedMinutes >= end ? 1 : (elapsedMinutes - start) / (end - start);
      return { ...s, start, end, progress };
    });
    const active = enriched.find((s) => s.progress > 0 && s.progress < 1) ?? null;
    const remaining = active ? Math.max(0, Math.round((active.end - elapsedMinutes) * 60)) : 0;
    return { segments: enriched, elapsedMinutes, totalMinutes: actualTotalMinutes, active, remaining };
  }, [activeSession, activeSections, now]);

  return (
    <AuthGate>
      {blocked ? (
        <div style={blockedStyle()}>Coach display is coach-only.</div>
      ) : (
        <main style={page()}>
          <style>{`
            @keyframes mvpPulse {
              0% { box-shadow: 0 0 18px rgba(250,204,21,0.35), inset 0 0 10px rgba(255,255,255,0.06); }
              50% { box-shadow: 0 0 34px rgba(250,204,21,0.7), inset 0 0 16px rgba(255,255,255,0.12); }
              100% { box-shadow: 0 0 18px rgba(250,204,21,0.35), inset 0 0 10px rgba(255,255,255,0.06); }
            }
          `}</style>
          <div style={statusBar()}>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontWeight: 900, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6, opacity: 0.7 }}>
                Class Timeline
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
                <div style={{ fontSize: 16, fontWeight: 900 }}>
                  {activeSession?.class_name || "No active class"}
                </div>
                {activePlan?.name ? (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>• {activePlan.name}</div>
                ) : null}
                {timeline?.active ? (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    • Now: {timeline.active.label} ({formatSeconds(timeline.remaining)})
                  </div>
                ) : null}
              </div>
            </div>
            {timeline ? (
              <div style={timelineBar()}>
                {timeline.segments.map((seg) => (
                  <div key={seg.id} style={timelineSegment(seg.color, seg.actual_minutes, seg.progress)}>
                    <div style={timelineSegmentLabel()}>
                      {seg.label} • {seg.actual_minutes}m
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, opacity: 0.6 }}>No timeline plan assigned.</div>
            )}
          </div>
          <div style={displaySelector()}>
            <label style={selectorLabel()}>Display</label>
            <select
              value={selectedSlotKey}
              onChange={(e) => setSelectedSlotKey(e.target.value)}
              style={selectorInput()}
            >
              {displaySlots.length ? (
                displaySlots.map((slot) => (
                  <option key={slot.slot_key} value={slot.slot_key}>
                    {displayLabel(slot)}
                  </option>
                ))
              ) : (
                <option value="">No displays</option>
              )}
            </select>
            <div style={selectorMeta()}>
              {(() => {
                const slot = displaySlots.find((s) => s.slot_key === selectedSlotKey);
                return slot?.coach_name || slot?.coach_email || "Unassigned";
              })()}
            </div>
          </div>
          <div style={displaySizeSelector()}>
            <div style={{ fontSize: 10, opacity: 0.68, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Screen Size
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {(["compact", "standard", "wide"] as ScreenPreset[]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setScreenPreset(preset)}
                  style={sizeChip(screenPreset === preset)}
                >
                  {preset === "compact" ? "Compact" : preset === "standard" ? "Standard" : "Wide"}
                </button>
              ))}
            </div>
          </div>
          {msg ? <div style={msgStyle()}>{msg}</div> : null}
          {state.tool_key === "lesson_forge" && (state.tool_payload?.section_title || lessonTimerDuration > 0) ? (
            <div style={lessonOverlay()}>
              {state.tool_payload?.section_title ? (
                <div style={lessonTitle()}>{String(state.tool_payload.section_title)}</div>
              ) : null}
              {lessonTimerDuration > 0 ? (
                <div style={lessonTimerCard()}>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Section Timer</div>
                  <div style={{ fontSize: 48, fontWeight: 1000 }}>{formatSeconds(lessonTimerRemaining)}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Space = start/pause • R = reset</div>
                </div>
              ) : null}
            </div>
          ) : null}
          <div style={layoutGrid(sizing)}>
            <section style={rosterPanel()}>
              <div style={panelHeader()}>
                <div style={{ fontSize: 12, opacity: 0.65, fontWeight: 800, letterSpacing: 0.6 }}>Checked-In Roster</div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{roster.length}</div>
              </div>
              <div style={rosterList()}>
                {roster.length ? (
                  roster.map((row) => (
                    <div key={row.checkin_id} style={rosterRow(sizing)}>
                      <div style={rosterAvatarShell(sizing)}>
                        <AvatarRender
                          size={sizing.avatarSize}
                          bg={avatarBackground(row.student.avatar_bg ?? null)}
                          border={buildBorderFromStudent(row.student)}
                          effect={buildEffectFromKey(row.student.avatar_effect, effectConfigByKey)}
                          avatarSrc={resolveAvatarUrl(row.student.avatar_storage_path) ?? undefined}
                          cornerOffsets={cornerOffsets}
                          bleed={18}
                          contextKey="roster"
                          style={rosterAvatarFrame()}
                          fallback={<div style={rosterAvatarInitials()}>{initialsFor(row.student.name)}</div>}
                        />
                      </div>
                      <div style={rosterMeta()}>
                        <div style={{ fontWeight: 900, fontSize: sizing.nameFont }}>{row.student.name || "Student"}</div>
                        <div style={{ opacity: 0.75, fontSize: sizing.metaFont }}>
                          Lv {row.student.level ?? 1} • {Number(row.student.points_total ?? 0).toLocaleString()} pts
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ opacity: 0.6, fontSize: 12 }}>No students checked in yet.</div>
                )}
              </div>
            </section>
            <section style={rightPanel()}>
              <div style={activityPanel()}>
                <div style={panelHeader()}>
                  <div style={{ fontSize: 12, opacity: 0.65, fontWeight: 800, letterSpacing: 0.6 }}>
                    Notable Activity
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.6 }}>{activeSession?.class_name || "Class"}</div>
                </div>
                <div style={activityGrid()}>
                  {activity.length ? (
                    activity.map((item) => {
                      const eventType = String(item.event_type ?? "");
                      const isWin = eventType === "battle_pulse_win";
                      const isLoss = eventType === "battle_pulse_loss";
                      const isMvp = eventType === "battle_pulse_mvp" || item.detail.toLowerCase().includes("mvp");
                      return (
                        <div key={item.id} style={activityCard(isMvp)}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                            <div style={{ fontWeight: 900 }}>{item.student_name || "Student"}</div>
                            {isMvp ? <span style={mvpChip()}>MVP</span> : null}
                          </div>
                          <div style={{ fontSize: 12, opacity: 0.75 }}>{item.title}</div>
                          <div style={{ fontSize: 11, opacity: 0.6 }}>{item.detail}</div>
                          {isWin ? <div style={resultChip("win")}>Winning Team</div> : null}
                          {isLoss ? <div style={resultChip("loss")}>Losing Team</div> : null}
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ opacity: 0.6, fontSize: 12 }}>No notable activity yet.</div>
                  )}
                </div>
              </div>
              <div style={displayPanel()}>
                {state.tool_key === "default" ? (
                  <div style={defaultPane()}>
                    {nextSession ? (
                      <>
                        <div style={defaultLabel()}>Next class starts in</div>
                        <div style={countdownStyle()}>{countdown}</div>
                        <div style={classNameStyle()}>{nextSession.class_name || "Class"}</div>
                        <div style={classTimeStyle()}>
                          Starts at {formatTime(nextSession.start_time)}
                        </div>
                      </>
                    ) : (
                      <div style={logoStyle()}>Lead Achieve Level Up</div>
                    )}
                  </div>
                ) : state.tool_key === "warmup" ? (
                  <div style={defaultPane()}>
                    <div style={countdownStyle()}>Warm Up</div>
                    <div style={classTimeStyle()}>Placeholder</div>
                  </div>
                ) : (
                  <iframe
                    key={`coach-display-${state.tool_key}`}
                    src={displayUrl || "/tools"}
                    style={displayFrame()}
                    title="Coach Display"
                  />
                )}
              </div>
            </section>
          </div>
        </main>
      )}
    </AuthGate>
  );
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

function formatTime(input: string) {
  const parts = String(input ?? "").split(":").map(Number);
  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return input;
  const h = parts[0];
  const m = parts[1];
  const suffix = h >= 12 ? "PM" : "AM";
  const hr = ((h + 11) % 12) + 1;
  return `${hr}:${String(m).padStart(2, "0")} ${suffix}`;
}

function formatSeconds(total: number) {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function page(): React.CSSProperties {
  return {
    minHeight: "100vh",
    background: "radial-gradient(circle at top, rgba(59,130,246,0.15), rgba(2,6,23,0.95))",
    color: "white",
    display: "grid",
    gap: 16,
    padding: "110px 24px 24px",
    position: "relative",
  };
}

function defaultPane(): React.CSSProperties {
  return {
    display: "grid",
    gap: 12,
    textAlign: "center",
    alignItems: "center",
  };
}

function defaultLabel(): React.CSSProperties {
  return { fontSize: 16, fontWeight: 800, opacity: 0.7, letterSpacing: 1 };
}

function countdownStyle(): React.CSSProperties {
  return { fontSize: 72, fontWeight: 1000, letterSpacing: 1 };
}

function classNameStyle(): React.CSSProperties {
  return { fontSize: 40, fontWeight: 900 };
}

function classTimeStyle(): React.CSSProperties {
  return { fontSize: 18, opacity: 0.75 };
}

function logoStyle(): React.CSSProperties {
  return { fontSize: 56, fontWeight: 1000, letterSpacing: 2 };
}

function displayFrame(): React.CSSProperties {
  return {
    width: "100%",
    height: "100%",
    border: "none",
    borderRadius: 18,
    background: "rgba(0,0,0,0.2)",
  };
}

function blockedStyle(): React.CSSProperties {
  return { padding: 20, fontSize: 20, fontWeight: 900 };
}

function msgStyle(): React.CSSProperties {
  return { position: "absolute", top: 88, right: 12, fontSize: 12, opacity: 0.7 };
}

function displaySelector(): React.CSSProperties {
  return {
    position: "absolute",
    top: 80,
    left: 12,
    display: "grid",
    gap: 4,
    zIndex: 2,
  };
}

function displaySizeSelector(): React.CSSProperties {
  return {
    position: "absolute",
    top: 80,
    left: 230,
    display: "grid",
    gap: 4,
    zIndex: 2,
  };
}

function sizeChip(active: boolean): React.CSSProperties {
  return {
    borderRadius: 999,
    padding: "5px 10px",
    border: active ? "1px solid rgba(56,189,248,0.85)" : "1px solid rgba(148,163,184,0.45)",
    background: active ? "rgba(12,74,110,0.75)" : "rgba(2,6,23,0.75)",
    color: "white",
    fontSize: 11,
    fontWeight: 900,
    cursor: "pointer",
  };
}

function selectorLabel(): React.CSSProperties {
  return { fontSize: 11, fontWeight: 800, opacity: 0.7 };
}

function selectorInput(): React.CSSProperties {
  return {
    borderRadius: 10,
    padding: "6px 10px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(2,6,23,0.7)",
    color: "white",
    fontWeight: 800,
    fontSize: 12,
  };
}

function selectorMeta(): React.CSSProperties {
  return { fontSize: 11, opacity: 0.7 };
}

function displayLabel(slot: { slot_key: string; label?: string | null }) {
  const key = String(slot.slot_key ?? "");
  if (key.startsWith("coach_")) {
    const num = key.replace("coach_", "");
    if (num) return `Display ${num}`;
  }
  return String(slot.label ?? slot.slot_key ?? "Display");
}

function statusBar(): React.CSSProperties {
  return {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    padding: "10px 16px",
    backdropFilter: "blur(12px)",
    background: "linear-gradient(90deg, rgba(5,5,12,0.9), rgba(10,10,25,0.85))",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    display: "grid",
    gap: 8,
  };
}

function timelineBar(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "stretch",
    gap: 6,
  };
}

function timelineSegment(color: string, minutes: number, progress: number): React.CSSProperties {
  const pct = Math.min(100, Math.max(0, Math.round(progress * 100)));
  return {
    position: "relative",
    flex: `${Math.max(1, minutes)} 1 0%`,
    height: 24,
    borderRadius: 999,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.08)",
    boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.2)",
    backgroundImage: `linear-gradient(90deg, ${color} ${pct}%, rgba(255,255,255,0.12) ${pct}%)`,
  };
}

function timelineSegmentLabel(): React.CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    color: "rgba(255,255,255,0.85)",
    textShadow: "0 1px 2px rgba(0,0,0,0.6)",
    pointerEvents: "none",
  };
}

function lessonOverlay(): React.CSSProperties {
  return {
    position: "absolute",
    inset: "90px 24px auto 24px",
    display: "grid",
    justifyItems: "center",
    gap: 12,
    pointerEvents: "none",
    zIndex: 3,
  };
}

function lessonTitle(): React.CSSProperties {
  return {
    fontSize: 48,
    fontWeight: 1000,
    textAlign: "center",
    textShadow: "0 8px 24px rgba(0,0,0,0.5)",
  };
}

function lessonTimerCard(): React.CSSProperties {
  return {
    padding: "12px 18px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.45)",
    textAlign: "center",
    display: "grid",
    gap: 6,
  };
}

function layoutGrid(sizing: ReturnType<typeof getSizing>): React.CSSProperties {
  return {
    display: "grid",
    gap: 16,
    gridTemplateColumns: sizing.layoutColumns,
    alignItems: "stretch",
    minHeight: "calc(100vh - 140px)",
  };
}

function rosterPanel(): React.CSSProperties {
  return {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(6,10,20,0.7)",
    padding: 16,
    display: "grid",
    gap: 12,
    overflow: "hidden",
  };
}

function rightPanel(): React.CSSProperties {
  return {
    display: "grid",
    gap: 16,
    gridTemplateRows: "minmax(160px, 1fr) minmax(0, 3fr)",
  };
}

function panelHeader(): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 8,
  };
}

function rosterList(): React.CSSProperties {
  return {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    overflowY: "auto",
    paddingRight: 6,
  };
}

function rosterRow(sizing: ReturnType<typeof getSizing>): React.CSSProperties {
  return {
    padding: "12px 12px",
    borderRadius: 14,
    background: "linear-gradient(135deg, rgba(15,23,42,0.9), rgba(2,6,23,0.75))",
    border: "1px solid rgba(255,255,255,0.1)",
    display: "grid",
    gridTemplateColumns: `${sizing.avatarShell}px 1fr`,
    gap: 10,
    alignItems: "center",
    boxShadow: "0 10px 22px rgba(0,0,0,0.35)",
  };
}

function rosterMeta(): React.CSSProperties {
  return {
    display: "grid",
    gap: 4,
  };
}

function rosterAvatarShell(sizing: ReturnType<typeof getSizing>): React.CSSProperties {
  return {
    width: sizing.avatarShell,
    height: sizing.avatarShell,
    borderRadius: 22,
    position: "relative",
    overflow: "visible",
    display: "grid",
    placeItems: "center",
  };
}

function rosterAvatarFrame(): React.CSSProperties {
  return {
    border: "1px solid rgba(255,255,255,0.2)",
    boxShadow:
      "inset 0 2px 10px rgba(255,255,255,0.12), inset 0 -8px 14px rgba(0,0,0,0.45), 0 12px 24px rgba(0,0,0,0.4)",
  };
}

function rosterAvatarInitials(): React.CSSProperties {
  return { fontSize: 18, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", opacity: 0.9 };
}

function activityPanel(): React.CSSProperties {
  return {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(7,12,26,0.72)",
    padding: 16,
    display: "grid",
    gap: 12,
    overflow: "hidden",
  };
}

function activityGrid(): React.CSSProperties {
  return {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gridTemplateRows: "repeat(2, minmax(0, 1fr))",
  };
}

function getSizing(preset: ScreenPreset) {
  if (preset === "wide") {
    return {
      layoutColumns: "minmax(320px, 1.05fr) minmax(0, 1.95fr)",
      avatarSize: 96,
      avatarShell: 96,
      nameFont: 14,
      metaFont: 12,
    };
  }
  if (preset === "standard") {
    return {
      layoutColumns: "minmax(270px, 0.9fr) minmax(0, 2.1fr)",
      avatarSize: 84,
      avatarShell: 86,
      nameFont: 15,
      metaFont: 12,
    };
  }
  return {
    layoutColumns: "minmax(235px, 0.78fr) minmax(0, 2.22fr)",
    avatarSize: 74,
    avatarShell: 78,
    nameFont: 16,
    metaFont: 13,
  };
}

function activityCard(isMvp: boolean): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    background: isMvp
      ? "linear-gradient(135deg, rgba(253,224,71,0.2), rgba(59,130,246,0.18), rgba(15,23,42,0.85))"
      : "rgba(15,23,42,0.8)",
    border: isMvp ? "1px solid rgba(250,204,21,0.6)" : "1px solid rgba(255,255,255,0.08)",
    display: "grid",
    gap: 4,
    boxShadow: isMvp
      ? "0 0 24px rgba(250,204,21,0.35), inset 0 0 12px rgba(255,255,255,0.08)"
      : "none",
    animation: isMvp ? "mvpPulse 2.8s ease-in-out infinite" : undefined,
  };
}

function mvpChip(): React.CSSProperties {
  return {
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(250,204,21,0.7)",
    background: "linear-gradient(135deg, rgba(250,204,21,0.8), rgba(249,115,22,0.5))",
    color: "#111827",
    fontWeight: 900,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    boxShadow: "0 0 12px rgba(250,204,21,0.6)",
  };
}

function resultChip(kind: "win" | "loss"): React.CSSProperties {
  const palette =
    kind === "win"
      ? { border: "rgba(34,197,94,0.7)", bg: "rgba(34,197,94,0.2)", text: "rgba(187,247,208,0.95)" }
      : { border: "rgba(248,113,113,0.7)", bg: "rgba(248,113,113,0.2)", text: "rgba(254,202,202,0.95)" };
  return {
    marginTop: 6,
    padding: "4px 10px",
    borderRadius: 999,
    border: `1px solid ${palette.border}`,
    background: palette.bg,
    color: palette.text,
    fontWeight: 900,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    width: "fit-content",
  };
}

function avatarBackground(bg: string | null) {
  return bg
    ? `linear-gradient(135deg, rgba(255,255,255,0.2), rgba(0,0,0,0.35)), ${bg}`
    : "linear-gradient(135deg, rgba(255,255,255,0.25), rgba(0,0,0,0.35))";
}

function buildBorderFromStudent(student: {
  corner_border_url?: string | null;
  corner_border_render_mode?: string | null;
  corner_border_html?: string | null;
  corner_border_css?: string | null;
  corner_border_js?: string | null;
  corner_border_offset_x?: number | null;
  corner_border_offset_y?: number | null;
  corner_border_offsets_by_context?: Record<string, { x?: number | null; y?: number | null; scale?: number | null }> | null;
}) {
  return {
    render_mode: student.corner_border_render_mode ?? null,
    image_url: student.corner_border_url ?? null,
    html: student.corner_border_html ?? null,
    css: student.corner_border_css ?? null,
    js: student.corner_border_js ?? null,
    offset_x: student.corner_border_offset_x ?? null,
    offset_y: student.corner_border_offset_y ?? null,
    offsets_by_context: student.corner_border_offsets_by_context ?? null,
  };
}

function buildEffectFromKey(
  key: string | null | undefined,
  map: Record<string, { config?: any; render_mode?: string | null; html?: string | null; css?: string | null; js?: string | null }>
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

function resolveAvatarUrl(value: string) {
  const clean = String(value ?? "").trim();
  if (!clean) return "";
  if (/^https?:\/\//i.test(clean)) return clean;
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) return clean;
  const normalized = clean.replace(/^\/+/, "");
  if (normalized.startsWith("storage/v1/object/public/")) {
    return `${baseUrl}/${normalized}`;
  }
  const fullPath = normalized.startsWith("avatars/") ? normalized : `avatars/${normalized}`;
  return `${baseUrl}/storage/v1/object/public/${fullPath}`;
}

function initialsFor(name: string) {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "S";
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0]}${parts[parts.length - 1][0]}`;
}

function displayPanel(): React.CSSProperties {
  return {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(5,8,18,0.8)",
    overflow: "hidden",
    padding: 12,
    display: "grid",
  };
}

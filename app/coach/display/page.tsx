"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import { supabaseClient } from "@/lib/supabase/client";

type DisplayState = {
  tool_key: "default" | "lesson_forge" | "timers" | "warmup" | "classroom_roster";
  tool_payload?: any | null;
};

type SessionRow = {
  class_name: string;
  start_time: string;
  end_time?: string | null;
};

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
  const [msg, setMsg] = useState("");
  const channelRef = useRef<any>(null);

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
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);
      setupChannel();
      loadState();
    });
    return () => {
      if (authListener?.subscription) authListener.subscription.unsubscribe();
      if (channelRef.current) supabase.removeChannel(channelRef.current);
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

  const nextSession = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = sessions
      .map((s) => ({ ...s, startAt: toDateTime(today, s.start_time) }))
      .filter((s) => s.startAt && s.startAt.getTime() > now.getTime())
      .sort((a, b) => (a.startAt?.getTime() ?? 0) - (b.startAt?.getTime() ?? 0));
    return upcoming[0] ?? null;
  }, [sessions, now]);

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

  return (
    <AuthGate>
      {blocked ? (
        <div style={blockedStyle()}>Coach display is coach-only.</div>
      ) : (
        <main style={page()}>
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
          {msg ? <div style={msgStyle()}>{msg}</div> : null}
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

function page(): React.CSSProperties {
  return {
    minHeight: "100vh",
    background: "radial-gradient(circle at top, rgba(59,130,246,0.15), rgba(2,6,23,0.95))",
    color: "white",
    display: "grid",
    placeItems: "center",
    padding: 24,
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
    height: "100vh",
    border: "none",
    background: "white",
  };
}

function blockedStyle(): React.CSSProperties {
  return { padding: 20, fontSize: 20, fontWeight: 900 };
}

function msgStyle(): React.CSSProperties {
  return { position: "absolute", top: 12, right: 12, fontSize: 12, opacity: 0.7 };
}

function displaySelector(): React.CSSProperties {
  return {
    position: "absolute",
    top: 12,
    left: 12,
    display: "grid",
    gap: 4,
    zIndex: 2,
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

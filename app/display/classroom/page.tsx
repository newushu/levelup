"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import AuthGate from "@/components/AuthGate";

type SessionRow = {
  instance_id?: string | null;
  class_id?: string | null;
  class_name?: string | null;
  start_time?: string | null;
  end_time?: string | null;
};

export default function ClassroomDisplayPage() {
  const params = useSearchParams();
  const lockInstanceId = String(params.get("lock_instance_id") ?? "").trim();
  const lockClassId = String(params.get("lock_class_id") ?? "").trim();
  const [localInstanceId, setLocalInstanceId] = useState("");
  const [localClassId, setLocalClassId] = useState("");
  const localChannelRef = useRef<BroadcastChannel | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [today, setToday] = useState<string>("");
  const [now, setNow] = useState<Date>(new Date());
  const [msg, setMsg] = useState("");

  const effectiveInstanceId = localInstanceId || lockInstanceId;
  const effectiveClassId = localClassId || lockClassId;

  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
    localChannelRef.current = new BroadcastChannel("coach-display-local");
    const channel = localChannelRef.current;
    channel.onmessage = (event) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "classroom_lock") {
        setLocalInstanceId(String(data.instanceId ?? ""));
        setLocalClassId(String(data.classId ?? ""));
      }
    };
    return () => {
      channel.close();
      localChannelRef.current = null;
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/class-sessions/today?include_ended=1", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) return;
        setSessions((data.sessions ?? []) as SessionRow[]);
        setToday(String(data?.today ?? "") || new Date().toISOString().slice(0, 10));
        setMsg("");
      } catch (err: any) {
        setMsg(err?.message ?? "Failed to load schedule");
      }
    };
    load();
    const timer = window.setInterval(load, 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const targetSession = useMemo(() => {
    if (!sessions.length) return null;
    if (effectiveInstanceId) {
      const match = sessions.find((s) => String(s.instance_id ?? "") === effectiveInstanceId);
      if (match) return match;
    }
    const date = today || new Date().toISOString().slice(0, 10);
    const upcoming = sessions
      .map((s) => ({ ...s, startAt: toDateTime(date, String(s.start_time ?? "")) }))
      .filter((s) => s.startAt && s.startAt.getTime() > now.getTime())
      .sort((a, b) => (a.startAt?.getTime() ?? 0) - (b.startAt?.getTime() ?? 0));
    return upcoming[0] ?? null;
  }, [sessions, lockInstanceId, today, now]);

  const startAt = useMemo(() => {
    if (!targetSession?.start_time) return null;
    const date = today || new Date().toISOString().slice(0, 10);
    return toDateTime(date, String(targetSession.start_time ?? ""));
  }, [targetSession, today]);

  const isCountdownActive = useMemo(() => {
    if (!startAt) return false;
    const diffMs = startAt.getTime() - now.getTime();
    return diffMs > 0 && diffMs <= 10 * 60 * 1000;
  }, [startAt, now]);

  const countdownText = useMemo(() => {
    if (!startAt) return "--:--";
    const diffMs = Math.max(0, startAt.getTime() - now.getTime());
    const totalSeconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [startAt, now]);

  return (
    <AuthGate>
      <div style={page()}>
        {msg ? <div style={msgStyle()}>{msg}</div> : null}
        {isCountdownActive ? (
          <div style={countdownWrap()}>
            <div style={rulesLabel()}>Classroom Rules</div>
            <div style={ring()}>
              <div style={ruleCard(0)}>A • Arrive</div>
              <div style={ruleCard(1)}>B • Bow at door</div>
              <div style={ruleCard(2)}>C • Check in</div>
              <div style={ruleCard(3)}>D • Dots</div>
              <div style={ruleCard(4)}>E • Effort</div>
              <div style={ruleCard(5)}>F • Focus</div>
              <div style={timerCore()}>
                <div style={timerLabel()}>Class starts in</div>
                <div style={timerValue()}>{countdownText}</div>
                <div style={timerSub()}>
                  {targetSession?.class_name || "Classroom"}
                  {effectiveClassId ? " • Locked" : ""}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={card()}>
            <div style={{ fontSize: 30, fontWeight: 1000 }}>Classroom Display</div>
            <div style={{ opacity: 0.7, fontSize: 14 }}>
              {targetSession?.class_name ? `Next: ${targetSession.class_name}` : "Waiting for class"}
            </div>
          </div>
        )}
      </div>
    </AuthGate>
  );
}

function page(): React.CSSProperties {
  return {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "radial-gradient(circle at top, rgba(56,189,248,0.15), rgba(2,6,23,0.95))",
    color: "white",
    padding: 24,
  };
}

function card(): React.CSSProperties {
  return {
    borderRadius: 20,
    padding: 24,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(15,23,42,0.7)",
    textAlign: "center",
    display: "grid",
    gap: 8,
  };
}

function msgStyle(): React.CSSProperties {
  return { position: "absolute", top: 16, right: 16, fontSize: 12, opacity: 0.7 };
}

function countdownWrap(): React.CSSProperties {
  return {
    display: "grid",
    gap: 16,
    alignItems: "center",
    justifyItems: "center",
  };
}

function rulesLabel(): React.CSSProperties {
  return {
    textTransform: "uppercase",
    letterSpacing: 2,
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.8,
  };
}

function ring(): React.CSSProperties {
  return {
    position: "relative",
    width: 520,
    height: 520,
    borderRadius: "50%",
    border: "1px dashed rgba(255,255,255,0.2)",
    display: "grid",
    placeItems: "center",
  };
}

const ringPositions: Array<React.CSSProperties> = [
  { top: -10, left: "50%", transform: "translate(-50%, 0)" },
  { top: 70, right: -20 },
  { bottom: 70, right: -20 },
  { bottom: -10, left: "50%", transform: "translate(-50%, 0)" },
  { bottom: 70, left: -20 },
  { top: 70, left: -20 },
];

function ruleCard(idx: number): React.CSSProperties {
  return {
    position: "absolute",
    ...ringPositions[idx],
    width: 160,
    padding: "12px 14px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.22)",
    background: "rgba(15,23,42,0.85)",
    fontWeight: 900,
    fontSize: 13,
    textAlign: "center",
    boxShadow: "0 0 20px rgba(56,189,248,0.22), inset 0 0 12px rgba(255,255,255,0.08)",
    letterSpacing: 0.3,
  };
}

function timerCore(): React.CSSProperties {
  return {
    width: 260,
    height: 260,
    borderRadius: "50%",
    border: "2px solid rgba(56,189,248,0.6)",
    background: "radial-gradient(circle at top, rgba(56,189,248,0.25), rgba(2,6,23,0.95))",
    display: "grid",
    placeItems: "center",
    textAlign: "center",
    boxShadow: "0 0 30px rgba(56,189,248,0.35), inset 0 0 18px rgba(255,255,255,0.08)",
    padding: 16,
  };
}

function timerLabel(): React.CSSProperties {
  return { fontSize: 12, fontWeight: 900, opacity: 0.75, textTransform: "uppercase", letterSpacing: 1 };
}

function timerValue(): React.CSSProperties {
  return { fontSize: 64, fontWeight: 1000, letterSpacing: 2 };
}

function timerSub(): React.CSSProperties {
  return { fontSize: 12, opacity: 0.7, fontWeight: 800 };
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

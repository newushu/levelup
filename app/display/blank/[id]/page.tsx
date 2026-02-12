"use client";

import { useEffect, useMemo, useState } from "react";

type DisplaySlot = { slot: number; module: string };

const MODULE_ROUTES: Record<string, string> = {
  live_activity: "/display",
  skill_pulse: "/display/skill-pulse",
  battle_pulse: "/display/battle-pulse",
  badges: "/display/badges",
  leaderboards: "/display/leaderboards",
};

export default function BlankDisplayPage({ params }: { params: { id: string } }) {
  const slotId = Number(params.id);
  const [slots, setSlots] = useState<DisplaySlot[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch("/api/display/settings", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Failed to load display settings");
        if (mounted) {
          setSlots((data?.settings?.display_blank_slots ?? []) as DisplaySlot[]);
          setStatus("");
        }
      } catch (err: any) {
        if (mounted) setStatus(err?.message ?? "Failed to load display settings");
      }
    };
    load();
    const timer = setInterval(load, 20000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const moduleKey = useMemo(() => {
    const slot = slots.find((s) => Number(s.slot) === slotId);
    return slot?.module ?? "none";
  }, [slots, slotId]);

  const targetRoute = MODULE_ROUTES[moduleKey];

  return (
    <main style={page()}>
      {status ? <div style={errorBanner()}>{status}</div> : null}
      {targetRoute ? (
        <iframe src={targetRoute} style={frame()} title={`Display ${slotId}`} />
      ) : (
        <div style={emptyState()}>
          <div style={{ fontSize: 32, fontWeight: 1000 }}>Display {slotId}</div>
          <div style={{ opacity: 0.7 }}>No module assigned.</div>
        </div>
      )}
    </main>
  );
}

function page(): React.CSSProperties {
  return {
    minHeight: "100vh",
    background: "radial-gradient(circle at top, rgba(59,130,246,0.18), rgba(2,6,23,0.96))",
    color: "white",
    display: "grid",
    placeItems: "center",
    padding: 18,
    position: "relative",
  };
}

function frame(): React.CSSProperties {
  return {
    width: "100%",
    height: "100vh",
    border: "none",
  };
}

function emptyState(): React.CSSProperties {
  return {
    display: "grid",
    gap: 8,
    textAlign: "center",
  };
}

function errorBanner(): React.CSSProperties {
  return {
    position: "absolute",
    top: 16,
    left: "50%",
    transform: "translateX(-50%)",
    padding: "8px 12px",
    borderRadius: 12,
    background: "rgba(239,68,68,0.2)",
    border: "1px solid rgba(239,68,68,0.4)",
    fontSize: 12,
    fontWeight: 700,
    zIndex: 5,
  };
}

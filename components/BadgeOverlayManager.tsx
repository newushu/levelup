"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type BadgeEvent = {
  id: string;
  type: "achievement" | "prestige" | "challenge";
  student_id: string;
  student_name: string;
  badge_name: string;
  badge_icon_url: string | null;
  points_awarded: number | null;
  created_at: string;
};

type OverlaySettings = {
  show_admin: boolean;
  show_coach: boolean;
  show_student: boolean;
  show_classroom: boolean;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status})` } };
  }
}

export default function BadgeOverlayManager() {
  const path = usePathname();
  const [role, setRole] = useState<string>("");
  const [settings, setSettings] = useState<OverlaySettings | null>(null);
  const [queue, setQueue] = useState<BadgeEvent[]>([]);
  const [active, setActive] = useState<BadgeEvent | null>(null);
  const [toast, setToast] = useState<BadgeEvent | null>(null);
  const lastSeen = useRef<string>("");

  const isDisplay = path.startsWith("/display");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const sj = await safeJson(res);
      if (!sj.ok) return;
      setRole(String(sj.json?.role ?? ""));
    })();
  }, []);

  useEffect(() => {
    if (!role) return;
    (async () => {
      const res = await fetch("/api/badge-overlay-settings", { cache: "no-store" });
      const sj = await safeJson(res);
      if (!sj.ok) return;
      setSettings((sj.json?.settings ?? null) as OverlaySettings | null);
    })();
  }, [role]);

  const enabled = (() => {
    if (!settings || !role) return false;
    const r = role.toLowerCase();
    if (r === "admin") return settings.show_admin;
    if (r === "coach") return settings.show_coach;
    if (r === "student") return settings.show_student;
    if (r === "classroom") return settings.show_classroom;
    return false;
  })();

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    const load = async () => {
      const res = await fetch("/api/badge-events?limit=15", { cache: "no-store" });
      const sj = await safeJson(res);
      if (!sj.ok || !mounted) return;
      const events = (sj.json?.events ?? []) as BadgeEvent[];
      const newest = events[0]?.created_at ?? "";
      const fresh = lastSeen.current
        ? events.filter((e) => String(e.created_at) > String(lastSeen.current))
        : events.slice(0, 1);
      if (fresh.length) {
        lastSeen.current = newest;
        setQueue((prev) => [...prev, ...fresh.reverse()]);
      }
    };
    load();
    timer = setInterval(load, 5000);
    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, [enabled]);

  useEffect(() => {
    if (active || toast || !queue.length) return;
    const next = queue[0];
    if (!next) return;
    setQueue((prev) => prev.slice(1));
    if (next.type === "prestige") {
      setActive(next);
      setTimeout(() => setActive(null), 2600);
    } else {
      setToast(next);
      setTimeout(() => setToast(null), 2200);
    }
  }, [queue, active, toast]);

  if (isDisplay) return null;

  return (
    <>
      {active ? (
        <div style={overlayWrap()}>
          <div style={overlayCard()}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Prestige Badge Earned</div>
            <div style={{ fontSize: 28, fontWeight: 1000 }}>{active.student_name}</div>
            <div style={{ display: "grid", justifyItems: "center", gap: 10, marginTop: 10 }}>
              {active.badge_icon_url ? (
                <img src={active.badge_icon_url} alt={active.badge_name} style={overlayBadge()} />
              ) : (
                <div style={overlayBadgeFallback()}>{active.badge_name.slice(0, 1)}</div>
              )}
              <div style={{ fontWeight: 1000, fontSize: 18 }}>{active.badge_name}</div>
              {active.points_awarded ? (
                <div style={{ opacity: 0.8, fontSize: 12 }}>+{active.points_awarded} pts</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div style={toastWrap()}>
          <div style={toastCard()}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {toast.badge_icon_url ? (
                <img src={toast.badge_icon_url} alt={toast.badge_name} style={toastBadge()} />
              ) : (
                <div style={toastBadgeFallback()}>{toast.badge_name.slice(0, 1)}</div>
              )}
              <div style={{ display: "grid", gap: 2 }}>
                <div style={{ fontWeight: 1000 }}>
                  {toast.type === "challenge" ? "Challenge Complete" : "Badge Earned"}
                </div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  {toast.student_name} • {toast.badge_name}
                </div>
                {toast.points_awarded ? (
                  <div style={{ fontSize: 12, opacity: 0.75 }}>+{toast.points_awarded} pts</div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function overlayWrap(): React.CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    background: "rgba(0,0,0,0.65)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  };
}

function overlayCard(): React.CSSProperties {
  return {
    borderRadius: 24,
    padding: "22px 24px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "linear-gradient(135deg, rgba(15,23,42,0.96), rgba(2,6,23,0.96))",
    minWidth: "min(460px, 80vw)",
    textAlign: "center",
    boxShadow: "0 30px 90px rgba(0,0,0,0.6)",
  };
}

function overlayBadge(): React.CSSProperties {
  return { width: 120, height: 120, objectFit: "contain" };
}

function overlayBadgeFallback(): React.CSSProperties {
  return {
    width: 120,
    height: 120,
    borderRadius: 20,
    background: "rgba(255,255,255,0.08)",
    display: "grid",
    placeItems: "center",
    fontSize: 48,
    fontWeight: 1000,
  };
}

function toastWrap(): React.CSSProperties {
  return {
    position: "fixed",
    top: 110,
    right: 20,
    zIndex: 9999,
    pointerEvents: "none",
  };
}

function toastCard(): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: "10px 12px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(2,6,23,0.92)",
    boxShadow: "0 18px 50px rgba(0,0,0,0.5)",
  };
}

function toastBadge(): React.CSSProperties {
  return { width: 46, height: 46, objectFit: "contain", borderRadius: 10 };
}

function toastBadgeFallback(): React.CSSProperties {
  return {
    width: 46,
    height: 46,
    borderRadius: 10,
    background: "rgba(255,255,255,0.1)",
    display: "grid",
    placeItems: "center",
    fontWeight: 1000,
  };
}

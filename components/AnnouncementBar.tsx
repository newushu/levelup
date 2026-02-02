"use client";

import { useEffect, useRef, useState } from "react";

type AnnouncementKind = "info" | "success" | "warning" | "reward";

type Announcement = {
  id: string;
  text: string;
  kind: AnnouncementKind;
  ts: number;
  ttlMs: number; // auto hide
};

let pushFn: ((a: Omit<Announcement, "id" | "ts">) => void) | null = null;

/**
 * Call anywhere in client code:
 * pushAnnouncement("Evalina leveled up!", "success");
 */
export function pushAnnouncement(text: string, kind: AnnouncementKind = "info", ttlMs = 2600) {
  pushFn?.({ text, kind, ttlMs });
}

export default function AnnouncementBar() {
  const [active, setActive] = useState<Announcement | null>(null);
  const qRef = useRef<Announcement[]>([]);
  const timerRef = useRef<number | null>(null);

  function showNext() {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const next = qRef.current.shift() ?? null;
    setActive(next);
    if (next) {
      timerRef.current = window.setTimeout(() => {
        setActive(null);
        // small delay then show next (helps animation feel clean)
        window.setTimeout(showNext, 150);
      }, next.ttlMs);
    }
  }

  useEffect(() => {
    pushFn = ({ text, kind, ttlMs }) => {
      const a: Announcement = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        text,
        kind,
        ttlMs,
        ts: Date.now(),
      };
      qRef.current.push(a);
      if (!active) showNext();
    };

    return () => {
      pushFn = null;
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!active) return null;

  const style = kindStyle(active.kind);

  return (
    <div
      style={{
        position: "sticky",
        top: 64,
        zIndex: 70,
        borderRadius: 18,
        padding: "10px 12px",
        border: "1px solid rgba(255,255,255,0.16)",
        background: style.bg,
        boxShadow: style.shadow,
        fontWeight: 950,
        backdropFilter: "blur(10px)",
      }}
    >
      <span style={{ marginRight: 8 }}>{style.icon}</span>
      {active.text}
    </div>
  );
}

function kindStyle(kind: AnnouncementKind) {
  if (kind === "success")
    return {
      icon: "✅",
      bg: "linear-gradient(90deg, rgba(34,197,94,0.22), rgba(59,130,246,0.10))",
      shadow: "0 18px 60px rgba(0,0,0,0.35), 0 0 22px rgba(34,197,94,0.18)",
    };
  if (kind === "warning")
    return {
      icon: "⚠️",
      bg: "linear-gradient(90deg, rgba(250,204,21,0.18), rgba(255,255,255,0.06))",
      shadow: "0 18px 60px rgba(0,0,0,0.35), 0 0 22px rgba(250,204,21,0.12)",
    };
  if (kind === "reward")
    return {
      icon: "🎉",
      bg: "linear-gradient(90deg, rgba(168,85,247,0.22), rgba(59,130,246,0.10))",
      shadow: "0 18px 60px rgba(0,0,0,0.35), 0 0 22px rgba(168,85,247,0.18)",
    };
  return {
    icon: "📣",
    bg: "rgba(0,0,0,0.40)",
    shadow: "0 18px 60px rgba(0,0,0,0.35)",
  };
}

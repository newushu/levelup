"use client";

import { useEffect, useState } from "react";

type Announcement = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  announcement_kind?: string | null;
  discount_label?: string | null;
  discount_ends_at?: string | null;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status})` } };
  }
}

export default function BannerAnnouncement() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const res = await fetch("/api/announcements?type=banner", { cache: "no-store" });
      const sj = await safeJson(res);
      if (!mounted) return;
      if (!sj.ok) return setAnnouncement(null);
      const list = (sj.json?.announcements ?? []) as Announcement[];
      setAnnouncement(list[0] ?? null);
    }
    load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  if (!announcement) return null;

  const style = kindStyle(announcement.announcement_kind);

  return (
    <div style={wrap(style)}>
      <div style={{ fontWeight: 1000, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6 }}>
        Type: {style.label}
      </div>
      <div style={{ fontWeight: 1000 }}>Subject: {announcement.title}</div>
      <div style={{ opacity: 0.85, fontSize: 13 }}>Message: {announcement.body}</div>
      {announcement.discount_label ? (
        <div style={{ fontSize: 12, opacity: 0.9 }}>
          {announcement.discount_label}
          {announcement.discount_ends_at ? ` (ends ${new Date(announcement.discount_ends_at).toLocaleDateString()})` : ""}
        </div>
      ) : null}
    </div>
  );
}

function wrap(style: { border: string; background: string }): React.CSSProperties {
  return {
    position: "fixed",
    top: 220,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 9000,
    borderRadius: 16,
    padding: "12px 14px",
    border: style.border,
    background: style.background,
    boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
    display: "grid",
    gap: 4,
    width: "min(720px, calc(100% - 48px))",
    textAlign: "center",
  };
}

function kindStyle(kind?: string | null) {
  const value = String(kind ?? "general").toLowerCase();
  if (value === "schedule_change") {
    return {
      label: "Schedule Change",
      border: "1px solid rgba(59,130,246,0.6)",
      background: "linear-gradient(135deg, rgba(59,130,246,0.3), rgba(15,23,42,0.9))",
    };
  }
  if (value === "room_change") {
    return {
      label: "Room Change",
      border: "1px solid rgba(14,165,233,0.6)",
      background: "linear-gradient(135deg, rgba(14,165,233,0.25), rgba(15,23,42,0.9))",
    };
  }
  if (value === "no_classes") {
    return {
      label: "No Classes",
      border: "1px solid rgba(248,113,113,0.7)",
      background: "linear-gradient(135deg, rgba(248,113,113,0.3), rgba(15,23,42,0.9))",
    };
  }
  if (value === "enrollment_open") {
    return {
      label: "Enrollment Open",
      border: "1px solid rgba(34,197,94,0.6)",
      background: "linear-gradient(135deg, rgba(34,197,94,0.25), rgba(15,23,42,0.9))",
    };
  }
  return {
    label: "Announcement",
    border: "1px solid rgba(251,191,36,0.6)",
    background: "linear-gradient(135deg, rgba(251,191,36,0.25), rgba(15,23,42,0.9))",
  };
}

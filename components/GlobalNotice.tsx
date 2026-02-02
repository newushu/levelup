"use client";

import { useEffect, useState } from "react";

export type Notice = { text: string; ts: number };

let pushFn: ((n: Notice) => void) | null = null;

export function pushAnnouncement(text: string) {
  pushFn?.({ text, ts: Date.now() });
}

export default function GlobalNotice() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [timeStr, setTimeStr] = useState<string>("");

  useEffect(() => {
    pushFn = (n) => setNotice(n);
    return () => {
      pushFn = null;
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    // client-only formatting -> no hydration mismatch
    const d = new Date(notice.ts);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    setTimeStr(`${hh}:${mm}:${ss}`);
  }, [notice?.ts]);

  if (!notice) return null;

  return (
    <div
      style={{
        position: "sticky",
        top: 64,
        zIndex: 50,
        borderRadius: 16,
        padding: "10px 12px",
        border: "1px solid rgba(255,255,255,0.14)",
        background: "linear-gradient(90deg, rgba(34,197,94,0.18), rgba(59,130,246,0.10))",
        boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
        fontWeight: 950,
        display: "flex",
        justifyContent: "space-between",
        gap: 10,
        alignItems: "center",
      }}
    >
      <div>📣 {notice.text}</div>
      <div style={{ opacity: 0.65, fontSize: 12 }}>{timeStr}</div>
    </div>
  );
}

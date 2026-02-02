"use client";

import { useEffect, useState } from "react";
import AuthGate from "@/components/AuthGate";

type Announcement = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  starts_at?: string | null;
  ends_at?: string | null;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status})` } };
  }
}

export default function ParentAnnouncementsPage() {
  return (
    <AuthGate>
      <ParentAnnouncementsInner />
    </AuthGate>
  );
}

function ParentAnnouncementsInner() {
  const [role, setRole] = useState("student");
  const [rows, setRows] = useState<Announcement[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const sj = await safeJson(res);
      if (sj.ok) setRole(String(sj.json?.role ?? "student"));
    })();
  }, []);

  useEffect(() => {
    if (role !== "parent") return;
    (async () => {
      const res = await fetch("/api/announcements?type=banner", { cache: "no-store" });
      const sj = await safeJson(res);
      if (!sj.ok) return setMsg(sj.json?.error || "Failed to load announcements.");
      setRows((sj.json?.announcements ?? []) as Announcement[]);
    })();
  }, [role]);

  if (role !== "parent") {
    return (
      <main style={{ padding: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Parent access only.</div>
      </main>
    );
  }

  return (
    <main style={{ padding: 18, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ fontSize: 26, fontWeight: 1000 }}>Important Announcements</div>
      <div style={{ opacity: 0.7, marginTop: 6 }}>Closures, schedule changes, and urgent updates.</div>
      {msg ? <div style={{ marginTop: 10, opacity: 0.8 }}>{msg}</div> : null}

      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {rows.map((row) => (
          <div key={row.id} style={card()}>
            <div style={{ fontWeight: 1000 }}>{row.title}</div>
            <div style={{ opacity: 0.8, fontSize: 13 }}>{row.body}</div>
            <div style={{ opacity: 0.6, fontSize: 11 }}>
              {row.starts_at ? `Starts ${new Date(row.starts_at).toLocaleString()}` : "Starts now"} •{" "}
              {row.ends_at ? `Ends ${new Date(row.ends_at).toLocaleString()}` : "No end"}
            </div>
          </div>
        ))}
        {!rows.length && <div style={{ opacity: 0.7 }}>No announcements right now.</div>}
      </div>
    </main>
  );
}

function card(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(8,10,15,0.7)",
    display: "grid",
    gap: 6,
    boxShadow: "0 16px 28px rgba(0,0,0,0.35)",
  };
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type FeedItem = {
  id: string;
  student_name: string;
  title: string;
  detail: string;
  time: string;
  tone: string;
  avatar_storage_path?: string | null;
};

export default function BadgeDisplayPage() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [authChecked, setAuthChecked] = useState(false);
  const [authOk, setAuthOk] = useState(false);
  const [displayEnabled, setDisplayEnabled] = useState(true);
  const [msg, setMsg] = useState("");
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!mounted) return;
        if (!data?.ok) {
          router.push("/login?next=/display/badges");
          return;
        }
        const role = String(data?.role ?? "").toLowerCase();
        setAuthOk(role === "display" || role === "admin");
      } catch {
        if (mounted) router.push("/login?next=/display/badges");
      } finally {
        if (mounted) setAuthChecked(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (!authOk) return;
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/display/settings", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!mounted) return;
        if (!res.ok) throw new Error(data?.error || "Failed to load display settings");
        const enabled = data?.settings?.badges_enabled !== false;
        setDisplayEnabled(enabled);
        if (!enabled) setMsg("Badges display disabled by admin.");
      } catch (err: any) {
        if (mounted) setMsg(err?.message ?? "Failed to load display settings");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [authOk]);

  useEffect(() => {
    if (!authOk || !displayEnabled) return;
    let mounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    const load = async () => {
      const res = await fetch("/api/display/live-activity?limit=40", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !mounted) return;
      const rows = (data.items ?? []) as FeedItem[];
      const filtered = rows.filter((r) => r.tone === "badge" || r.title.toLowerCase().includes("challenge"));
      setItems(filtered);
    };
    load();
    timer = window.setInterval(load, 5000);
    return () => {
      mounted = false;
      if (timer) window.clearInterval(timer);
    };
  }, [authOk, displayEnabled]);

  if (!authChecked) return <div style={{ opacity: 0.7, padding: 20 }}>Loading…</div>;
  if (!authOk) return <div style={{ opacity: 0.7, padding: 20 }}>Display login only.</div>;
  if (!displayEnabled) return <div style={{ opacity: 0.7, padding: 20 }}>{msg || "Badges display disabled."}</div>;

  return (
    <main style={page()}>
      <div style={{ fontSize: 28, fontWeight: 1000 }}>Badge Display</div>
      <div style={grid()}>
        {items.map((item) => (
          <div key={item.id} style={card(item.tone)}>
            <div style={{ fontWeight: 1000 }}>{item.title}</div>
            <div style={{ opacity: 0.8 }}>{item.detail}</div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>{new Date(item.time).toLocaleString()}</div>
          </div>
        ))}
        {!items.length ? <div style={{ opacity: 0.7 }}>No badge announcements yet.</div> : null}
      </div>
    </main>
  );
}

function page(): React.CSSProperties {
  return {
    minHeight: "100vh",
    padding: "36px 48px",
    background: "radial-gradient(circle at top, rgba(14,116,144,0.2), rgba(2,6,23,0.95))",
    color: "white",
    display: "grid",
    gap: 16,
  };
}

function grid(): React.CSSProperties {
  return {
    display: "grid",
    gap: 16,
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  };
}

function card(tone: string): React.CSSProperties {
  const border =
    tone === "badge" ? "rgba(59,130,246,0.6)" : "rgba(34,197,94,0.55)";
  return {
    borderRadius: 18,
    padding: 16,
    border: `1px solid ${border}`,
    background: "rgba(0,0,0,0.4)",
    boxShadow: "0 14px 40px rgba(0,0,0,0.5)",
  };
}

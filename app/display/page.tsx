"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type FeedItem = {
  id: string;
  student_id: string;
  student_name: string;
  avatar_storage_path: string | null;
  avatar_bg: string | null;
  points_total: number | null;
  title: string;
  detail: string;
  time: string;
  tone: "win" | "loss" | "badge" | "rank" | "skill";
};

export default function DisplayPage() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [msg, setMsg] = useState("");
  const navChannelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    const load = async () => {
      try {
        const res = await fetch("/api/display/live-activity?limit=40", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Failed to load activity");
        if (mounted) {
          setItems((data?.items ?? []) as FeedItem[]);
          setMsg("");
        }
      } catch (err: any) {
        if (mounted) setMsg(err?.message ?? "Failed to load activity");
      }
    };
    load();
    timer = window.setInterval(load, 5000);
    return () => {
      mounted = false;
      if (timer) window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
    navChannelRef.current = new BroadcastChannel("coach-timer-nav");
    navChannelRef.current.onmessage = (event) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "display_timer") {
        const route = timerRouteForKey(String(data.key ?? ""));
        if (route && window.location.pathname !== route) {
          window.location.href = route;
        }
      }
    };
    return () => {
      navChannelRef.current?.close();
      navChannelRef.current = null;
    };
  }, []);

  const recent = items.slice(0, 7);

  return (
    <main style={page()}>
      <div style={hero()}>
        <div style={headline()}>Live Activity</div>
        <div style={subhead()}>
          Skill Pulse results, points earned/lost, badges earned, rank jumps, and skill tree completions.
        </div>
        {msg ? <div style={errorBanner()}>{msg}</div> : null}
      </div>

      <div style={grid()}>
        <section style={leftPane()}>
          {recent.length ? (
            recent.map((item) => (
              <div key={item.id} style={bigCard(item.tone)}>
                <div style={cardHeader()}>
                  <div style={avatarWrap(item.avatar_bg ?? "rgba(255,255,255,0.12)")}>
                    {item.avatar_storage_path ? (
                      <img
                        src={resolveAvatarUrl(item.avatar_storage_path)}
                        alt={item.student_name}
                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                      />
                    ) : (
                      <div style={{ fontSize: 10, opacity: 0.75, textAlign: "center", padding: "0 6px" }}>
                        No avatar selected
                      </div>
                    )}
                  </div>
                  <div style={cardName()}>{item.student_name}</div>
                </div>
                <div style={bigTitle()}>{item.title}</div>
                <div style={bigDetail()}>{item.detail}</div>
                <div style={cardMeta()}>
                  <span>Points: {item.points_total ?? "—"}</span>
                  <span>{formatTime(item.time)}</span>
                </div>
              </div>
            ))
          ) : (
            <div style={emptyState()}>
              <div style={{ fontWeight: 900, fontSize: 20 }}>Waiting for activity</div>
              <div style={{ opacity: 0.7, fontSize: 13 }}>
                As students earn points or badges, the latest 4 events will appear here.
              </div>
            </div>
          )}
        </section>

        <aside style={rightPane()}>
          <div style={logTitle()}>Live Log</div>
          <div style={logList()}>
            {items.length ? (
              items.map((item) => (
                <div key={item.id} style={logItem(item.tone)}>
                  <div style={{ fontWeight: 900 }}>{item.student_name}</div>
                  <div style={{ fontWeight: 800, fontSize: 12 }}>{item.title}</div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>{item.detail}</div>
                  <div style={{ opacity: 0.6, fontSize: 11 }}>{formatTime(item.time)}</div>
                </div>
              ))
            ) : (
              <div style={{ opacity: 0.65, fontSize: 12 }}>No activity yet.</div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

function resolveAvatarUrl(storagePath?: string | null) {
  const clean = String(storagePath ?? "").trim();
  if (!clean) return "";
  if (/^https?:\/\//i.test(clean)) return clean;
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) return "";
  const normalized = clean.replace(/^\/+/, "");
  if (normalized.startsWith("storage/v1/object/public/")) {
    return `${baseUrl}/${normalized}`;
  }
  const fullPath = normalized.startsWith("avatars/") ? normalized : `avatars/${normalized}`;
  return `${baseUrl}/storage/v1/object/public/${fullPath}`;
}

function page(): React.CSSProperties {
  return {
    minHeight: "100vh",
    padding: "28px 0px",
    overflowX: "hidden",
    background:
      "radial-gradient(circle at top left, rgba(56,189,248,0.15), transparent 55%), radial-gradient(circle at 20% 60%, rgba(34,197,94,0.15), transparent 55%), linear-gradient(140deg, #020617, #0b1020 45%, #0f172a)",
    color: "white",
  };
}

function hero(): React.CSSProperties {
  return {
    display: "grid",
    gap: 6,
    marginBottom: 28,
  };
}

function headline(): React.CSSProperties {
  return {
    fontSize: 40,
    fontWeight: 1000,
    letterSpacing: 0.4,
  };
}

function subhead(): React.CSSProperties {
  return {
    fontSize: 15,
    opacity: 0.7,
    fontWeight: 700,
  };
}

function grid(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "1fr 0.22fr",
    gap: 18,
    alignItems: "start",
    width: "calc(100% + 300px)",
    marginLeft: -150,
    marginRight: -150,
  };
}

function leftPane(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    gridAutoRows: "minmax(280px, 1fr)",
    gap: 18,
    minHeight: 560,
  };
}

function rightPane(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.6)",
    display: "grid",
    gap: 10,
    minHeight: 420,
  };
}

function logTitle(): React.CSSProperties {
  return {
    fontWeight: 900,
    fontSize: 16,
    letterSpacing: 0.4,
  };
}

function logList(): React.CSSProperties {
  return {
    display: "grid",
    gap: 8,
    maxHeight: 520,
    overflowY: "auto",
    paddingRight: 4,
  };
}

function toneColor(tone: FeedItem["tone"]) {
  if (tone === "win") return "rgba(34,197,94,0.22)";
  if (tone === "loss") return "rgba(239,68,68,0.22)";
  if (tone === "badge") return "rgba(250,204,21,0.2)";
  if (tone === "rank") return "rgba(59,130,246,0.22)";
  return "rgba(148,163,184,0.16)";
}

function bigCard(tone: FeedItem["tone"]): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: 18,
    border: "1px solid rgba(255,255,255,0.16)",
    background: `linear-gradient(140deg, ${toneColor(tone)}, rgba(0,0,0,0.35))`,
    display: "grid",
    gap: 8,
    boxShadow: "0 20px 40px rgba(0,0,0,0.35)",
  };
}

function bigTitle(): React.CSSProperties {
  return {
    fontSize: 20,
    fontWeight: 1000,
  };
}

function bigDetail(): React.CSSProperties {
  return {
    fontSize: 14,
    opacity: 0.8,
    fontWeight: 700,
  };
}

function bigTime(): React.CSSProperties {
  return {
    fontSize: 11,
    opacity: 0.6,
    fontWeight: 700,
  };
}

function logItem(tone: FeedItem["tone"]): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: "10px 12px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: toneColor(tone),
    display: "grid",
    gap: 4,
  };
}

function emptyState(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: 18,
    border: "1px dashed rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.04)",
    display: "grid",
    gap: 8,
    alignContent: "center",
    justifyItems: "center",
    textAlign: "center",
    gridColumn: "1 / -1",
  };
}

function cardHeader(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
  };
}

function avatarWrap(bg: string): React.CSSProperties {
  return {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: bg,
    display: "grid",
    placeItems: "center",
    border: "1px solid rgba(255,255,255,0.2)",
    overflow: "hidden",
  };
}

function cardName(): React.CSSProperties {
  return {
    fontSize: 17,
    fontWeight: 1000,
    letterSpacing: 0.2,
  };
}

function cardMeta(): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    fontSize: 12,
    fontWeight: 800,
    opacity: 0.7,
  };
}

function formatTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function errorBanner(): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(239,68,68,0.4)",
    background: "rgba(239,68,68,0.18)",
    fontSize: 12,
    fontWeight: 800,
    width: "fit-content",
  };
}

function timerRouteForKey(key: string) {
  if (key === "ctf") return "/display/ctf";
  if (key === "crack_a_bat") return "/display/crack-a-bat";
  if (key === "siege_survive") return "/display/siege-survive";
  return "";
}

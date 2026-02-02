"use client";


import React, { useEffect, useMemo, useRef, useState } from "react";


type Earned = {
  badge_id: string;
  earned_at: string;
  source?: string | null;
  award_note?: string | null;
  achievement_badges?: {
    name?: string | null;
    description?: string | null;
    category?: string | null;
    icon_url?: string | null;
  } | null;
};


type Badge = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  icon_url: string | null;
};


async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (${res.status}): ${text.slice(0, 180)}` } };
  }
}


export default function AchievementsRail({
  studentId,
  variant = "fixed",
}: {
  studentId: string;
  variant?: "fixed" | "inline";
}) {
  const isInline = variant === "inline";
  const [earned, setEarned] = useState<Earned[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [msg, setMsg] = useState("");


  // which badge tooltip is open
  const [openId, setOpenId] = useState<string | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);


  async function load() {
    if (!studentId) return;
    setMsg("");


    const r1 = await fetch("/api/achievements/student", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId, limit: 5 }),
      cache: "no-store",
    });
    const j1 = await safeJson(r1);
    if (!j1.ok) setMsg(j1.json?.error ?? "Failed to load earned badges");
    else setEarned((j1.json?.earned ?? []) as Earned[]);


    const r2 = await fetch("/api/achievements/badges", { cache: "no-store" });
    const j2 = await safeJson(r2);
    if (j2.ok) setBadges((j2.json?.badges ?? []) as Badge[]);
  }


  useEffect(() => {
    load();
    setOpenId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);


  // close tooltip when clicking outside the rail
  useEffect(() => {
    function onDown(e: MouseEvent) {
      const el = railRef.current;
      if (!el) return;
      if (openId && !el.contains(e.target as any)) setOpenId(null);
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [openId]);


  const earnedNice = useMemo(() => {
    return (earned ?? []).map((e) => {
      const meta = e.achievement_badges ?? null;
      return {
        id: e.badge_id,
        name: meta?.name ?? e.badge_id,
        description: meta?.description ?? "",
        category: meta?.category ?? "",
        icon_url: meta?.icon_url ?? null,
        earned_at: e.earned_at,
        source: e.source ?? "",
        award_note: e.award_note ?? "",
      };
    });
  }, [earned]);


  const allById = useMemo(() => {
    const m = new Map<string, Badge>();
    badges.forEach((b) => m.set(b.id, b));
    return m;
  }, [badges]);


  function getBadgeInfo(id: string) {
    const fromEarned = earnedNice.find((x) => x.id === id);
    const fromCatalog = allById.get(id);


    const name = fromEarned?.name ?? fromCatalog?.name ?? id;
    const description = fromEarned?.description ?? fromCatalog?.description ?? "";
    const category = fromEarned?.category ?? fromCatalog?.category ?? "";
    const icon_url = fromEarned?.icon_url ?? fromCatalog?.icon_url ?? null;
    const earned_at = fromEarned?.earned_at ?? "";
    const source = fromEarned?.source ?? "";
    const award_note = fromEarned?.award_note ?? "";


    return { id, name, description, category, icon_url, earned_at, source, award_note };
  }


  return (
    <div
      ref={railRef}
      style={{
        position: isInline ? "relative" : "fixed",
        right: isInline ? undefined : 10,
        top: isInline ? undefined : 110,
        zIndex: isInline ? 1 : 60,
        width: 56,
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(10px)",
        boxShadow: "0 18px 70px rgba(0,0,0,0.45)",
        padding: 8,
        display: "grid",
        gap: 8,
      }}
    >
      {/* Header button (optional) */}
      <button
        onClick={load}
        title="Refresh Achievements"
        style={railBtn()}
      >
        🏅
      </button>


      {msg ? (
        <div style={{ fontSize: 10, opacity: 0.75, padding: "4px 2px", textAlign: "center" }}>!</div>
      ) : null}


      {earnedNice.map((b) => {
        const isOpen = openId === b.id;
        const info = isOpen ? getBadgeInfo(b.id) : null;


        return (
          <div key={b.id} style={{ position: "relative" }}>
            <button
              onClick={() => setOpenId((prev) => (prev === b.id ? null : b.id))}
              title={b.name}
              style={badgeBtn(isOpen)}
            >
              {b.icon_url ? (
                <img src={b.icon_url} alt={b.name} style={{ width: 26, height: 26, objectFit: "contain" }} />
              ) : (
                <span style={{ fontSize: 16, opacity: 0.9 }}>★</span>
              )}
            </button>


            {/* Small popover window next to badge */}
            {isOpen && info ? (
              <div style={popover()}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                  <div style={{ fontWeight: 1100, fontSize: 13 }}>{info.name}</div>
                  <button onClick={() => setOpenId(null)} style={xBtn()} aria-label="Close">✕</button>
                </div>


                {info.category ? <div style={{ opacity: 0.7, fontSize: 11, marginTop: 4 }}>{info.category}</div> : null}


                {info.description ? (
                  <div style={{ opacity: 0.9, fontSize: 12, marginTop: 8, lineHeight: 1.25 }}>{info.description}</div>
                ) : (
                  <div style={{ opacity: 0.75, fontSize: 12, marginTop: 8 }}>No description yet.</div>
                )}


                {info.earned_at ? (
                  <div style={{ opacity: 0.65, fontSize: 11, marginTop: 10 }}>
                    Earned: {String(info.earned_at).slice(0, 10)}
                    {info.source ? ` • ${info.source}` : ""}
                  </div>
                ) : null}


                {info.award_note ? (
                  <div style={{ opacity: 0.75, fontSize: 11, marginTop: 8 }}>
                    Note: {info.award_note}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}


      {!earnedNice.length && (
        <div style={{ fontSize: 10, opacity: 0.7, textAlign: "center", padding: "6px 2px" }}>No badges</div>
      )}
    </div>
  );
}


function railBtn(): React.CSSProperties {
  return {
    padding: "10px 8px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
  };
}


function badgeBtn(open: boolean): React.CSSProperties {
  return {
    width: "100%",
    height: 44,
    borderRadius: 14,
    border: open ? "1px solid rgba(59,130,246,0.35)" : "1px solid rgba(255,255,255,0.12)",
    background: open ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.05)",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    overflow: "hidden",
    boxShadow: open ? "0 0 0 2px rgba(59,130,246,0.12), 0 18px 50px rgba(0,0,0,0.35)" : "none",
  };
}


function popover(): React.CSSProperties {
  return {
    position: "absolute",
    right: 62, // opens to the left of the rail
    top: -6,
    width: 260,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.78)",
    backdropFilter: "blur(10px)",
    boxShadow: "0 22px 80px rgba(0,0,0,0.60)",
    padding: 12,
    zIndex: 120,
  };
}


function xBtn(): React.CSSProperties {
  return {
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    cursor: "pointer",
    padding: "6px 8px",
    fontWeight: 900,
    lineHeight: 1,
  };
}

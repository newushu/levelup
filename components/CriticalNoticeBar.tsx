"use client";

import { useEffect, useMemo, useState } from "react";

type NoticeRow = {
  id: string;
  message: string;
  created_at: string;
};
type BadgeRow = {
  id: string;
  name: string;
  icon_url?: string | null;
};

type HighlightSummary = {
  points_earned: number;
  rule_breaker_count: number;
  rule_breaker_points: number;
  checkins: number;
  taolu_completed: number;
  skill_completed: number;
  battle_completed: number;
};

type ActivityRow = {
  id: string;
  title: string;
  subtitle: string;
  created_at: string;
  kind?: "points_up" | "points_down" | "checkin" | "skill" | "badge" | "camp" | "coupon" | "spotlight" | "other" | null;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status})` } };
  }
}

export default function CriticalNoticeBar({
  dock = "top",
  studentId,
  recentActivity,
}: {
  dock?: "top" | "left";
  studentId?: string;
  recentActivity?: ActivityRow[];
}) {
  const [mounted, setMounted] = useState(false);
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [badges, setBadges] = useState<BadgeRow[]>([]);
  const [summary, setSummary] = useState<HighlightSummary | null>(null);
  const [summaryMsg, setSummaryMsg] = useState("");

  useEffect(() => {
    setMounted(true);
    let alive = true;

    async function load() {
      const res = await fetch("/api/notices/list", { cache: "no-store" });
      const sj = await safeJson(res);
      if (!alive) return;
      if (sj.ok) setNotices((sj.json?.notices ?? []) as NoticeRow[]);
    }

    async function loadBadges() {
      const res = await fetch("/api/achievements/badges", { cache: "no-store" });
      const sj = await safeJson(res);
      if (!alive) return;
      if (sj.ok) setBadges((sj.json?.badges ?? []) as BadgeRow[]);
    }

    if (studentId) {
      (async () => {
        const res = await fetch("/api/dashboard/highlights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ student_id: studentId }),
        });
        const sj = await safeJson(res);
        if (!alive) return;
        if (!sj.ok) {
          setSummaryMsg(sj.json?.error || "Failed to load highlights");
          return;
        }
        setSummary((sj.json?.summary ?? null) as HighlightSummary | null);
      })();
      return () => {
        alive = false;
      };
    }

    load();
    loadBadges();
    const timer = setInterval(load, 20000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [studentId]);

  const latest = notices.slice(0, 3);
  const isLeft = dock === "left";

  function matchBadge(message: string) {
    const msg = String(message ?? "").toLowerCase();
    return badges.find((b) => msg.includes(String(b.name ?? "").toLowerCase()));
  }

  const activityLines = useMemo(() => {
    return (recentActivity ?? []).slice(0, 3);
  }, [recentActivity]);

  const ruleBreakerPoints = summary?.rule_breaker_points ?? 0;
  const ruleBreakerDisplay = `${summary?.rule_breaker_count ?? 0} (${ruleBreakerPoints > 0 ? "+" : ""}${ruleBreakerPoints} pts)`;

  return (
    <div
      className={isLeft ? undefined : "container"}
      style={{
        paddingTop: isLeft ? 0 : 10,
        position: isLeft ? "relative" : "sticky",
        top: isLeft ? undefined : 0,
        zIndex: 30,
        width: isLeft ? 320 : undefined,
      }}
    >
      <div
        className="card"
        style={{
          borderRadius: 22,
          padding: "14px 16px",
          border: "1px solid rgba(34,197,94,0.45)",
          background:
            "linear-gradient(145deg, rgba(34,197,94,0.18), rgba(15,23,42,0.85)), radial-gradient(circle at top right, rgba(14,165,233,0.18), transparent 60%)",
          boxShadow: "0 0 0 2px rgba(34,197,94,0.08), 0 18px 50px rgba(0,0,0,0.35)",
          display: "grid",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div style={{ fontWeight: 950 }}>
            <span style={{ marginRight: 10 }}>✨</span>
            Activity Log
          </div>
          <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.7 }}>
            {studentId ? "This week" : "Last 3 events"}
          </div>
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          {studentId ? (
            summary ? (
              <>
                <div style={summaryLine()}>
                  <span>Points earned this week</span>
                  <b style={summaryValue()}>{summary.points_earned}</b>
                </div>
                <div style={summaryLine()}>
                  <span>Rule breakers this week</span>
                  <b style={summaryValue()}>{ruleBreakerDisplay}</b>
                </div>
                <div style={summaryLine()}>
                  <span>Check-ins this week</span>
                  <b style={summaryValue()}>{summary.checkins}</b>
                </div>
                <div style={summaryLine()}>
                  <span>Taolu trackers completed</span>
                  <b style={summaryValue()}>{summary.taolu_completed}</b>
                </div>
                <div style={summaryLine()}>
                  <span>Skill trackers completed</span>
                  <b style={summaryValue()}>
                    {summary.skill_completed} ({summary.battle_completed} battle pulses)
                  </b>
                </div>
                <div style={{ height: 1, background: "rgba(255,255,255,0.12)", margin: "6px 0" }} />
                {activityLines.length ? (
                  activityLines.map((row) => (
                    <div key={row.id} style={activityLine()}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                        <span style={activityChip(row.kind ?? null)}>{activityChipLabel(row.kind ?? null)}</span>
                        <span style={{ fontSize: 10, opacity: 0.6 }}>
                          {new Date(row.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div style={{ fontWeight: 900 }}>{row.title}</div>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>{row.subtitle}</div>
                      <div style={{ fontSize: 11, opacity: 0.6 }}>{new Date(row.created_at).toLocaleTimeString()}</div>
                    </div>
                  ))
                ) : (
                  <div style={{ fontWeight: 900, opacity: 0.7 }}>No recent activity yet.</div>
                )}
              </>
            ) : (
              <div style={{ fontWeight: 900, opacity: 0.7 }}>{summaryMsg || "Loading highlights..."}</div>
            )
          ) : latest.length ? (
            latest.map((n) => (
              <div key={n.id} style={{ fontWeight: 900, display: "grid", gap: 6, padding: "8px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    {(() => {
                      const badge = matchBadge(n.message);
                      if (!badge?.icon_url) return null;
                      return (
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 12,
                            border: "1px solid rgba(255,255,255,0.2)",
                            background: "rgba(0,0,0,0.35)",
                            display: "grid",
                            placeItems: "center",
                          }}
                        >
                          <img src={badge.icon_url} alt={badge.name} style={{ width: 22, height: 22, objectFit: "contain" }} />
                        </div>
                      );
                    })()}
                    <div>{n.message}</div>
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.6, textAlign: "right" }}>
                    <div>{new Date(n.created_at).toLocaleDateString()}</div>
                    <div>{new Date(n.created_at).toLocaleTimeString()}</div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ fontWeight: 900, opacity: 0.7 }}>No announcements yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function summaryLine(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "1fr minmax(120px, auto)",
    gap: 12,
    fontWeight: 900,
    fontSize: 13,
    alignItems: "center",
  };
}

function summaryValue(): React.CSSProperties {
  return { textAlign: "right" };
}

function activityChipLabel(kind: ActivityRow["kind"] | null) {
  switch (kind) {
    case "points_up":
      return "Points +";
    case "points_down":
      return "Points -";
    case "checkin":
      return "Check-in";
    case "skill":
      return "Skill Pulse";
    case "badge":
      return "Badge";
    case "camp":
      return "Camp";
    case "coupon":
      return "Coupon";
    case "spotlight":
      return "Spotlight";
    case "other":
      return "Other";
    default:
      return "Activity";
  }
}

function activityChip(kind: ActivityRow["kind"] | null): React.CSSProperties {
  const palette =
    kind === "points_up"
      ? { border: "1px solid rgba(34,197,94,0.55)", background: "rgba(34,197,94,0.16)", color: "#bbf7d0" }
      : kind === "points_down"
        ? { border: "1px solid rgba(248,113,113,0.55)", background: "rgba(248,113,113,0.18)", color: "#fecaca" }
        : kind === "checkin"
          ? { border: "1px solid rgba(59,130,246,0.55)", background: "rgba(59,130,246,0.16)", color: "#bfdbfe" }
          : kind === "skill"
            ? { border: "1px solid rgba(56,189,248,0.55)", background: "rgba(56,189,248,0.16)", color: "#bae6fd" }
            : kind === "badge"
              ? { border: "1px solid rgba(245,158,11,0.55)", background: "rgba(245,158,11,0.16)", color: "#fde68a" }
              : kind === "spotlight"
                ? { border: "1px solid rgba(250,204,21,0.6)", background: "rgba(250,204,21,0.16)", color: "#fef08a" }
              : kind === "camp"
                ? { border: "1px solid rgba(16,185,129,0.55)", background: "rgba(16,185,129,0.16)", color: "#a7f3d0" }
                : kind === "coupon"
                  ? { border: "1px solid rgba(251,113,133,0.55)", background: "rgba(251,113,133,0.16)", color: "#fecdd3" }
                  : { border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.08)", color: "white" };
  return {
    ...palette,
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  };
}

function activityLine(): React.CSSProperties {
  return {
    display: "grid",
    gap: 2,
    padding: "6px 0",
  };
}

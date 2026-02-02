"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type LevelRow = { level: number; count: number };
type AvatarRow = { id: string; name: string; storage_path: string | null };
type AvatarUsage = Record<string, { count: number }>;
type BadgeSummary = {
  id: string;
  name: string;
  icon_url: string;
  count: number;
  holders: Array<{ student_id: string; name: string; earned_at: string | null }>;
};
type CrestSummary = { count: number; students: Array<{ id: string; name: string }> };

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 180)}` } };
  }
}

export default function AdminStatsPage() {
  const [pinOk, setPinOk] = useState(false);
  const [msg, setMsg] = useState("");
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [avatars, setAvatars] = useState<AvatarRow[]>([]);
  const [avatarUsage, setAvatarUsage] = useState<AvatarUsage>({});
  const [prestigeBadges, setPrestigeBadges] = useState<BadgeSummary[]>([]);
  const [expandedBadge, setExpandedBadge] = useState<string | null>(null);
  const [challengeMedals, setChallengeMedals] = useState<{ total: number; by_tier: Record<string, number> }>({
    total: 0,
    by_tier: {},
  });
  const [compCrest, setCompCrest] = useState<CrestSummary>({ count: 0, students: [] });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ok = window.sessionStorage.getItem("admin_pin_ok") === "1";
    if (!ok) {
      window.location.href = "/admin";
      return;
    }
    setPinOk(true);
  }, []);

  useEffect(() => {
    if (!pinOk) return;
    (async () => {
      const [levelsRes, avatarsRes, usageRes, badgesRes, medalsRes, crestRes] = await Promise.all([
        fetch("/api/admin/stats/levels", { cache: "no-store" }),
        fetch("/api/admin/avatars", { cache: "no-store" }),
        fetch("/api/admin/avatars/usage", { cache: "no-store" }),
        fetch("/api/admin/stats/prestige-badges", { cache: "no-store" }),
        fetch("/api/admin/stats/challenge-medals", { cache: "no-store" }),
        fetch("/api/admin/stats/competition-crest", { cache: "no-store" }),
      ]);

      const [levelsJson, avatarsJson, usageJson, badgesJson, medalsJson, crestJson] = await Promise.all([
        safeJson(levelsRes),
        safeJson(avatarsRes),
        safeJson(usageRes),
        safeJson(badgesRes),
        safeJson(medalsRes),
        safeJson(crestRes),
      ]);

      if (!levelsJson.ok) setMsg(levelsJson.json?.error || "Failed to load level stats");
      if (!avatarsJson.ok) setMsg(avatarsJson.json?.error || "Failed to load avatars");
      if (!usageJson.ok) setMsg(usageJson.json?.error || "Failed to load avatar usage");
      if (!badgesJson.ok) setMsg(badgesJson.json?.error || "Failed to load prestige badges");
      if (!medalsJson.ok) setMsg(medalsJson.json?.error || "Failed to load challenge medals");
      if (!crestJson.ok) setMsg(crestJson.json?.error || "Failed to load competition crest");

      setLevels((levelsJson.json?.levels ?? []) as LevelRow[]);
      setTotalStudents(Number(levelsJson.json?.total ?? 0));
      setAvatars((avatarsJson.json?.avatars ?? []) as AvatarRow[]);
      setAvatarUsage((usageJson.json?.usage ?? {}) as AvatarUsage);
      setPrestigeBadges((badgesJson.json?.badges ?? []) as BadgeSummary[]);
      setChallengeMedals({
        total: Number(medalsJson.json?.total ?? 0),
        by_tier: (medalsJson.json?.by_tier ?? {}) as Record<string, number>,
      });
      setCompCrest({
        count: Number(crestJson.json?.count ?? 0),
        students: (crestJson.json?.students ?? []) as Array<{ id: string; name: string }>,
      });
    })();
  }, [pinOk]);

  const avatarMap = useMemo(() => new Map(avatars.map((a) => [a.id, a])), [avatars]);
  const avatarStats = useMemo(() => {
    const rows = avatars.map((avatar) => ({
      id: avatar.id,
      name: avatar.name ?? "Avatar",
      storage_path: avatar.storage_path ?? null,
      count: avatarUsage[avatar.id]?.count ?? 0,
    }));
    rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    return rows;
  }, [avatars, avatarUsage]);

  if (!pinOk) return null;

  return (
    <main style={{ display: "grid", gap: 18 }}>
      <div>
        <Link href="/admin/custom" style={backLink()}>← Back to Admin Workspace</Link>
        <div style={{ fontSize: 28, fontWeight: 1000, marginTop: 6 }}>Admin Stats</div>
        <div style={{ opacity: 0.7, fontSize: 13 }}>
          Quick snapshots of student levels, avatar usage, prestige badges, and challenge medals.
        </div>
      </div>

      {msg ? (
        <div style={alert()}>{msg}</div>
      ) : null}

      <section style={section()}>
        <div style={sectionTitle()}>Students by Level</div>
        <div style={{ opacity: 0.7, fontSize: 12 }}>Total students: {totalStudents}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
          {levels.map((row) => (
            <div key={row.level} style={statCard()}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Level {row.level}</div>
              <div style={{ fontSize: 22, fontWeight: 1000 }}>{row.count}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={section()}>
        <div style={sectionTitle()}>Avatar Usage</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {avatarStats.map((row) => (
            <div key={row.id} style={statCard()}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={avatarThumb(row.storage_path)}>
                  {row.storage_path ? (
                    <img
                      src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${row.storage_path}`}
                      alt={row.name}
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                  ) : (
                    <span style={{ fontSize: 11, opacity: 0.7 }}>No image</span>
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: 900 }}>{row.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{row.count} selected</div>
                </div>
              </div>
            </div>
          ))}
          {!avatarStats.length && <div style={{ opacity: 0.7 }}>No avatar usage yet.</div>}
        </div>
      </section>

      <section style={section()}>
        <div style={sectionTitle()}>Prestige Badges</div>
        <div style={{ display: "grid", gap: 10 }}>
          {prestigeBadges.map((badge) => {
            const isOpen = expandedBadge === badge.id;
            return (
              <div key={badge.id} style={badgeCard()}>
                <button
                  onClick={() => setExpandedBadge(isOpen ? null : badge.id)}
                  style={badgeHeader(isOpen)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={badgeIcon()}>
                      {badge.icon_url ? (
                        <img src={badge.icon_url} alt={badge.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      ) : (
                        <span style={{ fontSize: 11, opacity: 0.7 }}>No art</span>
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 1000 }}>{badge.name}</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>{badge.count} awarded</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{isOpen ? "Hide" : "View"} students</div>
                </button>
                {isOpen ? (
                  <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                    {badge.holders.map((row) => (
                      <div key={`${badge.id}-${row.student_id}-${row.earned_at}`} style={holderRow()}>
                        <span style={{ fontWeight: 900 }}>{row.name}</span>
                        <span style={{ opacity: 0.7, fontSize: 12, marginLeft: "auto" }}>
                          {row.earned_at ? new Date(row.earned_at).toLocaleString() : "—"}
                        </span>
                      </div>
                    ))}
                    {!badge.holders.length && <div style={{ opacity: 0.7 }}>No students yet.</div>}
                  </div>
                ) : null}
              </div>
            );
          })}
          {!prestigeBadges.length && <div style={{ opacity: 0.7 }}>No prestige badges awarded yet.</div>}
        </div>
      </section>

      <section style={section()}>
        <div style={sectionTitle()}>Challenge Medals</div>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={statCard()}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Total medals awarded</div>
            <div style={{ fontSize: 24, fontWeight: 1000 }}>{challengeMedals.total}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
            {Object.entries(challengeMedals.by_tier).map(([tier, count]) => (
              <div key={tier} style={statCard()}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{tier.toUpperCase()}</div>
                <div style={{ fontSize: 20, fontWeight: 1000 }}>{count}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={section()}>
        <div style={sectionTitle()}>Competition Crest</div>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={statCard()}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Students with crest</div>
            <div style={{ fontSize: 24, fontWeight: 1000 }}>{compCrest.count}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
            {compCrest.students.map((student) => (
              <div key={student.id} style={holderRow()}>
                <span style={{ fontWeight: 900 }}>{student.name}</span>
              </div>
            ))}
            {!compCrest.students.length && <div style={{ opacity: 0.7 }}>No students with crest yet.</div>}
          </div>
        </div>
      </section>
    </main>
  );
}

function backLink(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    color: "white",
    textDecoration: "none",
    fontSize: 12,
    opacity: 0.75,
  };
}

function section(): React.CSSProperties {
  return {
    display: "grid",
    gap: 12,
    padding: 16,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
  };
}

function sectionTitle(): React.CSSProperties {
  return {
    fontWeight: 1000,
    fontSize: 16,
  };
}

function statCard(): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.25)",
    display: "grid",
    gap: 6,
  };
}

function avatarThumb(storagePath: string | null): React.CSSProperties {
  return {
    width: 52,
    height: 52,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.45)",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
  };
}

function badgeCard(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.25)",
  };
}

function badgeHeader(active: boolean): React.CSSProperties {
  return {
    width: "100%",
    border: "none",
    background: "transparent",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    cursor: "pointer",
    padding: 0,
    textAlign: "left",
    borderRadius: 12,
    outline: active ? "2px solid rgba(59,130,246,0.35)" : "none",
  };
}

function badgeIcon(): React.CSSProperties {
  return {
    width: 48,
    height: 48,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.4)",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
  };
}

function holderRow(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
  };
}

function alert(): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 12,
    border: "1px solid rgba(248,113,113,0.35)",
    background: "rgba(248,113,113,0.15)",
    color: "white",
    fontWeight: 900,
  };
}

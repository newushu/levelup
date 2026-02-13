"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AuthGate from "../components/AuthGate";
import AvatarEffectParticles from "@/components/AvatarEffectParticles";

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 180)}` } };
  }
}

type TodayStats = {
  total_points_given_today: number;
  prizes_redeemed_today: number;
  top_earner_today: null | { student_id: string; name: string | null; points: number };
};

type LeaderboardEntry = {
  student_id: string;
  name: string;
  points: number;
  level: number;
  is_competition_team: boolean;
  avatar_storage_path: string | null;
  avatar_bg: string | null;
  avatar_effect?: string | null;
};

type Leaderboards = {
  total: LeaderboardEntry[];
  weekly: LeaderboardEntry[];
  lifetime: LeaderboardEntry[];
  skill_pulse_today?: LeaderboardEntry[];
  mvp?: LeaderboardEntry[];
};

type AdminPendingReward = {
  id: string;
  student_name: string;
  reward_name: string;
  cost: number;
  requested_at: string;
  hold_until?: string | null;
};

export default function HomePage() {
  return (
    <>
      <AuthGate redirectDelayMs={1800}>
        <HomeGate />
      </AuthGate>
    </>
  );
}

function HomeGate() {
  const [entered, setEntered] = useState(false);
  const [introActive, setIntroActive] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("intro_after_login") === "1") {
        localStorage.removeItem("intro_after_login");
        setIntroActive(true);
      }
    } catch {}
  }, []);

  return (
    <>
      {introActive ? (
        <LogoIntroOverlay
          onDone={() => {
            setIntroActive(false);
            setEntered(true);
          }}
        />
      ) : null}
      {!entered && !introActive ? (
        <WelcomeScreen onEnter={() => setIntroActive(true)} />
      ) : (
        <HomeInner />
      )}
    </>
  );
}

function HomeInner() {
  const [viewerRole, setViewerRole] = useState<string>("");
  const [adminRewardCount, setAdminRewardCount] = useState(0);
  const [stats, setStats] = useState<TodayStats | null>(null);
  const [leaderboards, setLeaderboards] = useState<Leaderboards | null>(null);
  const [effectConfigByKey, setEffectConfigByKey] = useState<Record<string, { config?: any }>>({});
  const [msg, setMsg] = useState("");
  const [pulseDetailOpen, setPulseDetailOpen] = useState(false);
  const [pulseDetailName, setPulseDetailName] = useState("");
  const [pulseDetailRows, setPulseDetailRows] = useState<Array<{ note: string; points: number }>>([]);
  const [pulseDetailMsg, setPulseDetailMsg] = useState("");
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [weeklyDetailOpen, setWeeklyDetailOpen] = useState(false);
  const [weeklyDetailName, setWeeklyDetailName] = useState("");
  const [weeklyDetailRows, setWeeklyDetailRows] = useState<Array<{ date: string; points: number }>>([]);
  const [weeklyDetailMsg, setWeeklyDetailMsg] = useState("");
  const weeklyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [totalDetailOpen, setTotalDetailOpen] = useState(false);
  const [totalDetailName, setTotalDetailName] = useState("");
  const [totalDetailRows, setTotalDetailRows] = useState<Array<{ points: number; note: string; created_at: string }>>([]);
  const [totalDetailMsg, setTotalDetailMsg] = useState("");
  const totalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setViewerRole(String(data.role ?? ""));
      }
    })();
  }, []);

  useEffect(() => {
    if (viewerRole !== "admin") return;
    (async () => {
      const res = await fetch("/api/rewards/admin/pending-count", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setAdminRewardCount(Number(data?.count ?? 0));
    })();
  }, [viewerRole]);

  useEffect(() => {
    (async () => {
      setMsg("");
      const r = await fetch("/api/stats/today", { cache: "no-store" });
      const sj = await safeJson(r);
      if (!sj.ok) return setMsg(sj.json?.error || "Failed to load stats");
      setStats((sj.json?.stats ?? null) as TodayStats | null);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/leaderboard", { cache: "no-store" });
      const sj = await safeJson(r);
      if (sj.ok) setLeaderboards((sj.json?.leaderboards ?? null) as Leaderboards | null);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/avatar-effects/list", { cache: "no-store" });
      const sj = await safeJson(r);
      if (!sj.ok) return;
      const list = (sj.json?.effects ?? []) as Array<{ key: string; config?: any }>;
      const map: Record<string, { config?: any }> = {};
      list.forEach((e) => {
        if (e?.key) map[String(e.key)] = { config: e.config };
      });
      setEffectConfigByKey(map);
    })();
  }, []);

  async function openPulseDetail(studentId: string, name: string) {
    if (!studentId) return;
    setPulseDetailMsg("");
    setPulseDetailName(name);
    setPulseDetailRows([]);
    setPulseDetailOpen(true);

    if (pulseTimer.current) clearTimeout(pulseTimer.current);
    pulseTimer.current = setTimeout(() => setPulseDetailOpen(false), 5000);

    const res = await fetch("/api/leaderboard/skill-pulse-detail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) {
      setPulseDetailMsg(sj.json?.error || "Failed to load skill pulse details");
      return;
    }
    const rows = (sj.json?.rows ?? []) as Array<{ note: string; points: number }>;
    setPulseDetailRows(rows.filter((r) => Number(r.points ?? 0) > 0));
  }

  async function openWeeklyDetail(studentId: string, name: string) {
    if (!studentId) return;
    setWeeklyDetailMsg("");
    setWeeklyDetailName(name);
    setWeeklyDetailRows([]);
    setWeeklyDetailOpen(true);

    if (weeklyTimer.current) clearTimeout(weeklyTimer.current);
    weeklyTimer.current = setTimeout(() => setWeeklyDetailOpen(false), 5000);

    const res = await fetch("/api/leaderboard/weekly-detail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) {
      setWeeklyDetailMsg(sj.json?.error || "Failed to load weekly points");
      return;
    }
    const rows = (sj.json?.rows ?? []) as Array<{ date: string; points: number }>;
    setWeeklyDetailRows(rows);
  }

  async function openTotalDetail(studentId: string, name: string) {
    if (!studentId) return;
    setTotalDetailMsg("");
    setTotalDetailName(name);
    setTotalDetailRows([]);
    setTotalDetailOpen(true);

    if (totalTimer.current) clearTimeout(totalTimer.current);
    totalTimer.current = setTimeout(() => setTotalDetailOpen(false), 5000);

    const res = await fetch("/api/leaderboard/total-detail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) {
      setTotalDetailMsg(sj.json?.error || "Failed to load recent skills");
      return;
    }
    const rows = (sj.json?.rows ?? []) as Array<{ points: number; note: string; created_at: string }>;
    setTotalDetailRows(rows);
  }

  if (viewerRole === "admin") {
    return <AdminHomeWorkspace rewardCount={adminRewardCount} />;
  }

  return (
    <div style={homeShell()}>
      <div style={{ display: "grid", gap: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontSize: 28, fontWeight: 1100 }}>Home</div>
          <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>Global view • Top 10 leaders</div>
        </div>
        {msg && <div style={errorBox()}>{msg}</div>}

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <div style={card()}>
            <div style={{ opacity: 0.85, fontWeight: 1000 }}>Total Points Given Today</div>
            <div style={{ marginTop: 8, fontSize: 34, fontWeight: 1150 }}>{stats ? stats.total_points_given_today : "—"}</div>
          </div>

          <div style={card()}>
            <div style={{ opacity: 0.85, fontWeight: 1000 }}>Prizes Redeemed Today</div>
            <div style={{ marginTop: 8, fontSize: 34, fontWeight: 1150 }}>{stats ? stats.prizes_redeemed_today : "—"}</div>
            <div style={{ marginTop: 6, opacity: 0.7, fontSize: 12 }}>Uses prize_redemptions table (change if needed).</div>
          </div>

          <div style={card()}>
            <div style={{ opacity: 0.85, fontWeight: 1000 }}>Top Earner Today</div>
            {stats?.top_earner_today ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 18, fontWeight: 1100 }}>{stats.top_earner_today.name ?? "Unknown student"}</div>
                <div style={{ marginTop: 6, opacity: 0.9, fontWeight: 1000 }}>
                  +{stats.top_earner_today.points} points
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 10, opacity: 0.75 }}>No points awarded yet today.</div>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ fontSize: 20, fontWeight: 1000 }}>Leaderboards</div>
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            <LeaderboardPanel
              title="Total Points"
              accent="linear-gradient(135deg, rgba(59,130,246,0.35), rgba(15,23,42,0.5))"
              rows={leaderboards?.total ?? []}
              onRowClick={(r) => openTotalDetail(r.student_id, r.name)}
              maxCount={10}
              effectConfigByKey={effectConfigByKey}
            />
            <LeaderboardPanel
              title="Weekly Points"
              accent="linear-gradient(135deg, rgba(16,185,129,0.35), rgba(15,23,42,0.5))"
              rows={leaderboards?.weekly ?? []}
              onRowClick={(r) => openWeeklyDetail(r.student_id, r.name)}
              maxCount={5}
              effectConfigByKey={effectConfigByKey}
            />
            <LeaderboardPanel
              title="Skill Pulse Today"
              accent="linear-gradient(135deg, rgba(236,72,153,0.35), rgba(15,23,42,0.5))"
              rows={leaderboards?.skill_pulse_today ?? []}
              onRowClick={(r) => openPulseDetail(r.student_id, r.name)}
              maxCount={5}
              effectConfigByKey={effectConfigByKey}
            />
            <LeaderboardPanel
              title="Lifetime Points"
              accent="linear-gradient(135deg, rgba(245,158,11,0.35), rgba(15,23,42,0.5))"
              rows={leaderboards?.lifetime ?? []}
              maxCount={5}
              effectConfigByKey={effectConfigByKey}
            />
            <LeaderboardPanel
              title="MVP Leaders"
              accent="linear-gradient(135deg, rgba(250,204,21,0.35), rgba(15,23,42,0.5))"
              rows={leaderboards?.mvp ?? []}
              maxCount={5}
              effectConfigByKey={effectConfigByKey}
            />
          </div>
        </div>
      </div>

      {pulseDetailOpen ? (
        <div style={pulseOverlay()} onClick={() => setPulseDetailOpen(false)}>
          <div style={{ fontWeight: 1000, fontSize: 12 }}>{pulseDetailName}</div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>Skill Pulse Today</div>
          {pulseDetailMsg ? <div style={{ fontSize: 11, opacity: 0.7 }}>{pulseDetailMsg}</div> : null}
          <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
            {pulseDetailRows.map((row, i) => (
              <div key={`${row.note}-${i}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11 }}>
                <div style={{ opacity: 0.85 }}>{row.note || "Skill Pulse"}</div>
                <div style={{ fontWeight: 900 }}>{row.points}</div>
              </div>
            ))}
            {!pulseDetailRows.length && !pulseDetailMsg ? (
              <div style={{ fontSize: 11, opacity: 0.7 }}>No Skill Pulse points yet today.</div>
            ) : null}
          </div>
        </div>
      ) : null}
      {weeklyDetailOpen ? (
        <div style={pulseOverlay()} onClick={() => setWeeklyDetailOpen(false)}>
          <div style={{ fontWeight: 1000, fontSize: 12 }}>{weeklyDetailName}</div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>Weekly Points</div>
          {weeklyDetailMsg ? <div style={{ fontSize: 11, opacity: 0.7 }}>{weeklyDetailMsg}</div> : null}
          <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
            {weeklyDetailRows.map((row) => (
              <div key={row.date} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11 }}>
                <div style={{ opacity: 0.85 }}>{row.date}</div>
                <div style={{ fontWeight: 900 }}>{row.points}</div>
              </div>
            ))}
            {!weeklyDetailRows.length && !weeklyDetailMsg ? (
              <div style={{ fontSize: 11, opacity: 0.7 }}>No points yet this week.</div>
            ) : null}
          </div>
        </div>
      ) : null}
      {totalDetailOpen ? (
        <div style={pulseOverlay()} onClick={() => setTotalDetailOpen(false)}>
          <div style={{ fontWeight: 1000, fontSize: 12 }}>{totalDetailName}</div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>Last 10 Point Actions</div>
          {totalDetailMsg ? <div style={{ fontSize: 11, opacity: 0.7 }}>{totalDetailMsg}</div> : null}
          <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
            {totalDetailRows.map((row, i) => (
              <div key={`${row.note}-${row.created_at}-${i}`} style={{ display: "grid", gap: 2, fontSize: 11 }}>
                <div style={{ fontWeight: 900 }}>+{row.points} pts</div>
                <div style={{ opacity: 0.7 }}>{row.note}</div>
                <div style={{ opacity: 0.6 }}>{formatDate(row.created_at)}</div>
              </div>
            ))}
            {!totalDetailRows.length && !totalDetailMsg ? (
              <div style={{ fontSize: 11, opacity: 0.7 }}>No recent point actions.</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AdminHomeWorkspace({ rewardCount }: { rewardCount: number }) {
  const [tab, setTab] = useState<"workspace" | "rewards" | "performance" | "classes">("workspace");
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeCardIdx, setActiveCardIdx] = useState(0);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [rewardRows, setRewardRows] = useState<AdminPendingReward[]>([]);
  const [rewardLoading, setRewardLoading] = useState(false);
  const [rewardBusy, setRewardBusy] = useState<Record<string, boolean>>({});
  const [rewardMsg, setRewardMsg] = useState("");
  const carouselRef = useRef<HTMLDivElement | null>(null);

  const workspaceCards = [
    {
      title: "Avatar Customization",
      subtitle: "Design avatars, borders, effects, and card plates",
      href: "/admin/custom/media?view=avatars",
      tone: "cyan" as const,
      icon: "AV",
    },
    {
      title: "Admin Check-In",
      subtitle: "Open check-in controls for classes and attendance",
      href: "/checkin",
      tone: "orange" as const,
      icon: "CI",
    },
    {
      title: "LessonForge Builder",
      subtitle: "Build class templates and timeline sections",
      href: "/tools/lesson-forge/builder",
      tone: "emerald" as const,
      icon: "BLD",
    },
    {
      title: "Styling & UI Customization",
      subtitle: "Manage menus and interface visibility settings",
      href: "/admin/custom/navigation",
      tone: "indigo" as const,
      icon: "UI",
    },
    { title: "Workspace Slot 4", subtitle: "Placeholder module", href: "#", tone: "indigo" as const, icon: "04" },
    { title: "Workspace Slot 5", subtitle: "Placeholder module", href: "#", tone: "rose" as const, icon: "05" },
    { title: "Workspace Slot 6", subtitle: "Placeholder module", href: "#", tone: "amber" as const, icon: "06" },
    { title: "Workspace Slot 7", subtitle: "Placeholder module", href: "#", tone: "sky" as const, icon: "07" },
    { title: "Workspace Slot 8", subtitle: "Placeholder module", href: "#", tone: "violet" as const, icon: "08" },
    { title: "Workspace Slot 9", subtitle: "Placeholder module", href: "#", tone: "slate" as const, icon: "09" },
  ];

  useEffect(() => {
    const onResize = () => {
      if (typeof window === "undefined") return;
      setIsMobile(window.innerWidth <= 860);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await fetch("/api/public/nav-logo", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!mounted) return;
      if (data?.logo_url) setLogoUrl(String(data.logo_url));
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    const onScroll = () => {
      const first = el.children[0] as HTMLElement | undefined;
      if (!first) return;
      const style = window.getComputedStyle(el);
      const gap = Number.parseFloat(style.columnGap || style.gap || "0") || 0;
      const stride = first.offsetWidth + gap;
      if (stride <= 0) return;
      const idx = Math.round(el.scrollLeft / stride);
      setActiveCardIdx(Math.max(0, Math.min(workspaceCards.length - 1, idx)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [workspaceCards.length]);

  async function loadRewardRows(silent = false) {
    if (!silent) setRewardLoading(true);
    const res = await fetch("/api/rewards/admin/pending", { cache: "no-store" });
    const data = await safeJson(res);
    if (!data.ok) {
      setRewardMsg(data.json?.error || "Failed to load pending requests");
      if (!silent) setRewardLoading(false);
      return;
    }
    setRewardRows((data.json?.pending ?? []) as AdminPendingReward[]);
    setRewardMsg("");
    if (!silent) setRewardLoading(false);
  }

  async function resolveReward(redemptionId: string, action: "approve" | "reject") {
    setRewardBusy((prev) => ({ ...prev, [redemptionId]: true }));
    setRewardMsg("");
    const res = await fetch("/api/rewards/admin/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ redemption_id: redemptionId, action }),
    });
    const data = await safeJson(res);
    if (!data.ok) {
      setRewardBusy((prev) => ({ ...prev, [redemptionId]: false }));
      setRewardMsg(data.json?.error || "Failed to update request");
      return;
    }
    await loadRewardRows();
    setRewardBusy((prev) => ({ ...prev, [redemptionId]: false }));
  }

  useEffect(() => {
    if (tab !== "rewards") return;
    loadRewardRows(false);
    const pollId = window.setInterval(() => {
      loadRewardRows(true);
    }, 5000);
    return () => window.clearInterval(pollId);
  }, [tab]);

  function scrollWorkspace(direction: "left" | "right") {
    const el = carouselRef.current;
    if (!el) return;
    const first = el.children[0] as HTMLElement | undefined;
    if (!first) return;
    const style = window.getComputedStyle(el);
    const gap = Number.parseFloat(style.columnGap || style.gap || "0") || 0;
    const stride = first.offsetWidth + gap;
    el.scrollBy({ left: direction === "right" ? stride : -stride, behavior: "smooth" });
  }

  const performanceLinks = [
    { label: "Leaderboards", href: "/leaderboard" },
    { label: "Skill Tracker", href: "/skill-tracker" },
    { label: "Performance Lab", href: "/performance-lab" },
    { label: "Taolu Tracker", href: "/taolu-tracker" },
  ];
  const classLinks = [
    { label: "Classroom", href: "/classroom" },
    { label: "Roster", href: "/roster" },
    { label: "Check-In", href: "/checkin" },
    { label: "Schedule", href: "/schedule" },
  ];
  const shortcutLinks = [
    { label: "Announcements", href: "/admin/announcements" },
    { label: "Parent Pairing", href: "/admin/parent-pairing" },
    { label: "Parent Messages", href: "/admin/parent-messages" },
    { label: "Admin Workspace", href: "/admin/custom" },
    { label: "Rewards Approvals", href: "/admin/rewards" },
  ];

  return (
    <div style={adminHomeWrap()}>
      <div style={adminTopBar()}>
        <div style={adminTopBrand()}>
          <img
            src={logoUrl ?? "https://newushu.com/uploads/1/1/1/3/111378341/newushu-black-transparent-2.png"}
            alt="Lead & Achieve"
            style={adminTopLogo()}
          />
          <div style={{ display: "grid", gap: 4 }}>
            <div style={adminLevelUpTitle()}>Level Up</div>
            <div style={adminHomeHeader()}>Admin</div>
            <div style={adminHomeSub()}>Workspace Station</div>
          </div>
        </div>
        <div style={adminTopRight()}>
          <div style={adminAdminOnlyChip()}>Admin/Coach Only Station</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Link href="/login" style={adminSessionBtn()}>
              Login
            </Link>
            <a href="/logout" style={adminSessionBtn("logout")}>
              🚪 Logout
            </a>
          </div>
        </div>
      </div>

      <div style={adminWorkArea()}>
        {tab === "workspace" ? (
          <div style={adminWorkspaceStage()}>
            <div style={adminWorkspaceEdge("left")} />
            <div style={adminWorkspaceEdge("right")} />
            <button type="button" style={workspaceArrow("left")} onClick={() => scrollWorkspace("left")} aria-label="Scroll left">
              ‹
            </button>
            <div ref={carouselRef} style={workspaceCarousel(isMobile)}>
              {workspaceCards.map((card, idx) => {
                const visibleRadius = isMobile ? 0 : 1;
                const distance = Math.abs(idx - activeCardIdx);
                const focused = distance <= visibleRadius;
                const style = adminParallelogramCard(card.tone, focused);
                const body = (
                  <div style={adminParallelogramInner()}>
                    <div style={adminCardIconShell()}>
                      <div style={adminCardIconInner()}>{card.icon}</div>
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      <div style={adminParallelogramTitle()}>{card.title}</div>
                      <div style={adminParallelogramSub()}>{card.subtitle}</div>
                    </div>
                  </div>
                );
                return card.href === "#" ? (
                  <button key={card.title} type="button" style={style}>
                    {body}
                  </button>
                ) : (
                  <Link key={card.title} href={card.href} style={style}>
                    {body}
                  </Link>
                );
              })}
            </div>
            <button type="button" style={workspaceArrow("right")} onClick={() => scrollWorkspace("right")} aria-label="Scroll right">
              ›
            </button>
          </div>
        ) : null}

        {tab === "rewards" ? (
          <div style={adminPanelWrap()}>
            <div style={adminPanelTitle()}>Reward Requests</div>
            {rewardMsg ? <div style={adminInlineNotice()}>{rewardMsg}</div> : null}
            {rewardLoading ? <div style={{ opacity: 0.75 }}>Loading pending requests...</div> : null}
            {!rewardLoading ? (
              <div style={{ display: "grid", gap: 10 }}>
                {rewardRows.map((row) => (
                  <div key={row.id} style={adminRewardCard()}>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontWeight: 1000 }}>{row.student_name}</div>
                      <div style={{ opacity: 0.86, fontSize: 13 }}>
                        {row.reward_name} • {row.cost} pts
                      </div>
                      <div style={{ opacity: 0.66, fontSize: 11 }}>
                        Requested {row.requested_at ? new Date(row.requested_at).toLocaleString() : "—"}
                        {row.hold_until ? ` • Hold until ${new Date(row.hold_until).toLocaleDateString()}` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        style={adminRewardActionBtn("approve")}
                        onClick={() => resolveReward(row.id, "approve")}
                        disabled={!!rewardBusy[row.id]}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        style={adminRewardActionBtn("reject")}
                        onClick={() => resolveReward(row.id, "reject")}
                        disabled={!!rewardBusy[row.id]}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
                {!rewardRows.length ? (
                  <div style={{ opacity: 0.72 }}>No pending requests.</div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "performance" ? (
          <div style={adminPanelWrap()}>
            <div style={adminPanelTitle()}>Performance</div>
            <div style={adminPanelGrid()}>
              {performanceLinks.map((item) => (
                <Link key={item.href} href={item.href} style={adminPanelLink()}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {tab === "classes" ? (
          <div style={adminPanelWrap()}>
            <div style={adminPanelTitle()}>Classes</div>
            <div style={adminPanelGrid()}>
              {classLinks.map((item) => (
                <Link key={item.href} href={item.href} style={adminPanelLink()}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {shortcutsOpen ? (
        <div style={adminShortcutsSheet()}>
          {shortcutLinks.map((item) => (
            <Link key={item.href} href={item.href} style={adminSheetLink()} onClick={() => setShortcutsOpen(false)}>
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}

      <div style={adminBottomDock()}>
        <button style={adminDockBtn(tab === "workspace", "workspace")} onClick={() => setTab("workspace")}>Workspace</button>
        <button style={adminDockBtn(tab === "rewards", "rewards")} onClick={() => setTab("rewards")}>
          <span style={{ position: "relative", display: "inline-block" }}>
            Reward Requests
            {rewardCount > 0 ? <span style={adminBadgeBubble()}>{rewardCount}</span> : null}
          </span>
        </button>
        <button style={adminDockBtn(tab === "performance", "performance")} onClick={() => setTab("performance")}>Performance</button>
        <button style={adminDockBtn(tab === "classes", "classes")} onClick={() => setTab("classes")}>Classes</button>
        <button style={adminDockBtn(shortcutsOpen, "shortcuts")} onClick={() => setShortcutsOpen((v) => !v)}>Admin Shortcuts</button>
      </div>
    </div>
  );
}

function adminHomeWrap(): React.CSSProperties {
  return {
    minHeight: "82vh",
    display: "grid",
    gap: 12,
    padding: "20px 20px 110px",
    fontFamily: "\"Avenir Next\", \"Montserrat\", \"Segoe UI\", sans-serif",
    letterSpacing: 0.2,
  };
}

function adminHomeHeader(): React.CSSProperties {
  return { fontSize: 34, fontWeight: 1000, letterSpacing: 1.2, textTransform: "uppercase" };
}

function adminHomeSub(): React.CSSProperties {
  return { opacity: 0.78, fontSize: 12, fontWeight: 900, letterSpacing: 0.55, textTransform: "uppercase" };
}

function adminLevelUpTitle(): React.CSSProperties {
  return {
    fontSize: 18,
    fontWeight: 1000,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    opacity: 0.92,
  };
}

function adminTopBar(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "1fr",
    justifyItems: "center",
    gap: 10,
    padding: "4px 2px",
  };
}

function adminTopBrand(): React.CSSProperties {
  return {
    display: "grid",
    justifyItems: "center",
    textAlign: "center",
    gap: 6,
  };
}

function adminTopLogo(): React.CSSProperties {
  return {
    width: 110,
    height: 110,
    objectFit: "contain",
    filter: "invert(1) brightness(1.1) drop-shadow(0 8px 18px rgba(0,0,0,0.45))",
  };
}

function adminTopRight(): React.CSSProperties {
  return {
    display: "grid",
    gap: 8,
    justifyItems: "center",
  };
}

function adminAdminOnlyChip(): React.CSSProperties {
  return {
    borderRadius: 999,
    border: "1px solid rgba(250,204,21,0.55)",
    background: "linear-gradient(140deg, rgba(113,63,18,0.62), rgba(161,98,7,0.48))",
    color: "rgba(254,243,199,0.98)",
    padding: "7px 12px",
    fontSize: 11,
    fontWeight: 1000,
    letterSpacing: 0.55,
    textTransform: "uppercase",
    boxShadow: "0 8px 20px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.08)",
  };
}

function adminSessionBtn(kind: "default" | "logout" = "default"): React.CSSProperties {
  const logout = kind === "logout";
  return {
    textDecoration: "none",
    borderRadius: 12,
    border: logout ? "1px solid rgba(248,113,113,0.55)" : "1px solid rgba(148,163,184,0.4)",
    background: logout
      ? "linear-gradient(145deg, rgba(127,29,29,0.68), rgba(153,27,27,0.52))"
      : "linear-gradient(145deg, rgba(15,23,42,0.78), rgba(30,41,59,0.6))",
    color: "white",
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 0.45,
    textTransform: "uppercase",
  };
}

function adminWorkArea(): React.CSSProperties {
  return {
    borderRadius: 24,
    border: "1px solid rgba(148,163,184,0.24)",
    background: "linear-gradient(160deg, rgba(12,18,32,0.95), rgba(3,8,18,0.96))",
    boxShadow: "0 18px 40px rgba(0,0,0,0.36)",
    padding: 16,
    minHeight: 520,
  };
}

function adminWorkspaceStage(): React.CSSProperties {
  return {
    position: "relative",
    minHeight: 486,
    display: "grid",
    alignItems: "center",
    overflow: "hidden",
  };
}

function workspaceCarousel(isMobile: boolean): React.CSSProperties {
  const columns = isMobile ? "minmax(90%, 90%)" : "minmax(calc((100% - 44px) / 3), calc((100% - 44px) / 3))";
  return {
    display: "grid",
    gridAutoFlow: "column",
    gridAutoColumns: columns,
    gap: 22,
    overflowX: "auto",
    overflowY: "hidden",
    scrollSnapType: "x mandatory",
    WebkitOverflowScrolling: "touch",
    padding: isMobile ? "10px 28px" : "10px 54px",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
  };
}

function workspaceArrow(side: "left" | "right"): React.CSSProperties {
  return {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    [side]: 2,
    width: 28,
    height: 54,
    border: "none",
    background: "transparent",
    color: "rgba(255,255,255,0.92)",
    fontSize: 42,
    fontWeight: 900,
    lineHeight: 1,
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    zIndex: 5,
    textShadow: "0 8px 22px rgba(0,0,0,0.75), 0 0 10px rgba(148,163,184,0.45)",
    padding: 0,
  };
}

function adminWorkspaceEdge(side: "left" | "right"): React.CSSProperties {
  const gradient =
    side === "left"
      ? "linear-gradient(90deg, rgba(2,6,23,0.98), rgba(2,6,23,0.72), rgba(2,6,23,0))"
      : "linear-gradient(270deg, rgba(2,6,23,0.98), rgba(2,6,23,0.72), rgba(2,6,23,0))";
  return {
    position: "absolute",
    top: 0,
    bottom: 0,
    [side]: 0,
    width: 72,
    background: gradient,
    zIndex: 4,
    pointerEvents: "none",
  };
}

function adminParallelogramCard(
  tone: "cyan" | "orange" | "emerald" | "indigo" | "rose" | "amber" | "sky" | "violet" | "slate",
  focused: boolean
): React.CSSProperties {
  const gradients: Record<typeof tone, string> = {
    cyan: "linear-gradient(150deg, rgba(6,182,212,0.72), rgba(14,116,144,0.45) 54%, rgba(2,6,23,0.96))",
    orange: "linear-gradient(150deg, rgba(249,115,22,0.72), rgba(194,65,12,0.45) 54%, rgba(2,6,23,0.96))",
    emerald: "linear-gradient(150deg, rgba(16,185,129,0.72), rgba(5,150,105,0.42) 54%, rgba(2,6,23,0.96))",
    indigo: "linear-gradient(150deg, rgba(99,102,241,0.72), rgba(67,56,202,0.45) 54%, rgba(2,6,23,0.96))",
    rose: "linear-gradient(150deg, rgba(244,63,94,0.72), rgba(190,24,93,0.45) 54%, rgba(2,6,23,0.96))",
    amber: "linear-gradient(150deg, rgba(245,158,11,0.72), rgba(180,83,9,0.45) 54%, rgba(2,6,23,0.96))",
    sky: "linear-gradient(150deg, rgba(14,165,233,0.72), rgba(3,105,161,0.45) 54%, rgba(2,6,23,0.96))",
    violet: "linear-gradient(150deg, rgba(139,92,246,0.72), rgba(109,40,217,0.45) 54%, rgba(2,6,23,0.96))",
    slate: "linear-gradient(150deg, rgba(148,163,184,0.62), rgba(71,85,105,0.45) 54%, rgba(2,6,23,0.96))",
  };
  return {
    position: "relative",
    minHeight: 424,
    borderRadius: 22,
    clipPath: "polygon(10% 0%, 100% 0%, 90% 100%, 0% 100%)",
    border: focused ? "1px solid rgba(148,163,184,0.62)" : "1px solid rgba(148,163,184,0.26)",
    background: gradients[tone],
    boxShadow: focused
      ? "0 24px 52px rgba(0,0,0,0.52), inset 0 0 0 1px rgba(255,255,255,0.12)"
      : "0 12px 30px rgba(0,0,0,0.38), inset 0 0 0 1px rgba(255,255,255,0.08)",
    textDecoration: "none",
    color: "white",
    padding: "20px 18px",
    cursor: "pointer",
    scrollSnapAlign: "center",
    transform: focused ? "scale(1)" : "scale(0.94)",
    filter: focused ? "blur(0px) saturate(1)" : "blur(1.1px) saturate(0.65)",
    opacity: focused ? 1 : 0.58,
    transition: "transform 180ms ease, filter 180ms ease, opacity 180ms ease, box-shadow 180ms ease",
    display: "grid",
  };
}

function adminParallelogramInner(): React.CSSProperties {
  return {
    display: "grid",
    gap: 16,
    alignContent: "space-between",
    justifyItems: "center",
    textAlign: "center",
    height: "100%",
    padding: "10px 8px",
  };
}

function adminCardIconShell(): React.CSSProperties {
  return {
    width: 76,
    height: 76,
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.42)",
    background: "rgba(2,6,23,0.46)",
    boxShadow: "inset 0 0 14px rgba(255,255,255,0.14), 0 10px 24px rgba(0,0,0,0.4)",
    display: "grid",
    placeItems: "center",
  };
}

function adminCardIconInner(): React.CSSProperties {
  return {
    width: 58,
    height: 58,
    borderRadius: 14,
    border: "1px dashed rgba(255,255,255,0.55)",
    display: "grid",
    placeItems: "center",
    fontSize: 16,
    fontWeight: 1000,
    letterSpacing: 0.08,
  };
}

function adminParallelogramTitle(): React.CSSProperties {
  return {
    fontSize: 24,
    fontWeight: 1100,
    letterSpacing: 0.45,
    textTransform: "uppercase",
    textShadow: "0 8px 20px rgba(0,0,0,0.38)",
  };
}

function adminParallelogramSub(): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 800,
    opacity: 0.86,
    maxWidth: 340,
    lineHeight: 1.45,
    textAlign: "center",
  };
}

function adminPanelWrap(): React.CSSProperties {
  return { display: "grid", gap: 10 };
}

function adminPanelTitle(): React.CSSProperties {
  return { fontWeight: 1000, fontSize: 22 };
}

function adminPanelGrid(): React.CSSProperties {
  return {
    display: "grid",
    gap: 10,
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  };
}

function adminPanelLink(): React.CSSProperties {
  return {
    textDecoration: "none",
    color: "white",
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.26)",
    background: "rgba(30,41,59,0.75)",
    padding: "12px 14px",
    fontWeight: 900,
  };
}

function adminInlineNotice(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(248,113,113,0.35)",
    background: "rgba(127,29,29,0.28)",
    color: "white",
    fontWeight: 900,
    fontSize: 12,
  };
}

function adminRewardCard(): React.CSSProperties {
  return {
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,0.28)",
    background: "rgba(15,23,42,0.7)",
    boxShadow: "0 12px 28px rgba(0,0,0,0.3)",
    padding: "12px 14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  };
}

function adminRewardActionBtn(kind: "approve" | "reject"): React.CSSProperties {
  const approve = kind === "approve";
  return {
    borderRadius: 12,
    border: approve ? "1px solid rgba(74,222,128,0.52)" : "1px solid rgba(248,113,113,0.52)",
    background: approve
      ? "linear-gradient(145deg, rgba(21,128,61,0.58), rgba(22,163,74,0.36))"
      : "linear-gradient(145deg, rgba(153,27,27,0.62), rgba(185,28,28,0.36))",
    color: "white",
    fontWeight: 900,
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    padding: "8px 12px",
    cursor: "pointer",
  };
}

function adminBottomDock(): React.CSSProperties {
  return {
    position: "fixed",
    left: "50%",
    bottom: 14,
    transform: "translateX(-50%)",
    display: "grid",
    gridAutoFlow: "column",
    gridAutoColumns: "minmax(172px, 1fr)",
    gap: 10,
    padding: 8,
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.26)",
    background: "rgba(2,6,23,0.9)",
    backdropFilter: "blur(10px)",
    boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
    width: "min(1100px, calc(100vw - 18px))",
    overflowX: "auto",
    overflowY: "hidden",
    WebkitOverflowScrolling: "touch",
    scrollSnapType: "x mandatory",
    zIndex: 80,
  };
}

function adminDockBtn(
  active = false,
  tone: "workspace" | "rewards" | "performance" | "classes" | "shortcuts" = "workspace"
): React.CSSProperties {
  const toneMap: Record<
    "workspace" | "rewards" | "performance" | "classes" | "shortcuts",
    { activeBg: string; idleBg: string; activeBorder: string }
  > = {
    workspace: {
      activeBg: "linear-gradient(140deg, rgba(14,165,233,0.56), rgba(2,132,199,0.3))",
      idleBg: "linear-gradient(140deg, rgba(14,116,144,0.34), rgba(30,41,59,0.82))",
      activeBorder: "rgba(56,189,248,0.72)",
    },
    rewards: {
      activeBg: "linear-gradient(140deg, rgba(239,68,68,0.62), rgba(185,28,28,0.35))",
      idleBg: "linear-gradient(140deg, rgba(185,28,28,0.30), rgba(30,41,59,0.84))",
      activeBorder: "rgba(248,113,113,0.75)",
    },
    performance: {
      activeBg: "linear-gradient(140deg, rgba(34,197,94,0.58), rgba(21,128,61,0.34))",
      idleBg: "linear-gradient(140deg, rgba(22,101,52,0.3), rgba(30,41,59,0.82))",
      activeBorder: "rgba(74,222,128,0.72)",
    },
    classes: {
      activeBg: "linear-gradient(140deg, rgba(249,115,22,0.58), rgba(194,65,12,0.34))",
      idleBg: "linear-gradient(140deg, rgba(154,52,18,0.3), rgba(30,41,59,0.84))",
      activeBorder: "rgba(251,146,60,0.72)",
    },
    shortcuts: {
      activeBg: "linear-gradient(140deg, rgba(100,116,139,0.56), rgba(51,65,85,0.32))",
      idleBg: "linear-gradient(140deg, rgba(71,85,105,0.34), rgba(30,41,59,0.84))",
      activeBorder: "rgba(148,163,184,0.74)",
    },
  };
  const palette = toneMap[tone];
  return {
    borderRadius: 14,
    border: active ? `1px solid ${palette.activeBorder}` : "1px solid rgba(148,163,184,0.3)",
    background: active ? palette.activeBg : palette.idleBg,
    color: "white",
    fontWeight: 900,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.55,
    padding: "13px 16px",
    cursor: "pointer",
    minWidth: 172,
    minHeight: 58,
    scrollSnapAlign: "start",
    boxShadow: active ? "0 0 24px rgba(148,163,184,0.35), inset 0 0 18px rgba(255,255,255,0.1)" : undefined,
    transform: active ? "translateY(-2px) scale(1.02)" : "none",
    transition: "transform 140ms ease, box-shadow 140ms ease, background 140ms ease, border-color 140ms ease",
  };
}

function adminBadgeBubble(): React.CSSProperties {
  return {
    position: "absolute",
    top: -12,
    right: -24,
    minWidth: 24,
    height: 24,
    borderRadius: 999,
    border: "2px solid rgba(2,6,23,0.9)",
    background: "rgba(239,68,68,0.95)",
    color: "white",
    display: "grid",
    placeItems: "center",
    fontSize: 11,
    fontWeight: 1000,
    padding: "0 6px",
  };
}

function adminShortcutsSheet(): React.CSSProperties {
  return {
    position: "fixed",
    right: 18,
    bottom: 86,
    width: 260,
    maxHeight: "60vh",
    overflow: "auto",
    display: "grid",
    gap: 8,
    padding: 10,
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,0.26)",
    background: "rgba(2,6,23,0.94)",
    boxShadow: "0 16px 34px rgba(0,0,0,0.45)",
    zIndex: 82,
  };
}

function adminSheetLink(): React.CSSProperties {
  return {
    textDecoration: "none",
    color: "white",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.24)",
    background: "rgba(30,41,59,0.75)",
    padding: "9px 10px",
    fontWeight: 800,
    fontSize: 12,
  };
}

function LogoIntroOverlay({ onDone }: { onDone?: () => void }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoZoom, setLogoZoom] = useState(1);
  const [soundUrl, setSoundUrl] = useState<string | null>(null);
  const [soundVolume, setSoundVolume] = useState(1);
  const [active, setActive] = useState(true);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await fetch("/api/public/nav-logo", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!mounted) return;
      if (data?.logo_url) setLogoUrl(String(data.logo_url));
      if (data?.logo_zoom) setLogoZoom(Number(data.logo_zoom ?? 1));
      if (data?.intro_audio_url) setSoundUrl(String(data.intro_audio_url));
      if (data?.intro_volume != null) setSoundVolume(Math.min(1, Math.max(0, Number(data.intro_volume))));
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    if (!soundUrl) return;
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;
    audio.pause();
    audio.muted = false;
    audio.src = soundUrl;
    audio.volume = soundVolume;
    audio.currentTime = 0;
    audio.play().then(() => setAudioBlocked(false)).catch(() => {
      setAudioBlocked(true);
      const retry = () => {
        if (!active) return;
        audio.play().then(() => setAudioBlocked(false)).catch(() => {});
      };
    });
  }, [active, soundUrl, soundVolume]);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => {
      setActive(false);
      onDone?.();
    }, 4050);
    return () => {
      clearTimeout(timer);
    };
  }, [active, onDone]);

  if (!active) return null;

  return (
    <div style={introWrap(audioBlocked)}>
      <style>{introStyle}</style>
      <div className="intro-panel" />
      <div style={introBackdrop()} />
      <div style={logoStage()}>
        <div style={logoClip()}>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo"
              style={{
                width: `${Math.max(160, 240 * logoZoom)}px`,
                height: "auto",
                display: "block",
                filter: "invert(1) brightness(1.1) drop-shadow(0 20px 40px rgba(0,0,0,0.55))",
              }}
            />
          ) : (
            <img
              src="https://newushu.com/uploads/1/1/1/3/111378341/newushu-black-transparent-2.png"
              alt="Logo"
              style={{
                width: `${Math.max(160, 240 * logoZoom)}px`,
                height: "auto",
                display: "block",
                filter: "invert(1) brightness(1.1) drop-shadow(0 20px 40px rgba(0,0,0,0.55))",
              }}
            />
          )}
          <div style={revealLeft()} />
          <div style={revealRight()} />
        </div>
        <div style={introTitlePrimary()}>Lead &amp; Achieve</div>
        <div style={introTitleSecondary()}>Level Up</div>
      </div>
      {audioBlocked ? (
        <button
          type="button"
          onClick={() => {
            if (!audioRef.current) return;
            audioRef.current.play().then(() => setAudioBlocked(false)).catch(() => {});
          }}
          style={audioEnableButton()}
        >
          Tap to Enable Audio
        </button>
      ) : null}
    </div>
  );
}

function WelcomeScreen({ onEnter }: { onEnter: () => void }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoZoom, setLogoZoom] = useState(1);
  const [name, setName] = useState<string>("Welcome");
  const [role, setRole] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await fetch("/api/public/nav-logo", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!mounted) return;
      if (data?.logo_url) setLogoUrl(String(data.logo_url));
      if (data?.logo_zoom) setLogoZoom(Number(data.logo_zoom ?? 1));
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await fetch("/api/account/profile", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!mounted) return;
      if (!data?.ok) return;
      setRole(String(data?.role ?? ""));
      const display = String(data?.display_name ?? "").trim();
      if (display) setName(display);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div style={welcomeWrap()}>
      <div style={welcomeBackdrop()} />
      <div style={welcomeCard()}>
        <img
          src={logoUrl ?? "https://newushu.com/uploads/1/1/1/3/111378341/newushu-black-transparent-2.png"}
          alt="Logo"
          style={{
            width: Math.max(140, 240 * logoZoom),
            height: "auto",
            objectFit: "contain",
            filter: "invert(1) brightness(1.1)",
          }}
        />
        <div style={welcomeTitle()}>Welcome{role === "student" ? "," : ""}</div>
        <div style={welcomeName()}>{name}</div>
        <button type="button" onClick={onEnter} style={enterButton()}>
          Enter the App
        </button>
      </div>
    </div>
  );
}

function welcomeWrap(): React.CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    zIndex: 9998,
    display: "grid",
    placeItems: "center",
    background: "rgba(2,6,23,0.88)",
  };
}

function welcomeBackdrop(): React.CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(circle at 50% 30%, rgba(59,130,246,0.25), transparent 55%), radial-gradient(circle at 20% 80%, rgba(248,113,113,0.2), transparent 55%)",
  };
}

function welcomeCard(): React.CSSProperties {
  return {
    position: "relative",
    zIndex: 2,
    display: "grid",
    gap: 10,
    placeItems: "center",
    padding: "30px 28px",
    borderRadius: 28,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(2,6,23,0.65)",
    boxShadow: "0 24px 70px rgba(0,0,0,0.55)",
    minWidth: "min(520px, 90vw)",
  };
}

function welcomeTitle(): React.CSSProperties {
  return {
    fontSize: 26,
    fontWeight: 900,
    letterSpacing: 2,
    color: "rgba(255,255,255,0.8)",
    textTransform: "uppercase",
  };
}

function welcomeName(): React.CSSProperties {
  return {
    fontFamily: "\"Bebas Neue\", \"Impact\", sans-serif",
    fontSize: 48,
    letterSpacing: 3,
    color: "white",
    textShadow: "0 12px 30px rgba(0,0,0,0.7)",
  };
}

function enterButton(): React.CSSProperties {
  return {
    marginTop: 8,
    padding: "12px 22px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.3)",
    background: "linear-gradient(120deg, rgba(59,130,246,0.9), rgba(248,113,113,0.9))",
    color: "white",
    fontWeight: 900,
    letterSpacing: 1,
    cursor: "pointer",
  };
}

function introWrap(audioBlocked = false): React.CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    display: "grid",
    placeItems: "center",
    background: "rgba(2,6,23,0.85)",
    animation: "introFade 4.05s ease forwards",
    pointerEvents: audioBlocked ? "auto" : "none",
    overflow: "hidden",
  };
}

function introBackdrop(): React.CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(circle at 50% 40%, rgba(248,113,113,0.15), transparent 60%), radial-gradient(circle at 20% 20%, rgba(59,130,246,0.2), transparent 55%)",
    opacity: 0.8,
  };
}

function logoStage(): React.CSSProperties {
  return {
    position: "relative",
    zIndex: 2,
    display: "grid",
    placeItems: "center",
    gap: 16,
  };
}

function logoClip(): React.CSSProperties {
  return {
    position: "relative",
    overflow: "hidden",
    padding: "20px 0",
  };
}

function revealLeft(): React.CSSProperties {
  return {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "50%",
    background: "rgba(2,6,23,0.95)",
    animation: "introRevealLeft 1.8s ease forwards",
  };
}

function revealRight(): React.CSSProperties {
  return {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: "50%",
    background: "rgba(2,6,23,0.95)",
    animation: "introRevealRight 1.8s ease forwards",
  };
}

function logoFallback(): React.CSSProperties {
  return {
    fontSize: 48,
    fontWeight: 900,
    letterSpacing: 6,
    color: "white",
  };
}

function introTitlePrimary(): React.CSSProperties {
  return {
    fontFamily: "\"Bebas Neue\", \"Impact\", sans-serif",
    fontSize: 46,
    letterSpacing: 4,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.96)",
    textShadow: "0 12px 30px rgba(0,0,0,0.65)",
  };
}

function introTitleSecondary(): React.CSSProperties {
  return {
    fontFamily: "\"Bebas Neue\", \"Impact\", sans-serif",
    fontSize: 30,
    letterSpacing: 4,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.92)",
    textShadow: "0 10px 30px rgba(0,0,0,0.6)",
  };
}

function audioEnableButton(): React.CSSProperties {
  return {
    position: "absolute",
    bottom: "8%",
    padding: "12px 22px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.3)",
    background: "rgba(15,23,42,0.85)",
    color: "white",
    fontWeight: 900,
    letterSpacing: 1,
    cursor: "pointer",
  };
}

const introStyle = `
.intro-panel{
  position:absolute;
  width: 220vmax;
  height: 220vmax;
  border-radius: 30%;
  background:
    linear-gradient(135deg, rgba(59,130,246,0.22), rgba(248,113,113,0.22)),
    repeating-linear-gradient(90deg, rgba(255,255,255,0.08) 0 12px, rgba(2,6,23,0.85) 12px 24px);
  animation: introPanel 3.8s ease forwards;
  transform: scale(0.1);
  opacity: 0.9;
  mix-blend-mode: screen;
}
@keyframes introRevealLeft {
  0% { transform: translateX(0); }
  100% { transform: translateX(-100%); }
}
@keyframes introRevealRight {
  0% { transform: translateX(0); }
  100% { transform: translateX(100%); }
}
@keyframes introFade {
  0% { opacity: 1; }
  75% { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes introPanel{
  0%{ transform: scale(0.05) rotate(6deg); opacity:0; }
  25%{ opacity:1; }
  70%{ transform: scale(1) rotate(0deg); opacity:0.9; }
  100%{ transform: scale(1.2) rotate(-6deg); opacity:0; }
}
`;

function LeaderboardPanel({
  title,
  accent,
  rows,
  onRowClick,
  maxCount = 10,
  effectConfigByKey,
}: {
  title: string;
  accent: string;
  rows: LeaderboardEntry[];
  onRowClick?: (row: LeaderboardEntry) => void;
  maxCount?: number;
  effectConfigByKey: Record<string, { config?: any }>;
}) {
  return (
    <div style={{ ...leaderboardPanel(), background: accent }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <div style={{ fontWeight: 1000 }}>{title}</div>
        <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 900 }}>Top {maxCount}</div>
      </div>
      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
        {rows.slice(0, maxCount).map((r, i) => {
          return (
            <div
              key={r.student_id}
              style={{ ...leaderboardRow(r.is_competition_team), cursor: onRowClick ? "pointer" : "default" }}
              onClick={() => onRowClick?.(r)}
            >
              <div style={rankBadge(i + 1)}>{i + 1}</div>
              <div style={avatarBadge(r.avatar_bg ?? "rgba(255,255,255,0.12)")}>
                <AvatarEffectParticles
                  effectKey={r.avatar_effect ?? null}
                  config={effectConfigByKey[r.avatar_effect ?? ""]?.config}
                />
                {r.avatar_storage_path ? (
                  <img
                    src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${r.avatar_storage_path}`}
                    alt={r.name}
                    style={{ width: "100%", height: "100%", objectFit: "contain", position: "relative", zIndex: 1 }}
                  />
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 900 }}>{r.name.slice(0, 1)}</span>
                )}
              </div>
              <div style={{ display: "grid", gap: 2 }}>
                <div style={{ fontWeight: 900 }}>{r.name}</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>Lv {r.level}</div>
              </div>
              <div style={{ marginLeft: "auto", fontWeight: 1000 }}>{r.points}</div>
            </div>
          );
        })}
        {!rows.length && <div style={{ opacity: 0.7, fontSize: 12 }}>No leaderboard data yet.</div>}
      </div>
    </div>
  );
}

function card(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: 14,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 14px 50px rgba(0,0,0,0.25)",
  };
}

function errorBox(): React.CSSProperties {
  return {
    padding: 10,
    borderRadius: 14,
    background: "rgba(239,68,68,0.15)",
    border: "1px solid rgba(255,255,255,0.10)",
  };
}

function leaderboardPanel(): React.CSSProperties {
  return {
    borderRadius: 20,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 16px 50px rgba(0,0,0,0.35)",
    backdropFilter: "blur(6px)",
  };
}

function pulseOverlay(): React.CSSProperties {
  return {
    position: "fixed",
    right: 24,
    bottom: 24,
    width: 260,
    borderRadius: 14,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(2,6,23,0.9)",
    boxShadow: "0 14px 40px rgba(0,0,0,0.45)",
    color: "white",
    zIndex: 9998,
  };
}

function homeShell(): React.CSSProperties {
  return {
    display: "grid",
    gap: 18,
    gridTemplateColumns: "minmax(0, 1fr)",
    alignItems: "start",
    maxWidth: 1680,
    margin: "0 auto",
  };
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function leaderboardRow(isComp: boolean): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "26px 36px 1fr auto",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    borderRadius: 14,
    border: isComp ? "1px solid rgba(59,130,246,0.55)" : "1px solid rgba(255,255,255,0.12)",
    background: isComp ? "rgba(59,130,246,0.15)" : "rgba(15,23,42,0.5)",
    boxShadow: isComp ? "0 0 18px rgba(59,130,246,0.2)" : "inset 0 1px 0 rgba(255,255,255,0.05)",
  };
}

function rankBadge(rank: number): React.CSSProperties {
  const tone =
    rank === 1
      ? "rgba(250,204,21,0.85)"
      : rank === 2
      ? "rgba(148,163,184,0.85)"
      : rank === 3
      ? "rgba(251,146,60,0.85)"
      : "rgba(255,255,255,0.16)";
  return {
    width: 26,
    height: 26,
    borderRadius: 10,
    background: tone,
    display: "grid",
    placeItems: "center",
    color: rank <= 3 ? "#0b1220" : "white",
    fontWeight: 1000,
    fontSize: 12,
  };
}

function avatarBadge(bg: string): React.CSSProperties {
  return {
    width: 34,
    height: 34,
    borderRadius: 12,
    background: bg,
    border: "1px solid rgba(255,255,255,0.18)",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    position: "relative",
  };
}

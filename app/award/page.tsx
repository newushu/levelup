"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ChallengeVaultPanel from "@/components/ChallengeVaultPanel";
import AvatarRender from "@/components/AvatarRender";

type AwardType = { id: string; name: string; points?: number | null; enabled?: boolean | null };
type StudentRow = {
  id: string;
  name: string;
  level?: number | null;
  points_total?: number | null;
  points_balance?: number | null;
  avatar_storage_path?: string | null;
  avatar_zoom_pct?: number | null;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 180)}` } };
  }
}

const tabs = ["Challenge Vault", "Skill Tree", "Award Points"] as const;

export default function AwardPage() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Challenge Vault");
  const [awardTypes, setAwardTypes] = useState<AwardType[]>([]);
  const [studentId, setStudentId] = useState("");
  const [classId, setClassId] = useState("");
  const [msg, setMsg] = useState("");
  const [tierDefaults, setTierDefaults] = useState<Record<string, number>>({});
  const [activeStudentId, setActiveStudentId] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [medalCounts, setMedalCounts] = useState<Record<string, number>>({});
  const [medalIcons, setMedalIcons] = useState<Record<string, string | null>>({});
  const [flashTier, setFlashTier] = useState<string | null>(null);
  const [recentAwardPoints, setRecentAwardPoints] = useState<number | null>(null);
  const medalCountsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem("active_student_id") || "";
      setStudentId(saved);
      setActiveStudentId(saved);
      const classSaved = localStorage.getItem("coach_dashboard_lock_class") || "";
      setClassId(classSaved);
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      const sRes = await fetch("/api/students/list", { cache: "no-store" });
      const sJson = await safeJson(sRes);
      if (sJson.ok) setStudents((sJson.json?.students ?? []) as StudentRow[]);
      const res = await fetch("/api/awards/types", { cache: "no-store" });
      const sj = await safeJson(res);
      if (sj.ok) setAwardTypes((sj.json?.types ?? []) as AwardType[]);
      const mRes = await fetch("/api/challenges/medals", { cache: "no-store" });
      const mJson = await safeJson(mRes);
      if (mJson.ok) setMedalIcons((mJson.json?.medals ?? {}) as Record<string, string | null>);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/challenges/tier-defaults", { cache: "no-store" });
      const sj = await safeJson(res);
      if (sj.ok) setTierDefaults((sj.json?.defaults ?? {}) as Record<string, number>);
    })();
  }, []);

  useEffect(() => {
    const handleChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id?: string };
      if (!detail?.id) return;
      setActiveStudentId(detail.id);
      setStudentId(detail.id);
    };
    window.addEventListener("active-student-change", handleChange as EventListener);
    return () => window.removeEventListener("active-student-change", handleChange as EventListener);
  }, []);

  async function refreshMedalCounts(targetStudentId: string) {
    if (!targetStudentId) return;
    const res = await fetch("/api/students/challenges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: targetStudentId }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return;
    const rows = (sj.json?.rows ?? []) as Array<{ challenge_id: string; completed?: boolean | null; tier?: string | null }>;
    const counts: Record<string, number> = {};
    rows.filter((r) => r.completed).forEach((r) => {
      const key = String(r.tier ?? "bronze").toLowerCase();
      counts[key] = (counts[key] ?? 0) + 1;
    });
    setMedalCounts(counts);
  }

  useEffect(() => {
    if (!activeStudentId) {
      setMedalCounts({});
      return;
    }
    refreshMedalCounts(activeStudentId);
  }, [activeStudentId]);

  useEffect(() => {
    const onChallengeUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail as { studentId?: string; points?: number; tier?: string } | undefined;
      const target = detail?.studentId || activeStudentId;
      if (!target || (detail?.studentId && detail.studentId !== activeStudentId)) return;
      refreshMedalCounts(target);
      if (detail?.tier) setFlashTier(detail.tier);
      if (Number(detail?.points ?? 0) > 0) setRecentAwardPoints(Number(detail?.points));
    };
    window.addEventListener("student-challenges-updated", onChallengeUpdate as EventListener);
    return () => window.removeEventListener("student-challenges-updated", onChallengeUpdate as EventListener);
  }, [activeStudentId]);

  useEffect(() => {
    const prev = medalCountsRef.current;
    let increasedTier: string | null = null;
    Object.entries(medalCounts).forEach(([tier, count]) => {
      if ((prev[tier] ?? 0) < count && !increasedTier) increasedTier = tier;
    });
    medalCountsRef.current = medalCounts;
    if (increasedTier) setFlashTier(increasedTier);
  }, [medalCounts]);

  useEffect(() => {
    if (!flashTier) return;
    const t = window.setTimeout(() => setFlashTier(null), 1400);
    return () => window.clearTimeout(t);
  }, [flashTier]);

  useEffect(() => {
    if (recentAwardPoints === null) return;
    const t = window.setTimeout(() => setRecentAwardPoints(null), 2400);
    return () => window.clearTimeout(t);
  }, [recentAwardPoints]);

  const activeStudent = useMemo(() => students.find((s) => s.id === activeStudentId) ?? null, [students, activeStudentId]);
  const avatarSrc = useMemo(() => {
    const path = String(activeStudent?.avatar_storage_path ?? "").trim();
    if (!path) return "";
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return base ? `${base}/storage/v1/object/public/avatars/${path}` : "";
  }, [activeStudent?.avatar_storage_path]);
  const avatarZoom = Math.max(50, Math.min(140, Number(activeStudent?.avatar_zoom_pct ?? 100)));

  const ruleKeeper = awardTypes.find((t) => t.name?.toLowerCase().includes("rule keeper"));
  const ruleBreaker = awardTypes.find((t) => t.name?.toLowerCase().includes("rule breaker"));
  const quickTypes = awardTypes.filter((t) => t.enabled !== false);

  async function award(awardTypeId: string) {
    if (!studentId || !classId) {
      return setMsg("Student ID and Class ID required.");
    }
    const res = await fetch("/api/awards/award", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId, class_id: classId, award_type_id: awardTypeId }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to award points");
    setMsg(`Awarded ${sj.json?.points_awarded ?? 0} pts.`);
  }

  return (
    <main className="award-page">
      <style>{styles()}</style>
      <div className="award-mini-nav">
        <button onClick={() => (window.location.href = "/dashboard")}>Dashboard</button>
        <button onClick={() => (window.location.href = "/student")}>Student</button>
        <button onClick={() => (window.location.href = "/challenges")}>Challenges</button>
        <button onClick={() => (window.location.href = "/award")}>Award</button>
        <button onClick={() => (window.location.href = "/admin")}>Admin</button>
      </div>

      <div className="award-summary">
        <div className="award-summary__student">
          <AvatarRender
            size={88}
            bg="rgba(15,23,42,0.6)"
            avatarSrc={avatarSrc}
            avatarZoomPct={avatarZoom}
            showImageBorder={false}
            style={{ borderRadius: 16 }}
            fallback={<div className="award-summary__fallback">{activeStudent?.name?.slice(0, 2)?.toUpperCase() ?? "ST"}</div>}
          />
          <div>
            <div className="award-summary__name">
              <span>{activeStudent?.name ?? "Select a student"}</span>
              {recentAwardPoints !== null ? (
                <span className="award-points-chip">+{recentAwardPoints} pts</span>
              ) : null}
            </div>
            <div className="award-summary__meta">
              Level {activeStudent?.level ?? 1} • {Number(activeStudent?.points_balance ?? activeStudent?.points_total ?? 0).toLocaleString()} pts
            </div>
          </div>
        </div>
        <div className="award-summary__medals">
          {["bronze", "silver", "gold", "platinum", "diamond", "master"].map((tier) => (
            <div key={tier} className={`award-medal${flashTier === tier ? " award-medal--flash" : ""}`}>
              {medalIcons[tier] ? <img src={medalIcons[tier] ?? ""} alt={tier} /> : <div className="award-medal__empty" />}
              <div className="award-medal__tier">{tier}</div>
              <div className="award-medal__count">{medalCounts[tier] ?? 0}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="award-tabs">
        {tabs.map((t) => (
          <button key={t} className={`award-tab ${tab === t ? "award-tab--active" : ""}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Challenge Vault" ? (
        <section className="award-panel">
          <div className="award-card">
            <div className="award-card__title">Tier Default Points</div>
            <div className="award-grid">
              {Object.entries(tierDefaults).map(([tier, points]) => (
                <label key={tier} className="award-label">
                  {tier}
                  <input
                    type="number"
                    value={points}
                    onChange={(e) => setTierDefaults((prev) => ({ ...prev, [tier]: Number(e.target.value) }))}
                  />
                </label>
              ))}
            </div>
            <button
              className="award-btn"
              onClick={async () => {
                const res = await fetch("/api/admin/challenges/tier-defaults", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ defaults: tierDefaults }),
                });
                const sj = await safeJson(res);
                if (!sj.ok) setMsg(sj.json?.error || "Failed to save defaults");
                else setMsg("Tier defaults saved.");
              }}
            >
              Save Defaults
            </button>
          </div>
          <ChallengeVaultPanel title="Challenge Vault" requireStudent />
        </section>
      ) : null}

      {tab === "Skill Tree" ? (
        <section className="award-panel">
          <div className="award-card">
            <div className="award-card__title">Skill Tree</div>
            <div className="award-card__body">Open the full skill tree in a new tab.</div>
            <button className="award-btn" onClick={() => window.open("/skills", "_blank")}>Open Skill Tree</button>
          </div>
        </section>
      ) : null}

      {tab === "Award Points" ? (
        <section className="award-panel">
          <div className="award-card">
            <div className="award-card__title">Quick Points</div>
            <div className="award-form">
              <label>
                Student ID
                <input value={studentId} onChange={(e) => setStudentId(e.target.value)} />
              </label>
              <label>
                Class ID
                <input value={classId} onChange={(e) => setClassId(e.target.value)} />
              </label>
            </div>
            <div className="award-buttons">
              {ruleKeeper ? (
                <button className="award-btn" onClick={() => award(ruleKeeper.id)}>
                  Rule Keeper {ruleKeeper.points ? `(+${ruleKeeper.points})` : ""}
                </button>
              ) : null}
              {ruleBreaker ? (
                <button className="award-btn" onClick={() => award(ruleBreaker.id)}>
                  Rule Breaker {ruleBreaker.points ? `(+${ruleBreaker.points})` : ""}
                </button>
              ) : null}
              {quickTypes.map((t) => (
                <button key={t.id} className="award-btn award-btn--ghost" onClick={() => award(t.id)}>
                  {t.name} {t.points ? `(+${t.points})` : ""}
                </button>
              ))}
            </div>
            {msg ? <div className="award-msg">{msg}</div> : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function styles() {
  return `
    .award-page {
      padding: 24px 32px 60px;
      display: grid;
      gap: 16px;
      width: 100%;
    }
    .award-mini-nav {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .award-mini-nav button {
      padding: 8px 12px;
      border-radius: 12px;
      border: 1px solid rgba(148,163,184,0.25);
      background: rgba(15,23,42,0.7);
      color: white;
      font-weight: 900;
      cursor: pointer;
    }
    .award-summary {
      display: grid;
      gap: 16px;
      grid-template-columns: minmax(260px, 360px) 1fr;
      padding: 16px;
      border-radius: 18px;
      background: rgba(15,23,42,0.85);
      border: 1px solid rgba(148,163,184,0.2);
      align-items: center;
    }
    .award-summary__student {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 12px;
      align-items: center;
    }
    .award-summary__name {
      font-size: 18px;
      font-weight: 1000;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .award-summary__meta {
      font-size: 12px;
      opacity: 0.8;
      font-weight: 900;
    }
    .award-summary__medals {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 12px;
    }
    .award-medal {
      padding: 10px;
      border-radius: 14px;
      border: 1px solid rgba(148,163,184,0.18);
      background: rgba(2,6,23,0.6);
      display: grid;
      place-items: center;
      gap: 6px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      font-weight: 900;
      font-size: 11px;
    }
    .award-medal--flash {
      animation: medalFlash 1.4s ease-in-out;
      border-color: rgba(253,224,71,0.8);
      box-shadow: 0 0 18px rgba(253,224,71,0.5), 0 0 32px rgba(248,250,252,0.2);
    }
    .award-medal img {
      width: 40px;
      height: 40px;
      object-fit: contain;
    }
    .award-medal__count {
      font-size: 18px;
      font-weight: 1000;
    }
    .award-medal__empty {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: rgba(148,163,184,0.2);
    }
    .award-points-chip {
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 1000;
      letter-spacing: 0.6px;
      background: rgba(34,197,94,0.2);
      border: 1px solid rgba(34,197,94,0.6);
      color: #bbf7d0;
      text-transform: uppercase;
      animation: pointsPop 0.9s ease-out;
      box-shadow: 0 0 12px rgba(34,197,94,0.35);
    }
    .award-summary__fallback {
      width: 88px;
      height: 88px;
      border-radius: 16px;
      display: grid;
      place-items: center;
      font-weight: 900;
      font-size: 28px;
      background: rgba(30,41,59,0.8);
    }
    .award-tabs {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: flex-end;
      border-bottom: 1px solid rgba(148,163,184,0.25);
      padding-bottom: 6px;
    }
    .award-tab {
      padding: 10px 16px;
      border-radius: 14px 14px 0 0;
      border: 1px solid rgba(148,163,184,0.25);
      background: rgba(15,23,42,0.5);
      color: white;
      font-weight: 900;
      letter-spacing: 0.6px;
      cursor: pointer;
      position: relative;
      top: 2px;
    }
    .award-tab--active {
      background: rgba(15,23,42,0.98);
      border-bottom-color: rgba(15,23,42,0.98);
      top: 0;
      box-shadow: 0 -4px 12px rgba(0,0,0,0.35);
    }
    .award-panel {
      display: grid;
      gap: 16px;
    }
    .award-card {
      padding: 18px;
      border-radius: 20px;
      background: rgba(15,23,42,0.9);
      border: 1px solid rgba(148,163,184,0.18);
      display: grid;
      gap: 12px;
    }
    .award-card__title {
      font-size: 16px;
      font-weight: 1000;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }
    .award-grid {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    }
    .award-label {
      display: grid;
      gap: 6px;
      font-size: 12px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      opacity: 0.8;
    }
    .award-label input {
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid rgba(148,163,184,0.2);
      background: rgba(2,6,23,0.8);
      color: white;
      font-weight: 800;
      font-size: 14px;
    }
    .award-card__body {
      font-size: 13px;
      opacity: 0.75;
    }
    .award-form {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    }
    .award-form label {
      display: grid;
      gap: 6px;
      font-size: 12px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      opacity: 0.8;
    }
    .award-form input {
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid rgba(148,163,184,0.2);
      background: rgba(2,6,23,0.8);
      color: white;
      font-weight: 800;
      font-size: 14px;
    }
    .award-buttons {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .award-btn {
      padding: 10px 14px;
      border-radius: 12px;
      border: 1px solid rgba(56,189,248,0.4);
      background: rgba(56,189,248,0.18);
      color: white;
      font-weight: 900;
      cursor: pointer;
    }
    .award-btn--ghost {
      border-color: rgba(148,163,184,0.3);
      background: rgba(30,41,59,0.6);
    }
    .award-msg {
      font-size: 12px;
      font-weight: 900;
      opacity: 0.8;
    }
    @keyframes medalFlash {
      0% { transform: scale(1); box-shadow: 0 0 0 rgba(253,224,71,0); }
      30% { transform: scale(1.03); box-shadow: 0 0 22px rgba(253,224,71,0.6); }
      70% { transform: scale(1.01); box-shadow: 0 0 18px rgba(253,224,71,0.4); }
      100% { transform: scale(1); box-shadow: 0 0 0 rgba(253,224,71,0); }
    }
    @keyframes pointsPop {
      0% { transform: translateY(2px) scale(0.9); opacity: 0; }
      40% { transform: translateY(0) scale(1.05); opacity: 1; }
      100% { transform: translateY(0) scale(1); opacity: 1; }
    }
  `;
}

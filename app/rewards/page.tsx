"use client";

import { useEffect, useMemo, useState } from "react";
import { playGlobalSfx, setGlobalSounds } from "@/lib/globalAudio";
import { usePathname, useSearchParams } from "next/navigation";
import StudentTopBar from "@/components/StudentTopBar";
import CriticalNoticeBar from "@/components/CriticalNoticeBar";
import { fireFx } from "../../components/GlobalFx";
import StudentNavPanel, { studentNavStyles } from "@/components/StudentNavPanel";
import StudentWorkspaceTopBar, { studentWorkspaceTopBarStyles } from "@/components/StudentWorkspaceTopBar";

type StudentRow = {
  id: string;
  name: string;
  level: number;
  points_total: number;
  points_balance?: number | null;
  avatar_storage_path?: string | null;
  avatar_zoom_pct?: number | null;
  is_competition_team: boolean;
};

type RewardRow = {
  id: string;
  name: string;
  cost: number;
  category?: string | null;
  icon?: string | null;
  enabled?: boolean | null;
};

type RedeemCounts = Record<string, number>;

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 180)}` } };
  }
}

export default function RewardsPage() {
  const pathname = usePathname();
  const params = useSearchParams();
  const isEmbed = params.get("embed") === "1";
  const requestOnly = params.get("requestOnly") === "1" || pathname === "/student/rewards";
  const inStudentWorkspace = pathname.startsWith("/student/");
  const [msg, setMsg] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [studentId, setStudentId] = useState<string>("");
  const [viewerRole, setViewerRole] = useState("coach");
  const [viewerStudentId, setViewerStudentId] = useState<string>("");
  const [category, setCategory] = useState("All");
  const [rewards, setRewards] = useState<RewardRow[]>([]);
  const [redeemCounts, setRedeemCounts] = useState<RedeemCounts>({});
  const [pendingCounts, setPendingCounts] = useState<RedeemCounts>({});
  const [mvpBadgeUrl, setMvpBadgeUrl] = useState<string | null>(null);
  const [requestToast, setRequestToast] = useState<{ open: boolean; label: string }>({ open: false, label: "" });

  const activeStudent = useMemo(
    () => students.find((s) => s.id === studentId) ?? null,
    [students, studentId]
  );

  async function refreshStudents(preserveSelected = true) {
    const r = await fetch("/api/students/list", { cache: "no-store" });
    const sj = await safeJson(r);
    if (!sj.ok) {
      setMsg(sj.json?.error || "Failed to load students");
      return;
    }
    const list = (sj.json?.students ?? []) as StudentRow[];
    setStudents(list);

    if (!preserveSelected) return;

    if (viewerRole === "student" && viewerStudentId) {
      setStudentId(viewerStudentId);
      return;
    }

    const saved = (() => {
      try {
        return localStorage.getItem("active_student_id") || "";
      } catch {
        return "";
      }
    })();

    setStudentId((prev) => {
      if (prev && list.some((s) => s.id === prev)) return prev;
      if (saved && list.some((s) => s.id === saved)) return saved;
      return list[0]?.id || "";
    });
  }

  async function refreshRedeems(sid: string) {
    const res = await fetch("/api/rewards/redemptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: sid }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return;
    setRedeemCounts((sj.json?.counts ?? {}) as RedeemCounts);
    setPendingCounts((sj.json?.pending ?? {}) as RedeemCounts);
  }

  useEffect(() => {
    refreshStudents(true);
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (data?.ok) {
        setViewerRole(String(data.role ?? "coach"));
        setViewerStudentId(String(data.student_id ?? ""));
      }
    })();
  }, []);

  useEffect(() => {
    if (viewerRole === "student" && viewerStudentId) {
      setStudentId(viewerStudentId);
    }
  }, [viewerRole, viewerStudentId]);

  useEffect(() => {
    (async () => {
      const sfxRes = await fetch("/api/sound-effects/list", { cache: "no-store" });
      const sfxJson = await safeJson(sfxRes);
      if (sfxJson.ok) {
        const map: Record<string, { url: string; volume: number }> = {};
        (sfxJson.json?.effects ?? []).forEach((row: any) => {
          const key = String(row?.key ?? "");
          const url = String(row?.audio_url ?? "");
          if (!key || !url) return;
          map[key] = { url, volume: Math.min(1, Math.max(0, Number(row?.volume ?? 1))) };
        });
        setGlobalSounds(map);
      }
      const r = await fetch("/api/rewards/list", { cache: "no-store" });
      const sj = await safeJson(r);
      if (!sj.ok) return setMsg(sj.json?.error || "Failed to load rewards");
      setRewards((sj.json?.rewards ?? []) as RewardRow[]);

      const badgeRes = await fetch("/api/student/mvp-badge", { cache: "no-store" });
      const badgeData = await safeJson(badgeRes);
      if (badgeData.ok) setMvpBadgeUrl(String(badgeData.json?.badge_url ?? "") || null);
    })();
  }, []);

  useEffect(() => {
    if (!studentId) return;
    if (viewerRole !== "student") {
      try {
        localStorage.setItem("active_student_id", studentId);
      } catch {}
    }
    refreshRedeems(studentId);
  }, [studentId]);

  async function addOrRemovePoints(delta: number) {
    if (!studentId) return;
    if (viewerRole === "student") return setMsg("Student accounts cannot add points.");
    setMsg("");

    const res = await fetch("/api/ledger/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id: studentId,
        points: delta,
        note: `Rewards quick ${delta > 0 ? "+" : ""}${delta}`,
        category: "manual",
      }),
    });

    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to update points");

    fireFx(delta > 0 ? "add" : "remove");
    if (delta > 0) playGlobalSfx("points_add");
    await refreshStudents(true);
  }

  async function doRedeem(rewardId: string, name: string, cost: number) {
    if (!studentId) return;
    setMsg("");

    const res = await fetch("/api/rewards/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId, reward_id: rewardId }),
    });

    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to redeem");

    fireFx("redeem", `${name} (-${cost} pts)`);
    await refreshStudents(true);
    await refreshRedeems(studentId);
    setMsg(`${name} redeemed`);
  }

  async function requestHold(rewardId: string, name: string) {
    if (!studentId) return;
    setMsg("");
    const res = await fetch("/api/rewards/redeem-hold", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reward_id: rewardId, student_id: studentId }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to request hold");
    fireFx("remove");
    await refreshStudents(true);
    await refreshRedeems(studentId);
    setRequestToast({ open: true, label: name });
    setTimeout(() => setRequestToast((prev) => ({ ...prev, open: false })), 2200);
    setMsg(`${name} requested`);
  }

  const student = useMemo(() => students.find((s) => s.id === studentId) ?? null, [students, studentId]);
  const total = Number(student?.points_total ?? 0);
  const isStudentView = viewerRole === "student" || requestOnly;

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const r of rewards) set.add(r.category ?? "Other");
    return ["All", ...Array.from(set).sort()];
  }, [rewards]);

  const filtered = useMemo(() => {
    const list = rewards.filter((r) => r.enabled !== false);
    if (category === "All") return list;
    return list.filter((r) => (r.category ?? "Other") === category);
  }, [category, rewards]);

  function clearSelectedStudent() {
    setStudentId("");
    try {
      localStorage.removeItem("active_student_id");
    } catch {}
  }

  return (
    <main className="student-rewards">
      {!inStudentWorkspace ? <style>{studentNavStyles()}</style> : null}
      <style>{studentWorkspaceTopBarStyles()}</style>
      <style>{`
        .student-rewards {
          padding: 20px 20px 54px 252px;
          position: relative;
        }
        .prize-vault {
          margin-top: 12px;
          border-radius: 28px;
          padding: 16px;
          border: 1px solid rgba(56,189,248,0.34);
          background:
            radial-gradient(circle at 10% 15%, rgba(56,189,248,0.16), rgba(15,23,42,0) 36%),
            radial-gradient(circle at 90% 5%, rgba(251,191,36,0.18), rgba(15,23,42,0) 42%),
            linear-gradient(160deg, rgba(9,13,24,0.95), rgba(4,10,20,0.96));
          box-shadow: 0 22px 50px rgba(0,0,0,0.38), inset 0 0 0 1px rgba(255,255,255,0.05);
          position: relative;
          overflow: hidden;
        }
        .prize-vault::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image: radial-gradient(rgba(255,255,255,0.15) 1.1px, transparent 1.1px);
          background-size: 22px 22px;
          opacity: 0.2;
          pointer-events: none;
          animation: prizeDrift 20s linear infinite;
        }
        .prize-vault::after {
          content: "";
          position: absolute;
          inset: 1px;
          border-radius: 26px;
          border: 1px solid rgba(148,163,184,0.2);
          pointer-events: none;
        }
        .prize-vault__grid {
          margin-top: 14px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 14px;
          position: relative;
          z-index: 1;
        }
        .reward-card {
          position: relative;
          overflow: hidden;
        }
        .reward-card::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, rgba(56,189,248,0.1), rgba(255,255,255,0) 35%);
          pointer-events: none;
        }
        @keyframes prizeDrift {
          from { transform: translate3d(0,0,0); }
          to { transform: translate3d(24px, -18px, 0); }
        }
        .request-toast {
          position: fixed;
          top: 18px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 240;
          min-width: min(520px, calc(100vw - 24px));
          border-radius: 20px;
          padding: 14px 18px;
          border: 1px solid rgba(255,255,255,0.35);
          background:
            radial-gradient(circle at 15% 20%, rgba(250,204,21,0.45), rgba(255,255,255,0) 40%),
            radial-gradient(circle at 85% 5%, rgba(34,211,238,0.35), rgba(255,255,255,0) 38%),
            linear-gradient(135deg, rgba(16,185,129,0.72), rgba(59,130,246,0.72), rgba(236,72,153,0.72));
          box-shadow: 0 20px 44px rgba(0,0,0,0.36), inset 0 0 0 1px rgba(255,255,255,0.18);
          color: white;
          text-align: center;
          font-weight: 1000;
          letter-spacing: 0.35px;
          overflow: hidden;
          animation: requestToastIn 220ms ease, requestToastPulse 1.4s ease-in-out infinite;
        }
        .request-toast::before {
          content: "";
          position: absolute;
          inset: -20% 0;
          background: linear-gradient(110deg, rgba(255,255,255,0), rgba(255,255,255,0.42), rgba(255,255,255,0));
          transform: translateX(-120%);
          animation: requestShine 1.4s ease-in-out infinite;
          pointer-events: none;
        }
        .request-toast::after {
          content: "✦ ✧ ✦";
          position: absolute;
          right: 12px;
          top: 6px;
          font-size: 14px;
          opacity: 0.85;
          text-shadow: 0 0 14px rgba(255,255,255,0.8);
          animation: requestSparkle 1.2s ease-in-out infinite;
        }
        .request-toast__sub {
          margin-top: 4px;
          font-size: 12px;
          opacity: 0.9;
          font-weight: 900;
        }
        @keyframes requestToastIn {
          from { transform: translateX(-50%) translateY(-12px) scale(0.96); opacity: 0; }
          to { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
        }
        @keyframes requestToastPulse {
          0% { box-shadow: 0 20px 44px rgba(0,0,0,0.36), 0 0 0 rgba(255,255,255,0); }
          50% { box-shadow: 0 24px 48px rgba(0,0,0,0.42), 0 0 26px rgba(255,255,255,0.28); }
          100% { box-shadow: 0 20px 44px rgba(0,0,0,0.36), 0 0 0 rgba(255,255,255,0); }
        }
        @keyframes requestShine {
          0% { transform: translateX(-120%); }
          65% { transform: translateX(125%); }
          100% { transform: translateX(125%); }
        }
        @keyframes requestSparkle {
          0% { transform: scale(1) rotate(0deg); opacity: 0.7; }
          50% { transform: scale(1.18) rotate(8deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 0.7; }
        }
        @media (max-width: 1100px) {
          .student-rewards {
            padding: 16px 10px 36px;
          }
        }
      `}</style>
      {requestToast.open ? (
        <div className="request-toast" role="status" aria-live="polite">
          {requestToast.label} requested
          <div className="request-toast__sub">Request sent for admin approval</div>
        </div>
      ) : null}
      {!inStudentWorkspace ? <StudentNavPanel /> : null}
      <StudentWorkspaceTopBar student={activeStudent} onClearStudent={clearSelectedStudent} badgeUrl={mvpBadgeUrl} />
      {!isEmbed && (
        <div style={{ position: "fixed", left: 12, top: 150, width: 320, zIndex: 120, display: isStudentView ? "none" : "grid", gap: 12 }}>
          <StudentTopBar
            students={students}
            activeStudentId={studentId}
            onChangeStudent={setStudentId}
            sticky={false}
            dock="left"
            autoHide={false}
            quickPoints={isStudentView ? undefined : [1, 2, 5, 10, 15, -1, -2, -5, -10, -15]}
            onQuickPoints={isStudentView ? undefined : addOrRemovePoints}
            readonly={isStudentView}
          />
          <CriticalNoticeBar dock="left" />
        </div>
      )}

      {msg ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 18,
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 18px 50px rgba(0,0,0,0.25)",
            fontWeight: 900,
          }}
        >
          {msg}
        </div>
      ) : null}

      <div className="prize-vault">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 980 }}>Prize Request Vault</div>
            <div className="sub" style={{ marginTop: 4 }}>
              Request rewards from the master rewards list. Your requested and redeemed counts are shown per card.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div className="miniStat">
              <div className="miniLabel">Current Points</div>
              <div className="miniValue">{total}</div>
            </div>

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.06)",
                color: "#fff",
                fontWeight: 900,
              }}
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

      <div className="prize-vault__grid">
        {filtered.map((r) => {
          const cost = r.cost;
          const canRedeem = total >= cost;
          const count = redeemCounts[r.id] ?? 0;
          const pending = pendingCounts[r.id] ?? 0;
          const cardStyle: React.CSSProperties = {
            cursor: canRedeem ? "pointer" : "not-allowed",
            textAlign: "left",
            borderRadius: 26,
            padding: 14,
            border: canRedeem ? "1px solid rgba(255,255,255,0.14)" : "1px solid rgba(255,255,255,0.10)",
            background: canRedeem
              ? "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))"
              : "rgba(255,255,255,0.04)",
            boxShadow: "0 18px 40px rgba(0,0,0,0.28)",
          };

          const content = (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontWeight: 980, fontSize: 18, color: "#fff" }}>
                    {r.icon ?? "🎁"} {r.name}
                  </div>
                  <div className="sub" style={{ fontSize: 12 }}>
                    {r.category ?? "Other"}
                  </div>
                </div>

                <div
                  style={{
                    padding: "7px 10px",
                    borderRadius: 999,
                    fontWeight: 980,
                    fontSize: 12,
                    color: "#fff",
                    background: canRedeem ? "rgba(59,130,246,0.18)" : "rgba(255,255,255,0.10)",
                    border: canRedeem ? "1px solid rgba(59,130,246,0.30)" : "1px solid rgba(255,255,255,0.12)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {cost} pts
                </div>
              </div>

              <div
                style={{
                  marginTop: 12,
                  height: 10,
                  borderRadius: 999,
                  background: "linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              />

              <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                {canRedeem ? (
                  <div style={{ fontWeight: 950, color: "rgba(255,255,255,0.92)" }}>{isStudentView ? "Request this reward" : "Click to redeem"}</div>
                ) : (
                  <div className="sub" style={{ fontWeight: 900 }}>Need {Math.max(0, cost - total)} more</div>
                )}

                <div
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    fontWeight: 980,
                    fontSize: 12,
                    color: "#fff",
                    background: "rgba(34,197,94,0.14)",
                    border: "1px solid rgba(34,197,94,0.22)",
                  }}
                  title="Times redeemed by this student"
                >
                  Redeemed: {count}
                </div>
                {pending ? (
                  <div
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      fontWeight: 980,
                      fontSize: 12,
                      color: "#fff",
                      background: "rgba(234,179,8,0.18)",
                      border: "1px solid rgba(234,179,8,0.35)",
                    }}
                    title="Pending approval"
                  >
                    Pending: {pending}
                  </div>
                ) : null}
              </div>
              {isStudentView ? (
                <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                  <button
                    onClick={() => requestHold(r.id, r.name)}
                    disabled={!canRedeem}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.14)",
                      background: canRedeem ? "rgba(59,130,246,0.25)" : "rgba(255,255,255,0.06)",
                      color: "white",
                      fontWeight: 900,
                      cursor: canRedeem ? "pointer" : "not-allowed",
                    }}
                  >
                    Request Reward
                  </button>
                </div>
              ) : null}
            </>
          );

          return isStudentView ? (
            <div key={r.id} className="reward-card" style={cardStyle} title={canRedeem ? "Request hold" : `Need ${cost - total} more points`}>
              {content}
            </div>
          ) : (
            <button
              key={r.id}
              onClick={() => doRedeem(r.id, r.name, cost)}
              disabled={!canRedeem}
              className="reward-card"
              style={cardStyle}
              title={canRedeem ? "Click to redeem" : `Need ${cost - total} more points`}
            >
              {content}
            </button>
          );
        })}
      </div>
      </div>
    </main>
  );
}

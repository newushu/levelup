"use client";

import { useEffect, useState } from "react";
import AuthGate from "@/components/AuthGate";

type Reward = {
  id: string;
  name: string;
  cost: number;
  category?: string | null;
  icon?: string | null;
  enabled?: boolean;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status})` } };
  }
}

export default function ParentRewardsPage() {
  return (
    <AuthGate>
      <ParentRewardsInner />
    </AuthGate>
  );
}

function ParentRewardsInner() {
  const [role, setRole] = useState("student");
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [students, setStudents] = useState<Array<{ id: string; name: string }>>([]);
  const [studentId, setStudentId] = useState("");
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

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
      const res = await fetch("/api/rewards/list", { cache: "no-store" });
      const sj = await safeJson(res);
      if (!sj.ok) return setMsg(sj.json?.error || "Failed to load rewards.");
      setRewards((sj.json?.rewards ?? []) as Reward[]);

      const sRes = await fetch("/api/parent/students", { cache: "no-store" });
      const sJson = await safeJson(sRes);
      if (sJson.ok) {
        const list = (sJson.json?.students ?? []) as Array<{ id: string; name: string }>;
        setStudents(list);
        if (list.length && !studentId) setStudentId(list[0].id);
      }

      const pRes = await fetch("/api/parent/discounts/pending", { cache: "no-store" });
      const pJson = await safeJson(pRes);
      if (pJson.ok) {
        const pending = new Set<string>((pJson.json?.pending ?? []).map((row: any) => String(row.reward_id ?? "")));
        setPendingIds(pending);
      }

    })();
  }, [role, studentId]);

  async function requestDiscount(rewardId: string) {
    if (!studentId) return setMsg("Select a student first.");
    setMsg("");
    setBusy(true);
    const res = await fetch("/api/rewards/redeem-hold-parent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reward_id: rewardId, student_id: studentId }),
    });
    const sj = await safeJson(res);
    setBusy(false);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to submit request.");
    setPendingIds((prev) => new Set(prev).add(rewardId));
    setMsg("Discount request submitted for approval.");
  }

  if (role !== "parent") {
    return (
      <main style={{ padding: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Parent access only.</div>
      </main>
    );
  }

  return (
    <main style={{ padding: 18, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ fontSize: 26, fontWeight: 1000 }}>Rewards & Discounts</div>
      <div style={{ opacity: 0.7, marginTop: 6 }}>
        Request discounts that must be approved by a coach.
      </div>
      {msg ? <div style={{ marginTop: 10, opacity: 0.8 }}>{msg}</div> : null}

      <div style={section()}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <div style={{ fontWeight: 900 }}>Discounts</div>
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)} style={select()}>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
          {rewards
            .filter((reward) => String(reward.category ?? "").toLowerCase() === "discount")
            .map((reward) => (
              <div key={reward.id} style={card()}>
                <div style={{ fontWeight: 900 }}>{reward.name}</div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>
                  Requires approval • {reward.cost} pts
                </div>
                <button
                  onClick={() => requestDiscount(reward.id)}
                  style={btn()}
                  disabled={busy || pendingIds.has(reward.id)}
                >
                  {pendingIds.has(reward.id) ? "Pending Approval" : "Request Approval"}
                </button>
              </div>
            ))}
          {!rewards.some((reward) => String(reward.category ?? "").toLowerCase() === "discount") && (
            <div style={{ opacity: 0.7 }}>No discounts available yet.</div>
          )}
        </div>
      </div>

      <div style={section()}>
        <div style={{ fontWeight: 900 }}>Rewards Catalog</div>
        <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
          {rewards.filter((reward) => String(reward.category ?? "").toLowerCase() !== "discount").map((reward) => (
            <div key={reward.id} style={card()}>
              <div style={{ fontWeight: 900 }}>{reward.name}</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>
                {reward.category ?? "General"} • {reward.cost} pts
              </div>
            </div>
          ))}
          {!rewards.filter((reward) => String(reward.category ?? "").toLowerCase() !== "discount").length && (
            <div style={{ opacity: 0.7 }}>No rewards available yet.</div>
          )}
        </div>
      </div>
    </main>
  );
}

function section(): React.CSSProperties {
  return {
    marginTop: 16,
    display: "grid",
    gap: 8,
  };
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

function btn(): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid rgba(59,130,246,0.6)",
    background: "rgba(59,130,246,0.18)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
    width: "fit-content",
  };
}

function select(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.4)",
    color: "white",
    fontSize: 12,
  };
}

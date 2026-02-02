"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type PendingRow = {
  id: string;
  student_name: string;
  reward_name: string;
  cost: number;
  requested_at: string;
  hold_until?: string | null;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 180)}` } };
  }
}

export default function AdminRewardsPage() {
  const [pinOk, setPinOk] = useState(false);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  async function loadPending() {
    const res = await fetch("/api/rewards/admin/pending", { cache: "no-store" });
    const data = await safeJson(res);
    if (!data.ok) return setMsg(data.json?.error || "Failed to load pending");
    setPending((data.json?.pending ?? []) as PendingRow[]);
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      const ok = window.sessionStorage.getItem("admin_pin_ok") === "1";
      if (!ok) {
        window.location.href = "/admin";
        return;
      }
      setPinOk(true);
    }
    loadPending();
  }, []);

  if (!pinOk) return null;

  async function resolve(id: string, action: "approve" | "reject") {
    setBusy((prev) => ({ ...prev, [id]: true }));
    setMsg("");
    const res = await fetch("/api/rewards/admin/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ redemption_id: id, action }),
    });
    const data = await safeJson(res);
    if (!data.ok) {
      setBusy((prev) => ({ ...prev, [id]: false }));
      return setMsg(data.json?.error || "Failed to resolve");
    }
    await loadPending();
    setBusy((prev) => ({ ...prev, [id]: false }));
  }

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 1000 }}>Reward Holds</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Approve or reject student hold requests.</div>
        </div>
        <Link href="/admin/custom" style={backLink()}>
          Back to Admin
        </Link>
      </div>

      {msg ? <div style={notice()}>{msg}</div> : null}

      <div style={{ display: "grid", gap: 12 }}>
        {pending.map((row) => (
          <div key={row.id} style={card()}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 1000 }}>{row.student_name}</div>
                <div style={{ opacity: 0.8, fontSize: 12 }}>
                  {row.reward_name} • {row.cost} pts
                </div>
                <div style={{ opacity: 0.6, fontSize: 11, marginTop: 4 }}>
                  Requested {row.requested_at ? new Date(row.requested_at).toLocaleString() : "—"}
                  {row.hold_until ? ` • Hold until ${new Date(row.hold_until).toLocaleDateString()}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => resolve(row.id, "approve")} style={btn("good")} disabled={!!busy[row.id]}>
                  Approve
                </button>
                <button onClick={() => resolve(row.id, "reject")} style={btn("bad")} disabled={!!busy[row.id]}>
                  Reject
                </button>
              </div>
            </div>
          </div>
        ))}
        {!pending.length && <div style={{ opacity: 0.7 }}>No pending requests.</div>}
      </div>
    </main>
  );
}

function card(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
  };
}

function btn(kind: "good" | "bad"): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: kind === "good" ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function backLink(): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 12,
  };
}

function notice(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(239,68,68,0.12)",
    color: "white",
    fontWeight: 900,
    fontSize: 12,
  };
}

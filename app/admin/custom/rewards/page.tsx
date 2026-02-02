"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type RewardRow = {
  id: string;
  name: string;
  category?: string | null;
  reward_type?: string | null;
  cost?: number | null;
  enabled?: boolean;
  icon_url?: string | null;
  redeem_limit?: number | null;
  allowed_groups?: string[] | null;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status})` } };
  }
}

export default function RewardsAdminPage() {
  const [pinOk, setPinOk] = useState(false);
  const [rows, setRows] = useState<RewardRow[]>([]);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (typeof window !== "undefined") {
      const ok = window.sessionStorage.getItem("admin_pin_ok") === "1";
      if (!ok) {
        window.location.href = "/admin";
        return;
      }
      setPinOk(true);
    }
  }, []);

  async function load() {
    const res = await fetch("/api/admin/rewards/list", { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to load rewards");
    setRows((sj.json?.rewards ?? []) as RewardRow[]);
  }

  useEffect(() => {
    if (!pinOk) return;
    load();
  }, [pinOk]);

  async function saveRow(row: RewardRow) {
    const key = row.id;
    setSaving((prev) => ({ ...prev, [key]: true }));
    const res = await fetch("/api/admin/rewards/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
    const sj = await safeJson(res);
    if (!sj.ok) {
      setSaving((prev) => ({ ...prev, [key]: false }));
      return setMsg(sj.json?.error || "Failed to save reward");
    }
    await load();
    setSaving((prev) => ({ ...prev, [key]: false }));
    setSaved((prev) => ({ ...prev, [key]: true }));
    window.setTimeout(() => setSaved((prev) => ({ ...prev, [key]: false })), 1800);
  }

  if (!pinOk) return null;

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 1000 }}>Rewards Catalog</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            Update reward names, categories, point costs, limits, and availability.
          </div>
        </div>
        <Link href="/admin/custom" style={backLink()}>
          Return to Admin Workspace
        </Link>
      </div>

      {msg ? <div style={notice()}>{msg}</div> : null}

      <div style={{ display: "grid", gap: 12 }}>
        {rows.map((row) => (
          <div key={row.id} style={card()}>
            <div style={{ display: "grid", gap: 10 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.2fr 0.9fr 0.9fr 0.8fr 0.9fr auto",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <input
                  value={row.name}
                  onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, name: e.target.value } : r)))}
                  style={input()}
                  placeholder="Reward name"
                />
                <input
                  value={row.reward_type ?? ""}
                  onChange={(e) =>
                    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, reward_type: e.target.value } : r)))
                  }
                  style={input()}
                  placeholder="Type"
                />
                <input
                  value={row.category ?? ""}
                  onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, category: e.target.value } : r)))}
                  style={input()}
                  placeholder="Category"
                />
                <input
                  type="number"
                  value={row.cost ?? 0}
                  onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, cost: Number(e.target.value) } : r)))}
                  style={input()}
                  placeholder="Points"
                />
                <input
                  type="number"
                  value={row.redeem_limit ?? ""}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((r) => (r.id === row.id ? { ...r, redeem_limit: Number(e.target.value) || null } : r))
                    )
                  }
                  style={input()}
                  placeholder={row.redeem_limit == null ? "No limit" : "Redeem limit"}
                  disabled={row.redeem_limit == null}
                />
                <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
                  <button onClick={() => saveRow(row)} style={btn()} disabled={!!saving[row.id]}>
                    {saving[row.id] ? "Saving..." : "Save"}
                  </button>
                  {saved[row.id] ? <div style={savedBadge()}>Saved</div> : null}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "center" }}>
                <input
                  value={(row.allowed_groups ?? []).join(", ")}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((r) =>
                        r.id === row.id
                          ? { ...r, allowed_groups: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) }
                          : r
                      )
                    )
                  }
                  style={input()}
                  placeholder="Allowed groups (comma-separated)"
                />
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, opacity: 0.8 }}>
                  <input
                    type="checkbox"
                    checked={row.redeem_limit == null}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) =>
                          r.id === row.id ? { ...r, redeem_limit: e.target.checked ? null : 1 } : r
                        )
                      )
                    }
                  />
                  No limit
                </label>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, opacity: 0.8 }}>
                  <input
                    type="checkbox"
                    checked={row.enabled !== false}
                    onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, enabled: e.target.checked } : r)))}
                  />
                  Enabled
                </label>
              </div>
            </div>
          </div>
        ))}
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
    display: "grid",
    gap: 10,
  };
}

function input(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.35)",
    color: "white",
    fontWeight: 900,
  };
}

function btn(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(59,130,246,0.35)",
    background: "rgba(59,130,246,0.25)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function savedBadge(): React.CSSProperties {
  return {
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(34,197,94,0.5)",
    background: "rgba(34,197,94,0.18)",
    color: "white",
    fontWeight: 900,
    fontSize: 11,
  };
}

function notice(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(239,68,68,0.3)",
    background: "rgba(239,68,68,0.12)",
    color: "white",
    fontWeight: 900,
    fontSize: 12,
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

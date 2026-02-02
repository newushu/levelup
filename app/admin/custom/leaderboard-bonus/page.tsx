"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type BonusSettings = {
  id?: number | null;
  total_points?: number | null;
  skill_pulse_points?: number | null;
  performance_lab_points?: number | null;
  skill_tracker_points_per_rep?: number | null;
};

export default function LeaderboardBonusSettingsPage() {
  const [settings, setSettings] = useState<BonusSettings>({
    total_points: 0,
    skill_pulse_points: 0,
    performance_lab_points: 0,
    skill_tracker_points_per_rep: 2,
  });
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/leaderboard-bonus", { cache: "no-store" });
      const sj = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(sj?.error || "Failed to load settings");
        return;
      }
      if (sj?.settings) {
        setSettings({
          total_points: Number(sj.settings.total_points ?? 0),
          skill_pulse_points: Number(sj.settings.skill_pulse_points ?? 0),
          performance_lab_points: Number(sj.settings.performance_lab_points ?? 0),
          skill_tracker_points_per_rep: Number(sj.settings.skill_tracker_points_per_rep ?? 2),
        });
      }
    })();
  }, []);

  async function save() {
    setMsg("");
    setSaving(true);
    const res = await fetch("/api/admin/leaderboard-bonus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const sj = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(sj?.error || "Failed to save");
      setSaving(false);
      return;
    }
    setSettings({
      total_points: Number(sj.settings?.total_points ?? 0),
      skill_pulse_points: Number(sj.settings?.skill_pulse_points ?? 0),
      performance_lab_points: Number(sj.settings?.performance_lab_points ?? 0),
      skill_tracker_points_per_rep: Number(sj.settings?.skill_tracker_points_per_rep ?? 2),
    });
    setMsg("Saved");
    setSaving(false);
  }

  return (
    <main style={{ display: "grid", gap: 16, maxWidth: 880 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 1000 }}>Leaderboard Daily Bonus</div>
          <div style={{ opacity: 0.75, fontSize: 13 }}>
            Set points earned per day for students who finish top 5 on each leaderboard.
          </div>
        </div>
        <Link href="/admin/custom" style={{ fontWeight: 900, fontSize: 12, opacity: 0.8 }}>
          Back to Admin Custom
        </Link>
      </div>

      {msg ? <div style={{ fontSize: 12, opacity: 0.8 }}>{msg}</div> : null}

      <div style={{ display: "grid", gap: 12 }}>
        <div style={card()}>
          <div style={cardTitle()}>Home: Total Points Leaderboard</div>
          <div style={cardDesc()}>Top 5 on the Total Points leaderboard (home page).</div>
          <label style={fieldLabel()}>Points per day</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={settings.total_points ?? 0}
            onChange={(e) => setSettings((prev) => ({ ...prev, total_points: Number(e.target.value || 0) }))}
            style={input()}
          />
        </div>

        <div style={card()}>
          <div style={cardTitle()}>Home: Skill Pulse Today Leaderboard</div>
          <div style={cardDesc()}>Top 5 on the Skill Pulse Today leaderboard (home page).</div>
          <label style={fieldLabel()}>Points per day</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={settings.skill_pulse_points ?? 0}
            onChange={(e) => setSettings((prev) => ({ ...prev, skill_pulse_points: Number(e.target.value || 0) }))}
            style={input()}
          />
        </div>

        <div style={card()}>
          <div style={cardTitle()}>Performance Lab Leaderboards</div>
          <div style={cardDesc()}>Top 5 on any Performance Lab stat leaderboard.</div>
          <label style={fieldLabel()}>Points per day</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={settings.performance_lab_points ?? 0}
            onChange={(e) => setSettings((prev) => ({ ...prev, performance_lab_points: Number(e.target.value || 0) }))}
            style={input()}
          />
        </div>

        <div style={card()}>
          <div style={cardTitle()}>Skill Tracker Points Per Rep</div>
          <div style={cardDesc()}>
            Applied to new skill trackers only. Points award on completion = successes × points per rep.
          </div>
          <label style={fieldLabel()}>Points per rep</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={settings.skill_tracker_points_per_rep ?? 2}
            onChange={(e) => setSettings((prev) => ({ ...prev, skill_tracker_points_per_rep: Number(e.target.value || 0) }))}
            style={input()}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={save} disabled={saving} style={saveBtn(saving)}>
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </main>
  );
}

function card(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.55)",
    display: "grid",
    gap: 8,
  };
}

function cardTitle(): React.CSSProperties {
  return { fontWeight: 1000, fontSize: 14 };
}

function cardDesc(): React.CSSProperties {
  return { fontSize: 12, opacity: 0.75 };
}

function fieldLabel(): React.CSSProperties {
  return { fontSize: 12, fontWeight: 900, opacity: 0.85 };
}

function input(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.55)",
    color: "white",
    fontSize: 14,
    width: "100%",
  };
}

function saveBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: "10px 16px",
    borderRadius: 12,
    border: "1px solid rgba(59,130,246,0.35)",
    background: disabled ? "rgba(59,130,246,0.3)" : "linear-gradient(90deg, rgba(59,130,246,0.85), rgba(14,165,233,0.65))",
    color: "white",
    fontWeight: 950,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const LIVE_ACTIVITY_TYPES = [
  { key: "points_gain", label: "Points Gained", desc: "General positive point activity not in other categories." },
  { key: "points_loss", label: "Points Lost", desc: "General negative points (non-rule-breaker, non-battle)." },
  { key: "rule_breaker", label: "Rule Breaker", desc: "Rule breaker point losses." },
  { key: "skill_pulse", label: "Skill Pulse", desc: "Skill Pulse completions and awards." },
  { key: "skill_complete", label: "Skill Complete", desc: "Individual skill completions." },
  { key: "battle_pulse_win", label: "Battle Pulse Win", desc: "Battle Pulse wins and net points gained." },
  { key: "battle_pulse_loss", label: "Battle Pulse Loss", desc: "Battle Pulse losses and net points lost." },
  { key: "battle_pulse_mvp", label: "Battle Pulse MVP", desc: "MVP bonuses and consolation points." },
  { key: "redeem", label: "Prize Redeem", desc: "Redemptions and store rewards." },
  { key: "avatar_unlock", label: "Avatar Unlock", desc: "Avatar unlocks and point costs." },
  { key: "roulette", label: "Roulette", desc: "Prize wheel spins and outcomes." },
  { key: "badge", label: "Badge Earned", desc: "Achievement badge awards." },
  { key: "challenge", label: "Challenge Complete", desc: "Challenge vault completions and medals." },
  { key: "skilltree", label: "Skill Tree Complete", desc: "Completed skill tree sets." },
  { key: "top3_weekly", label: "Top 3 Weekly", desc: "Weekly leaderboard top 3 changes." },
];

type DisplaySettings = {
  live_activity_enabled: boolean;
  skill_pulse_enabled: boolean;
  battle_pulse_enabled: boolean;
  badges_enabled: boolean;
  live_activity_types: string[];
};

const DEFAULT_SETTINGS: DisplaySettings = {
  live_activity_enabled: true,
  skill_pulse_enabled: true,
  battle_pulse_enabled: true,
  badges_enabled: true,
  live_activity_types: LIVE_ACTIVITY_TYPES.map((t) => t.key),
};

export default function DisplaySettingsPage() {
  const [settings, setSettings] = useState<DisplaySettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const typeSet = useMemo(() => new Set(settings.live_activity_types), [settings.live_activity_types]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/display-settings", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!mounted) return;
        if (!res.ok) throw new Error(data?.error || "Failed to load settings");
        const next = data?.settings ?? {};
        setSettings({
          live_activity_enabled: next.live_activity_enabled !== false,
          skill_pulse_enabled: next.skill_pulse_enabled !== false,
          battle_pulse_enabled: next.battle_pulse_enabled !== false,
          badges_enabled: next.badges_enabled !== false,
          live_activity_types: Array.isArray(next.live_activity_types) && next.live_activity_types.length
            ? next.live_activity_types
            : DEFAULT_SETTINGS.live_activity_types,
        });
      } catch (err: any) {
        if (mounted) setStatus(err?.message ?? "Failed to load settings");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const toggleType = (key: string) => {
    setSettings((prev) => {
      const set = new Set(prev.live_activity_types);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      return { ...prev, live_activity_types: Array.from(set) };
    });
  };

  const setAllTypes = (on: boolean) => {
    setSettings((prev) => ({
      ...prev,
      live_activity_types: on ? LIVE_ACTIVITY_TYPES.map((t) => t.key) : [],
    }));
  };

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/display-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to save settings");
      setStatus("Saved.");
    } catch (err: any) {
      setStatus(err?.message ?? "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 1000 }}>Display Settings</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            Control which displays are visible and which live activity events appear.
          </div>
        </div>
        <Link href="/admin/custom" style={backLink()}>
          Return to Custom
        </Link>
      </div>

      <div style={card()}>
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>Displays</div>
        <div style={{ display: "grid", gap: 8 }}>
          {renderToggle("Live Activity Display", settings.live_activity_enabled, (v) =>
            setSettings((prev) => ({ ...prev, live_activity_enabled: v }))
          )}
          {renderToggle("Skill Pulse Display", settings.skill_pulse_enabled, (v) =>
            setSettings((prev) => ({ ...prev, skill_pulse_enabled: v }))
          )}
          {renderToggle("Battle Pulse Display", settings.battle_pulse_enabled, (v) =>
            setSettings((prev) => ({ ...prev, battle_pulse_enabled: v }))
          )}
          {renderToggle("Badges Display", settings.badges_enabled, (v) =>
            setSettings((prev) => ({ ...prev, badges_enabled: v }))
          )}
        </div>
      </div>

      <div style={card()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 1000, marginBottom: 4 }}>Live Activity Event Types</div>
            <div style={{ opacity: 0.75, fontSize: 12 }}>
              Choose what appears on the main display feed (points earned/lost, rule breakers, etc.).
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setAllTypes(true)} style={miniBtn()}>
              All
            </button>
            <button onClick={() => setAllTypes(false)} style={miniBtn()}>
              None
            </button>
          </div>
        </div>
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {LIVE_ACTIVITY_TYPES.map((t) => (
            <label key={t.key} style={checkRow()}>
              <input type="checkbox" checked={typeSet.has(t.key)} onChange={() => toggleType(t.key)} />
              <div>
                <div style={{ fontWeight: 900 }}>{t.label}</div>
                <div style={{ opacity: 0.65, fontSize: 12 }}>{t.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button onClick={save} disabled={saving || loading} style={saveBtn(saving || loading)}>
          {saving ? "Saving..." : "Save Settings"}
        </button>
        {status ? <div style={{ fontSize: 12, opacity: 0.8 }}>{status}</div> : null}
      </div>
    </main>
  );
}

function renderToggle(label: string, value: boolean, onChange: (next: boolean) => void) {
  return (
    <label style={checkRow()}>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <div style={{ fontWeight: 900 }}>{label}</div>
    </label>
  );
}

function card(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: 14,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
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

function checkRow(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "20px 1fr",
    gap: 10,
    alignItems: "center",
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(15,23,42,0.35)",
  };
}

function saveBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: "10px 16px",
    borderRadius: 999,
    border: "1px solid rgba(59,130,246,0.6)",
    background: disabled ? "rgba(59,130,246,0.25)" : "rgba(59,130,246,0.5)",
    color: "white",
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 12,
  };
}

function miniBtn(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 900,
    fontSize: 11,
    cursor: "pointer",
  };
}

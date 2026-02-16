"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const LIVE_ACTIVITY_TYPES = [
  { key: "points_gain", label: "Points Gained", desc: "General positive point activity not in other categories." },
  { key: "points_loss", label: "Points Lost", desc: "General negative points (non-rule-breaker, non-battle)." },
  { key: "rule_keeper", label: "Rule Keeper", desc: "Rule keeper awards and positive behavior bonuses." },
  { key: "rule_breaker", label: "Rule Breaker", desc: "Rule breaker point losses." },
  { key: "skill_pulse", label: "Skill Pulse", desc: "Skill Pulse completions and awards." },
  { key: "skill_complete", label: "Skill Complete", desc: "Individual skill completions." },
  { key: "battle_pulse_win", label: "Battle Pulse Win", desc: "Battle Pulse wins and net points gained." },
  { key: "battle_pulse_loss", label: "Battle Pulse Loss", desc: "Battle Pulse losses and net points lost." },
  { key: "battle_pulse_mvp", label: "Battle Pulse MVP", desc: "MVP bonuses and consolation points." },
  { key: "level_up", label: "Level Up", desc: "Level up moments for students." },
  { key: "redeem", label: "Prize Redeem", desc: "Redemptions and store rewards." },
  { key: "avatar_unlock", label: "Avatar Unlock", desc: "Avatar unlocks and point costs." },
  { key: "roulette", label: "Roulette", desc: "Prize wheel spins and outcomes." },
  { key: "badge", label: "Badge Earned", desc: "Achievement badge awards." },
  { key: "challenge", label: "Challenge Complete", desc: "Challenge vault completions and medals." },
  { key: "skilltree", label: "Skill Tree Complete", desc: "Completed skill tree sets." },
  { key: "top3_weekly", label: "Top 3 Weekly", desc: "Weekly leaderboard top 3 changes." },
];

const POINT_METRICS = [
  { key: "none", label: "Empty Slot" },
  { key: "points_total", label: "Points Balance" },
  { key: "lifetime_points", label: "Lifetime Points" },
  { key: "weekly_points", label: "Weekly Points" },
  { key: "today_points", label: "Today Points" },
  { key: "skill_pulse_today", label: "Skill Pulse Today" },
  { key: "mvp_count", label: "Total MVPs" },
  { key: "rule_keeper_total", label: "Rule Keeper Total" },
];

const DISPLAY_MODULES = [
  { key: "none", label: "Blank" },
  { key: "live_activity", label: "Live Activity" },
  { key: "skill_pulse", label: "Skill Pulse" },
  { key: "battle_pulse", label: "Battle Pulse" },
  { key: "badges", label: "Badges" },
  { key: "leaderboards", label: "Performance Lab Leaderboards" },
];

type LeaderboardSlot = {
  slot: number;
  metric: string;
  title: string;
  rank_window?: "top5" | "next5" | "top10";
};

type LeaderboardLargeRotation = {
  slot: number;
  rotation: number[];
};

type BlankDisplaySlot = {
  slot: number;
  module: string;
};

type DisplaySettings = {
  live_activity_enabled: boolean;
  skill_pulse_enabled: boolean;
  battle_pulse_enabled: boolean;
  badges_enabled: boolean;
  leaderboard_display_enabled: boolean;
  live_activity_types: string[];
  coach_display_activity_types: string[];
  leaderboard_slots: LeaderboardSlot[];
  leaderboard_large_rotations: LeaderboardLargeRotation[];
  display_blank_slots: BlankDisplaySlot[];
};

const DEFAULT_SETTINGS: DisplaySettings = {
  live_activity_enabled: true,
  skill_pulse_enabled: true,
  battle_pulse_enabled: true,
  badges_enabled: true,
  leaderboard_display_enabled: true,
  live_activity_types: LIVE_ACTIVITY_TYPES.map((t) => t.key),
  coach_display_activity_types: ["battle_pulse_mvp", "level_up", "rule_keeper"],
  leaderboard_slots: Array.from({ length: 10 }, (_, idx) => ({
    slot: idx + 1,
    metric: POINT_METRICS[(idx % (POINT_METRICS.length - 1)) + 1]?.key ?? "points_total",
    title: POINT_METRICS[(idx % (POINT_METRICS.length - 1)) + 1]?.label ?? "Leaderboard",
    rank_window: idx < 4 ? "top5" : "top10",
  })),
  leaderboard_large_rotations: [
    { slot: 1, rotation: [1, 8, 2] },
    { slot: 2, rotation: [2, 9, 3] },
    { slot: 3, rotation: [3, 10, 4] },
    { slot: 4, rotation: [4, 7, 1] },
    { slot: 5, rotation: [5, 6, 7] },
    { slot: 6, rotation: [8, 9, 10] },
  ],
  display_blank_slots: Array.from({ length: 6 }, (_, idx) => ({ slot: idx + 1, module: "none" })),
};

export default function DisplaySettingsPage() {
  const [settings, setSettings] = useState<DisplaySettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [performanceStats, setPerformanceStats] = useState<Array<{ id: string; name: string; unit: string | null }>>([]);

  const typeSet = useMemo(() => new Set(settings.live_activity_types), [settings.live_activity_types]);
  const metricOptions = useMemo(() => {
    const base = POINT_METRICS.map((m) => ({ value: m.key, label: m.label }));
    const perf = performanceStats
      .filter((row) => row.id)
      .map((row) => ({
        value: `performance_stat:${row.id}`,
        label: `Perf Lab: ${row.name}${row.unit ? ` (${row.unit})` : ""}`,
      }));
    return [...base, ...perf];
  }, [performanceStats]);

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
          leaderboard_display_enabled: next.leaderboard_display_enabled !== false,
          live_activity_types: Array.isArray(next.live_activity_types) && next.live_activity_types.length
            ? next.live_activity_types
            : DEFAULT_SETTINGS.live_activity_types,
          coach_display_activity_types:
            Array.isArray(next.coach_display_activity_types) && next.coach_display_activity_types.length
              ? next.coach_display_activity_types
              : DEFAULT_SETTINGS.coach_display_activity_types,
          leaderboard_slots: normalizeLeaderboardSlots(next.leaderboard_slots),
          leaderboard_large_rotations: normalizeLargeRotations(next.leaderboard_large_rotations),
          display_blank_slots: normalizeBlankSlots(next.display_blank_slots),
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

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/performance-lab/stats", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!mounted || !res.ok) return;
        const list = Array.isArray(data?.stats) ? data.stats : [];
        setPerformanceStats(
          list.map((row: any) => ({
            id: String(row.id ?? ""),
            name: String(row.name ?? "Stat"),
            unit: row.unit ?? null,
          }))
        );
      } catch {
        if (mounted) setPerformanceStats([]);
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

  const toggleCoachType = (key: string) => {
    setSettings((prev) => {
      const set = new Set(prev.coach_display_activity_types);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      return { ...prev, coach_display_activity_types: Array.from(set) };
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

  const updateSlot = (index: number, patch: Partial<LeaderboardSlot>) => {
    setSettings((prev) => {
      const next = [...prev.leaderboard_slots];
      const current = next[index] ?? { slot: index + 1, metric: "points_total", title: "" };
      next[index] = { ...current, ...patch, slot: index + 1 };
      return { ...prev, leaderboard_slots: next };
    });
  };

  const updateLargeRotation = (index: number, rotationIndex: number, value: number) => {
    setSettings((prev) => {
      const next = [...prev.leaderboard_large_rotations];
      const current = next[index] ?? { slot: index + 5, rotation: [5, 6, 7] };
      const rotation = [...(current.rotation ?? [])];
      while (rotation.length < 3) rotation.push((rotation[rotation.length - 1] ?? 1));
      rotation[rotationIndex] = value;
      next[index] = { slot: current.slot ?? index + 5, rotation };
      return { ...prev, leaderboard_large_rotations: next };
    });
  };

  const updateBlankSlot = (index: number, module: string) => {
    setSettings((prev) => {
      const next = [...prev.display_blank_slots];
      next[index] = { slot: index + 1, module };
      return { ...prev, display_blank_slots: next };
    });
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
          {renderToggle("Performance Lab Leaderboards", settings.leaderboard_display_enabled, (v) =>
            setSettings((prev) => ({ ...prev, leaderboard_display_enabled: v }))
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

      <div style={card()}>
        <div style={{ fontWeight: 1000, marginBottom: 4 }}>Coach Display Notable Activity</div>
        <div style={{ opacity: 0.75, fontSize: 12 }}>
          Choose which events appear in the coach display activity bar.
        </div>
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {LIVE_ACTIVITY_TYPES.map((t) => (
            <label key={`coach-${t.key}`} style={checkRow()}>
              <input
                type="checkbox"
                checked={settings.coach_display_activity_types.includes(t.key)}
                onChange={() => toggleCoachType(t.key)}
              />
              <div>
                <div style={{ fontWeight: 900 }}>{t.label}</div>
                <div style={{ opacity: 0.65, fontSize: 12 }}>{t.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div style={card()}>
        <div style={{ fontWeight: 1000, marginBottom: 6 }}>Leaderboard Slots</div>
        <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 10 }}>
          Display 1-4 are small tiles. Display 5-6 are large tiles that rotate through 3 selections.
        </div>
        <div style={slotGrid()}>
          {settings.leaderboard_slots.map((slot, idx) => (
            <div key={slot.slot} style={slotCard()}>
              <div style={{ fontWeight: 900 }}>Slot {slot.slot}</div>
              <label style={fieldStack()}>
                <span style={fieldLabel()}>Title</span>
                <input
                  value={slot.title ?? ""}
                  onChange={(e) => updateSlot(idx, { title: e.target.value })}
                  placeholder="Leaderboard title"
                  style={textInput()}
                />
              </label>
              <label style={fieldStack()}>
                <span style={fieldLabel()}>Metric</span>
                <select
                  value={slot.metric}
                  onChange={(e) => updateSlot(idx, { metric: e.target.value })}
                  style={textInput()}
                >
                  {metricOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={fieldStack()}>
                <span style={fieldLabel()}>Rank Window</span>
                <select
                  value={slot.rank_window ?? "top10"}
                  onChange={(e) => updateSlot(idx, { rank_window: e.target.value as "top5" | "next5" | "top10" })}
                  style={textInput()}
                >
                  <option value="top5">Ranks 1-5</option>
                  <option value="next5">Ranks 6-10</option>
                  <option value="top10">Ranks 1-10</option>
                </select>
              </label>
            </div>
          ))}
        </div>
      </div>

      <div style={card()}>
        <div style={{ fontWeight: 1000, marginBottom: 6 }}>Leaderboard Rotations (10s each)</div>
        <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 10 }}>
          Choose which 3 slots rotate in each tile (left 1-4 and large 5-6).
        </div>
        <div style={slotGrid()}>
          {settings.leaderboard_large_rotations.map((rotation, idx) => (
            <div key={rotation.slot} style={slotCard()}>
              <div style={{ fontWeight: 900 }}>Large Display {rotation.slot}</div>
              {[0, 1, 2].map((rotIdx) => (
                <label key={`rot-${rotation.slot}-${rotIdx}`} style={fieldStack()}>
                  <span style={fieldLabel()}>Rotation {rotIdx + 1}</span>
                  <select
                    value={rotation.rotation?.[rotIdx] ?? 1}
                    onChange={(e) => updateLargeRotation(idx, rotIdx, Number(e.target.value))}
                    style={textInput()}
                  >
                    {settings.leaderboard_slots.map((slot) => (
                      <option key={`slot-${slot.slot}`} value={slot.slot}>
                        {slot.slot}. {slot.title || `Leaderboard ${slot.slot}`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div style={card()}>
        <div style={{ fontWeight: 1000, marginBottom: 6 }}>Blank Display Assignments</div>
        <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 10 }}>
          Choose which module is shown on each blank display screen.
        </div>
        <div style={blankGrid()}>
          {settings.display_blank_slots.map((slot, idx) => (
            <label key={slot.slot} style={blankCard()}>
              <div style={{ fontWeight: 900 }}>Display {slot.slot}</div>
              <select
                value={slot.module}
                onChange={(e) => updateBlankSlot(idx, e.target.value)}
                style={textInput()}
              >
                {DISPLAY_MODULES.map((mod) => (
                  <option key={mod.key} value={mod.key}>
                    {mod.label}
                  </option>
                ))}
              </select>
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

function normalizeLeaderboardSlots(input: any): LeaderboardSlot[] {
  const raw = Array.isArray(input) ? input : [];
  const base = DEFAULT_SETTINGS.leaderboard_slots;
  const normalizeRankWindow = (value: unknown) => {
    const raw = String(value ?? "").trim().toLowerCase();
    if (raw === "top5" || raw === "next5" || raw === "top10") return raw as "top5" | "next5" | "top10";
    return "top10" as const;
  };
  return base.map((fallback, index) => {
    const candidate =
      raw[index] ||
      raw.find((row: any) => Number(row?.slot ?? 0) === index + 1) ||
      {};
    const metric = String(candidate?.metric ?? fallback.metric ?? "").trim() || fallback.metric || "none";
    const title = String(candidate?.title ?? fallback.title ?? "").trim() || fallback.title;
    const rank_window = normalizeRankWindow(candidate?.rank_window ?? fallback.rank_window ?? "top10");
    return { slot: index + 1, metric, title, rank_window };
  });
}

function normalizeBlankSlots(input: any): BlankDisplaySlot[] {
  const raw = Array.isArray(input) ? input : [];
  const base = DEFAULT_SETTINGS.display_blank_slots;
  return base.map((fallback, index) => {
    const candidate =
      raw[index] ||
      raw.find((row: any) => Number(row?.slot ?? 0) === index + 1) ||
      {};
    const displayModule = String(candidate?.module ?? fallback.module ?? "none").trim() || fallback.module;
    return { slot: index + 1, module: displayModule };
  });
}

function normalizeLargeRotations(input: any): LeaderboardLargeRotation[] {
  const raw = Array.isArray(input) ? input : [];
  const base = DEFAULT_SETTINGS.leaderboard_large_rotations;
  const clampSlot = (value: any, fallback: number) => {
    const num = Number(value ?? fallback);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(1, Math.min(DEFAULT_SETTINGS.leaderboard_slots.length, Math.round(num)));
  };
  return base.map((fallback, index) => {
    const candidate =
      raw[index] ||
      raw.find((row: any) => Number(row?.slot ?? 0) === fallback.slot) ||
      {};
    const rotationRaw = Array.isArray(candidate?.rotation) ? candidate.rotation : fallback.rotation;
    const rotation = Array.from({ length: 3 }, (_, rIdx) => clampSlot(rotationRaw[rIdx], fallback.rotation[rIdx]));
    return { slot: fallback.slot, rotation };
  });
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

function slotGrid(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  };
}

function slotCard(): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 12,
    background: "rgba(15,23,42,0.45)",
    border: "1px solid rgba(255,255,255,0.08)",
    display: "grid",
    gap: 8,
  };
}

function fieldStack(): React.CSSProperties {
  return {
    display: "grid",
    gap: 6,
    fontSize: 12,
  };
}

function fieldLabel(): React.CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 800,
    opacity: 0.7,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  };
}

function textInput(): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(2,6,23,0.7)",
    color: "white",
    fontSize: 12,
  };
}

function blankGrid(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  };
}

function blankCard(): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 12,
    background: "rgba(15,23,42,0.45)",
    border: "1px solid rgba(255,255,255,0.08)",
    display: "grid",
    gap: 8,
  };
}

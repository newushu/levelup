"use client";

import React from "react";

export type Tier = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "master";

export default function ChallengeMedalsGrid2x4({
  counts,
  title = "Challenge Medals",
}: {
  counts: Record<Tier, number>;
  title?: string;
}) {
  const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
  const masterShown = Math.min(10, counts.master ?? 0);

  const cells: { key: string; label: string; icon: string; value: number; kind: Tier | "total" | "masterShown" }[] = [
    { key: "bronze", label: "Bronze", icon: "★", value: counts.bronze ?? 0, kind: "bronze" },
    { key: "silver", label: "Silver", icon: "★", value: counts.silver ?? 0, kind: "silver" },
    { key: "gold", label: "Gold", icon: "★", value: counts.gold ?? 0, kind: "gold" },
    { key: "platinum", label: "Platinum", icon: "⬒", value: counts.platinum ?? 0, kind: "platinum" },
    { key: "diamond", label: "Diamond", icon: "◆", value: counts.diamond ?? 0, kind: "diamond" },
    { key: "master", label: "Master", icon: "✦", value: counts.master ?? 0, kind: "master" },
    { key: "total", label: "Total", icon: "🏅", value: total, kind: "total" },
    { key: "mshown", label: "Stars", icon: "✦", value: masterShown, kind: "masterShown" },
  ];

  return (
    <div style={panel()}>
      <div style={{ fontWeight: 1000, fontSize: 13, opacity: 0.92 }}>{title}</div>

      <div
        style={{
          marginTop: 10,
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        {cells.map((c) => (
          <div key={c.key} style={cell()}>
            <div style={iconWrap(c.kind)}>{c.icon}</div>
            <div style={{ marginTop: 6, fontSize: 11, opacity: 0.82, fontWeight: 900 }}>{c.label}</div>
            <div style={{ marginTop: 2, fontSize: 14, fontWeight: 1000 }}>{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function panel(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: 14,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 14px 50px rgba(0,0,0,0.25)",
  };
}

function cell(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 10,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.20)",
    textAlign: "center",
  };
}

function iconWrap(kind: Tier | "total" | "masterShown"): React.CSSProperties {
  const base: React.CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: 10,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    border: "1px solid rgba(255,255,255,0.18)",
  };

  if (kind === "bronze") return { ...base, background: "rgba(180,83,9,0.28)" };
  if (kind === "silver") return { ...base, background: "rgba(148,163,184,0.20)" };
  if (kind === "gold") return { ...base, background: "rgba(250,204,21,0.20)" };
  if (kind === "platinum") return { ...base, background: "rgba(203,213,225,0.18)" };
  if (kind === "diamond") return { ...base, background: "rgba(59,130,246,0.18)" };
  if (kind === "master" || kind === "masterShown")
    return {
      ...base,
      background: "linear-gradient(90deg, rgba(59,130,246,0.28), rgba(147,197,253,0.12))",
      boxShadow: "0 0 18px rgba(59,130,246,0.25)",
    };

  // total
  return { ...base, background: "rgba(255,255,255,0.08)" };
}

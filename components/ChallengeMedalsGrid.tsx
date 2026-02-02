"use client";

import React from "react";

export type Tier = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "master";

export default function ChallengeMedalsGrid({
  counts,
  title = "Challenge Medals",
}: {
  counts: Record<Tier, number>;
  title?: string;
}) {
  const items: { tier: Tier; label: string }[] = [
    { tier: "bronze", label: "Bronze" },
    { tier: "silver", label: "Silver" },
    { tier: "gold", label: "Gold" },
    { tier: "platinum", label: "Platinum" },
    { tier: "diamond", label: "Diamond" },
    { tier: "master", label: "Master" },
  ];

  return (
    <div style={panel()}>
      <div style={{ fontWeight: 1000, fontSize: 13, opacity: 0.92 }}>{title}</div>

      <div
        style={{
          marginTop: 10,
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        {items.map((it) => (
          <div key={it.tier} style={medalCell()}>
            <div style={medalIconWrap(it.tier)}>{tierIcon(it.tier)}</div>
            <div style={{ marginTop: 6, fontSize: 11, opacity: 0.82, fontWeight: 900 }}>{it.label}</div>
            <div style={{ marginTop: 2, fontSize: 14, fontWeight: 1000 }}>{counts[it.tier] ?? 0}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function tierIcon(t: Tier) {
  if (t === "platinum") return "⬒"; // rhombus
  if (t === "diamond") return "◆";
  if (t === "master") return "✦";
  return "★";
}

function medalIconWrap(t: Tier): React.CSSProperties {
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

  if (t === "bronze") return { ...base, background: "rgba(180,83,9,0.28)" };
  if (t === "silver") return { ...base, background: "rgba(148,163,184,0.20)" };
  if (t === "gold") return { ...base, background: "rgba(250,204,21,0.20)" };
  if (t === "platinum") return { ...base, background: "rgba(203,213,225,0.18)" };
  if (t === "diamond") return { ...base, background: "rgba(59,130,246,0.18)" };
  return {
    ...base,
    background: "linear-gradient(90deg, rgba(59,130,246,0.28), rgba(147,197,253,0.12))",
    boxShadow: "0 0 18px rgba(59,130,246,0.25)",
  };
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

function medalCell(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 10,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.20)",
    textAlign: "center",
  };
}

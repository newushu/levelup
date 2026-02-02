"use client";

import React from "react";

export type Tier = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "master";

const TIERS: Tier[] = ["bronze", "silver", "gold", "platinum", "diamond", "master"];

function icon(t: Tier) {
  if (t === "platinum") return "⬒"; // rhombus
  if (t === "diamond") return "◆";
  if (t === "master") return "✦"; // blue glow handled via styling below
  return "★";
}

function bg(t: Tier) {
  if (t === "bronze") return "rgba(180,83,9,0.22)";
  if (t === "silver") return "rgba(148,163,184,0.16)";
  if (t === "gold") return "rgba(250,204,21,0.18)";
  if (t === "platinum") return "rgba(203,213,225,0.16)";
  if (t === "diamond") return "rgba(59,130,246,0.16)";
  return "linear-gradient(90deg, rgba(59,130,246,0.25), rgba(147,197,253,0.12))";
}

function glow(t: Tier) {
  if (t === "master") return "0 0 18px rgba(59,130,246,0.25)";
  if (t === "diamond") return "0 0 14px rgba(59,130,246,0.18)";
  return "none";
}

export default function MedalMiniGrid({ counts }: { counts: Record<Tier, number> }) {
  return (
    <div
      style={{
        borderRadius: 16,
        padding: 12,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 14px 50px rgba(0,0,0,0.22)",
      }}
    >
      <div style={{ fontWeight: 950, fontSize: 12, opacity: 0.9 }}>Challenge Medals</div>

      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {TIERS.map((t) => (
          <div
            key={t}
            style={{
              borderRadius: 14,
              padding: "8px 10px",
              border: "1px solid rgba(255,255,255,0.10)",
              background: bg(t) as any,
              boxShadow: glow(t),
              display: "grid",
              gap: 3,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 1000 }}>{icon(t)}</span>
              <span style={{ fontWeight: 1000 }}>{counts?.[t] ?? 0}</span>
            </div>
            <div style={{ fontSize: 10, opacity: 0.72 }}>{t.toUpperCase()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import React from "react";

type SlotShape = "star" | "circle" | "heart" | "diamond" | "shield" | "crown" | "hex" | "leaf" | "bolt" | "medal";

const SHAPES: SlotShape[] = ["star", "circle", "heart", "diamond", "shield", "crown", "hex", "leaf", "bolt", "medal"];

function shapeSvg(shape: SlotShape, filled: boolean) {
  const stroke = filled ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.18)";
  const fill = filled ? "rgba(59,130,246,0.28)" : "rgba(255,255,255,0.03)";

  // tiny icons (simple + reliable)
  const common = { stroke, fill, strokeWidth: 1.8 };
  switch (shape) {
    case "circle":
      return <circle cx="16" cy="16" r="10.5" {...common} />;
    case "diamond":
      return <path d="M16 4 L27 16 L16 28 L5 16 Z" {...common} />;
    case "heart":
      return <path d="M16 27 C6 19, 7 9, 13 9 C15 9, 16 11, 16 11 C16 11, 17 9, 19 9 C25 9, 26 19, 16 27 Z" {...common} />;
    case "shield":
      return <path d="M16 4 L26 8 V16 C26 23 21 27 16 28 C11 27 6 23 6 16 V8 Z" {...common} />;
    case "crown":
      return <path d="M6 22 L8 10 L14 15 L16 10 L18 15 L24 10 L26 22 Z" {...common} />;
    case "hex":
      return <path d="M16 4 L26 10 V22 L16 28 L6 22 V10 Z" {...common} />;
    case "leaf":
      return <path d="M8 22 C8 10 20 6 24 8 C24 22 12 26 8 22 Z" {...common} />;
    case "bolt":
      return <path d="M18 4 L8 18 H15 L14 28 L24 14 H17 Z" {...common} />;
    case "medal":
      return (
        <>
          <path d="M11 4 H21 L19 10 H13 Z" {...common} />
          <circle cx="16" cy="19" r="8.5" {...common} />
        </>
      );
    case "star":
    default:
      return <path d="M16 4 L19 12 L28 12 L21 17 L24 26 L16 21 L8 26 L11 17 L4 12 L13 12 Z" {...common} />;
  }
}

export default function PrestigeSlots({
  slots,
}: {
  slots: { id: string; label: string; earned: boolean }[];
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
      {slots.slice(0, 10).map((s, i) => {
        const shape = SHAPES[i % SHAPES.length];
        const earned = !!s.earned;

        return (
          <div
            key={s.id}
            style={{
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.12)",
              background: earned ? "rgba(59,130,246,0.10)" : "rgba(255,255,255,0.04)",
              padding: 10,
              display: "grid",
              gap: 6,
              boxShadow: earned ? "0 0 22px rgba(59,130,246,0.18)" : "none",
            }}
            title={s.label}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <svg width="32" height="32" viewBox="0 0 32 32">
                {shapeSvg(shape, earned)}
              </svg>
              <div style={{ fontWeight: 950, opacity: earned ? 1 : 0.55, fontSize: 12 }}>
                {earned ? "UNLOCKED" : "LOCKED"}
              </div>
            </div>

            <div style={{ fontSize: 11, opacity: earned ? 0.9 : 0.35, lineHeight: 1.2 }}>
              {s.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

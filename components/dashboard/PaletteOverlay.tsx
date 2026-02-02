"use client";
import React from "react";
import Overlay from "./Overlay";

export default function PaletteOverlay({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (color: string) => void;
}) {
  if (!open) return null;

  return (
    <Overlay title="Customize Avatar (BG Color)" onClose={onClose}>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ opacity: 0.75, fontSize: 12 }}>
          Changes <b>background color</b> only (stored in <code>student_avatar_settings.bg_color</code>).
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {palette().map((c) => (
            <button
              key={c}
              onClick={() => onPick(c)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.16)",
                background: c,
                cursor: "pointer",
                boxShadow: "0 14px 40px rgba(0,0,0,0.35)",
              }}
              title={c}
            />
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btnGhost()}>
            Done
          </button>
        </div>
      </div>
    </Overlay>
  );
}

function btnGhost(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
  };
}

function palette() {
  return [
    "rgba(255,255,255,0.06)",
    "rgba(0,0,0,0.26)",
    "rgba(30,41,59,0.35)",
    "rgba(17,24,39,0.42)",
    "rgba(59,130,246,0.18)",
    "rgba(147,197,253,0.14)",
    "rgba(34,197,94,0.14)",
    "rgba(250,204,21,0.14)",
    "rgba(168,85,247,0.14)",
    "rgba(239,68,68,0.14)",
  ];
}

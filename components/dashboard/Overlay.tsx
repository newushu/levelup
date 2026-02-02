"use client";
import React from "react";

export default function Overlay({
  title,
  onClose,
  children,
  maxWidth = 980,
  topOffset = 0,
  maxHeight,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
  topOffset?: number;
  maxHeight?: number;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.65)",
        display: "flex",
        alignItems: topOffset ? "flex-start" : "center",
        justifyContent: "center",
        padding: 18,
        paddingTop: topOffset ? topOffset : 18,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: `min(${maxWidth}px, 100%)`,
          borderRadius: 22,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(0,0,0,0.78)",
          backdropFilter: "blur(10px)",
          boxShadow: "0 22px 90px rgba(0,0,0,0.60)",
          padding: 14,
          maxHeight: maxHeight ? `min(${maxHeight}px, 100%)` : undefined,
          overflow: maxHeight ? "hidden" : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 1100 }}>{title}</div>
          <button onClick={onClose} style={btnGhost()}>
            Close
          </button>
        </div>
        <div style={{ marginTop: 12 }}>{children}</div>
      </div>
    </div>
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

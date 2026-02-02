"use client";

import AuthGate from "@/components/AuthGate";

export default function CoachWarmupPage() {
  return (
    <AuthGate>
      <div style={page()}>
        <div style={card()}>
          <div style={{ fontSize: 24, fontWeight: 900 }}>Warm Up</div>
          <div style={{ opacity: 0.7, fontSize: 13 }}>Placeholder — warm up content coming soon.</div>
        </div>
      </div>
    </AuthGate>
  );
}

function page(): React.CSSProperties {
  return {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "radial-gradient(circle at top, rgba(56,189,248,0.16), rgba(2,6,23,0.95))",
    color: "white",
    padding: 24,
  };
}

function card(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: 20,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(15,23,42,0.7)",
    display: "grid",
    gap: 8,
    textAlign: "center",
  };
}

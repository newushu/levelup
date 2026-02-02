"use client";

type Props = {
  label: string;
  earned: boolean;
  icon?: string;       // emoji for now; later can be SVG/img
  size?: number;       // square size
  rarity?: "common" | "rare" | "epic" | "legendary";
};

export default function BadgeSlot({
  label,
  earned,
  icon = "★",
  size = 56,
  rarity = "epic",
}: Props) {
  const aura =
    rarity === "legendary"
      ? "rgba(255,215,0,0.45)"
      : rarity === "epic"
      ? "rgba(59,130,246,0.45)"
      : rarity === "rare"
      ? "rgba(34,197,94,0.35)"
      : "rgba(255,255,255,0.18)";

  return (
    <div
      title={label}
      style={{
        width: size,
        height: size,
        borderRadius: 16,
        position: "relative",
        display: "grid",
        placeItems: "center",
        background: earned ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
        border: earned ? "1px solid rgba(255,255,255,0.16)" : "1px solid rgba(255,255,255,0.10)",
        boxShadow: earned
          ? `0 0 0 2px rgba(255,255,255,0.06), 0 0 26px ${aura}, inset 0 0 0 1px rgba(255,255,255,0.10)`
          : "inset 0 0 0 1px rgba(255,255,255,0.08)",
        overflow: "visible",
      }}
    >
      {/* Rotating aura ring (earned only) */}
      {earned && (
        <div
          style={{
            position: "absolute",
            inset: -8,
            borderRadius: 18,
            border: `1px solid rgba(255,255,255,0.10)`,
            background: `conic-gradient(from 0deg, rgba(255,255,255,0.00), ${aura}, rgba(255,255,255,0.00))`,
            filter: "blur(0.2px)",
            opacity: 0.9,
            animation: "badgeSpin 4.2s linear infinite",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Embossed empty-slot look */}
      {!earned && (
        <div
          style={{
            position: "absolute",
            inset: 8,
            borderRadius: 12,
            background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(0,0,0,0.12))",
            boxShadow: "inset 0 10px 16px rgba(0,0,0,0.35)",
            opacity: 0.55,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Icon */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          fontSize: size * 0.38,
          opacity: earned ? 1 : 0.0,
          filter: earned ? `drop-shadow(0 0 10px ${aura})` : undefined,
        }}
      >
        {icon}
      </div>

      <style jsx>{`
        @keyframes badgeSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

"use client";

import { useMemo } from "react";

type Base = "dragon" | "panda";

type Props = {
  size: number;
  achievementLevel: number; // 1-99
  base: Base;
  bgColor?: string;
  borderColor?: string;
  glowColor?: string;
  outerGlowColor?: string;
  pattern?: "stars" | "hearts";
  aura?: "none" | "fire" | "lightning";
  isCompetitionTeam?: boolean;
};

function DragonIcon() {
  // placeholder SVG dragon (we’ll swap with your real art later)
  return (
    <svg viewBox="0 0 64 64" width="70%" height="70%" aria-hidden>
      <path
        d="M46 20c-6-8-18-9-26-2-7 6-8 16-2 23 6 7 16 8 23 2 2-2 4-5 5-8-4 2-9 2-13-1-6-4-7-12-2-17 4-4 10-4 15 0z"
        fill="rgba(255,255,255,0.92)"
      />
      <path
        d="M40 16l6-6-2 8"
        fill="none"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PandaIcon() {
  return (
    <svg viewBox="0 0 64 64" width="70%" height="70%" aria-hidden>
      <circle cx="32" cy="34" r="18" fill="rgba(255,255,255,0.92)" />
      <circle cx="20" cy="20" r="8" fill="rgba(255,255,255,0.92)" />
      <circle cx="44" cy="20" r="8" fill="rgba(255,255,255,0.92)" />
      <circle cx="26" cy="34" r="5" fill="rgba(0,0,0,0.65)" />
      <circle cx="38" cy="34" r="5" fill="rgba(0,0,0,0.65)" />
      <circle cx="32" cy="42" r="3" fill="rgba(0,0,0,0.55)" />
    </svg>
  );
}

export default function AchievementAvatar(props: Props) {
  const {
    size,
    achievementLevel,
    base,
    bgColor = "#0b1220",
    borderColor = "rgba(255,255,255,0.26)",
    glowColor = "rgba(59,130,246,0.6)",
    outerGlowColor = "rgba(34,197,94,0.45)",
    pattern = "stars",
    aura = "none",
    isCompetitionTeam = false,
  } = props;

  const unlockParticles = false;
  const unlockAura = achievementLevel >= 10; // you can tune unlock rules
  const intensity = Math.min(1, achievementLevel / 50);

  const particleOptions = useMemo(() => {
    return {
      background: { color: { value: "transparent" } },
      fpsLimit: 60,
      particles: { number: { value: 0 } },
    } as any;
  }, []);

  const patternIcons = pattern === "hearts" ? ["♥", "♥", "♥"] : ["★", "★", "★"];

  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      {/* Outer glow ring */}
      <div
        style={{
          position: "absolute",
          inset: -8,
          borderRadius: "50%",
          boxShadow: isCompetitionTeam
            ? `0 0 0 2px rgba(255,215,0,0.55), 0 0 34px rgba(255,215,0,0.42), 0 0 70px rgba(255,215,0,0.22)`
            : `0 0 28px ${outerGlowColor}`,
          pointerEvents: "none",
        }}
      />

      {/* Particle layer */}
      {unlockParticles && (
        <div style={{ position: "absolute", inset: -18, borderRadius: "50%", overflow: "hidden", pointerEvents: "none" }}>
          {/* Particles disabled: package not installed. */}
        </div>
      )}

      {/* Inner main circle */}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.10), ${bgColor})`,
          border: `2px solid ${borderColor}`,
          boxShadow: `0 0 0 6px rgba(255,255,255,0.06), 0 0 26px ${glowColor}`,
          display: "grid",
          placeItems: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Aura placeholder (Phase 2 will replace with Pixi fire/lightning) */}
        {unlockAura && aura !== "none" && (
          <div
            style={{
              position: "absolute",
              inset: -10,
              borderRadius: "50%",
              background:
                aura === "fire"
                  ? "conic-gradient(from 0deg, rgba(255,100,0,0.0), rgba(255,100,0,0.35), rgba(255,255,0,0.0))"
                  : "conic-gradient(from 0deg, rgba(96,165,250,0.0), rgba(96,165,250,0.35), rgba(255,255,255,0.0))",
              filter: "blur(1px)",
              animation: "spin 3.8s linear infinite",
              opacity: 0.85,
              pointerEvents: "none",
            }}
          />
        )}

        {/* Base icon */}
        <div style={{ position: "relative", zIndex: 2, filter: "drop-shadow(0 10px 22px rgba(0,0,0,0.35))" }}>
          {base === "dragon" ? <DragonIcon /> : <PandaIcon />}
        </div>

        {/* Bottom pattern icons */}
        <div
          style={{
            position: "absolute",
            bottom: 6,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            gap: 8,
            zIndex: 3,
            opacity: 0.9,
            fontWeight: 900,
          }}
        >
          {patternIcons.map((x, i) => (
            <span key={i} style={{ textShadow: "0 0 12px rgba(255,255,255,0.25)" }}>
              {x}
            </span>
          ))}
        </div>

        {/* Competition Team label ring (text on border feel, simple version) */}
        {isCompetitionTeam && (
          <div
            style={{
              position: "absolute",
              inset: 6,
              borderRadius: "50%",
              border: "1px solid rgba(255,215,0,0.45)",
              boxShadow: "0 0 22px rgba(255,215,0,0.30)",
              pointerEvents: "none",
            }}
          />
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

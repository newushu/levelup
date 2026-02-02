"use client";

import React from "react";
import AvatarEffectParticles from "@/components/AvatarEffectParticles";

export default function EvolvingAvatar({
  level,
  size,
  variant,
  imageUrl,
  effectKey,
  effectConfig,
  cornerBadgeUrl,
  cornerOffsets,
  cornerBadgeSize,
}: {
  level: number;
  size: number;
  variant: string;
  imageUrl?: string;
  effectKey?: string | null;
  effectConfig?: {
    density?: number;
    size?: number;
    speed?: number;
    opacity?: number;
  } | null;
  cornerBadgeUrl?: string | null;
  cornerOffsets?: { x: number; y: number } | null;
  cornerBadgeSize?: number | null;
}) {
  const badgeOffset = cornerOffsets ?? { x: -8, y: -8 };
  const badgeSize = Math.max(28, Math.round(Number(cornerBadgeSize ?? 0) || size * 0.55));

  if (imageUrl) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 18,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(255,255,255,0.06)",
          boxShadow: "0 16px 50px rgba(0,0,0,0.35)",
          display: "grid",
          placeItems: "center",
          position: "relative",
        }}
      >
        <AvatarEffectParticles effectKey={effectKey ?? null} config={effectConfig} compact={size <= 56} />
        {cornerBadgeUrl ? (
          <>
            <img src={cornerBadgeUrl} alt="" style={cornerBadgeTopLeft(badgeOffset, badgeSize)} />
            <img src={cornerBadgeUrl} alt="" style={cornerBadgeBottomRight(badgeOffset, badgeSize)} />
          </>
        ) : null}
        <img
          src={imageUrl}
          alt="avatar"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "block",
            position: "relative",
            zIndex: 1,
          }}
          onError={(e) => {
            // If image fails, hide it so you don't see broken placeholder
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      </div>
    );
  }

  // ---- KEEP your existing old rendering below ----
  // (dragon emoji / vector / whatever you already had)
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(255,255,255,0.06)",
        display: "grid",
        placeItems: "center",
        fontWeight: 1000,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <AvatarEffectParticles effectKey={effectKey ?? null} config={effectConfig} compact={size <= 56} />
      {cornerBadgeUrl ? (
        <>
          <img src={cornerBadgeUrl} alt="" style={cornerBadgeTopLeft(badgeOffset, badgeSize)} />
          <img src={cornerBadgeUrl} alt="" style={cornerBadgeBottomRight(badgeOffset, badgeSize)} />
        </>
      ) : null}
      {variant === "dragon" ? "🐉" : "⭐"} Lv {level}
    </div>
  );
}

function cornerBadgeTopLeft(offset: { x: number; y: number }, size: number): React.CSSProperties {
  return {
    position: "absolute",
    top: offset.y,
    left: offset.x,
    width: size,
    height: size,
    objectFit: "contain",
    pointerEvents: "none",
    zIndex: 3,
  };
}

function cornerBadgeBottomRight(offset: { x: number; y: number }, size: number): React.CSSProperties {
  return {
    position: "absolute",
    bottom: offset.y,
    right: offset.x,
    width: size,
    height: size,
    objectFit: "contain",
    transform: "rotate(180deg)",
    pointerEvents: "none",
    zIndex: 3,
  };
}

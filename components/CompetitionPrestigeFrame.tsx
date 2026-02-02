"use client";

import React, { useCallback, useMemo } from "react";
import Particles from "react-tsparticles";
import type { Engine } from "tsparticles-engine";
import { loadSlim } from "tsparticles-slim";


export default function CompetitionPrestigeFrame({
  show,
  masterStars,
  badges = [],
  badgeSize = 20,
  badgeGlow = false,
  showCrest = true,
  crestPosition = "top-left",
  crestSize = 26,
  crestGlow = false,
  labelPosition = "right",
  labelSize = 10,
  badgePosition = "bottom",
  badgeImageScale = 1,
  badgeOffsetLeft = -26,
  badgeSparkles = false,
  children,
}: {
  show: boolean;
  masterStars: number;
  badges?: string[];
  badgeSize?: number;
  badgeGlow?: boolean;
  showCrest?: boolean;
  crestPosition?: "top-left" | "bottom-left";
  crestSize?: number;
  crestGlow?: boolean;
  labelPosition?: "right" | "center" | "left";
  labelSize?: number;
  badgePosition?: "bottom" | "left";
  badgeImageScale?: number;
  badgeOffsetLeft?: number;
  badgeSparkles?: boolean;
  children: React.ReactNode;
}) {
  const stars = Math.max(0, Math.min(10, Number(masterStars ?? 0)));
  const crestUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/badges/prestige/compteam.png`
    : "";
  const badgeIcons = badges.filter(Boolean).slice(0, 10);
  const filteredBadges = show
    ? badgeIcons.filter((url) => !String(url).toLowerCase().includes("compteam"))
    : badgeIcons;
  const extendBottom = filteredBadges.length > 0 || (show && crestPosition === "bottom-left");
  const showFrame = show || filteredBadges.length > 0;
  const showSparkles = badgeSparkles && filteredBadges.length > 0;

  const particlesInit = useCallback(async (engine: Engine) => {
    await loadSlim(engine);
  }, []);

  const badgeSparkleOptions = useMemo(
    () => ({
      fullScreen: { enable: false },
      fpsLimit: 60,
      background: { color: { value: "transparent" } },
      particles: {
        number: { value: 18, density: { enable: true, area: 300 } },
        color: { value: ["#facc15", "#38bdf8", "#ffffff"] },
        shape: { type: ["star", "circle"] },
        opacity: { value: { min: 0.3, max: 0.8 }, animation: { enable: true, speed: 0.6, minimumValue: 0.2 } },
        size: { value: { min: 1, max: 2.5 } },
        move: { enable: true, speed: 0.3, direction: "top", outModes: { default: "out" } },
        shadow: { enable: true, color: "#facc15", blur: 6 },
      },
      interactivity: {
        detectsOn: "window",
        events: { onHover: { enable: true, mode: "bubble" }, onClick: { enable: false }, resize: true },
        modes: { bubble: { distance: 60, size: 4, opacity: 1, duration: 0.2 } },
      },
      detectRetina: true,
    }),
    []
  );


  return (
    <div style={{ position: "relative", overflow: "visible" }}>
      {showFrame && (
        <div style={frameGlow(extendBottom)}>
          {show && showCrest && crestUrl ? (
            <div style={crestBadge(crestPosition, crestSize, crestGlow)}>
              <img src={crestUrl} alt="Competition Team" style={{ width: crestSize, height: crestSize, objectFit: "contain" }} />
            </div>
          ) : null}
          {/* top label (always above border) */}
          {show ? (
            <div style={labelPill(labelPosition, labelSize)}>
              COMPETITION TEAM
            </div>
          ) : null}

          {filteredBadges.length ? (
            <>
              {showSparkles ? (
                <div style={badgeSparkleArea(badgePosition, badgeOffsetLeft, badgeSize)}>
                  <div style={badgeSparkleWrap()}>
                    <Particles init={particlesInit} options={badgeSparkleOptions} style={{ position: "absolute", inset: 0 }} />
                  </div>
                </div>
              ) : null}
              <div style={badgeRow(badgePosition, badgeOffsetLeft)}>
                {filteredBadges.map((url, idx) => (
                  <div key={`${url}-${idx}`} style={badgeWrap(badgeSize, badgeGlow)}>
                    <img
                      src={url}
                      alt="Prestige badge"
                      style={{
                        width: badgeSize * badgeImageScale,
                        height: badgeSize * badgeImageScale,
                        objectFit: "contain",
                      }}
                    />
                  </div>
                ))}
              </div>
            </>
          ) : null}


          {/* master stars along border */}
          {show ? (
            <div style={starsRow()}>
              {Array.from({ length: stars }).map((_, i) => (
                <span key={i} style={star()}>
                  ✦
                </span>
              ))}
            </div>
          ) : null}
        </div>
      )}


      {/* content */}
      <div style={{ position: "relative", zIndex: 2 }}>{children}</div>
    </div>
  );
}


function frameGlow(extendBottom: boolean): React.CSSProperties {
  return {
    position: "absolute",
    top: -8,
    left: -8,
    right: -8,
    bottom: extendBottom ? -46 : -8,
    borderRadius: 28,
    pointerEvents: "none",
    zIndex: 3,
    border: "1px solid rgba(147,197,253,0.45)",
    boxShadow:
      "0 0 0 2px rgba(59,130,246,0.20), 0 0 60px rgba(59,130,246,0.22)",
    background:
      "linear-gradient(135deg, rgba(59,130,246,0.16), rgba(168,85,247,0.10), rgba(34,197,94,0.06))",
  };
}


function labelPill(position: "right" | "center" | "left", size: number): React.CSSProperties {
  const isCenter = position === "center";
  const isLeft = position === "left";
  return {
    position: "absolute",
    top: -10,
    right: isCenter || isLeft ? "auto" : 18,
    left: isCenter ? "50%" : isLeft ? 18 : undefined,
    transform: isCenter ? "translateX(-50%)" : undefined,
    zIndex: 999,
    padding: "5px 10px",
    borderRadius: 999,
    fontWeight: 1000,
    fontSize: size,
    letterSpacing: 0.6,
    color: "white",
    background: "rgba(0,0,0,0.95)",
    border: "1px solid rgba(255,255,255,0.18)",
    boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
    textTransform: "uppercase",
    pointerEvents: "none",
    textAlign: "center",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

function badgeRow(position: "bottom" | "left", leftOffset: number): React.CSSProperties {
  if (position === "left") {
    return {
      position: "absolute",
      top: 14,
      bottom: 14,
      left: leftOffset,
      display: "flex",
      flexDirection: "column",
      gap: 10,
      zIndex: 998,
      pointerEvents: "none",
      justifyContent: "center",
    };
  }
  return {
    position: "absolute",
    bottom: -26,
    left: 12,
    display: "flex",
    gap: 10,
    zIndex: 998,
    pointerEvents: "none",
    flexWrap: "wrap",
  };
}

function badgeWrap(size: number, glow: boolean): React.CSSProperties {
  const boxSize = size + 20;
  return {
    width: boxSize,
    height: boxSize,
    minWidth: boxSize,
    minHeight: boxSize,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.35)",
    display: "grid",
    placeItems: "center",
    boxSizing: "border-box",
    flex: "0 0 auto",
    boxShadow: glow
      ? "0 0 0 1px rgba(250,204,21,0.45), 0 0 18px rgba(250,204,21,0.35)"
      : "0 6px 18px rgba(0,0,0,0.35)",
    animation: glow ? "badgeAura 2.2s ease-in-out infinite" : "none",
  };
}

function badgeSparkleArea(position: "bottom" | "left", leftOffset: number, size: number): React.CSSProperties {
  const boxSize = size + 20;
  if (position === "left") {
    return {
      position: "absolute",
      top: 6,
      bottom: 6,
      left: leftOffset,
      width: boxSize + 10,
      pointerEvents: "none",
      zIndex: 999,
    };
  }
  return {
    position: "absolute",
    bottom: -32,
    left: 0,
    right: 0,
    height: boxSize + 16,
    pointerEvents: "none",
    zIndex: 999,
  };
}

function badgeSparkleWrap(): React.CSSProperties {
  return {
    position: "relative",
    width: "100%",
    height: "100%",
    overflow: "hidden",
    borderRadius: 18,
    pointerEvents: "none",
  };
}

function crestBadge(
  position: "top-left" | "bottom-left",
  size: number,
  glow: boolean
): React.CSSProperties {
  return {
    position: "absolute",
    top: position === "top-left" ? -12 : undefined,
    bottom: position === "bottom-left" ? -18 : undefined,
    left: -10,
    width: size + 10,
    height: size + 10,
    borderRadius: 14,
    background: "rgba(5,7,11,0.85)",
    border: "1px solid rgba(255,255,255,0.25)",
    boxShadow: glow
      ? "0 0 0 1px rgba(250,204,21,0.4), 0 0 26px rgba(250,204,21,0.45)"
      : "0 12px 30px rgba(0,0,0,0.35)",
    display: "grid",
    placeItems: "center",
    zIndex: 998,
    animation: glow ? "badgeAura 2.2s ease-in-out infinite" : "none",
  };
}


function starsRow(): React.CSSProperties {
  return {
    position: "absolute",
    top: 10,
    left: 12,
    display: "flex",
    gap: 4,
    zIndex: 999,
    pointerEvents: "none",
  };
}


function star(): React.CSSProperties {
  return {
    width: 14,
    height: 14,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    color: "rgba(255,255,255,0.95)",
    background: "rgba(59,130,246,0.18)",
    border: "1px solid rgba(147,197,253,0.28)",
    boxShadow: "0 0 16px rgba(59,130,246,0.30)",
  };
}

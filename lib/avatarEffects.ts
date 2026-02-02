import type { CSSProperties } from "react";

export type AvatarEffectConfig = {
  density?: number;
  size?: number;
  speed?: number;
  opacity?: number;
};

const DEFAULT_CONFIG: Required<AvatarEffectConfig> = {
  density: 40,
  size: 6,
  speed: 6,
  opacity: 85,
};

const EFFECTS: Record<
  string,
  {
    colors: [string, string, string];
    densityScale: number;
    sizeScale: number;
    blur: number;
    blend: CSSProperties["mixBlendMode"];
    glow: string;
    pattern: "rings" | "sparkle" | "halo" | "storm" | "ember" | "aura" | "spray" | "nebula";
  }
> = {
  orbit: {
    colors: ["rgba(59,130,246,0.5)", "rgba(34,197,94,0.38)", "rgba(255,255,255,0.08)"],
    densityScale: 0.9,
    sizeScale: 0.9,
    blur: 0.3,
    blend: "screen",
    glow: "radial-gradient(circle at 50% 50%, rgba(59,130,246,0.2), transparent 70%)",
    pattern: "rings",
  },
  spark: {
    colors: ["rgba(250,204,21,0.55)", "rgba(59,130,246,0.35)", "rgba(34,197,94,0.25)"],
    densityScale: 0.7,
    sizeScale: 0.7,
    blur: 0.2,
    blend: "screen",
    glow: "radial-gradient(circle at 35% 30%, rgba(250,204,21,0.2), transparent 65%)",
    pattern: "sparkle",
  },
  halo: {
    colors: ["rgba(59,130,246,0.35)", "rgba(34,197,94,0.35)", "rgba(255,255,255,0.16)"],
    densityScale: 1.3,
    sizeScale: 1.6,
    blur: 1.1,
    blend: "lighten",
    glow: "radial-gradient(circle at 50% 50%, rgba(59,130,246,0.35), transparent 68%)",
    pattern: "halo",
  },
  storm: {
    colors: ["rgba(59,130,246,0.45)", "rgba(34,197,94,0.35)", "rgba(255,255,255,0.1)"],
    densityScale: 0.6,
    sizeScale: 0.9,
    blur: 0.4,
    blend: "screen",
    glow: "conic-gradient(from 30deg, rgba(59,130,246,0.22), transparent 40%, rgba(34,197,94,0.2))",
    pattern: "storm",
  },
  ember: {
    colors: ["rgba(251,146,60,0.55)", "rgba(244,63,94,0.4)", "rgba(255,255,255,0.05)"],
    densityScale: 1.4,
    sizeScale: 1.1,
    blur: 0.6,
    blend: "screen",
    glow: "radial-gradient(circle at 60% 40%, rgba(251,146,60,0.25), transparent 70%)",
    pattern: "ember",
  },
  aura: {
    colors: ["rgba(59,130,246,0.6)", "rgba(147,197,253,0.4)", "rgba(255,255,255,0.1)"],
    densityScale: 1,
    sizeScale: 1.4,
    blur: 0.9,
    blend: "screen",
    glow: "radial-gradient(circle at 50% 50%, rgba(59,130,246,0.35), transparent 72%)",
    pattern: "aura",
  },
  spray: {
    colors: ["rgba(34,197,94,0.5)", "rgba(59,130,246,0.4)", "rgba(250,204,21,0.35)"],
    densityScale: 0.5,
    sizeScale: 0.8,
    blur: 0.2,
    blend: "screen",
    glow: "radial-gradient(circle at 40% 70%, rgba(34,197,94,0.2), transparent 70%)",
    pattern: "spray",
  },
  nebula: {
    colors: ["rgba(236,72,153,0.4)", "rgba(59,130,246,0.35)", "rgba(255,255,255,0.08)"],
    densityScale: 1.8,
    sizeScale: 1.9,
    blur: 1.4,
    blend: "soft-light",
    glow: "radial-gradient(circle at 30% 40%, rgba(236,72,153,0.25), transparent 70%)",
    pattern: "nebula",
  },
};

export function avatarEffectLayerStyle(
  effectKey?: string | null,
  config?: AvatarEffectConfig | null
): CSSProperties | null {
  if (!effectKey) return null;
  const cfg = { ...DEFAULT_CONFIG, ...(config ?? {}) };
  const fx = EFFECTS[effectKey] ?? EFFECTS.orbit;
  const size = Math.max(2, cfg.size * fx.sizeScale);
  const density = Math.max(14, Math.round(cfg.density * fx.densityScale));
  const opacity = Math.max(0.3, Math.min(1, cfg.opacity / 100));
  const speed = Math.max(3, Math.min(16, cfg.speed));
  const duration = Math.max(6, 22 - speed * 1.2);
  const dot = (color: string, soft = 1) =>
    `radial-gradient(circle, ${color} 0 ${size}px, transparent ${size + soft}px)`;

  let baseDots = `${dot(fx.colors[0])}, ${dot(fx.colors[1], 2)}`;
  let texture = "";

  if (fx.pattern === "rings") {
    texture = `radial-gradient(circle at 50% 50%, ${fx.colors[2]} 0 38%, transparent 40%), radial-gradient(circle at 50% 50%, rgba(255,255,255,0.2) 0 60%, transparent 63%)`;
  } else if (fx.pattern === "sparkle") {
    baseDots = `radial-gradient(circle at 20% 30%, ${fx.colors[0]} 0 20%, transparent 45%), radial-gradient(circle at 80% 20%, ${fx.colors[1]} 0 18%, transparent 40%), radial-gradient(circle at 30% 80%, ${fx.colors[2]} 0 22%, transparent 46%)`;
    texture = `repeating-conic-gradient(from 0deg, rgba(255,255,255,0.12) 0 10deg, transparent 10deg 20deg)`;
  } else if (fx.pattern === "halo") {
    baseDots = `radial-gradient(circle at 50% 50%, ${fx.colors[0]} 0 55%, transparent 72%)`;
    texture = `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.22) 0 35%, transparent 55%)`;
  } else if (fx.pattern === "storm") {
    baseDots = `conic-gradient(from 10deg, ${fx.colors[0]} 0 25%, transparent 25% 50%, ${fx.colors[1]} 50% 75%, transparent 75% 100%)`;
    texture = `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.14) 0 22%, transparent 40%)`;
  } else if (fx.pattern === "ember") {
    baseDots = `radial-gradient(circle at 20% 70%, ${fx.colors[0]} 0 22%, transparent 48%), radial-gradient(circle at 70% 30%, ${fx.colors[1]} 0 18%, transparent 45%)`;
    texture = `radial-gradient(circle at 40% 50%, rgba(255,255,255,0.12) 0 30%, transparent 55%)`;
  } else if (fx.pattern === "aura") {
    baseDots = `radial-gradient(circle at 50% 50%, ${fx.colors[0]} 0 45%, transparent 70%)`;
    texture = `radial-gradient(circle at 50% 50%, ${fx.colors[1]} 0 30%, transparent 55%), radial-gradient(circle at 50% 50%, rgba(255,255,255,0.2) 0 18%, transparent 40%)`;
  } else if (fx.pattern === "spray") {
    baseDots = `linear-gradient(120deg, transparent 0 35%, ${fx.colors[0]} 35% 40%, transparent 40% 60%, ${fx.colors[1]} 60% 64%, transparent 64% 100%)`;
    texture = `radial-gradient(circle at 15% 25%, ${fx.colors[2]} 0 14%, transparent 35%), radial-gradient(circle at 80% 75%, rgba(255,255,255,0.18) 0 10%, transparent 30%)`;
  } else if (fx.pattern === "nebula") {
    baseDots = `radial-gradient(circle at 25% 30%, ${fx.colors[0]} 0 55%, transparent 70%), radial-gradient(circle at 75% 70%, ${fx.colors[1]} 0 60%, transparent 72%)`;
    texture = `radial-gradient(circle at 60% 25%, rgba(255,255,255,0.16) 0 35%, transparent 55%), radial-gradient(circle at 40% 60%, rgba(255,255,255,0.12) 0 25%, transparent 50%)`;
  }

  return {
    position: "absolute",
    inset: -6,
    borderRadius: 999,
    pointerEvents: "none",
    backgroundImage: `${baseDots}, ${texture}, ${fx.glow}`,
    backgroundSize: `${density}px ${density}px, ${Math.round(density * 1.6)}px ${Math.round(density * 1.6)}px, 100% 100%`,
    opacity,
    mixBlendMode: fx.blend,
    filter: `blur(${fx.blur}px)`,
    animation: `avatarEffectDrift ${duration}s linear infinite`,
  };
}

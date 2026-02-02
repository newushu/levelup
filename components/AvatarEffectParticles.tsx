"use client";

import { useCallback, useMemo, useId } from "react";
import Particles from "react-tsparticles";
import type { Engine, ISourceOptions } from "tsparticles-engine";
import { loadSlim } from "tsparticles-slim";

type EffectConfig = {
  density?: number;
  size?: number;
  speed?: number;
  opacity?: number;
  frequency?: number;
};

type EffectPreset = {
  colors: string[];
  shapes: string | string[];
  numberScale: number;
  sizeScale: number;
  opacityScale: number;
  speedScale: number;
  direction?: "none" | "top" | "bottom" | "left" | "right" | "top-right" | "top-left" | "bottom-right" | "bottom-left";
  straight?: boolean;
  polygonSides?: number;
  orbit?: boolean;
  fireworks?: boolean;
};

const DEFAULT_CONFIG = {
  density: 40,
  size: 6,
  speed: 6,
  opacity: 85,
  frequency: 1,
};

const EFFECT_PRESETS: Record<string, EffectPreset> = {
  orbit: {
    colors: ["#60a5fa", "#34d399", "#e0f2fe"],
    shapes: "circle",
    numberScale: 0.6,
    sizeScale: 1.2,
    opacityScale: 0.65,
    speedScale: 0.6,
  },
  spark: {
    colors: ["#facc15", "#60a5fa", "#34d399"],
    shapes: ["star", "triangle"],
    numberScale: 0.8,
    sizeScale: 0.9,
    opacityScale: 0.9,
    speedScale: 1.1,
    direction: "top-right",
  },
  halo: {
    colors: ["#93c5fd", "#34d399"],
    shapes: "circle",
    numberScale: 0.2,
    sizeScale: 3.2,
    opacityScale: 0.25,
    speedScale: 0.3,
  },
  storm: {
    colors: ["#38bdf8", "#22d3ee"],
    shapes: "polygon",
    numberScale: 0.5,
    sizeScale: 1.1,
    opacityScale: 0.7,
    speedScale: 1.6,
    direction: "top-left",
    straight: true,
    polygonSides: 3,
  },
  ember: {
    colors: ["#fb923c", "#f43f5e"],
    shapes: "circle",
    numberScale: 0.7,
    sizeScale: 1.4,
    opacityScale: 0.7,
    speedScale: 0.9,
    direction: "top",
  },
  aura: {
    colors: ["#60a5fa", "#a5b4fc"],
    shapes: "circle",
    numberScale: 0.35,
    sizeScale: 2.4,
    opacityScale: 0.4,
    speedScale: 0.4,
  },
  spray: {
    colors: ["#34d399", "#60a5fa", "#facc15"],
    shapes: ["line", "square"],
    numberScale: 0.5,
    sizeScale: 1.3,
    opacityScale: 0.7,
    speedScale: 1.8,
    direction: "top-right",
    straight: true,
  },
  nebula: {
    colors: ["#f472b6", "#60a5fa", "#e2e8f0"],
    shapes: "circle",
    numberScale: 0.25,
    sizeScale: 3.6,
    opacityScale: 0.22,
    speedScale: 0.25,
  },
  starfield: {
    colors: ["#e2e8f0", "#bae6fd", "#f8fafc"],
    shapes: "circle",
    numberScale: 1.1,
    sizeScale: 0.5,
    opacityScale: 0.5,
    speedScale: 0.2,
  },
  comet: {
    colors: ["#38bdf8", "#c4b5fd", "#f8fafc"],
    shapes: ["line", "triangle"],
    numberScale: 0.45,
    sizeScale: 1.6,
    opacityScale: 0.65,
    speedScale: 2.1,
    direction: "left",
    straight: true,
  },
  grid: {
    colors: ["#22d3ee", "#a5b4fc"],
    shapes: ["square", "polygon"],
    numberScale: 0.6,
    sizeScale: 1,
    opacityScale: 0.35,
    speedScale: 0.5,
    polygonSides: 4,
  },
  vortex: {
    colors: ["#f472b6", "#34d399", "#60a5fa"],
    shapes: ["polygon", "star"],
    numberScale: 0.5,
    sizeScale: 1.2,
    opacityScale: 0.6,
    speedScale: 1.4,
    direction: "bottom-right",
    polygonSides: 5,
  },
  pulse: {
    colors: ["#facc15", "#fb7185"],
    shapes: "circle",
    numberScale: 0.2,
    sizeScale: 4.4,
    opacityScale: 0.18,
    speedScale: 0.3,
  },
  rain: {
    colors: ["#60a5fa", "#94a3b8"],
    shapes: "line",
    numberScale: 0.9,
    sizeScale: 1.1,
    opacityScale: 0.45,
    speedScale: 2.4,
    direction: "bottom",
    straight: true,
  },
  orbitals: {
    colors: ["#a5b4fc", "#38bdf8", "#f472b6"],
    shapes: "circle",
    numberScale: 0.35,
    sizeScale: 1.6,
    opacityScale: 0.55,
    speedScale: 0.8,
    orbit: true,
  },
  fireworks: {
    colors: ["#f97316", "#facc15", "#38bdf8"],
    shapes: ["circle", "star"],
    numberScale: 0.1,
    sizeScale: 1.2,
    opacityScale: 0.9,
    speedScale: 2.2,
    fireworks: true,
  },
};

export default function AvatarEffectParticles({
  effectKey,
  config,
  compact = false,
}: {
  effectKey?: string | null;
  config?: EffectConfig | null;
  compact?: boolean;
}) {
  if (!effectKey || effectKey === "none") return null;
  const instanceId = useId();
  const preset = EFFECT_PRESETS[effectKey] ?? EFFECT_PRESETS.orbit;
  const cfg = { ...DEFAULT_CONFIG, ...(config ?? {}) };

  const options = useMemo<ISourceOptions>(() => {
    const baseCount = Math.max(6, Math.round(cfg.density / 3));
    const count = Math.max(4, Math.round(baseCount * preset.numberScale * (compact ? 0.55 : 1)));
    const size = Math.max(2, cfg.size * preset.sizeScale * (compact ? 0.7 : 1));
    const opacity = Math.max(0.12, Math.min(1, (cfg.opacity / 100) * preset.opacityScale));
    const speed = Math.max(0.2, Math.min(6, (cfg.speed / 6) * preset.speedScale * (compact ? 0.75 : 1.05)));
    const frequency = Math.max(0.5, Math.min(10, Number(cfg.frequency ?? 1)));

    const base: ISourceOptions = {
      fullScreen: { enable: false, zIndex: 0 },
      fpsLimit: 60,
      detectRetina: true,
      particles: {
        number: { value: count },
        color: { value: preset.colors },
        shape: {
          type: preset.shapes,
          options: preset.polygonSides
            ? {
                polygon: { sides: preset.polygonSides },
                star: { sides: Math.max(4, preset.polygonSides) },
              }
            : undefined,
        },
        opacity: { value: opacity, random: { enable: true, minimumValue: opacity * 0.6 } },
        size: { value: size, random: { enable: true, minimumValue: size * 0.5 } },
        move: {
          enable: true,
          speed,
          direction: preset.direction ?? "none",
          straight: preset.straight ?? false,
          outModes: { default: "bounce" },
        },
      },
    };

    if (preset.orbit) {
      base.particles = {
        ...base.particles,
        move: {
          ...base.particles.move,
          orbit: { enable: true, rotate: { value: 35 } },
        },
      };
    }

    if (preset.fireworks) {
      const delay = Math.max(0.2, 2.4 - frequency * 0.2);
      base.particles = {
        ...base.particles,
        life: { duration: { value: 0.6 }, count: 1 },
        move: {
          ...base.particles.move,
          gravity: { enable: true, acceleration: 8 },
          speed: speed * 1.4,
          outModes: { default: "destroy" },
        },
      };
      base.emitters = {
        position: { x: 50, y: 100 },
        rate: { delay, quantity: 1 },
        life: { count: 0, duration: 0.1, delay: 0.1 },
      };
    }

    return base;
  }, [cfg.density, cfg.opacity, cfg.size, cfg.speed, cfg.frequency, preset, compact]);

  const init = useCallback(async (engine: Engine) => {
    await loadSlim(engine);
  }, []);

  return (
    <Particles
      id={`avatar-effect-${effectKey}-${compact ? "compact" : "full"}-${instanceId}`}
      init={init}
      options={options}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}
    />
  );
}

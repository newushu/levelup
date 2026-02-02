"use client";

import { useCallback, useMemo } from "react";
import Particles from "react-tsparticles";
import type { Engine } from "tsparticles-engine";
import { loadSlim } from "tsparticles-slim";

export default function GlobalParticles() {
  const particlesInit = useCallback(async (engine: Engine) => {
    await loadSlim(engine);
  }, []);

  const options = useMemo(
    () => ({
      fullScreen: { enable: false },
      fpsLimit: 60,
      background: { color: { value: "transparent" } },
      particles: {
        number: { value: 85, density: { enable: true, area: 1000 } },
        color: { value: ["#38bdf8", "#a855f7", "#facc15"] },
        shape: { type: "circle" },
        opacity: { value: { min: 0.12, max: 0.45 }, animation: { enable: true, speed: 0.3, minimumValue: 0.08 } },
        size: { value: { min: 1, max: 2.8 } },
        move: { enable: true, speed: 0.35, direction: "top", outModes: { default: "out" } },
      },
      interactivity: {
        detectsOn: "window",
        events: { onHover: { enable: true, mode: "grab" }, resize: true },
        modes: { grab: { distance: 140, links: { opacity: 0.25 } } },
      },
      detectRetina: true,
    }),
    []
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
      <Particles id="global-particles" init={particlesInit} options={options} style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}

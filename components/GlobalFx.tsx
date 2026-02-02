"use client";

import confetti from "canvas-confetti";
import React, { useEffect, useState } from "react";

type Glow = "none" | "green" | "red";
type RedeemOverlay = null | { text: string; ts: number };

let fireFn: ((mode: "add" | "remove" | "redeem" | "keeper", overlayText?: string) => void) | null = null;

export function fireFx(mode: "add" | "remove" | "redeem" | "keeper", overlayText?: string) {
  fireFn?.(mode, overlayText);
}

export default function GlobalFx({ children }: { children: React.ReactNode }) {
  const [glow, setGlow] = useState<Glow>("none");
  const [redeem, setRedeem] = useState<RedeemOverlay>(null);
  const [sounds, setSounds] = useState<Record<string, { url: string; volume: number }>>({});

  useEffect(() => {
    fireFn = (mode, overlayText) => {
      if (mode === "add") {
        setGlow("green");
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.3 } });
        playSound("points_add");
        setTimeout(() => setGlow("none"), 420);
      } else if (mode === "remove") {
        setGlow("red");
        playSound("points_remove");
        setTimeout(() => setGlow("none"), 420);
      } else if (mode === "keeper") {
        setGlow("green");
        playSound("rule_keeper");
        setTimeout(() => setGlow("none"), 420);
      } else if (mode === "redeem") {
        // no glow on redeem
        confetti({ particleCount: 120, spread: 85, origin: { y: 0.25 } });
        setRedeem({ text: overlayText ?? "Redeemed!", ts: Date.now() });
        setTimeout(() => setRedeem(null), 2000);
      }
    };
    return () => {
      fireFn = null;
    };
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/sound-effects/list", { cache: "no-store" });
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        const map: Record<string, { url: string; volume: number }> = {};
        (json?.effects ?? []).forEach((row: any) => {
          const key = String(row?.key ?? "");
          const url = String(row?.audio_url ?? "");
          if (!key || !url) return;
          map[key] = { url, volume: Math.min(1, Math.max(0, Number(row?.volume ?? 1))) };
        });
        setSounds(map);
      } catch {}
    })();
  }, []);

  function playSound(key: string) {
    const entry = sounds[key];
    if (!entry?.url) {
      if (key === "rule_keeper") playFallbackBeep();
      return;
    }
    const audio = new Audio(entry.url);
    audio.volume = entry.volume;
    audio.play().catch(() => {});
  }

  function playFallbackBeep() {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.value = 0.12;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
      osc.onended = () => ctx.close();
    } catch {}
  }

  return (
    <div style={{ position: "relative" }}>
      {/* Full-page glow */}
      <div
        aria-hidden
        style={{
          pointerEvents: "none",
          position: "fixed",
          inset: 0,
          zIndex: 40,
          boxShadow:
            glow === "green"
              ? "inset 0 0 0 3px rgba(34,197,94,0.75), inset 0 0 80px rgba(34,197,94,0.18)"
              : glow === "red"
              ? "inset 0 0 0 3px rgba(239,68,68,0.75), inset 0 0 80px rgba(239,68,68,0.16)"
              : "none",
          transition: "box-shadow 0.18s ease",
        }}
      />

      {/* Redemption banner overlay */}
      {redeem && (
        <div
          style={{
            position: "fixed",
            top: 110,
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(520px, 88vw)",
            zIndex: 9999,
            borderRadius: 18,
            padding: "14px 16px",
            border: "1px solid rgba(255,255,255,0.16)",
            background: "linear-gradient(90deg, rgba(250,204,21,0.18), rgba(59,130,246,0.12))",
            boxShadow: "0 18px 70px rgba(0,0,0,0.42)",
            fontWeight: 1000,
            textAlign: "center",
            letterSpacing: 0.2,
          }}
        >
          🎁 {redeem.text}
        </div>
      )}

      {children}
    </div>
  );
}

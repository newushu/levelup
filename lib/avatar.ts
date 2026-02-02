// Avatar levels are driven by lifetime points.
// 99 levels for now. You can adjust thresholds later.

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// Simple curve: level increases every 100 lifetime points at low levels,
// then slows down slightly. Keeps early progression feeling good.
export function avatarLevelFromLifetime(lifetimePoints: number): number {
  const p = Math.max(0, lifetimePoints);

  // Piecewise curve:
  // 0-2000: +1 lvl per 50 pts (fast early)
  // 2000-10000: +1 lvl per 120 pts
  // 10000+: +1 lvl per 250 pts
  let lvl = 1;

  if (p <= 2000) {
    lvl = 1 + Math.floor(p / 50);
  } else if (p <= 10000) {
    lvl = 1 + Math.floor(2000 / 50) + Math.floor((p - 2000) / 120);
  } else {
    lvl =
      1 +
      Math.floor(2000 / 50) +
      Math.floor((10000 - 2000) / 120) +
      Math.floor((p - 10000) / 250);
  }

  return clamp(lvl, 1, 99);
}

export type AvatarBase = "dragon" | "panda";

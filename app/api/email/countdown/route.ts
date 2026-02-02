import { NextRequest } from "next/server";

export const runtime = "nodejs";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function parseEnd(param: string | null) {
  if (!param) return null;
  const date = new Date(param);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const endParam = searchParams.get("end");
  const end = parseEnd(endParam);
  const now = new Date();
  const diff = Math.max(0, (end?.getTime() ?? now.getTime()) - now.getTime());
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="280" height="64" viewBox="0 0 280 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Countdown">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#bfe7ff" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#7cf7d4" stop-opacity="0.18"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="280" height="64" rx="12" fill="url(#bg)" stroke="rgba(255,255,255,0.25)"/>
  ${renderBox(12, 10, pad(days), "DAYS")}
  ${renderBox(74, 10, pad(hours), "HRS")}
  ${renderBox(136, 10, pad(mins), "MIN")}
  ${renderBox(198, 10, pad(secs), "SEC")}
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

function renderBox(x: number, y: number, value: string, label: string) {
  return `
    <g>
      <rect x="${x}" y="${y}" width="54" height="44" rx="10" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.2)"/>
      <text x="${x + 27}" y="${y + 20}" text-anchor="middle" font-size="16" font-weight="800" fill="#eaf2ff" font-family="Arial, sans-serif">${value}</text>
      <text x="${x + 27}" y="${y + 36}" text-anchor="middle" font-size="9" letter-spacing="1.5" fill="rgba(234,242,255,0.7)" font-family="Arial, sans-serif">${label}</text>
    </g>`;
}

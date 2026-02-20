"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import AuthGate from "@/components/AuthGate";

export default function StudentClassToolsPage() {
  const tools = useMemo(
    () => [
      {
        key: "taolu-display",
        name: "Taolu Tracker Display",
        sub: "Recent tracker logs, cumulative cards, and push-to-display controls.",
        href: "/student/class-tools/taolu",
        tone: "tool-card--cyan",
        emoji: "🥋",
        enabled: true,
      },
      {
        key: "placeholder-2",
        name: "Coming Soon",
        sub: "Coming soon.",
        href: "",
        tone: "tool-card--amber",
        emoji: "🧪",
        enabled: false,
      },
      {
        key: "placeholder-3",
        name: "Coming Soon",
        sub: "Coming soon.",
        href: "",
        tone: "tool-card--rose",
        emoji: "⚡",
        enabled: false,
      },
    ],
    []
  );

  const railRef = useRef<HTMLDivElement | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  function updateFocusFromScroll() {
    const rail = railRef.current;
    if (!rail) return;
    const centerX = rail.scrollLeft + rail.clientWidth / 2;
    const cards = Array.from(rail.querySelectorAll<HTMLElement>("[data-tool-idx]"));
    if (!cards.length) return;
    let closestIdx = 0;
    let closestDist = Number.POSITIVE_INFINITY;
    cards.forEach((card, idx) => {
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const dist = Math.abs(cardCenter - centerX);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = idx;
      }
    });
    setActiveIdx(closestIdx);
  }

  function scrollToIndex(nextIdx: number) {
    const clamped = Math.max(0, Math.min(tools.length - 1, nextIdx));
    const rail = railRef.current;
    if (!rail) return;
    const card = rail.querySelector<HTMLElement>(`[data-tool-idx="${clamped}"]`);
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    setActiveIdx(clamped);
  }

  return (
    <AuthGate>
      <main className="class-tools-page">
        <div className="class-tools-title">Class Tools</div>
        <div className="class-tools-sub">Swipe or use arrows to focus a tool.</div>

        <section className="tool-rail-wrap">
          <button
            type="button"
            className="tool-rail-arrow tool-rail-arrow--left"
            onClick={() => scrollToIndex(activeIdx - 1)}
            aria-label="Previous tool"
          >
            ‹
          </button>
          <div className="tool-rail" ref={railRef} onScroll={updateFocusFromScroll}>
            {tools.map((tool, idx) => {
              const focused = idx === activeIdx;
              const className = `tool-card ${tool.tone} ${focused ? "tool-card--focused" : "tool-card--blurred"}`;
              if (tool.enabled && tool.href) {
                return (
                  <Link
                    key={tool.key}
                    href={tool.href}
                    className={className}
                    data-tool-idx={idx}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onFocus={() => setActiveIdx(idx)}
                  >
                    <div className="tool-card__emoji">{tool.emoji}</div>
                    <div className="tool-card__name">{tool.name}</div>
                    <div className="tool-card__sub">{tool.sub}</div>
                    <div className="tool-card__cta">Open Tool</div>
                  </Link>
                );
              }
              return (
                <button
                  key={tool.key}
                  type="button"
                  className={className}
                  data-tool-idx={idx}
                  onMouseEnter={() => setActiveIdx(idx)}
                  onFocus={() => setActiveIdx(idx)}
                >
                  <div className="tool-card__emoji">{tool.emoji}</div>
                  <div className="tool-card__name">{tool.name}</div>
                  <div className="tool-card__sub">{tool.sub}</div>
                  <div className="tool-card__cta tool-card__cta--disabled">Soon</div>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="tool-rail-arrow tool-rail-arrow--right"
            onClick={() => scrollToIndex(activeIdx + 1)}
            aria-label="Next tool"
          >
            ›
          </button>
        </section>

        <style>{`
          .class-tools-page {
            padding-left: 252px;
            padding-right: 14px;
            min-height: 100vh;
            display: grid;
            align-content: start;
            justify-items: center;
            gap: 12px;
          }
          .class-tools-title {
            width: 100%;
            font-size: 32px;
            font-weight: 1000;
            letter-spacing: 0.2px;
          }
          .class-tools-sub {
            width: 100%;
            font-size: 13px;
            opacity: 0.78;
          }
          .tool-rail-wrap {
            position: relative;
            width: clamp(340px, calc(100vw - 300px), 400px);
            min-height: 470px;
            border-radius: 20px;
            border: 1px solid rgba(148,163,184,0.24);
            background: linear-gradient(150deg, rgba(15,23,42,0.9), rgba(2,6,23,0.96));
            box-shadow: 0 20px 44px rgba(0,0,0,0.45);
            padding: 18px 50px;
            overflow: hidden;
          }
          .tool-rail-wrap::before,
          .tool-rail-wrap::after {
            content: "";
            position: absolute;
            top: 0;
            bottom: 0;
            width: 42px;
            pointer-events: none;
            z-index: 3;
          }
          .tool-rail-wrap::before {
            left: 0;
            background: linear-gradient(90deg, rgba(2,6,23,0.9), rgba(2,6,23,0));
          }
          .tool-rail-wrap::after {
            right: 0;
            background: linear-gradient(270deg, rgba(2,6,23,0.9), rgba(2,6,23,0));
          }
          .tool-rail {
            display: grid;
            grid-auto-flow: column;
            grid-auto-columns: 290px;
            gap: 26px;
            overflow-x: auto;
            padding: 6px 2px;
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
          }
          .tool-rail::-webkit-scrollbar {
            height: 8px;
          }
          .tool-rail::-webkit-scrollbar-thumb {
            border-radius: 999px;
            background: rgba(148,163,184,0.35);
          }
          .tool-card {
            scroll-snap-align: center;
            width: 100%;
            box-sizing: border-box;
            border-radius: 18px;
            min-height: 390px;
            aspect-ratio: 1 / 1;
            text-decoration: none;
            color: white;
            border: 1px solid rgba(148,163,184,0.26);
            background: linear-gradient(150deg, rgba(30,41,59,0.88), rgba(15,23,42,0.86));
            box-shadow: 0 14px 28px rgba(0,0,0,0.38);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 10px;
            padding: 14px;
            text-align: center;
            overflow: hidden;
            isolation: isolate;
            transition: filter 160ms ease, opacity 160ms ease, border-color 160ms ease;
          }
          .tool-card--focused {
            filter: blur(0);
            opacity: 1;
            border-color: rgba(255,255,255,0.55);
          }
          .tool-card--blurred {
            filter: blur(1.4px);
            opacity: 0.56;
          }
          .tool-card--cyan { background: linear-gradient(145deg, rgba(8,145,178,0.52), rgba(15,23,42,0.9)); }
          .tool-card--amber { background: linear-gradient(145deg, rgba(217,119,6,0.52), rgba(15,23,42,0.9)); }
          .tool-card--rose { background: linear-gradient(145deg, rgba(225,29,72,0.52), rgba(15,23,42,0.9)); }
          .tool-card__emoji {
            font-size: 28px;
            line-height: 1;
          }
          .tool-card__name {
            font-size: 18px;
            font-weight: 1000;
            line-height: 1.05;
            text-align: center;
          }
          .tool-card__sub {
            font-size: 12px;
            opacity: 0.84;
            line-height: 1.35;
            text-align: center;
          }
          .tool-card__cta {
            display: inline-flex;
            width: fit-content;
            border-radius: 999px;
            border: 1px solid rgba(255,255,255,0.35);
            background: rgba(15,23,42,0.42);
            padding: 6px 10px;
            font-size: 11px;
            font-weight: 1000;
            text-transform: uppercase;
            letter-spacing: 0.55px;
          }
          .tool-card__cta--disabled {
            opacity: 0.72;
          }
          .tool-rail-arrow {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            z-index: 4;
            width: 24px;
            height: 24px;
            border-radius: 999px;
            border: 1px solid rgba(148,163,184,0.45);
            background: rgba(15,23,42,0.85);
            color: #e2e8f0;
            font-size: 18px;
            font-weight: 1000;
            line-height: 1;
            display: grid;
            place-items: center;
            cursor: pointer;
          }
          .tool-rail-arrow--left { left: 10px; }
          .tool-rail-arrow--right { right: 10px; }
          @media (max-width: 1100px) {
            .class-tools-page { padding-left: 0 !important; padding-right: 0; padding-bottom: 92px; }
            .tool-rail-wrap {
              width: min(372px, calc(100vw - 16px));
              min-height: 450px;
              padding: 14px 34px;
            }
            .tool-rail { grid-auto-columns: 290px; gap: 22px; }
            .tool-card { min-height: 372px; }
          }
        `}</style>
      </main>
    </AuthGate>
  );
}

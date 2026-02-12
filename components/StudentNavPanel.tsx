"use client";

import { usePathname } from "next/navigation";

const items = [
  { key: "home", label: "Student Home", href: "/student", tone: "tone-blue" },
  { key: "info", label: "Student Info", href: "/student/info", tone: "tone-teal" },
  { key: "homequest", label: "Home Quest", href: "/home-quest", tone: "tone-amber" },
  { key: "rewards", label: "Rewards", href: "/rewards", tone: "tone-rose" },
  { key: "logs", label: "Logs & Reports", href: "/my-metrics", tone: "tone-violet" },
  { key: "challenges", label: "Challenge Vault", href: "/student/challenges", tone: "tone-green" },
];

export default function StudentNavPanel() {
  const path = usePathname();
  return (
    <div className="student-nav">
      <div className="student-nav__title">Navigation</div>
      <div className="student-nav__list">
        {items.map((item) => (
          <a
            key={item.key}
            href={item.href}
            className={`student-nav__item ${item.tone} ${path === item.href ? "student-nav__item--active" : ""}`}
          >
            {item.label}
          </a>
        ))}
      </div>
    </div>
  );
}

export function studentNavStyles() {
  return `
    .student-nav {
      position: fixed;
      left: 16px;
      top: 140px;
      width: 220px;
      height: calc(100vh - 180px);
      display: grid;
      grid-template-rows: auto 1fr;
      gap: 14px;
      padding: 16px;
      border-radius: 18px;
      background: linear-gradient(160deg, rgba(12,18,32,0.98), rgba(6,12,24,0.95));
      border: 1px solid rgba(148,163,184,0.18);
      box-shadow: 0 18px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06);
      z-index: 50;
    }

    .student-nav__title {
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 1px;
      text-transform: uppercase;
      opacity: 0.7;
    }

    .student-nav__list {
      display: grid;
      gap: 12px;
      align-content: start;
    }

    .student-nav__item {
      min-height: 88px;
      padding: 12px;
      border-radius: 16px;
      text-decoration: none;
      color: inherit;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      font-size: 12px;
      display: grid;
      place-items: center;
      text-align: center;
      background: linear-gradient(160deg, rgba(34,197,94,0.35), rgba(15,23,42,0.85));
      border: 1px solid rgba(148,163,184,0.16);
      box-shadow: 0 10px 18px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.12);
      transition: transform 120ms ease, border-color 160ms ease, box-shadow 120ms ease;
    }

    .student-nav__item.tone-blue {
      background: linear-gradient(160deg, rgba(59,130,246,0.45), rgba(15,23,42,0.85));
      border-color: rgba(59,130,246,0.35);
    }

    .student-nav__item.tone-teal {
      background: linear-gradient(160deg, rgba(20,184,166,0.45), rgba(15,23,42,0.85));
      border-color: rgba(20,184,166,0.35);
    }

    .student-nav__item.tone-amber {
      background: linear-gradient(160deg, rgba(245,158,11,0.45), rgba(15,23,42,0.85));
      border-color: rgba(245,158,11,0.35);
    }

    .student-nav__item.tone-rose {
      background: linear-gradient(160deg, rgba(244,63,94,0.45), rgba(15,23,42,0.85));
      border-color: rgba(244,63,94,0.35);
    }

    .student-nav__item.tone-violet {
      background: linear-gradient(160deg, rgba(139,92,246,0.45), rgba(15,23,42,0.85));
      border-color: rgba(139,92,246,0.35);
    }

    .student-nav__item.tone-green {
      background: linear-gradient(160deg, rgba(34,197,94,0.45), rgba(15,23,42,0.85));
      border-color: rgba(34,197,94,0.35);
    }

    .student-nav__item--active {
      border-color: rgba(255,255,255,0.5);
      box-shadow: inset 0 2px 6px rgba(0,0,0,0.45), 0 0 18px rgba(34,197,94,0.25);
      transform: translateY(2px);
    }

    .student-nav__item:hover {
      transform: translateY(-1px);
      border-color: rgba(34,197,94,0.55);
    }

    .student-nav__item:active {
      transform: translateY(3px);
      box-shadow: inset 0 3px 8px rgba(0,0,0,0.5);
    }

    @media (max-width: 1100px) {
      .student-nav {
        position: static;
        width: 100%;
        height: auto;
      }
      .student-nav__list {
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      }
    }
  `;
}

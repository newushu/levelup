"use client";

import { usePathname } from "next/navigation";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const isDisplay = path.startsWith("/display");
  const isClassroom = path.startsWith("/classroom");
  const isLessonForge = path.startsWith("/tools/lesson-forge");
  const isCoach = path.startsWith("/coach");
  const isCampMenu = path.startsWith("/camp/menu");
  const isCampRegister = path.startsWith("/camp/register");
  const isWide =
    path === "/" ||
    path.startsWith("/skill-tracker") ||
    path.startsWith("/performance-lab") ||
    path.startsWith("/taolu-tracker") ||
    isLessonForge ||
    isClassroom ||
    isDisplay ||
    isCoach;
  const maxWidth = isDisplay
    ? "none"
    : isClassroom
    ? 1840
    : isCampMenu
    ? 1800
    : isCampRegister
    ? "none"
    : isCoach
    ? 1800
    : isWide
    ? 1680
    : 1100;
  const padding = isDisplay
    ? "0 0 60px"
    : isLessonForge
    ? "6px 12px 60px"
    : isClassroom
    ? "2px 2px 40px"
    : isCoach
    ? "10px 20px 40px"
    : "14px 14px 60px";

  return <div style={{ maxWidth, margin: "0 auto", padding }}>{children}</div>;
}

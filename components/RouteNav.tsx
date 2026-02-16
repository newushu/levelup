"use client";

import { usePathname } from "next/navigation";
import NavBar from "./NavBar";

export default function RouteNav() {
  const path = usePathname();
  const isParent = path.startsWith("/parent");
  const hideNav =
    isParent ||
    path === "/camp" ||
    path.startsWith("/camp/register") ||
    path.startsWith("/camp/classroom") ||
    path.startsWith("/spin") ||
    path === "/classroom";
  if (hideNav) return null;
  return (
    <>
      <NavBar />
      <div style={{ height: 20 }} />
    </>
  );
}

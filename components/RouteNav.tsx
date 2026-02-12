"use client";

import { usePathname } from "next/navigation";
import NavBar from "./NavBar";

export default function RouteNav() {
  const path = usePathname();
  const isParent = path.startsWith("/parent");
  if (isParent) return null;
  return (
    <>
      <NavBar />
      <div style={{ height: 20 }} />
    </>
  );
}

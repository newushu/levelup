"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { setGlobalSounds } from "@/lib/globalAudio";
import GlobalFx from "./GlobalFx";
import AnnouncementBar from "./AnnouncementBar";
import BadgeOverlayManager from "./BadgeOverlayManager";
import BannerAnnouncement from "./BannerAnnouncement";
import ParentMarketingCard from "./ParentMarketingCard";

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const isHome = path === "/";
  const isLogin = path.startsWith("/login");
  const isClassroom = path.startsWith("/classroom");
  const isAdmin = path.startsWith("/admin");
  const isEmbed = useSearchParams().get("embed") === "1";
  const isParentAllowed =
    path.startsWith("/parent") ||
    path.startsWith("/dashboard") ||
    path.startsWith("/home-quest") ||
    path.startsWith("/login") ||
    path.startsWith("/reset-password") ||
    path.startsWith("/logout");
  const [role, setRole] = useState("");
  const showBanner = !isEmbed && !isHome && !isLogin && !isClassroom && ["student", "parent"].includes(role);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/sound-effects/list", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;
        const map: Record<string, { url: string; volume: number }> = {};
        (data.effects ?? []).forEach((row: any) => {
          const key = String(row?.key ?? "");
          const url = String(row?.audio_url ?? "");
          if (!key || !url) return;
          map[key] = { url, volume: Math.min(1, Math.max(0, Number(row?.volume ?? 1))) };
        });
        setGlobalSounds(map);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (path === "/reset-password") return;
    const hash = window.location.hash || "";
    if (hash.includes("type=recovery")) {
      router.replace(`/reset-password${hash}`);
    }
  }, [path, router]);

  useEffect(() => {
    if (isHome || isLogin) return;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) return;
        setRole(String(data?.role ?? ""));
        if (data?.role === "parent" && !isParentAllowed) {
          router.replace("/parent");
        }
      } catch {}
    })();
  }, [isHome, isLogin, isParentAllowed, router]);

  return (
    <GlobalFx>
      {showBanner ? (
        <>
          <BannerAnnouncement />
          <div style={{ height: 150 }} />
        </>
      ) : null}
      {!isEmbed && !isHome && !isLogin && !isClassroom ? <AnnouncementBar /> : null}
      {isAdmin ? <div style={{ height: 20 }} /> : null}
      <BadgeOverlayManager />
      {children}
      {showBanner && role === "parent" ? <ParentMarketingCard /> : null}
    </GlobalFx>
  );
}

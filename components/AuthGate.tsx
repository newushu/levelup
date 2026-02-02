"use client";

import { useEffect, useState } from "react";

export default function AuthGate({
  children,
  redirectDelayMs = 0,
}: {
  children: React.ReactNode;
  redirectDelayMs?: number;
}) {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    let redirectTimer: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json();
        if (data?.ok) setOk(true);
        else {
          setOk(false);
          if (redirectDelayMs > 0) {
            redirectTimer = window.setTimeout(() => {
              window.location.href = "/login";
            }, redirectDelayMs);
          } else {
            window.location.href = "/login";
          }
        }
      } catch {
        setOk(false);
        if (redirectDelayMs > 0) {
          redirectTimer = window.setTimeout(() => {
            window.location.href = "/login";
          }, redirectDelayMs);
        } else {
          window.location.href = "/login";
        }
      }
    })();
    return () => {
      if (redirectTimer) window.clearTimeout(redirectTimer);
    };
  }, []);

  if (ok === null) return <div style={{ padding: 18, opacity: 0.8 }}>Checking session…</div>;
  if (ok === false) return null;
  return <>{children}</>;
}

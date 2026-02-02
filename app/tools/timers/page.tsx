"use client";

import { useEffect, useState } from "react";
import AuthGate from "../../../components/AuthGate";
import TimerTool from "@/components/TimerTool";

export default function TimersPage() {
  const [studentBlocked, setStudentBlocked] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json();
        if (data?.ok && data?.role === "student") setStudentBlocked(true);
      } catch {}
    })();
  }, []);

  return (
    <AuthGate>
      {studentBlocked ? (
        <div style={{ padding: 18 }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>Timers are coach-only.</div>
          <div style={{ opacity: 0.7, marginTop: 6 }}>Student accounts cannot access this page.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
            <div style={{ fontSize: 28, fontWeight: 1100 }}>Timers</div>
            <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>Coach tools</div>
          </div>

          <div style={hero()}>
            <div style={{ fontWeight: 1000, fontSize: 18 }}>Session Timers</div>
            <div style={{ opacity: 0.75, marginTop: 6 }}>
              Launch interval timers for drills, rounds, and station work. More tools coming soon.
            </div>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <TimerTool title="Class Timer" contextLabel="Preset intervals + admin-selected music." selectable />
          </div>
        </div>
      )}
    </AuthGate>
  );
}

function hero(): React.CSSProperties {
  return {
    borderRadius: 22,
    padding: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "linear-gradient(135deg, rgba(59,130,246,0.25), rgba(2,6,23,0.65))",
    boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
  };
}

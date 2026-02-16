"use client";

import { useEffect, useState } from "react";
import AuthGate from "../../../components/AuthGate";
import { DashboardInner } from "../../dashboard/page";

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 180)}` } };
  }
}

export default function StudentDashboardPage() {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const sj = await safeJson(res);
      if (!sj.ok || sj.json?.role !== "student") {
        window.location.href = "/dashboard";
        return;
      }
      setChecked(true);
    })();
  }, []);

  return (
    <AuthGate>
      <div className="student-route-shell">
        <style>{`
          .student-route-shell {
            padding-left: 252px;
            min-height: 100vh;
          }
          @media (max-width: 1100px) {
            .student-route-shell {
              padding-left: 0;
              padding-bottom: 92px;
            }
          }
        `}</style>
        {checked ? <DashboardInner /> : <div style={{ padding: 18, opacity: 0.8 }}>Loading student dashboard…</div>}
      </div>
    </AuthGate>
  );
}

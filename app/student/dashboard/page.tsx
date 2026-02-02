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
      {checked ? <DashboardInner /> : <div style={{ padding: 18, opacity: 0.8 }}>Loading student dashboard…</div>}
    </AuthGate>
  );
}

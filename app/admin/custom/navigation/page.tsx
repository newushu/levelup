"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "nav_student_links";

export default function NavigationAdminPage() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    try {
      setEnabled(localStorage.getItem(STORAGE_KEY) === "true");
    } catch {}
  }, []);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
      window.dispatchEvent(new CustomEvent("nav-links-changed", { detail: { enabled: next } }));
    } catch {}
  }

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 1000 }}>App Navigation</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Control student name links in roster and top bar.</div>
        </div>
        <Link href="/admin/custom" style={backLink()}>
          Return to Custom
        </Link>
      </div>

      <div style={card()}>
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>Student Name Links</div>
        <div style={{ opacity: 0.75, fontSize: 12, marginBottom: 12 }}>
          When enabled, clicking a student name in the classroom roster or top bar will open their dashboard.
        </div>
        <button onClick={toggle} style={toggleBtn(enabled)}>
          {enabled ? "Enabled" : "Disabled"}
        </button>
      </div>
    </main>
  );
}

function card(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: 14,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
  };
}

function toggleBtn(on: boolean): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 999,
    border: on ? "1px solid rgba(34,197,94,0.5)" : "1px solid rgba(255,255,255,0.14)",
    background: on ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  };
}

function backLink(): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 12,
  };
}

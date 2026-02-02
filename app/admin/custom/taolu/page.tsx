"use client";

import Link from "next/link";

export default function TaoluAdminPage() {
  return (
    <main style={{ display: "grid", gap: 16 }}>
      <Link href="/admin/custom" style={backLink()}>← Back to Admin Workspace</Link>
      <div style={{ fontSize: 28, fontWeight: 1000 }}>Form Forge (Taolu Tracker)</div>
      <div style={{ opacity: 0.75, fontSize: 13 }}>
        Configure how Taolu tracking runs on the floor. Forms, age groups, deduction codes, and report windows
        are managed in IWUF Scoring Rules.
      </div>

      <div style={card()}>
        <div style={{ fontWeight: 1000 }}>Quick Links</div>
        <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
          <Link href="/admin/custom/iwuf-scoring" style={linkBtn()}>
            Open IWUF Scoring Rules →
          </Link>
          <Link href="/taolu-tracker" style={linkBtn()}>
            Open Taolu Tracker →
          </Link>
        </div>
      </div>

      <div style={card()}>
        <div style={{ fontWeight: 1000 }}>Notes</div>
        <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
          Taolu forms and age groups are defined in IWUF Scoring Rules. Update deduction codes there so coaches can
          assign them after tracking. Report windows (30/60/90 days, etc.) also live in IWUF Scoring Rules.
        </div>
      </div>
    </main>
  );
}

function card(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    display: "grid",
    gap: 8,
  };
}

function linkBtn(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    textDecoration: "none",
    width: "fit-content",
  };
}

function backLink(): React.CSSProperties {
  return {
    color: "rgba(255,255,255,0.8)",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 900,
  };
}

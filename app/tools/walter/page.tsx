"use client";

import Link from "next/link";

export default function WalterPage() {
  return (
    <main style={page()}>
      <div style={header()}>
        <div>
          <div style={title()}>WALTER</div>
          <div style={subtitle()}>Wushu Assistive Learning Tools for Evaluation + Refinement.</div>
        </div>
        <Link href="/tools" style={backLink()}>
          Back to Tools
        </Link>
      </div>

      <section style={grid()}>
        <div style={card("linear-gradient(135deg, rgba(244,114,182,0.3), rgba(2,6,23,0.75))")}> 
          <div style={{ fontWeight: 1000 }}>FormLoop</div>
          <div style={{ opacity: 0.75, fontSize: 12 }}>
            Learning Taolu video loop tool. Mark segments, loop, slow down, mirror.
          </div>
          <a href="/tools/walter/form-loop" style={linkBtn()}>
            Open FormLoop →
          </a>
        </div>
        <div style={card("linear-gradient(135deg, rgba(14,165,233,0.28), rgba(2,6,23,0.75))")}> 
          <div style={{ fontWeight: 1000 }}>Taolu Tracker</div>
          <div style={{ opacity: 0.75, fontSize: 12 }}>
            Live scoring + deductions tracking for taolu sessions.
          </div>
          <a href="/taolu-tracker" style={linkBtn()}>
            Open tracker →
          </a>
        </div>
        <div style={card("linear-gradient(135deg, rgba(16,185,129,0.28), rgba(2,6,23,0.75))")}> 
          <div style={{ fontWeight: 1000 }}>PREPS Tracker</div>
          <div style={{ opacity: 0.75, fontSize: 12 }}>
            PREPS sessions with remediation and progress tracking.
          </div>
          <a href="/preps-tracker" style={linkBtn()}>
            Open PREPS →
          </a>
        </div>
      </section>
    </main>
  );
}

function page(): React.CSSProperties {
  return {
    minHeight: "100vh",
    padding: 20,
    color: "white",
    display: "grid",
    gap: 16,
    background:
      "radial-gradient(circle at top left, rgba(244,114,182,0.25), transparent 55%), linear-gradient(135deg, rgba(2,6,23,0.98), rgba(15,23,42,0.92))",
  };
}

function header(): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  };
}

function title(): React.CSSProperties {
  return {
    fontSize: 28,
    fontWeight: 1000,
    letterSpacing: 0.3,
  };
}

function subtitle(): React.CSSProperties {
  return {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 6,
  };
}

function backLink(): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 12,
  };
}

function grid(): React.CSSProperties {
  return {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  };
}

function card(accent: string): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: accent,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 16px 40px rgba(0,0,0,0.35)",
    display: "grid",
    gap: 8,
    minHeight: 130,
  };
}

function linkBtn(): React.CSSProperties {
  return {
    justifySelf: "start",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.1)",
    fontSize: 11,
    fontWeight: 900,
    color: "white",
    textDecoration: "none",
  };
}

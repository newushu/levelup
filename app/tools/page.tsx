"use client";

import { useEffect, useState } from "react";
import AuthGate from "../../components/AuthGate";
import TimerTool from "@/components/TimerTool";

export default function ToolsPage() {
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
          <div style={{ fontSize: 22, fontWeight: 900 }}>Tools are coach-only.</div>
          <div style={{ opacity: 0.7, marginTop: 6 }}>Student accounts cannot access this page.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontSize: 28, fontWeight: 1100 }}>Tools</div>
          <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>Games + IWUF scoring</div>
        </div>

        <div style={hero()}>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>Wushu Tools Hub</div>
          <div style={{ opacity: 0.75, marginTop: 6 }}>
            A clean launchpad for digital games and scoring systems. Built for quick class access.
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ fontWeight: 1000, fontSize: 16 }}>Digital Games</div>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <div style={toolCard("linear-gradient(135deg, rgba(59,130,246,0.35), rgba(2,6,23,0.65))")}>
              <div style={{ fontWeight: 1000 }}>Game 1</div>
              <div style={{ opacity: 0.75, marginTop: 6, fontSize: 12 }}>Wushu skill mini-game placeholder.</div>
              <div style={tag()}>Coming soon</div>
            </div>
            <div style={toolCard("linear-gradient(135deg, rgba(16,185,129,0.35), rgba(2,6,23,0.65))")}>
              <div style={{ fontWeight: 1000 }}>Game 2</div>
              <div style={{ opacity: 0.75, marginTop: 6, fontSize: 12 }}>Reaction + timing challenge placeholder.</div>
              <div style={tag()}>Coming soon</div>
            </div>
            <div style={toolCard("linear-gradient(135deg, rgba(251,146,60,0.35), rgba(2,6,23,0.65))")}>
              <div style={{ fontWeight: 1000 }}>Game 3</div>
              <div style={{ opacity: 0.75, marginTop: 6, fontSize: 12 }}>Balance + control drill placeholder.</div>
              <div style={tag()}>Coming soon</div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ fontWeight: 1000, fontSize: 16 }}>Coach Utilities</div>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            <TimerTool title="Class Timer" contextLabel="Preset intervals + admin-selected music." selectable />
            <div style={toolCard("linear-gradient(135deg, rgba(14,116,144,0.35), rgba(2,6,23,0.65))")}>
              <div style={{ fontWeight: 1000 }}>Video Library</div>
              <div style={{ opacity: 0.75, marginTop: 6, fontSize: 12 }}>
                Search training clips by tag and technique.
              </div>
              <a href="/tools/video-library" style={linkBtn()}>
                Open library →
              </a>
            </div>
            <div style={toolCard("linear-gradient(135deg, rgba(248,113,113,0.3), rgba(2,6,23,0.7))")}>
              <div style={{ fontWeight: 1000 }}>LessonForge</div>
              <div style={{ opacity: 0.75, marginTop: 6, fontSize: 12 }}>
                Run saved class templates with timer, video, and score tools.
              </div>
              <a href="/tools/lesson-forge" style={linkBtn()}>
                Open runner →
              </a>
            </div>
            <div style={toolCard("linear-gradient(135deg, rgba(16,185,129,0.35), rgba(2,6,23,0.65))")}>
              <div style={{ fontWeight: 1000 }}>CTF Scorekeeper</div>
              <div style={{ opacity: 0.75, marginTop: 6, fontSize: 12 }}>
                Capture-the-flag scoring with round timer + sound cues.
              </div>
              <a href="/tools/scorekeeper" style={linkBtn()}>
                Open scorekeeper →
              </a>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ fontWeight: 1000, fontSize: 16 }}>Scoring Systems</div>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            <div style={toolCard("linear-gradient(135deg, rgba(139,92,246,0.35), rgba(2,6,23,0.65))")}>
              <div style={{ fontWeight: 1000 }}>IWUF Scoring System</div>
              <div style={{ opacity: 0.75, marginTop: 6, fontSize: 12 }}>Full judging layout with D/E/A breakdown.</div>
              <div style={tag()}>Tool placeholder</div>
            </div>
            <div style={toolCard("linear-gradient(135deg, rgba(236,72,153,0.35), rgba(2,6,23,0.65))")}>
              <div style={{ fontWeight: 1000 }}>IWUF Simplified Scoring</div>
              <div style={{ opacity: 0.75, marginTop: 6, fontSize: 12 }}>Fast scoring for class sessions.</div>
              <div style={tag()}>Tool placeholder</div>
            </div>
          </div>
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
    background:
      "radial-gradient(circle at top right, rgba(59,130,246,0.25), transparent 60%), linear-gradient(135deg, rgba(2,6,23,0.95), rgba(15,23,42,0.85))",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 16px 40px rgba(0,0,0,0.35)",
  };
}

function toolCard(accent: string): React.CSSProperties {
  return {
    borderRadius: 20,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: accent,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 16px 40px rgba(0,0,0,0.35)",
    display: "grid",
    gap: 8,
    minHeight: 120,
  };
}

function tag(): React.CSSProperties {
  return {
    justifySelf: "start",
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.1)",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0.2,
    marginTop: 10,
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

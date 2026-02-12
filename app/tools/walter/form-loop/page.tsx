"use client";

import Link from "next/link";

export default function FormLoopPage() {
  return (
    <main style={page()}>
      <div style={header()}>
        <div>
          <div style={title()}>FormLoop</div>
          <div style={subtitle()}>
            Learning Taolu video loop tool placeholder: mark segments, loop, slow down, and mirror.
          </div>
        </div>
        <Link href="/tools/walter" style={backLink()}>
          Back to WALTER
        </Link>
      </div>

      <section style={stage()}>
        <div style={videoShell()}>
          <div style={videoHeader()}>
            <div style={{ fontWeight: 900 }}>Video Stage</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>Paste a YouTube URL to load playback</div>
          </div>
          <div style={videoViewport()}>
            <div style={videoPlaceholder()}>
              <div style={{ fontWeight: 900, fontSize: 14 }}>YouTube video loads here</div>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                Playback, speed, mirror, and frame snapshots will appear in this panel.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={controls()}>
        <div style={controlRow()}>
          <input placeholder="Paste YouTube URL" style={controlInput()} />
          <button style={controlBtn("primary")}>Load video</button>
          <button style={controlBtn("ghost")}>Mirror view</button>
          <button style={controlBtn("ghost")}>Slow motion</button>
        </div>
        <div style={controlRow()}>
          <button style={controlBtn("ghost")}>Play / Pause</button>
          <button style={controlBtn("ghost")}>Step back</button>
          <button style={controlBtn("ghost")}>Step forward</button>
          <select style={controlSelect()}>
            <option>Speed 0.25x</option>
            <option>Speed 0.5x</option>
            <option>Speed 0.75x</option>
            <option>Speed 1x</option>
          </select>
          <button style={controlBtn("accent")}>Mark loop point</button>
        </div>
      </section>

      <section style={timeline()}>
        <div style={timelineHeader()}>
          <div style={{ fontWeight: 900 }}>Loop Markers</div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>Drag markers, click to jump, hotkey: L</div>
        </div>
        <div style={timelineTrack()}>
          <div style={timelineFill()} />
          <div style={timelineMarker("12%")}>A</div>
          <div style={timelineMarker("42%")}>B</div>
          <div style={timelineMarker("68%")}>C</div>
        </div>
        <div style={markerGrid()}>
          <div style={markerCard()}>
            <div style={{ fontWeight: 900 }}>Marker A</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>00:12 • Kick setup</div>
          </div>
          <div style={markerCard()}>
            <div style={{ fontWeight: 900 }}>Marker B</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>00:42 • Transition</div>
          </div>
          <div style={markerCard()}>
            <div style={{ fontWeight: 900 }}>Marker C</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>01:08 • Landing</div>
          </div>
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
    gap: 18,
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
    maxWidth: 640,
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

function stage(): React.CSSProperties {
  return {
    display: "grid",
    gap: 12,
  };
}

function videoShell(): React.CSSProperties {
  return {
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(15,23,42,0.65)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 18px 40px rgba(0,0,0,0.4)",
    padding: 16,
    display: "grid",
    gap: 12,
  };
}

function videoHeader(): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  };
}

function videoViewport(): React.CSSProperties {
  return {
    width: "100%",
    aspectRatio: "16 / 9",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "linear-gradient(135deg, rgba(15,23,42,0.9), rgba(2,6,23,0.9))",
    display: "grid",
    placeItems: "center",
  };
}

function videoPlaceholder(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 18,
    border: "1px dashed rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.04)",
    textAlign: "center",
    maxWidth: 420,
  };
}

function controls(): React.CSSProperties {
  return {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(10,16,30,0.85)",
    padding: 14,
    display: "grid",
    gap: 10,
  };
}

function controlRow(): React.CSSProperties {
  return {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  };
}

function controlInput(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(0,0,0,0.35)",
    color: "white",
    minWidth: 220,
    fontWeight: 900,
  };
}

function controlSelect(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(0,0,0,0.35)",
    color: "white",
    fontWeight: 900,
  };
}

function controlBtn(kind: "primary" | "ghost" | "accent"): React.CSSProperties {
  const palette: Record<string, string> = {
    primary: "linear-gradient(135deg, rgba(244,114,182,0.35), rgba(236,72,153,0.2))",
    ghost: "rgba(255,255,255,0.06)",
    accent: "linear-gradient(135deg, rgba(56,189,248,0.35), rgba(59,130,246,0.2))",
  };
  const border: Record<string, string> = {
    primary: "1px solid rgba(244,114,182,0.5)",
    ghost: "1px solid rgba(255,255,255,0.16)",
    accent: "1px solid rgba(56,189,248,0.45)",
  };
  return {
    padding: "8px 12px",
    borderRadius: 999,
    border: border[kind],
    background: palette[kind],
    color: "white",
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
  };
}

function timeline(): React.CSSProperties {
  return {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.7)",
    padding: 16,
    display: "grid",
    gap: 14,
  };
}

function timelineHeader(): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  };
}

function timelineTrack(): React.CSSProperties {
  return {
    position: "relative",
    height: 14,
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
  };
}

function timelineFill(): React.CSSProperties {
  return {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "45%",
    borderRadius: 999,
    background: "linear-gradient(90deg, rgba(244,114,182,0.35), rgba(56,189,248,0.35))",
  };
}

function timelineMarker(left: string): React.CSSProperties {
  return {
    position: "absolute",
    top: -8,
    left,
    transform: "translateX(-50%)",
    width: 28,
    height: 28,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    background: "rgba(15,23,42,0.95)",
    border: "1px solid rgba(255,255,255,0.25)",
    fontSize: 11,
    fontWeight: 900,
  };
}

function markerGrid(): React.CSSProperties {
  return {
    display: "grid",
    gap: 10,
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  };
}

function markerCard(): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.25)",
  };
}

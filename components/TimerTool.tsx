"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Overlay from "@/components/dashboard/Overlay";

type SoundEffect = {
  id: string;
  key: string;
  label: string;
  audio_url: string | null;
  volume: number | null;
  loop: boolean | null;
};

type TimerSettings = {
  music_url: string;
  end_sound_key: string;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status})` } };
  }
}

function formatSeconds(total: number) {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function TimerTool({
  title = "Timer",
  onComplete,
  contextLabel,
  selectable = false,
  mode = "card",
  triggerLabel = "Open Timer",
  timerTypes = ["class", "ctf"],
  defaultType = "class",
}: {
  title?: string;
  onComplete?: () => void;
  contextLabel?: string;
  selectable?: boolean;
  mode?: "card" | "button";
  triggerLabel?: string;
  timerTypes?: Array<"class" | "ctf">;
  defaultType?: "class" | "ctf";
}) {
  const [effects, setEffects] = useState<SoundEffect[]>([]);
  const [timerSettings, setTimerSettings] = useState<TimerSettings>({ music_url: "", end_sound_key: "" });
  const [duration, setDuration] = useState(60);
  const [remaining, setRemaining] = useState(60);
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [timerType, setTimerType] = useState<"class" | "ctf">(defaultType);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const endRef = useRef<HTMLAudioElement | null>(null);

  const presets = useMemo(() => [10, 30, 60, 90, 120, 300], []);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/sound-effects/list", { cache: "no-store" });
      const sj = await safeJson(res);
      if (!sj.ok) return;
      setEffects((sj.json?.effects ?? []) as SoundEffect[]);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/timer-settings", { cache: "no-store" });
      const sj = await safeJson(res);
      if (!sj.ok) return;
      setTimerSettings({
        music_url: String(sj.json?.settings?.music_url ?? ""),
        end_sound_key: String(sj.json?.settings?.end_sound_key ?? ""),
      });
    })();
  }, []);

  useEffect(() => {
    if (!running) return;
    if (remaining <= 0) return;
    const timer = window.setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running, remaining]);

  useEffect(() => {
    if (!running) return;
    if (remaining > 0) return;
    stopAudio();
    playEndSound();
    setRunning(false);
    setOverlayOpen(false);
    onComplete?.();
  }, [remaining, running, onComplete]);

  useEffect(() => {
    if (!selectable && !overlayOpen) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      }

      if (overlayOpen) {
        if (event.code === "Space") {
          event.preventDefault();
          if (running) {
            setRunning(false);
            stopAudio();
          } else if (remaining < duration) {
            setRunning(true);
            playAudio();
          } else {
            start();
          }
          return;
        }
        if (event.code === "Tab") {
          event.preventDefault();
          reset();
          return;
        }
      }

      if (event.code === "Space" && selectable && selected) {
        event.preventDefault();
        setOverlayOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overlayOpen, running, selectable, selected, remaining, duration]);

  function reset() {
    stopAudio();
    stopEndSound();
    setRunning(false);
    setRemaining(duration);
  }

  function start() {
    if (duration <= 0) return;
    setRemaining(duration);
    setRunning(true);
    playAudio();
  }

  function togglePause() {
    if (!running) {
      setRunning(true);
      playAudio();
      return;
    }
    setRunning(false);
    stopAudio();
  }

  function stopAudio() {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
  }

  function stopEndSound() {
    if (!endRef.current) return;
    endRef.current.pause();
    endRef.current.currentTime = 0;
  }

  function playAudio() {
    const url = timerSettings.music_url?.trim() || "";
    if (!url) return;
    if (!audioRef.current || audioRef.current.src !== url) {
      audioRef.current = new Audio(url);
    }
    audioRef.current.volume = 1;
    audioRef.current.loop = true;
    audioRef.current.play().catch(() => {});
  }

  function playEndSound() {
    const key = timerSettings.end_sound_key?.trim() || "";
    if (!key) return;
    const effect = effects.find((e) => e.key === key);
    const url = effect?.audio_url || "";
    if (!url) return;
    if (!endRef.current || endRef.current.src !== url) {
      endRef.current = new Audio(url);
    }
    const volume = Math.min(1, Math.max(0, Number(effect?.volume ?? 1)));
    endRef.current.volume = volume;
    endRef.current.loop = false;
    endRef.current.play().catch(() => {});
  }

  return (
    <>
      {mode === "button" ? (
        <button onClick={() => setOverlayOpen(true)} style={btnPrimary()}>
          {triggerLabel}
        </button>
      ) : (
        <div
          style={card(selected, selectable)}
          onClick={() => {
            if (!selectable) return;
            setSelected(true);
          }}
        >
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontWeight: 1000 }}>{title}</div>
            {contextLabel ? <div style={{ fontSize: 12, opacity: 0.7 }}>{contextLabel}</div> : null}
            {selectable ? <div style={{ fontSize: 11, opacity: 0.6 }}>{selected ? "Press Space to open timer" : "Click to select timer"}</div> : null}
          </div>

          {timerTypes.length > 1 ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {timerTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setTimerType(type);
                  }}
                  style={chipBtn(timerType === type)}
                >
                  {type === "ctf" ? "CTF Timer" : "Class Timer"}
                </button>
              ))}
            </div>
          ) : null}

          {timerType === "ctf" ? (
            <div style={legend()}>
              <div style={{ fontWeight: 900, fontSize: 12 }}>CTF Hotkeys</div>
              <div style={{ display: "grid", gap: 6, fontSize: 12 }}>
                <div>
                  <b>Left/Right</b> = +1
                </div>
                <div>
                  <b>Shift + Left/Right</b> = +5
                </div>
                <div>
                  <b>Space</b> = start/pause timer
                </div>
                <div>
                  <b>P</b> = safe zone alert
                </div>
              </div>
            </div>
          ) : null}

          <div style={timerFace()}>
            <div style={{ fontSize: 36, fontWeight: 1000 }}>{formatSeconds(remaining)}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Ready in {duration}s</div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {presets.map((sec) => (
              <button
                key={sec}
                onClick={() => {
                  setDuration(sec);
                  setRemaining(sec);
                  setRunning(false);
                  stopAudio();
                }}
                style={presetBtn(duration === sec)}
              >
                {sec}s
              </button>
            ))}
          </div>

          <label style={label()}>
            Custom seconds
            <input
              type="number"
              min={1}
              value={duration}
              onChange={(e) => {
                const next = Math.max(1, Math.floor(Number(e.target.value)));
                setDuration(next);
                setRemaining(next);
              }}
              style={input()}
            />
          </label>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => setOverlayOpen(true)} style={btnPrimary()}>
              Open Timer
            </button>
            <button onClick={reset} style={btnGhost()}>
              Reset
            </button>
          </div>
        </div>
      )}

      {overlayOpen ? (
        <Overlay title={title} onClose={() => setOverlayOpen(false)} maxWidth={900}>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={overlayFace()}>
              <div style={{ fontSize: 110, fontWeight: 1000, letterSpacing: 2 }}>{formatSeconds(remaining)}</div>
              <div style={{ fontSize: 14, opacity: 0.7 }}>
                {running ? "Timer running" : "Ready to start"} • {duration}s
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              {presets.map((sec) => (
                <button
                  key={sec}
                  onClick={() => {
                    setDuration(sec);
                    setRemaining(sec);
                    setRunning(false);
                    stopAudio();
                  }}
                  style={presetBtn(duration === sec)}
                >
                  {sec}s
                </button>
              ))}
            </div>
            <label style={label()}>
              Custom seconds
              <input
                type="number"
                min={1}
                value={duration}
                onChange={(e) => {
                  const next = Math.max(1, Math.floor(Number(e.target.value)));
                  setDuration(next);
                  setRemaining(next);
                }}
                style={input()}
              />
            </label>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={start} style={btnPrimary()} disabled={running}>
                Start
              </button>
              <button onClick={togglePause} style={btnGhost()}>
                {running ? "Pause" : "Resume"}
              </button>
              <button onClick={reset} style={btnGhost()}>
                Reset
              </button>
            </div>
            <div style={{ textAlign: "center", fontSize: 12, opacity: 0.6 }}>
              Space starts or pauses • Tab resets when the timer is open.
            </div>
            {timerType === "ctf" ? (
              <div style={legend()}>
                <div style={{ fontWeight: 900, fontSize: 12 }}>CTF Hotkeys</div>
                <div style={{ display: "grid", gap: 6, fontSize: 12 }}>
                  <div>
                    <b>Left/Right</b> = +1
                  </div>
                  <div>
                    <b>Shift + Left/Right</b> = +5
                  </div>
                  <div>
                    <b>Space</b> = start/pause timer
                  </div>
                  <div>
                    <b>P</b> = safe zone alert
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </Overlay>
      ) : null}
    </>
  );
}

function card(selected = false, selectable = false): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 14,
    border: selected ? "1px solid rgba(59,130,246,0.8)" : "1px solid rgba(255,255,255,0.12)",
    background: selected ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.06)",
    display: "grid",
    gap: 10,
    cursor: selectable ? "pointer" : "default",
  };
}

function label(): React.CSSProperties {
  return { display: "grid", gap: 6, fontSize: 12, fontWeight: 900 };
}

function input(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.25)",
    color: "white",
    outline: "none",
  };
}

function timerFace(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 16,
    background: "rgba(0,0,0,0.25)",
    border: "1px solid rgba(255,255,255,0.12)",
    textAlign: "center",
  };
}

function overlayFace(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: 24,
    background: "rgba(0,0,0,0.3)",
    border: "1px solid rgba(255,255,255,0.12)",
    textAlign: "center",
  };
}

function presetBtn(active: boolean): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: active ? "1px solid rgba(59,130,246,0.8)" : "1px solid rgba(255,255,255,0.18)",
    background: active ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.06)",
    color: "white",
    fontSize: 11,
    fontWeight: 900,
    cursor: "pointer",
  };
}

function chipBtn(active: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 999,
    border: active ? "1px solid rgba(59,130,246,0.8)" : "1px solid rgba(255,255,255,0.18)",
    background: active ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.06)",
    color: "white",
    fontSize: 11,
    fontWeight: 900,
    cursor: "pointer",
  };
}

function btnPrimary(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "linear-gradient(90deg, rgba(34,197,94,0.90), rgba(59,130,246,0.70))",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function btnGhost(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function legend(): React.CSSProperties {
  return {
    marginTop: 6,
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.55)",
    textAlign: "left",
  };
}

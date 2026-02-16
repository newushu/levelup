"use client";

import { useEffect, useRef, useState } from "react";

export default function StudentKioskControls() {
  const wakeLockRef = useRef<any>(null);
  const [fullscreenOn, setFullscreenOn] = useState(false);
  const [wakeLockOn, setWakeLockOn] = useState(false);

  useEffect(() => {
    const onFs = () => setFullscreenOn(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    onFs();
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    async function tryEnableWakeLock() {
      try {
        const lock = await (navigator as any).wakeLock?.request?.("screen");
        if (!lock) return;
        wakeLockRef.current = lock;
        setWakeLockOn(true);
      } catch {
        setWakeLockOn(false);
      }
    }
    tryEnableWakeLock();
    return () => {
      if (wakeLockRef.current?.release) wakeLockRef.current.release().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    if (!wakeLockOn) return;
    const onVisibility = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        if (wakeLockRef.current?.release) wakeLockRef.current = await (navigator as any).wakeLock?.request?.("screen");
      } catch {
        setWakeLockOn(false);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [wakeLockOn]);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        const yes = window.confirm("Exit fullscreen?");
        if (!yes) return;
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // ignore unsupported browsers/devices
    }
  }

  async function toggleWakeLock() {
    try {
      if (wakeLockOn) {
        if (wakeLockRef.current?.release) await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setWakeLockOn(false);
        return;
      }
      const lock = await (navigator as any).wakeLock?.request?.("screen");
      if (!lock) return;
      wakeLockRef.current = lock;
      setWakeLockOn(true);
    } catch {
      setWakeLockOn(false);
    }
  }

  return (
    <>
      <style>{styles()}</style>
      <div className="student-kiosk-controls">
        <button type="button" className={`student-kiosk-btn ${fullscreenOn ? "active" : ""}`} onClick={toggleFullscreen}>
          {fullscreenOn ? "Exit Full" : "Fullscreen"}
        </button>
        <button type="button" className={`student-kiosk-btn ${wakeLockOn ? "active" : ""}`} onClick={toggleWakeLock}>
          {wakeLockOn ? "Keep Awake On" : "Keep Awake"}
        </button>
      </div>
    </>
  );
}

function styles() {
  return `
    .student-kiosk-controls {
      position: fixed;
      top: 10px;
      left: 10px;
      z-index: 130;
      display: inline-flex;
      gap: 6px;
    }
    .student-kiosk-btn {
      border-radius: 999px;
      border: 1px solid rgba(148,163,184,0.5);
      background: rgba(2,6,23,0.82);
      color: #e2e8f0;
      padding: 6px 10px;
      min-height: 30px;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.02em;
      cursor: pointer;
      white-space: nowrap;
    }
    .student-kiosk-btn.active {
      border-color: rgba(45,212,191,0.7);
      box-shadow: 0 0 0 1px rgba(45,212,191,0.35) inset;
      color: #99f6e4;
    }
    @media (max-width: 1100px) {
      .student-kiosk-controls {
        top: 8px;
        left: 8px;
      }
      .student-kiosk-btn {
        padding: 6px 9px;
        min-height: 28px;
        font-size: 10px;
      }
    }
  `;
}


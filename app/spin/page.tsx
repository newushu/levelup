"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type StudentRow = {
  id: string;
  name: string;
  level?: number | null;
  points_total?: number | null;
  avatar_storage_path?: string | null;
  avatar_zoom_pct?: number | null;
};

type WheelSegment = {
  id: string;
  wheel_id: string;
  label: string;
  segment_type: "points_add" | "points_subtract" | "prize" | "item" | "task";
  points_value: number;
  prize_text?: string | null;
  item_key?: string | null;
  color?: string | null;
  sort_order?: number | null;
};

type Wheel = {
  id: string;
  name: string;
  wheel_type: "prize" | "task";
  segments: WheelSegment[];
};

type SpinResult = {
  spin: {
    id: string;
    points_delta: number;
    prize_text?: string | null;
    item_key?: string | null;
  };
  wheel: { id: string; name: string; wheel_type: "prize" | "task" };
  segment: WheelSegment;
  segment_index: number;
};

type TaskSpinResult = {
  id: string;
  segment: WheelSegment;
  segment_index: number;
};

const PALETTES: Record<string, string[]> = {
  classic: ["#22c55e", "#f97316", "#38bdf8", "#facc15", "#f87171", "#a78bfa", "#14b8a6", "#e879f9"],
  carnival: ["#ef4444", "#f59e0b", "#facc15", "#10b981", "#22d3ee", "#3b82f6", "#8b5cf6", "#ec4899"],
  ocean: ["#0ea5e9", "#22d3ee", "#38bdf8", "#60a5fa", "#818cf8", "#14b8a6", "#06b6d4", "#0284c7"],
  sunset: ["#fb7185", "#f97316", "#f59e0b", "#facc15", "#f472b6", "#f43f5e", "#fda4af", "#fcd34d"],
};

type SoundEffectRow = {
  key: string;
  audio_url: string | null;
  volume?: number | null;
  category?: string | null;
};

export default function SpinPage() {
  const searchParams = useSearchParams();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [studentQuery, setStudentQuery] = useState("");
  const [studentId, setStudentId] = useState("");
  const [wheels, setWheels] = useState<Wheel[]>([]);
  const [wheelId, setWheelId] = useState("");
  const [paletteKey, setPaletteKey] = useState<keyof typeof PALETTES>("classic");
  const [soundEffects, setSoundEffects] = useState<SoundEffectRow[]>([]);
  const [msg, setMsg] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [pending, setPending] = useState<SpinResult | null>(null);
  const [taskPending, setTaskPending] = useState<TaskSpinResult | null>(null);
  const [pin, setPin] = useState("");
  const [celebrate, setCelebrate] = useState(false);
  const [celebrateData, setCelebrateData] = useState<{
    studentName: string;
    avatarPath?: string | null;
    wheelName: string;
    detail: string;
  } | null>(null);
  const [spinLog, setSpinLog] = useState<
    Array<{ id: string; time: string; studentName: string; wheelName: string; detail: string; avatarPath?: string | null }>
  >([]);
  const wheelRef = useRef<HTMLCanvasElement | null>(null);
  const wheelWrapRef = useRef<HTMLDivElement | null>(null);
  const spinMusicRef = useRef<HTMLAudioElement | null>(null);
  const taskLogRef = useRef<string>("");

  useEffect(() => {
    (async () => {
      const [sRes, wRes] = await Promise.all([
        fetch("/api/students/list", { cache: "no-store" }),
        fetch("/api/roulette/wheels", { cache: "no-store" }),
      ]);
      const sJson = await sRes.json().catch(() => ({}));
      if (sRes.ok) setStudents((sJson.students ?? []) as StudentRow[]);

      const wJson = await wRes.json().catch(() => ({}));
      if (wRes.ok) {
        const list = (wJson.wheels ?? []) as Wheel[];
        setWheels(list);
        const urlWheelId = String(searchParams.get("wheelId") ?? "").trim();
        if (urlWheelId && list.some((w) => w.id === urlWheelId)) {
          setWheelId(urlWheelId);
        } else if (!wheelId && list.length) {
          setWheelId(list[0].id);
        }
      }
    })();
  }, [searchParams, wheelId]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/sound-effects/list", { cache: "no-store" });
      const sj = await res.json().catch(() => ({}));
      if (res.ok) setSoundEffects((sj.effects ?? []) as SoundEffectRow[]);
    })();
  }, []);

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === studentId) ?? null,
    [students, studentId]
  );
  const filteredSuggestions = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return [];
    return students.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 6);
  }, [studentQuery, students]);
  const showSuggestions =
    filteredSuggestions.length > 0 &&
    studentQuery.trim() !== "" &&
    (!selectedStudent || studentQuery.trim().toLowerCase() !== selectedStudent.name.toLowerCase());

  const palette = useMemo(() => PALETTES[paletteKey] ?? PALETTES.classic, [paletteKey]);

  const selectedWheel = useMemo(() => wheels.find((w) => w.id === wheelId) ?? null, [wheels, wheelId]);
  const isTaskWheel = selectedWheel?.wheel_type === "task";
  const segments = useMemo(() => {
    const list = selectedWheel?.segments ?? [];
    return list.slice().sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
  }, [selectedWheel]);

  useEffect(() => {
    setRotationDeg(0);
    setPending(null);
    setTaskPending(null);
    setSpinning(false);
  }, [wheelId]);

  useEffect(() => {
    if (!wheelId || !studentId || isTaskWheel) {
      setSpinLog([]);
      return;
    }
    refreshSpinLog(wheelId, studentId);
  }, [wheelId, studentId, isTaskWheel]);

  useEffect(() => {
    drawWheel();
  }, [segments, paletteKey]);

  useEffect(() => {
    if (!wheelWrapRef.current) return;
    const resize = () => drawWheel();
    const observer = new ResizeObserver(resize);
    observer.observe(wheelWrapRef.current);
    return () => observer.disconnect();
  }, [segments]);

  function drawWheel() {
    const canvas = wheelRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const size = Math.min(520, Math.max(280, wheelWrapRef.current?.offsetWidth ?? 420));
    canvas.width = size;
    canvas.height = size;
    const center = size / 2;
    const radius = center - 10;
    ctx.clearRect(0, 0, size, size);

    if (!segments.length) {
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.font = "bold 18px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("No segments", center, center);
      return;
    }

    const angle = (Math.PI * 2) / segments.length;
    segments.forEach((seg, idx) => {
      const start = idx * angle - Math.PI / 2;
      const end = start + angle;
      const color = seg.color || palette[idx % palette.length];
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = "rgba(255,255,255,0.28)";
      for (let i = 0; i < 38; i += 1) {
        const dotAngle = start + Math.random() * angle;
        const dotRadius = Math.random() * (radius - 24);
        const x = center + Math.cos(dotAngle) * dotRadius;
        const y = center + Math.sin(dotAngle) * dotRadius;
        ctx.beginPath();
        ctx.arc(x, y, Math.random() * 3 + 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 2;
      for (let stripe = 0; stripe < 6; stripe += 1) {
        const stripeAngle = start + (stripe + 1) * (angle / 7);
        ctx.beginPath();
        ctx.moveTo(center, center);
        ctx.lineTo(
          center + Math.cos(stripeAngle) * (radius - 12),
          center + Math.sin(stripeAngle) * (radius - 12)
        );
        ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(start + angle / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      const fontSize = Math.max(14, Math.min(22, Math.floor(radius * angle * 0.18)));
      ctx.font = `bold ${fontSize}px sans-serif`;
      const label = seg.label.length > 22 ? `${seg.label.slice(0, 22)}…` : seg.label;
      ctx.fillText(label, radius - 16, 5);
      ctx.restore();
    });

    ctx.beginPath();
    ctx.arc(center, center, radius * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(15,23,42,0.85)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function chooseSuggestion(name: string, id: string) {
    setStudentQuery(name);
    setStudentId(id);
  }

  function getSound(key: string) {
    return soundEffects.find((s) => s.key === key) ?? null;
  }

  function playOneShot(key: string) {
    const sound = getSound(key);
    const url = sound?.audio_url || "";
    if (!url) return;
    const audio = new Audio(url);
    audio.volume = Math.max(0, Math.min(1, Number(sound?.volume ?? 1)));
    audio.play().catch(() => {});
  }

  function startSpinMusic() {
    const sound = getSound("wheel_spin_music");
    const url = sound?.audio_url || "";
    if (!url) return;
    if (!spinMusicRef.current || spinMusicRef.current.src !== url) {
      spinMusicRef.current = new Audio(url);
      spinMusicRef.current.loop = true;
    }
    spinMusicRef.current.volume = Math.max(0, Math.min(1, Number(sound?.volume ?? 1)));
    spinMusicRef.current.play().catch(() => {});
  }

  function stopSpinMusic() {
    if (!spinMusicRef.current) return;
    spinMusicRef.current.pause();
    spinMusicRef.current.currentTime = 0;
  }

  async function refreshSpinLog(wheel: string, student: string) {
    const params = new URLSearchParams({ wheel_id: wheel, student_id: student, limit: "12" });
    const res = await fetch(`/api/roulette/spins?${params.toString()}`, { cache: "no-store" });
    const sj = await res.json().catch(() => ({}));
    if (!res.ok) return;
    const rows = (sj.spins ?? []) as Array<{
      id: string;
      confirmed_at: string | null;
      points_delta: number;
      prize_text?: string | null;
      item_key?: string | null;
      roulette_wheels?: { name?: string | null } | null;
      roulette_segments?: { label?: string | null; segment_type?: string | null } | null;
      students?: { name?: string | null; avatar_storage_path?: string | null } | null;
    }>;
    const mapped = rows.map((row) => {
      const detail = buildSpinDetail({
        points_delta: row.points_delta,
        segment_type: row.roulette_segments?.segment_type ?? null,
        prize_text: row.prize_text ?? row.roulette_segments?.label ?? null,
        item_key: row.item_key ?? row.roulette_segments?.label ?? null,
        fallback_label: row.roulette_segments?.label ?? null,
      });
      return {
        id: row.id,
        time: formatTime(row.confirmed_at),
        studentName: row.students?.name ?? "Student",
        wheelName: row.roulette_wheels?.name ?? "Prize Wheel",
        detail,
        avatarPath: row.students?.avatar_storage_path ?? null,
      };
    });
    setSpinLog(mapped);
  }

  async function refreshStudentPoints(student: string) {
    const res = await fetch(`/api/students/get?id=${encodeURIComponent(student)}`, { cache: "no-store" });
    const sj = await res.json().catch(() => ({}));
    if (!res.ok) return;
    const updated = sj?.student as StudentRow | undefined;
    if (!updated) return;
    setStudents((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
  }

  async function spinWheel() {
    if (!selectedWheel) return setMsg("Select a wheel first.");
    if (!segments.length) return setMsg("This wheel has no segments.");
    if (spinning) return;
    if (!isTaskWheel && !selectedStudent) return setMsg("Select a student first.");
    setMsg("");
    setPin("");
    playOneShot("ui_button_press");
    startSpinMusic();
    if (isTaskWheel) {
      const segmentCount = segments.length;
      const resultIndex = Math.floor(Math.random() * segmentCount);
      const resultSegment = segments[resultIndex];
      setTaskPending({ id: `task-${Date.now()}`, segment: resultSegment, segment_index: resultIndex });
      const segmentAngle = 360 / segmentCount;
      const targetAngle = 360 - (resultIndex * segmentAngle + segmentAngle / 2);
      const current = ((rotationDeg % 360) + 360) % 360;
      const delta = (targetAngle - current + 360) % 360;
      const fullTurns = 360 * (5 + Math.floor(Math.random() * 2));
      const nextRotation = rotationDeg + fullTurns + delta;
      setSpinning(true);
      setRotationDeg(nextRotation);
      return;
    }
    const res = await fetch("/api/roulette/spin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: selectedStudent.id, wheel_id: selectedWheel.id }),
    });
    const sj = await res.json().catch(() => ({}));
    if (!res.ok) {
      stopSpinMusic();
      return setMsg(sj?.error || "Failed to spin");
    }

    const result = sj as SpinResult;
    setPending(result);
    const segmentCount = segments.length;
    const segmentAngle = 360 / segmentCount;
    const targetAngle = 360 - (result.segment_index * segmentAngle + segmentAngle / 2);
    const current = ((rotationDeg % 360) + 360) % 360;
    const delta = (targetAngle - current + 360) % 360;
    const fullTurns = 360 * (5 + Math.floor(Math.random() * 2));
    const nextRotation = rotationDeg + fullTurns + delta;
    setSpinning(true);
    setRotationDeg(nextRotation);
  }

  async function confirmSpin() {
    if (!pending) return;
    if (!pin.trim()) return setMsg("PIN or NFC required to confirm.");
    setMsg("");
    const res = await fetch("/api/roulette/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spin_id: pending.spin.id, pin: pin.trim(), nfc_code: pin.trim() }),
    });
    const sj = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(sj?.error || "Failed to confirm spin");

    const outcome = buildSpinDetail({
      points_delta: pending.spin.points_delta,
      segment_type: pending.segment.segment_type,
      prize_text: pending.segment.prize_text ?? null,
      item_key: pending.segment.item_key ?? null,
      fallback_label: pending.segment.label,
    });
    const studentName = selectedStudent?.name ?? "Student";
    const wheelName = selectedWheel?.name ?? "Prize Wheel";
    const avatarPath = selectedStudent?.avatar_storage_path ?? null;
    setMsg(`Spin confirmed. ${outcome}`);
    const logEntry = {
      id: pending.spin.id,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      studentName,
      wheelName,
      detail: outcome,
      avatarPath,
    };
    setSpinLog((prev) => [logEntry, ...prev].slice(0, 12));
    setCelebrateData({
      studentName,
      avatarPath,
      wheelName,
      detail: outcome,
    });
    setCelebrate(true);
    playOneShot("wheel_confirm");
    window.setTimeout(() => setCelebrate(false), 2600);
    setPending(null);
    setPin("");
    if (selectedWheel && selectedStudent) {
      refreshSpinLog(selectedWheel.id, selectedStudent.id);
      refreshStudentPoints(selectedStudent.id);
    }
  }

  return (
    <main style={page()} className="spin-layout">
      <style>{`
        @media (max-width: 900px) {
          .spin-layout {
            grid-template-columns: 1fr !important;
          }
        }
        .wheel-panel {
          position: relative;
          overflow: hidden;
        }
        .wheel-panel > * {
          position: relative;
          z-index: 1;
        }
        .wheel-panel::before {
          content: "";
          position: absolute;
          inset: -40%;
          background:
            radial-gradient(circle, rgba(255,255,255,0.35) 0 2px, transparent 3px),
            radial-gradient(circle, rgba(250,204,21,0.35) 0 2px, transparent 3px),
            radial-gradient(circle, rgba(56,189,248,0.35) 0 2px, transparent 3px);
          background-size: 140px 140px;
          opacity: 0.45;
          animation: sparkleDrift 10s linear infinite;
          pointer-events: none;
          z-index: 0;
        }
        .wheel-panel::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(2,6,23,0.6), rgba(2,6,23,0.85));
          opacity: 0.8;
          pointer-events: none;
          z-index: 0;
        }
        .wheel-shell {
          position: relative;
          display: grid;
          place-items: center;
          padding: 18px;
          border-radius: 999px;
          background: radial-gradient(circle at 30% 20%, rgba(250,204,21,0.28), rgba(34,197,94,0.16), rgba(2,6,23,0.85));
          border: 2px solid rgba(250,204,21,0.45);
          box-shadow: 0 18px 50px rgba(0,0,0,0.45), inset 0 0 30px rgba(250,204,21,0.15);
          overflow: hidden;
        }
        .wheel-shell::before,
        .wheel-shell::after {
          content: "";
          position: absolute;
          inset: -40%;
          background:
            radial-gradient(circle, rgba(255,255,255,0.35) 0 2px, transparent 3px),
            radial-gradient(circle, rgba(250,204,21,0.35) 0 2px, transparent 3px),
            radial-gradient(circle, rgba(59,130,246,0.35) 0 2px, transparent 3px);
          background-size: 120px 120px;
          animation: sparkleDrift 8s linear infinite;
          opacity: 0.5;
          pointer-events: none;
        }
        .wheel-shell::after {
          animation-duration: 12s;
          opacity: 0.35;
        }
        .wheel-wrap {
          position: relative;
        }
        .wheel-wrap::after {
          content: "";
          position: absolute;
          inset: 6px;
          border-radius: 30px;
          background:
            radial-gradient(circle, rgba(255,255,255,0.28) 0 2px, transparent 3px),
            radial-gradient(circle, rgba(250,204,21,0.35) 0 2px, transparent 3px);
          background-size: 140px 140px;
          opacity: 0.25;
          pointer-events: none;
        }
        @keyframes sparkleDrift {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .celebrate-overlay {
          position: fixed;
          inset: 0;
          display: grid;
          place-items: center;
          background: rgba(2,6,23,0.65);
          z-index: 60;
        }
        .confetti {
          position: absolute;
          inset: -30%;
          background:
            radial-gradient(circle, rgba(255,255,255,0.7) 0 2px, transparent 3px),
            radial-gradient(circle, rgba(250,204,21,0.65) 0 2px, transparent 3px),
            radial-gradient(circle, rgba(56,189,248,0.6) 0 2px, transparent 3px),
            radial-gradient(circle, rgba(34,197,94,0.6) 0 2px, transparent 3px);
          background-size: 90px 90px;
          animation: confettiSpin 1.6s linear infinite;
          opacity: 0.8;
          pointer-events: none;
        }
        .confetti::after {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle, rgba(251,191,36,0.7) 0 2px, transparent 3px),
            radial-gradient(circle, rgba(236,72,153,0.65) 0 2px, transparent 3px),
            radial-gradient(circle, rgba(59,130,246,0.6) 0 2px, transparent 3px);
          background-size: 110px 110px;
          animation: confettiSpin 2.2s linear infinite reverse;
          opacity: 0.7;
        }
        @keyframes confettiSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      {celebrate && celebrateData ? (
        <div className="celebrate-overlay">
          <div className="confetti" />
          <div style={celebrateCard()}>
            <div style={{ fontWeight: 1000, fontSize: 28 }}>Award Confirmed</div>
            <div style={celebrateRow()}>
              <div style={celebrateAvatar()}>
                {celebrateData.avatarPath ? (
                  <img
                    src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${celebrateData.avatarPath}`}
                    alt={celebrateData.studentName}
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  />
                ) : (
                  <span style={{ fontSize: 44 }}>🎉</span>
                )}
              </div>
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontWeight: 900, fontSize: 22 }}>{celebrateData.studentName}</div>
                <div style={{ fontSize: 14, opacity: 0.7 }}>{celebrateData.wheelName}</div>
              </div>
            </div>
            <div style={celebrateDetail()}>{celebrateData.detail}</div>
          </div>
        </div>
      ) : null}
      <div style={leftPane()}>
        <div style={title()}>Prize Wheel Spin</div>
        <div style={subtitle()}>
          Select a student, choose a wheel, and spin. Confirm with PIN or NFC to post results.
        </div>

        <div style={field()}>
          <label style={label()}>Student {isTaskWheel ? "(optional)" : ""}</label>
          {!isTaskWheel ? (
            <div style={{ position: "relative" }}>
              <input
                value={studentQuery}
                onChange={(e) => {
                  setStudentQuery(e.target.value);
                  const match = students.find((s) => s.name.toLowerCase() === e.target.value.toLowerCase());
                  setStudentId(match?.id ?? "");
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  const suggestion = filteredSuggestions[0];
                  if (suggestion) chooseSuggestion(suggestion.name, suggestion.id);
                }}
                placeholder="Type student name and press Enter"
                style={input()}
              />
              {showSuggestions ? (
                <div style={suggestBox()}>
                  {filteredSuggestions.map((s) => (
                    <button key={s.id} style={suggestItem()} onClick={() => chooseSuggestion(s.name, s.id)}>
                      {s.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div style={{ fontSize: 12, opacity: 0.7 }}>Task wheels run without selecting a student.</div>
          )}
        </div>

        <div style={field()}>
          <label style={label()}>Wheel</label>
          <select value={wheelId} onChange={(e) => setWheelId(e.target.value)} style={input()}>
            <option value="">Select wheel</option>
            {wheels.map((wheel) => (
              <option key={wheel.id} value={wheel.id}>
                {wheel.name} ({wheel.wheel_type})
              </option>
            ))}
          </select>
        </div>

        <div style={field()}>
          <label style={label()}>Color palette</label>
          <select value={paletteKey} onChange={(e) => setPaletteKey(e.target.value as keyof typeof PALETTES)} style={input()}>
            {Object.keys(PALETTES).map((key) => (
              <option key={key} value={key}>
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <button onClick={spinWheel} disabled={spinning} style={spinBtn(spinning)}>
          {spinning ? "Spinning..." : "Spin the Wheel"}
        </button>

        {pending && !spinning ? (
          <div style={resultCard()}>
            <div style={{ fontWeight: 900, fontSize: 14 }}>Result</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>{pending.segment.label}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              {pending.segment.segment_type === "points_add" || pending.segment.segment_type === "points_subtract"
                ? `Points: ${pending.spin.points_delta}`
                : pending.segment.segment_type === "prize"
                ? `Prize: ${pending.segment.prize_text || pending.segment.label}`
                : pending.segment.segment_type === "item"
                ? `Item: ${pending.segment.item_key || pending.segment.label}`
                : `Task: ${pending.segment.label}`}
            </div>
            <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
              <label style={label()}>Coach confirm (PIN or NFC)</label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  confirmSpin();
                }}
                placeholder="Enter PIN or scan NFC"
                style={input()}
              />
              <button
                onClick={() => {
                  playOneShot("ui_button_press");
                  confirmSpin();
                }}
                style={confirmBtn()}
              >
                Confirm Award
              </button>
            </div>
          </div>
        ) : null}

        {taskPending && !spinning ? (
          <div style={resultCard()}>
            <div style={{ fontWeight: 900, fontSize: 14 }}>Task Result</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>{taskPending.segment.label}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Task: {taskPending.segment.label}</div>
          </div>
        ) : null}

        {msg ? <div style={{ fontSize: 12, opacity: 0.8 }}>{msg}</div> : null}
      </div>

      <div style={rightPane()} className="wheel-panel">
        <div style={wheelHeader()}>
          <div style={wheelTitle()}>Prize Wheel</div>
          <div style={wheelSubtitle()}>{selectedWheel?.name ?? "Select a wheel"}</div>
        </div>
        <div style={studentBanner()}>
          {selectedWheel?.wheel_type === "prize" ? (
            selectedStudent ? (
              <div style={studentBannerCard()}>
                <div style={studentBannerAvatar()}>
                  {selectedStudent.avatar_storage_path ? (
                    <img
                      src={resolveAvatarUrl(selectedStudent.avatar_storage_path)}
                      alt={selectedStudent.name}
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                  ) : (
                    <span style={{ fontSize: 20 }}>👤</span>
                  )}
                </div>
                <div style={studentBannerInfo()}>
                  <div style={studentBannerName()}>{selectedStudent.name}</div>
                  <div style={studentBannerStats()}>
                    <div>Lvl {selectedStudent.level ?? "—"}</div>
                    <div>Points {formatPoints(selectedStudent.points_total)}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={studentBannerPlaceholder()}>Select a student</div>
            )
          ) : (
            <div style={studentBannerPlaceholder()}>Task wheel</div>
          )}
        </div>
        <div style={wheelWrap()} ref={wheelWrapRef} className="wheel-wrap">
          <div style={pointer()} />
          <div className="wheel-shell">
            <canvas
              ref={wheelRef}
              style={{
                width: "100%",
                maxWidth: 520,
                aspectRatio: "1 / 1",
                transform: `rotate(${rotationDeg}deg)`,
                transition: spinning ? "transform 4.5s cubic-bezier(0.2, 0.9, 0.2, 1)" : "none",
                borderRadius: "50%",
                boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
              }}
              onTransitionEnd={() => {
                setSpinning(false);
                stopSpinMusic();
                if (!isTaskWheel && taskPending && taskLogRef.current !== taskPending.id) {
                  taskLogRef.current = taskPending.id;
                  setSpinLog((prev) => [
                    {
                      id: taskPending.id,
                      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                      studentName: "Task Wheel",
                      wheelName: selectedWheel?.name ?? "Task Wheel",
                      detail: `Task: ${taskPending.segment.label}`,
                    },
                    ...prev,
                  ].slice(0, 12));
                }
              }}
            />
          </div>
        </div>
        {selectedWheel ? (
          <div style={wheelMeta()}>
            <div style={{ fontWeight: 900 }}>
              {segments.length} slices • {selectedWheel.wheel_type === "prize" ? "Prize wheel" : "Task wheel"}
            </div>
          </div>
        ) : null}
        <div style={spinLogWrap()}>
          <div style={{ fontWeight: 900 }}>Spin Log</div>
          <div style={spinLogGrid()}>
            {spinLog.length ? (
              spinLog.map((entry) => (
                <div key={entry.id} style={spinLogCard()}>
                  <div style={spinLogAvatar()}>
                    {entry.avatarPath ? (
                      <img
                        src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${entry.avatarPath}`}
                        alt={entry.studentName}
                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                      />
                    ) : (
                      <span style={{ fontSize: 16 }}>🎡</span>
                    )}
                  </div>
                  <div style={{ display: "grid", gap: 2 }}>
                    <div style={{ fontWeight: 900, fontSize: 12 }}>{entry.studentName}</div>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>{entry.detail}</div>
                    <div style={{ fontSize: 10, opacity: 0.6 }}>
                      {entry.wheelName} • {entry.time}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ fontSize: 11, opacity: 0.6 }}>No spins yet.</div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function page(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "minmax(280px, 360px) minmax(0, 1fr)",
    gap: 18,
    alignItems: "start",
  };
}

function leftPane(): React.CSSProperties {
  return {
    display: "grid",
    gap: 12,
    padding: 16,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(15,23,42,0.6)",
  };
}

function rightPane(): React.CSSProperties {
  return {
    display: "grid",
    gap: 12,
    padding: 18,
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "radial-gradient(circle at top, rgba(15,23,42,0.75), rgba(2,6,23,0.95))",
    minHeight: 520,
  };
}

function title(): React.CSSProperties {
  return { fontSize: 26, fontWeight: 1000 };
}

function subtitle(): React.CSSProperties {
  return { fontSize: 12, opacity: 0.75 };
}

function wheelHeader(): React.CSSProperties {
  return { display: "grid", gap: 4, textAlign: "center" };
}

function wheelTitle(): React.CSSProperties {
  return { fontSize: 26, fontWeight: 1000, letterSpacing: 0.5 };
}

function wheelSubtitle(): React.CSSProperties {
  return { fontSize: 14, fontWeight: 800, opacity: 0.8 };
}

function studentBanner(): React.CSSProperties {
  return {
    textAlign: "center",
    fontSize: 22,
    fontWeight: 900,
    letterSpacing: 0.4,
    minHeight: 28,
  };
}

function studentBannerCard(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 16px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(15,23,42,0.65)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
  };
}

function studentBannerAvatar(): React.CSSProperties {
  return {
    width: 64,
    height: 64,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
  };
}

function studentBannerInfo(): React.CSSProperties {
  return { display: "grid", gap: 2, textAlign: "left" };
}

function studentBannerName(): React.CSSProperties {
  return { fontSize: 28, fontWeight: 1000, letterSpacing: 0.4, lineHeight: 1.1 };
}

function studentBannerStats(): React.CSSProperties {
  return {
    display: "grid",
    gap: 2,
    fontSize: 18,
    fontWeight: 900,
    opacity: 0.8,
    lineHeight: 1.1,
  };
}

function studentBannerPlaceholder(): React.CSSProperties {
  return { fontSize: 16, fontWeight: 800, opacity: 0.75 };
}

function celebrateCard(): React.CSSProperties {
  return {
    position: "relative",
    zIndex: 1,
    padding: 36,
    borderRadius: 26,
    border: "1px solid rgba(250,204,21,0.6)",
    background: "rgba(15,23,42,0.9)",
    display: "grid",
    gap: 18,
    minWidth: 520,
    maxWidth: 720,
    textAlign: "center",
    boxShadow: "0 20px 50px rgba(0,0,0,0.45)",
  };
}

function celebrateRow(): React.CSSProperties {
  return { display: "flex", gap: 12, alignItems: "center", justifyContent: "center" };
}

function celebrateAvatar(): React.CSSProperties {
  return {
    width: 110,
    height: 110,
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
  };
}

function celebrateDetail(): React.CSSProperties {
  return { fontSize: 18, fontWeight: 800 };
}

function formatPoints(value?: number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat().format(n);
}

function resolveAvatarUrl(storagePath?: string | null) {
  const clean = String(storagePath ?? "").trim();
  if (!clean) return "";
  if (/^https?:\/\//i.test(clean)) return clean;
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) return "";
  const normalized = clean.replace(/^\/+/, "");
  if (normalized.startsWith("storage/v1/object/public/")) {
    return `${baseUrl}/${normalized}`;
  }
  const fullPath = normalized.startsWith("avatars/") ? normalized : `avatars/${normalized}`;
  return `${baseUrl}/storage/v1/object/public/${fullPath}`;
}

function spinLogWrap(): React.CSSProperties {
  return { display: "grid", gap: 8, marginTop: 6 };
}

function spinLogGrid(): React.CSSProperties {
  return { display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" };
}

function spinLogCard(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "40px 1fr",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(2,6,23,0.6)",
  };
}

function spinLogAvatar(): React.CSSProperties {
  return {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
  };
}

function field(): React.CSSProperties {
  return { display: "grid", gap: 6 };
}

function label(): React.CSSProperties {
  return { fontSize: 12, fontWeight: 900, opacity: 0.85 };
}

function input(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(15,23,42,0.65)",
    color: "white",
    fontSize: 14,
    width: "100%",
  };
}

function spinBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: "12px 16px",
    borderRadius: 14,
    border: "1px solid rgba(34,197,94,0.45)",
    background: disabled
      ? "rgba(34,197,94,0.25)"
      : "linear-gradient(120deg, rgba(34,197,94,0.9), rgba(16,185,129,0.7))",
    color: "white",
    fontWeight: 1000,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

function confirmBtn(): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(250,204,21,0.55)",
    background: "linear-gradient(120deg, rgba(250,204,21,0.9), rgba(251,191,36,0.7))",
    color: "#111827",
    fontWeight: 1000,
    cursor: "pointer",
  };
}

function resultCard(): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 12,
    border: "1px dashed rgba(250,204,21,0.45)",
    background: "rgba(15,23,42,0.5)",
    display: "grid",
    gap: 6,
  };
}

function wheelWrap(): React.CSSProperties {
  return {
    position: "relative",
    display: "grid",
    placeItems: "center",
    padding: 16,
  };
}

function pointer(): React.CSSProperties {
  return {
    position: "absolute",
    top: 12,
    left: "50%",
    transform: "translateX(-50%)",
    width: 0,
    height: 0,
    borderLeft: "18px solid transparent",
    borderRight: "18px solid transparent",
    borderBottom: "30px solid rgba(250,204,21,0.95)",
    filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.35))",
    zIndex: 2,
  };
}

function wheelMeta(): React.CSSProperties {
  return {
    display: "grid",
    gap: 4,
    textAlign: "center",
    fontSize: 12,
    opacity: 0.8,
  };
}

function suggestBox(): React.CSSProperties {
  return {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: 0,
    right: 0,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(15,23,42,0.95)",
    padding: 6,
    display: "grid",
    gap: 4,
    zIndex: 20,
  };
}

function suggestItem(): React.CSSProperties {
  return {
    textAlign: "left",
    padding: "8px 10px",
    borderRadius: 10,
    border: "none",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontSize: 12,
    cursor: "pointer",
  };
}

function formatTime(value?: string | null): string {
  if (!value) return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function buildSpinDetail(args: {
  points_delta: number;
  segment_type: string | null;
  prize_text: string | null;
  item_key: string | null;
  fallback_label: string | null;
}): string {
  if (args.points_delta) {
    const sign = args.points_delta > 0 ? "earned" : "lost";
    return `Points ${sign}: ${args.points_delta}`;
  }
  if (args.segment_type === "prize") {
    const prize = args.prize_text || args.fallback_label || "Prize";
    return `Prize earned: ${prize}`;
  }
  if (args.segment_type === "item") {
    const item = args.item_key || args.fallback_label || "Item";
    return `Item earned: ${item}`;
  }
  if (args.segment_type === "task") {
    return `Task: ${args.fallback_label || "Complete task"}`;
  }
  return "Spin confirmed";
}

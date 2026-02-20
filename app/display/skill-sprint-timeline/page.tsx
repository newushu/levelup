"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { skillSprintPrizeDropPerDay, skillSprintPrizeNow } from "@/lib/skillSprintMath";
import AvatarRender from "@/components/AvatarRender";

type TimelineRow = {
  id: string;
  student_id: string;
  source_label: string;
  due_at: string;
  assigned_at?: string | null;
  reward_points?: number | null;
  penalty_points_per_day?: number | null;
  charged_days?: number | null;
  completed_at?: string | null;
  note?: string | null;
  students?: {
    name?: string | null;
    avatar_storage_path?: string | null;
    avatar_bg?: string | null;
    gender?: string | null;
  } | null;
};

type TimelineMarker = {
  key: string;
  kind: "single" | "group" | "summary";
  rows: TimelineRow[];
  dueMs: number;
  rowIndex: number;
  x: number;
  y: number;
  cardX: number;
  cardY: number;
  cardRight: boolean;
};

type AvatarSetting = {
  avatar_id?: string | null;
  bg_color?: string | null;
  particle_style?: string | null;
  corner_border_key?: string | null;
};

type AvatarCatalogRow = {
  id: string;
  storage_path?: string | null;
  public_url?: string | null;
};

type EffectRow = {
  key?: string | null;
  config?: any;
  render_mode?: string | null;
  z_layer?: string | null;
  html?: string | null;
  css?: string | null;
  js?: string | null;
};

type BorderRow = {
  key?: string | null;
  image_url?: string | null;
  render_mode?: string | null;
  z_layer?: string | null;
  html?: string | null;
  css?: string | null;
  js?: string | null;
  offset_x?: number | null;
  offset_y?: number | null;
  offsets_by_context?: Record<string, { x?: number | null; y?: number | null; scale?: number | null; rotate?: number | null }> | null;
  enabled?: boolean | null;
};

const DISPLAY_MENU = [
  { value: "/display", label: "Live Activity" },
  { value: "/display/skill-sprint-timeline", label: "Skill Sprint Timeline" },
  { value: "/display/skill-pulse", label: "Skill Pulse" },
  { value: "/display/battle-pulse", label: "Battle Pulse" },
  { value: "/display/badges", label: "Badges" },
  { value: "/display/leaderboards", label: "Leaderboards" },
];

const VIEW_W = 1400;
const VIEW_H = 860;
const TIMELINE_LEFT = 84;
const TIMELINE_RIGHT = 1316;
const TIMELINE_WIDTH = TIMELINE_RIGHT - TIMELINE_LEFT;
const ROW_Y = [180, 430, 760] as const;
const MONTH_COLORS = ["#3f5f7f", "#4d6f53", "#6e5b47"] as const;

function markerCardWidth(kind: "single" | "group" | "summary") {
  return kind === "summary" ? 420 : kind === "group" ? 380 : 330;
}

function markerCardHeight(kind: "single" | "group" | "summary") {
  return kind === "summary" ? 72 : kind === "group" ? 140 : 66;
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function safeNum(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function resolveAvatarUrl(storagePath?: string | null) {
  const clean = String(storagePath ?? "").trim();
  if (!clean) return "";
  if (/^https?:\/\//i.test(clean)) return clean;
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) return "";
  const normalized = clean.replace(/^\/+/, "");
  if (normalized.startsWith("storage/v1/object/public/")) return `${baseUrl}/${normalized}`;
  const fullPath = normalized.startsWith("avatars/") ? normalized : `avatars/${normalized}`;
  return `${baseUrl}/storage/v1/object/public/${fullPath}`;
}

function formatLeft(dueAt: string, nowMs = Date.now()) {
  const dueMs = Date.parse(String(dueAt ?? ""));
  if (!Number.isFinite(dueMs)) return "-";
  const diff = dueMs - nowMs;
  const absHours = Math.floor(Math.abs(diff) / (60 * 60 * 1000));
  const days = Math.floor(absHours / 24);
  const hours = absHours % 24;
  return diff >= 0 ? `${days}d ${hours}h left` : `${days}d ${hours}h overdue`;
}

function positionForDueDate(baseNowMs: number, dueMs: number) {
  const monthOffset = monthOffsetFromNow(baseNowMs, dueMs);
  const rowIndex = Math.min(2, Math.max(0, monthOffset));
  const monthStart = new Date(baseNowMs);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  monthStart.setMonth(monthStart.getMonth() + rowIndex);
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  const span = Math.max(1, monthEnd.getTime() - monthStart.getTime());
  const localRatio = clamp01((dueMs - monthStart.getTime()) / span);
  const x = TIMELINE_LEFT + localRatio * TIMELINE_WIDTH;
  const y = ROW_Y[rowIndex];
  return { x, y, rowIndex };
}

function daysRemaining(dueAt: string, nowMs: number) {
  const dueMs = Date.parse(String(dueAt ?? ""));
  if (!Number.isFinite(dueMs)) return 0;
  return Math.floor((dueMs - nowMs) / (24 * 60 * 60 * 1000));
}

function shortDate(iso: string) {
  const ms = Date.parse(String(iso ?? ""));
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function dueDateKey(iso: string) {
  const ms = Date.parse(String(iso ?? ""));
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthOffsetFromNow(baseMs: number, targetMs: number) {
  const a = new Date(baseMs);
  const b = new Date(targetMs);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function connectorLanesForRow(rowIndex: number, preferHigher: boolean) {
  const rowY = ROW_Y[Math.max(0, Math.min(2, rowIndex))];
  const start = rowY - 136;
  const lanes = Array.from({ length: 6 }, (_, i) => start + i * 30);
  return preferHigher ? lanes : [...lanes].reverse();
}

function rangeOverlap(a0: number, a1: number, b0: number, b1: number) {
  const minA = Math.min(a0, a1);
  const maxA = Math.max(a0, a1);
  const minB = Math.min(b0, b1);
  const maxB = Math.max(b0, b1);
  return !(maxA < minB || maxB < minA);
}

function lineHitsOtherBoxes(
  markers: TimelineMarker[],
  selfKey: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  const isHorizontal = Math.abs(y1 - y2) < 0.01;
  const isVertical = Math.abs(x1 - x2) < 0.01;
  if (!isHorizontal && !isVertical) return false;
  const pad = 3;
  return markers.some((m) => {
    if (m.key === selfKey) return false;
    const w = markerCardWidth(m.kind);
    const h = markerCardHeight(m.kind);
    const left = m.cardX - pad;
    const right = m.cardX + w + pad;
    const top = m.cardY - pad;
    const bottom = m.cardY + h + pad;
    if (isHorizontal) {
      if (y1 < top || y1 > bottom) return false;
      return rangeOverlap(x1, x2, left, right);
    }
    if (x1 < left || x1 > right) return false;
    return rangeOverlap(y1, y2, top, bottom);
  });
}

function resolveConnector(marker: TimelineMarker, markers: TimelineMarker[]) {
  const boxW = markerCardWidth(marker.kind);
  const boxH = markerCardHeight(marker.kind);
  const anchorX = marker.cardRight ? marker.cardX : marker.cardX + boxW;
  const anchorY = marker.cardY + Math.round(boxH / 2);
  const preferHigher = marker.x <= (TIMELINE_LEFT + TIMELINE_RIGHT) / 2;
  const lanes = connectorLanesForRow(marker.rowIndex, preferHigher);
  for (const elbowY of lanes) {
    const v1 = lineHitsOtherBoxes(markers, marker.key, marker.x, marker.y, marker.x, elbowY);
    const h1 = lineHitsOtherBoxes(markers, marker.key, marker.x, elbowY, anchorX, elbowY);
    const v2 = lineHitsOtherBoxes(markers, marker.key, anchorX, elbowY, anchorX, anchorY);
    if (!v1 && !h1 && !v2) return { anchorX, anchorY, elbowY };
  }
  return { anchorX, anchorY, elbowY: lanes[0] ?? marker.y - 40 };
}

type BorderPoint = { x: number; y: number };
function borderPoint(tRaw: number, w: number, h: number, inset = 16): BorderPoint {
  const t = ((tRaw % 1) + 1) % 1;
  const x0 = inset;
  const y0 = inset;
  const x1 = w - inset;
  const y1 = h - inset;
  const topLen = x1 - x0;
  const rightLen = y1 - y0;
  const bottomLen = topLen;
  const leftLen = rightLen;
  const total = topLen + rightLen + bottomLen + leftLen;
  const d = t * total;

  if (d <= topLen) return { x: x0 + d, y: y0 };
  if (d <= topLen + rightLen) return { x: x1, y: y0 + (d - topLen) };
  if (d <= topLen + rightLen + bottomLen) return { x: x1 - (d - topLen - rightLen), y: y1 };
  return { x: x0, y: y1 - (d - topLen - rightLen - bottomLen) };
}

export default function SkillSprintTimelineDisplayPage() {
  const [menuValue, setMenuValue] = useState("/display/skill-sprint-timeline");
  const [allRows, setAllRows] = useState<TimelineRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [msg, setMsg] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [avatarSettingsByStudent, setAvatarSettingsByStudent] = useState<Record<string, AvatarSetting>>({});
  const [avatarCatalog, setAvatarCatalog] = useState<AvatarCatalogRow[]>([]);
  const [effectCatalog, setEffectCatalog] = useState<EffectRow[]>([]);
  const [borderCatalog, setBorderCatalog] = useState<BorderRow[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setMenuValue(window.location.pathname || "/display/skill-sprint-timeline");
  }, []);

  useEffect(() => {
    (async () => {
      const [avatarsRes, effectsRes, bordersRes] = await Promise.all([
        fetch("/api/avatars/list", { cache: "no-store" }),
        fetch("/api/avatar-effects/list", { cache: "no-store" }),
        fetch("/api/corner-borders", { cache: "no-store" }),
      ]);
      const [avatarsJson, effectsJson, bordersJson] = await Promise.all([
        avatarsRes.json().catch(() => ({})),
        effectsRes.json().catch(() => ({})),
        bordersRes.json().catch(() => ({})),
      ]);
      if (avatarsRes.ok) setAvatarCatalog((avatarsJson?.avatars ?? []) as AvatarCatalogRow[]);
      if (effectsRes.ok) setEffectCatalog((effectsJson?.effects ?? []) as EffectRow[]);
      if (bordersRes.ok) setBorderCatalog((bordersJson?.borders ?? []) as BorderRow[]);
    })();
  }, []);

  useEffect(() => {
    const studentIds = Array.from(new Set(allRows.map((row) => String(row.student_id ?? "")).filter(Boolean)));
    if (!studentIds.length) {
      setAvatarSettingsByStudent({});
      return;
    }
    let dead = false;
    (async () => {
      const entries = await Promise.all(
        studentIds.map(async (studentId) => {
          const res = await fetch("/api/avatar/get", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ student_id: studentId }),
          });
          const json = await res.json().catch(() => ({}));
          return [studentId, (res.ok ? (json?.settings ?? null) : null) as AvatarSetting | null] as const;
        })
      );
      if (dead) return;
      const next: Record<string, AvatarSetting> = {};
      entries.forEach(([studentId, settings]) => {
        if (settings) next[studentId] = settings;
      });
      setAvatarSettingsByStudent(next);
    })();
    return () => {
      dead = true;
    };
  }, [allRows]);

  useEffect(() => {
    let dead = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const load = async () => {
      const res = await fetch("/api/skill-sprint/list", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (!dead) setMsg(String(json?.error ?? "Failed to load Skill Sprint timeline"));
        return;
      }
      const next = ((json?.rows ?? []) as TimelineRow[]).sort(
        (a, b) => Date.parse(String(a.due_at ?? "")) - Date.parse(String(b.due_at ?? ""))
      );
      if (!dead) {
        setAllRows(next);
        setMsg("");
        setSelectedId((prev) => (next.some((r) => r.id === prev) ? prev : next.find((r) => !r.completed_at)?.id ?? next[0]?.id ?? ""));
      }
    };
    void load();
    timer = setInterval(load, 30_000);
    return () => {
      dead = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  const nowMs = Date.now();
  const activeRows = useMemo(() => allRows.filter((r) => !r.completed_at), [allRows]);

  const monthMeta = useMemo(() => {
    return Array.from({ length: 3 }).map((_, i) => {
      const d = new Date(nowMs);
      d.setMonth(d.getMonth() + i);
      const rowIndex = i;
      return {
        key: i,
        label: d.toLocaleString("en-US", { month: "short" }),
        color: MONTH_COLORS[i],
        rowIndex,
        x: TIMELINE_LEFT - 14,
        y: ROW_Y[rowIndex] - 18,
      };
    });
  }, [nowMs]);

  const timelineMarkers = useMemo<TimelineMarker[]>(() => {
    const dayMap = new Map<string, TimelineRow[]>();
    for (const row of activeRows) {
      const dueMs = Date.parse(String(row.due_at ?? ""));
      if (!Number.isFinite(dueMs)) continue;
      const monthOffset = monthOffsetFromNow(nowMs, dueMs);
      if (monthOffset < 0 || monthOffset > 2) continue;
      const dateKey = dueDateKey(row.due_at);
      if (!dateKey) continue;
      const key = `${monthOffset}-${dateKey}`;
      const bucket = dayMap.get(key) ?? [];
      bucket.push(row);
      dayMap.set(key, bucket);
    }
    const clusters = Array.from(dayMap.entries())
      .map(([groupKey, rows]) => {
        const sorted = [...rows].sort((a, b) => Date.parse(String(a.due_at ?? "")) - Date.parse(String(b.due_at ?? "")));
        const dueMs = Date.parse(String(sorted[0]?.due_at ?? ""));
        const kind: TimelineMarker["kind"] = sorted.length > 5 ? "summary" : sorted.length > 1 ? "group" : "single";
        return { key: `day-${groupKey}`, rows: sorted, dueMs, kind };
      })
      .sort((a, b) => a.dueMs - b.dueMs);

    const raw = clusters
      .map((cluster) => {
        const pos = positionForDueDate(nowMs, cluster.dueMs);
        return {
          ...cluster,
          x: pos.x,
          y: pos.y,
          rowIndex: pos.rowIndex,
          cardRight: pos.x <= 680,
          cardX: 0,
          cardY: 0,
          slot: 0,
        };
      })
      .slice(0, 48);

    const byRow: Record<number, typeof raw> = { 0: [], 1: [], 2: [] };
    raw.forEach((item) => {
      byRow[item.rowIndex].push(item);
    });

    const slotPattern = [0, -1, 1, -2, 2, -3, 3];
    const X_NEAR = 140;
    const SLOT_STEP = 56;
    const SLOPE_LIFT = 44;
    const TOP_MIN = 8;
    const BOTTOM_MAX = VIEW_H - 84;
    const MID_X = (TIMELINE_LEFT + TIMELINE_RIGHT) / 2;
    const placedByRow: Record<number, Array<{ x: number; y: number; w: number; h: number }>> = { 0: [], 1: [], 2: [] };

    const finalized: TimelineMarker[] = [];
    [0, 1, 2].forEach((rowIndex) => {
      const rowItems = [...byRow[rowIndex]].sort((a, b) => a.x - b.x);
      let lastX = Number.NEGATIVE_INFINITY;
      let nearIndex = 0;
      rowItems.forEach((item) => {
        if (item.x - lastX > X_NEAR) nearIndex = 0;
        else nearIndex += 1;
        lastX = item.x;
        const slot = slotPattern[nearIndex % slotPattern.length] ?? 0;
        const cycle = Math.floor(nearIndex / slotPattern.length);
        const expandedSlot = slot >= 0 ? slot + cycle : slot - cycle;

        const boxW = markerCardWidth(item.kind);
        const boxH = markerCardHeight(item.kind);
        const xNorm = clamp01((item.x - TIMELINE_LEFT) / TIMELINE_WIDTH);
        const leftLift = (1 - xNorm) * SLOPE_LIFT;
        const baseY = item.y - boxH - 24 - leftLift;
        let cardY = baseY + expandedSlot * SLOT_STEP;

        const cardRight = item.cardRight;
        const cardX = cardRight ? item.x + 120 : item.x - (boxW + 120);
        const x = cardX;
        const w = boxW;
        const h = boxH;
        const list = placedByRow[rowIndex] ?? [];
        const fallbackDir = item.x <= MID_X ? -1 : 1;
        let shiftDir = expandedSlot === 0 ? fallbackDir : expandedSlot > 0 ? 1 : -1;
        let guard = 0;
        while (guard < 24) {
          const overlap = list.some((r) => !(x + w < r.x || r.x + r.w < x || cardY + h < r.y || r.y + r.h < cardY));
          if (!overlap) break;
          cardY += shiftDir * (Math.max(30, Math.round(SLOT_STEP * 0.72)));
          guard += 1;
          if (cardY < TOP_MIN || cardY + h > BOTTOM_MAX) shiftDir *= -1;
        }
        const boundedY = Math.max(TOP_MIN, Math.min(BOTTOM_MAX - h, cardY));
        list.push({ x, y: boundedY, w, h });
        placedByRow[rowIndex] = list;

        finalized.push({
          key: item.key,
          kind: item.kind,
          rows: item.rows,
          dueMs: item.dueMs,
          rowIndex,
          x: item.x,
          y: item.y,
          cardX,
          cardY: boundedY,
          cardRight,
        });
      });
    });

    return finalized.sort((a, b) => a.dueMs - b.dueMs);
  }, [activeRows, nowMs]);

  const upcomingRows = useMemo(() => {
    const horizonMs = nowMs + 14 * 24 * 60 * 60 * 1000;
    return allRows
      .filter((row) => {
        const dueMs = Date.parse(String(row.due_at ?? ""));
        return Number.isFinite(dueMs) && dueMs >= nowMs && dueMs <= horizonMs;
      })
      .slice(0, 24);
  }, [allRows, nowMs]);

  function avatarVisualForRow(row: TimelineRow) {
    const settings = avatarSettingsByStudent[String(row.student_id ?? "")];
    const avatarId = String(settings?.avatar_id ?? "").trim();
    const avatar = avatarCatalog.find((item) => String(item.id ?? "") === avatarId);
    const avatarSrc =
      String(avatar?.public_url ?? "").trim() ||
      resolveAvatarUrl(avatar?.storage_path ?? null) ||
      resolveAvatarUrl(row.students?.avatar_storage_path ?? null);
    const bg = String(settings?.bg_color ?? row.students?.avatar_bg ?? "rgba(30,41,59,0.85)").trim();
    const effectKey = String(settings?.particle_style ?? "").trim();
    const borderKey = String(settings?.corner_border_key ?? "").trim();
    const effectBase = effectKey ? effectCatalog.find((e) => String(e.key ?? "") === effectKey) ?? null : null;
    const effect = effectBase
      ? {
          ...effectBase,
          config: {
            ...(typeof effectBase.config === "object" && effectBase.config ? effectBase.config : {}),
            density: 80,
          },
        }
      : null;
    const border = borderKey
      ? borderCatalog.find((b) => String(b.key ?? "") === borderKey && b.enabled !== false) ?? null
      : null;
    return { avatarSrc, bg, effect, border };
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rowParticles = Array.from({ length: 120 }).map((_, idx) => {
      const rowIndex = idx % 3;
      return {
        rowIndex,
        t: Math.random(),
        speed: 0.0008 + Math.random() * 0.0017,
        size: 1 + Math.random() * 2.1,
        alpha: 0.22 + Math.random() * 0.55,
      };
    });
    const borderParticles = Array.from({ length: 42 }).map(() => ({
      t: Math.random(),
      speed: 0.0006 + Math.random() * 0.0012,
      size: 1 + Math.random() * 1.8,
    }));

    let raf = 0;
    let flow = 0;
    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * 2;
      canvas.height = h * 2;
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const sx = w / VIEW_W;
      const sy = h / VIEW_H;
      ctx.scale(sx, sy);

      const drawEndpointGlow = (x: number, y: number, color: string) => {
        const g = ctx.createRadialGradient(x, y, 6, x, y, 62);
        g.addColorStop(0, `${color}aa`);
        g.addColorStop(0.55, `${color}44`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, 62, 0, Math.PI * 2);
        ctx.fill();
      };

      flow += 1.25;
      ROW_Y.forEach((y, rowIndex) => {
        const c0 = MONTH_COLORS[rowIndex];
        const grad = ctx.createLinearGradient(TIMELINE_LEFT, y, TIMELINE_RIGHT, y);
        grad.addColorStop(0, `${c0}f0`);
        grad.addColorStop(1, `${c0}f0`);

        ctx.beginPath();
        ctx.moveTo(TIMELINE_LEFT, y);
        ctx.lineTo(TIMELINE_RIGHT, y);
        ctx.lineWidth = 30;
        ctx.lineCap = "round";
        ctx.strokeStyle = grad;
        ctx.shadowColor = "rgba(148,163,184,0.5)";
        ctx.shadowBlur = 14;
        ctx.stroke();
        ctx.shadowBlur = 0;
      });

      drawEndpointGlow(TIMELINE_RIGHT, ROW_Y[0], MONTH_COLORS[1]);
      drawEndpointGlow(TIMELINE_LEFT, ROW_Y[1], MONTH_COLORS[1]);
      drawEndpointGlow(TIMELINE_RIGHT, ROW_Y[1], MONTH_COLORS[2]);
      drawEndpointGlow(TIMELINE_LEFT, ROW_Y[2], MONTH_COLORS[2]);

      rowParticles.forEach((p) => {
        p.t += p.speed;
        if (p.t > 1) p.t -= 1;
        const x = TIMELINE_LEFT + p.t * TIMELINE_WIDTH;
        const y = ROW_Y[p.rowIndex] + Math.sin((p.t + p.rowIndex * 0.17) * Math.PI * 6) * 8;
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255,${p.alpha})`;
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Sparkly flow around the timeline box.
      const borderInset = 14;
      const x0 = borderInset;
      const y0 = borderInset;
      const x1 = VIEW_W - borderInset;
      const y1 = VIEW_H - borderInset;
      const borderGrad = ctx.createLinearGradient(x0, y0, x1, y1);
      borderGrad.addColorStop(0, "rgba(125,211,252,0.45)");
      borderGrad.addColorStop(0.5, "rgba(148,163,184,0.2)");
      borderGrad.addColorStop(1, "rgba(103,232,249,0.45)");
      ctx.strokeStyle = borderGrad;
      ctx.lineWidth = 3.5;
      ctx.setLineDash([14, 12]);
      ctx.lineDashOffset = -flow * 0.55;
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      ctx.setLineDash([]);

      borderParticles.forEach((p) => {
        p.t += p.speed;
        if (p.t > 1) p.t -= 1;
        const pt = borderPoint(p.t, VIEW_W, VIEW_H, borderInset);
        ctx.beginPath();
        ctx.fillStyle = "rgba(226,232,240,0.9)";
        ctx.arc(pt.x, pt.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <main style={page()}>
      <div style={menuWrap()}>
        <select
          value={menuValue}
          onChange={(e) => {
            const next = e.target.value;
            setMenuValue(next);
            if (typeof window !== "undefined" && next && window.location.pathname !== next) window.location.href = next;
          }}
          style={menuSelect()}
        >
          {DISPLAY_MENU.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div style={hero()}>
        <div style={title()}>Skill Sprint Timeline</div>
        <div style={subhead()}>6-month map split into 3 rows (2 months per row).</div>
        {msg ? <div style={notice()}>{msg}</div> : null}
      </div>

      <section style={layout()}>
        <div style={timelineStage()}>
          <div style={timelineScene()}>
            <canvas ref={canvasRef} style={sparkleCanvas()} />
            <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} style={svgLayer()}>
            {monthMeta.map((m) => (
              <text key={`month-${m.key}`} x={m.x} y={m.y} textAnchor="end" fill="rgba(226,232,240,0.92)" fontSize="38" fontWeight="1000">
                {m.label}
              </text>
            ))}

            <defs>
              <linearGradient id="markerLineGradR" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(125,211,252,0.95)" />
                <stop offset="100%" stopColor="rgba(125,211,252,0.08)" />
              </linearGradient>
              <linearGradient id="markerLineGradL" x1="100%" y1="0%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="rgba(125,211,252,0.95)" />
                <stop offset="100%" stopColor="rgba(125,211,252,0.08)" />
              </linearGradient>
            </defs>
            {timelineMarkers.map((item) => {
              const { anchorX, anchorY, elbowY } = resolveConnector(item, timelineMarkers);
              return (
                <g key={`${item.key}-line`}>
                  <defs>
                    <radialGradient id={`spark-${item.key}`} cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="rgba(255,255,255,1)" />
                      <stop offset="45%" stopColor="rgba(186,230,253,0.98)" />
                      <stop offset="100%" stopColor="rgba(56,189,248,0.22)" />
                    </radialGradient>
                  </defs>
                  <circle cx={item.x} cy={item.y} r="11" fill={`url(#spark-${item.key})`} />
                  <circle cx={item.x} cy={item.y} r="4.1" fill="rgba(255,255,255,0.98)" />
                  <line x1={item.x - 6} y1={item.y} x2={item.x + 6} y2={item.y} stroke="rgba(255,255,255,0.9)" strokeWidth="1.2" />
                  <line x1={item.x} y1={item.y - 6} x2={item.x} y2={item.y + 6} stroke="rgba(255,255,255,0.9)" strokeWidth="1.2" />
                  <text x={item.x} y={item.y + 20} textAnchor="middle" fill="rgba(226,232,240,0.86)" fontSize="10" fontWeight="900">
                    {shortDate(item.rows[0]?.due_at ?? "")}
                  </text>
                  <path
                    d={`M ${item.x} ${item.y} L ${item.x} ${elbowY} L ${anchorX} ${anchorY}`}
                    stroke={item.cardRight ? "url(#markerLineGradR)" : "url(#markerLineGradL)"}
                    strokeWidth="3.4"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <line
                    x1={item.x}
                    y1={item.y}
                    x2={item.x}
                    y2={elbowY}
                    stroke="rgba(186,230,253,0.5)"
                    strokeWidth="1"
                  />
                  <circle cx={anchorX} cy={anchorY} r="2.2" fill="rgba(186,230,253,0.95)" />
                </g>
              );
            })}
            </svg>

            {timelineMarkers.map((item) => (
              <button
                type="button"
                key={item.key}
                onClick={() => setSelectedId(item.rows[0]?.id ?? "")}
                style={goalCard(item.cardX, item.cardY, item.kind, selectedId === item.rows[0]?.id)}
              >
                {item.kind === "summary" ? (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 1000 }}>{item.rows.length} Students have Skill Sprint deadlines</div>
                    <div style={{ fontSize: 12, opacity: 0.82, fontWeight: 800 }}>
                      Total pool:{" "}
                      {Math.round(
                        item.rows.reduce(
                          (sum, row) => sum + skillSprintPrizeNow(safeNum(row.reward_points), row.assigned_at ?? null, row.due_at, nowMs),
                          0
                        )
                      )}{" "}
                      pts
                    </div>
                  </>
                ) : (
                  <div style={{ display: "grid", gap: 6 }}>
                    {item.rows.slice(0, item.kind === "group" ? 4 : 1).map((row) => (
                      <div key={`${item.key}-${row.id}`} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={miniAvatar()}>
                          {(() => {
                            const visual = avatarVisualForRow(row);
                            return (
                              <AvatarRender
                                size={38}
                                bg={visual.bg}
                                avatarSrc={visual.avatarSrc || null}
                                effect={visual.effect as any}
                                border={visual.border as any}
                                showImageBorder
                                bleed={0}
                                style={{ borderRadius: 0 }}
                                fallback={<span style={{ fontSize: 11, fontWeight: 1000 }}>{String(row.students?.name ?? "S").slice(0, 1).toUpperCase()}</span>}
                              />
                            );
                          })()}
                        </div>
                        <div style={{ textAlign: "left" }}>
                          <div style={{ fontSize: 12, fontWeight: 1000 }}>{row.students?.name ?? "Student"}</div>
                          <div style={skillLine()}>
                            {row.source_label} • {Math.max(0, daysRemaining(row.due_at, nowMs))}d • {shortDate(row.due_at)}
                          </div>
                        </div>
                      </div>
                    ))}
                    {item.kind === "group" && item.rows.length > 4 ? (
                      <div style={{ fontSize: 11, opacity: 0.72, fontWeight: 900 }}>+{item.rows.length - 4} more in this week</div>
                    ) : null}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section style={approachingBar()}>
        <div style={{ fontSize: 15, fontWeight: 1000, opacity: 0.92 }}>Deadlines In Next 14 Days</div>
        {!upcomingRows.length ? <div style={{ opacity: 0.7 }}>No Skill Sprint deadlines in next 14 days.</div> : null}
        <div style={approachingGrid()}>
          {upcomingRows.map((row) => {
            const complete = Boolean(row.completed_at);
            const prizeLeft = Math.round(skillSprintPrizeNow(safeNum(row.reward_points), row.assigned_at ?? null, row.due_at));
            const sevenDayLoss = complete ? 0 : Math.max(0, Math.round(safeNum(row.penalty_points_per_day) * 7));
            const fourteenDayLoss = complete ? 0 : Math.max(0, Math.round(safeNum(row.penalty_points_per_day) * 14));
            return (
              <article key={`upcoming-${row.id}`} style={approachingCard(complete)}>
                <div style={{ fontSize: 14, fontWeight: 1000 }}>{row.students?.name ?? "Student"}</div>
                <div style={{ fontSize: 12, opacity: 0.86, fontWeight: 800 }}>{row.source_label}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                  <span style={chip("rgba(30,64,175,0.34)", "rgba(96,165,250,0.5)")}>{formatLeft(row.due_at, nowMs)}</span>
                  <span style={chip("rgba(22,101,52,0.34)", "rgba(74,222,128,0.52)")}>Pool left: {prizeLeft}</span>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 12, fontWeight: 900 }}>
                  <span>+7d loss: {sevenDayLoss}</span>
                  <span>+14d loss: {fourteenDayLoss}</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function page(): React.CSSProperties {
  return {
    minHeight: "100vh",
    padding: "22px 18px",
    color: "white",
    background:
      "radial-gradient(circle at 10% 8%, rgba(56,189,248,0.18), transparent 55%), radial-gradient(circle at 85% 75%, rgba(250,204,21,0.15), transparent 55%), linear-gradient(140deg, #020617, #0f172a 48%, #111827)",
  };
}

function menuWrap(): React.CSSProperties {
  return { position: "absolute", top: 16, right: 16, zIndex: 20 };
}

function menuSelect(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(2,6,23,0.75)",
    color: "white",
    fontWeight: 800,
    fontSize: 11,
  };
}

function hero(): React.CSSProperties {
  return { display: "grid", gap: 5, marginBottom: 14, justifyItems: "center", textAlign: "center" };
}

function title(): React.CSSProperties {
  return { fontSize: 36, fontWeight: 1000 };
}

function subhead(): React.CSSProperties {
  return { fontSize: 14, opacity: 0.75, fontWeight: 800 };
}

function notice(): React.CSSProperties {
  return {
    borderRadius: 10,
    border: "1px solid rgba(248,113,113,0.45)",
    background: "rgba(127,29,29,0.45)",
    padding: "8px 10px",
    fontWeight: 900,
  };
}

function layout(): React.CSSProperties {
  return {
    display: "block",
    alignItems: "stretch",
  };
}

function chip(bg: string, border: string): React.CSSProperties {
  return {
    borderRadius: 999,
    border: `1px solid ${border}`,
    background: bg,
    padding: "4px 10px",
    fontSize: 12,
    fontWeight: 900,
  };
}

function timelineStage(): React.CSSProperties {
  return {
    position: "relative",
    minHeight: 790,
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.28)",
    background: "rgba(2,6,23,0.72)",
    overflow: "hidden",
    display: "grid",
    placeItems: "center",
    padding: "10px 8px",
  };
}

function timelineScene(): React.CSSProperties {
  return {
    position: "relative",
    width: VIEW_W,
    height: VIEW_H,
  };
}

function approachingBar(): React.CSSProperties {
  return {
    marginTop: 12,
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.28)",
    background: "rgba(2,6,23,0.72)",
    padding: 12,
    display: "grid",
    gap: 10,
  };
}

function approachingGrid(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 10,
  };
}

function approachingCard(completed: boolean): React.CSSProperties {
  return {
    borderRadius: 12,
    border: completed ? "1px solid rgba(74,222,128,0.62)" : "1px solid rgba(248,113,113,0.62)",
    background: completed ? "rgba(20,83,45,0.36)" : "rgba(127,29,29,0.34)",
    padding: "10px 11px",
    display: "grid",
    gap: 2,
  };
}

function sparkleCanvas(): React.CSSProperties {
  return {
    position: "absolute",
    left: 0,
    top: 0,
    width: VIEW_W,
    height: VIEW_H,
    pointerEvents: "none",
    opacity: 0.95,
  };
}

function svgLayer(): React.CSSProperties {
  return {
    position: "absolute",
    left: 0,
    top: 0,
    width: VIEW_W,
    height: VIEW_H,
    pointerEvents: "none",
  };
}

function goalCard(x: number, y: number, kind: "single" | "group" | "summary", selected: boolean): React.CSSProperties {
  const width = markerCardWidth(kind);
  const height = markerCardHeight(kind);
  return {
    position: "absolute",
    left: x,
    top: y,
    width,
    minHeight: height,
    borderRadius: 0,
    border: selected ? "1px solid rgba(56,189,248,0.8)" : "1px solid rgba(148,163,184,0.35)",
    background: selected
      ? "linear-gradient(135deg, rgba(15,98,170,0.45), rgba(15,23,42,0.92) 48%, rgba(3,105,161,0.2))"
      : "linear-gradient(135deg, rgba(30,41,59,0.92), rgba(2,6,23,0.9) 52%, rgba(15,23,42,0.84))",
    color: "white",
    padding: "9px 11px",
    cursor: "pointer",
    boxShadow: selected ? "0 0 24px rgba(56,189,248,0.33)" : "0 10px 28px rgba(2,6,23,0.5)",
    textAlign: "left",
  };
}

function miniAvatar(): React.CSSProperties {
  return {
    width: 38,
    height: 38,
    borderRadius: 0,
    border: "1px solid rgba(148,163,184,0.45)",
    background: "rgba(30,41,59,0.85)",
    overflow: "hidden",
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  };
}

function skillLine(): React.CSSProperties {
  return {
    fontSize: 11,
    opacity: 0.82,
    fontWeight: 800,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    textOverflow: "ellipsis",
    lineHeight: 1.15,
    maxWidth: 300,
  };
}

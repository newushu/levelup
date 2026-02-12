"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import AvatarRender from "@/components/AvatarRender";

type SessionRow = {
  instance_id?: string | null;
  class_id?: string | null;
  class_name?: string | null;
  start_time?: string | null;
  end_time?: string | null;
};

type RosterRow = {
  checkin_id: string;
  checked_in_at?: string | null;
  student: {
    id: string;
    name: string;
    level?: number | null;
    points_total?: number | null;
    avatar_storage_path?: string | null;
    avatar_bg?: string | null;
    avatar_effect?: string | null;
    corner_border_url?: string | null;
    corner_border_render_mode?: string | null;
    corner_border_html?: string | null;
    corner_border_css?: string | null;
    corner_border_js?: string | null;
    corner_border_offset_x?: number | null;
    corner_border_offset_y?: number | null;
    corner_border_offsets_by_context?: Record<string, { x?: number | null; y?: number | null; scale?: number | null }> | null;
  };
};

export default function ClassroomDisplayPage() {
  const params = useSearchParams();
  const lockInstanceId = String(params.get("lock_instance_id") ?? "").trim();
  const lockClassId = String(params.get("lock_class_id") ?? "").trim();
  const previewUntil = Number(params.get("preview_until") ?? 0);
  const [localInstanceId, setLocalInstanceId] = useState("");
  const [localClassId, setLocalClassId] = useState("");
  const localChannelRef = useRef<BroadcastChannel | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [rosterMsg, setRosterMsg] = useState("");
  const [today, setToday] = useState<string>("");
  const [now, setNow] = useState<Date>(new Date());
  const [msg, setMsg] = useState("");
  const [effectConfigByKey, setEffectConfigByKey] = useState<
    Record<string, { config?: any; render_mode?: string | null; html?: string | null; css?: string | null; js?: string | null }>
  >({});
  const cornerOffsets = useMemo(() => ({ x: -10, y: -10, size: 72 }), []);

  const effectiveInstanceId = localInstanceId || lockInstanceId;
  const effectiveClassId = localClassId || lockClassId;

  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
    localChannelRef.current = new BroadcastChannel("coach-display-local");
    const channel = localChannelRef.current;
    channel.onmessage = (event) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "classroom_lock") {
        setLocalInstanceId(String(data.instanceId ?? ""));
        setLocalClassId(String(data.classId ?? ""));
      }
    };
    return () => {
      channel.close();
      localChannelRef.current = null;
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/class-sessions/today?include_ended=1", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) return;
        setSessions((data.sessions ?? []) as SessionRow[]);
        setToday(String(data?.today ?? "") || new Date().toISOString().slice(0, 10));
        setMsg("");
      } catch (err: any) {
        setMsg(err?.message ?? "Failed to load schedule");
      }
    };
    load();
    const timer = window.setInterval(load, 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await fetch("/api/avatar-effects/list", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!active || !data?.ok) return;
      const list = (data.effects ?? []) as Array<{
        key: string;
        config?: any;
        render_mode?: string | null;
        html?: string | null;
        css?: string | null;
        js?: string | null;
      }>;
      const map: Record<string, { config?: any; render_mode?: string | null; html?: string | null; css?: string | null; js?: string | null }> = {};
      list.forEach((e) => {
        if (e?.key) map[String(e.key)] = { config: e.config, render_mode: e.render_mode ?? null, html: e.html ?? null, css: e.css ?? null, js: e.js ?? null };
      });
      setEffectConfigByKey(map);
    })();
    return () => {
      active = false;
    };
  }, []);

  const targetSession = useMemo(() => {
    if (!sessions.length) return null;
    if (effectiveInstanceId) {
      const match = sessions.find((s) => String(s.instance_id ?? "") === effectiveInstanceId);
      if (match) return match;
    }
    const date = today || new Date().toISOString().slice(0, 10);
    const upcoming = sessions
      .map((s) => ({ ...s, startAt: toDateTime(date, String(s.start_time ?? "")) }))
      .filter((s) => s.startAt && s.startAt.getTime() > now.getTime())
      .sort((a, b) => (a.startAt?.getTime() ?? 0) - (b.startAt?.getTime() ?? 0));
    return upcoming[0] ?? null;
  }, [sessions, effectiveInstanceId, today, now]);

  const startAt = useMemo(() => {
    if (!targetSession?.start_time) return null;
    const date = today || new Date().toISOString().slice(0, 10);
    return toDateTime(date, String(targetSession.start_time ?? ""));
  }, [targetSession, today]);

  const isCountdownActive = useMemo(() => {
    if (!startAt) return false;
    const diffMs = startAt.getTime() - now.getTime();
    return diffMs > 0 && diffMs <= 10 * 60 * 1000;
  }, [startAt, now]);

  const previewActive = useMemo(() => {
    if (!Number.isFinite(previewUntil) || previewUntil <= 0) return false;
    return previewUntil > now.getTime();
  }, [previewUntil, now]);

  const countdownText = useMemo(() => {
    if (previewActive) {
      const diffMs = Math.max(0, previewUntil - now.getTime());
      const totalSeconds = Math.floor(diffMs / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    if (!startAt) return "--:--";
    const diffMs = Math.max(0, startAt.getTime() - now.getTime());
    const totalSeconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [startAt, now, previewActive, previewUntil]);

  const rosterInstanceId = useMemo(() => {
    if (effectiveInstanceId) return effectiveInstanceId;
    if (targetSession?.instance_id) return String(targetSession.instance_id);
    return "";
  }, [effectiveInstanceId, targetSession]);

  const displayRoster = useMemo(() => {
    const items: Array<{ type: "row"; row: RosterRow } | { type: "placeholder"; row: null }> = roster.map((row) => ({
      type: "row" as const,
      row,
    }));
    const minSlots = 10;
    const needed = Math.max(0, minSlots - items.length);
    for (let i = 0; i < needed; i += 1) {
      items.push({ type: "placeholder" as const, row: null });
    }
    return items;
  }, [roster]);
  const denseRoster = roster.length > 12;

  useEffect(() => {
    if (!rosterInstanceId) {
      setRoster([]);
      return;
    }
    let active = true;
    const loadRoster = async () => {
      try {
        const res = await fetch("/api/classroom/roster", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instance_id: rosterInstanceId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok || !data?.ok) {
          setRosterMsg(data?.error || "Failed to load roster");
          setRoster([]);
          return;
        }
        setRosterMsg("");
        setRoster((data?.roster ?? []).map((row: any) => ({
          checkin_id: String(row.checkin_id ?? ""),
          checked_in_at: row.checked_in_at ?? null,
          student: {
            id: String(row?.student?.id ?? ""),
            name: String(row?.student?.name ?? ""),
            level: row?.student?.level ?? null,
            points_total: row?.student?.points_total ?? null,
            avatar_storage_path: row?.student?.avatar_storage_path ?? null,
            avatar_bg: row?.student?.avatar_bg ?? null,
            avatar_effect: row?.student?.avatar_effect ?? null,
            corner_border_url: row?.student?.corner_border_url ?? null,
            corner_border_render_mode: row?.student?.corner_border_render_mode ?? null,
            corner_border_html: row?.student?.corner_border_html ?? null,
            corner_border_css: row?.student?.corner_border_css ?? null,
            corner_border_js: row?.student?.corner_border_js ?? null,
            corner_border_offset_x: row?.student?.corner_border_offset_x ?? null,
            corner_border_offset_y: row?.student?.corner_border_offset_y ?? null,
            corner_border_offsets_by_context: row?.student?.corner_border_offsets_by_context ?? null,
          },
        })));
      } catch (err: any) {
        if (!active) return;
        setRosterMsg(err?.message ?? "Failed to load roster");
        setRoster([]);
      }
    };
    loadRoster();
    const timer = window.setInterval(loadRoster, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [rosterInstanceId]);

  return (
    <AuthGate>
      <div style={page()}>
        {msg ? <div style={msgStyle()}>{msg}</div> : null}
        {rosterMsg ? <div style={msgStyle()}>{rosterMsg}</div> : null}
        {isCountdownActive || previewActive ? (
          <div style={countdownWrap()}>
            <style>{`
              @keyframes rosterPulse {
                0% { transform: translateY(0) scale(1); box-shadow: 0 0 0 rgba(59,130,246,0.0); }
                50% { transform: translateY(-2px) scale(1.01); box-shadow: 0 0 18px rgba(59,130,246,0.25); }
                100% { transform: translateY(0) scale(1); box-shadow: 0 0 0 rgba(59,130,246,0.0); }
              }
            `}</style>
            <div style={rulesLabel()}>Classroom Rules</div>
            <div style={preclassGrid()}>
              <div style={ring()}>
                <div style={ruleCard(0)}>A • Arrive</div>
                <div style={ruleCard(1)}>B • Bow at door</div>
                <div style={ruleCard(2)}>C • Check in</div>
                <div style={ruleCard(3)}>D • Dots</div>
                <div style={ruleCard(4)}>E • Effort</div>
                <div style={ruleCard(5)}>F • Focus</div>
                <div style={timerCore()}>
                  <div style={timerLabel()}>{previewActive ? "Pre-class starts" : "Class starts in"}</div>
                  <div style={timerValue()}>{countdownText}</div>
                  <div style={timerSub()}>
                    {targetSession?.class_name || "Classroom"}
                    {effectiveClassId ? " • Locked" : ""}
                  </div>
                </div>
              </div>
              <div style={rosterCard()}>
                <div style={rosterHeader()}>
                  <div style={rosterTitle()}>Checked-in Roster</div>
                  <div style={rosterMeta()}>
                    {targetSession?.class_name || "Class"} • {roster.length} checked in
                  </div>
                </div>
                <div style={rosterList(denseRoster)}>
                  {displayRoster.length ? (
                    displayRoster.map((item, idx) => {
                      if (item.type === "placeholder") {
                        return (
                          <div key={`placeholder-${idx}`} style={rosterPlaceholder(denseRoster)}>
                            <div style={rosterPlaceholderAvatar(denseRoster)} />
                            <div style={rosterPlaceholderBar(denseRoster)} />
                            <div style={rosterPlaceholderSub()} />
                          </div>
                        );
                      }
                      const row = item.row;
                      if (!row) return null;
                      return (
                        <div key={row.checkin_id} style={rosterRow(denseRoster)}>
                          <div style={rosterAvatarShell(denseRoster)}>
                            <AvatarRender
                            size={denseRoster ? 78 : 92}
                            bg={avatarBackground(row.student.avatar_bg ?? null)}
                            border={buildBorderFromStudent(row.student)}
                            effect={buildEffectFromKey(row.student.avatar_effect, effectConfigByKey)}
                            avatarSrc={resolveAvatarUrl(row.student.avatar_storage_path) ?? undefined}
                            cornerOffsets={cornerOffsets}
                            bleed={denseRoster ? 16 : 20}
                            contextKey="classroom"
                            style={rosterAvatarFrame()}
                            fallback={<div style={rosterAvatarInitials()}>{initialsFor(row.student.name)}</div>}
                          />
                        </div>
                        <div style={rosterName()}>{row.student.name}</div>
                          <div style={rosterSub()}>
                            L{row.student.level ?? "—"} • {row.student.points_total ?? 0} pts
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={rosterEmpty()}>No check-ins yet</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={card()}>
            <div style={{ fontSize: 30, fontWeight: 1000 }}>Classroom Display</div>
            <div style={{ opacity: 0.7, fontSize: 14 }}>
              {targetSession?.class_name ? `Next: ${targetSession.class_name}` : "Waiting for class"}
            </div>
          </div>
        )}
      </div>
    </AuthGate>
  );
}

function page(): React.CSSProperties {
  return {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "radial-gradient(circle at top, rgba(56,189,248,0.15), rgba(2,6,23,0.95))",
    color: "white",
    padding: 24,
  };
}

function card(): React.CSSProperties {
  return {
    borderRadius: 20,
    padding: 24,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(15,23,42,0.7)",
    textAlign: "center",
    display: "grid",
    gap: 8,
  };
}

function msgStyle(): React.CSSProperties {
  return { position: "absolute", top: 16, right: 16, fontSize: 12, opacity: 0.7 };
}

function countdownWrap(): React.CSSProperties {
  return {
    display: "grid",
    gap: 16,
    alignItems: "center",
    justifyItems: "center",
    width: "100%",
  };
}

function preclassGrid(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "1.7fr 1.3fr",
    gap: 24,
    alignItems: "center",
    width: "100%",
    maxWidth: 1600,
  };
}

function rulesLabel(): React.CSSProperties {
  return {
    textTransform: "uppercase",
    letterSpacing: 2,
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.8,
  };
}

function ring(): React.CSSProperties {
  return {
    position: "relative",
    width: 640,
    height: 640,
    borderRadius: "50%",
    border: "2px dashed rgba(255,255,255,0.26)",
    display: "grid",
    placeItems: "center",
    boxShadow: "0 0 40px rgba(59,130,246,0.25), inset 0 0 30px rgba(255,255,255,0.05)",
  };
}

function rosterCard(): React.CSSProperties {
  return {
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(15,23,42,0.85)",
    padding: 24,
    minHeight: 740,
    display: "grid",
    gridTemplateRows: "auto 1fr",
    gap: 16,
    width: "100%",
    maxWidth: 820,
    justifySelf: "end",
    overflow: "hidden",
  };
}

function rosterHeader(): React.CSSProperties {
  return { display: "grid", gap: 6 };
}

function rosterTitle(): React.CSSProperties {
  return { fontSize: 26, fontWeight: 900 };
}

function rosterMeta(): React.CSSProperties {
  return { fontSize: 13, opacity: 0.7, letterSpacing: 0.4, textTransform: "uppercase" };
}

function rosterList(dense: boolean): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: `repeat(${dense ? 5 : 4}, minmax(0, 1fr))`,
    gap: 12,
    overflowY: "auto",
    overflowX: "hidden",
    maxHeight: 620,
    paddingRight: 6,
    minWidth: 0,
  };
}

function rosterRow(dense: boolean): React.CSSProperties {
  return {
    display: "grid",
    gap: 8,
    padding: dense ? "10px 8px" : "12px 10px",
    borderRadius: 16,
    background: "linear-gradient(160deg, rgba(30,41,59,0.7), rgba(15,23,42,0.9))",
    border: "1px solid rgba(255,255,255,0.12)",
    textAlign: "center",
    alignItems: "center",
    justifyItems: "center",
    animation: "rosterPulse 4.4s ease-in-out infinite",
    minHeight: dense ? 140 : 170,
  };
}

function rosterName(): React.CSSProperties {
  return { fontSize: 18, fontWeight: 900, lineHeight: 1.1 };
}

function rosterSub(): React.CSSProperties {
  return { fontSize: 11, opacity: 0.75 };
}

function rosterEmpty(): React.CSSProperties {
  return { fontSize: 18, opacity: 0.7, textAlign: "center", paddingTop: 60 };
}

function rosterPlaceholder(dense: boolean): React.CSSProperties {
  return {
    display: "grid",
    gap: 10,
    padding: dense ? "10px 8px" : "12px 10px",
    borderRadius: 16,
    border: "1px dashed rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.55)",
    alignItems: "center",
    justifyItems: "center",
    minHeight: dense ? 140 : 170,
    opacity: 0.55,
  };
}

function rosterPlaceholderAvatar(dense: boolean): React.CSSProperties {
  return {
    width: dense ? 56 : 68,
    height: dense ? 56 : 68,
    borderRadius: dense ? 14 : 18,
    background: "rgba(148,163,184,0.2)",
    border: "1px solid rgba(255,255,255,0.1)",
  };
}

function rosterPlaceholderBar(dense: boolean): React.CSSProperties {
  return {
    width: "80%",
    height: dense ? 8 : 10,
    borderRadius: 999,
    background: "rgba(148,163,184,0.2)",
  };
}

function rosterPlaceholderSub(): React.CSSProperties {
  return {
    width: "60%",
    height: 8,
    borderRadius: 999,
    background: "rgba(148,163,184,0.18)",
  };
}

function avatarBackground(bg: string | null) {
  return bg
    ? `linear-gradient(135deg, rgba(255,255,255,0.2), rgba(0,0,0,0.35)), ${bg}`
    : "linear-gradient(135deg, rgba(255,255,255,0.25), rgba(0,0,0,0.35))";
}

function buildBorderFromStudent(student: {
  corner_border_url?: string | null;
  corner_border_render_mode?: string | null;
  corner_border_html?: string | null;
  corner_border_css?: string | null;
  corner_border_js?: string | null;
  corner_border_offset_x?: number | null;
  corner_border_offset_y?: number | null;
  corner_border_offsets_by_context?: Record<string, { x?: number | null; y?: number | null; scale?: number | null }> | null;
}) {
  return {
    render_mode: student.corner_border_render_mode ?? null,
    image_url: student.corner_border_url ?? null,
    html: student.corner_border_html ?? null,
    css: student.corner_border_css ?? null,
    js: student.corner_border_js ?? null,
    offset_x: student.corner_border_offset_x ?? null,
    offset_y: student.corner_border_offset_y ?? null,
    offsets_by_context: student.corner_border_offsets_by_context ?? null,
  };
}

function buildEffectFromKey(
  key: string | null | undefined,
  map: Record<string, { config?: any; render_mode?: string | null; html?: string | null; css?: string | null; js?: string | null }>
) {
  const effect = key ? map[String(key)] : undefined;
  return {
    key: key ?? null,
    config: effect?.config ?? null,
    render_mode: effect?.render_mode ?? null,
    html: effect?.html ?? null,
    css: effect?.css ?? null,
    js: effect?.js ?? null,
  };
}

function rosterAvatarShell(dense: boolean): React.CSSProperties {
  return {
    width: dense ? 80 : 96,
    height: dense ? 80 : 96,
    borderRadius: dense ? 18 : 24,
    position: "relative",
    overflow: "visible",
    display: "grid",
    placeItems: "center",
  };
}

function rosterAvatarFrame(): React.CSSProperties {
  return {
    border: "1px solid rgba(255,255,255,0.2)",
    boxShadow:
      "inset 0 2px 10px rgba(255,255,255,0.12), inset 0 -8px 14px rgba(0,0,0,0.45), 0 12px 24px rgba(0,0,0,0.4)",
  };
}

function rosterAvatarInitials(): React.CSSProperties {
  return { fontSize: 18, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", opacity: 0.9 };
}

const ringPositions: Array<React.CSSProperties> = [
  { top: -16, left: "50%", transform: "translate(-50%, 0)" }, // A
  { top: 70, left: 40 }, // B
  { top: 70, right: 40 }, // C
  { bottom: 70, right: 40 }, // D
  { bottom: 70, left: 40 }, // E
  { bottom: -16, left: "50%", transform: "translate(-50%, 0)" }, // F
];

function ruleCard(idx: number): React.CSSProperties {
  const palette = [
    { bg: "rgba(34,197,94,0.24)", border: "rgba(34,197,94,0.6)" },
    { bg: "rgba(59,130,246,0.24)", border: "rgba(59,130,246,0.6)" },
    { bg: "rgba(244,63,94,0.24)", border: "rgba(244,63,94,0.6)" },
    { bg: "rgba(250,204,21,0.24)", border: "rgba(250,204,21,0.6)" },
    { bg: "rgba(168,85,247,0.24)", border: "rgba(168,85,247,0.6)" },
    { bg: "rgba(14,165,233,0.24)", border: "rgba(14,165,233,0.6)" },
  ];
  const tone = palette[idx % palette.length];
  return {
    position: "absolute",
    ...ringPositions[idx],
    width: 210,
    padding: "16px 18px",
    borderRadius: 18,
    border: `2px solid ${tone.border}`,
    background: `linear-gradient(160deg, ${tone.bg}, rgba(15,23,42,0.85))`,
    fontWeight: 900,
    fontSize: 16,
    textAlign: "center",
    boxShadow: "0 0 26px rgba(59,130,246,0.25), inset 0 0 12px rgba(255,255,255,0.12)",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  };
}

function timerCore(): React.CSSProperties {
  return {
    width: 360,
    height: 360,
    borderRadius: "50%",
    border: "3px solid rgba(56,189,248,0.7)",
    background: "radial-gradient(circle at top, rgba(56,189,248,0.25), rgba(2,6,23,0.95))",
    display: "grid",
    placeItems: "center",
    textAlign: "center",
    boxShadow: "0 0 30px rgba(56,189,248,0.35), inset 0 0 18px rgba(255,255,255,0.08)",
    padding: 18,
  };
}

function timerLabel(): React.CSSProperties {
  return { fontSize: 14, fontWeight: 900, opacity: 0.8, textTransform: "uppercase", letterSpacing: 1.4 };
}

function timerValue(): React.CSSProperties {
  return { fontSize: 96, fontWeight: 1000, letterSpacing: 2 };
}

function timerSub(): React.CSSProperties {
  return { fontSize: 14, opacity: 0.8, fontWeight: 800 };
}

function toDateTime(date: string, time: string) {
  const clean = String(time ?? "").trim();
  if (!clean) return null;
  const parts = clean.split(":");
  const hh = parts[0] ?? "00";
  const mm = parts[1] ?? "00";
  const ss = parts[2] ?? "00";
  return new Date(`${date}T${hh.padStart(2, "0")}:${mm.padStart(2, "0")}:${ss.padStart(2, "0")}`);
}

function resolveAvatarUrl(value: string) {
  const clean = String(value ?? "").trim();
  if (!clean) return "";
  if (/^https?:\/\//i.test(clean)) return clean;
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) return clean;
  const normalized = clean.replace(/^\/+/, "");
  if (normalized.startsWith("storage/v1/object/public/")) {
    return `${baseUrl}/${normalized}`;
  }
  const fullPath = normalized.startsWith("avatars/") ? normalized : `avatars/${normalized}`;
  return `${baseUrl}/storage/v1/object/public/${fullPath}`;
}

function initialsFor(name: string) {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "S";
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0]}${parts[parts.length - 1][0]}`;
}

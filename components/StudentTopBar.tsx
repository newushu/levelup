"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AvatarRender from "@/components/AvatarRender";

type StudentRow = {
  id: string;
  name: string;
  level: number;
  points_total: number;
  is_competition_team: boolean;
  // optional if your /api/students/list already includes it
  avatar_storage_path?: string | null;
};
type CornerBorderRow = {
  key: string;
  image_url: string | null;
  render_mode?: string | null;
  html?: string | null;
  css?: string | null;
  js?: string | null;
  offset_x?: number | null;
  offset_y?: number | null;
  offsets_by_context?: Record<string, { x?: number | null; y?: number | null; scale?: number | null }> | null;
  unlock_level?: number | null;
  enabled?: boolean;
};
type CornerOffsets = { x: number; y: number; size: number };
type PlateOffsets = { x: number; y: number; size: number };
type CardPlateRow = { key: string; image_url: string | null; unlock_level?: number | null; enabled?: boolean };

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 180)}` } };
  }
}

export default function StudentTopBar({
  students,
  activeStudentId,
  onChangeStudent,
  rightSlot,
  sticky = false,
  stickyTop = 64,
  autoHide = true,
  dock = "top",
  quickPoints,
  onQuickPoints,
  storageBucketPrefix = "avatars/", // if your DB stores "avatars/dragon/dragon.png"
  prestigeBadges,
  readonly = false,
}: {
  students: StudentRow[];
  activeStudentId: string;
  onChangeStudent: (id: string) => void;
  rightSlot?: React.ReactNode;
  sticky?: boolean;
  stickyTop?: number;
  autoHide?: boolean;
  dock?: "top" | "left";
  quickPoints?: number[];
  onQuickPoints?: (delta: number) => void;
  storageBucketPrefix?: string;
  prestigeBadges?: string[];
  readonly?: boolean;
}) {
  const router = useRouter();
  const student = useMemo(() => students.find((s) => s.id === activeStudentId) ?? null, [students, activeStudentId]);
  const isComp = !!student?.is_competition_team;
  const isLeftDock = dock === "left";
  const studentListId = isLeftDock ? "student-picker-left" : "student-picker-top";

  // we’ll fetch the selected student's avatar_id + bg_color from your existing avatar settings endpoint,
  // then map to /api/avatars/list to resolve storage_path.
  const [avatarId, setAvatarId] = useState<string>("");
  const [bgColor, setBgColor] = useState<string>("rgba(0,0,0,0.22)");
  const [avatarImgSrc, setAvatarImgSrc] = useState<string>("");
  const [avatarEffectKey, setAvatarEffectKey] = useState<string | null>(null);
  const [effectCatalog, setEffectCatalog] = useState<Array<{ key: string; config?: any; render_mode?: string | null; z_layer?: string | null; z_index?: number | null; html?: string | null; css?: string | null; js?: string | null }>>([]);
  const [visible, setVisible] = useState(true);
  const [clientReady, setClientReady] = useState(false);
  const [navLinksEnabled, setNavLinksEnabled] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cornerBorders, setCornerBorders] = useState<CornerBorderRow[]>([]);
  const [cornerBorderKey, setCornerBorderKey] = useState<string>("");
  const [cornerOffsets, setCornerOffsets] = useState<CornerOffsets>({ x: -8, y: -8, size: 72 });
  const [cardPlates, setCardPlates] = useState<CardPlateRow[]>([]);
  const [cardPlateKey, setCardPlateKey] = useState<string>("");
  const [plateOffsets, setPlateOffsets] = useState<PlateOffsets>({ x: 0, y: 0, size: 200 });
  const [studentQuery, setStudentQuery] = useState("");
  const avatarSettingsReq = useRef(0);
  const selectedCornerBorder = useMemo(() => {
    if (!cornerBorderKey) return null;
    const border = cornerBorders.find((b) => b.key === cornerBorderKey);
    if (!border || border.enabled === false) return null;
    const unlockLevel = Number(border.unlock_level ?? 1);
    if (student && student.level < unlockLevel) return null;
    return border;
  }, [cornerBorderKey, cornerBorders, student?.level]);
  const cardPlateUrl = useMemo(() => {
    if (!cardPlateKey) return "";
    const plate = cardPlates.find((p) => p.key === cardPlateKey);
    if (!plate || plate.enabled === false) return "";
    const unlockLevel = Number(plate.unlock_level ?? 1);
    if (student && student.level < unlockLevel) return "";
    return String(plate.image_url ?? "");
  }, [cardPlateKey, cardPlates, student?.level]);

  // local cache for avatar catalog (id->storage_path)
  const [avatarCatalog, setAvatarCatalog] = useState<Array<{ id: string; storage_path: string | null; enabled: boolean }>>([]);

  useEffect(() => {
    const read = () => {
      try {
        setNavLinksEnabled(localStorage.getItem("nav_student_links") === "true");
      } catch {}
    };
    read();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "nav_student_links") read();
    };
    const onCustom = () => read();
    window.addEventListener("storage", onStorage);
    window.addEventListener("nav-links-changed", onCustom as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("nav-links-changed", onCustom as EventListener);
    };
  }, []);

  // load avatar catalog once
  useEffect(() => {
    (async () => {
      const r = await fetch("/api/avatars/list", { cache: "no-store" });
      const sj = await safeJson(r);
      if (sj.ok) setAvatarCatalog((sj.json?.avatars ?? []) as any[]);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/avatar-effects/list", { cache: "no-store" });
      const sj = await safeJson(r);
      if (sj.ok) setEffectCatalog((sj.json?.effects ?? []) as any[]);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/corner-borders", { cache: "no-store" });
      const sj = await safeJson(r);
      if (sj.ok) setCornerBorders((sj.json?.borders ?? []) as CornerBorderRow[]);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/corner-borders/settings", { cache: "no-store" });
      const sj = await safeJson(r);
      if (!sj.ok) return;
      setCornerOffsets({
        x: Number(sj.json?.settings?.selector_x ?? -8),
        y: Number(sj.json?.settings?.selector_y ?? -8),
        size: Number(sj.json?.settings?.selector_size ?? 72),
      });
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/card-plates", { cache: "no-store" });
      const sj = await safeJson(r);
      if (sj.ok) setCardPlates((sj.json?.plates ?? []) as CardPlateRow[]);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/card-plates/settings", { cache: "no-store" });
      const sj = await safeJson(r);
      if (!sj.ok) return;
      setPlateOffsets({
        x: Number(sj.json?.settings?.selector_x ?? 0),
        y: Number(sj.json?.settings?.selector_y ?? 0),
        size: Number(sj.json?.settings?.selector_size ?? 200),
      });
    })();
  }, []);

  // load avatar settings when student changes
  useEffect(() => {
    if (!activeStudentId) return;
    const reqId = ++avatarSettingsReq.current;
    const targetId = String(activeStudentId);

    (async () => {
      // reset while loading
      setAvatarImgSrc("");
      setAvatarId("");
      setBgColor("rgba(0,0,0,0.22)");
      setAvatarEffectKey(null);
      setCornerBorderKey("");
      setCardPlateKey("");

      const r = await fetch("/api/avatar/get", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: activeStudentId }),
      });
      const sj = await safeJson(r);
      if (!sj.ok) return;
      if (avatarSettingsReq.current !== reqId || String(activeStudentId) !== targetId) return;

      const s = sj.json?.settings ?? null;
      const id = String(s?.avatar_id ?? s?.avatar_base ?? "").trim(); // prefer avatar_id
      const bg = String(s?.bg_color ?? "").trim();
      const effectKey = String(s?.particle_style ?? "").trim();
      const cornerKey = String(s?.corner_border_key ?? "").trim();
      const plateKey = String(s?.card_plate_key ?? "").trim();
      if (bg) setBgColor(bg);
      if (id) setAvatarId(id);
      setAvatarEffectKey(effectKey || null);
      setCornerBorderKey(cornerKey);
      setCardPlateKey(plateKey);
    })();
  }, [activeStudentId]);

  useEffect(() => {
    const onAvatarSettings = (evt: Event) => {
      const detail = (evt as CustomEvent).detail as {
        student_id?: string;
        avatar_id?: string;
        bg_color?: string;
        particle_style?: string;
        corner_border_key?: string;
        card_plate_key?: string;
      };
      if (!detail || String(detail.student_id ?? "") !== String(activeStudentId ?? "")) return;
      if ("avatar_id" in detail) setAvatarId(String(detail.avatar_id ?? ""));
      if ("bg_color" in detail) setBgColor(String(detail.bg_color ?? ""));
      if ("particle_style" in detail) setAvatarEffectKey(String(detail.particle_style ?? "") || null);
      if ("corner_border_key" in detail) setCornerBorderKey(String(detail.corner_border_key ?? ""));
      if ("card_plate_key" in detail) setCardPlateKey(String(detail.card_plate_key ?? ""));
    };
    window.addEventListener("avatar-settings-changed", onAvatarSettings as EventListener);
    return () => window.removeEventListener("avatar-settings-changed", onAvatarSettings as EventListener);
  }, [activeStudentId]);

  useEffect(() => {
    setStudentQuery(student?.name ?? "");
  }, [student?.name, activeStudentId]);

  useEffect(() => {
    if (!sticky || !autoHide) return;
    setClientReady(true);
    const showAndScheduleHide = () => {
      setVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setVisible(false), 3000);
    };
    showAndScheduleHide();
    const onScroll = () => showAndScheduleHide();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [sticky, autoHide]);

  // compute image src whenever avatarId or catalog changes
  useEffect(() => {
    if (!avatarId) {
      setAvatarImgSrc("");
      return;
    }
    const found = avatarCatalog.find((a) => a.id === avatarId);
    const rawPath = String(found?.storage_path ?? "").trim();

    if (!rawPath) {
      setAvatarImgSrc("");
      return;
    }

    // IMPORTANT: your signed-url route expects query param "path" and will strip "avatars/" if present
    const src = `/api/storage/signed-url?path=${encodeURIComponent(rawPath)}`;
    setAvatarImgSrc(src);
  }, [avatarId, avatarCatalog]);

  const studentMatches = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return [] as StudentRow[];
    return students.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 8);
  }, [studentQuery, students]);

  function onPick(id: string) {
    const next = String(id ?? "").trim();
    if (!next) return;

    onChangeStudent(next);

    try {
      localStorage.setItem("active_student_id", next);
      window.dispatchEvent(new CustomEvent("active-student-changed", { detail: { student_id: next } }));
    } catch {}
  }

  function pickByQuery() {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return;
    const exact = students.find((s) => s.name.toLowerCase() === q);
    const fallback = exact ?? studentMatches[0];
    if (fallback) onPick(fallback.id);
  }

  function openDashboard() {
    if (!student) return;
    try {
      localStorage.setItem("active_student_id", student.id);
      window.dispatchEvent(new CustomEvent("active-student-changed", { detail: { student_id: student.id } }));
    } catch {}
    router.push("/dashboard");
  }

  return (
    <div
      style={{
        position: sticky ? (isLeftDock ? "fixed" : "sticky") : "relative",
        top: sticky ? stickyTop : undefined,
        left: sticky && isLeftDock ? 12 : undefined,
        zIndex: sticky ? 120 : 1,
        borderRadius: 22,
        padding: 12,
        border: isComp ? "1px solid rgba(59,130,246,0.35)" : "1px solid rgba(255,255,255,0.12)",
        background: isComp
          ? "linear-gradient(135deg, rgba(59,130,246,0.25), rgba(147,197,253,0.12), rgba(5,7,11,0.80))"
          : "rgba(5,7,11,0.80)",
        boxShadow: isComp
          ? "0 0 0 2px rgba(59,130,246,0.10), 0 18px 70px rgba(0,0,0,0.40)"
          : "0 18px 70px rgba(0,0,0,0.35)",
        color: "white",
        opacity: sticky && clientReady && !visible ? 0 : 1,
        transform:
          sticky && clientReady && !visible
            ? isLeftDock
              ? "translateX(-120%)"
              : "translateY(-120%)"
            : "translateY(0)",
        transition: clientReady ? "opacity 220ms ease, transform 220ms ease" : undefined,
        pointerEvents: sticky && clientReady && !visible ? "none" : "auto",
        width: isLeftDock ? 320 : undefined,
        maxWidth: isLeftDock ? 320 : undefined,
      }}
    >
      {isLeftDock ? (
        <div style={{ display: "grid", gap: 12 }}>
          {identityBlock()}
          {selectorBlock()}
          {rightSlot ? (
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>{rightSlot}</div>
          ) : null}
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          {identityBlock()}
          {selectorBlock()}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
            {rightSlot}
          </div>
        </div>
      )}
      {prestigeBadges?.length ? (
        <div
          style={{
            marginTop: 10,
            paddingTop: 8,
            borderTop: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: isLeftDock ? "flex-start" : "flex-end",
          }}
        >
          {prestigeBadges.slice(0, 10).map((url, idx) => (
            <div
              key={`${url}-${idx}`}
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.16)",
                background: "rgba(0,0,0,0.35)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <img src={url} alt="Prestige badge" style={{ width: 40, height: 40, objectFit: "contain" }} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );

  function identityBlock() {
    const selectedEffect = effectCatalog.find((e) => e.key === avatarEffectKey) ?? null;
    const avatarSize = isLeftDock ? 118 : 150;
    return (
      <div style={{ position: "relative", display: "flex", gap: 12, alignItems: "center", minWidth: isLeftDock ? "auto" : 320 }}>
        {cardPlateUrl ? <img src={cardPlateUrl} alt="" style={cardPlateStyle(plateOffsets)} /> : null}
        <div style={{ width: avatarSize, height: avatarSize, flex: "0 0 auto" }} title={isComp ? "Competition Team" : "Student"}>
          <AvatarRender
            key={`student-avatar-${activeStudentId}`}
            size={avatarSize}
            bg={bgColor && bgColor !== "null" ? bgColor : "rgba(0,0,0,0.22)"}
            border={
              selectedCornerBorder
                ? {
                    render_mode: selectedCornerBorder.render_mode ?? "image",
                    image_url: selectedCornerBorder.image_url ?? null,
                    html: selectedCornerBorder.html ?? null,
                    css: selectedCornerBorder.css ?? null,
                    js: selectedCornerBorder.js ?? null,
                    offset_x: selectedCornerBorder.offset_x ?? null,
                    offset_y: selectedCornerBorder.offset_y ?? null,
                    offsets_by_context: selectedCornerBorder.offsets_by_context ?? null,
                  }
                : null
            }
            effect={
              selectedEffect
                ? {
                    key: selectedEffect.key ?? null,
                    config: selectedEffect.config,
                    render_mode: selectedEffect.render_mode ?? null,
                    z_layer: selectedEffect.z_layer ?? null,
                    z_index: selectedEffect.z_index ?? null,
                    html: selectedEffect.html ?? null,
                    css: selectedEffect.css ?? null,
                    js: selectedEffect.js ?? null,
                  }
                : { key: avatarEffectKey }
            }
            avatarSrc={avatarImgSrc || null}
            cornerOffsets={cornerOffsets}
            bleed={20}
            contextKey="student_picker"
            style={{
              border: isComp ? "1px solid rgba(59,130,246,0.45)" : "1px solid rgba(255,255,255,0.14)",
              boxShadow: isComp ? "0 0 26px rgba(59,130,246,0.30)" : "0 14px 40px rgba(0,0,0,0.35)",
            }}
            fallback={<div style={{ fontWeight: 1100, opacity: 0.75, fontSize: 12 }}>No Avatar</div>}
          />
        </div>

        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
            {navLinksEnabled ? (
              <button onClick={openDashboard} style={nameLink()}>
                {student?.name ?? "Select a student"}
              </button>
            ) : (
              <div style={{ fontSize: isLeftDock ? 26 : 32, fontWeight: 1100, lineHeight: 1.05 }}>
                {student?.name ?? "Select a student"}
              </div>
            )}
            {isComp ? (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 1100,
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(59,130,246,0.35)",
                  background: "rgba(59,130,246,0.14)",
                  boxShadow: "0 0 18px rgba(59,130,246,0.20)",
                  position: "relative",
                  zIndex: 5,
                }}
              >
                ⭐ Competition Team
              </span>
            ) : null}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", opacity: 0.85, fontWeight: 900, fontSize: 12 }}>
            <span>
              LEVEL <b style={{ opacity: 1 }}>{student?.level ?? 0}</b>
            </span>
            <span>•</span>
            <span>
              POINTS <b style={{ opacity: 1 }}>{student?.points_total ?? 0}</b>
            </span>
          </div>
        </div>
      </div>
    );
  }

  function selectorBlock() {
    return (
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ opacity: 0.8, fontWeight: 1000 }}>Student</div>
        {readonly ? (
          <div style={{ fontWeight: 1000, fontSize: 14 }}>{student?.name ?? "Student"}</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            <input
              value={studentQuery}
              onChange={(e) => setStudentQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") pickByQuery();
              }}
              onBlur={() => {
                const exact = students.find((s) => s.name.toLowerCase() === studentQuery.trim().toLowerCase());
                if (exact) onPick(exact.id);
              }}
              list={studentListId}
              placeholder="Type student name and press Enter"
              style={{
                padding: "10px 14px",
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(0,0,0,0.28)",
                color: "white",
                fontWeight: 900,
                minWidth: isLeftDock ? 220 : 260,
                outline: "none",
              }}
            />
            <datalist id={studentListId}>
              {studentMatches.map((s) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>
            <select
              value={activeStudentId}
              onChange={(e) => {
                const next = String(e.target.value ?? "");
                const picked = students.find((s) => s.id === next);
                if (picked) setStudentQuery(picked.name);
                onPick(next);
              }}
              style={{
                padding: "12px 14px",
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(0,0,0,0.35)",
                color: "white",
                fontWeight: 1000,
                minWidth: isLeftDock ? 220 : 260,
                outline: "none",
              }}
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {quickPoints?.length && onQuickPoints ? (
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {quickPoints.filter((p) => p > 0).map((p) => (
                    <button key={`qp-${p}`} onClick={() => onQuickPoints(p)} style={quickBtn("good")}>
                      +{p}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {quickPoints.filter((p) => p < 0).map((p) => (
                    <button key={`qn-${p}`} onClick={() => onQuickPoints(p)} style={quickBtn("bad")}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    );
  }
}

function nameLink(): React.CSSProperties {
  return {
    background: "none",
    border: "none",
    padding: 0,
    margin: 0,
    fontSize: 32,
    fontWeight: 1100,
    lineHeight: 1.05,
    color: "white",
    cursor: "pointer",
    textAlign: "left",
  };
}

function quickBtn(kind: "good" | "bad"): React.CSSProperties {
  return {
    padding: "8px 12px",
    minWidth: 48,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: kind === "good" ? "rgba(22,163,74,0.28)" : "rgba(185,28,28,0.26)",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
    fontSize: 12,
    boxShadow: kind === "good" ? "0 6px 16px rgba(22,163,74,0.25)" : "0 6px 16px rgba(185,28,28,0.25)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

function cardPlateStyle(offset: PlateOffsets): React.CSSProperties {
  return {
    position: "absolute",
    top: offset.y,
    left: offset.x,
    width: offset.size,
    height: "auto",
    objectFit: "contain",
    pointerEvents: "none",
    zIndex: 8,
  };
}

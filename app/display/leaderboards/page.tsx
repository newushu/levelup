"use client";

import { useEffect, useMemo, useState } from "react";
import AvatarRender from "@/components/AvatarRender";

type LeaderboardRow = {
  rank: number;
  student_id: string;
  name: string;
  value: number;
  level: number;
  is_competition_team: boolean;
  avatar_storage_path: string | null;
  avatar_bg: string | null;
  avatar_zoom_pct?: number | null;
  card_plate_url?: string | null;
  prestige_badges?: string[];
  border?: {
    render_mode?: string | null;
    image_url?: string | null;
    html?: string | null;
    css?: string | null;
    js?: string | null;
    offset_x?: number | null;
    offset_y?: number | null;
    offsets_by_context?: Record<string, { x?: number | null; y?: number | null; scale?: number | null; rotate?: number | null }> | null;
    z_layer?: string | null;
    z_index?: number | null;
  } | null;
  effect?: {
    key?: string | null;
    config?: any;
    render_mode?: string | null;
    html?: string | null;
    css?: string | null;
    js?: string | null;
    z_layer?: string | null;
    z_index?: number | null;
  } | null;
};

type LeaderboardSlot = {
  slot: number;
  metric: string;
  title: string;
  unit: string | null;
  rows: LeaderboardRow[];
};

type LargeRotation = {
  slot: number;
  rotation: number[];
};

const DISPLAY_MENU = [
  { value: "/display", label: "Live Activity" },
  { value: "/display/skill-pulse", label: "Skill Pulse" },
  { value: "/display/battle-pulse", label: "Battle Pulse" },
  { value: "/display/badges", label: "Badges" },
  { value: "/display/leaderboards", label: "Leaderboards" },
];

export default function LeaderboardsDisplayPage() {
  const [slots, setSlots] = useState<LeaderboardSlot[]>([]);
  const [largeRotations, setLargeRotations] = useState<LargeRotation[]>([]);
  const [rotationSeconds, setRotationSeconds] = useState(10);
  const [status, setStatus] = useState("");
  const [menuValue, setMenuValue] = useState("/display/leaderboards");
  const [cornerOffsets, setCornerOffsets] = useState<{ x: number; y: number; size: number }>({ x: -10, y: -10, size: 72 });
  const [plateOffsets, setPlateOffsets] = useState<{ x: number; y: number; size: number }>({ x: 0, y: 0, size: 200 });
  const [rotationIndex, setRotationIndex] = useState<Record<number, number>>({ 5: 0, 6: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    setMenuValue(window.location.pathname || "/display/leaderboards");
  }, []);

  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    const load = async () => {
      try {
        const res = await fetch("/api/display/leaderboards?limit=8", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Failed to load leaderboards");
        if (mounted) {
          setSlots((data?.slots ?? []) as LeaderboardSlot[]);
          setLargeRotations((data?.large_rotations ?? []) as LargeRotation[]);
          setRotationSeconds(Math.max(5, Number(data?.rotation_seconds ?? 10)));
          setStatus("");
        }
      } catch (err: any) {
        if (mounted) setStatus(err?.message ?? "Failed to load leaderboards");
      }
    };
    load();
    timer = setInterval(load, 15000);
    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const interval = Math.max(5, rotationSeconds) * 1000;
    const timer = setInterval(() => {
      setRotationIndex((prev) => ({
        5: ((prev[5] ?? 0) + 1) % 3,
        6: ((prev[6] ?? 0) + 1) % 3,
      }));
    }, interval);
    return () => clearInterval(timer);
  }, [rotationSeconds]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/corner-borders/settings", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!mounted || !res.ok) return;
        const settings = data?.settings ?? {};
        setCornerOffsets({
          x: Number(settings.live_activity_x ?? -10),
          y: Number(settings.live_activity_y ?? -10),
          size: Number(settings.live_activity_size ?? 72),
        });
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/card-plates/settings", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!mounted || !res.ok) return;
        const settings = data?.settings ?? {};
        setPlateOffsets({
          x: Number(settings.live_activity_x ?? 0),
          y: Number(settings.live_activity_y ?? 0),
          size: Number(settings.live_activity_size ?? 200),
        });
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const rowsBySlot = useMemo(() => {
    if (!slots.length) {
      return Array.from({ length: 10 }, (_, idx) => ({
        slot: idx + 1,
        metric: "",
        title: "",
        unit: null,
        rows: [],
      }));
    }
    return [...slots].sort((a, b) => a.slot - b.slot);
  }, [slots]);

  const slotMap = useMemo(() => {
    const map = new Map<number, LeaderboardSlot>();
    rowsBySlot.forEach((slot) => map.set(slot.slot, slot));
    return map;
  }, [rowsBySlot]);

  const smallSlots = useMemo(() => rowsBySlot.filter((slot) => slot.slot >= 1 && slot.slot <= 4), [rowsBySlot]);

  const resolveLargeSlot = (slotNumber: number) => {
    const config = largeRotations.find((rot) => rot.slot === slotNumber);
    const rotation = config?.rotation?.length ? config.rotation : [slotNumber];
    const idx = rotationIndex[slotNumber] ?? 0;
    const pick = rotation[idx % rotation.length] ?? slotNumber;
    return {
      slotNumber: pick,
      slot: slotMap.get(pick) ?? {
        slot: pick,
        metric: "none",
        title: "",
        unit: null,
        rows: [],
      },
      rotation,
    };
  };

  const largeA = resolveLargeSlot(5);
  const largeB = resolveLargeSlot(6);

  return (
    <main style={page()}>
      <div style={menuWrap()}>
        <select
          value={menuValue}
          onChange={(e) => {
            const next = e.target.value;
            setMenuValue(next);
            if (typeof window !== "undefined" && next && window.location.pathname !== next) {
              window.location.href = next;
            }
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

      <div style={header()}>
        <div style={title()}>Performance Lab Leaderboards</div>
        <div style={subtitle()}>Top performers across points + lab stats.</div>
        {status ? <div style={errorBanner()}>{status}</div> : null}
      </div>

      <div style={layout()}>
        <div style={smallGrid()}>
          {smallSlots.map((slot) => (
            <section key={slot.slot} style={card()}>
              <div style={cardHeader()}>
                <div>
                  <div style={cardTitle()}>{slot.title || `Leaderboard ${slot.slot}`}</div>
                  {slot.unit ? <div style={cardSubtitle()}>Unit: {slot.unit}</div> : null}
                </div>
              </div>
              <div style={rowsWrap()}>
                {renderRows(slot, 52, 3, false, cornerOffsets, plateOffsets)}
              </div>
            </section>
          ))}
        </div>
        <div style={largeGrid()}>
          {[largeA, largeB].map((bundle, idx) => (
            <section key={`large-${idx}`} style={largeCard()}>
              <div style={cardHeader()}>
                <div>
                  <div style={largeTitle()}>{bundle.slot.title || `Leaderboard ${bundle.slot.slot}`}</div>
                  {bundle.slot.unit ? <div style={cardSubtitle()}>Unit: {bundle.slot.unit}</div> : null}
                </div>
                <div style={rotationPill()}>
                  Rotating {((rotationIndex[idx === 0 ? 5 : 6] ?? 0) % 3) + 1}/3
                </div>
              </div>
              <div style={rowsWrap()}>
                {renderRows(bundle.slot, 90, 6, true, cornerOffsets, plateOffsets)}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
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

function formatValue(value: number) {
  if (Number.isNaN(value)) return "0";
  return Number(value).toLocaleString();
}

function page(): React.CSSProperties {
  return {
    minHeight: "100vh",
    padding: "24px 18px 32px",
    overflowX: "hidden",
    position: "relative",
    background:
      "radial-gradient(circle at 10% 20%, rgba(14,165,233,0.18), transparent 55%), radial-gradient(circle at 80% 10%, rgba(34,197,94,0.16), transparent 45%), radial-gradient(circle at 50% 80%, rgba(251,191,36,0.12), transparent 55%), linear-gradient(150deg, #020617, #0b1225 50%, #0f172a)",
    color: "white",
  };
}

function header(): React.CSSProperties {
  return {
    display: "grid",
    gap: 6,
    marginBottom: 20,
  };
}

function title(): React.CSSProperties {
  return {
    fontSize: 36,
    fontWeight: 1000,
    letterSpacing: 0.4,
  };
}

function subtitle(): React.CSSProperties {
  return {
    fontSize: 14,
    opacity: 0.7,
    fontWeight: 700,
  };
}

function grid(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: 14,
    alignItems: "stretch",
  };
}

function layout(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "0.95fr 1.55fr",
    gap: 18,
    alignItems: "start",
  };
}

function smallGrid(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 14,
  };
}

function largeGrid(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 18,
  };
}

function card(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(15,23,42,0.62)",
    display: "grid",
    gridTemplateRows: "auto 1fr",
    minHeight: 240,
  };
}

function largeCard(): React.CSSProperties {
  return {
    borderRadius: 22,
    padding: 18,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(15,23,42,0.72)",
    display: "grid",
    gridTemplateRows: "auto 1fr",
    minHeight: 320,
    height: "100%",
  };
}

function cardHeader(): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  };
}

function cardTitle(): React.CSSProperties {
  return {
    fontWeight: 900,
    fontSize: 14,
    letterSpacing: 0.3,
  };
}

function largeTitle(): React.CSSProperties {
  return {
    fontWeight: 1000,
    fontSize: 20,
    letterSpacing: 0.4,
  };
}

function cardSubtitle(): React.CSSProperties {
  return {
    fontSize: 11,
    opacity: 0.6,
  };
}

function rowsWrap(): React.CSSProperties {
  return {
    display: "grid",
    gap: 6,
    alignContent: "start",
  };
}

function rowStyle(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "24px 58px 1fr auto",
    gap: 10,
    alignItems: "center",
    padding: "6px 8px",
    borderRadius: 12,
    background: "rgba(2,6,23,0.6)",
    border: "1px solid rgba(255,255,255,0.06)",
  };
}

function rowStyleLarge(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "34px 98px 1fr auto",
    gap: 14,
    alignItems: "center",
    padding: "10px 12px",
    borderRadius: 16,
    background: "rgba(2,6,23,0.6)",
    border: "1px solid rgba(255,255,255,0.08)",
  };
}

function rankPill(): React.CSSProperties {
  return {
    fontWeight: 900,
    fontSize: 11,
    textAlign: "center",
    padding: "4px 0",
    borderRadius: 999,
    background: "rgba(59,130,246,0.2)",
    border: "1px solid rgba(59,130,246,0.4)",
  };
}

function rankPillLarge(): React.CSSProperties {
  return {
    fontWeight: 900,
    fontSize: 13,
    textAlign: "center",
    padding: "6px 0",
    borderRadius: 999,
    background: "rgba(59,130,246,0.25)",
    border: "1px solid rgba(59,130,246,0.5)",
  };
}

function avatarShell(): React.CSSProperties {
  return {
    width: 58,
    height: 58,
    position: "relative",
    display: "grid",
    placeItems: "center",
  };
}

function avatarShellLarge(): React.CSSProperties {
  return {
    width: 98,
    height: 98,
    position: "relative",
    display: "grid",
    placeItems: "center",
  };
}

function nameWrap(): React.CSSProperties {
  return {
    display: "grid",
    gap: 2,
  };
}

function nameStyle(): React.CSSProperties {
  return {
    fontWeight: 800,
    fontSize: 12,
  };
}

function nameStyleLarge(): React.CSSProperties {
  return {
    fontWeight: 900,
    fontSize: 16,
  };
}

function metaStyle(): React.CSSProperties {
  return {
    fontSize: 10,
    opacity: 0.65,
  };
}

function metaStyleLarge(): React.CSSProperties {
  return {
    fontSize: 12,
    opacity: 0.7,
  };
}

function valueStyle(): React.CSSProperties {
  return {
    fontWeight: 900,
    fontSize: 12,
  };
}

function valueStyleLarge(): React.CSSProperties {
  return {
    fontWeight: 1000,
    fontSize: 18,
  };
}

function emptyState(): React.CSSProperties {
  return {
    display: "grid",
    gap: 4,
    placeItems: "center",
    opacity: 0.7,
    fontSize: 12,
  };
}

function avatarFrameStyle(): React.CSSProperties {
  return {
    border: "1px solid rgba(255,255,255,0.2)",
    boxShadow: "inset 0 0 10px rgba(255,255,255,0.1), 0 8px 18px rgba(0,0,0,0.35)",
  };
}

function avatarFrameStyleLarge(): React.CSSProperties {
  return {
    border: "2px solid rgba(255,255,255,0.25)",
    boxShadow: "inset 0 0 16px rgba(255,255,255,0.12), 0 12px 26px rgba(0,0,0,0.45)",
  };
}

function avatarFallback(): React.CSSProperties {
  return {
    fontSize: 14,
    fontWeight: 900,
    color: "white",
  };
}

function initials(name: string) {
  const parts = String(name ?? "").trim().split(" ").filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return `${first}${last}`.toUpperCase();
}

function cardPlateStyle(offset: { x: number; y: number; size: number }): React.CSSProperties {
  return {
    position: "absolute",
    top: offset.y,
    left: offset.x,
    width: offset.size,
    height: "auto",
    objectFit: "contain",
    pointerEvents: "none",
    zIndex: 9,
  };
}

function rotationPill(): React.CSSProperties {
  return {
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(2,6,23,0.6)",
    fontSize: 11,
    fontWeight: 800,
  };
}

function renderRows(
  slot: LeaderboardSlot,
  avatarSize: number,
  maxBadges: number,
  large: boolean,
  cornerOffsets: { x: number; y: number; size: number },
  plateOffsets: { x: number; y: number; size: number }
) {
  if (slot.metric === "none") {
    return (
      <div style={emptyState()}>
        <div style={{ fontWeight: 800 }}>Empty Slot</div>
        <div style={{ opacity: 0.65, fontSize: 12 }}>Select a stat in Admin Custom.</div>
      </div>
    );
  }
  if (!slot.rows?.length) {
    return (
      <div style={emptyState()}>
        <div style={{ fontWeight: 800 }}>No data yet</div>
        <div style={{ opacity: 0.65, fontSize: 12 }}>Waiting for stats.</div>
      </div>
    );
  }
  return slot.rows.map((row) => (
    <div key={`${slot.slot}-${row.student_id}`} style={large ? rowStyleLarge() : rowStyle()}>
      <div style={large ? rankPillLarge() : rankPill()}>{row.rank}</div>
      <div style={large ? avatarShellLarge() : avatarShell()}>
        {row.card_plate_url ? (
          <img
            src={row.card_plate_url}
            alt=""
          style={cardPlateStyle(scalePlateOffsets(plateOffsets, avatarSize))}
        />
      ) : null}
      <AvatarRender
        size={avatarSize}
        bg={row.avatar_bg ?? "rgba(255,255,255,0.12)"}
          border={row.border ?? null}
          effect={row.effect ?? null}
          avatarSrc={row.avatar_storage_path ? resolveAvatarUrl(row.avatar_storage_path) : null}
          avatarZoomPct={row.avatar_zoom_pct ?? 100}
          cornerOffsets={cornerOffsets}
          bleed={large ? 26 : 18}
          contextKey="leaderboards"
          style={large ? avatarFrameStyleLarge() : avatarFrameStyle()}
          fallback={<div style={avatarFallback()}>{initials(row.name)}</div>}
        />
      </div>
      <div style={nameWrap()}>
        <div style={large ? nameStyleLarge() : nameStyle()}>{row.name}</div>
        <div style={large ? metaStyleLarge() : metaStyle()}>Level {row.level}</div>
        {row.prestige_badges?.length ? (
          <div style={badgeRow()}>
            {row.prestige_badges.slice(0, maxBadges).map((badgeUrl, idx) => (
              <img key={`${row.student_id}-badge-${idx}`} src={badgeUrl} alt="" style={badgeIcon()} />
            ))}
            {row.prestige_badges.length > maxBadges ? (
              <div style={badgeMore()}>+{row.prestige_badges.length - maxBadges}</div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div style={large ? valueStyleLarge() : valueStyle()}>{formatValue(row.value)}</div>
    </div>
  ));
}

function scalePlateOffsets(offset: { x: number; y: number; size: number }, targetSize: number) {
  const base = 200;
  const ratio = targetSize / base;
  return {
    x: Math.round(offset.x * ratio),
    y: Math.round(offset.y * ratio),
    size: Math.round(offset.size * ratio),
  };
}

function badgeRow(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
    flexWrap: "wrap",
  };
}

function badgeIcon(): React.CSSProperties {
  return {
    width: 16,
    height: 16,
    objectFit: "contain",
    filter: "drop-shadow(0 0 4px rgba(59,130,246,0.4))",
  };
}

function badgeMore(): React.CSSProperties {
  return {
    fontSize: 9,
    fontWeight: 900,
    padding: "1px 6px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(15,23,42,0.5)",
  };
}

function errorBanner(): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 12,
    background: "rgba(239,68,68,0.2)",
    border: "1px solid rgba(239,68,68,0.4)",
    fontSize: 12,
    fontWeight: 700,
    marginTop: 8,
    maxWidth: 420,
  };
}

function menuWrap(): React.CSSProperties {
  return {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 5,
  };
}

function menuSelect(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(2,6,23,0.7)",
    color: "white",
    fontWeight: 800,
    fontSize: 11,
  };
}

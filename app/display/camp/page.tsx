"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import AvatarRender from "@/components/AvatarRender";
import { supabaseClient } from "@/lib/supabase/client";

type CampDisplayMember = {
  id: string;
  student_id: string;
  display_role: string;
  secondary_role?: string;
  secondary_role_days?: string[];
  faction_id?: string | null;
  student: {
    id: string;
    name: string;
    level: number;
    points_total: number;
    avatar_storage_path?: string | null;
    avatar_bg?: string | null;
    avatar_zoom_pct?: number | null;
    avatar_effect?: string | null;
    corner_border_url?: string | null;
    corner_border_render_mode?: string | null;
    corner_border_html?: string | null;
    corner_border_css?: string | null;
    corner_border_js?: string | null;
    corner_border_offset_x?: number | null;
    corner_border_offset_y?: number | null;
    corner_border_offsets_by_context?: Record<string, { x?: number | null; y?: number | null; scale?: number | null; rotate?: number | null }> | null;
  };
  last_change?: {
    points: number;
    note: string;
    category: string;
    created_at: string;
  } | null;
  camp_tally?: {
    spotlight_stars: number;
    rule_keepers: number;
    rule_breakers: number;
    rule_keeper_points_earned?: number;
    rule_breaker_points_lost?: number;
    spotlight_bonus_ready: boolean;
    spotlight_bonus_progress: string;
  };
  redeem_status?: {
    can_redeem: boolean;
    available_points: number;
  };
};

type ApiPayload = {
  ok: boolean;
  error?: string;
  source_mode?: string;
  source_instance_id?: string | null;
  active_screen?: { id: number; title?: string | null; show_all_groups?: boolean; group_id?: string | null } | null;
  active_group_id?: string | null;
  show_all_groups?: boolean;
  groups?: Array<{ id: string; roster_id: string; name: string }>;
  rosters?: Array<{ id: string; name: string }>;
  camp_role_point_config?: { seller_daily_points?: number; cleaner_daily_points?: number };
  factions?: Array<{ id: string; name: string; color?: string | null; icon?: string | null; logo_url?: string | null }>;
  active_roster_id?: string;
  display_members?: CampDisplayMember[];
  announcements?: Array<{ student_id: string; name: string; created_at: string; label?: string; detail?: string }>;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) as ApiPayload };
  } catch {
    return { ok: false, status: res.status, json: { ok: false, error: text.slice(0, 220) } as ApiPayload };
  }
}

function avatarUrl(path?: string | null) {
  const p = String(path ?? "").trim();
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!p || !base) return "";
  if (/^https?:\/\//i.test(p)) return p;
  const normalized = p.replace(/^\/+/, "");
  if (normalized.startsWith("storage/v1/object/public/")) {
    return `${base}/${normalized}`;
  }
  const fullPath = normalized.startsWith("avatars/") ? normalized : `avatars/${normalized}`;
  return `${base}/storage/v1/object/public/${fullPath}`;
}

function relativeTime(iso?: string) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  const mins = Math.round(diff / 60000);
  if (mins <= 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

function rolePointValue(role: string, config: { seller_daily_points: number; cleaner_daily_points: number }) {
  const key = String(role ?? "").trim().toLowerCase();
  if (key === "seller") return Number(config.seller_daily_points ?? 0);
  if (key === "cleaner") return Number(config.cleaner_daily_points ?? 0);
  return 0;
}

function dayLabel(day: string) {
  const key = String(day ?? "").trim().toLowerCase();
  if (key === "m") return "M";
  if (key === "t") return "T";
  if (key === "w") return "W";
  if (key === "r") return "R";
  if (key === "f") return "F";
  if (key === "sa") return "SA";
  if (key === "su") return "SU";
  return "";
}

function normalizeDayKey(value: unknown) {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "monday" || v === "mon") return "m";
  if (v === "tuesday" || v === "tues" || v === "tue") return "t";
  if (v === "wednesday" || v === "wed") return "w";
  if (v === "thursday" || v === "thurs" || v === "thu" || v === "th") return "r";
  if (v === "friday" || v === "fri") return "f";
  if (v === "saturday" || v === "sat") return "sa";
  if (v === "sunday" || v === "sun") return "su";
  return v;
}

function getEasternDayCodeNow() {
  const dayName = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
  })
    .format(new Date())
    .toLowerCase();
  if (dayName.startsWith("mon")) return "m";
  if (dayName.startsWith("tue")) return "t";
  if (dayName.startsWith("wed")) return "w";
  if (dayName.startsWith("thu")) return "r";
  if (dayName.startsWith("fri")) return "f";
  if (dayName.startsWith("sat")) return "sa";
  if (dayName.startsWith("sun")) return "su";
  return "";
}

export default function CampDisplayPage() {
  const searchParams = useSearchParams();
  const screenId = Math.min(3, Math.max(1, Number(searchParams.get("screen") ?? 1) || 1));
  const instanceId = String(searchParams.get("instance_id") ?? "").trim();

  const [rows, setRows] = useState<CampDisplayMember[]>([]);
  const [msg, setMsg] = useState("");
  const [title, setTitle] = useState(`Camp Display ${screenId}`);
  const [groupName, setGroupName] = useState("All Groups");
  const [rosterName, setRosterName] = useState("Camp Roster");
  const [activeRosterId, setActiveRosterId] = useState("");
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [showAllGroups, setShowAllGroups] = useState(true);
  const [announcements, setAnnouncements] = useState<Array<{ student_id: string; name: string; created_at: string; label?: string; detail?: string }>>([]);
  const [campRolePoints, setCampRolePoints] = useState<{ seller_daily_points: number; cleaner_daily_points: number }>({
    seller_daily_points: 300,
    cleaner_daily_points: 500,
  });
  const [factions, setFactions] = useState<Array<{ id: string; name: string; color?: string | null; icon?: string | null; logo_url?: string | null }>>([]);
  const [effectConfigByKey, setEffectConfigByKey] = useState<Record<string, { config?: any; render_mode?: string | null; html?: string | null; css?: string | null; js?: string | null }>>({});
  const [debugOpen, setDebugOpen] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");
  const [menuBarHover, setMenuBarHover] = useState(false);
  const [canHover, setCanHover] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(hover: hover)");
    const sync = () => setCanHover(media.matches);
    sync();
    media.addEventListener?.("change", sync);
    return () => media.removeEventListener?.("change", sync);
  }, []);

  async function load() {
    const rosterUrl = instanceId
      ? `/api/camp/display-roster?screen=${screenId}&instance_id=${encodeURIComponent(instanceId)}`
      : `/api/camp/display-roster?screen=${screenId}`;
    const [rosterRes, effectsRes] = await Promise.all([
      fetch(rosterUrl, { cache: "no-store" }),
      fetch("/api/avatar-effects/list", { cache: "no-store" }),
    ]);
    const roster = await safeJson(rosterRes);
    const effects = await safeJson(effectsRes);

    if (!roster.ok) {
      setMsg(String(roster.json?.error ?? "Failed to load camp display roster"));
    } else {
      const payload = roster.json;
      const activeScreen = payload.active_screen;
      const groups = payload.groups ?? [];
      const activeGroupId = String(payload.active_group_id ?? "");
      const showAll = payload.show_all_groups !== false;
      const foundGroup = groups.find((g) => String(g.id) === activeGroupId);
      const rosters = payload.rosters ?? [];
      const foundRoster = rosters.find((r) => String(r.id) === String(payload.active_roster_id ?? ""));

      setMsg("");
      const defaultTitle = `Camp Display ${screenId}`;
      const rawTitle = String(activeScreen?.title ?? "").trim();
      const computedTitle = payload.source_mode === "classroom_instance"
        ? "Classroom Check-In Roster"
        : rawTitle && rawTitle !== defaultTitle
          ? rawTitle
          : foundRoster?.name
          ? `${foundRoster.name}`
          : defaultTitle;
      setTitle(computedTitle);
      setGroupName(payload.source_mode === "classroom_instance" ? `Instance ${payload.source_instance_id ?? ""}` : showAll ? "All Groups" : String(foundGroup?.name ?? "Group"));
      setRosterName(payload.source_mode === "classroom_instance" ? "Classroom Check-In" : String(foundRoster?.name ?? "Camp Roster"));
      setActiveRosterId(String(payload.active_roster_id ?? ""));
      setActiveGroupId(payload.active_group_id ?? null);
      setShowAllGroups(showAll);
      setRows((payload.display_members ?? []).filter((r) => r.student));
      setAnnouncements(payload.announcements ?? []);
      setCampRolePoints({
        seller_daily_points: Number(payload.camp_role_point_config?.seller_daily_points ?? 300),
        cleaner_daily_points: Number(payload.camp_role_point_config?.cleaner_daily_points ?? 500),
      });
      setFactions(payload.factions ?? []);
    }

    if (effects.ok) {
      const map: Record<string, { config?: any; render_mode?: string | null; html?: string | null; css?: string | null; js?: string | null }> = {};
      (effects.json as any)?.effects?.forEach((e: any) => {
        const key = String(e?.key ?? "").trim();
        if (!key) return;
        map[key] = { config: e.config, render_mode: e.render_mode ?? null, html: e.html ?? null, css: e.css ?? null, js: e.js ?? null };
      });
      setEffectConfigByKey(map);
    }
  }

  useEffect(() => {
    load();
    const sb = supabaseClient();
    const channel = sb
      .channel(`camp-display-screen-${screenId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "camp_display_rosters" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "camp_display_groups" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "camp_display_members" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "camp_display_screens" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "students" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "ledger" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "camp_orders" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "camp_order_refunds" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "camp_accounts" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "battle_mvp_awards" }, load)
      .subscribe();

    const t = setInterval(load, 6000);
    return () => {
      clearInterval(t);
      sb.removeChannel(channel);
    };
  }, [screenId]);

  const uniqueAnnouncements = useMemo(() => {
    const used = new Set<string>();
    const out: Array<{ student_id: string; name: string; created_at: string; label?: string; detail?: string }> = [];
    for (const a of announcements) {
      const key = `${a.student_id}-${a.created_at}`;
      if (used.has(key)) continue;
      used.add(key);
      out.push(a);
      if (out.length >= 6) break;
    }
    return out;
  }, [announcements]);

  const factionById = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color?: string | null; icon?: string | null; logo_url?: string | null }>();
    for (const f of factions) {
      map.set(String(f.id), f);
    }
    return map;
  }, [factions]);

  const minDisplaySlots = 15;
  const columnCount = rows.length > minDisplaySlots ? 8 : 5;
  const displayRows: Array<CampDisplayMember | null> = useMemo(() => {
    const total = rows.length > minDisplaySlots ? rows.length : minDisplaySlots;
    return Array.from({ length: total }, (_, idx) => rows[idx] ?? null);
  }, [rows]);

  const debugPayload = useMemo(() => {
    return {
      screen_id: screenId,
      title,
      roster_name: rosterName,
      group_name: groupName,
      active_roster_id: activeRosterId || null,
      active_group_id: activeGroupId,
      show_all_groups: showAllGroups,
      row_count: rows.length,
      rows: rows.map((row) => ({
        row_id: row.id,
        student_id: row.student_id,
        student_name: row.student?.name ?? null,
        faction_id: row.faction_id ?? null,
        avatar_storage_path: row.student?.avatar_storage_path ?? null,
        avatar_url_resolved: avatarUrl(row.student?.avatar_storage_path),
        role: row.display_role,
        secondary_role: row.secondary_role ?? "",
      })),
    };
  }, [activeGroupId, activeRosterId, groupName, rosterName, rows, screenId, showAllGroups, title]);

  async function copyDebug() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(debugPayload, null, 2));
      setCopyMsg("Copied");
      setTimeout(() => setCopyMsg(""), 1200);
    } catch {
      setCopyMsg("Copy failed");
      setTimeout(() => setCopyMsg(""), 1200);
    }
  }

  return (
    <main style={wrap()}>
      <div style={{ display: "grid", gridTemplateColumns: "180px minmax(0,1fr)", gap: 8, alignItems: "stretch", minHeight: "calc(100vh - 40px)" }}>
        <aside style={infoRail()}>
          <section style={titleCard()}>
            <div style={railTitle()}>{rosterName || title}</div>
            <div style={railSubTitle()}>{groupName}</div>
          </section>
          <section style={infoCard()}>
            <div style={infoCardTitle()}>Camp Spotlight</div>
            <div style={infoCardLine()}>Each camp spotlight star gives <strong>+20 pts</strong>.</div>
            <div style={infoCardLine()}>Collect <strong>10 stars</strong> to unlock a <strong>+500 bonus</strong>.</div>
          </section>
          <section style={infoCard()}>
            <div style={infoCardTitle()}>Role Redeem (Daily)</div>
            <div style={infoCardLine()}>Seller: <strong>+{Math.round(Number(campRolePoints.seller_daily_points ?? 0))}</strong></div>
            <div style={infoCardLine()}>Cleaner: <strong>+{Math.round(Number(campRolePoints.cleaner_daily_points ?? 0))}</strong></div>
          </section>
          <section style={infoCard()}>
            <div style={infoCardTitle()}>Legend</div>
            <div style={legendRow()}><span>⭐</span><span>Camp spotlight progress</span></div>
            <div style={legendRow()}><span>🛡️</span><span>Rule keeper tally + earned pts</span></div>
            <div style={legendRow()}><span>⚠️</span><span>Rule breaker tally + lost pts</span></div>
            <div style={legendRow()}><span>💠</span><span>Daily redeem points available</span></div>
          </section>
          <section style={logRailCard()}>
            <div style={infoCardTitle()}>Notable Feed</div>
            <div style={logRailList()}>
              {uniqueAnnouncements.length ? (
                uniqueAnnouncements.map((a, idx) => (
                  <div key={`${a.student_id}-${a.created_at}-${idx}`} style={logFeedItem()}>
                    <div style={{ display: "grid", gap: 2 }}>
                      <span style={{ fontWeight: 900 }}>{a.name}</span>
                      <span style={{ opacity: 0.84, fontSize: 9 }}>{a.label || "Activity"}</span>
                      {a.detail ? <span style={{ opacity: 0.74, fontSize: 9 }}>{a.detail}</span> : null}
                    </div>
                    <span style={{ opacity: 0.84, fontSize: 9 }}>
                      {relativeTime(a.created_at)}{" "}
                      {new Date(a.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 10, opacity: 0.75 }}>No notable activity yet.</div>
              )}
            </div>
          </section>
        </aside>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: 6, alignItems: "flex-start", marginTop: -2 }}>
            <div
              style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}
              onMouseEnter={() => setMenuBarHover(true)}
              onMouseLeave={() => setMenuBarHover(false)}
            >
              <Link href="/display/camp?screen=1" style={screenChip(screenId === 1)}>Display 1</Link>
              <Link href="/display/camp?screen=2" style={screenChip(screenId === 2)}>Display 2</Link>
              <Link href="/display/camp?screen=3" style={screenChip(screenId === 3)}>Display 3</Link>
              <Link href="/display" style={menuChip(!canHover || menuBarHover)}>Menu</Link>
            </div>
          </div>
          {msg ? <div style={notice()}>{msg}</div> : null}
          <div style={grid(columnCount)}>
            {displayRows.map((row, idx) => {
              if (!row) {
                return (
                  <section key={`placeholder-${idx}`} style={placeholderCard()}>
                    <div style={placeholderLabel()}>Open Slot</div>
                  </section>
                );
              }
              const s = row.student;
              const effectKey = String(s.avatar_effect ?? "").trim();
              const effect = effectKey ? effectConfigByKey[effectKey] : undefined;
              const delta = Number(row.last_change?.points ?? 0);
              const deltaUp = delta >= 0;
              const reason = String(row.last_change?.note ?? row.last_change?.category ?? "").trim();
              const tally = row.camp_tally ?? {
                spotlight_stars: 0,
                rule_keepers: 0,
                rule_breakers: 0,
                rule_keeper_points_earned: 0,
                rule_breaker_points_lost: 0,
                spotlight_bonus_ready: false,
                spotlight_bonus_progress: "0/10",
              };
              const redeem = row.redeem_status ?? { can_redeem: false, available_points: 0 };
              const faction = row.faction_id ? factionById.get(String(row.faction_id)) : undefined;
              const cardTone = faction?.color ? buildCardToneFromColor(faction.color) : defaultCardTone();
              const secondaryRolePoints = rolePointValue(String(row.secondary_role ?? ""), campRolePoints);
              const todayDayCode = getEasternDayCodeNow();
              const roleDayList = Array.isArray(row.secondary_role_days) ? row.secondary_role_days : [];
              const secondaryRoleActiveToday =
                !!String(row.secondary_role ?? "").trim() &&
                (roleDayList.length === 0 || roleDayList.map((d) => normalizeDayKey(d)).includes(todayDayCode));
              const starCount = Math.max(0, Math.min(10, Number(tally.spotlight_stars ?? 0)));
              const initials = String(s.name ?? "S")
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((p) => p[0]?.toUpperCase() ?? "")
                .join("");
              return (
                <section key={row.id} style={card(cardTone, Boolean(faction))}>
                  <div style={roleChip()}>{row.display_role || "camper"}</div>
                  {faction ? <div style={factionNameChip(faction.color ?? "#64748b")}>{faction.name}</div> : null}
                  {secondaryRoleActiveToday ? (
                    <div style={secondaryRoleWrap()}>
                      <div style={secondaryRoleChip()}>{row.secondary_role}</div>
                      <div style={secondaryRolePointsChip()}>
                        +{Math.round(secondaryRolePoints)} today
                      </div>
                    </div>
                  ) : null}
                  <div style={avatarRow()}>
                    <div style={levelCluster()}>
                      {faction ? (
                        <div style={factionMiniBox(faction.color ?? "#64748b")} title={faction.name || "Faction"}>
                          {faction.logo_url ? (
                            <img src={faction.logo_url} alt={faction.name} style={{ width: 24, height: 24, objectFit: "cover", borderRadius: 6 }} />
                          ) : (
                            <span style={{ fontSize: 16, lineHeight: 1 }}>{faction.icon || "🏕️"}</span>
                          )}
                        </div>
                      ) : null}
                      <div style={levelDisplayBig()}>
                        <div style={{ opacity: 0.82, fontSize: 8, letterSpacing: 0.5 }}>LV</div>
                        <div style={{ fontSize: 23, lineHeight: 1, fontWeight: 1100 }}>{Number(s.level ?? 1)}</div>
                      </div>
                    </div>
                  <div style={{ width: 110, height: 110, position: "relative" }}>
                    <AvatarRender
                      size={110}
                      bg={s.avatar_bg || "rgba(15,23,42,0.45)"}
                      avatarSrc={avatarUrl(s.avatar_storage_path)}
                      avatarZoomPct={Math.max(50, Math.min(200, Number(s.avatar_zoom_pct ?? 100)))}
                      effect={{
                        key: effectKey || null,
                        config: effect?.config,
                        render_mode: effect?.render_mode ?? null,
                        html: effect?.html ?? null,
                        css: effect?.css ?? null,
                        js: effect?.js ?? null,
                      }}
                      border={{
                        image_url: s.corner_border_url ?? null,
                        render_mode: s.corner_border_render_mode ?? null,
                        html: s.corner_border_html ?? null,
                        css: s.corner_border_css ?? null,
                        js: s.corner_border_js ?? null,
                        offset_x: s.corner_border_offset_x ?? null,
                        offset_y: s.corner_border_offset_y ?? null,
                        offsets_by_context: s.corner_border_offsets_by_context ?? null,
                      }}
                      contextKey="camp_display"
                      bleed={24}
                      style={{
                        border: "2px solid rgba(255,255,255,0.18)",
                        boxShadow: "inset 0 0 16px rgba(255,255,255,0.12), 0 14px 24px rgba(0,0,0,0.42)",
                      }}
                      fallback={
                        <div style={avatarFallback()}>
                          {initials || "?"}
                        </div>
                      }
                    />
                  </div>
                  </div>
                  <div style={{ display: "grid", gap: 4, textAlign: "center" }}>
                    <div style={{ fontSize: 15, fontWeight: 1000, lineHeight: 1 }}>{s.name}</div>
                    <div style={pointsChip()}>{Number(s.points_total ?? 0).toLocaleString()} pts</div>
                  </div>
                  {row.last_change ? (
                    <div style={deltaUp ? posDeltaChip() : negDeltaChip()}>
                      <div style={deltaMainLine()}>
                        {deltaUp ? "▲ " : "▼ "}
                        {deltaUp ? "+" : ""}
                        {delta.toLocaleString()} pts
                      </div>
                      <div style={deltaReasonLine()}>{reason || "Point update"}</div>
                    </div>
                  ) : null}
                  <div style={keeperBreakerGrid()}>
                    <div style={keeperBox()}>
                      <div style={keeperBreakerParticles()}>
                        {Array.from({ length: 7 }).map((_, idx) => (
                          <span key={`k-${idx}`} style={particleDot(idx, true)} />
                        ))}
                      </div>
                      <div style={keeperBreakerValue()}>{Number(tally.rule_keepers ?? 0)}</div>
                      <div style={keeperBreakerLabel()}>Rule Keeper</div>
                      <div style={keeperBreakerSubline()}>Earned +{Math.round(Number(tally.rule_keeper_points_earned ?? 0))} pts</div>
                    </div>
                    <div style={breakerBox()}>
                      <div style={keeperBreakerParticles()}>
                        {Array.from({ length: 7 }).map((_, idx) => (
                          <span key={`b-${idx}`} style={particleDot(idx, false)} />
                        ))}
                      </div>
                      <div style={keeperBreakerValue()}>{Number(tally.rule_breakers ?? 0)}</div>
                      <div style={keeperBreakerLabel()}>Rule Breaker</div>
                      <div style={keeperBreakerSubline()}>Loss -{Math.round(Number(tally.rule_breaker_points_lost ?? 0))} pts</div>
                    </div>
                  </div>
                  <div style={starTrackWrap()} aria-label={`Camp spotlight bonus progress ${starCount}/10`}>
                    {Array.from({ length: 10 }).map((_, idx) => (
                      <span key={idx} style={starTrackStar(idx < starCount)}>★</span>
                    ))}
                  </div>
                  {redeem.can_redeem ? (
                    <div style={redeemMiniChip()}>+{Math.round(Number(redeem.available_points ?? 0))} can be redeemed</div>
                  ) : null}
                </section>
              );
            })}
          </div>
        </div>
      </div>
      <button type="button" style={debugToggleBtn()} onClick={() => setDebugOpen((v) => !v)}>
        Debug
      </button>
      {debugOpen ? (
        <section style={debugPanel()} aria-label="debug-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 1000, fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase" }}>Debug Mode</div>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" style={debugBtn()} onClick={copyDebug}>Copy JSON</button>
              <button type="button" style={debugBtn()} onClick={() => setDebugOpen(false)}>Close</button>
            </div>
          </div>
          {copyMsg ? <div style={{ fontSize: 11, opacity: 0.9 }}>{copyMsg}</div> : null}
          <pre style={debugPre()}>{JSON.stringify(debugPayload, null, 2)}</pre>
        </section>
      ) : null}
    </main>
  );
}

function wrap(): React.CSSProperties {
  return {
    minHeight: "100vh",
    padding: "10px 20px 20px",
    background: "radial-gradient(circle at top, rgba(56,189,248,0.14), rgba(2,6,23,0.98) 58%)",
    color: "white",
    display: "grid",
    gap: 14,
    alignContent: "start",
  };
}
function titleCard(): React.CSSProperties {
  return {
    borderRadius: 10,
    border: "1px solid rgba(56,189,248,0.38)",
    background: "linear-gradient(150deg, rgba(8,47,73,0.75), rgba(2,6,23,0.92))",
    padding: "8px 8px",
    display: "grid",
    gap: 6,
  };
}
function railTitle(): React.CSSProperties {
  return {
    fontSize: 20,
    lineHeight: 1.02,
    fontWeight: 1100,
    letterSpacing: 0.2,
  };
}
function railSubTitle(): React.CSSProperties {
  return {
    opacity: 0.85,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontSize: 10,
  };
}
function notice(): React.CSSProperties {
  return {
    borderRadius: 10,
    padding: "8px 12px",
    border: "1px solid rgba(239,68,68,0.45)",
    background: "rgba(127,29,29,0.45)",
    fontWeight: 900,
  };
}
function grid(columns: number): React.CSSProperties {
  return {
    display: "grid",
    gap: 8,
    gridTemplateColumns: `repeat(${Math.max(1, columns)}, minmax(0, 1fr))`,
  };
}
function placeholderCard(): React.CSSProperties {
  return {
    borderRadius: 12,
    border: "1px dashed rgba(148,163,184,0.5)",
    background: "linear-gradient(165deg, rgba(15,23,42,0.45), rgba(2,6,23,0.62))",
    minHeight: 308,
    display: "grid",
    placeItems: "center",
  };
}
function placeholderLabel(): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "rgba(148,163,184,0.9)",
  };
}
function card(tone: { border: string; glow: string; bgA: string; bgB: string }, factionActive: boolean): React.CSSProperties {
  return {
    borderRadius: 12,
    border: `1px solid ${tone.border}`,
    background: factionActive
      ? `radial-gradient(circle at 12% 18%, ${tone.glow}, transparent 44%), radial-gradient(circle at 84% 76%, ${tone.glow}, transparent 42%), linear-gradient(165deg, ${tone.bgA}, ${tone.bgB})`
      : `linear-gradient(165deg, ${tone.bgA}, ${tone.bgB})`,
    padding: 8,
    display: "grid",
    justifyItems: "center",
    gap: 6,
    position: "relative",
    boxShadow: `inset 0 0 0 1px ${tone.glow}, 0 10px 24px rgba(0,0,0,0.36)`,
  };
}
function infoRail(): React.CSSProperties {
  return {
    borderRadius: 10,
    border: "1px solid rgba(125,211,252,0.28)",
    background: "linear-gradient(165deg, rgba(6,24,46,0.84), rgba(2,6,23,0.92))",
    padding: 8,
    display: "grid",
    gap: 8,
    alignContent: "start",
    height: "100%",
    overflow: "hidden",
  };
}
function infoCard(): React.CSSProperties {
  return {
    borderRadius: 10,
    border: "1px solid rgba(125,211,252,0.3)",
    background: "linear-gradient(160deg, rgba(15,23,42,0.84), rgba(2,6,23,0.92))",
    padding: 8,
    display: "grid",
    gap: 8,
  };
}
function infoCardTitle(): React.CSSProperties {
  return {
    fontSize: 10,
    fontWeight: 1000,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "rgba(186,230,253,0.98)",
  };
}
function infoCardLine(): React.CSSProperties {
  return {
    fontSize: 10,
    lineHeight: 1.35,
    color: "rgba(241,245,249,0.92)",
  };
}
function legendRow(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "14px minmax(0,1fr)",
    alignItems: "center",
    gap: 8,
    fontSize: 10,
    color: "rgba(226,232,240,0.95)",
  };
}
function roleChip(): React.CSSProperties {
  return {
    position: "absolute",
    top: 8,
    right: 8,
    borderRadius: 999,
    border: "1px solid rgba(251,191,36,0.52)",
    background: "rgba(120,53,15,0.55)",
    color: "#fef3c7",
    padding: "2px 7px",
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
  };
}
function secondaryRoleChip(): React.CSSProperties {
  return {
    borderRadius: 999,
    border: "1px solid rgba(34,197,94,0.42)",
    background: "rgba(6,78,59,0.55)",
    color: "#dcfce7",
    padding: "2px 6px",
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
  };
}
function secondaryRoleWrap(): React.CSSProperties {
  return {
    position: "absolute",
    top: 26,
    left: 8,
    display: "grid",
    gap: 2,
    justifyItems: "start",
    maxWidth: 132,
  };
}
function secondaryRolePointsChip(): React.CSSProperties {
  return {
    borderRadius: 999,
    border: "1px solid rgba(74,222,128,0.35)",
    background: "rgba(6,78,59,0.45)",
    color: "#bbf7d0",
    padding: "1px 6px",
    fontSize: 9,
    fontWeight: 900,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 132,
  };
}
function factionNameChip(color: string): React.CSSProperties {
  return {
    position: "absolute",
    top: 8,
    left: 8,
    borderRadius: 999,
    border: `1px solid ${color}`,
    background: "rgba(2,6,23,0.78)",
    color: "white",
    padding: "2px 6px",
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
    maxWidth: 96,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}
function statChip(): React.CSSProperties {
  return {
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.25)",
    background: "rgba(15,23,42,0.6)",
    padding: "5px 10px",
    fontWeight: 900,
  };
}
function pointsChip(): React.CSSProperties {
  return {
    borderRadius: 999,
    border: "1px solid rgba(250,204,21,0.45)",
    background: "rgba(120,53,15,0.4)",
    padding: "6px 10px",
    fontWeight: 1000,
    fontSize: 24,
    lineHeight: 1,
    boxShadow: "0 0 16px rgba(250,204,21,0.14)",
    letterSpacing: 0.3,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 38,
    textAlign: "center",
  };
}
function tallyRow(): React.CSSProperties {
  return {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: 18,
    lineHeight: 1.1,
  };
}
function keeperBreakerGrid(): React.CSSProperties {
  return {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 6,
  };
}
function keeperBox(): React.CSSProperties {
  return {
    borderRadius: 8,
    border: "1px solid rgba(5,150,105,0.78)",
    background: "linear-gradient(165deg, rgba(6,78,59,0.82), rgba(2,44,34,0.9))",
    padding: "6px 6px 5px",
    display: "grid",
    justifyItems: "center",
    gap: 2,
    position: "relative",
    overflow: "hidden",
    boxShadow: "inset 0 0 0 1px rgba(16,185,129,0.18), 0 0 12px rgba(16,185,129,0.16)",
  };
}
function breakerBox(): React.CSSProperties {
  return {
    borderRadius: 8,
    border: "1px solid rgba(220,38,38,0.82)",
    background: "linear-gradient(165deg, rgba(127,29,29,0.84), rgba(68,10,10,0.92))",
    padding: "6px 6px 5px",
    display: "grid",
    justifyItems: "center",
    gap: 2,
    position: "relative",
    overflow: "hidden",
    boxShadow: "inset 0 0 0 1px rgba(239,68,68,0.18), 0 0 12px rgba(239,68,68,0.16)",
  };
}
function keeperBreakerValue(): React.CSSProperties {
  return {
    fontSize: 22,
    lineHeight: 1,
    fontWeight: 1100,
    marginTop: 2,
  };
}
function keeperBreakerLabel(): React.CSSProperties {
  return {
    fontSize: 10,
    lineHeight: 1.1,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    opacity: 0.92,
  };
}
function keeperBreakerSubline(): React.CSSProperties {
  return {
    fontSize: 9,
    lineHeight: 1.1,
    fontWeight: 800,
    opacity: 0.88,
    textAlign: "center",
  };
}
function keeperBreakerParticles(): React.CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    overflow: "hidden",
  };
}
function particleDot(index: number, keeper: boolean): React.CSSProperties {
  const x = [8, 22, 39, 58, 74, 86, 96][index % 7];
  const y = [12, 24, 38, 16, 32, 46, 20][index % 7];
  const size = [3, 4, 2, 3, 2, 4, 3][index % 7];
  const alpha = [0.24, 0.3, 0.18, 0.25, 0.2, 0.28, 0.22][index % 7];
  return {
    position: "absolute",
    left: `${x}%`,
    top: `${y}%`,
    width: size,
    height: size,
    borderRadius: "50%",
    background: keeper ? `rgba(74,222,128,${alpha})` : `rgba(248,113,113,${alpha})`,
    boxShadow: keeper ? "0 0 8px rgba(16,185,129,0.45)" : "0 0 8px rgba(239,68,68,0.45)",
  };
}
function redeemMiniChip(): React.CSSProperties {
  return {
    position: "absolute",
    right: 8,
    bottom: 8,
    borderRadius: 8,
    border: "2px dashed rgba(250,204,21,0.72)",
    background: "linear-gradient(135deg, rgba(120,53,15,0.62), rgba(92,38,8,0.72))",
    color: "#fef3c7",
    padding: "3px 6px",
    fontWeight: 900,
    fontSize: 10,
    boxShadow: "0 0 12px rgba(250,204,21,0.24), inset 0 0 10px rgba(251,191,36,0.2)",
    maxWidth: 96,
    textAlign: "right",
  };
}
function starTrackWrap(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(10, minmax(0, 1fr))",
    gap: 3,
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    marginRight: "auto",
    marginBottom: 12,
    paddingRight: 104,
    boxSizing: "border-box",
    overflow: "hidden",
  };
}
function starTrackStar(active: boolean): React.CSSProperties {
  return {
    display: "grid",
    placeItems: "center",
    height: 24,
    borderRadius: 6,
    fontSize: 16,
    fontWeight: 900,
    border: active ? "1px solid rgba(250,204,21,0.85)" : "1px solid rgba(100,116,139,0.45)",
    background: active ? "linear-gradient(135deg, rgba(250,204,21,0.38), rgba(245,158,11,0.24))" : "rgba(30,41,59,0.58)",
    color: active ? "#fde68a" : "rgba(148,163,184,0.75)",
    boxShadow: active ? "0 0 10px rgba(250,204,21,0.2)" : "none",
  };
}
function avatarFallback(): React.CSSProperties {
  return {
    width: "100%",
    height: "100%",
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(145deg, rgba(15,23,42,0.88), rgba(30,41,59,0.66))",
    color: "rgba(226,232,240,0.95)",
    fontWeight: 1000,
    fontSize: 24,
    textTransform: "uppercase",
  };
}

function avatarRow(): React.CSSProperties {
  return {
    display: "flex",
    gap: 8,
    alignItems: "center",
  };
}
function levelCluster(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 4,
  };
}
function factionMiniBox(color: string): React.CSSProperties {
  return {
    width: 38,
    height: 38,
    borderRadius: 9,
    border: `1px solid ${color}`,
    background: "rgba(2,6,23,0.85)",
    boxShadow: `inset 0 0 10px ${color}33`,
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    fontSize: 16,
    fontWeight: 900,
    flex: "0 0 auto",
  };
}
function annBottomBar(): React.CSSProperties {
  return {
    borderRadius: 12,
    border: "1px solid rgba(251,191,36,0.3)",
    background: "linear-gradient(135deg, rgba(120,53,15,0.24), rgba(15,23,42,0.72))",
    padding: "8px 10px",
    display: "grid",
    gap: 8,
  };
}
function annBottomTrack(): React.CSSProperties {
  return {
    display: "flex",
    gap: 8,
    overflowX: "auto",
    paddingBottom: 2,
  };
}
function annBottomChip(): React.CSSProperties {
  return {
    flex: "0 0 auto",
    borderRadius: 999,
    border: "1px solid rgba(251,191,36,0.35)",
    background: "rgba(120,53,15,0.35)",
    padding: "5px 10px",
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    gap: 8,
    whiteSpace: "nowrap",
  };
}

function levelDisplayBig(): React.CSSProperties {
  return {
    width: 50,
    height: 60,
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.45)",
    background: "rgba(15,23,42,0.66)",
    boxShadow: "inset 0 0 14px rgba(255,255,255,0.08)",
    display: "grid",
    placeItems: "center",
    textAlign: "center",
    fontWeight: 1000,
    overflow: "visible",
    lineHeight: 1,
    position: "relative",
  };
}
function logRailCard(): React.CSSProperties {
  return {
    borderRadius: 10,
    border: "1px solid rgba(125,211,252,0.3)",
    background: "linear-gradient(160deg, rgba(15,23,42,0.82), rgba(2,6,23,0.92))",
    padding: 8,
    display: "grid",
    gap: 6,
    minHeight: 220,
  };
}
function logRailList(): React.CSSProperties {
  return {
    display: "grid",
    gap: 6,
    alignContent: "start",
    overflowY: "auto",
    maxHeight: 260,
    paddingRight: 2,
  };
}
function logFeedItem(): React.CSSProperties {
  return {
    borderRadius: 8,
    border: "1px solid rgba(148,163,184,0.28)",
    background: "rgba(15,23,42,0.58)",
    padding: "5px 7px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    fontSize: 10,
  };
}
function screenChip(active: boolean): React.CSSProperties {
  return {
    borderRadius: 999,
    border: active ? "1px solid rgba(56,189,248,0.75)" : "1px solid rgba(148,163,184,0.4)",
    background: active ? "rgba(14,165,233,0.22)" : "rgba(15,23,42,0.58)",
    color: "white",
    padding: "4px 8px",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 11,
    lineHeight: 1.1,
  };
}
function menuChip(visible: boolean): React.CSSProperties {
  return {
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.45)",
    background: "rgba(15,23,42,0.72)",
    color: "white",
    padding: visible ? "4px 8px" : "4px 0",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 11,
    lineHeight: 1.1,
    opacity: visible ? 1 : 0,
    maxWidth: visible ? 72 : 0,
    pointerEvents: visible ? "auto" : "none",
    overflow: "hidden",
    whiteSpace: "nowrap",
    transform: visible ? "translateX(0)" : "translateX(10px)",
    transition: "opacity 160ms ease, max-width 160ms ease, transform 160ms ease, padding 160ms ease",
  };
}
function posDeltaChip(): React.CSSProperties {
  return {
    borderRadius: 8,
    border: "1px solid rgba(74,222,128,0.5)",
    background: "rgba(20,83,45,0.52)",
    padding: "6px 8px",
    fontWeight: 900,
    display: "grid",
    gap: 2,
    justifyItems: "center",
    width: "100%",
    minHeight: 56,
    alignContent: "center",
  };
}
function negDeltaChip(): React.CSSProperties {
  return {
    borderRadius: 8,
    border: "1px solid rgba(248,113,113,0.55)",
    background: "rgba(127,29,29,0.55)",
    padding: "6px 8px",
    fontWeight: 900,
    display: "grid",
    gap: 2,
    justifyItems: "center",
    width: "100%",
    minHeight: 56,
    alignContent: "center",
  };
}
function deltaMainLine(): React.CSSProperties {
  return {
    fontSize: 24,
    lineHeight: 1,
    fontWeight: 1000,
    textAlign: "center",
  };
}
function deltaReasonLine(): React.CSSProperties {
  return {
    fontSize: 10,
    lineHeight: 1.2,
    opacity: 0.86,
    textAlign: "center",
    wordBreak: "break-word",
  };
}
function debugToggleBtn(): React.CSSProperties {
  return {
    position: "fixed",
    left: 12,
    bottom: 12,
    zIndex: 50,
    borderRadius: 8,
    border: "1px solid rgba(148,163,184,0.55)",
    background: "rgba(15,23,42,0.86)",
    color: "white",
    padding: "5px 8px",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  };
}
function debugPanel(): React.CSSProperties {
  return {
    position: "fixed",
    left: 12,
    bottom: 44,
    width: "min(540px, calc(100vw - 24px))",
    maxHeight: "58vh",
    zIndex: 50,
    borderRadius: 10,
    border: "1px solid rgba(125,211,252,0.42)",
    background: "rgba(2,6,23,0.95)",
    boxShadow: "0 12px 26px rgba(0,0,0,0.45)",
    padding: 8,
    display: "grid",
    gap: 6,
  };
}
function debugBtn(): React.CSSProperties {
  return {
    borderRadius: 6,
    border: "1px solid rgba(148,163,184,0.45)",
    background: "rgba(15,23,42,0.7)",
    color: "white",
    padding: "4px 8px",
    fontSize: 11,
    fontWeight: 800,
  };
}
function debugPre(): React.CSSProperties {
  return {
    margin: 0,
    borderRadius: 8,
    border: "1px solid rgba(71,85,105,0.55)",
    background: "rgba(15,23,42,0.74)",
    padding: 8,
    fontSize: 10,
    lineHeight: 1.35,
    maxHeight: "44vh",
    overflow: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  };
}

function defaultCardTone() {
  return {
    border: "rgba(125,211,252,0.3)",
    glow: "rgba(125,211,252,0.12)",
    bgA: "rgba(15,23,42,0.84)",
    bgB: "rgba(2,6,23,0.9)",
  };
}

function buildCardToneFromColor(color: string) {
  const c = String(color || "").trim();
  if (!c) return defaultCardTone();
  return {
    border: colorToAlpha(c, 0.66),
    glow: colorToAlpha(c, 0.2),
    bgA: colorToAlpha(c, 0.22),
    bgB: colorToAlpha(c, 0.08),
  };
}

function colorToAlpha(color: string, alpha: number) {
  const c = String(color || "").trim();
  const a = Math.max(0, Math.min(1, alpha));
  if (c.startsWith("#")) {
    const hex = c.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
  }
  const rgbMatch = c.match(/^rgb\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*\)$/i);
  if (rgbMatch) {
    const r = Number(rgbMatch[1]);
    const g = Number(rgbMatch[2]);
    const b = Number(rgbMatch[3]);
    if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  const rgbaMatch = c.match(/^rgba\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9.]+)\s*\)$/i);
  if (rgbaMatch) {
    const r = Number(rgbaMatch[1]);
    const g = Number(rgbaMatch[2]);
    const b = Number(rgbaMatch[3]);
    if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  return c;
}

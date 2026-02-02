"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AvatarRender from "@/components/AvatarRender";
import { supabaseClient } from "@/lib/supabase/client";
import { playGlobalSfx, setGlobalSounds } from "@/lib/globalAudio";

type Attempt = {
  id: string;
  success: boolean;
  created_at: string;
};

type TrackerRow = {
  id: string;
  student_id: string;
  student_name: string;
  student_is_competition: boolean;
  skill_id: string;
  skill_name: string;
  repetitions_target: number;
  attempts?: number;
  successes?: number;
  rate?: number;
  last30_attempts?: number;
  last30_successes?: number;
  points_awarded?: number;
  recent_attempts: Attempt[];
  created_at: string;
};

type HistoryLog = {
  id: string;
  successes: number;
  attempts: number;
  target: number;
  rate: number;
  created_at: string;
  is_battle: boolean;
  vs_name: string | null;
};

type BattleRow = {
  id: string;
  created_at: string;
  skill_name: string;
  repetitions_target: number;
  battle_mode?: string;
  participant_ids?: string[];
  team_a_ids?: string[];
  team_b_ids?: string[];
  wager_amount?: number;
  points_per_rep?: number;
  participants?: Array<{
    id: string;
    name: string;
    avatar_path?: string | null;
    avatar_bg?: string | null;
    avatar_effect?: string | null;
    points?: number;
    attempts?: number;
    successes?: number;
    attempts_list?: boolean[];
  }>;
  left_student_id: string;
  right_student_id: string;
  left_name: string;
  right_name: string;
  left_avatar_path: string | null;
  right_avatar_path: string | null;
  left_avatar_bg: string | null;
  right_avatar_bg: string | null;
  left_avatar_effect?: string | null;
  right_avatar_effect?: string | null;
  left_attempts: number;
  right_attempts: number;
  left_successes: number;
  right_successes: number;
  winner_id?: string | null;
  mvp_ids?: string[];
  points_delta_by_id?: Record<string, number>;
};

type DisplayItem =
  | ({ kind: "tracker" } & TrackerRow)
  | ({ kind: "battle" } & BattleRow)
  | { kind: "placeholder"; id: string };

type LogRow = {
  id: string;
  student_name: string;
  skill_name: string;
  success: boolean;
  created_at: string;
};

type CornerOffsets = { x: number; y: number; size: number };
type PlateOffsets = { x: number; y: number; size: number };

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 180)}` } };
  }
}

export default function SkillPulseDisplayPage() {
  const [trackers, setTrackers] = useState<TrackerRow[]>([]);
  const [battles, setBattles] = useState<BattleRow[]>([]);
  const [trendLogsByTrackerId, setTrendLogsByTrackerId] = useState<Record<string, HistoryLog[]>>({});
  const [log, setLog] = useState<LogRow[]>([]);
  const [navLogoUrl, setNavLogoUrl] = useState<string | null>(null);
  const [navLogoZoom, setNavLogoZoom] = useState(1);
  const [avatarByStudent, setAvatarByStudent] = useState<
    Record<
      string,
      {
        storage_path: string | null;
        bg_color: string | null;
        effect: string | null;
        corner_border_url?: string | null;
        corner_border_render_mode?: string | null;
        corner_border_html?: string | null;
        corner_border_css?: string | null;
        corner_border_js?: string | null;
        corner_border_offset_x?: number | null;
        corner_border_offset_y?: number | null;
        corner_border_offsets_by_context?: Record<string, { x?: number | null; y?: number | null; scale?: number | null }> | null;
        card_plate_url?: string | null;
      }
    >
  >({});
  const [effectConfigByKey, setEffectConfigByKey] = useState<Record<string, { config?: any; render_mode?: string | null; html?: string | null; css?: string | null; js?: string | null }>>({});
  const [cornerOffsets, setCornerOffsets] = useState<CornerOffsets>({ x: -10, y: -10, size: 72 });
  const [plateOffsets, setPlateOffsets] = useState<PlateOffsets>({ x: 0, y: 0, size: 200 });
  const [authOk, setAuthOk] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [msg, setMsg] = useState("");
  const [displayEnabled, setDisplayEnabled] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);
  const [battleIntro, setBattleIntro] = useState<Record<string, boolean>>({});
  const router = useRouter();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenBattleIntro = useRef(new Set<string>());
  const battleIntroTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await fetch("/api/public/nav-logo", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!mounted) return;
      if (data?.logo_url) setNavLogoUrl(String(data.logo_url));
      if (data?.logo_zoom) setNavLogoZoom(Number(data.logo_zoom ?? 1));
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!mounted) return;
        if (!data?.ok) {
          router.push("/login?next=/display/skill-pulse");
          return;
        }
        const role = String(data?.role ?? "").toLowerCase();
        if (role !== "display" && role !== "admin") {
          setMsg("Display login only.");
          setAuthOk(false);
        } else {
          setAuthOk(true);
        }
      } catch {
        if (mounted) router.push("/login?next=/display/skill-pulse");
      } finally {
        if (mounted) setAuthChecked(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (!authOk) return;
    let mounted = true;
    (async () => {
      const res = await fetch("/api/avatar-effects/list", { cache: "no-store" });
      const data = await safeJson(res);
      if (!mounted || !data.ok) return;
      const list = (data.json?.effects ?? []) as Array<{ key: string; config?: any; render_mode?: string | null; html?: string | null; css?: string | null; js?: string | null }>;
      const map: Record<string, { config?: any; render_mode?: string | null; html?: string | null; css?: string | null; js?: string | null }> = {};
      list.forEach((e) => {
        if (e?.key) map[String(e.key)] = { config: e.config, render_mode: e.render_mode ?? null, html: e.html ?? null, css: e.css ?? null, js: e.js ?? null };
      });
      setEffectConfigByKey(map);
    })();
    return () => {
      mounted = false;
    };
  }, [authOk]);

  useEffect(() => {
    if (!authOk) return;
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/display/settings", { cache: "no-store" });
        const data = await safeJson(res);
        if (!mounted) return;
        if (!data.ok) throw new Error(data.json?.error || "Failed to load display settings");
        const enabled = data.json?.settings?.skill_pulse_enabled !== false;
        setDisplayEnabled(enabled);
        if (!enabled) setMsg("Skill Pulse display disabled by admin.");
      } catch (err: any) {
        if (mounted) setMsg(err?.message ?? "Failed to load display settings");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [authOk]);

  useEffect(() => {
    if (!authOk) return;
    let mounted = true;
    (async () => {
      const res = await fetch("/api/sound-effects/list", { cache: "no-store" });
      const data = await safeJson(res);
      if (!mounted || !data.ok) return;
      const map: Record<string, { url: string; volume: number }> = {};
      (data.json?.effects ?? []).forEach((row: any) => {
        const key = String(row?.key ?? "");
        const url = String(row?.audio_url ?? "");
        if (!key || !url) return;
        map[key] = { url, volume: Math.min(1, Math.max(0, Number(row?.volume ?? 1))) };
      });
      setGlobalSounds(map);
    })();
    return () => {
      mounted = false;
    };
  }, [authOk]);

  useEffect(() => {
    if (!authOk) return;
    let mounted = true;
    (async () => {
      const res = await fetch("/api/corner-borders/settings", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!mounted) return;
      if (data?.settings) {
        setCornerOffsets({
          x: Number(data.settings.skill_pulse_x ?? -10),
          y: Number(data.settings.skill_pulse_y ?? -10),
          size: Number(data.settings.skill_pulse_size ?? 72),
        });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [authOk]);

  useEffect(() => {
    if (!authOk) return;
    let mounted = true;
    (async () => {
      const res = await fetch("/api/card-plates/settings", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!mounted) return;
      if (data?.settings) {
        setPlateOffsets({
          x: Number(data.settings.skill_pulse_x ?? 0),
          y: Number(data.settings.skill_pulse_y ?? 0),
          size: Number(data.settings.skill_pulse_size ?? 200),
        });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [authOk]);

  useEffect(() => {
    if (!authOk || !displayEnabled) return;
    let mounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    const load = async () => {
      try {
        const res = await fetch("/api/skill-tracker/list", { cache: "no-store" });
        const data = await safeJson(res);
        if (!data.ok) throw new Error(data.json?.error || "Failed to load trackers");
        const list = (data.json?.trackers ?? []) as TrackerRow[];
        if (!mounted) return;
        setTrackers(list);
        setMsg("");
        setLog(buildLog(list));
        const battlesRes = await fetch("/api/skill-tracker/battle/list", { cache: "no-store" });
        const battlesJson = await safeJson(battlesRes);
        if (battlesJson.ok) {
          setBattles((battlesJson.json?.battles ?? []) as BattleRow[]);
        }
        const avatarsRes = await fetch("/api/display/live-activity?limit=120", { cache: "no-store" });
        const avatarsJson = await safeJson(avatarsRes);
        if (avatarsJson.ok) {
          const next: Record<
            string,
            {
              storage_path: string | null;
              bg_color: string | null;
              effect: string | null;
              corner_border_url?: string | null;
              corner_border_render_mode?: string | null;
              corner_border_html?: string | null;
              corner_border_css?: string | null;
              corner_border_js?: string | null;
              corner_border_offset_x?: number | null;
              corner_border_offset_y?: number | null;
              corner_border_offsets_by_context?: Record<string, { x?: number | null; y?: number | null; scale?: number | null }> | null;
              card_plate_url?: string | null;
            }
          > = {};
          (avatarsJson.json?.items ?? []).forEach((item: any) => {
            const studentId = String(item.student_id ?? "");
            if (!studentId || next[studentId]) return;
            next[studentId] = {
              storage_path: item.avatar_storage_path ?? null,
              bg_color: item.avatar_bg ?? null,
              effect: item.avatar_effect ?? null,
              corner_border_url: item.corner_border_url ?? null,
              corner_border_render_mode: item.corner_border_render_mode ?? null,
              corner_border_html: item.corner_border_html ?? null,
              corner_border_css: item.corner_border_css ?? null,
              corner_border_js: item.corner_border_js ?? null,
              corner_border_offset_x: item.corner_border_offset_x ?? null,
              corner_border_offset_y: item.corner_border_offset_y ?? null,
              corner_border_offsets_by_context: item.corner_border_offsets_by_context ?? null,
              card_plate_url: item.card_plate_url ?? null,
            };
          });
          setAvatarByStudent(next);
        }
      } catch (err: any) {
        if (mounted) setMsg(err?.message ?? "Failed to load trackers");
      }
    };
    const scheduleRefresh = () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(load, 200);
    };
    const supabase = supabaseClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const setupChannel = async () => {
      const session = await supabase.auth.getSession();
      if (session.data?.session?.access_token) {
        supabase.realtime.setAuth(session.data.session.access_token);
      }
      if (channel) {
        await supabase.removeChannel(channel);
      }
      channel = supabase
        .channel("display-skill-pulse")
        .on("postgres_changes", { event: "*", schema: "public", table: "skill_tracker_logs" }, scheduleRefresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "battle_tracker_logs" }, scheduleRefresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "students" }, scheduleRefresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "student_avatar_settings" }, scheduleRefresh)
        .subscribe();
    };
    setupChannel();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);
      setupChannel();
      scheduleRefresh();
    });
    load();
    timer = window.setInterval(load, 15000);
    return () => {
      mounted = false;
      if (timer) window.clearInterval(timer);
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      if (authListener?.subscription) authListener.subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, [authOk]);

  const displayItems = useMemo(() => {
    const trackerItems = trackers.map((t) => ({ ...t, kind: "tracker" as const }));
    const battleItems = battles.map((b) => ({ ...b, kind: "battle" as const }));
    const combined = [...trackerItems, ...battleItems];
    return combined
      .slice()
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "battle" ? -1 : 1;
        return String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
      })
      .slice(0, 27);
  }, [trackers, battles]);

  useEffect(() => {
    let cancelled = false;
    const pending = trackers.filter((t) => !trendLogsByTrackerId[t.id] && !t.id.startsWith("placeholder-"));
    if (!pending.length) return;
    (async () => {
      const entries = await Promise.all(
        pending.map(async (t) => {
          const res = await fetch(`/api/skill-tracker/logs?tracker_id=${encodeURIComponent(t.id)}&limit=12`, { cache: "no-store" });
          const data = await safeJson(res);
          if (!data.ok) return [t.id, []] as const;
          return [t.id, (data.json?.logs ?? []) as HistoryLog[]] as const;
        })
      );
      if (cancelled) return;
      setTrendLogsByTrackerId((prev) => {
        const next = { ...prev };
        entries.forEach(([id, logs]) => {
          next[id] = logs;
        });
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [trackers, trendLogsByTrackerId]);
  const slotLimit = 9;
  const pages = useMemo(() => {
    const result: DisplayItem[][] = [];
    let current: DisplayItem[] = [];
    let used = 0;
    const costOf = (item: DisplayItem) => {
      if (item.kind !== "battle") return 1;
      const participants = (item as any).participants ?? [];
      const mode = String((item as any).battle_mode ?? "");
      const isMulti = participants.length > 2 || mode === "ffa" || mode === "teams";
      return isMulti ? 2 : 1;
    };
    displayItems.forEach((item) => {
      const cost = costOf(item);
      if (used + cost > slotLimit && current.length) {
        result.push(current);
        current = [];
        used = 0;
      }
      current.push(item);
      used += cost;
    });
    if (current.length) result.push(current);
    if (!result.length) result.push([]);
    return result;
  }, [displayItems]);
  const pageCount = pages.length;
  const shouldAnimate = pageCount > 1;
  const visibleTrackers = useMemo(() => {
    const slice = pages[pageIndex] ?? [];
    const usedSlots = slice.reduce((sum, item) => {
      if (item.kind !== "battle") return sum + 1;
      const participants = (item as any).participants ?? [];
      const mode = String((item as any).battle_mode ?? "");
      const isMulti = participants.length > 2 || mode === "ffa" || mode === "teams";
      return sum + (isMulti ? 2 : 1);
    }, 0);
    const placeholders = Array.from({ length: Math.max(0, slotLimit - usedSlots) }).map((_, idx) => ({
      id: `placeholder-${pageIndex}-${idx}`,
      kind: "placeholder" as const,
    }));
    return [...slice, ...placeholders];
  }, [pages, pageIndex]);

  useEffect(() => {
    if (!authOk || !displayEnabled) return;
    visibleTrackers.forEach((item) => {
      if (item.kind !== "battle") return;
      if (seenBattleIntro.current.has(item.id)) return;
      seenBattleIntro.current.add(item.id);
      setBattleIntro((prev) => ({ ...prev, [item.id]: true }));
      playGlobalSfx("battle_pulse_swords");
      const timer = window.setTimeout(() => {
        setBattleIntro((prev) => ({ ...prev, [item.id]: false }));
        battleIntroTimers.current.delete(item.id);
      }, 1600);
      battleIntroTimers.current.set(item.id, timer);
    });
  }, [authOk, displayEnabled, visibleTrackers]);

  useEffect(() => {
    return () => {
      battleIntroTimers.current.forEach((timer) => window.clearTimeout(timer));
      battleIntroTimers.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!authOk || !displayEnabled) return;
    if (!shouldAnimate || pageCount <= 1) return;
    const timer = window.setInterval(() => {
      setPageIndex((prev) => (prev + 1) % pageCount);
    }, 11000);
    return () => window.clearInterval(timer);
  }, [authOk, displayEnabled, pageCount, shouldAnimate]);

  return (
    <main style={page()}>
      <style>{`
        .pulse-wrap {
          position: relative;
          border-radius: 26px;
          padding: 70px 46px 54px;
          background: linear-gradient(135deg, rgba(15,23,42,0.92), rgba(2,6,23,0.9));
          border: 5px solid rgba(56,189,248,0.65);
          box-shadow: 0 0 90px rgba(56,189,248,0.45), 0 0 120px rgba(34,197,94,0.25);
          overflow: visible;
          animation: pulseGlow 2.8s ease-in-out infinite;
          minHeight: 1560px;
        }
        .pulse-title {
          position: absolute;
          left: 50%;
          top: -36px;
          transform: translateX(-50%);
          padding: 14px 30px;
          border-radius: 999px;
          border: 2px solid rgba(56,189,248,0.7);
          background: linear-gradient(135deg, rgba(30,41,59,0.95), rgba(2,6,23,0.95));
          font-size: 32px;
          font-weight: 1000;
          letter-spacing: 1px;
          text-transform: uppercase;
          box-shadow: 0 0 30px rgba(56,189,248,0.6), 0 0 60px rgba(34,197,94,0.35);
          animation: titlePulse 2.4s ease-in-out infinite;
          z-index: 5;
        }
        .pulse-title-bottom {
          top: auto;
          bottom: -32px;
        }
        .pulse-wrap::before {
          content: "";
          position: absolute;
          inset: -20%;
          background:
            radial-gradient(circle at 20% 20%, rgba(59,130,246,0.45), transparent 45%),
            radial-gradient(circle at 80% 70%, rgba(34,197,94,0.35), transparent 45%),
            radial-gradient(circle at 30% 80%, rgba(236,72,153,0.25), transparent 50%);
          opacity: 0.5;
          animation: edgeDrift 10s linear infinite;
          pointer-events: none;
        }
        .pulse-wrap::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 26px;
          border: 2px solid rgba(255,255,255,0.08);
          box-shadow: inset 0 0 30px rgba(59,130,246,0.18);
          pointer-events: none;
        }
        .pulse-page {
          animation: pageFade 10.5s ease both;
        }
        @keyframes pageFade {
          0% { opacity: 0; transform: translateY(18px) scale(0.98); }
          8% { opacity: 1; transform: translateY(0) scale(1); }
          92% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-8px) scale(0.99); }
        }
        .pulse-logo {
          position: absolute;
          right: 88px;
          bottom: 104px;
          width: 360px;
          height: 288px;
          border-radius: 18px;
          border: 2px solid rgba(255,255,255,0.18);
          background:
            repeating-linear-gradient(
              135deg,
              rgba(255,255,255,0.06) 0px,
              rgba(255,255,255,0.06) 10px,
              rgba(2,6,23,0.8) 10px,
              rgba(2,6,23,0.8) 20px
            );
          display: grid;
          placeItems: center;
          box-shadow: 0 18px 30px rgba(0,0,0,0.4), inset 0 0 16px rgba(255,255,255,0.08);
          z-index: 3;
          animation: logoDrift 8s linear infinite, logoPulse 2.6s ease-in-out infinite;
        }
        .pulse-logo::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 18px;
          background:
            radial-gradient(circle, rgba(59,130,246,0.22) 0 1px, transparent 2px),
            radial-gradient(circle, rgba(34,197,94,0.18) 0 1px, transparent 2px),
            radial-gradient(circle, rgba(255,255,255,0.12) 0 1px, transparent 2px);
          background-size: 32px 32px, 44px 44px, 60px 60px;
          opacity: 0.5;
          animation: logoParticles 6s linear infinite;
          pointer-events: none;
        }
        .pulse-logo img {
          width: 98%;
          height: 98%;
          object-fit: contain;
          filter: invert(1);
          margin-left: 6px;
        }
        .pulse-log {
          position: absolute;
          right: 88px;
          bottom: 420px;
          width: 306px;
          max-height: 308px;
          overflow-y: auto;
          z-index: 4;
        }
        @keyframes logoDrift {
          0% { background-position: 0% 0%; }
          100% { background-position: 100% 100%; }
        }
        @keyframes logoParticles {
          0% { background-position: 0% 0%; }
          100% { background-position: 100% 100%; }
        }
        @keyframes logoPulse {
          0% { box-shadow: 0 0 14px rgba(56,189,248,0.25), inset 0 0 12px rgba(255,255,255,0.08); }
          50% { box-shadow: 0 0 30px rgba(56,189,248,0.55), inset 0 0 18px rgba(255,255,255,0.12); }
          100% { box-shadow: 0 0 14px rgba(56,189,248,0.25), inset 0 0 12px rgba(255,255,255,0.08); }
        }
        .pulse-card {
          position: relative;
          border-radius: 22px;
          padding: 12px 14px;
          border: 1px solid rgba(255,255,255,0.18);
          background: linear-gradient(135deg, rgba(30,41,59,0.85), rgba(2,6,23,0.85));
          box-shadow: 0 18px 35px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08);
          transform: skewX(-8deg);
          overflow: visible;
        }
        .tracker-card {
          padding: 8px 10px;
        }
        .pulse-card:not(.placeholder) {
          animation: pulseCardEnter 1400ms ease;
        }
        .pulse-card > * {
          transform: skewX(8deg);
        }
        .pulse-card::before {
          content: "";
          position: absolute;
          inset: -20%;
          background:
            radial-gradient(circle at 15% 25%, rgba(59,130,246,0.28), transparent 50%),
            radial-gradient(circle at 85% 75%, rgba(34,197,94,0.25), transparent 50%);
          opacity: 0.95;
          animation: cardParticles 8s linear infinite;
          pointer-events: none;
        }
        .pulse-card::after {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle, rgba(255,255,255,0.25) 0 1px, transparent 2px),
            radial-gradient(circle, rgba(34,197,94,0.25) 0 2px, transparent 3px),
            radial-gradient(circle, rgba(59,130,246,0.25) 0 2px, transparent 3px);
          background-size: 24px 24px, 46px 46px, 60px 60px;
          opacity: 0.5;
          animation: cardParticles 6s linear infinite reverse;
          pointer-events: none;
        }
        .pulse-card.finished {
          box-shadow: 0 0 35px rgba(34,197,94,0.5), 0 0 70px rgba(34,197,94,0.35), 0 20px 40px rgba(0,0,0,0.4);
          border-color: rgba(34,197,94,0.6);
        }
        .pulse-card.placeholder {
          opacity: 0.45;
          border-style: dashed;
          border-color: rgba(255,255,255,0.2);
        }
        .battle-card {
          border: 2px solid rgba(248,113,113,0.6);
          box-shadow: 0 0 24px rgba(239,68,68,0.45), 0 0 40px rgba(59,130,246,0.35);
          background: linear-gradient(120deg, rgba(30,41,59,0.9), rgba(2,6,23,0.9));
          padding: 8px 10px;
        }
        .battle-card.intro .battle-body {
          opacity: 0;
          transform: scale(0.98);
        }
        .battle-body {
          transition: opacity 300ms ease, transform 300ms ease;
          position: relative;
          z-index: 2;
        }
        .battle-intro {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          background:
            radial-gradient(circle at center, rgba(15,23,42,0.9), rgba(2,6,23,0.6) 60%, rgba(2,6,23,0.1));
          z-index: 3;
          pointer-events: none;
          animation: battleIntroFade 1600ms ease forwards;
        }
        .battle-intro-glow {
          position: absolute;
          inset: 18%;
          border-radius: 999px;
          border: 2px solid rgba(248,113,113,0.45);
          box-shadow: 0 0 40px rgba(248,113,113,0.45), 0 0 80px rgba(59,130,246,0.4);
          animation: battleIntroGlow 1600ms ease forwards;
        }
        .battle-sword {
          position: absolute;
          width: 14px;
          height: 150px;
          border-radius: 10px;
          background: linear-gradient(180deg, rgba(248,250,252,0.95), rgba(148,163,184,0.85));
          box-shadow: 0 12px 30px rgba(15,23,42,0.45);
        }
        .battle-sword::after {
          content: "";
          position: absolute;
          left: -12px;
          bottom: -10px;
          width: 38px;
          height: 12px;
          border-radius: 12px;
          background: linear-gradient(90deg, rgba(250,204,21,0.9), rgba(234,179,8,0.6));
          box-shadow: 0 6px 14px rgba(234,179,8,0.35);
        }
        .battle-sword.left {
          transform-origin: 50% 90%;
          animation: swordLeft 1600ms ease forwards;
        }
        .battle-sword.right {
          transform-origin: 50% 90%;
          animation: swordRight 1600ms ease forwards;
        }
        .battle-name-top,
        .battle-name-bottom {
          text-align: center;
          font-weight: 1000;
          font-size: 34px;
          letter-spacing: 0.5px;
          padding: 6px 12px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.16);
          background: rgba(15,23,42,0.6);
          width: fit-content;
          margin: 0 auto;
        }
        .battle-name-bottom {
          margin-top: 10px;
        }
        .battle-body.duel {
          display: grid;
          gap: 10px;
          justify-items: center;
          text-align: center;
        }
        .battle-body.duel .battle-skill {
          margin-bottom: 4px;
        }
        .battle-body.multi {
          display: grid;
          gap: 12px;
        }
        .battle-grid {
          position: relative;
          display: grid;
          gap: 14px;
        }
        .battle-ffa-rows {
          display: grid;
          gap: 12px;
        }
        .battle-ffa-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        .battle-ffa-vs {
          display: grid;
          justify-items: center;
          text-align: center;
          gap: 6px;
        }
        .battle-ffa-vs .battle-vs-block {
          font-size: 68px;
        }
        .battle-grid.two {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .battle-grid.three {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .battle-team-rows {
          display: grid;
          gap: 14px;
        }
        .battle-team-row {
          display: grid;
          gap: 14px;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          align-items: center;
        }
        .battle-team-row.compact {
          gap: 8px;
        }
        .battle-team-vs {
          display: grid;
          justify-items: center;
          text-align: center;
          gap: 6px;
        }
        .battle-team-box {
          position: relative;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.14);
          padding: 10px;
          background: rgba(2,6,23,0.35);
        }
        .battle-team-box.winners {
          border-color: rgba(34,197,94,0.65);
          box-shadow: 0 0 18px rgba(34,197,94,0.45), inset 0 0 18px rgba(34,197,94,0.25);
        }
        .battle-team-label {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          padding: 4px 12px;
          border-radius: 999px;
          border: 1px solid rgba(34,197,94,0.65);
          background: rgba(2,6,23,0.9);
          font-size: 12px;
          font-weight: 1000;
          letter-spacing: 1px;
          color: rgba(134,239,172,0.95);
          text-transform: uppercase;
        }
        .battle-mvp-badge {
          position: absolute;
          top: -8px;
          right: -8px;
          z-index: 3;
          padding: 4px 10px;
          border-radius: 999px;
          background: linear-gradient(135deg, rgba(250,204,21,0.95), rgba(245,158,11,0.9));
          color: rgba(2,6,23,0.95);
          font-weight: 1000;
          font-size: 11px;
          letter-spacing: 1px;
          text-transform: uppercase;
          box-shadow: 0 8px 18px rgba(250,204,21,0.45);
        }
        .battle-mvp-holder {
          position: relative;
          overflow: visible;
        }
        .battle-mvp-note {
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.6px;
          text-transform: uppercase;
          color: rgba(226,232,240,0.7);
        }
        .battle-slot {
          display: grid;
          gap: 6px;
          justify-items: center;
          text-align: center;
          padding: 8px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(2,6,23,0.4);
          min-height: 200px;
        }
        .battle-slot.compact {
          padding: 6px;
          min-height: 160px;
        }
        .battle-score {
          display: inline-flex;
          align-items: baseline;
          gap: 6px;
          font-weight: 1000;
          letter-spacing: 0.4px;
        }
        .battle-score-value {
          font-size: 30px;
          color: rgba(34,197,94,0.95);
          text-shadow: 0 0 12px rgba(34,197,94,0.35);
        }
        .battle-score-potential {
          font-size: 13px;
          opacity: 0.7;
        }
        .battle-slot.compact .battle-score-value {
          font-size: 24px;
        }
        .battle-slot.compact .battle-score-potential {
          font-size: 11px;
        }
        .battle-score.team-score {
          margin-bottom: 6px;
        }
        .battle-slot.vs {
          align-items: center;
          justify-items: center;
          text-align: center;
        }
        .battle-mode-badge {
          justify-self: center;
          padding: 6px 14px;
          border-radius: 999px;
          font-weight: 1000;
          font-size: 24px;
          letter-spacing: 2px;
          text-transform: uppercase;
          border: 1px solid rgba(255,255,255,0.22);
          box-shadow: 0 8px 24px rgba(0,0,0,0.35);
        }
        .battle-mode-badge.ffa {
          background: linear-gradient(120deg, rgba(239,68,68,0.55), rgba(249,115,22,0.45));
          color: rgba(255,245,238,0.98);
          font-size: 48px;
        }
        .battle-mode-badge.teams {
          background: linear-gradient(120deg, rgba(59,130,246,0.55), rgba(249,115,22,0.45));
          color: rgba(255,245,238,0.98);
        }
        .battle-card.ffa {
          border-color: rgba(249,115,22,0.7);
          box-shadow: 0 0 24px rgba(249,115,22,0.5), 0 0 50px rgba(239,68,68,0.35);
        }
        .battle-card.ffa .battle-body {
          min-height: 180px;
          padding-bottom: 70px;
        }
        .battle-card.ffa .battle-slot {
          min-height: 130px;
          padding: 6px;
        }
        .battle-card.teams {
          border-color: rgba(59,130,246,0.65);
          box-shadow: 0 0 24px rgba(59,130,246,0.5), 0 0 50px rgba(249,115,22,0.35);
        }
        .battle-slot-name {
          font-weight: 1000;
          font-size: 24px;
        }
        .battle-slot.compact .battle-slot-name {
          font-size: 14px;
        }
        .battle-dots {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          justify-content: center;
        }
        .battle-slot.compact .battle-dots {
          transform: scale(0.85);
        }
        .battle-dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.25);
          background: rgba(148,163,184,0.35);
        }
        .battle-dot.success {
          background: rgba(34,197,94,0.85);
        }
        .battle-dot.fail {
          background: rgba(239,68,68,0.85);
        }
        .battle-points {
          font-size: 16px;
          font-weight: 900;
          padding: 4px 8px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.2);
          background: rgba(15,23,42,0.6);
        }
        .battle-points.lose {
          color: rgba(248,113,113,0.95);
        }
        .battle-points.win {
          color: rgba(34,197,94,0.95);
        }
        .battle-vs-block {
          font-size: 52px;
          font-weight: 1000;
          letter-spacing: 2px;
          color: rgba(255,245,238,0.98);
          text-shadow: 0 10px 28px rgba(239,68,68,0.65), 0 0 18px rgba(249,115,22,0.6);
        }
        .battle-skill-sub {
          margin-top: 6px;
          font-size: 16px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 1px;
          opacity: 0.8;
        }
        .battle-card::before {
          background:
            radial-gradient(circle at 15% 25%, rgba(248,113,113,0.45), transparent 55%),
            radial-gradient(circle at 85% 75%, rgba(249,115,22,0.45), transparent 55%),
            radial-gradient(circle at 50% 50%, rgba(234,88,12,0.35), transparent 58%);
          opacity: 1;
        }
        .battle-card::after {
          content: "";
          position: absolute;
          inset: -12%;
          background:
            radial-gradient(circle at 20% 20%, rgba(249,115,22,0.35), transparent 45%),
            radial-gradient(circle at 80% 15%, rgba(239,68,68,0.35), transparent 50%),
            radial-gradient(circle at 50% 80%, rgba(234,88,12,0.35), transparent 52%),
            conic-gradient(from 120deg, rgba(248,113,113,0.12), rgba(249,115,22,0.08), rgba(239,68,68,0.12));
          mix-blend-mode: screen;
          opacity: 0.85;
          animation: flameDrift 4.5s ease-in-out infinite;
          pointer-events: none;
        }
        .tracker-header {
          display: grid;
          justify-items: center;
          gap: 10px;
          margin-top: 10px;
        }
        .tracker-name {
          font-weight: 1000;
          font-size: 30px;
          text-align: center;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.18);
          background: rgba(15,23,42,0.6);
        }
        .tracker-score {
          display: inline-flex;
          align-items: baseline;
          gap: 8px;
          justify-content: center;
          font-weight: 1000;
          letter-spacing: 0.6px;
          margin-top: 4px;
        }
        .tracker-score-value {
          font-size: 46px;
          color: rgba(34,197,94,0.95);
          text-shadow: 0 0 16px rgba(34,197,94,0.4);
        }
        .tracker-score-potential {
          font-size: 16px;
          opacity: 0.7;
        }
        .battle-vs {
          font-size: 46px;
          font-weight: 1000;
          letter-spacing: 2px;
          color: rgba(255,245,238,0.98);
          text-shadow: 0 8px 24px rgba(239,68,68,0.65), 0 0 18px rgba(249,115,22,0.6);
        }
        .battle-fast-particles {
          position: absolute;
          inset: 0;
          z-index: 1;
          opacity: 0.9;
          background:
            radial-gradient(circle, rgba(255,255,255,0.2) 0 1px, transparent 2px),
            radial-gradient(circle, rgba(249,115,22,0.35) 0 2px, transparent 3px),
            radial-gradient(circle, rgba(239,68,68,0.3) 0 2px, transparent 3px);
          background-size: 18px 18px, 30px 30px, 40px 40px;
          animation: battleParticleRush 1.2s linear infinite;
          mix-blend-mode: screen;
          pointer-events: none;
        }
        .battle-card.winner .battle-body {
          opacity: 1;
          filter: none;
        }
        .battle-card.winner img,
        .battle-card.winner .battle-name-top,
        .battle-card.winner .battle-name-bottom,
        .battle-card.winner .battle-count,
        .battle-card.winner .battle-multi-name,
        .battle-card.winner .battle-multi-avatar,
        .battle-card.winner .battle-slot {
          filter: none;
          opacity: 1;
        }
        .battle-winner-overlay {
          position: absolute;
          inset: 0;
          z-index: 4;
          display: grid;
          place-items: center;
          text-align: center;
          pointer-events: none;
          background: radial-gradient(circle at center, rgba(0,0,0,0.45), rgba(0,0,0,0.15) 55%, transparent 70%);
          animation: winnerFlash 1100ms ease forwards;
        }
        .battle-winner-title {
          font-size: 36px;
          font-weight: 1000;
          letter-spacing: 2px;
          color: rgba(255,245,238,0.98);
          text-shadow: 0 12px 30px rgba(239,68,68,0.65), 0 0 18px rgba(249,115,22,0.6);
        }
        .battle-winner-name {
          margin-top: 8px;
          font-size: 28px;
          font-weight: 1000;
          padding: 6px 14px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.2);
          background: rgba(15,23,42,0.65);
        }
        .battle-winner-points {
          margin-top: 6px;
          font-size: 26px;
          font-weight: 900;
          color: rgba(34,197,94,0.95);
        }
        .battle-winner-team {
          margin-top: 6px;
          font-size: 18px;
          font-weight: 1000;
          letter-spacing: 1.4px;
          color: rgba(251,191,36,0.95);
        }
        .battle-winner-row {
          display: flex;
          align-items: center;
          gap: 14px;
          justify-content: center;
          margin-top: 10px;
        }
        .battle-winner-list {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          justify-content: center;
          margin-top: 14px;
        }
        .battle-winner-card {
          display: grid;
          gap: 6px;
          justify-items: center;
          text-align: center;
          padding: 8px 10px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.2);
          background: rgba(15,23,42,0.55);
          min-width: 120px;
        }
        .battle-winner-avatar {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.2);
          background: rgba(15,23,42,0.7);
          display: grid;
          place-items: center;
          overflow: hidden;
          font-weight: 1000;
        }
        .battle-card.ffa .battle-winner-title {
          font-size: 108px;
          letter-spacing: 4px;
        }
        .battle-card.ffa .battle-winner-overlay {
          transform: translateY(-28px);
        }
        .battle-card.ffa .battle-winner-avatar {
          width: 320px;
          height: 320px;
          border-radius: 28px;
        }
        .battle-card.ffa .battle-winner-name {
          font-size: 52px;
          padding: 15px 24px;
        }
        .battle-card.ffa .battle-winner-points {
          font-size: 52px;
        }
        .battle-winner-overlay.persist {
          animation: none;
          opacity: 1;
        }
        .history-bar {
          width: 100%;
          height: 10px;
          border-radius: 999px;
          background: rgba(148,163,184,0.25);
          overflow: hidden;
          display: flex;
        }
        .history-bar.placeholder {
          background: rgba(148,163,184,0.12);
          border: 1px dashed rgba(148,163,184,0.35);
        }
        .history-bar .success {
          background: rgba(34,197,94,0.8);
        }
        .history-bar .fail {
          background: rgba(239,68,68,0.75);
        }
        .history-overlay {
          display: none;
        }
        .history-overlay-inner {
          display: none;
        }
        .trend-panel {
          width: 90%;
          height: 300px;
          margin: -24px auto 0;
          position: relative;
          left: -2%;
        }
        .trend-panel.complete .trend-overlay {
          box-shadow:
            inset 0 0 18px rgba(15,23,42,0.6),
            0 0 18px rgba(34,197,94,0.45),
            0 0 42px rgba(56,189,248,0.35);
          border-color: rgba(34,197,94,0.5);
        }
        .trend-panel.muted {
          opacity: 0.2;
        }
        .trend-overlay {
          position: absolute;
          inset: 0;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.18);
          background: rgba(2,6,23,0.72);
          padding: 8px 8px 12px;
          display: grid;
          align-items: stretch;
          overflow: visible;
          pointer-events: none;
          box-shadow: inset 0 0 18px rgba(15,23,42,0.6);
        }
        .trend-label {
          position: absolute;
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 0.4px;
          color: rgba(226,232,240,0.7);
          text-transform: uppercase;
        }
        .trend-label.y {
          top: 8px;
          left: 10px;
        }
        .trend-label.x {
          right: 10px;
          bottom: 8px;
        }
        .trend-line {
          width: 100%;
          height: 100%;
          overflow: visible;
        }
        .trend-line path {
          stroke: rgba(56,189,248,0.95);
          stroke-width: 3;
          fill: none;
          filter: drop-shadow(0 0 6px rgba(56,189,248,0.7));
        }
        .trend-line-placeholder {
          stroke: rgba(148,163,184,0.25);
          stroke-width: 2;
          fill: none;
        }
        .trend-point {
          fill: rgba(56,189,248,0.95);
          stroke: rgba(255,255,255,0.6);
          stroke-width: 1;
        }
        .trend-label-point {
          font-size: 14px;
          font-weight: 800;
          fill: rgba(226,232,240,0.9);
          paint-order: stroke;
          stroke: rgba(15,23,42,0.8);
          stroke-width: 3px;
          text-anchor: middle;
          filter: drop-shadow(0 0 6px rgba(15,23,42,0.9));
          dominant-baseline: middle;
          position: relative;
          z-index: 2;
        }
        .battle-split {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 18px;
          width: 100%;
          margin: 10px 0 6px;
        }
        .battle-side {
          position: relative;
          display: grid;
          gap: 6px;
          justify-items: center;
        }
        .battle-skill {
          font-size: 20px;
          font-weight: 1000;
          text-align: center;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: rgba(255,255,255,0.75);
        }
        .battle-count {
          font-size: 18px;
          font-weight: 900;
          color: rgba(255,255,255,0.9);
        }
        .pulse-card.finished::before {
          opacity: 1;
          background:
            radial-gradient(circle at 15% 25%, rgba(34,197,94,0.35), transparent 50%),
            radial-gradient(circle at 85% 75%, rgba(16,185,129,0.3), transparent 55%);
        }
        .pie-wrap {
          position: absolute;
          left: 50%;
          bottom: 90px;
          transform: translateX(calc(-50% - 8px));
          width: 160px;
          height: 160px;
          border-radius: 999px;
          padding: 10px;
          background: rgba(15,23,42,0.65);
          border: 1px solid rgba(255,255,255,0.18);
          box-shadow: inset 0 0 20px rgba(255,255,255,0.08), 0 12px 30px rgba(0,0,0,0.4);
        }
        .pie {
          width: 100%;
          height: 100%;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.18);
          box-shadow: inset 0 0 18px rgba(0,0,0,0.35);
          animation: pieSpin 10s linear infinite;
        }
        .pie-pointer {
          width: 100%;
          height: 100%;
          border-radius: 999px;
          position: absolute;
          inset: 10px;
          pointer-events: none;
          animation: pieSpin 10s linear infinite;
        }
        .pie-wrap::after {
          content: "";
          position: absolute;
          inset: -18px;
          border-radius: 999px;
          border: 2px solid rgba(56,189,248,0.35);
          box-shadow: 0 0 24px rgba(56,189,248,0.35);
          animation: pieSpin 14s linear infinite reverse;
          pointer-events: none;
        }
        .pie-emit {
          position: absolute;
          inset: 0;
          border-radius: 999px;
          overflow: visible;
          pointer-events: none;
        }
        .pie-emit::before,
        .pie-emit::after {
          content: "";
          position: absolute;
          right: -12px;
          top: 50%;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(56,189,248,0.6), transparent 60%);
          opacity: 0.7;
          transform: translateY(-50%);
          animation: pieEmit 2.4s ease-in-out infinite;
        }
        .pie-emit::after {
          width: 90px;
          height: 90px;
          opacity: 0.4;
          animation-delay: 0.8s;
        }
        .pie-mark {
          position: absolute;
          left: 50%;
          top: 6px;
          transform: translateX(-50%);
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: rgba(255,255,255,0.95);
          border: 2px solid rgba(0,0,0,0.7);
          box-shadow: 0 0 8px rgba(0,0,0,0.6);
          z-index: 2;
        }
        @keyframes pieSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pieEmit {
          0% { transform: translateY(-50%) translateX(0); opacity: 0.2; }
          50% { transform: translateY(-50%) translateX(6px); opacity: 0.9; }
          100% { transform: translateY(-50%) translateX(0); opacity: 0.2; }
        }
        @keyframes pulseGlow {
          0% { box-shadow: 0 0 45px rgba(59,130,246,0.2); }
          50% { box-shadow: 0 0 80px rgba(59,130,246,0.45); }
          100% { box-shadow: 0 0 45px rgba(59,130,246,0.2); }
        }
        @keyframes titlePulse {
          0% { transform: translateX(-50%) scale(1); box-shadow: 0 0 24px rgba(56,189,248,0.4); }
          50% { transform: translateX(-50%) scale(1.03); box-shadow: 0 0 45px rgba(56,189,248,0.75); }
          100% { transform: translateX(-50%) scale(1); box-shadow: 0 0 24px rgba(56,189,248,0.4); }
        }
        @keyframes edgeDrift {
          0% { background-position: 0% 0%; }
          50% { background-position: 60% 60%; }
          100% { background-position: 0% 0%; }
        }
        @keyframes cardParticles {
          0% { background-position: 0% 0%; }
          50% { background-position: 40% 60%; }
          100% { background-position: 0% 0%; }
        }
        @keyframes pulseCardEnter {
          0% { opacity: 0; transform: translateY(14px) scale(0.98) skewX(-8deg); }
          100% { opacity: 1; transform: translateY(0) scale(1) skewX(-8deg); }
        }
        @keyframes battleIntroFade {
          0% { opacity: 0; }
          15% { opacity: 1; }
          70% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes battleIntroGlow {
          0% { opacity: 0; transform: scale(0.7); }
          40% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.25); }
        }
        @keyframes swordLeft {
          0% { opacity: 0; transform: translate(-140px, -120px) rotate(-120deg); }
          30% { opacity: 1; }
          60% { transform: translate(-8px, 0px) rotate(-45deg); }
          100% { opacity: 0; transform: translate(-8px, 8px) rotate(-45deg); }
        }
        @keyframes swordRight {
          0% { opacity: 0; transform: translate(140px, -120px) rotate(120deg); }
          30% { opacity: 1; }
          60% { transform: translate(8px, 0px) rotate(45deg); }
          100% { opacity: 0; transform: translate(8px, 8px) rotate(45deg); }
        }
        @keyframes flameDrift {
          0% { transform: translateY(0) scale(1); filter: blur(0px); }
          50% { transform: translateY(-8px) scale(1.02); filter: blur(1px); }
          100% { transform: translateY(0) scale(1); filter: blur(0px); }
        }
        @keyframes battleParticleRush {
          0% { background-position: 0% 0%, 0% 0%, 0% 0%; }
          100% { background-position: 120% 60%, -80% 100%, 60% -80%; }
        }
        @keyframes winnerFlash {
          0% { opacity: 0; transform: scale(0.9); }
          25% { opacity: 1; transform: scale(1.02); }
          70% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.04); }
        }
        @keyframes battleBodyReveal {
          0% { opacity: 0; transform: scale(0.98); }
          100% { opacity: 0.35; transform: scale(1); }
        }
      `}</style>

      <div className="pulse-wrap">
        <div className="pulse-title">Skill Pulse</div>
        <div className="pulse-title pulse-title-bottom">Skill Pulse</div>
        <div className="pulse-logo">
          <img
            src={navLogoUrl ?? "https://newushu.com/uploads/1/1/1/3/111378341/newushu-black-transparent-2.png"}
            alt="Logo"
            style={{ transform: `scale(${Math.max(0.6, navLogoZoom)})` }}
          />
        </div>
        <div className="pulse-log" style={logWrap()}>
          <div style={logTitle()}>Activity Log</div>
          <div style={logRow()}>
            {log.slice(0, 12).map((row) => (
              <div key={row.id} style={logItem(row.success)}>
                <span>{row.student_name}</span>
                <span style={{ opacity: 0.7 }}>· {row.skill_name}</span>
                <span style={{ marginLeft: "auto", fontWeight: 900 }}>
                  {row.success ? "✅" : "❌"}
                </span>
              </div>
            ))}
          </div>
        </div>
        {authChecked && !authOk ? (
          <div style={empty()}>Display access only.</div>
        ) : authChecked && !displayEnabled ? (
          <div style={empty()}>{msg || "Skill Pulse display disabled."}</div>
        ) : (
          <div
            key={shouldAnimate ? pageIndex : "static"}
            className={shouldAnimate ? "pulse-page" : undefined}
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(5, minmax(0, 1fr))`,
              rowGap: 22,
              columnGap: 12,
              height: 1460,
              alignContent: "start",
            }}
          >
            {visibleTrackers.length ? (
              visibleTrackers.map((item, idx) => {
                if (item.kind === "battle") {
                  const introActive = battleIntro[item.id];
                  const participants = item.participants ?? [];
                  const participantById = new Map(participants.map((p) => [p.id, p]));
                  const winnerName = item.winner_id
                    ? participantById.get(item.winner_id)?.name ||
                      (item.winner_id === item.left_student_id ? item.left_name : item.winner_id === item.right_student_id ? item.right_name : "")
                    : "";
                  const winnerParticipant = item.winner_id ? participantById.get(item.winner_id) : null;
                  const target = Number(item.repetitions_target ?? 0);
                  const battleDone =
                    participants.length > 0
                      ? participants.every((p) => (p.attempts_list?.length ?? 0) >= target)
                      : item.left_attempts >= target && item.right_attempts >= target;
                  const isMulti = participants.length > 2 || item.battle_mode === "ffa" || item.battle_mode === "teams";
                  const modeClass = item.battle_mode === "teams" ? "teams" : item.battle_mode === "ffa" ? "ffa" : "";
                  const teamA = item.team_a_ids ?? [];
                  const teamB = item.team_b_ids ?? [];
                  const teamAIds =
                    teamA.length > 0
                      ? teamA
                      : participants.slice(0, Math.max(1, Math.ceil(participants.length / 2))).map((p) => p.id);
                  const teamBIds =
                    teamB.length > 0 ? teamB : participants.map((p) => p.id).filter((id) => !teamAIds.includes(id));
                  const teamACompact = teamAIds.length > 6;
                  const teamBCompact = teamBIds.length > 6;
                  const teamAColumns = teamACompact ? 3 : Math.max(1, teamAIds.length);
                  const teamBColumns = teamBCompact ? 3 : Math.max(1, teamBIds.length);
                  const teamAAvatarSize = teamACompact ? 90 : 130;
                  const teamBAvatarSize = teamBCompact ? 90 : 130;
                  const teamABleed = teamACompact ? 16 : 22;
                  const teamBBleed = teamBCompact ? 16 : 22;
                  const wagerAmount = Math.max(0, Number(item.wager_amount ?? 0));
                  const effectiveWagerAmount = item.battle_mode === "teams" ? 0 : wagerAmount;
                  const pointsPerRep = Math.max(3, Number(item.points_per_rep ?? 5));
                  const attemptsById = new Map(
                    participants.map((p) => {
                      const attempts = p.attempts_list?.length ?? p.attempts ?? 0;
                      const successes = typeof p.successes === "number" ? p.successes : p.attempts_list?.filter((v) => v).length ?? 0;
                      return [p.id, { attempts, successes }];
                    })
                  );
                  const teamATotals = teamAIds.reduce(
                    (sum, id) => {
                      const stats = attemptsById.get(id) ?? { attempts: 0, successes: 0 };
                      return { attempts: sum.attempts + stats.attempts, successes: sum.successes + stats.successes };
                    },
                    { attempts: 0, successes: 0 }
                  );
                  const teamBTotals = teamBIds.reduce(
                    (sum, id) => {
                      const stats = attemptsById.get(id) ?? { attempts: 0, successes: 0 };
                      return { attempts: sum.attempts + stats.attempts, successes: sum.successes + stats.successes };
                    },
                    { attempts: 0, successes: 0 }
                  );
                  const teamARemaining = Math.max(0, target * teamAIds.length - teamATotals.attempts);
                  const teamBRemaining = Math.max(0, target * teamBIds.length - teamBTotals.attempts);
                  const teamAPotential = teamATotals.successes + teamARemaining;
                  const teamBPotential = teamBTotals.successes + teamBRemaining;
                  const renderBattleScore = (successesCount: number, attemptsCount: number) => {
                    const remaining = Math.max(0, target - attemptsCount);
                    const potential = successesCount + remaining;
                    return (
                      <div className="battle-score">
                        <div className="battle-score-value">{successesCount}</div>
                        <div className="battle-score-potential">({potential})</div>
                      </div>
                    );
                  };
                  const renderTeamScore = (successesCount: number, potentialCount: number) => (
                    <div className="battle-score team-score">
                      <div className="battle-score-value">{successesCount}</div>
                      <div className="battle-score-potential">({potentialCount})</div>
                    </div>
                  );
                  const ordered = participants.slice().sort((a, b) => (b.successes ?? 0) - (a.successes ?? 0));
                  let winnerIds: string[] = [];
                  let payoutTotal = 0;
                  if (participants.length) {
                    if (item.battle_mode === "teams") {
                      const teamASuccesses = teamAIds.reduce((sum, id) => sum + (attemptsById.get(id)?.successes ?? 0), 0);
                      const teamBSuccesses = teamBIds.reduce((sum, id) => sum + (attemptsById.get(id)?.successes ?? 0), 0);
                      if (teamASuccesses > teamBSuccesses) winnerIds = teamAIds;
                      if (teamBSuccesses > teamASuccesses) winnerIds = teamBIds;
                      const lead = Math.abs(teamASuccesses - teamBSuccesses);
                      payoutTotal = lead * pointsPerRep;
                    } else {
                      const top = ordered[0]?.successes ?? 0;
                      const second = ordered[1]?.successes ?? 0;
                      const tiedTop = ordered.filter((r) => (r.successes ?? 0) === top);
                      if (tiedTop.length === 1) winnerIds = [tiedTop[0].id];
                      const lead = Math.max(0, top - second);
                      payoutTotal = effectiveWagerAmount > 0 ? effectiveWagerAmount * participants.length : lead * pointsPerRep;
                    }
                  }
                  const winnerShare = winnerIds.length ? Math.floor(payoutTotal / Math.max(1, winnerIds.length)) : 0;
                  const winnerTeamLabel =
                    item.battle_mode === "teams" && winnerIds.length
                      ? winnerIds.every((id) => teamAIds.includes(id))
                        ? "TEAM A"
                        : winnerIds.every((id) => teamBIds.includes(id))
                        ? "TEAM B"
                        : "TEAM"
                      : "";
                  const teamAWon = item.battle_mode === "teams" && winnerIds.length && winnerIds.every((id) => teamAIds.includes(id));
                  const teamBWon = item.battle_mode === "teams" && winnerIds.length && winnerIds.every((id) => teamBIds.includes(id));
                  const mvpIds = Array.isArray((item as any).mvp_ids)
                    ? ((item as any).mvp_ids as string[]).map(String)
                    : [];
                  const winnerParticipants = winnerIds
                    .map((id) => participantById.get(id))
                    .filter((p): p is (typeof participants)[number] => !!p);
                  const loserIds = participants.map((p) => p.id).filter((id) => !winnerIds.includes(id));
                  const loserDebits = new Map<string, number>();
                  if (effectiveWagerAmount > 0 && loserIds.length) {
                    loserIds.forEach((id) => loserDebits.set(id, effectiveWagerAmount));
                  } else if (payoutTotal > 0 && loserIds.length) {
                    const balances = loserIds.map((id) => ({
                      id,
                      balance: Math.max(0, Number(participantById.get(id)?.points ?? 0)),
                    }));
                    if (item.battle_mode === "teams") {
                      const baseLoss = Math.floor(payoutTotal / Math.max(1, loserIds.length));
                      const remainder = payoutTotal - baseLoss * loserIds.length;
                      let maxLoser: { id: string; balance: number } | null = null;
                      balances.forEach((entry) => {
                        if (!maxLoser || entry.balance > maxLoser.balance) maxLoser = entry;
                      });
                      balances.forEach((entry) => {
                        let debit = Math.min(entry.balance, baseLoss);
                        if (remainder > 0 && maxLoser?.id === entry.id) {
                          debit = Math.min(entry.balance, baseLoss + remainder);
                        }
                        if (debit > 0) loserDebits.set(entry.id, debit);
                      });
                    } else {
                      let remaining = Math.max(0, Math.min(payoutTotal, balances.reduce((sum, b) => sum + b.balance, 0)));
                      for (let i = 0; i < balances.length; i += 1) {
                        const remainingCount = balances.length - i;
                        const entry = balances[i];
                        if (remaining <= 0) break;
                        const fairShare = Math.floor(remaining / remainingCount);
                        const debit = Math.min(entry.balance, Math.max(0, i === balances.length - 1 ? remaining : fairShare));
                        if (debit > 0) {
                          loserDebits.set(entry.id, debit);
                          remaining -= debit;
                        }
                      }
                    }
                  }
                  const pointsDeltaById = new Map<string, number>(
                    Object.entries((item as any).points_delta_by_id ?? {}).map(([key, value]) => [String(key), Number(value)])
                  );
                  if (!pointsDeltaById.size) {
                    participants.forEach((p) => {
                      if (winnerIds.includes(p.id)) {
                        pointsDeltaById.set(p.id, Math.max(0, winnerShare - effectiveWagerAmount));
                      } else if (loserDebits.has(p.id)) {
                        pointsDeltaById.set(p.id, -Math.max(0, loserDebits.get(p.id) ?? 0));
                      } else {
                        pointsDeltaById.set(p.id, 0);
                      }
                    });
                  }
                  const leftParticipant = participantById.get(item.left_student_id);
                  const rightParticipant = participantById.get(item.right_student_id);
                  const leftAttempts = item.left_attempts_list?.length ?? item.left_attempts ?? attemptsById.get(item.left_student_id)?.attempts ?? 0;
                  const leftSuccesses =
                    typeof item.left_successes === "number"
                      ? item.left_successes
                      : attemptsById.get(item.left_student_id)?.successes ??
                        (item.left_attempts_list?.filter((v) => v).length ?? 0);
                  const rightAttempts = item.right_attempts_list?.length ?? item.right_attempts ?? attemptsById.get(item.right_student_id)?.attempts ?? 0;
                  const rightSuccesses =
                    typeof item.right_successes === "number"
                      ? item.right_successes
                      : attemptsById.get(item.right_student_id)?.successes ??
                        (item.right_attempts_list?.filter((v) => v).length ?? 0);
                  return (
                    <div
                      key={item.id}
                      className={`pulse-card battle-card ${modeClass}${introActive ? " intro" : ""}${battleDone && item.winner_id ? " winner" : ""}${
                        isMulti ? " multi" : ""
                      }`}
                      style={{ ...cardTint(idx), ...(isMulti ? { gridColumn: "span 2" } : null) }}
                    >
                      <div className="battle-fast-particles" />
                      {introActive ? (
                        <div className="battle-intro">
                          <div className="battle-intro-glow" />
                          <div className="battle-sword left" />
                          <div className="battle-sword right" />
                        </div>
                      ) : null}
                      {battleDone && item.winner_id ? (
                        <div className="battle-winner-overlay persist">
                          {item.battle_mode === "teams" ? (
                            <div>
                              <div className="battle-winner-title">WINNER</div>
                              {winnerTeamLabel ? <div className="battle-winner-team">{winnerTeamLabel}</div> : null}
                              <div className="battle-winner-list">
                                {winnerParticipants.length ? (
                                  winnerParticipants.map((p) => (
                                    <div key={p.id} className="battle-winner-card">
                                      <div className="battle-winner-avatar">
                                        {renderAvatarFrame({
                                          size: 88,
                                          bg: p.avatar_bg ?? avatarByStudent[p.id]?.bg_color ?? null,
                                          avatarPath: p.avatar_path ?? avatarByStudent[p.id]?.storage_path ?? null,
                                          name: p.name,
                                          effectKey: p.avatar_effect ?? avatarByStudent[p.id]?.effect ?? null,
                                          effectConfigByKey,
                                          border: buildBorderFromAvatar(avatarByStudent[p.id]),
                                          cornerOffsets,
                                          bleed: 18,
                                          contextKey: "skill_pulse",
                                        })}
                                      </div>
                                      <div className="battle-winner-name">{p.name}</div>
                                      {battleDone ? (
                                        <div className="battle-winner-points">
                                          {pointsDeltaById.get(p.id) ?? 0} pts
                                        </div>
                                      ) : null}
                                    </div>
                                  ))
                                ) : (
                                  <div className="battle-winner-row">
                                    <div className="battle-winner-avatar">
                                      {renderAvatarFrame({
                                        size: 88,
                                        bg: null,
                                        avatarPath: null,
                                        name: winnerName || "W",
                                        effectKey: null,
                                        effectConfigByKey,
                                        border: null,
                                        cornerOffsets,
                                        bleed: 18,
                                          contextKey: "skill_pulse",
                                      })}
                                    </div>
                                    <div>
                                      {winnerName ? <div className="battle-winner-name">{winnerName}</div> : null}
                                      {battleDone ? (
                                        <div className="battle-winner-points">
                                          {pointsDeltaById.get(winnerIds[0] ?? "") ?? 0} pts
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="battle-winner-title">WINNER</div>
                              <div className="battle-winner-row">
                                <div className="battle-winner-avatar">
                                  {renderAvatarFrame({
                                    size: 88,
                                    bg: winnerParticipant?.avatar_bg ?? avatarByStudent[winnerParticipant?.id ?? ""]?.bg_color ?? null,
                                    avatarPath: winnerParticipant?.avatar_path ?? avatarByStudent[winnerParticipant?.id ?? ""]?.storage_path ?? null,
                                    name: winnerName || "W",
                                    effectKey: winnerParticipant?.avatar_effect ?? avatarByStudent[winnerParticipant?.id ?? ""]?.effect ?? null,
                                    effectConfigByKey,
                                    border: buildBorderFromAvatar(avatarByStudent[winnerParticipant?.id ?? ""]),
                                    cornerOffsets,
                                    bleed: 18,
                                          contextKey: "skill_pulse",
                                  })}
                                </div>
                                <div>
                                  {winnerName ? <div className="battle-winner-name">{winnerName}</div> : null}
                                  {battleDone ? (
                                    <div className="battle-winner-points">
                                      {pointsDeltaById.get(winnerParticipant?.id ?? "") ?? 0} pts
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : null}
                      <div
                        style={{
                          ...cardBody(),
                          minHeight: item.battle_mode === "ffa" ? 250 : 280,
                          paddingBottom: item.battle_mode === "ffa" ? 110 : 130,
                        }}
                        className={`battle-body ${isMulti ? "multi" : "duel"}`}
                      >
                        {modeClass ? (
                          <div className={`battle-mode-badge ${modeClass}`}>
                            {modeClass === "ffa" ? "FFA" : "TEAM BATTLE"}
                          </div>
                        ) : null}
                        {isMulti ? (
                          <>
                            {item.battle_mode === "teams" ? (
                              <div className="battle-team-rows">
                                <div className={`battle-team-box${teamAWon ? " winners" : ""}`}>
                                  {teamAWon ? <div className="battle-team-label">WINNERS</div> : null}
                                  {renderTeamScore(teamATotals.successes, teamAPotential)}
                                  <div
                                    className={`battle-team-row${teamACompact ? " compact" : ""}`}
                                    style={{ gridTemplateColumns: `repeat(${teamAColumns}, minmax(0, 1fr))` }}
                                  >
                                    {teamAIds.map((id) => {
                                      const p = participantById.get(id);
                                      if (!p) return null;
                                      const delta = pointsDeltaById.get(p.id) ?? 0;
                                      const avatarMeta = avatarByStudent[p.id];
                                      const border = buildBorderFromAvatar(avatarMeta);
                                      const stats = attemptsById.get(p.id) ?? { attempts: 0, successes: 0 };
                                      return (
                                        <div key={p.id} className={`battle-slot${teamACompact ? " compact" : ""}`}>
                                          <div className="battle-slot-name">{p.name}</div>
                                          {renderBattleScore(stats.successes, stats.attempts)}
                                          <div className="battle-mvp-holder" style={{ width: teamAAvatarSize, height: teamAAvatarSize }}>
                                            {mvpIds.includes(p.id) ? <div className="battle-mvp-badge">MVP</div> : null}
                                            {renderAvatarFrame({
                                              size: teamAAvatarSize,
                                              bg: p.avatar_bg ?? avatarMeta?.bg_color ?? null,
                                              avatarPath: p.avatar_path ?? avatarMeta?.storage_path ?? null,
                                              name: p.name,
                                              effectKey: p.avatar_effect ?? avatarMeta?.effect ?? null,
                                              effectConfigByKey,
                                              border,
                                              cornerOffsets,
                                              bleed: teamABleed,
                                          contextKey: "skill_pulse",
                                            })}
                                          </div>
                                          <div className="battle-dots">
                                            {Array.from({ length: target }).map((_, i) => {
                                              const val = p.attempts_list?.[i];
                                              const cls = val === true ? "success" : val === false ? "fail" : "";
                                              return <span key={i} className={`battle-dot ${cls}`} />;
                                            })}
                                          </div>
                                          {battleDone && delta !== 0 ? (
                                            <div className={`battle-points ${delta > 0 ? "win" : "lose"}`}>
                                              {delta > 0 ? `+${delta}` : delta}
                                            </div>
                                          ) : null}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                                <div className="battle-team-vs">
                                  <div className="battle-vs-block">VS</div>
                                  <div className="battle-skill-sub">{item.skill_name}</div>
                                  {battleDone && !mvpIds.length ? <div className="battle-mvp-note">No MVP this round</div> : null}
                                </div>
                                <div className={`battle-team-box${teamBWon ? " winners" : ""}`}>
                                  {teamBWon ? <div className="battle-team-label">WINNERS</div> : null}
                                  {renderTeamScore(teamBTotals.successes, teamBPotential)}
                                  <div
                                    className={`battle-team-row${teamBCompact ? " compact" : ""}`}
                                    style={{ gridTemplateColumns: `repeat(${teamBColumns}, minmax(0, 1fr))` }}
                                  >
                                    {teamBIds.map((id) => {
                                      const p = participantById.get(id);
                                      if (!p) return null;
                                      const delta = pointsDeltaById.get(p.id) ?? 0;
                                      const avatarMeta = avatarByStudent[p.id];
                                      const border = buildBorderFromAvatar(avatarMeta);
                                      const stats = attemptsById.get(p.id) ?? { attempts: 0, successes: 0 };
                                      return (
                                        <div key={p.id} className={`battle-slot${teamBCompact ? " compact" : ""}`}>
                                          <div className="battle-slot-name">{p.name}</div>
                                          {renderBattleScore(stats.successes, stats.attempts)}
                                          <div className="battle-mvp-holder" style={{ width: teamBAvatarSize, height: teamBAvatarSize }}>
                                            {mvpIds.includes(p.id) ? <div className="battle-mvp-badge">MVP</div> : null}
                                            {renderAvatarFrame({
                                              size: teamBAvatarSize,
                                              bg: p.avatar_bg ?? avatarMeta?.bg_color ?? null,
                                              avatarPath: p.avatar_path ?? avatarMeta?.storage_path ?? null,
                                              name: p.name,
                                              effectKey: p.avatar_effect ?? avatarMeta?.effect ?? null,
                                              effectConfigByKey,
                                              border,
                                              cornerOffsets,
                                              bleed: teamBBleed,
                                          contextKey: "skill_pulse",
                                            })}
                                          </div>
                                          <div className="battle-dots">
                                            {Array.from({ length: target }).map((_, i) => {
                                              const val = p.attempts_list?.[i];
                                              const cls = val === true ? "success" : val === false ? "fail" : "";
                                              return <span key={i} className={`battle-dot ${cls}`} />;
                                            })}
                                          </div>
                                          {battleDone && delta !== 0 ? (
                                            <div className={`battle-points ${delta > 0 ? "win" : "lose"}`}>
                                              {delta > 0 ? `+${delta}` : delta}
                                            </div>
                                          ) : null}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            ) : item.battle_mode === "ffa" && participants.length > 3 ? (
                              <div className="battle-ffa-rows">
                                {(() => {
                                  const topCount = participants.length >= 6 ? 3 : Math.ceil(participants.length / 2);
                                  const topRow = participants.slice(0, topCount);
                                  const bottomRow = participants.slice(topCount);
                                  return (
                                    <>
                                      <div className="battle-ffa-row">
                                        {topRow.map((p) => {
                                          const delta = pointsDeltaById.get(p.id) ?? 0;
                                          const avatarMeta = avatarByStudent[p.id];
                                          const border = buildBorderFromAvatar(avatarMeta);
                                          const stats = attemptsById.get(p.id) ?? { attempts: 0, successes: 0 };
                                          return (
                                            <div key={p.id} className="battle-slot">
                                              <div className="battle-slot-name">{p.name}</div>
                                              {renderBattleScore(stats.successes, stats.attempts)}
                                              <div style={{ width: 130, height: 130 }}>
                                                {mvpIds.includes(p.id) ? <div className="battle-mvp-badge">MVP</div> : null}
                                                {renderAvatarFrame({
                                                  size: 130,
                                                  bg: p.avatar_bg ?? avatarMeta?.bg_color ?? null,
                                                  avatarPath: p.avatar_path ?? avatarMeta?.storage_path ?? null,
                                                  name: p.name,
                                                  effectKey: p.avatar_effect ?? avatarMeta?.effect ?? null,
                                                  effectConfigByKey,
                                                  border,
                                                  cornerOffsets,
                                                  bleed: 22,
                                          contextKey: "skill_pulse",
                                                })}
                                              </div>
                                              <div className="battle-dots">
                                                {Array.from({ length: target }).map((_, i) => {
                                                  const val = p.attempts_list?.[i];
                                                  const cls = val === true ? "success" : val === false ? "fail" : "";
                                                  return <span key={i} className={`battle-dot ${cls}`} />;
                                                })}
                                              </div>
                                              {battleDone && delta !== 0 ? (
                                                <div className={`battle-points ${delta > 0 ? "win" : "lose"}`}>
                                                  {delta > 0 ? `+${delta}` : delta}
                                                </div>
                                              ) : null}
                                            </div>
                                          );
                                        })}
                                      </div>
                                      <div className="battle-ffa-row">
                                        {bottomRow.map((p) => {
                                          const delta = pointsDeltaById.get(p.id) ?? 0;
                                          const avatarMeta = avatarByStudent[p.id];
                                          const border = buildBorderFromAvatar(avatarMeta);
                                          const stats = attemptsById.get(p.id) ?? { attempts: 0, successes: 0 };
                                          return (
                                            <div key={p.id} className="battle-slot">
                                              <div className="battle-slot-name">{p.name}</div>
                                              {renderBattleScore(stats.successes, stats.attempts)}
                                              <div style={{ width: 130, height: 130 }}>
                                                {mvpIds.includes(p.id) ? <div className="battle-mvp-badge">MVP</div> : null}
                                                {renderAvatarFrame({
                                                  size: 130,
                                                  bg: p.avatar_bg ?? avatarMeta?.bg_color ?? null,
                                                  avatarPath: p.avatar_path ?? avatarMeta?.storage_path ?? null,
                                                  name: p.name,
                                                  effectKey: p.avatar_effect ?? avatarMeta?.effect ?? null,
                                                  effectConfigByKey,
                                                  border,
                                                  cornerOffsets,
                                                  bleed: 22,
                                          contextKey: "skill_pulse",
                                                })}
                                              </div>
                                              <div className="battle-dots">
                                                {Array.from({ length: target }).map((_, i) => {
                                                  const val = p.attempts_list?.[i];
                                                  const cls = val === true ? "success" : val === false ? "fail" : "";
                                                  return <span key={i} className={`battle-dot ${cls}`} />;
                                                })}
                                              </div>
                                              {battleDone && delta !== 0 ? (
                                                <div className={`battle-points ${delta > 0 ? "win" : "lose"}`}>
                                                  {delta > 0 ? `+${delta}` : delta}
                                                </div>
                                              ) : null}
                                            </div>
                                          );
                                        })}
                                      </div>
                                      <div className="battle-ffa-vs">
                                        <div className="battle-vs-block">VS</div>
                                        <div className="battle-skill-sub">{item.skill_name}</div>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            ) : participants.length === 3 ? (
                              <div className="battle-grid two">
                                {participants.slice(0, 2).map((p) => {
                                  const delta = pointsDeltaById.get(p.id) ?? 0;
                                  const avatarMeta = avatarByStudent[p.id];
                                  const border = buildBorderFromAvatar(avatarMeta);
                                  const stats = attemptsById.get(p.id) ?? { attempts: 0, successes: 0 };
                                  return (
                                    <div key={p.id} className="battle-slot">
                                      <div className="battle-slot-name">{p.name}</div>
                                      {renderBattleScore(stats.successes, stats.attempts)}
                                      <div style={{ width: 130, height: 130 }}>
                                        {mvpIds.includes(p.id) ? <div className="battle-mvp-badge">MVP</div> : null}
                                        {renderAvatarFrame({
                                          size: 130,
                                          bg: p.avatar_bg ?? avatarMeta?.bg_color ?? null,
                                          avatarPath: p.avatar_path ?? avatarMeta?.storage_path ?? null,
                                          name: p.name,
                                          effectKey: p.avatar_effect ?? avatarMeta?.effect ?? null,
                                          effectConfigByKey,
                                          border,
                                          cornerOffsets,
                                          bleed: 22,
                                          contextKey: "skill_pulse",
                                        })}
                                      </div>
                                      <div className="battle-dots">
                                        {Array.from({ length: target }).map((_, i) => {
                                          const val = p.attempts_list?.[i];
                                          const cls = val === true ? "success" : val === false ? "fail" : "";
                                          return <span key={i} className={`battle-dot ${cls}`} />;
                                        })}
                                      </div>
                                      {battleDone && delta !== 0 ? (
                                        <div className={`battle-points ${delta > 0 ? "win" : "lose"}`}>
                                          {delta > 0 ? `+${delta}` : delta}
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })}
                                {participants[2] ? (
                                  <div className="battle-slot">
                                    <div className="battle-slot-name">{participants[2].name}</div>
                                    {renderBattleScore(
                                      attemptsById.get(participants[2].id)?.successes ?? 0,
                                      attemptsById.get(participants[2].id)?.attempts ?? 0
                                    )}
                                    <div style={{ width: 130, height: 130 }}>
                                      {mvpIds.includes(participants[2].id) ? <div className="battle-mvp-badge">MVP</div> : null}
                                      {renderAvatarFrame({
                                        size: 130,
                                        bg: participants[2].avatar_bg ?? avatarByStudent[participants[2].id]?.bg_color ?? null,
                                        avatarPath: participants[2].avatar_path ?? avatarByStudent[participants[2].id]?.storage_path ?? null,
                                        name: participants[2].name,
                                        effectKey: participants[2].avatar_effect ?? avatarByStudent[participants[2].id]?.effect ?? null,
                                        effectConfigByKey,
                                        border: buildBorderFromAvatar(avatarByStudent[participants[2].id]),
                                        cornerOffsets,
                                        bleed: 22,
                                          contextKey: "skill_pulse",
                                      })}
                                    </div>
                                    <div className="battle-dots">
                                      {Array.from({ length: target }).map((_, i) => {
                                        const val = participants[2]?.attempts_list?.[i];
                                        const cls = val === true ? "success" : val === false ? "fail" : "";
                                        return <span key={i} className={`battle-dot ${cls}`} />;
                                      })}
                                    </div>
                                    {battleDone && (pointsDeltaById.get(participants[2].id) ?? 0) !== 0 ? (
                                      <div className={`battle-points ${(pointsDeltaById.get(participants[2].id) ?? 0) > 0 ? "win" : "lose"}`}>
                                        {(pointsDeltaById.get(participants[2].id) ?? 0) > 0 ? `+${pointsDeltaById.get(participants[2].id)}` : pointsDeltaById.get(participants[2].id)}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}
                                <div className="battle-slot vs">
                                  <div className="battle-vs-block">VS</div>
                                  <div className="battle-skill-sub">{item.skill_name}</div>
                                </div>
                              </div>
                            ) : (
                              <div className={`battle-grid ${participants.length > 4 ? "three" : "two"}`}>
                                {participants.map((p) => {
                                  const delta = pointsDeltaById.get(p.id) ?? 0;
                                  const avatarMeta = avatarByStudent[p.id];
                                  const border = buildBorderFromAvatar(avatarMeta);
                                  const stats = attemptsById.get(p.id) ?? { attempts: 0, successes: 0 };
                                  return (
                                    <div key={p.id} className="battle-slot">
                                      <div className="battle-slot-name">{p.name}</div>
                                      {renderBattleScore(stats.successes, stats.attempts)}
                                      <div style={{ width: 130, height: 130 }}>
                                        {mvpIds.includes(p.id) ? <div className="battle-mvp-badge">MVP</div> : null}
                                        {renderAvatarFrame({
                                          size: 130,
                                          bg: p.avatar_bg ?? avatarMeta?.bg_color ?? null,
                                          avatarPath: p.avatar_path ?? avatarMeta?.storage_path ?? null,
                                          name: p.name,
                                          effectKey: p.avatar_effect ?? avatarMeta?.effect ?? null,
                                          effectConfigByKey,
                                          border,
                                          cornerOffsets,
                                          bleed: 22,
                                          contextKey: "skill_pulse",
                                        })}
                                      </div>
                                      <div className="battle-dots">
                                        {Array.from({ length: target }).map((_, i) => {
                                          const val = p.attempts_list?.[i];
                                          const cls = val === true ? "success" : val === false ? "fail" : "";
                                          return <span key={i} className={`battle-dot ${cls}`} />;
                                        })}
                                      </div>
                                      {battleDone && delta !== 0 ? (
                                        <div className={`battle-points ${delta > 0 ? "win" : "lose"}`}>
                                          {delta > 0 ? `+${delta}` : delta}
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="battle-name-top">
                              {item.left_name}
                              {renderBattleScore(leftSuccesses, leftAttempts)}
                              <div className="battle-dots">
                                {Array.from({ length: target }).map((_, i) => {
                                  const val = item.left_attempts_list?.[i];
                                  const cls = val === true ? "success" : val === false ? "fail" : "";
                                  return <span key={i} className={`battle-dot ${cls}`} />;
                                })}
                              </div>
                              {battleDone && (pointsDeltaById.get(item.left_student_id) ?? 0) !== 0 ? (
                                <div className={`battle-points ${(pointsDeltaById.get(item.left_student_id) ?? 0) > 0 ? "win" : "lose"}`}>
                                  {(pointsDeltaById.get(item.left_student_id) ?? 0) > 0 ? `+${pointsDeltaById.get(item.left_student_id)}` : pointsDeltaById.get(item.left_student_id)}
                                </div>
                              ) : null}
                            </div>
                            <div style={{ width: 170, height: 170 }}>
                              {renderAvatarFrame({
                                size: 170,
                                bg: item.left_avatar_bg ?? leftParticipant?.avatar_bg ?? avatarByStudent[item.left_student_id]?.bg_color ?? null,
                                avatarPath: item.left_avatar_path ?? leftParticipant?.avatar_path ?? avatarByStudent[item.left_student_id]?.storage_path ?? null,
                                name: item.left_name,
                                effectKey: item.left_avatar_effect ?? leftParticipant?.avatar_effect ?? avatarByStudent[item.left_student_id]?.effect ?? null,
                                effectConfigByKey,
                                border: buildBorderFromAvatar(avatarByStudent[item.left_student_id]),
                                cornerOffsets,
                                bleed: 22,
                                          contextKey: "skill_pulse",
                              })}
                            </div>
                            <div className="battle-vs">VS</div>
                            <div style={{ width: 170, height: 170 }}>
                              {renderAvatarFrame({
                                size: 170,
                                bg: item.right_avatar_bg ?? rightParticipant?.avatar_bg ?? avatarByStudent[item.right_student_id]?.bg_color ?? null,
                                avatarPath: item.right_avatar_path ?? rightParticipant?.avatar_path ?? avatarByStudent[item.right_student_id]?.storage_path ?? null,
                                name: item.right_name,
                                effectKey: item.right_avatar_effect ?? rightParticipant?.avatar_effect ?? avatarByStudent[item.right_student_id]?.effect ?? null,
                                effectConfigByKey,
                                border: buildBorderFromAvatar(avatarByStudent[item.right_student_id]),
                                cornerOffsets,
                                bleed: 22,
                                          contextKey: "skill_pulse",
                              })}
                            </div>
                            <div className="battle-name-bottom">
                              {item.right_name}
                              {renderBattleScore(rightSuccesses, rightAttempts)}
                              <div className="battle-dots">
                                {Array.from({ length: target }).map((_, i) => {
                                  const val = item.right_attempts_list?.[i];
                                  const cls = val === true ? "success" : val === false ? "fail" : "";
                                  return <span key={i} className={`battle-dot ${cls}`} />;
                                })}
                              </div>
                              {battleDone && (pointsDeltaById.get(item.right_student_id) ?? 0) !== 0 ? (
                                <div className={`battle-points ${(pointsDeltaById.get(item.right_student_id) ?? 0) > 0 ? "win" : "lose"}`}>
                                  {(pointsDeltaById.get(item.right_student_id) ?? 0) > 0 ? `+${pointsDeltaById.get(item.right_student_id)}` : pointsDeltaById.get(item.right_student_id)}
                                </div>
                              ) : null}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                }

                const t = item as DisplayItem & TrackerRow;
                const attempts = Number(t.attempts ?? t.recent_attempts?.length ?? 0);
                const target = Number(t.repetitions_target ?? 1);
                const successes = Number(t.successes ?? t.recent_attempts?.filter((a) => a.success).length ?? 0);
                const remaining = Math.max(0, target - attempts);
                const potential = successes + remaining;
                const percent = attempts ? Math.round((successes / attempts) * 100) : 0;
                const finished = attempts >= target && target > 0;
                const last30Attempts = Number(t.last30_attempts ?? 0);
                const last30Successes = Number(t.last30_successes ?? 0);
                const last30Fails = Math.max(0, last30Attempts - last30Successes);
                const total30 = Math.max(1, last30Attempts);
                const points = Number(t.points_awarded ?? 0);
                const isPlaceholder = t.id.startsWith("placeholder-");
                const trendLogs = trendLogsByTrackerId[t.id] ?? [];
                return (
                <div key={t.id} className={`pulse-card tracker-card${finished ? " finished" : ""}${isPlaceholder ? " placeholder" : ""}`} style={cardTint(idx)}>
                  {avatarByStudent[t.student_id]?.card_plate_url ? (
                    <img
                      src={avatarByStudent[t.student_id]?.card_plate_url ?? ""}
                      alt=""
                      style={cardPlateStyle(plateOffsets, false)}
                    />
                  ) : null}
                  <div style={cardBody()}>
                    <div className="tracker-header">
                      <div style={{ width: 186, height: 186 }}>
                        {renderAvatarFrame({
                          size: 186,
                          bg: avatarByStudent[t.student_id]?.bg_color ?? null,
                          avatarPath: avatarByStudent[t.student_id]?.storage_path ?? null,
                          name: t.student_name,
                          effectKey: avatarByStudent[t.student_id]?.effect ?? null,
                          effectConfigByKey,
                          border: buildBorderFromAvatar(avatarByStudent[t.student_id]),
                          cornerOffsets,
                          bleed: 24,
                          contextKey: "skill_pulse",
                        })}
                      </div>
                      <div className="tracker-name" style={{ opacity: isPlaceholder ? 0.35 : 1 }}>
                        {isPlaceholder ? "-" : t.student_name}
                        {t.student_is_competition ? (
                          <img
                            src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/badges/prestige/compteam.png`}
                            alt="Competition crest"
                            style={{
                              width: 26,
                              height: 26,
                              objectFit: "contain",
                              filter: "drop-shadow(0 0 6px rgba(34,197,94,0.6))",
                            }}
                          />
                        ) : null}
                      </div>
                    </div>
                    <div style={{ ...skillBox(), opacity: isPlaceholder ? 0.35 : 1 }}>
                      {isPlaceholder ? "-" : t.skill_name}
                    </div>
                    <div className="tracker-score" style={{ opacity: isPlaceholder ? 0.35 : 1 }}>
                      <div className="tracker-score-value">{successes}</div>
                      <div className="tracker-score-potential">({potential})</div>
                    </div>
                    <>
                      <div style={statLabel()}>{finished ? "Finished" : "Current"}</div>
                      <div style={statPercent()}>{percent}%</div>
                      <div style={pointsEarned(!finished)}>
                        {finished ? `+${points} pts` : "—"}
                      </div>
                    </>
                    <div className={`history-bar${finished && !isPlaceholder ? "" : " placeholder"}`}>
                      {finished && !isPlaceholder ? (
                        <>
                          <div className="success" style={{ width: `${Math.round((last30Successes / total30) * 100)}%` }} />
                          <div className="fail" style={{ width: `${Math.round((last30Fails / total30) * 100)}%` }} />
                        </>
                      ) : null}
                    </div>
                    <div className="pie-wrap">
                      <div className="pie" style={pieStyle(t)} />
                      <div className="pie-emit" />
                      <div className="pie-pointer">
                        <div className="pie-mark" />
                      </div>
                    </div>
                    <div className={`trend-panel${finished && !isPlaceholder ? " complete" : " muted"}`}>
                      <div className="trend-overlay">
                        <div className="trend-label y">% success</div>
                        <div className="trend-label x">30d</div>
                          <svg className="trend-line" viewBox="0 0 301 146" preserveAspectRatio="none">
                          {finished && !isPlaceholder ? (
                            <>
                              <path d={trendPath(t, trendLogs)} />
                              {trendPoints(t, trendLogs).map((p, i) => (
                                <circle key={i} cx={p.x} cy={p.y} r="2.6" className="trend-point" />
                              ))}
                              {trendLabels(t, trendLogs).map((label, i) => (
                                <text key={i} x={label.x} y={label.y} className="trend-label-point">
                                  {label.text}
                                </text>
                              ))}
                            </>
                          ) : (
                            <path className="trend-line-placeholder" d="M8,110 L54,92 L104,96 L154,78 L204,84 L254,72 L293,68" />
                          )}
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              )})
            ) : (
              <div style={empty()}>No active trackers yet.</div>
            )}
          </div>
        )}
      </div>

    </main>
  );
}

function buildLog(list: TrackerRow[]): LogRow[] {
  const all: LogRow[] = [];
  list.forEach((t) => {
    (t.recent_attempts ?? []).forEach((a) => {
      all.push({
        id: `${t.id}-${a.id}`,
        student_name: t.student_name,
        skill_name: t.skill_name,
        success: !!a.success,
        created_at: a.created_at,
      });
    });
  });
  return all.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

function page(): React.CSSProperties {
  return {
    minHeight: "100vh",
    padding: "28px 40px 26px",
    background:
      "radial-gradient(circle at top left, rgba(59,130,246,0.18), transparent 60%), radial-gradient(circle at 30% 80%, rgba(34,197,94,0.18), transparent 55%), linear-gradient(140deg, #020617, #0b1020 45%, #0f172a)",
    color: "white",
    display: "grid",
    gap: 16,
  };
}

function hero(): React.CSSProperties {
  return {
    display: "grid",
    gap: 6,
  };
}

function headline(): React.CSSProperties {
  return {
    fontSize: 40,
    fontWeight: 1000,
    letterSpacing: 0.4,
  };
}

function subhead(): React.CSSProperties {
  return {
    fontSize: 14,
    opacity: 0.7,
    fontWeight: 700,
  };
}

function error(): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid rgba(239,68,68,0.5)",
    background: "rgba(239,68,68,0.2)",
    fontWeight: 900,
    width: "fit-content",
  };
}

function empty(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: 18,
    border: "1px dashed rgba(255,255,255,0.25)",
    background: "rgba(255,255,255,0.04)",
    fontWeight: 900,
    textAlign: "center",
  };
}

function resolveAvatarUrl(path?: string | null) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!base) return null;
  return `${base}/storage/v1/object/public/avatars/${path}`;
}

function avatarBackground(bg: string | null) {
  return bg
    ? `linear-gradient(135deg, rgba(255,255,255,0.2), rgba(0,0,0,0.35)), ${bg}`
    : "linear-gradient(135deg, rgba(255,255,255,0.25), rgba(0,0,0,0.35))";
}

function avatarFrameStyle(): React.CSSProperties {
  return {
    border: "1px solid rgba(255,255,255,0.22)",
    boxShadow:
      "inset 0 2px 10px rgba(255,255,255,0.12), inset 0 -10px 16px rgba(0,0,0,0.45), 0 16px 28px rgba(0,0,0,0.4)",
  };
}

function buildBorderFromAvatar(avatar?: {
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
    render_mode: avatar?.corner_border_render_mode ?? null,
    image_url: avatar?.corner_border_url ?? null,
    html: avatar?.corner_border_html ?? null,
    css: avatar?.corner_border_css ?? null,
    js: avatar?.corner_border_js ?? null,
    offset_x: avatar?.corner_border_offset_x ?? null,
    offset_y: avatar?.corner_border_offset_y ?? null,
    offsets_by_context: avatar?.corner_border_offsets_by_context ?? null,
  };
}

function renderAvatarFrame({
  size,
  bg,
  avatarPath,
  name,
  effectKey,
  effectConfigByKey,
  border,
  cornerOffsets,
  bleed = 24,
  avatarZoomPct,
  contextKey,
}: {
  size: number;
  bg: string | null;
  avatarPath?: string | null;
  name: string;
  effectKey?: string | null;
  effectConfigByKey: Record<string, { config?: any; render_mode?: string | null; html?: string | null; css?: string | null; js?: string | null }>;
  border?: {
    render_mode?: string | null;
    image_url?: string | null;
    html?: string | null;
    css?: string | null;
    js?: string | null;
    offset_x?: number | null;
    offset_y?: number | null;
    offsets_by_context?: Record<string, { x?: number | null; y?: number | null; scale?: number | null }> | null;
  } | null;
  cornerOffsets?: { x: number; y: number; size: number } | null;
  bleed?: number;
  avatarZoomPct?: number;
  contextKey?: string;
}) {
  const effect = effectKey ? effectConfigByKey[effectKey] : undefined;
  const safeName = String(name ?? "").trim() || " ";
  return (
    <AvatarRender
      size={size}
      bg={avatarBackground(bg)}
      border={border ?? null}
      effect={{
        key: effectKey ?? null,
        config: effect?.config,
        render_mode: effect?.render_mode ?? null,
        html: effect?.html ?? null,
        css: effect?.css ?? null,
        js: effect?.js ?? null,
      }}
      avatarSrc={resolveAvatarUrl(avatarPath)}
      cornerOffsets={cornerOffsets}
      avatarZoomPct={avatarZoomPct}
      bleed={bleed}
      contextKey={contextKey}
      style={avatarFrameStyle()}
      fallback={<span>{safeName.slice(0, 1)}</span>}
    />
  );
}

function cardName(): React.CSSProperties {
  return {
    fontWeight: 1000,
    fontSize: 36,
    textAlign: "center",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(15,23,42,0.6)",
  };
}

function skillBox(): React.CSSProperties {
  return {
    fontSize: 24,
    fontWeight: 1000,
    padding: "6px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(15,23,42,0.6)",
    textAlign: "center",
    width: "100%",
    marginLeft: 5,
  };
}

function cardBody(): React.CSSProperties {
  return {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    minHeight: 65,
    paddingBottom: 0,
    paddingLeft: 6,
  };
}

function statLabel(): React.CSSProperties {
  return {
    fontSize: 20,
    fontWeight: 900,
    opacity: 0.75,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  };
}

function statPercent(): React.CSSProperties {
  return {
    fontSize: 42,
    fontWeight: 1000,
    color: "rgba(255,255,255,0.92)",
  };
}

function pointsEarned(isPlaceholder?: boolean): React.CSSProperties {
  return {
    fontSize: 42,
    fontWeight: 1000,
    color: isPlaceholder ? "rgba(255,255,255,0.5)" : "rgba(34,197,94,0.95)",
    padding: "10px 18px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.16)",
    background: isPlaceholder ? "rgba(255,255,255,0.06)" : "rgba(34,197,94,0.16)",
    minWidth: 170,
    textAlign: "center",
    marginTop: 8,
  };
}

function pieStyle(t: TrackerRow): React.CSSProperties {
  const target = Math.max(1, Number(t.repetitions_target ?? 1));
  const attempts = (t.recent_attempts ?? []).slice(0, target);
  const slice = 100 / target;
  const sliceDeg = 360 / target;
  let acc = 0;
  const parts: string[] = [];
  attempts.forEach((a) => {
    const next = acc + slice;
    const color = a.success ? "rgba(16,185,129,0.85)" : "rgba(248,113,113,0.85)";
    parts.push(`${color} ${acc}% ${next}%`);
    acc = next;
  });
  if (acc < 100) {
    parts.push(`rgba(148,163,184,0.25) ${acc}% 100%`);
  }
  return {
    backgroundImage: `repeating-conic-gradient(from -90deg, rgba(20,20,20,0.9) 0deg 4.4deg, transparent 4.4deg ${sliceDeg}deg), radial-gradient(circle at 30% 25%, rgba(255,255,255,0.18), transparent 55%), conic-gradient(from -90deg, ${parts.join(", ")})`,
  };
}

function trendPoints(t: TrackerRow, logs?: HistoryLog[]): { x: number; y: number }[] {
  const width = 301;
  const height = 146;
  const pad = 8;
  if (logs && logs.length) {
    const sorted = logs
      .slice()
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    const valid = sorted.filter((l) => (l.attempts ?? 0) >= 3);
    const series = valid.length ? valid : sorted;
    const step = series.length > 1 ? (width - pad * 2) / (series.length - 1) : 0;
    return series.map((l, i) => {
      const rate = Number.isFinite(l.rate) ? l.rate : l.attempts ? Math.round((l.successes / l.attempts) * 100) : 0;
      const x = pad + step * i;
      const y = pad + ((100 - rate) / 100) * (height - pad * 2);
      return { x, y };
    });
  }
  const attempts = (t.recent_attempts ?? []).slice(-24);
  if (!attempts.length) {
    return [
      { x: 0, y: height / 2 },
      { x: width, y: height / 2 },
    ];
  }
  let successes = 0;
  const values = attempts.map((a, i) => {
    if (a.success) successes += 1;
    return successes / (i + 1);
  });
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;
  return values.map((v, i) => {
    const x = pad + step * i;
    const y = pad + (1 - v) * (height - pad * 2);
    return { x, y };
  });
}

function trendPath(t: TrackerRow, logs?: HistoryLog[]): string {
  const points = trendPoints(t, logs);
  return `M${points[0].x},${points[0].y} ${points.slice(1).map((p) => `L${p.x},${p.y}`).join(" ")}`;
}

function trendLabels(t: TrackerRow, logs?: HistoryLog[]): Array<{ x: number; y: number; text: string }> {
  if (!logs || !logs.length) return [];
  const sorted = logs
    .slice()
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const valid = sorted.filter((l) => (l.attempts ?? 0) >= 3);
  const series = valid.length ? valid : sorted;
  const points = trendPoints(t, logs);
  if (series.length < 2) {
    return [
      {
        x: points[0].x,
        y: Math.max(18, points[0].y - 2),
        text: `${series[0].successes}/${series[0].attempts}`,
      },
    ];
  }
  const width = 301;
  const mid = width / 2;
  const pulls = 10;
  const clampPad = 18;
  const picks = [0, Math.floor(points.length / 2), points.length - 1]
    .filter((idx, i, arr) => idx >= 0 && idx < points.length && arr.indexOf(idx) === i)
    .map((idx) => {
      const rawX = points[idx].x;
      const pulled = rawX < mid ? rawX + pulls : rawX > mid ? rawX - pulls : rawX;
      const x = Math.max(clampPad, Math.min(width - clampPad, pulled));
      return {
        x,
        y: Math.max(4, points[idx].y - 22),
        text: `${series[idx].successes}/${series[idx].attempts}`,
      };
    });
  return picks;
}

function cardTint(index: number): React.CSSProperties {
  const hues = [210, 160, 30, 280, 340, 120];
  const hue = hues[index % hues.length];
  return {
    background: `linear-gradient(135deg, hsla(${hue},70%,18%,0.9), rgba(2,6,23,0.85))`,
  };
}

function logWrap(): React.CSSProperties {
  return {
    borderRadius: 20,
    padding: "10px 12px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "linear-gradient(135deg, rgba(15,23,42,0.9), rgba(2,6,23,0.85))",
    boxShadow: "0 18px 36px rgba(0,0,0,0.45), inset 0 0 18px rgba(56,189,248,0.2)",
    display: "grid",
    gap: 10,
  };
}

function logTitle(): React.CSSProperties {
  return {
    fontWeight: 900,
    letterSpacing: 0.3,
    fontSize: 13,
    textTransform: "uppercase",
    color: "rgba(148,163,184,0.9)",
  };
}

function logRow(): React.CSSProperties {
  return {
    display: "grid",
    gap: 8,
  };
}

function logItem(success: boolean): React.CSSProperties {
  return {
    borderRadius: 10,
    padding: "6px 10px",
    border: "1px solid rgba(255,255,255,0.14)",
    background: success ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)",
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    fontWeight: 800,
    color: "rgba(255,255,255,0.88)",
  };
}

function cardPlateStyle(offset: PlateOffsets, mirror: boolean): React.CSSProperties {
  return {
    position: "absolute",
    top: offset.y,
    left: mirror ? undefined : offset.x,
    right: mirror ? offset.x : undefined,
    width: offset.size,
    height: "auto",
    objectFit: "contain",
    transform: mirror ? "scaleX(-1)" : "none",
    pointerEvents: "none",
    zIndex: 8,
  };
}

function cardPlateSideStyle(offset: PlateOffsets, mirror: boolean): React.CSSProperties {
  return {
    position: "absolute",
    top: offset.y,
    left: mirror ? undefined : offset.x,
    right: mirror ? offset.x : undefined,
    width: offset.size,
    height: "auto",
    objectFit: "contain",
    transform: mirror ? "scaleX(-1)" : "none",
    pointerEvents: "none",
    zIndex: 8,
  };
}

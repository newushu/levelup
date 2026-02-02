"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fadeOutGlobalMusic, playGlobalMusic, playGlobalSfx, setGlobalSounds } from "@/lib/globalAudio";
import { supabaseClient } from "@/lib/supabase/client";
import AvatarRender from "@/components/AvatarRender";

type SoundEffect = {
  key: string;
  audio_url: string | null;
  volume: number | null;
  loop: boolean | null;
};

type BattleParticipant = {
  id: string;
  name: string;
  avatar_path?: string | null;
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
  card_plate_url?: string | null;
  attempts?: number;
  successes?: number;
};

type BattlePulseEffect = {
  id?: string | null;
  key: string;
  name: string;
  effect_type?: string | null;
  effect_types?: string | null;
  offset_x?: number | null;
  offset_y?: number | null;
  html?: string | null;
  css?: string | null;
  js?: string | null;
  enabled?: boolean;
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
  participants?: BattleParticipant[];
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
  left_corner_border_url?: string | null;
  right_corner_border_url?: string | null;
  left_corner_border_render_mode?: string | null;
  left_corner_border_html?: string | null;
  left_corner_border_css?: string | null;
  left_corner_border_js?: string | null;
  left_corner_border_offset_x?: number | null;
  left_corner_border_offset_y?: number | null;
  left_corner_border_offsets_by_context?: Record<string, { x?: number | null; y?: number | null; scale?: number | null }> | null;
  right_corner_border_render_mode?: string | null;
  right_corner_border_html?: string | null;
  right_corner_border_css?: string | null;
  right_corner_border_js?: string | null;
  right_corner_border_offset_x?: number | null;
  right_corner_border_offset_y?: number | null;
  right_corner_border_offsets_by_context?: Record<string, { x?: number | null; y?: number | null; scale?: number | null }> | null;
  left_card_plate_url?: string | null;
  right_card_plate_url?: string | null;
  left_attempts?: number;
  right_attempts?: number;
  left_successes?: number;
  right_successes?: number;
  settled_at?: string | null;
  winner_id?: string | null;
  mvp_ids?: string[];
  points_delta_by_id?: Record<string, number>;
};

type DisplayCard =
  | ({ kind: "battle" } & BattleRow)
  | { kind: "placeholder"; id: string };

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status})` } };
  }
}

function buildBattleFxDoc(effect?: BattlePulseEffect | null) {
  const html = effect?.html ?? "";
  const css = effect?.css ?? "";
  const js = effect?.js ?? "";
  const safetyScript = `
    <script>
      (function(){
        const stopAfterMs = 3000;
        const stopAt = Date.now() + stopAfterMs;
        const nativeRaf = window.requestAnimationFrame.bind(window);
        const nativeCancelRaf = window.cancelAnimationFrame.bind(window);
        const nativeSetInterval = window.setInterval.bind(window);
        const nativeClearInterval = window.clearInterval.bind(window);
        const nativeSetTimeout = window.setTimeout.bind(window);
        const nativeClearTimeout = window.clearTimeout.bind(window);
        const intervals = new Set();
        const timeouts = new Set();
        window.requestAnimationFrame = function(cb){
          if (Date.now() > stopAt) return 0;
          return nativeRaf(cb);
        };
        window.cancelAnimationFrame = function(id){
          try { nativeCancelRaf(id); } catch {}
        };
        window.setInterval = function(fn, ms, ...args){
          const id = nativeSetInterval(fn, ms, ...args);
          intervals.add(id);
          return id;
        };
        window.clearInterval = function(id){
          intervals.delete(id);
          return nativeClearInterval(id);
        };
        window.setTimeout = function(fn, ms, ...args){
          const id = nativeSetTimeout(fn, ms, ...args);
          timeouts.add(id);
          return id;
        };
        window.clearTimeout = function(id){
          timeouts.delete(id);
          return nativeClearTimeout(id);
        };
        const stop = () => {
          intervals.forEach((id) => nativeClearInterval(id));
          timeouts.forEach((id) => nativeClearTimeout(id));
          intervals.clear();
          timeouts.clear();
          if (window.FireballFX && typeof window.FireballFX.stop === "function") {
            try { window.FireballFX.stop(); } catch {}
          }
          document.body.innerHTML = "";
        };
        nativeSetTimeout(stop, stopAfterMs);
      })();
    </script>
  `;
  return `<!doctype html><html><head><meta charset="utf-8"/><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;}*{box-sizing:border-box;}canvas,img,svg{max-width:100%;max-height:100%;}</style><style>${css}</style></head><body>${html}${safetyScript}${js ? `<script>${js}</script>` : ""}</body></html>`;
}

function hashSeed(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickBattlePulseEffect(effects: BattlePulseEffect[], seed: number) {
  if (!effects.length) return null;
  const index = Math.abs(seed) % effects.length;
  return effects[index];
}

function effectTypesFor(effect: BattlePulseEffect) {
  const raw = String(effect.effect_types ?? effect.effect_type ?? "attack");
  return raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function flashTypeToEffectType(type: string) {
  if (type === "BLOCKED") return "block";
  if (type === "COUNTER ATTACK") return "counter";
  if (type === "HIT") return "attack";
  return "attack";
}

function pickBattlePulseEffectByType(effects: BattlePulseEffect[], type: string, seed: number) {
  if (!effects.length) return null;
  const target = String(type || "attack").toLowerCase();
  const filtered = effects.filter((effect) => effectTypesFor(effect).includes(target));
  if (filtered.length) {
    const index = Math.abs(seed) % filtered.length;
    return filtered[index];
  }
  return null;
}

function BattleAttackFx({
  effect,
  hitAt,
}: {
  effect?: BattlePulseEffect | null;
  hitAt?: number;
}) {
  if (!effect || !hitAt) return null;
  const srcDoc = useMemo(() => buildBattleFxDoc(effect), [effect?.key, effect?.html, effect?.css, effect?.js, hitAt]);
  return (
    <iframe
      title={`battle-effect-${effect.key}-${hitAt}`}
      srcDoc={srcDoc}
      sandbox="allow-scripts"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        border: "none",
        background: "transparent",
        pointerEvents: "none",
      }}
    />
  );
}

export default function BattlePulseDisplay() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authOk, setAuthOk] = useState(false);
  const [displayEnabled, setDisplayEnabled] = useState(true);
  const [msg, setMsg] = useState("");
  const [battles, setBattles] = useState<BattleRow[]>([]);
  const [musicKey, setMusicKey] = useState<string | null>(null);
  const [effectConfigByKey, setEffectConfigByKey] = useState<Record<string, { config?: any; render_mode?: string | null; html?: string | null; css?: string | null; js?: string | null }>>({});
  const [battlePulseEffects, setBattlePulseEffects] = useState<BattlePulseEffect[]>([]);
  const [cornerOffsets, setCornerOffsets] = useState({ x: -10, y: -10, size: 72 });
  const [plateOffsets, setPlateOffsets] = useState({ x: 0, y: 0, size: 200 });
  const router = useRouter();
  const playingRef = useRef(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const musicTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const musicEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevActiveRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!mounted) return;
        if (!data?.ok) {
          router.push("/login?next=/display/battle-pulse");
          return;
        }
        const role = String(data?.role ?? "").toLowerCase();
        if (role !== "display" && role !== "admin") {
          setAuthOk(false);
        } else {
          setAuthOk(true);
        }
      } catch {
        if (mounted) router.push("/login?next=/display/battle-pulse");
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
      try {
        const res = await fetch("/api/display/settings", { cache: "no-store" });
        const data = await safeJson(res);
        if (!mounted) return;
        if (!data.ok) throw new Error(data.json?.error || "Failed to load display settings");
        const enabled = data.json?.settings?.battle_pulse_enabled !== false;
        setDisplayEnabled(enabled);
        if (!enabled) setMsg("Battle Pulse display disabled by admin.");
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
      const res = await fetch("/api/battle-pulse-effects/list", { cache: "no-store" });
      const data = await safeJson(res);
      if (!mounted || !data.ok) return;
      const list = (data.json?.effects ?? []) as BattlePulseEffect[];
      setBattlePulseEffects(list.filter((row) => row.enabled !== false));
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
          x: Number(data.settings.x ?? 0),
          y: Number(data.settings.y ?? 0),
          size: Number(data.settings.size ?? 200),
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
      const res = await fetch("/api/sound-effects/list", { cache: "no-store" });
      const sj = await safeJson(res);
      if (!sj.ok) return;
      const effects = (sj.json?.effects ?? []) as SoundEffect[];
      const map: Record<string, { url: string; volume: number; loop?: boolean }> = {};
      effects.forEach((e) => {
        if (!e.key || !e.audio_url) return;
        map[e.key] = { url: e.audio_url, volume: Number(e.volume ?? 1), loop: e.loop ?? true };
      });
      setGlobalSounds(map);
      if (!mounted) return;
      if (effects.some((e) => e.key === "battle_pulse_music")) {
        setMusicKey("battle_pulse_music");
      } else {
        setMusicKey(null);
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
        const res = await fetch("/api/skill-tracker/battle/list", { cache: "no-store" });
        const data = await safeJson(res);
        if (!mounted || !data.ok) return;
        setBattles((data.json?.battles ?? []) as BattleRow[]);
      } catch {
        if (!mounted) return;
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
        .channel("display-battle-pulse")
        .on("postgres_changes", { event: "*", schema: "public", table: "battle_tracker_logs" }, scheduleRefresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "battle_trackers" }, scheduleRefresh)
        .subscribe();
    };
    setupChannel();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);
      setupChannel();
      scheduleRefresh();
    });
    load();
    timer = window.setInterval(load, 12000);
    return () => {
      mounted = false;
      if (timer) window.clearInterval(timer);
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      if (authListener?.subscription) authListener.subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, [authOk, displayEnabled]);

  const displayCards = useMemo(() => {
    const list = battles.slice(0, 3).map((b) => ({ ...b, kind: "battle" as const }));
    while (list.length < 3) {
      list.push({ kind: "placeholder", id: `placeholder-${list.length}` });
    }
    return list as DisplayCard[];
  }, [battles]);

  const hasActiveBattles = useMemo(
    () => battles.some((b) => !isBattleDisplayDone(b)),
    [battles]
  );

  useEffect(() => {
    if (!authOk || !displayEnabled || !musicKey) return;
    if (hasActiveBattles) {
      if (musicEndTimerRef.current) {
        window.clearTimeout(musicEndTimerRef.current);
        musicEndTimerRef.current = null;
      }
      if (!prevActiveRef.current) {
        playGlobalSfx("battle_pulse_start");
        if (musicTimerRef.current) window.clearTimeout(musicTimerRef.current);
        musicTimerRef.current = window.setTimeout(() => {
          playGlobalMusic(musicKey);
          playingRef.current = true;
        }, 420);
      } else if (!playingRef.current) {
        playGlobalMusic(musicKey);
        playingRef.current = true;
      }
    } else if (prevActiveRef.current) {
      playGlobalSfx("battle_pulse_end");
      if (musicTimerRef.current) window.clearTimeout(musicTimerRef.current);
      if (musicEndTimerRef.current) window.clearTimeout(musicEndTimerRef.current);
      musicEndTimerRef.current = window.setTimeout(() => {
        fadeOutGlobalMusic(1200);
        playingRef.current = false;
      }, 1200);
    }
    prevActiveRef.current = hasActiveBattles;
  }, [authOk, hasActiveBattles, musicKey]);

  useEffect(() => {
    return () => {
      if (musicTimerRef.current) window.clearTimeout(musicTimerRef.current);
      if (musicEndTimerRef.current) window.clearTimeout(musicEndTimerRef.current);
      if (playingRef.current) {
        fadeOutGlobalMusic(1200);
      }
    };
  }, []);

  if (!authChecked) return <div style={{ opacity: 0.7, padding: 20 }}>Loading…</div>;
  if (!authOk) return <div style={{ opacity: 0.7, padding: 20 }}>Display or admin login only.</div>;
  if (!displayEnabled) return <div style={{ opacity: 0.7, padding: 20 }}>{msg || "Battle Pulse display disabled."}</div>;

  return (
    <main className="battle-page">
      <div className="battle-backdrop" />
      <div className="battle-sparks" />
      <nav className="battle-nav">
        <div className="battle-nav-label">Display</div>
        <a href="/display">Live</a>
        <a href="/display/skill-pulse">Skill Pulse</a>
        <a href="/display/battle-pulse" aria-current="page">
          Battle Pulse
        </a>
      </nav>
      <section className="battle-grid">
        <div className="battle-grid-lines" />
        <div className="battle-grid-clash" />
        {displayCards.map((card, index) =>
          card.kind === "placeholder" ? (
            <div key={card.id} className="battle-card placeholder">
              <div className="battle-card-inner">
                <div className="battle-card-title">Awaiting Battle</div>
                <div className="battle-card-sub">Queue another pulse to fill this slot.</div>
                <div className="battle-vs-glow">VS</div>
              </div>
            </div>
          ) : (
            <BattleCard
              key={card.id}
              battle={card}
              position={index}
              effectConfigByKey={effectConfigByKey}
              battlePulseEffects={battlePulseEffects}
              cornerOffsets={cornerOffsets}
              plateOffsets={plateOffsets}
            />
          )
        )}
      </section>
      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Rajdhani:wght@400;600;700&display=swap");
      `}</style>
      <style jsx>{`
        .battle-page {
          min-height: 100vh;
          background: radial-gradient(circle at top, rgba(249, 115, 22, 0.18), rgba(2, 6, 23, 0.95));
          color: white;
          display: grid;
          grid-template-rows: auto 1fr;
          gap: 20px;
          padding: 28px 36px 40px;
          position: relative;
          overflow: hidden;
          font-family: "Rajdhani", "Trebuchet MS", sans-serif;
        }

        .battle-backdrop {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 20% 20%, rgba(59, 130, 246, 0.2), transparent 50%),
            radial-gradient(circle at 80% 30%, rgba(248, 113, 113, 0.2), transparent 45%),
            radial-gradient(circle at 50% 90%, rgba(251, 146, 60, 0.18), transparent 45%);
          opacity: 0.75;
          animation: backdropPulse 12s ease-in-out infinite;
          z-index: 0;
        }

        .battle-sparks {
          position: absolute;
          inset: -40%;
          background-image: radial-gradient(rgba(255, 255, 255, 0.12) 1px, transparent 1px),
            radial-gradient(rgba(251, 146, 60, 0.2) 1px, transparent 1px);
          background-size: 120px 120px, 240px 240px;
          animation: sparksDrift 18s linear infinite;
          opacity: 0.35;
          z-index: 0;
        }

        .battle-nav {
          position: relative;
          z-index: 2;
          display: inline-flex;
          align-items: center;
          gap: 12px;
          padding: 10px 16px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.18);
          backdrop-filter: blur(14px);
          font-weight: 700;
          letter-spacing: 0.5px;
          max-width: fit-content;
        }

        .battle-nav-label {
          font-family: "Bebas Neue", "Impact", sans-serif;
          font-size: 18px;
          letter-spacing: 2px;
          color: rgba(255, 255, 255, 0.7);
        }

        .battle-nav a {
          color: white;
          text-decoration: none;
          padding: 6px 12px;
          border-radius: 999px;
          border: 1px solid transparent;
          transition: border-color 0.2s ease, background 0.2s ease;
        }

        .battle-nav a[aria-current="page"] {
          background: linear-gradient(120deg, rgba(251, 146, 60, 0.55), rgba(248, 113, 113, 0.35));
          border-color: rgba(255, 255, 255, 0.35);
          box-shadow: 0 0 18px rgba(248, 113, 113, 0.45);
        }

        .battle-grid {
          position: relative;
          z-index: 2;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 24px;
          align-items: stretch;
        }

        .battle-grid-lines {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(
              to right,
              transparent 32%,
              rgba(255, 255, 255, 0.12) 33%,
              rgba(255, 255, 255, 0.12) 34%,
              transparent 35%
            ),
            linear-gradient(
              to right,
              transparent 65%,
              rgba(255, 255, 255, 0.12) 66%,
              rgba(255, 255, 255, 0.12) 67%,
              transparent 68%
            );
          opacity: 0.7;
        }

        .battle-grid-clash {
          position: absolute;
          inset: 20% 0;
          pointer-events: none;
          background: radial-gradient(circle, rgba(251, 146, 60, 0.18), transparent 60%),
            radial-gradient(circle, rgba(56, 189, 248, 0.15), transparent 55%);
          animation: clashWave 2.8s ease-in-out infinite;
          opacity: 0.6;
        }

        .battle-card {
          position: relative;
          border-radius: 24px;
          padding: 18px;
          background: linear-gradient(145deg, rgba(15, 23, 42, 0.9), rgba(2, 6, 23, 0.92));
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          overflow: hidden;
          min-height: 420px;
          aspect-ratio: 1 / 1;
          --accent: rgba(251, 146, 60, 0.4);
          --accent2: rgba(248, 113, 113, 0.35);
        }

        .battle-card::before {
          content: "";
          position: absolute;
          inset: -60%;
          background: conic-gradient(from 120deg, var(--accent), rgba(96, 165, 250, 0.4), var(--accent2));
          opacity: 0.25;
          animation: cardSpin 16s linear infinite;
        }

        .battle-card::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 24px;
          border: 2px solid rgba(255, 255, 255, 0.12);
          box-shadow: inset 0 0 18px var(--accent), 0 0 24px var(--accent2);
          pointer-events: none;
        }

        .battle-card.theme-0 {
          --accent: rgba(251, 146, 60, 0.45);
          --accent2: rgba(248, 113, 113, 0.4);
        }

        .battle-card.theme-1 {
          --accent: rgba(56, 189, 248, 0.5);
          --accent2: rgba(59, 130, 246, 0.35);
        }

        .battle-card.theme-2 {
          --accent: rgba(163, 230, 53, 0.5);
          --accent2: rgba(34, 197, 94, 0.35);
        }

        .battle-card-inner {
          position: relative;
          z-index: 2;
          height: 100%;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .battle-card.placeholder {
          display: grid;
          place-items: center;
          text-align: center;
          color: rgba(255, 255, 255, 0.7);
        }

        .battle-card-title {
          font-family: "Bebas Neue", "Impact", sans-serif;
          font-size: 34px;
          letter-spacing: 2px;
        }

        .battle-card-sub {
          font-size: 15px;
          opacity: 0.65;
        }

        .battle-vs-glow {
          margin-top: 30px;
          font-family: "Bebas Neue", "Impact", sans-serif;
          font-size: 90px;
          letter-spacing: 4px;
          color: #fb923c;
          text-shadow: 0 0 26px rgba(251, 146, 60, 0.6), 0 0 50px rgba(248, 113, 113, 0.6);
          animation: vsFlicker 1.8s ease-in-out infinite;
        }

        @keyframes backdropPulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.6;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.9;
          }
        }

        @keyframes sparksDrift {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(120px, -160px, 0);
          }
        }

        @keyframes cardSpin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        @keyframes vsFlicker {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.08);
          }
        }

        @keyframes clashWave {
          0%,
          100% {
            transform: scale(0.98);
            opacity: 0.4;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.8;
          }
        }

        @media (max-width: 1200px) {
          .battle-grid {
            grid-template-columns: 1fr;
          }
          .battle-card {
            min-height: 420px;
          }
        }
      `}</style>
    </main>
  );
}

function BattleCard({
  battle,
  position,
  effectConfigByKey,
  battlePulseEffects,
  cornerOffsets,
  plateOffsets,
}: {
  battle: BattleRow;
  position: number;
  effectConfigByKey: Record<string, { config?: any; render_mode?: string | null; html?: string | null; css?: string | null; js?: string | null }>;
  battlePulseEffects: BattlePulseEffect[];
  cornerOffsets: { x: number; y: number; size: number };
  plateOffsets: { x: number; y: number; size: number };
}) {
  const participants = getParticipants(battle);
  const isTeams = String(battle.battle_mode ?? "duel") === "teams";
  const isFfa = String(battle.battle_mode ?? "duel") === "ffa";
  const seedTeamA = (battle.team_a_ids ?? []).map(String);
  const seedTeamB = (battle.team_b_ids ?? []).map(String);
  const teamAIds = seedTeamA.length ? seedTeamA : participants.slice(0, Math.max(1, Math.ceil(participants.length / 2))).map((p) => p.id);
  const teamBIds = seedTeamB.length ? seedTeamB : participants.filter((p) => !teamAIds.includes(p.id)).map((p) => p.id);
  const teamA = participants.filter((p) => teamAIds.includes(p.id));
  const teamB = participants.filter((p) => teamBIds.includes(p.id));
  const teamACompact = teamA.length > 6;
  const teamBCompact = teamB.length > 6;
  const teamAColumns = teamACompact ? 3 : Math.max(1, teamA.length);
  const teamBColumns = teamBCompact ? 3 : Math.max(1, teamB.length);
  const target = Math.max(1, Number(battle.repetitions_target ?? 1));
  const teamAAttempts = teamA.reduce((sum, p) => sum + Math.max(0, Number(p.attempts ?? p.successes ?? 0)), 0);
  const teamBAttempts = teamB.reduce((sum, p) => sum + Math.max(0, Number(p.attempts ?? p.successes ?? 0)), 0);
  const teamASuccesses = teamA.reduce((sum, p) => sum + Math.max(0, Number(p.successes ?? 0)), 0);
  const teamBSuccesses = teamB.reduce((sum, p) => sum + Math.max(0, Number(p.successes ?? 0)), 0);
  const teamARemaining = Math.max(0, target * teamA.length - teamAAttempts);
  const teamBRemaining = Math.max(0, target * teamB.length - teamBAttempts);
  const teamAPotential = teamASuccesses + teamARemaining;
  const teamBPotential = teamBSuccesses + teamBRemaining;
  const participantById = new Map(participants.map((p) => [p.id, p]));
  const duelTop = participants[0];
  const duelBottom = participants[1];
  const derivedWinnerId = (() => {
    if (battle.winner_id) return String(battle.winner_id);
    if (!participants.length) return null;
    if (isTeams) {
      const hpTop = calcTeamHp(target, teamA, teamB);
      const hpBottom = calcTeamHp(target, teamB, teamA);
      if (hpTop <= 0 && hpBottom > 0) return teamB[0]?.id ?? null;
      if (hpBottom <= 0 && hpTop > 0) return teamA[0]?.id ?? null;
      return null;
    }
    if (!isFfa && duelTop && duelBottom) {
      const hpTop = calcHp(target, duelTop, duelBottom);
      const hpBottom = calcHp(target, duelBottom, duelTop);
      if (hpTop <= 0 && hpBottom > 0) return duelBottom.id;
      if (hpBottom <= 0 && hpTop > 0) return duelTop.id;
      return null;
    }
    if (isFfa) {
      if (!participants.length) return null;
      const hpRawById = new Map<string, number>();
      participants.forEach((p) => hpRawById.set(p.id, calcFfaHpRaw(target, participants, p)));
      const alive = [...hpRawById.entries()].filter(([, hp]) => hp > 0);
      if (alive.length === 1) return alive[0][0];
      return null;
    }
    return null;
  })();
  const winnerId = derivedWinnerId;
  const winnerIsTopTeam = winnerId ? teamAIds.includes(winnerId) : false;
  const winnerIsBottomTeam = winnerId ? teamBIds.includes(winnerId) : false;
  const derivedMvpIds = (() => {
    if (!isTeams) return [];
    if (Array.isArray(battle.mvp_ids) && battle.mvp_ids.length) return battle.mvp_ids.map(String);
    if (!participants.length) return [];
    const minRate = 0.6;
    const pickMvps = (team: BattleParticipant[]) => {
      const qualified = team.filter((p) => {
        const attempts = Math.max(0, Number(p.attempts ?? 0));
        const successes = Math.max(0, Number(p.successes ?? 0));
        if (attempts <= 0) return false;
        return successes / attempts >= minRate;
      });
      if (!qualified.length) return [];
      const top = qualified.reduce((best, p) => {
        const successes = Number(p.successes ?? 0);
        const attempts = Math.max(0, Number(p.attempts ?? 0));
        const rate = attempts > 0 ? successes / attempts : 0;
        if (!best) return { id: p.id, successes, rate };
        if (successes > best.successes) return { id: p.id, successes, rate };
        if (successes === best.successes && rate > best.rate) return { id: p.id, successes, rate };
        return best;
      }, null as null | { id: string; successes: number; rate: number });
      return top ? [top.id] : [];
    };
    return [...pickMvps(teamA), ...pickMvps(teamB)];
  })();
  const mvpIds = derivedMvpIds;
  const pointsDeltaById = new Map<string, number>(
    Object.entries(battle.points_delta_by_id ?? {}).map(([key, value]) => [String(key), Number(value)])
  );
  const pointsDeltaByIdDisplay = (() => {
    if (!isTeams) return pointsDeltaById;
    const teamASuccesses = teamA.reduce((sum, p) => sum + Number(p.successes ?? 0), 0);
    const teamBSuccesses = teamB.reduce((sum, p) => sum + Number(p.successes ?? 0), 0);
    const wagerAmount = Math.max(0, Number((battle as any).wager_amount ?? 0));
    const lead = Math.abs(teamASuccesses - teamBSuccesses);
    const pointsPerRep = Math.max(3, Number((battle as any).points_per_rep ?? (battle as any).wager_pct ?? 5));
    const payoutTotal = wagerAmount > 0 ? wagerAmount * participants.length : lead * pointsPerRep;
    const winnerIds = (() => {
      if (battle.winner_id) {
        const winner = String(battle.winner_id);
        if (teamAIds.includes(winner)) return teamAIds;
        if (teamBIds.includes(winner)) return teamBIds;
      }
      if (teamASuccesses === teamBSuccesses) return [];
      return teamASuccesses > teamBSuccesses ? teamAIds : teamBIds;
    })();
    const loserIds = winnerIds.length ? participants.map((p) => p.id).filter((id) => !winnerIds.includes(id)) : [];
    const perWinner = wagerAmount > 0 ? wagerAmount : winnerIds.length ? Math.floor(payoutTotal / Math.max(1, winnerIds.length)) : 0;
    const perLoser = wagerAmount > 0 ? wagerAmount : loserIds.length ? Math.floor(payoutTotal / Math.max(1, loserIds.length)) : 0;
    const computed = new Map<string, number>();
    participants.forEach((p) => {
      if (!winnerIds.length || payoutTotal <= 0) {
        computed.set(p.id, 0);
        return;
      }
      if (winnerIds.includes(p.id)) {
        let earned = perWinner;
        if (mvpIds.includes(p.id) && earned > 0) earned += perWinner;
        computed.set(p.id, earned);
      } else {
        let loss = -perLoser;
        if (mvpIds.includes(p.id)) loss = Math.min(0, loss + 10);
        computed.set(p.id, loss);
      }
    });
    return computed;
  })();
  const battleDone = !!battle.settled_at;
  const [winnerReveal, setWinnerReveal] = useState(false);
  const winnerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (winnerTimer.current) {
      window.clearTimeout(winnerTimer.current);
      winnerTimer.current = null;
    }
    setWinnerReveal(false);
    if (!winnerId) return;
    winnerTimer.current = window.setTimeout(() => {
      setWinnerReveal(true);
      if (!playGlobalSfx("battle_pulse_winner")) playGlobalSfx("battle_pulse_win");
    }, 1200);
    return () => {
      if (winnerTimer.current) {
        window.clearTimeout(winnerTimer.current);
        winnerTimer.current = null;
      }
    };
  }, [winnerId]);
  const [hitById, setHitById] = useState<Record<string, number>>({});
  const [teamHit, setTeamHit] = useState<{ top?: number; bottom?: number }>({});
  const [flashById, setFlashById] = useState<Record<string, { type: string; at: number }>>({});
  const [teamFlash, setTeamFlash] = useState<{ top?: { type: string; at: number }; bottom?: { type: string; at: number } }>({});
  const [attackFxById, setAttackFxById] = useState<Record<string, { type: string; at: number }>>({});
  const [teamAttackFx, setTeamAttackFx] = useState<{ top?: { type: string; at: number }; bottom?: { type: string; at: number } }>({});
  const [drainFxById, setDrainFxById] = useState<Record<string, number>>({});
  const [teamDrainFx, setTeamDrainFx] = useState<{ top?: number; bottom?: number }>({});
  const [displayHpById, setDisplayHpById] = useState<Record<string, number>>({});
  const [displayTeamHp, setDisplayTeamHp] = useState<{ top?: number; bottom?: number }>({});
  const hitTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const teamHitTimers = useRef(new Map<"top" | "bottom", ReturnType<typeof setTimeout>>());
  const attackFxTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const teamAttackFxTimers = useRef(new Map<"top" | "bottom", ReturnType<typeof setTimeout>>());
  const drainFxTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const teamDrainFxTimers = useRef(new Map<"top" | "bottom", ReturnType<typeof setTimeout>>());
  const drainFxStartTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const teamDrainFxStartTimers = useRef(new Map<"top" | "bottom", ReturnType<typeof setTimeout>>());
  const attackFxAtRef = useRef(new Map<string, number>());
  const teamAttackFxAtRef = useRef<{ top?: number; bottom?: number }>({});
  const lastEffectAtGlobalRef = useRef(0);
  const teamTopEffect = teamAttackFx.top
    ? pickBattlePulseEffectByType(
        battlePulseEffects,
        flashTypeToEffectType(teamAttackFx.top.type),
        teamAttackFx.top.at + hashSeed("team-top")
      )
    : null;
  const teamBottomEffect = teamAttackFx.bottom
    ? pickBattlePulseEffectByType(
        battlePulseEffects,
        flashTypeToEffectType(teamAttackFx.bottom.type),
        teamAttackFx.bottom.at + hashSeed("team-bottom")
      )
    : null;
  const teamTopDrainEffect = teamDrainFx.top
    ? pickBattlePulseEffectByType(battlePulseEffects, "drain", teamDrainFx.top + hashSeed("team-top-drain"))
    : null;
  const teamBottomDrainEffect = teamDrainFx.bottom
    ? pickBattlePulseEffectByType(battlePulseEffects, "drain", teamDrainFx.bottom + hashSeed("team-bottom-drain"))
    : null;
  const prevAttemptsRef = useRef(new Map<string, number>());
  const prevStatsRef = useRef(new Map<string, { attempts: number; successes: number }>());
  const prevHpTargetById = useRef(new Map<string, number>());
  const prevTeamHpTarget = useRef<{ top?: number; bottom?: number }>({});
  const prevFfaHpRaw = useRef(new Map<string, number>());
  const hpTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const teamHpTimers = useRef(new Map<"top" | "bottom", ReturnType<typeof setTimeout>>());
  const flashTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const teamFlashTimers = useRef(new Map<"top" | "bottom", ReturnType<typeof setTimeout>>());

  const triggerHit = (id: string) => {
    setHitById((prev) => ({ ...prev, [id]: Date.now() }));
    const timer = hitTimers.current.get(id);
    if (timer) window.clearTimeout(timer);
    hitTimers.current.set(
      id,
      window.setTimeout(() => {
        setHitById((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        hitTimers.current.delete(id);
      }, 900)
    );
  };

  const triggerTeamHit = (side: "top" | "bottom") => {
    setTeamHit((prev) => ({ ...prev, [side]: Date.now() }));
    const timer = teamHitTimers.current.get(side);
    if (timer) window.clearTimeout(timer);
    teamHitTimers.current.set(
      side,
      window.setTimeout(() => {
        setTeamHit((prev) => {
          const next = { ...prev };
          delete next[side];
          return next;
        });
        teamHitTimers.current.delete(side);
      }, 980)
    );
  };

  const reschedulePendingDrainStarts = () => {
    const delay = Math.max(0, lastEffectAtGlobalRef.current + 3000 - Date.now());
    drainFxStartTimers.current.forEach((timer, id) => {
      window.clearTimeout(timer);
      drainFxStartTimers.current.set(
        id,
        window.setTimeout(() => {
          const at = Date.now();
          setDrainFxById((prev) => ({ ...prev, [id]: at }));
          drainFxStartTimers.current.delete(id);
          const fxTimer = drainFxTimers.current.get(id);
          if (fxTimer) window.clearTimeout(fxTimer);
          drainFxTimers.current.set(
            id,
            window.setTimeout(() => {
              setDrainFxById((prev) => {
                const next = { ...prev };
                delete next[id];
                return next;
              });
              drainFxTimers.current.delete(id);
            }, 3000)
          );
        }, delay)
      );
    });
    teamDrainFxStartTimers.current.forEach((timer, side) => {
      window.clearTimeout(timer);
      teamDrainFxStartTimers.current.set(
        side,
        window.setTimeout(() => {
          const at = Date.now();
          setTeamDrainFx((prev) => ({ ...prev, [side]: at }));
          teamDrainFxStartTimers.current.delete(side);
          const fxTimer = teamDrainFxTimers.current.get(side);
          if (fxTimer) window.clearTimeout(fxTimer);
          teamDrainFxTimers.current.set(
            side,
            window.setTimeout(() => {
              setTeamDrainFx((prev) => {
                const next = { ...prev };
                delete next[side];
                return next;
              });
              teamDrainFxTimers.current.delete(side);
            }, 3000)
          );
        }, delay)
      );
    });
  };

  const triggerAttackFx = (id: string, type: string) => {
    const at = Date.now();
    attackFxAtRef.current.set(id, at);
    lastEffectAtGlobalRef.current = Math.max(lastEffectAtGlobalRef.current, at);
    setAttackFxById((prev) => ({ ...prev, [id]: { type, at } }));
    const timer = attackFxTimers.current.get(id);
    if (timer) window.clearTimeout(timer);
    const duration = 3000;
    attackFxTimers.current.set(
      id,
      window.setTimeout(() => {
        setAttackFxById((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        attackFxTimers.current.delete(id);
      }, duration)
    );
    reschedulePendingDrainStarts();
  };

  const triggerTeamAttackFx = (side: "top" | "bottom", type: string) => {
    const at = Date.now();
    teamAttackFxAtRef.current = { ...teamAttackFxAtRef.current, [side]: at };
    lastEffectAtGlobalRef.current = Math.max(lastEffectAtGlobalRef.current, at);
    setTeamAttackFx((prev) => ({ ...prev, [side]: { type, at } }));
    const timer = teamAttackFxTimers.current.get(side);
    if (timer) window.clearTimeout(timer);
    const duration = 3000;
    teamAttackFxTimers.current.set(
      side,
      window.setTimeout(() => {
        setTeamAttackFx((prev) => {
          const next = { ...prev };
          delete next[side];
          return next;
        });
        teamAttackFxTimers.current.delete(side);
      }, duration)
    );
    reschedulePendingDrainStarts();
  };

  const triggerDrainFx = (id: string) => {
    const startTimer = drainFxStartTimers.current.get(id);
    if (startTimer) window.clearTimeout(startTimer);
    drainFxStartTimers.current.set(
      id,
      window.setTimeout(() => {
        const at = Date.now();
        setDrainFxById((prev) => ({ ...prev, [id]: at }));
        drainFxStartTimers.current.delete(id);
        const timer = drainFxTimers.current.get(id);
        if (timer) window.clearTimeout(timer);
        drainFxTimers.current.set(
          id,
          window.setTimeout(() => {
            setDrainFxById((prev) => {
              const next = { ...prev };
              delete next[id];
              return next;
            });
            drainFxTimers.current.delete(id);
          }, 3000)
        );
      }, Math.max(0, lastEffectAtGlobalRef.current + 3000 - Date.now()))
    );
  };

  const triggerTeamDrainFx = (side: "top" | "bottom") => {
    const startTimer = teamDrainFxStartTimers.current.get(side);
    if (startTimer) window.clearTimeout(startTimer);
    teamDrainFxStartTimers.current.set(
      side,
      window.setTimeout(() => {
        const at = Date.now();
        setTeamDrainFx((prev) => ({ ...prev, [side]: at }));
        teamDrainFxStartTimers.current.delete(side);
        const timer = teamDrainFxTimers.current.get(side);
        if (timer) window.clearTimeout(timer);
        teamDrainFxTimers.current.set(
          side,
          window.setTimeout(() => {
            setTeamDrainFx((prev) => {
              const next = { ...prev };
              delete next[side];
              return next;
            });
            teamDrainFxTimers.current.delete(side);
          }, 3000)
        );
      }, Math.max(0, lastEffectAtGlobalRef.current + 3000 - Date.now()))
    );
  };

  const triggerFlash = (id: string, type: string) => {
    setFlashById((prev) => ({ ...prev, [id]: { type, at: Date.now() } }));
    window.setTimeout(() => {
      triggerAttackFx(id, type);
    }, 80);
    const timer = flashTimers.current.get(id);
    if (timer) window.clearTimeout(timer);
    flashTimers.current.set(
      id,
      window.setTimeout(() => {
        setFlashById((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        flashTimers.current.delete(id);
      }, 1600)
    );
  };

  const triggerTeamFlash = (side: "top" | "bottom", type: string) => {
    setTeamFlash((prev) => ({ ...prev, [side]: { type, at: Date.now() } }));
    window.setTimeout(() => {
      triggerTeamAttackFx(side, type);
    }, 80);
    const timer = teamFlashTimers.current.get(side);
    if (timer) window.clearTimeout(timer);
    teamFlashTimers.current.set(
      side,
      window.setTimeout(() => {
        setTeamFlash((prev) => {
          const next = { ...prev };
          delete next[side];
          return next;
        });
        teamFlashTimers.current.delete(side);
      }, 1600)
    );
  };

  useEffect(() => {
    const next = new Map<string, number>();
    const nextHp: Record<string, number> = {};
    const nextHpTargetById = new Map<string, number>();
    participants.forEach((p) => {
      const isWinner = battle.winner_id && String(battle.winner_id) === String(p.id);
      const baseHp = isFfa ? calcFfaHp(target, participants, p) : calcHp(target, p, participants.find((x) => x.id !== p.id));
      nextHpTargetById.set(p.id, baseHp);
      nextHp[p.id] = battle.winner_id && !isWinner ? 0 : baseHp;
    });
    const nextTeamHp = {
      top: teamA.length ? calcTeamHp(target, teamA, teamB) : undefined,
      bottom: teamB.length ? calcTeamHp(target, teamB, teamA) : undefined,
    };
    if (battle.winner_id && isTeams) {
      const winnerOnTop = teamAIds.includes(String(battle.winner_id));
      if (winnerOnTop) nextTeamHp.bottom = 0;
      if (!winnerOnTop && teamBIds.includes(String(battle.winner_id))) nextTeamHp.top = 0;
    }

    participants.forEach((p) => {
      const attempts = Number(p.attempts ?? p.successes ?? 0);
      const successes = Number(p.successes ?? 0);
      const prevStat = prevStatsRef.current.get(p.id) ?? { attempts, successes };
      const prevAttempts = prevAttemptsRef.current.get(p.id) ?? attempts;
      const attemptDelta = attempts - prevAttempts;
      if (attemptDelta > 0) {
        const wasSuccess = successes > prevStat.successes;
        playGlobalSfx("battle_pulse_cast");
        if (isTeams) {
          const inTop = teamAIds.includes(p.id);
          const opponentSide = inTop ? "bottom" : "top";
          const ownSide = inTop ? "top" : "bottom";
          const prevOppHp = prevTeamHpTarget.current[opponentSide] ?? nextTeamHp[opponentSide];
          const prevOwnHp = prevTeamHpTarget.current[ownSide] ?? nextTeamHp[ownSide];
          const oppHpNow = nextTeamHp[opponentSide];
          const ownHpNow = nextTeamHp[ownSide];
          triggerTeamHit(opponentSide);
          if (wasSuccess) {
            window.setTimeout(() => {
              if (oppHpNow != null && prevOppHp != null && oppHpNow < prevOppHp) {
                triggerTeamFlash(opponentSide, "HIT");
                playGlobalSfx("battle_pulse_hit");
              } else {
                triggerTeamFlash(opponentSide, "BLOCKED");
                playGlobalSfx("battle_pulse_block");
              }
            }, 260);
          } else {
            window.setTimeout(() => {
              triggerTeamFlash(opponentSide, "BLOCKED");
              playGlobalSfx("battle_pulse_block");
            }, 260);
            if (ownHpNow != null && prevOwnHp != null && ownHpNow < prevOwnHp) {
              window.setTimeout(() => {
                triggerTeamHit(ownSide);
                triggerTeamFlash(ownSide, "COUNTER ATTACK");
                playGlobalSfx("battle_pulse_counter");
              }, 900);
            }
          }
        } else if (!isFfa && duelTop?.id && duelBottom?.id) {
          const opponentId = p.id === duelTop.id ? duelBottom.id : duelTop.id;
          const prevOppHp = prevHpTargetById.current.get(opponentId) ?? nextHpTargetById.get(opponentId) ?? 0;
          const prevOwnHp = prevHpTargetById.current.get(p.id) ?? nextHpTargetById.get(p.id) ?? 0;
          const oppHpNow = nextHpTargetById.get(opponentId) ?? 0;
          const ownHpNow = nextHpTargetById.get(p.id) ?? 0;
          triggerHit(opponentId);
          if (wasSuccess) {
            window.setTimeout(() => {
              if (oppHpNow < prevOppHp) {
                triggerFlash(opponentId, "HIT");
                playGlobalSfx("battle_pulse_hit");
              } else {
                triggerFlash(opponentId, "BLOCKED");
                playGlobalSfx("battle_pulse_block");
              }
            }, 260);
          } else {
            window.setTimeout(() => {
              triggerFlash(opponentId, "BLOCKED");
              playGlobalSfx("battle_pulse_block");
            }, 260);
            if (ownHpNow < prevOwnHp) {
              window.setTimeout(() => {
                triggerHit(p.id);
                triggerFlash(p.id, "COUNTER ATTACK");
                playGlobalSfx("battle_pulse_counter");
              }, 900);
            }
          }
        } else {
          const prevRaw = prevFfaHpRaw.current;
          const nextRaw = new Map<string, number>();
          participants.forEach((entry) => {
            nextRaw.set(entry.id, calcFfaHpRaw(target, participants, entry));
          });
          const ownPrev = prevRaw.get(p.id) ?? nextRaw.get(p.id) ?? 0;
          const ownNow = nextRaw.get(p.id) ?? 0;
          const opponentIds = participants.map((entry) => entry.id).filter((id) => id !== p.id);
          if (wasSuccess) {
            const hitTargets = opponentIds.filter((id) => {
              const prevHp = prevRaw.get(id) ?? nextRaw.get(id) ?? 0;
              const nextHp = nextRaw.get(id) ?? 0;
              return nextHp < prevHp;
            });
            hitTargets.forEach((id) => triggerHit(id));
            window.setTimeout(() => {
              if (hitTargets.length) {
                hitTargets.forEach((id) => triggerFlash(id, "HIT"));
                playGlobalSfx("battle_pulse_hit");
              } else {
                opponentIds.forEach((id) => triggerFlash(id, "BLOCKED"));
                playGlobalSfx("battle_pulse_block");
              }
            }, 260);
          } else {
            opponentIds.forEach((id) => triggerHit(id));
            window.setTimeout(() => {
              opponentIds.forEach((id) => triggerFlash(id, "BLOCKED"));
              playGlobalSfx("battle_pulse_block");
            }, 260);
            if (ownNow < ownPrev) {
              window.setTimeout(() => {
                triggerHit(p.id);
                triggerFlash(p.id, "COUNTER ATTACK");
                playGlobalSfx("battle_pulse_counter");
              }, 900);
            }
          }
          prevFfaHpRaw.current = nextRaw;
        }
      }
      next.set(p.id, attempts);
      prevStatsRef.current.set(p.id, { attempts, successes });
    });
    prevAttemptsRef.current = next;
    prevHpTargetById.current = nextHpTargetById;
    prevTeamHpTarget.current = { ...nextTeamHp };
    if (isFfa) {
      const nextRaw = new Map<string, number>();
      participants.forEach((entry) => {
        nextRaw.set(entry.id, calcFfaHpRaw(target, participants, entry));
      });
      prevFfaHpRaw.current = nextRaw;
    }
    participants.forEach((p) => {
      const targetHp = nextHp[p.id];
      const prevHp = displayHpById[p.id];
      if (typeof targetHp !== "number") return;
      if (prevHp === undefined || Math.abs(prevHp - targetHp) > 0.005) {
        const timer = hpTimers.current.get(p.id);
        if (timer) window.clearTimeout(timer);
        hpTimers.current.set(
          p.id,
          window.setTimeout(() => {
            setDisplayHpById((current) => {
              const nextState = { ...current, [p.id]: targetHp };
              return nextState;
            });
            if (prevHp !== undefined && targetHp < prevHp) {
              playGlobalSfx("battle_pulse_drain");
              triggerDrainFx(p.id);
            }
            hpTimers.current.delete(p.id);
          }, 360)
        );
      }
    });
    if (isTeams) {
      (["top", "bottom"] as const).forEach((side) => {
        const targetHp = nextTeamHp[side];
        const prevHp = displayTeamHp[side];
        if (typeof targetHp !== "number") return;
        if (prevHp === undefined || Math.abs(prevHp - targetHp) > 0.005) {
          const timer = teamHpTimers.current.get(side);
          if (timer) window.clearTimeout(timer);
          teamHpTimers.current.set(
            side,
            window.setTimeout(() => {
              setDisplayTeamHp((current) => ({ ...current, [side]: targetHp }));
              if (prevHp !== undefined && targetHp < prevHp) {
                playGlobalSfx("battle_pulse_drain");
                triggerTeamDrainFx(side);
              }
              teamHpTimers.current.delete(side);
            }, 360)
          );
        }
      });
    }
    return () => {
      hitTimers.current.forEach((timer) => window.clearTimeout(timer));
      teamHitTimers.current.forEach((timer) => window.clearTimeout(timer));
      hitTimers.current.clear();
      teamHitTimers.current.clear();
      attackFxTimers.current.forEach((timer) => window.clearTimeout(timer));
      teamAttackFxTimers.current.forEach((timer) => window.clearTimeout(timer));
      attackFxTimers.current.clear();
      teamAttackFxTimers.current.clear();
      flashTimers.current.forEach((timer) => window.clearTimeout(timer));
      teamFlashTimers.current.forEach((timer) => window.clearTimeout(timer));
      flashTimers.current.clear();
      teamFlashTimers.current.clear();
      hpTimers.current.forEach((timer) => window.clearTimeout(timer));
      teamHpTimers.current.forEach((timer) => window.clearTimeout(timer));
      hpTimers.current.clear();
      teamHpTimers.current.clear();
      drainFxTimers.current.forEach((timer) => window.clearTimeout(timer));
      teamDrainFxTimers.current.forEach((timer) => window.clearTimeout(timer));
      drainFxTimers.current.clear();
      teamDrainFxTimers.current.clear();
      drainFxStartTimers.current.forEach((timer) => window.clearTimeout(timer));
      teamDrainFxStartTimers.current.forEach((timer) => window.clearTimeout(timer));
      drainFxStartTimers.current.clear();
      teamDrainFxStartTimers.current.clear();
    };
  }, [participants, isTeams, isFfa, teamAIds, teamBIds, duelTop?.id, duelBottom?.id, battle.winner_id, displayHpById, displayTeamHp, target]);

  return (
    <div className={`battle-card theme-${position % 3}`}>
      <div className="battle-card-inner">
        <div className="battle-card-banner">
          <div className={`battle-mode ${isTeams ? "teams" : isFfa ? "ffa" : "duel"}`}>
            {isTeams ? "TEAM BATTLE" : isFfa ? "FFA" : "DUEL"}
          </div>
          <div className="battle-skill">{battle.skill_name}</div>
        </div>
        <div className={`battle-body ${isTeams ? "teams" : isFfa ? "ffa" : "duel"}`}>
          {!isTeams && !isFfa ? (
            <div className="battle-duel">
              {duelTop ? (
                <BattleSlot
                  participant={duelTop}
                  align="top"
                  variant="duel"
                  target={target}
                  effectConfigByKey={effectConfigByKey}
                  battlePulseEffects={battlePulseEffects}
                  cornerOffsets={cornerOffsets}
                  plateOffsets={plateOffsets}
                  hp={displayHpById[duelTop.id] ?? calcHp(target, duelTop, duelBottom)}
                  hitActive={!!hitById[duelTop.id]}
                  hitAt={hitById[duelTop.id]}
                  flashType={flashById[duelTop.id]?.type}
                  flashAt={flashById[duelTop.id]?.at}
                  attackFx={attackFxById[duelTop.id]}
                  drainFxAt={drainFxById[duelTop.id]}
                  isWinner={winnerReveal && winnerId === duelTop.id}
                  winnerReveal={winnerReveal}
                  isMvp={mvpIds.includes(duelTop.id)}
                  pointsDelta={pointsDeltaByIdDisplay.get(duelTop.id) ?? 0}
                  showPoints={battleDone}
                />
              ) : (
                <EmptySlot label="Challenger" />
              )}
              <div className="battle-vs-core">
                <div className="battle-vs-text">VS</div>
                <div className="battle-vs-sparks" />
                <div className="battle-clash-line" />
              </div>
              {duelBottom ? (
                <BattleSlot
                  participant={duelBottom}
                  align="bottom"
                  variant="duel"
                  target={target}
                  effectConfigByKey={effectConfigByKey}
                  battlePulseEffects={battlePulseEffects}
                  cornerOffsets={cornerOffsets}
                  plateOffsets={plateOffsets}
                  hp={displayHpById[duelBottom.id] ?? calcHp(target, duelBottom, duelTop)}
                  hitActive={!!hitById[duelBottom.id]}
                  hitAt={hitById[duelBottom.id]}
                  flashType={flashById[duelBottom.id]?.type}
                  flashAt={flashById[duelBottom.id]?.at}
                  attackFx={attackFxById[duelBottom.id]}
                  drainFxAt={drainFxById[duelBottom.id]}
                  isWinner={winnerReveal && winnerId === duelBottom.id}
                  winnerReveal={winnerReveal}
                  isMvp={mvpIds.includes(duelBottom.id)}
                  pointsDelta={pointsDeltaByIdDisplay.get(duelBottom.id) ?? 0}
                  showPoints={battleDone}
                />
              ) : (
                <EmptySlot label="Opponent" />
              )}
            </div>
          ) : null}
          {isTeams ? (
            <div className="battle-team">
              <div
                className={`battle-team-row top${teamHit.top ? " hit" : ""}${winnerIsTopTeam ? " winner" : ""}${winnerReveal && winnerIsTopTeam ? " reveal" : ""}${
                  teamACompact ? " compact" : ""
                }`}
                style={{ gridTemplateColumns: `repeat(${teamAColumns}, minmax(0, 1fr))` }}
              >
                <div className="battle-team-score">
                  <span className="battle-team-score-value">{teamASuccesses}</span>
                  <span className="battle-team-score-potential">({teamAPotential})</span>
                </div>
                {teamFlash.top ? (
                  <div
                    key={`team-flash-top-${teamFlash.top.at}`}
                    className={`battle-team-flash ${flashClass(teamFlash.top.type)}`}
                  >
                    {teamFlash.top.type}
                  </div>
                ) : null}
                {teamHit.top ? <div key={`team-hit-top-${teamHit.top}`} className="battle-team-hit" /> : null}
                {teamAttackFx.top && teamTopEffect ? (
                  <div
                    key={`team-fx-top-${teamAttackFx.top.at}`}
                    className="battle-team-attack-fx"
                    style={{
                      transform: `translate(${teamTopEffect.offset_x ?? 0}px, ${teamTopEffect.offset_y ?? 0}px)`,
                    }}
                  >
                    <BattleAttackFx effect={teamTopEffect} hitAt={teamAttackFx.top.at} />
                  </div>
                ) : null}
                {teamDrainFx.top && teamTopDrainEffect ? (
                  <div
                    key={`team-drain-top-${teamDrainFx.top}`}
                    className="battle-team-drain-fx"
                    style={{
                      transform: `translate(${teamTopDrainEffect.offset_x ?? 0}px, ${teamTopDrainEffect.offset_y ?? 0}px)`,
                    }}
                  >
                    <BattleAttackFx effect={teamTopDrainEffect} hitAt={teamDrainFx.top} />
                  </div>
                ) : null}
                {winnerReveal && winnerIsTopTeam ? <div className="battle-team-winner">Winner</div> : null}
                {teamA.length ? (
                  teamA.map((p) => (
                    <BattleSlot
                      key={p.id}
                      participant={p}
                      variant="team"
                      compact={teamACompact}
                      target={target}
                      effectConfigByKey={effectConfigByKey}
                      battlePulseEffects={battlePulseEffects}
                      cornerOffsets={cornerOffsets}
                      plateOffsets={plateOffsets}
                      hitActive={!!hitById[p.id]}
                      hitAt={hitById[p.id]}
                      flashType={flashById[p.id]?.type}
                      flashAt={flashById[p.id]?.at}
                      attackFx={attackFxById[p.id]}
                      drainFxAt={drainFxById[p.id]}
                      isWinner={winnerReveal && winnerIsTopTeam}
                      winnerReveal={winnerReveal}
                      isMvp={mvpIds.includes(p.id)}
                      pointsDelta={pointsDeltaByIdDisplay.get(p.id) ?? 0}
                      showPoints={battleDone}
                    />
                  ))
                ) : (
                  <EmptySlot label="Team A" />
                )}
                <div className="battle-team-hp">
                  <div
                    className="battle-team-hp-fill"
                    style={{ width: `${Math.round((displayTeamHp.top ?? calcTeamHp(target, teamA, teamB)) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="battle-team-mid">
                <div className="battle-vs-core">
                  <div className="battle-vs-text">VS</div>
                  <div className="battle-vs-sparks" />
                  <div className="battle-clash-line" />
                </div>
              </div>
              <div
                className={`battle-team-row bottom${teamHit.bottom ? " hit" : ""}${winnerIsBottomTeam ? " winner" : ""}${winnerReveal && winnerIsBottomTeam ? " reveal" : ""}${
                  teamBCompact ? " compact" : ""
                }`}
                style={{ gridTemplateColumns: `repeat(${teamBColumns}, minmax(0, 1fr))` }}
              >
                <div className="battle-team-score">
                  <span className="battle-team-score-value">{teamBSuccesses}</span>
                  <span className="battle-team-score-potential">({teamBPotential})</span>
                </div>
                {teamFlash.bottom ? (
                  <div
                    key={`team-flash-bottom-${teamFlash.bottom.at}`}
                    className={`battle-team-flash ${flashClass(teamFlash.bottom.type)}`}
                  >
                    {teamFlash.bottom.type}
                  </div>
                ) : null}
                {teamHit.bottom ? <div key={`team-hit-bottom-${teamHit.bottom}`} className="battle-team-hit" /> : null}
                {teamAttackFx.bottom && teamBottomEffect ? (
                  <div
                    key={`team-fx-bottom-${teamAttackFx.bottom.at}`}
                    className="battle-team-attack-fx"
                    style={{
                      transform: `translate(${teamBottomEffect.offset_x ?? 0}px, ${teamBottomEffect.offset_y ?? 0}px)`,
                    }}
                  >
                    <BattleAttackFx effect={teamBottomEffect} hitAt={teamAttackFx.bottom.at} />
                  </div>
                ) : null}
                {teamDrainFx.bottom && teamBottomDrainEffect ? (
                  <div
                    key={`team-drain-bottom-${teamDrainFx.bottom}`}
                    className="battle-team-drain-fx"
                    style={{
                      transform: `translate(${teamBottomDrainEffect.offset_x ?? 0}px, ${teamBottomDrainEffect.offset_y ?? 0}px)`,
                    }}
                  >
                    <BattleAttackFx effect={teamBottomDrainEffect} hitAt={teamDrainFx.bottom} />
                  </div>
                ) : null}
                {winnerReveal && winnerIsBottomTeam ? <div className="battle-team-winner">Winner</div> : null}
                {teamB.length ? (
                  teamB.map((p) => (
                    <BattleSlot
                      key={p.id}
                      participant={p}
                      variant="team"
                      compact={teamBCompact}
                      target={target}
                      effectConfigByKey={effectConfigByKey}
                      battlePulseEffects={battlePulseEffects}
                      cornerOffsets={cornerOffsets}
                      plateOffsets={plateOffsets}
                      hitActive={!!hitById[p.id]}
                      hitAt={hitById[p.id]}
                      flashType={flashById[p.id]?.type}
                      flashAt={flashById[p.id]?.at}
                      attackFx={attackFxById[p.id]}
                      drainFxAt={drainFxById[p.id]}
                      isWinner={winnerReveal && winnerIsBottomTeam}
                      winnerReveal={winnerReveal}
                      isMvp={mvpIds.includes(p.id)}
                      pointsDelta={pointsDeltaByIdDisplay.get(p.id) ?? 0}
                      showPoints={battleDone}
                    />
                  ))
                ) : (
                  <EmptySlot label="Team B" />
                )}
                <div className="battle-team-hp">
                  <div
                    className="battle-team-hp-fill"
                    style={{ width: `${Math.round((displayTeamHp.bottom ?? calcTeamHp(target, teamB, teamA)) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ) : null}
          {isFfa ? (
            <div className={`battle-ffa grid-${ffaGridKind(participants.length)}`}>
              <div className="battle-ffa-grid">
                {renderFfaSlots(
                  participants,
                  effectConfigByKey,
                  battlePulseEffects,
                  cornerOffsets,
                  plateOffsets,
                  target,
                  hitById,
                  flashById,
                  attackFxById,
                  drainFxById,
                  winnerReveal ? winnerId : null,
                  mvpIds,
                  winnerReveal,
                  pointsDeltaByIdDisplay,
                  battleDone
                )}
              </div>
              <div className="battle-ffa-vs-row">
                <div className="battle-vs-core">
                  <div className="battle-vs-text">VS</div>
                  <div className="battle-vs-sparks" />
                  <div className="battle-clash-line" />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <style jsx>{`
        .battle-card-banner {
          display: grid;
          gap: 8px;
          text-align: center;
        }

        .battle-mode {
          font-family: "Bebas Neue", "Impact", sans-serif;
          font-size: 20px;
          letter-spacing: 4px;
          color: rgba(255, 255, 255, 0.75);
        }

        .battle-mode.ffa {
          color: #fb923c;
        }

        .battle-mode.teams {
          color: #60a5fa;
        }

        .battle-skill {
          font-size: 26px;
          font-weight: 700;
          color: white;
          text-shadow: 0 8px 18px rgba(0, 0, 0, 0.55);
        }

        .battle-body {
          flex: 1;
          display: grid;
          gap: 12px;
          margin-top: 8px;
        }

        .battle-duel,
        .battle-team,
        .battle-ffa {
          height: 100%;
          display: grid;
          gap: 12px;
        }

        .battle-duel {
          grid-template-rows: 1fr auto 1fr;
          justify-items: center;
        }

        .battle-team {
          grid-template-rows: 1fr auto 1fr;
        }

        .battle-team-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 12px;
          align-items: center;
          position: relative;
        }

        .battle-team-row.compact {
          gap: 8px;
        }

        .battle-team-score {
          position: absolute;
          top: 10px;
          left: 12px;
          display: inline-flex;
          align-items: baseline;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.2);
          z-index: 6;
        }

        .battle-team-score-value {
          font-size: 22px;
          font-weight: 900;
          color: rgba(34, 197, 94, 0.95);
          text-shadow: 0 0 12px rgba(34, 197, 94, 0.4);
        }

        .battle-team-score-potential {
          font-size: 12px;
          opacity: 0.75;
        }

        .battle-team-row.top {
          background: linear-gradient(120deg, rgba(37, 99, 235, 0.25), transparent);
          border-radius: 18px;
          padding: 10px;
        }

        .battle-team-row.bottom {
          background: linear-gradient(120deg, rgba(248, 113, 113, 0.25), transparent);
          border-radius: 18px;
          padding: 10px;
        }

        .battle-team-row.winner {
          border: 2px solid rgba(253, 224, 71, 0.8);
          box-shadow: 0 0 24px rgba(250, 204, 21, 0.45);
        }

        .battle-team-row.winner.reveal::before {
          content: "";
          position: absolute;
          inset: -6px;
          border-radius: 22px;
          padding: 2px;
          background: conic-gradient(
            from 90deg,
            rgba(250, 204, 21, 0.2),
            rgba(253, 224, 71, 0.95),
            rgba(250, 204, 21, 0.2)
          );
          -webkit-mask:
            linear-gradient(#000 0 0) content-box,
            linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          animation: winnerTrace 3s linear forwards;
          pointer-events: none;
          z-index: 6;
        }

        .battle-team-hit {
          position: absolute;
          inset: -8px;
          border-radius: 20px;
          background: radial-gradient(circle, rgba(251, 146, 60, 0.35), transparent 65%);
          box-shadow: 0 0 25px rgba(248, 113, 113, 0.45);
          animation: battleRowFlash 780ms ease forwards;
          pointer-events: none;
          z-index: 4;
        }

        .battle-team-attack-fx {
          position: absolute;
          left: -8%;
          right: -8%;
          top: -45%;
          height: 190%;
          pointer-events: none;
          z-index: 5;
        }

        .battle-team-row.top .battle-team-attack-fx {
          top: -60%;
        }

        .battle-team-drain-fx {
          position: absolute;
          left: -6%;
          right: -6%;
          top: -30%;
          height: 170%;
          pointer-events: none;
          z-index: 4;
        }

        .battle-team-winner {
          position: absolute;
          top: 12px;
          right: 16px;
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 1px;
          text-transform: uppercase;
          background: rgba(15, 23, 42, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #fde047;
          z-index: 6;
        }

        .battle-team-flash {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          padding: 6px 14px;
          border-radius: 18px;
          font-size: 34px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          background: rgba(15, 23, 42, 0.45);
          border: 1px solid rgba(255, 255, 255, 0.12);
          z-index: 8;
          animation: battleFlashPop 1400ms ease forwards;
          pointer-events: none;
        }

        .battle-team-flash.flash-hit {
          color: #f97316;
          box-shadow: 0 0 18px rgba(249, 115, 22, 0.6);
        }

        .battle-team-flash.flash-blocked {
          color: #93c5fd;
          box-shadow: 0 0 18px rgba(147, 197, 253, 0.6);
        }

        .battle-team-flash.flash-counter {
          color: #facc15;
          box-shadow: 0 0 18px rgba(250, 204, 21, 0.6);
        }

        .battle-team-hp {
          grid-column: 1 / -1;
          height: 12px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.18);
          overflow: hidden;
          box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.45);
        }

        .battle-team-hp-fill {
          height: 100%;
          background: linear-gradient(90deg, rgba(34, 197, 94, 0.85), rgba(251, 146, 60, 0.85));
          box-shadow: 0 0 12px rgba(34, 197, 94, 0.45);
          transition: width 520ms ease;
        }

        .battle-team-mid {
          display: grid;
          place-items: center;
        }

        .battle-vs-core {
          position: relative;
          width: 120px;
          height: 120px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(251, 146, 60, 0.35), rgba(15, 23, 42, 0.85));
          border: 1px solid rgba(255, 255, 255, 0.18);
          display: grid;
          place-items: center;
          box-shadow: 0 0 30px rgba(251, 146, 60, 0.45);
          margin: 0 auto;
        }

        .battle-vs-text {
          font-family: "Bebas Neue", "Impact", sans-serif;
          font-size: 44px;
          letter-spacing: 3px;
          color: #fb923c;
          text-shadow: 0 0 18px rgba(251, 146, 60, 0.7), 0 0 32px rgba(248, 113, 113, 0.6);
        }

        .battle-vs-sparks {
          position: absolute;
          inset: -12px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          box-shadow: 0 0 20px rgba(248, 113, 113, 0.45), inset 0 0 16px rgba(251, 146, 60, 0.4);
          animation: vsPulse 1.6s ease-in-out infinite;
        }

        .battle-clash-line {
          position: absolute;
          inset: -60px;
          border-radius: 999px;
          background: conic-gradient(
            from 90deg,
            rgba(248, 113, 113, 0.25),
            rgba(251, 146, 60, 0.5),
            rgba(56, 189, 248, 0.35),
            rgba(248, 113, 113, 0.25)
          );
          opacity: 0.55;
          filter: blur(8px);
          animation: clashSpin 2.4s linear infinite;
        }

        .battle-ffa {
          gap: 14px;
        }

        .battle-ffa-grid {
          display: grid;
          gap: 10px;
        }

        .battle-ffa-vs-row {
          display: grid;
          place-items: center;
          padding-bottom: 8px;
        }

        .battle-ffa.grid-three .battle-ffa-grid {
          grid-template-rows: repeat(3, 1fr);
        }

        .battle-ffa.grid-two .battle-ffa-grid {
          grid-template-columns: repeat(2, 1fr);
        }

        .battle-ffa.grid-two :global(.battle-slot),
        .battle-ffa.grid-two :global(.battle-slot-empty),
        .battle-ffa.grid-two :global(.battle-slot-vs) {
          min-height: 160px;
        }

        .battle-ffa.grid-three :global(.battle-slot),
        .battle-ffa.grid-three :global(.battle-slot-empty) {
          min-height: 150px;
        }

        .battle-ffa.grid-two :global(.battle-slot-vs) {
          display: grid;
          place-items: center;
          border-radius: 18px;
          background: radial-gradient(circle, rgba(248, 113, 113, 0.35), rgba(15, 23, 42, 0.8));
          border: 1px solid rgba(255, 255, 255, 0.2);
          text-align: center;
        }

        .battle-slot-vs {
          display: grid;
          place-items: center;
          border-radius: 18px;
          background: radial-gradient(circle, rgba(251, 146, 60, 0.35), rgba(15, 23, 42, 0.8));
          border: 1px solid rgba(255, 255, 255, 0.2);
          text-align: center;
          min-height: 150px;
        }

        .battle-ffa.grid-two :global(.battle-slot-vs) .battle-vs-text {
          font-size: 64px;
        }

        @keyframes clashSpin {
          0% {
            transform: rotate(0deg) scale(0.9);
          }
          100% {
            transform: rotate(360deg) scale(1.05);
          }
        }

        @keyframes battleRowFlash {
          0% {
            opacity: 0;
            transform: scale(0.95);
          }
          40% {
            opacity: 1;
            transform: scale(1.02);
          }
          100% {
            opacity: 0;
            transform: scale(1.04);
          }
        }

        @keyframes battleFlashPop {
          0% {
            opacity: 0;
            transform: translateX(-50%) scale(0.8);
          }
          35% {
            opacity: 1;
            transform: translateX(-50%) scale(1.08);
          }
          70% {
            opacity: 1;
            transform: translateX(-50%) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateX(-50%) scale(1);
          }
        }

        @keyframes vsPulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.8;
          }
          50% {
            transform: scale(1.08);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

function renderFfaSlots(
  participants: BattleParticipant[],
  effectConfigByKey: Record<string, { config?: any; render_mode?: string | null; html?: string | null; css?: string | null; js?: string | null }>,
  battlePulseEffects: BattlePulseEffect[],
  cornerOffsets: { x: number; y: number; size: number },
  plateOffsets: { x: number; y: number; size: number },
  target: number,
  hitById: Record<string, number>,
  flashById: Record<string, { type: string; at: number }>,
  attackFxById: Record<string, { type: string; at: number }>,
  drainFxById: Record<string, number>,
  winnerId?: string | null,
  mvpIds: string[] = [],
  winnerReveal?: boolean,
  pointsDeltaById: Map<string, number> = new Map(),
  battleDone?: boolean
) {
  const count = participants.length;
  if (count <= 3) {
    return participants.map((p) => (
      <BattleSlot
        key={p.id}
        participant={p}
        variant="ffa"
        target={target}
        effectConfigByKey={effectConfigByKey}
        battlePulseEffects={battlePulseEffects}
        cornerOffsets={cornerOffsets}
        plateOffsets={plateOffsets}
        hp={calcFfaHp(target, participants, p)}
        hitActive={!!hitById[p.id]}
        hitAt={hitById[p.id]}
        flashType={flashById[p.id]?.type}
        flashAt={flashById[p.id]?.at}
        attackFx={attackFxById[p.id]}
        drainFxAt={drainFxById[p.id]}
        isWinner={winnerReveal && winnerId === p.id}
        winnerReveal={winnerReveal}
        isMvp={mvpIds.includes(p.id)}
        pointsDelta={pointsDeltaById.get(p.id) ?? 0}
        showPoints={battleDone}
      />
    ));
  }
  const rows = Math.ceil(count / 2);
  const slots: Array<JSX.Element> = [];
  participants.forEach((p) =>
    slots.push(
      <BattleSlot
        key={p.id}
        participant={p}
        variant="ffa"
        target={target}
        effectConfigByKey={effectConfigByKey}
        battlePulseEffects={battlePulseEffects}
        cornerOffsets={cornerOffsets}
        plateOffsets={plateOffsets}
        hp={calcFfaHp(target, participants, p)}
        hitActive={!!hitById[p.id]}
        hitAt={hitById[p.id]}
        flashType={flashById[p.id]?.type}
        flashAt={flashById[p.id]?.at}
        attackFx={attackFxById[p.id]}
        drainFxAt={drainFxById[p.id]}
        isWinner={winnerReveal && winnerId === p.id}
        winnerReveal={winnerReveal}
        isMvp={mvpIds.includes(p.id)}
        pointsDelta={pointsDeltaById.get(p.id) ?? 0}
        showPoints={battleDone}
      />
    )
  );
  while (slots.length < rows * 2) {
    slots.push(<EmptySlot key={`ffa-empty-${slots.length}`} label="Open" />);
  }
  return slots;
}

function ffaGridKind(count: number) {
  if (count <= 3) return "three";
  return "two";
}

function flashClass(type: string) {
  if (!type) return "";
  if (type === "HIT") return "flash-hit";
  if (type === "BLOCKED") return "flash-blocked";
  if (type === "COUNTER ATTACK") return "flash-counter";
  return "";
}

function BattleSlot({
  participant,
  align,
  variant,
  compact,
  target,
  effectConfigByKey,
  battlePulseEffects,
  cornerOffsets,
  plateOffsets,
  hp,
  hitActive,
  hitAt,
  flashType,
  flashAt,
  attackFx,
  drainFxAt,
  isWinner,
  winnerReveal,
  isMvp,
  pointsDelta,
  showPoints,
}: {
  participant: BattleParticipant;
  align?: "top" | "bottom";
  variant?: "duel" | "team" | "ffa";
  compact?: boolean;
  target: number;
  effectConfigByKey: Record<string, { config?: any; render_mode?: string | null; html?: string | null; css?: string | null; js?: string | null }>;
  battlePulseEffects: BattlePulseEffect[];
  cornerOffsets: { x: number; y: number; size: number };
  plateOffsets: { x: number; y: number; size: number };
  hp?: number;
  hitActive?: boolean;
  hitAt?: number;
  flashType?: string;
  flashAt?: number;
  attackFx?: { type: string; at: number };
  drainFxAt?: number;
  isWinner?: boolean;
  winnerReveal?: boolean;
  isMvp?: boolean;
  pointsDelta?: number;
  showPoints?: boolean;
}) {
  const size = compact ? 120 : variant === "duel" ? 210 : variant === "team" || variant === "ffa" ? 180 : 170;
  const effect = participant.avatar_effect ? effectConfigByKey[participant.avatar_effect] : undefined;
  const attackEffect = attackFx
    ? pickBattlePulseEffectByType(
        battlePulseEffects,
        flashTypeToEffectType(attackFx.type),
        attackFx.at + hashSeed(participant.id)
      )
    : null;
  const drainEffect = drainFxAt
    ? pickBattlePulseEffectByType(battlePulseEffects, "drain", drainFxAt + hashSeed(`${participant.id}-drain`))
    : null;
  const attempts = Math.max(0, Number(participant.attempts ?? participant.successes ?? 0));
  const successes = Math.max(0, Number(participant.successes ?? 0));
  const remaining = Math.max(0, target - attempts);
  const potential = successes + remaining;
  return (
    <div className={`battle-slot ${align ?? ""} ${variant ?? ""}${compact ? " compact" : ""}${isWinner ? " winner" : ""}`}>
      {participant.card_plate_url ? (
        <img src={participant.card_plate_url} alt="" className="battle-plate" style={cardPlateStyle(plateOffsets)} />
      ) : null}
      {hitActive ? <div key={`hit-${hitAt ?? "hit"}`} className="battle-hit" /> : null}
      {flashType ? (
        <div key={`flash-${flashAt ?? flashType}`} className={`battle-flash ${flashClass(flashType)}`}>
          {flashType}
        </div>
      ) : null}
      {winnerReveal && isWinner ? <div className="battle-winner-badge">Winner</div> : null}
      {isMvp ? <div className="battle-mvp-badge">MVP</div> : null}
      <div className="battle-avatar" style={{ width: size, height: size }}>
        {attackFx && attackEffect ? (
          <div
            key={`fx-${attackFx.at}`}
            className="battle-attack-fx"
            style={{
              transform: `translate(${attackEffect.offset_x ?? 0}px, ${attackEffect.offset_y ?? 0}px)`,
            }}
          >
            <BattleAttackFx effect={attackEffect} hitAt={attackFx.at} />
          </div>
        ) : null}
        {drainFxAt && drainEffect ? (
          <div
            key={`drain-${drainFxAt}`}
            className="battle-drain-fx"
            style={{
              transform: `translate(${drainEffect.offset_x ?? 0}px, ${drainEffect.offset_y ?? 0}px)`,
            }}
          >
            <BattleAttackFx effect={drainEffect} hitAt={drainFxAt} />
          </div>
        ) : null}
        <AvatarRender
          size={size}
          bg={avatarBackground(participant)}
          border={{
            render_mode: participant.corner_border_render_mode ?? null,
            image_url: participant.corner_border_url ?? null,
            html: participant.corner_border_html ?? null,
            css: participant.corner_border_css ?? null,
            js: participant.corner_border_js ?? null,
            offset_x: participant.corner_border_offset_x ?? null,
            offset_y: participant.corner_border_offset_y ?? null,
            offsets_by_context: participant.corner_border_offsets_by_context ?? null,
          }}
          effect={{
            key: participant.avatar_effect ?? null,
            config: effect?.config,
            render_mode: effect?.render_mode ?? null,
            html: effect?.html ?? null,
            css: effect?.css ?? null,
            js: effect?.js ?? null,
          }}
          avatarSrc={participant.avatar_path ? resolveAvatarUrl(participant.avatar_path) : null}
          cornerOffsets={cornerOffsets}
          bleed={26}
          contextKey="battle_pulse"
          style={{
            border: "2px solid rgba(255,255,255,0.2)",
            boxShadow: "inset 0 0 18px rgba(255, 255, 255, 0.12), 0 14px 30px rgba(0, 0, 0, 0.5)",
          }}
          fallback={<span className="battle-avatar-initials">{initials(participant.name)}</span>}
        />
      </div>
      <div className="battle-meta">
        <span className="battle-name-text">{participant.name}</span>
        {showPoints ? (
          <span className={`battle-points ${pointsDelta && pointsDelta > 0 ? "win" : pointsDelta && pointsDelta < 0 ? "lose" : ""}`}>
            {pointsDelta && pointsDelta > 0 ? `+${pointsDelta}` : `${pointsDelta ?? 0}`} pts
          </span>
        ) : null}
      </div>
      <div className="battle-score">
        <span className="battle-score-value">{successes}</span>
        <span className="battle-score-potential">({potential})</span>
      </div>
      {typeof hp === "number" ? (
        <div className="battle-hp">
          <div className="battle-hp-fill" style={{ width: `${Math.round(Math.max(0, Math.min(1, hp)) * 100)}%` }} />
        </div>
      ) : null}
      <style jsx>{`
        .battle-slot {
          display: grid;
          gap: 10px;
          place-items: center;
          padding: 10px;
          border-radius: 18px;
          background: rgba(15, 23, 42, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.15);
          text-align: center;
          position: relative;
          overflow: visible;
        }

        .battle-slot.winner {
          border: 2px solid rgba(253, 224, 71, 0.4);
          box-shadow: 0 0 18px rgba(250, 204, 21, 0.25);
        }

        .battle-slot.winner::before {
          content: "";
          position: absolute;
          inset: -6px;
          border-radius: 22px;
          padding: 2px;
          background: conic-gradient(
            from 90deg,
            rgba(250, 204, 21, 0.2),
            rgba(253, 224, 71, 0.95),
            rgba(250, 204, 21, 0.2)
          );
          -webkit-mask:
            linear-gradient(#000 0 0) content-box,
            linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          opacity: ${winnerReveal ? 1 : 0};
          animation: ${winnerReveal ? "winnerTrace 3s linear forwards" : "none"};
          pointer-events: none;
          z-index: 6;
        }

        .battle-winner-badge {
          position: absolute;
          top: 10px;
          right: 10px;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 1px;
          text-transform: uppercase;
          background: rgba(15, 23, 42, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #fde047;
          z-index: 6;
        }

        .battle-mvp-badge {
          position: absolute;
          top: 10px;
          left: 10px;
          padding: 6px 14px;
          border-radius: 999px;
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 1px;
          text-transform: uppercase;
          background: rgba(15, 23, 42, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #f59e0b;
          z-index: 6;
        }

        .battle-flash {
          position: absolute;
          top: 8px;
          left: 50%;
          transform: translateX(-50%);
          padding: 4px 12px;
          border-radius: 999px;
          font-size: 18px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          background: rgba(15, 23, 42, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.2);
          z-index: 6;
          animation: battleFlashPop 1400ms ease forwards;
          pointer-events: none;
        }

        .battle-flash.flash-hit {
          color: #f97316;
          box-shadow: 0 0 18px rgba(249, 115, 22, 0.6);
        }

        .battle-flash.flash-blocked {
          color: #93c5fd;
          box-shadow: 0 0 18px rgba(147, 197, 253, 0.6);
        }

        .battle-flash.flash-counter {
          color: #facc15;
          box-shadow: 0 0 18px rgba(250, 204, 21, 0.6);
        }

        .battle-slot.top {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.28), rgba(15, 23, 42, 0.6));
        }

        .battle-slot.bottom {
          background: linear-gradient(135deg, rgba(248, 113, 113, 0.28), rgba(15, 23, 42, 0.6));
        }

        .battle-avatar {
          display: grid;
          place-items: center;
          font-weight: 900;
          font-size: 48px;
          color: white;
          position: relative;
          overflow: visible;
        }

        .battle-attack-fx {
          position: absolute;
          left: -40%;
          right: -40%;
          top: -55%;
          height: 210%;
          pointer-events: none;
          z-index: 4;
        }

        .battle-drain-fx {
          position: absolute;
          left: -35%;
          right: -35%;
          top: -35%;
          height: 180%;
          pointer-events: none;
          z-index: 3;
        }

        .battle-slot.duel .battle-attack-fx {
          left: -30%;
          right: -30%;
          top: -45%;
          height: 190%;
        }

        .battle-slot.duel .battle-drain-fx {
          left: -26%;
          right: -26%;
          top: -30%;
          height: 170%;
        }

        .battle-slot.ffa .battle-attack-fx {
          left: -60%;
          right: -60%;
          top: -70%;
          height: 240%;
        }

        .battle-slot.ffa .battle-drain-fx {
          left: -50%;
          right: -50%;
          top: -50%;
          height: 210%;
        }

        .battle-avatar-initials {
          position: relative;
          z-index: 2;
        }

        .battle-meta {
          display: grid;
          gap: 6px;
          justify-items: center;
          width: min(190px, 92%);
          padding: 10px 14px;
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.18);
          text-shadow: 0 6px 16px rgba(0, 0, 0, 0.6);
        }

        .battle-name-text {
          font-size: 18px;
          font-weight: 800;
          position: relative;
          z-index: 2;
        }

        .battle-slot.compact {
          padding: 6px;
          gap: 6px;
        }

        .battle-slot.compact .battle-meta {
          width: min(150px, 92%);
          padding: 6px 8px;
        }

        .battle-slot.compact .battle-name-text {
          font-size: 12px;
        }

        .battle-slot.compact .battle-score-value {
          font-size: 26px;
        }

        .battle-slot.compact .battle-score-potential {
          font-size: 11px;
        }

        .battle-points {
          font-size: 12px;
          font-weight: 900;
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(15, 23, 42, 0.7);
        }

        .battle-points.win {
          color: rgba(34, 197, 94, 1);
          border-color: rgba(34, 197, 94, 0.4);
          box-shadow: 0 0 12px rgba(34, 197, 94, 0.25);
        }

        .battle-points.lose {
          color: rgba(248, 113, 113, 1);
          border-color: rgba(248, 113, 113, 0.4);
          box-shadow: 0 0 12px rgba(248, 113, 113, 0.2);
        }

        .battle-plate {
          position: absolute;
          pointer-events: none;
          z-index: 4;
        }

        .battle-hit {
          position: absolute;
          inset: -10%;
          border-radius: 22px;
          background: radial-gradient(circle, rgba(248, 113, 113, 0.35), transparent 60%);
          box-shadow: 0 0 30px rgba(251, 146, 60, 0.5);
          animation: battleHitFlash 680ms ease forwards;
          z-index: 3;
          pointer-events: none;
        }

        .battle-hp {
          width: min(180px, 90%);
          height: 10px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.18);
          overflow: hidden;
          box-shadow: inset 0 0 8px rgba(0, 0, 0, 0.45);
        }

        .battle-hp-fill {
          height: 100%;
          background: linear-gradient(90deg, rgba(34, 197, 94, 0.85), rgba(251, 146, 60, 0.85));
          box-shadow: 0 0 10px rgba(34, 197, 94, 0.5);
          transition: width 520ms ease;
        }

        .battle-score {
          display: inline-flex;
          align-items: baseline;
          gap: 6px;
          font-weight: 900;
          letter-spacing: 0.4px;
        }

        .battle-score-value {
          font-size: 36px;
          color: rgba(34, 197, 94, 0.95);
          text-shadow: 0 0 12px rgba(34, 197, 94, 0.45);
        }

        .battle-score-potential {
          font-size: 14px;
          opacity: 0.7;
        }

        .battle-slot.duel {
          justify-items: center;
          align-items: center;
        }

        .battle-slot.duel .battle-avatar {
          font-size: 62px;
        }

        .battle-slot.duel .battle-meta {
          width: min(230px, 92%);
          padding: 12px 16px;
        }

        .battle-slot.team .battle-avatar,
        .battle-slot.ffa .battle-avatar {
          font-size: 54px;
        }

        .battle-slot.compact .battle-avatar {
          font-size: 38px;
        }

        @keyframes battleHitFlash {
          0% {
            opacity: 0;
            transform: scale(0.9);
          }
          30% {
            opacity: 1;
            transform: scale(1.02);
          }
          100% {
            opacity: 0;
            transform: scale(1.05);
          }
        }

        @keyframes winnerTrace {
          0% {
            filter: drop-shadow(0 0 0 rgba(250, 204, 21, 0));
            opacity: 0.2;
          }
          40% {
            opacity: 1;
          }
          100% {
            filter: drop-shadow(0 0 18px rgba(250, 204, 21, 0.8));
            opacity: 1;
          }
        }

        @keyframes battleFlashPop {
          0% {
            opacity: 0;
            transform: translateX(-50%) scale(0.8);
          }
          35% {
            opacity: 1;
            transform: translateX(-50%) scale(1.08);
          }
          100% {
            opacity: 0;
            transform: translateX(-50%) scale(1);
          }
        }
      `}</style>
    </div>
  );
}

function EmptySlot({ label }: { label: string }) {
  return (
    <div className="battle-slot-empty">
      <div>{label}</div>
      <style jsx>{`
        .battle-slot-empty {
          display: grid;
          place-items: center;
          padding: 12px;
          border-radius: 18px;
          border: 1px dashed rgba(255, 255, 255, 0.2);
          color: rgba(255, 255, 255, 0.65);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
      `}</style>
    </div>
  );
}

function avatarBackground(participant: BattleParticipant) {
  return participant.avatar_bg
    ? `linear-gradient(160deg, rgba(255,255,255,0.2), rgba(0,0,0,0.3)), ${participant.avatar_bg}`
    : "linear-gradient(135deg, rgba(59,130,246,0.45), rgba(15,23,42,0.85))";
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

function resolveAvatarUrl(path?: string | null) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!base) return "";
  return `${base}/storage/v1/object/public/avatars/${path}`;
}

function getParticipants(battle: BattleRow): BattleParticipant[] {
  if (battle.participants?.length) return battle.participants;
  const left = {
    id: battle.left_student_id,
    name: battle.left_name,
    avatar_path: battle.left_avatar_path,
    avatar_bg: battle.left_avatar_bg,
    avatar_effect: battle.left_avatar_effect ?? null,
    corner_border_url: battle.left_corner_border_url ?? null,
    corner_border_render_mode: battle.left_corner_border_render_mode ?? null,
    corner_border_html: battle.left_corner_border_html ?? null,
    corner_border_css: battle.left_corner_border_css ?? null,
    corner_border_js: battle.left_corner_border_js ?? null,
    corner_border_offset_x: battle.left_corner_border_offset_x ?? null,
    corner_border_offset_y: battle.left_corner_border_offset_y ?? null,
    corner_border_offsets_by_context: battle.left_corner_border_offsets_by_context ?? null,
    card_plate_url: battle.left_card_plate_url ?? null,
    attempts: battle.left_attempts ?? 0,
    successes: battle.left_successes ?? 0,
  };
  const right = {
    id: battle.right_student_id,
    name: battle.right_name,
    avatar_path: battle.right_avatar_path,
    avatar_bg: battle.right_avatar_bg,
    avatar_effect: battle.right_avatar_effect ?? null,
    corner_border_url: battle.right_corner_border_url ?? null,
    corner_border_render_mode: battle.right_corner_border_render_mode ?? null,
    corner_border_html: battle.right_corner_border_html ?? null,
    corner_border_css: battle.right_corner_border_css ?? null,
    corner_border_js: battle.right_corner_border_js ?? null,
    corner_border_offset_x: battle.right_corner_border_offset_x ?? null,
    corner_border_offset_y: battle.right_corner_border_offset_y ?? null,
    corner_border_offsets_by_context: battle.right_corner_border_offsets_by_context ?? null,
    card_plate_url: battle.right_card_plate_url ?? null,
    attempts: battle.right_attempts ?? 0,
    successes: battle.right_successes ?? 0,
  };
  return [left, right].filter((p) => p.id);
}

function getDuelParticipants(battle: BattleRow): [BattleParticipant | null, BattleParticipant | null] {
  const participants = getParticipants(battle);
  if (participants.length >= 2) return [participants[0], participants[1]];
  if (participants.length === 1) return [participants[0], null];
  return [null, null];
}

function isBattleDisplayDone(battle: BattleRow) {
  if (battle.settled_at) return true;
  if (battle.winner_id) return true;
  const mode = String(battle.battle_mode ?? "duel");
  if (mode === "duel") {
    const [left, right] = getDuelParticipants(battle);
    if (!left?.id || !right?.id) return false;
    const target = Math.max(1, Number(battle.repetitions_target ?? 1));
    const hpLeft = calcHp(target, left, right);
    const hpRight = calcHp(target, right, left);
    return hpLeft <= 0 || hpRight <= 0;
  }
  if (mode === "ffa") {
    const participants = getParticipants(battle);
    if (!participants.length) return false;
    const target = Math.max(1, Number(battle.repetitions_target ?? 1));
    const alive = participants.filter((p) => calcFfaHpRaw(target, participants, p) > 0);
    return alive.length <= 1;
  }
  if (mode !== "teams") return false;
  const participants = getParticipants(battle);
  if (!participants.length) return false;
  const seedTeamA = (battle.team_a_ids ?? []).map(String);
  const seedTeamB = (battle.team_b_ids ?? []).map(String);
  const teamAIds = seedTeamA.length ? seedTeamA : participants.slice(0, Math.max(1, Math.ceil(participants.length / 2))).map((p) => p.id);
  const teamBIds = seedTeamB.length ? seedTeamB : participants.filter((p) => !teamAIds.includes(p.id)).map((p) => p.id);
  const teamA = participants.filter((p) => teamAIds.includes(p.id));
  const teamB = participants.filter((p) => teamBIds.includes(p.id));
  const target = Math.max(1, Number(battle.repetitions_target ?? 1));
  const hpA = calcTeamHp(target, teamA, teamB);
  const hpB = calcTeamHp(target, teamB, teamA);
  return hpA <= 0 || hpB <= 0;
}

function calcHp(target: number, current?: BattleParticipant, opponent?: BattleParticipant) {
  if (!current) return 1;
  const curSuccess = Number(current.successes ?? 0);
  const curAttempts = Number(current.attempts ?? curSuccess);
  const oppSuccess = Number(opponent?.successes ?? 0);
  const oppAttempts = Number(opponent?.attempts ?? oppSuccess);
  const curRemaining = Math.max(0, target - curAttempts);
  const oppRemaining = Math.max(0, target - oppAttempts);
  const hpRaw = curSuccess + curRemaining - oppSuccess;
  const tiePossible = curSuccess + curRemaining >= oppSuccess && oppSuccess + oppRemaining >= curSuccess;
  const hp = hpRaw <= 0 && tiePossible ? 1 : Math.max(0, hpRaw);
  return Math.min(1, hp / Math.max(1, target));
}

function calcTeamHp(target: number, team: BattleParticipant[], otherTeam: BattleParticipant[]) {
  if (!team.length) return 1;
  const teamSuccesses = team.reduce((sum, p) => sum + Number(p.successes ?? 0), 0);
  const otherSuccesses = otherTeam.reduce((sum, p) => sum + Number(p.successes ?? 0), 0);
  const teamAttempts = team.reduce((sum, p) => sum + Number(p.attempts ?? p.successes ?? 0), 0);
  const otherAttempts = otherTeam.reduce((sum, p) => sum + Number(p.attempts ?? p.successes ?? 0), 0);
  const total = Math.max(1, target * team.length);
  const otherTotal = Math.max(1, target * otherTeam.length);
  const remaining = Math.max(0, total - teamAttempts);
  const otherRemaining = Math.max(0, otherTotal - otherAttempts);
  const hpRaw = teamSuccesses + remaining - otherSuccesses;
  const tiePossible = teamSuccesses + remaining >= otherSuccesses && otherSuccesses + otherRemaining >= teamSuccesses;
  const hp = hpRaw <= 0 && tiePossible ? 1 : Math.max(0, hpRaw);
  return Math.min(1, hp / total);
}

function calcFfaHp(target: number, participants: BattleParticipant[], current: BattleParticipant) {
  if (!participants.length) return 1;
  const raw = calcFfaHpRaw(target, participants, current);
  const maxHp = Math.max(1, target);
  return Math.min(1, Math.max(0, raw / maxHp));
}

function calcFfaHpRaw(target: number, participants: BattleParticipant[], current: BattleParticipant) {
  const success = Number(current.successes ?? 0);
  const attempts = Number(current.attempts ?? current.successes ?? 0);
  const remaining = Math.max(0, target - attempts);
  const maxOtherSuccess = Math.max(
    0,
    ...participants.filter((p) => p.id !== current.id).map((p) => Number(p.successes ?? 0))
  );
  const maxFinal = success + remaining;
  const hpRaw = maxFinal - maxOtherSuccess;
  const tiePossible = maxFinal >= maxOtherSuccess;
  if (hpRaw <= 0 && tiePossible) return 1;
  return Math.max(0, hpRaw);
}


function cardPlateStyle(offset: { x: number; y: number; size: number }): React.CSSProperties {
  return {
    top: offset.y,
    left: offset.x,
    width: offset.size,
    height: "auto",
    position: "absolute",
    pointerEvents: "none",
    zIndex: 3,
  };
}

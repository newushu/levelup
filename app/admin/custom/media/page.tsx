"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AvatarEffectParticles from "@/components/AvatarEffectParticles";

type SoundEffectRow = {
  id?: string;
  key: string;
  label: string;
  audio_url?: string | null;
  category?: string | null;
  volume?: number | null;
  enabled?: boolean;
  loop?: boolean;
};

type BadgeLibraryRow = {
  id?: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  category?: string | null;
  enabled?: boolean;
};

type AvatarRow = {
  id?: string;
  name: string;
  storage_path?: string | null;
  enabled?: boolean;
  is_secondary?: boolean;
  unlock_level?: number | string | null;
  unlock_points?: number | string | null;
  rule_keeper_multiplier?: number | string | null;
  rule_breaker_multiplier?: number | string | null;
  skill_pulse_multiplier?: number | string | null;
  spotlight_multiplier?: number | string | null;
  daily_free_points?: number | string | null;
  challenge_completion_bonus_pct?: number | string | null;
  mvp_bonus_pct?: number | string | null;
  zoom_pct?: number | string | null;
  competition_only?: boolean | null;
  competition_discount_pct?: number | string | null;
  limited_event_only?: boolean | null;
  limited_event_name?: string | null;
  limited_event_description?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type AvatarEffectRow = {
  id?: string;
  key: string;
  name: string;
  unlock_level?: number | null;
  unlock_points?: number | null;
  config?: {
    density?: number;
    size?: number;
    speed?: number;
    opacity?: number;
    frequency?: number;
    scale?: number;
    scale_by_context?: Record<string, { scale?: number | null }>;
  };
  render_mode?: string | null;
  html?: string | null;
  css?: string | null;
  js?: string | null;
  enabled?: boolean;
  limited_event_only?: boolean | null;
  limited_event_name?: string | null;
  limited_event_description?: string | null;
};

type CornerBorderRow = {
  id?: string;
  key: string;
  name: string;
  image_url?: string | null;
  render_mode?: string | null;
  z_layer?: string | null;
  offset_x?: number | null;
  offset_y?: number | null;
  offsets_by_context?: Record<string, { x?: number | null; y?: number | null; scale?: number | null }> | null;
  html?: string | null;
  css?: string | null;
  js?: string | null;
  unlock_level?: number | null;
  unlock_points?: number | null;
  enabled?: boolean;
  rule_keeper_multiplier?: number | string | null;
  rule_breaker_multiplier?: number | string | null;
  skill_pulse_multiplier?: number | string | null;
  spotlight_multiplier?: number | string | null;
  daily_free_points?: number | string | null;
  challenge_completion_bonus_pct?: number | string | null;
  mvp_bonus_pct?: number | string | null;
  limited_event_only?: boolean | null;
  limited_event_name?: string | null;
  limited_event_description?: string | null;
};

type CornerBorderPositions = {
  dashboard_x: number;
  dashboard_y: number;
  dashboard_size: number;
  selector_x: number;
  selector_y: number;
  selector_size: number;
  skill_pulse_x: number;
  skill_pulse_y: number;
  skill_pulse_size: number;
  skill_pulse_tracker_x: number;
  skill_pulse_tracker_y: number;
  skill_pulse_tracker_size: number;
  live_activity_x: number;
  live_activity_y: number;
  live_activity_size: number;
  roster_x: number;
  roster_y: number;
  roster_size: number;
};

type CardPlateRow = {
  id?: string;
  key: string;
  name: string;
  image_url?: string | null;
  unlock_level?: number | null;
  unlock_points?: number | null;
  enabled?: boolean;
};

type CardPlatePositions = {
  dashboard_x: number;
  dashboard_y: number;
  dashboard_size: number;
  selector_x: number;
  selector_y: number;
  selector_size: number;
  skill_pulse_x: number;
  skill_pulse_y: number;
  skill_pulse_size: number;
  skill_pulse_tracker_x: number;
  skill_pulse_tracker_y: number;
  skill_pulse_tracker_size: number;
  live_activity_x: number;
  live_activity_y: number;
  live_activity_size: number;
  roster_x: number;
  roster_y: number;
  roster_size: number;
  taolu_tracker_x: number;
  taolu_tracker_y: number;
  taolu_tracker_size: number;
  battle_pulse_x: number;
  battle_pulse_y: number;
  battle_pulse_size: number;
};

type TimerSettings = {
  music_url: string;
  end_sound_key: string;
};

type NavSettings = {
  logo_url: string;
  logo_zoom: number;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status})` } };
  }
}

function buildCodePreview(html?: string | null, css?: string | null) {
  return `<style>${css ?? ""}</style>${html ?? ""}`;
}

type SoundCategoryParts = { type: "effect" | "music"; label: string };

function parseSoundCategory(raw?: string | null): SoundCategoryParts {
  const text = String(raw ?? "").trim();
  if (!text) return { type: "effect", label: "" };
  const [head, ...rest] = text.split(":");
  const tail = rest.join(":").trim();
  if ((head === "music" || head === "effect") && tail) {
    return { type: head as SoundCategoryParts["type"], label: tail };
  }
  if (text === "music" || text === "effect") return { type: text as SoundCategoryParts["type"], label: "" };
  return { type: "effect", label: text };
}

function formatSoundCategory(type: "effect" | "music", label: string) {
  const cleaned = label.trim();
  if (!cleaned) return type;
  return `${type}:${cleaned}`;
}

function displaySoundCategory(raw?: string | null) {
  const parts = parseSoundCategory(raw);
  if (parts.label) return parts.label;
  return parts.type === "music" ? "Music" : "Effect";
}

const AVATAR_EFFECT_PRESETS: Array<{ key: string; name: string; preview: React.CSSProperties }> = [
  {
    key: "orbit",
    name: "Orbit Rings",
    preview: {
      background:
        "radial-gradient(circle at 50% 50%, rgba(34,197,94,0.35) 0 40%, transparent 41%), radial-gradient(circle at 50% 50%, rgba(59,130,246,0.35) 0 55%, transparent 56%)",
      animation: "spinOrbit 6s linear infinite",
    },
  },
  {
    key: "spark",
    name: "Spark Drift",
    preview: {
      background:
        "radial-gradient(circle at 20% 30%, rgba(250,204,21,0.45), transparent 45%), radial-gradient(circle at 80% 20%, rgba(59,130,246,0.35), transparent 50%), radial-gradient(circle at 30% 80%, rgba(34,197,94,0.35), transparent 55%)",
      animation: "sparkPulse 3.6s ease-in-out infinite",
    },
  },
  {
    key: "halo",
    name: "Soft Halo",
    preview: {
      boxShadow: "0 0 22px rgba(59,130,246,0.45), 0 0 40px rgba(34,197,94,0.35)",
      border: "1px solid rgba(255,255,255,0.25)",
    },
  },
  {
    key: "storm",
    name: "Storm Rings",
    preview: {
      background:
        "conic-gradient(from 20deg, rgba(59,130,246,0.35), transparent 35%, rgba(34,197,94,0.35), transparent 70%)",
      animation: "spinOrbit 5s linear infinite",
    },
  },
  {
    key: "ember",
    name: "Ember Glow",
    preview: {
      background:
        "radial-gradient(circle at 20% 70%, rgba(251,146,60,0.45), transparent 50%), radial-gradient(circle at 70% 30%, rgba(244,63,94,0.35), transparent 55%)",
      animation: "sparkPulse 4.4s ease-in-out infinite",
    },
  },
  {
    key: "aura",
    name: "Electric Aura",
    preview: {
      boxShadow: "0 0 18px rgba(59,130,246,0.55), 0 0 50px rgba(147,197,253,0.35)",
      border: "1px solid rgba(59,130,246,0.35)",
    },
  },
  {
    key: "spray",
    name: "Confetti Spray",
    preview: {
      background:
        "radial-gradient(circle at 10% 20%, rgba(34,197,94,0.4), transparent 40%), radial-gradient(circle at 80% 30%, rgba(59,130,246,0.35), transparent 45%), radial-gradient(circle at 60% 80%, rgba(250,204,21,0.35), transparent 48%)",
      animation: "sparkPulse 5.2s ease-in-out infinite",
    },
  },
  {
    key: "nebula",
    name: "Nebula Mist",
    preview: {
      background:
        "radial-gradient(circle at 40% 40%, rgba(236,72,153,0.35), transparent 55%), radial-gradient(circle at 70% 70%, rgba(59,130,246,0.35), transparent 60%)",
      animation: "sparkPulse 6s ease-in-out infinite",
    },
  },
  {
    key: "starfield",
    name: "Starfield",
    preview: {
      background:
        "radial-gradient(circle at 20% 30%, rgba(248,250,252,0.6), transparent 35%), radial-gradient(circle at 70% 20%, rgba(226,232,240,0.5), transparent 40%), radial-gradient(circle at 60% 80%, rgba(186,230,253,0.45), transparent 45%)",
      animation: "sparkPulse 5s ease-in-out infinite",
    },
  },
  {
    key: "comet",
    name: "Comet Trails",
    preview: {
      background:
        "linear-gradient(120deg, transparent 0 30%, rgba(56,189,248,0.45) 30% 36%, transparent 36% 60%, rgba(196,181,253,0.35) 60% 64%, transparent 64% 100%)",
      animation: "spinOrbit 4.5s linear infinite",
    },
  },
  {
    key: "grid",
    name: "Neon Grid",
    preview: {
      background:
        "linear-gradient(90deg, rgba(34,211,238,0.35) 1px, transparent 1px), linear-gradient(rgba(165,180,252,0.35) 1px, transparent 1px)",
      backgroundSize: "18px 18px",
    },
  },
  {
    key: "vortex",
    name: "Vortex Spin",
    preview: {
      background:
        "conic-gradient(from 20deg, rgba(244,114,182,0.4), transparent 35%, rgba(52,211,153,0.35), transparent 70%, rgba(96,165,250,0.4))",
      animation: "spinOrbit 3.8s linear infinite",
    },
  },
  {
    key: "pulse",
    name: "Pulse Waves",
    preview: {
      background:
        "radial-gradient(circle at 50% 50%, rgba(250,204,21,0.35) 0 35%, transparent 36%), radial-gradient(circle at 50% 50%, rgba(251,113,133,0.25) 0 60%, transparent 61%)",
      animation: "sparkPulse 3s ease-in-out infinite",
    },
  },
  {
    key: "rain",
    name: "Digital Rain",
    preview: {
      background:
        "linear-gradient(180deg, rgba(96,165,250,0.45) 0 40%, transparent 40% 100%), linear-gradient(180deg, rgba(148,163,184,0.35) 0 30%, transparent 30% 100%)",
      backgroundSize: "12px 18px",
      animation: "sparkPulse 4.2s ease-in-out infinite",
    },
  },
  {
    key: "orbitals",
    name: "Orbital Rings",
    preview: {
      background:
        "radial-gradient(circle at 50% 50%, rgba(165,180,252,0.4) 0 35%, transparent 36%), radial-gradient(circle at 50% 50%, rgba(56,189,248,0.35) 0 60%, transparent 61%)",
      animation: "spinOrbit 4s linear infinite",
    },
  },
  {
    key: "fireworks",
    name: "Fireworks Burst",
    preview: {
      background:
        "radial-gradient(circle at 50% 50%, rgba(249,115,22,0.5) 0 20%, transparent 40%), radial-gradient(circle at 30% 30%, rgba(250,204,21,0.45) 0 18%, transparent 38%), radial-gradient(circle at 70% 70%, rgba(56,189,248,0.45) 0 16%, transparent 36%)",
      animation: "sparkPulse 2.8s ease-in-out infinite",
    },
  },
];

const MEDIA_CATEGORIES = ["All", "Sound", "Music", "Timers", "Badges", "Branding"];
const AVATAR_CATEGORIES = ["All", "Avatars", "Corner Badges", "Card Plates"];

const SOUND_EFFECT_PRESETS: Array<{ key: string; label: string; purpose: string }> = [
  { key: "points_add", label: "Points Earned", purpose: "Give points" },
  { key: "points_remove", label: "Points Removed", purpose: "Remove points" },
  { key: "rule_keeper", label: "Rule Keeper", purpose: "Positive behavior bonus" },
  { key: "logo_intro", label: "Logo Intro", purpose: "Home logo intro animation" },
  { key: "battle_pulse_music", label: "Battle Pulse Music", purpose: "Battle Pulse display only" },
  { key: "siege_survive_music", label: "Siege & Survive Music", purpose: "Siege & Survive display only" },
  { key: "battle_pulse_swords", label: "Battle Pulse Swords", purpose: "Battle Pulse intro swords clash" },
  { key: "battle_pulse_winner", label: "Battle Pulse Winner", purpose: "Battle Pulse winner announcement" },
  { key: "battle_pulse_win", label: "Battle Pulse Win", purpose: "Battle Pulse winner" },
  { key: "battle_pulse_hit", label: "Battle Pulse Hit", purpose: "Battle Pulse hit impact" },
  { key: "battle_pulse_block", label: "Battle Pulse Block", purpose: "Battle Pulse blocked attack" },
  { key: "battle_pulse_counter", label: "Battle Pulse Counter", purpose: "Battle Pulse counter attack" },
  { key: "battle_pulse_check", label: "Battle Pulse Check", purpose: "Battle Pulse success" },
  { key: "battle_pulse_x", label: "Battle Pulse X", purpose: "Battle Pulse miss" },
  { key: "siege_next_round", label: "Siege Next Round", purpose: "Siege & Survive next round announcement" },
  { key: "siege_countdown_beep", label: "Siege Countdown Beep", purpose: "Siege & Survive countdown beeps" },
  { key: "siege_game_over", label: "Siege Game Over", purpose: "Siege & Survive game over" },
  { key: "skill_pulse", label: "Skill Pulse", purpose: "Skill Pulse completion" },
  { key: "timer_end", label: "Timer End", purpose: "Timer finished" },
  { key: "badge_earn", label: "Badge Earned", purpose: "Achievement badge earned" },
  { key: "prestige_earn", label: "Prestige Earned", purpose: "Prestige badge earned" },
  { key: "wheel_spin_music", label: "Prize Wheel Spin Music", purpose: "Prize wheel spin background audio" },
  { key: "wheel_confirm", label: "Prize Wheel Confirm", purpose: "Prize wheel confirm overlay" },
  { key: "ui_button_press", label: "Button Press", purpose: "UI button press feedback" },
  { key: "ctf_safe_zone", label: "CTF Safe Zone Alert", purpose: "CTF safe zone no longer safe" },
  { key: "ctf_point_1", label: "CTF +1 Point", purpose: "CTF 1 point score" },
  { key: "ctf_point_5", label: "CTF +5 Points", purpose: "CTF 5 point score" },
  { key: "ctf_jailbreak", label: "CTF Jailbreak", purpose: "CTF jailbreak trigger" },
  { key: "crack_sudden_death", label: "Crack a Bat Sudden Death", purpose: "Crack a Bat final minute" },
];

 
export default function MediaVaultAdminPage() {
  const params = useSearchParams();
  const view = String(params.get("view") ?? "").toLowerCase();
  const avatarView = view === "avatar" || view === "avatars" || view === "avatar-design";
  const [pinOk, setPinOk] = useState(false);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saveAllDone, setSaveAllDone] = useState(false);

  const [effects, setEffects] = useState<SoundEffectRow[]>([]);
  const [library, setLibrary] = useState<BadgeLibraryRow[]>([]);
  const [avatars, setAvatars] = useState<AvatarRow[]>([]);
  const avatarsRef = useRef<AvatarRow[]>([]);
  const avatarAutosaveTimersRef = useRef<Record<string, number>>({});
  const avatarSignaturesRef = useRef<Record<string, string>>({});
  const [autoSavingAvatarIds, setAutoSavingAvatarIds] = useState<Record<string, boolean>>({});
  const [copyOpenAvatarId, setCopyOpenAvatarId] = useState<string>("");
  const [avatarEffects, setAvatarEffects] = useState<AvatarEffectRow[]>([]);
  const [cornerBorders, setCornerBorders] = useState<CornerBorderRow[]>([]);
  const [cornerPositions, setCornerPositions] = useState<CornerBorderPositions>({
    dashboard_x: -8,
    dashboard_y: -8,
    dashboard_size: 88,
    selector_x: -8,
    selector_y: -8,
    selector_size: 84,
    skill_pulse_x: -10,
    skill_pulse_y: -10,
    skill_pulse_size: 72,
    skill_pulse_tracker_x: -10,
    skill_pulse_tracker_y: -10,
    skill_pulse_tracker_size: 72,
    live_activity_x: -10,
    live_activity_y: -10,
    live_activity_size: 72,
    roster_x: -8,
    roster_y: -8,
    roster_size: 96,
  });
  const [cornerPositionsDirty, setCornerPositionsDirty] = useState(false);
  const [cardPlates, setCardPlates] = useState<CardPlateRow[]>([]);
  const [cardPlatePositions, setCardPlatePositions] = useState<CardPlatePositions>({
    dashboard_x: 0,
    dashboard_y: 0,
    dashboard_size: 200,
    selector_x: 0,
    selector_y: 0,
    selector_size: 200,
    skill_pulse_x: 0,
    skill_pulse_y: 0,
    skill_pulse_size: 200,
    skill_pulse_tracker_x: 0,
    skill_pulse_tracker_y: 0,
    skill_pulse_tracker_size: 120,
    live_activity_x: 0,
    live_activity_y: 0,
    live_activity_size: 200,
    roster_x: 0,
    roster_y: 0,
    roster_size: 220,
    taolu_tracker_x: 0,
    taolu_tracker_y: 0,
    taolu_tracker_size: 220,
    battle_pulse_x: 0,
    battle_pulse_y: 0,
    battle_pulse_size: 240,
  });
  const [cardPlatePositionsDirty, setCardPlatePositionsDirty] = useState(false);
  const [previewAvatarId, setPreviewAvatarId] = useState<string>("");
  const [cornerPreviewAvatarId, setCornerPreviewAvatarId] = useState<string>("");
  const [cornerPositionPreviewKey, setCornerPositionPreviewKey] = useState<string>("");
  const [timerSettings, setTimerSettings] = useState<TimerSettings>({
    music_url: "",
    end_sound_key: "",
  });
  const [timerSettingsDirty, setTimerSettingsDirty] = useState(false);
  const [navSettings, setNavSettings] = useState<NavSettings>({ logo_url: "", logo_zoom: 1 });
  const [navSettingsDirty, setNavSettingsDirty] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [soundCategoryFilters, setSoundCategoryFilters] = useState<string[]>([]);

  useEffect(() => {
    if (avatarView) setActiveCategory("Avatars");
  }, [avatarView]);

  const [newEffect, setNewEffect] = useState<SoundEffectRow>({
    key: "",
    label: "",
    audio_url: "",
    category: "effect",
    volume: 1,
    enabled: true,
    loop: false,
  });
  const [newBadge, setNewBadge] = useState<BadgeLibraryRow>({
    name: "",
    description: "",
    image_url: "",
    category: "",
    enabled: true,
  });
  const [newAvatar, setNewAvatar] = useState<AvatarRow>({
    name: "",
    storage_path: "",
    enabled: true,
    is_secondary: false,
    unlock_level: 1,
    unlock_points: 0,
    rule_keeper_multiplier: 1,
    rule_breaker_multiplier: 1,
    skill_pulse_multiplier: 1,
    spotlight_multiplier: 1,
    daily_free_points: 0,
    challenge_completion_bonus_pct: 0,
    mvp_bonus_pct: 0,
    zoom_pct: 100,
    competition_only: false,
    competition_discount_pct: 0,
    limited_event_only: false,
    limited_event_name: "",
    limited_event_description: "",
  });
  const [newCornerBorder, setNewCornerBorder] = useState<CornerBorderRow>({
    key: "",
    name: "",
    image_url: "",
    render_mode: "image",
    z_layer: "above_avatar",
    offset_x: 0,
    offset_y: 0,
    offsets_by_context: {},
    html: "",
    css: "",
    js: "",
    unlock_level: 1,
    unlock_points: 0,
    rule_keeper_multiplier: 1,
    rule_breaker_multiplier: 1,
    skill_pulse_multiplier: 1,
    spotlight_multiplier: 1,
    daily_free_points: 0,
    challenge_completion_bonus_pct: 0,
    mvp_bonus_pct: 0,
    limited_event_only: false,
    limited_event_name: "",
    limited_event_description: "",
    enabled: true,
  });
  const [newCardPlate, setNewCardPlate] = useState<CardPlateRow>({
    key: "",
    name: "",
    image_url: "",
    unlock_level: 1,
    unlock_points: 0,
    enabled: true,
  });

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState("");
  const [pickerTarget, setPickerTarget] = useState<{ type: "new" | "row"; id?: string } | null>(null);
  const [bucketFiles, setBucketFiles] = useState<{ path: string; public_url: string }[]>([]);

  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [avatarPickerLoading, setAvatarPickerLoading] = useState(false);
  const [avatarPickerError, setAvatarPickerError] = useState("");
  const [avatarPickerTarget, setAvatarPickerTarget] = useState<{ type: "new" | "row"; id?: string } | null>(null);
  const [avatarBucketFiles, setAvatarBucketFiles] = useState<{ path: string; public_url: string }[]>([]);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarBulkUploading, setAvatarBulkUploading] = useState(false);
  const [avatarUploadProgress, setAvatarUploadProgress] = useState<number | null>(null);
  const [avatarUploadStatus, setAvatarUploadStatus] = useState("");
  const [avatarUploadTargetId, setAvatarUploadTargetId] = useState<string>("new");
  const [avatarUsage, setAvatarUsage] = useState<Record<string, { count: number; students: Array<{ id: string; name: string; level?: number | null }> }>>({});
  const [avatarUnlockLevelDrafts, setAvatarUnlockLevelDrafts] = useState<Record<string, string>>({});
  const [soundLibrary, setSoundLibrary] = useState<Array<{ path: string; public_url: string }>>([]);
  const [soundPreviewKey, setSoundPreviewKey] = useState<string>("");
  const [soundUploading, setSoundUploading] = useState(false);
  const [musicLibrary, setMusicLibrary] = useState<Array<{ path: string; public_url: string }>>([]);
  const [musicPreviewUrl, setMusicPreviewUrl] = useState<string>("");
  const [musicUploading, setMusicUploading] = useState(false);
  const [navUploading, setNavUploading] = useState(false);
  const [cornerPickerOpen, setCornerPickerOpen] = useState(false);
  const [cornerPickerLoading, setCornerPickerLoading] = useState(false);
  const [cornerPickerError, setCornerPickerError] = useState("");
  const [cornerPickerTarget, setCornerPickerTarget] = useState<{ type: "new" | "row"; id?: string } | null>(null);
  const [cornerBucketFiles, setCornerBucketFiles] = useState<{ path: string; public_url: string }[]>([]);
  const [cornerUploading, setCornerUploading] = useState(false);
  const [platePickerOpen, setPlatePickerOpen] = useState(false);
  const [platePickerLoading, setPlatePickerLoading] = useState(false);
  const [platePickerError, setPlatePickerError] = useState("");
  const [platePickerTarget, setPlatePickerTarget] = useState<{ type: "new" | "row"; id?: string } | null>(null);
  const [plateBucketFiles, setPlateBucketFiles] = useState<{ path: string; public_url: string }[]>([]);
  const [plateUploading, setPlateUploading] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [previewPlayingUrl, setPreviewPlayingUrl] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ok = window.sessionStorage.getItem("admin_pin_ok") === "1";
    if (!ok) {
      window.location.href = "/admin";
      return;
    }
    setPinOk(true);
  }, []);

  async function loadAll() {
    const [
      effectsRes,
      badgeRes,
      avatarRes,
      avatarEffectsRes,
      cornerRes,
      cornerPosRes,
      cardPlateRes,
      cardPlatePosRes,
      timerRes,
      soundBrowseRes,
      musicBrowseRes,
      navRes,
    ] = await Promise.all([
      fetch("/api/admin/sound-effects", { cache: "no-store" }),
      fetch("/api/admin/badge-library/list", { cache: "no-store" }),
      fetch("/api/admin/avatars", { cache: "no-store" }),
      fetch("/api/admin/avatar-effects", { cache: "no-store" }),
      fetch("/api/admin/corner-borders", { cache: "no-store" }),
      fetch("/api/corner-borders/settings", { cache: "no-store" }),
      fetch("/api/admin/card-plates", { cache: "no-store" }),
      fetch("/api/card-plates/settings", { cache: "no-store" }),
      fetch("/api/timer-settings", { cache: "no-store" }),
      fetch("/api/admin/sound-effects/browse", { cache: "no-store" }),
      fetch("/api/admin/music/browse", { cache: "no-store" }),
      fetch("/api/nav-settings", { cache: "no-store" }),
    ]);

    const [
      effectsJson,
      badgeJson,
      avatarJson,
      avatarEffectsJson,
      cornerJson,
      cornerPosJson,
      cardPlateJson,
      cardPlatePosJson,
      timerJson,
      soundBrowseJson,
      musicBrowseJson,
      navJson,
    ] = await Promise.all([
      safeJson(effectsRes),
      safeJson(badgeRes),
      safeJson(avatarRes),
      safeJson(avatarEffectsRes),
      safeJson(cornerRes),
      safeJson(cornerPosRes),
      safeJson(cardPlateRes),
      safeJson(cardPlatePosRes),
      safeJson(timerRes),
      safeJson(soundBrowseRes),
      safeJson(musicBrowseRes),
      safeJson(navRes),
    ]);

    if (!effectsJson.ok) setMsg(effectsJson.json?.error || "Failed to load sound effects");
    if (!badgeJson.ok) setMsg(badgeJson.json?.error || "Failed to load badge library");
    if (!avatarJson.ok) setMsg(avatarJson.json?.error || "Failed to load avatars");
    if (!avatarEffectsJson.ok) setMsg(avatarEffectsJson.json?.error || "Failed to load avatar effects");
    if (!cornerJson.ok) setMsg(cornerJson.json?.error || "Failed to load corner borders");
    if (!cornerPosJson.ok) setMsg(cornerPosJson.json?.error || "Failed to load corner positions");
    if (!cardPlateJson.ok) setMsg(cardPlateJson.json?.error || "Failed to load card plates");
    if (!cardPlatePosJson.ok) setMsg(cardPlatePosJson.json?.error || "Failed to load card plate positions");
    if (!timerJson.ok) setMsg(timerJson.json?.error || "Failed to load timer settings");
    if (!soundBrowseJson.ok) setMsg(soundBrowseJson.json?.error || "Failed to load sound library");
    if (!musicBrowseJson.ok) setMsg(musicBrowseJson.json?.error || "Failed to load music library");
    if (!navJson.ok) setMsg(navJson.json?.error || "Failed to load nav settings");

    const rawSoundEffects = (effectsJson.json?.effects ?? []) as SoundEffectRow[];
    const effectByKey = new Map(rawSoundEffects.map((row) => [row.key, row]));
    const merged: SoundEffectRow[] = SOUND_EFFECT_PRESETS.map((preset) => {
      const row = effectByKey.get(preset.key);
      return {
        id: row?.id,
        key: preset.key,
        label: row?.label ?? preset.label,
        audio_url: row?.audio_url ?? "",
        category: row?.category ?? (preset.key.includes("music") ? "music" : "effect"),
        volume: row?.volume ?? 1,
        enabled: row?.enabled ?? true,
        loop: row?.loop ?? false,
      };
    });
    rawSoundEffects.forEach((row) => {
      if (!row.key || SOUND_EFFECT_PRESETS.find((p) => p.key === row.key)) return;
      merged.push(row);
    });
    setEffects(merged);
    setLibrary((badgeJson.json?.badges ?? []) as BadgeLibraryRow[]);
    setAvatars((avatarJson.json?.avatars ?? []) as AvatarRow[]);
    const rawEffects = (avatarEffectsJson.json?.effects ?? []) as AvatarEffectRow[];
    const effectMap = new Map(rawEffects.map((e) => [e.key, e]));
    const mergedEffects: AvatarEffectRow[] = AVATAR_EFFECT_PRESETS.map((preset) => {
      const row = effectMap.get(preset.key);
      return {
        id: row?.id,
        key: preset.key,
        name: row?.name ?? preset.name,
        unlock_level: row?.unlock_level ?? 1,
        unlock_points: row?.unlock_points ?? 0,
        config: row?.config ?? { density: 40, size: 6, speed: 6, opacity: 70 },
        render_mode: row?.render_mode ?? "particles",
        html: row?.html ?? "",
        css: row?.css ?? "",
        js: row?.js ?? "",
        enabled: row?.enabled ?? false,
      };
    });
    rawEffects.forEach((row) => {
      if (!row.key || AVATAR_EFFECT_PRESETS.find((preset) => preset.key === row.key)) return;
      mergedEffects.push(row);
    });
    setAvatarEffects(mergedEffects);
    setCornerBorders((cornerJson.json?.borders ?? []) as CornerBorderRow[]);
    setCardPlates((cardPlateJson.json?.plates ?? []) as CardPlateRow[]);
    if (cornerPosJson.ok && cornerPosJson.json?.settings) {
      setCornerPositions({
        dashboard_x: Number(cornerPosJson.json.settings.dashboard_x ?? -8),
        dashboard_y: Number(cornerPosJson.json.settings.dashboard_y ?? -8),
        dashboard_size: Number(cornerPosJson.json.settings.dashboard_size ?? 88),
        selector_x: Number(cornerPosJson.json.settings.selector_x ?? -8),
        selector_y: Number(cornerPosJson.json.settings.selector_y ?? -8),
        selector_size: Number(cornerPosJson.json.settings.selector_size ?? 84),
        skill_pulse_x: Number(cornerPosJson.json.settings.skill_pulse_x ?? -10),
        skill_pulse_y: Number(cornerPosJson.json.settings.skill_pulse_y ?? -10),
        skill_pulse_size: Number(cornerPosJson.json.settings.skill_pulse_size ?? 72),
        skill_pulse_tracker_x: Number(cornerPosJson.json.settings.skill_pulse_tracker_x ?? -10),
        skill_pulse_tracker_y: Number(cornerPosJson.json.settings.skill_pulse_tracker_y ?? -10),
        skill_pulse_tracker_size: Number(cornerPosJson.json.settings.skill_pulse_tracker_size ?? 72),
        live_activity_x: Number(cornerPosJson.json.settings.live_activity_x ?? -10),
        live_activity_y: Number(cornerPosJson.json.settings.live_activity_y ?? -10),
        live_activity_size: Number(cornerPosJson.json.settings.live_activity_size ?? 72),
        roster_x: Number(cornerPosJson.json.settings.roster_x ?? -8),
        roster_y: Number(cornerPosJson.json.settings.roster_y ?? -8),
        roster_size: Number(cornerPosJson.json.settings.roster_size ?? 96),
      });
      setCornerPositionsDirty(false);
    }
    if (cardPlatePosJson.ok && cardPlatePosJson.json?.settings) {
      setCardPlatePositions({
        dashboard_x: Number(cardPlatePosJson.json.settings.dashboard_x ?? 0),
        dashboard_y: Number(cardPlatePosJson.json.settings.dashboard_y ?? 0),
        dashboard_size: Number(cardPlatePosJson.json.settings.dashboard_size ?? 200),
        selector_x: Number(cardPlatePosJson.json.settings.selector_x ?? 0),
        selector_y: Number(cardPlatePosJson.json.settings.selector_y ?? 0),
        selector_size: Number(cardPlatePosJson.json.settings.selector_size ?? 200),
        skill_pulse_x: Number(cardPlatePosJson.json.settings.skill_pulse_x ?? 0),
        skill_pulse_y: Number(cardPlatePosJson.json.settings.skill_pulse_y ?? 0),
        skill_pulse_size: Number(cardPlatePosJson.json.settings.skill_pulse_size ?? 200),
        skill_pulse_tracker_x: Number(cardPlatePosJson.json.settings.skill_pulse_tracker_x ?? 0),
        skill_pulse_tracker_y: Number(cardPlatePosJson.json.settings.skill_pulse_tracker_y ?? 0),
        skill_pulse_tracker_size: Number(cardPlatePosJson.json.settings.skill_pulse_tracker_size ?? 120),
        live_activity_x: Number(cardPlatePosJson.json.settings.live_activity_x ?? 0),
        live_activity_y: Number(cardPlatePosJson.json.settings.live_activity_y ?? 0),
        live_activity_size: Number(cardPlatePosJson.json.settings.live_activity_size ?? 200),
        roster_x: Number(cardPlatePosJson.json.settings.roster_x ?? 0),
        roster_y: Number(cardPlatePosJson.json.settings.roster_y ?? 0),
        roster_size: Number(cardPlatePosJson.json.settings.roster_size ?? 220),
        taolu_tracker_x: Number(cardPlatePosJson.json.settings.taolu_tracker_x ?? 0),
        taolu_tracker_y: Number(cardPlatePosJson.json.settings.taolu_tracker_y ?? 0),
        taolu_tracker_size: Number(cardPlatePosJson.json.settings.taolu_tracker_size ?? 220),
        battle_pulse_x: Number(cardPlatePosJson.json.settings.battle_pulse_x ?? 0),
        battle_pulse_y: Number(cardPlatePosJson.json.settings.battle_pulse_y ?? 0),
        battle_pulse_size: Number(cardPlatePosJson.json.settings.battle_pulse_size ?? 240),
      });
      setCardPlatePositionsDirty(false);
    }

    setTimerSettings({
      music_url: String(timerJson.json?.settings?.music_url ?? ""),
      end_sound_key: String(timerJson.json?.settings?.end_sound_key ?? ""),
    });
    setTimerSettingsDirty(false);
    setNavSettings({
      logo_url: String(navJson.json?.settings?.logo_url ?? ""),
      logo_zoom: Number(navJson.json?.settings?.logo_zoom ?? 1) || 1,
    });
    setNavSettingsDirty(false);
    setSoundLibrary((soundBrowseJson.json?.items ?? []) as Array<{ path: string; public_url: string }>);
    setMusicLibrary((musicBrowseJson.json?.items ?? []) as Array<{ path: string; public_url: string }>);

    const usageRes = await fetch("/api/admin/avatars/usage", { cache: "no-store" });
    const usageJson = await safeJson(usageRes);
    if (usageJson.ok) setAvatarUsage((usageJson.json?.usage ?? {}) as Record<string, { count: number; students: Array<{ id: string; name: string; level?: number | null }> }>);
  }

  useEffect(() => {
    if (!pinOk) return;
    loadAll();
  }, [pinOk]);

  useEffect(() => {
    if (previewAvatarId || !avatars.length) return;
    if (avatars[0]?.id) setPreviewAvatarId(String(avatars[0].id));
  }, [avatars, previewAvatarId]);

  useEffect(() => {
    if (cornerPreviewAvatarId || !avatars.length) return;
    if (avatars[0]?.id) setCornerPreviewAvatarId(String(avatars[0].id));
  }, [avatars, cornerPreviewAvatarId]);

  useEffect(() => {
    if (cornerPositionPreviewKey || !cornerBorders.length) return;
    const first = cornerBorders.find((row) => row.enabled !== false) ?? cornerBorders[0];
    if (first?.key) setCornerPositionPreviewKey(String(first.key));
  }, [cornerBorders, cornerPositionPreviewKey]);

  const recentWindowMs = 7 * 24 * 60 * 60 * 1000;
  const recentCutoffMs = Date.now() - recentWindowMs;
  const isRecentDate = useCallback(
    (value?: string | null) => {
      if (!value) return false;
      const ts = Date.parse(value);
      return Number.isFinite(ts) && ts >= recentCutoffMs;
    },
    [recentCutoffMs]
  );
  const hasRecentUpload = useCallback((row: AvatarRow) => isRecentDate(row.created_at), [isRecentDate]);
  const hasRecentUpdate = useCallback((row: AvatarRow) => {
    const createdTs = Date.parse(String(row.created_at ?? ""));
    const updatedTs = Date.parse(String(row.updated_at ?? ""));
    if (!Number.isFinite(updatedTs) || updatedTs < recentCutoffMs) return false;
    if (!Number.isFinite(createdTs)) return true;
    return updatedTs - createdTs > 60 * 1000;
  }, [recentCutoffMs]);

  function stopPreviewAudio() {
    const audio = previewAudioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setPreviewPlayingUrl("");
    setSoundPreviewKey("");
    setMusicPreviewUrl("");
  }

  function playPreviewAudio(url: string, volume = 1, loop = false) {
    if (!url) return;
    if (!previewAudioRef.current) previewAudioRef.current = new Audio();
    const audio = previewAudioRef.current;
    if (previewPlayingUrl === url && !audio.paused) {
      stopPreviewAudio();
      return;
    }
    audio.pause();
    audio.src = url;
    audio.volume = Math.min(1, Math.max(0, Number(volume ?? 1)));
    audio.loop = loop;
    audio.currentTime = 0;
    audio.play().catch(() => {});
    setPreviewPlayingUrl(url);
  }

  async function saveEffect(row: SoundEffectRow) {
    setSaving(true);
    const res = await fetch("/api/admin/sound-effects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
    const sj = await safeJson(res);
    setSaving(false);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to save sound effect");
    setSavedId(row.id ?? row.key);
    window.setTimeout(() => setSavedId(null), 1600);
    if (!row.id) {
      setNewEffect({ key: "", label: "", audio_url: "", category: "effect", volume: 1, enabled: true, loop: false });
    }
    await loadAll();
  }

  async function saveBadgeLibrary(row: BadgeLibraryRow) {
    setSaving(true);
    const res = await fetch("/api/admin/badge-library/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
    const sj = await safeJson(res);
    setSaving(false);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to save badge");
    setSavedId(row.id ?? "new-badge");
    window.setTimeout(() => setSavedId(null), 1600);
    if (!row.id) {
      setNewBadge({ name: "", description: "", image_url: "", category: "", enabled: true });
    }
    await loadAll();
  }

  async function saveAvatar(
    row: AvatarRow,
    opts?: { skipReload?: boolean; silent?: boolean; suppressSavedChip?: boolean }
  ) {
    if (!row.id && !String(row.storage_path ?? "").trim()) {
      if (!opts?.silent) setMsg("Upload or browse an avatar image first (storage path is empty).");
      return;
    }
    setSaving(true);
    const level = Number(row.unlock_level ?? 1);
    const unlock_level = Number.isFinite(level) && level > 0 ? Math.floor(level) : 1;
    const unlock_points = Math.max(0, Math.floor(Number(row.unlock_points ?? 0)));
    const rule_keeper_multiplier = clampMultiplier(Number(row.rule_keeper_multiplier ?? 1));
    const rule_breaker_multiplier = clampMultiplier(Number(row.rule_breaker_multiplier ?? 1));
    const skill_pulse_multiplier = clampMultiplier(Number(row.skill_pulse_multiplier ?? 1));
    const spotlight_multiplier = clampMultiplier(Number(row.spotlight_multiplier ?? 1));
    const daily_free_points = Math.max(0, Math.floor(Number(row.daily_free_points ?? 0)));
    const challenge_completion_bonus_pct = Math.max(0, Number(row.challenge_completion_bonus_pct ?? 0));
    const mvp_bonus_pct = Math.max(0, Number(row.mvp_bonus_pct ?? 0));
    const zoom_pct = Math.max(50, clampZoom(Number(row.zoom_pct ?? 100)));
    const competition_discount_pct = Math.max(0, Math.min(100, Math.floor(Number(row.competition_discount_pct ?? 0))));
    const res = await fetch("/api/admin/avatars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...row,
        unlock_level,
        unlock_points,
        rule_keeper_multiplier,
        rule_breaker_multiplier,
        skill_pulse_multiplier,
        spotlight_multiplier,
        daily_free_points,
        challenge_completion_bonus_pct,
        mvp_bonus_pct,
        zoom_pct,
        competition_discount_pct,
      }),
    });
    const sj = await safeJson(res);
    setSaving(false);
    if (!sj.ok) {
      if (!opts?.silent) setMsg(sj.json?.error || "Failed to save avatar");
      return;
    }
    if (!opts?.suppressSavedChip) {
      setSavedId(row.id ?? row.name);
      window.setTimeout(() => setSavedId(null), 1600);
    }
    if (!row.id) {
      setNewAvatar({
        name: "",
        storage_path: "",
        enabled: true,
        is_secondary: false,
        unlock_level: 1,
        unlock_points: 0,
        rule_keeper_multiplier: 1,
        rule_breaker_multiplier: 1,
        skill_pulse_multiplier: 1,
        spotlight_multiplier: 1,
        daily_free_points: 0,
        challenge_completion_bonus_pct: 0,
        mvp_bonus_pct: 0,
        zoom_pct: 100,
        competition_only: false,
        competition_discount_pct: 0,
        limited_event_only: false,
        limited_event_name: "",
        limited_event_description: "",
      });
    }
    if (!opts?.skipReload || !row.id) {
      await loadAll();
    }
  }

  async function saveAvatarEffect(row: AvatarEffectRow) {
    setSaving(true);
    const level = Number(row.unlock_level ?? 1);
    const unlock_level = Number.isFinite(level) && level > 0 ? Math.floor(level) : 1;
    const unlock_points = Math.max(0, Math.floor(Number(row.unlock_points ?? 0)));
    const res = await fetch("/api/admin/avatar-effects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...row, unlock_level, unlock_points }),
    });
    const sj = await safeJson(res);
    setSaving(false);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to save avatar effect");
    setSavedId(row.id ?? row.key);
    window.setTimeout(() => setSavedId(null), 1600);
    await loadAll();
  }

  async function saveCornerBorder(row: CornerBorderRow) {
    setSaving(true);
    const level = Number(row.unlock_level ?? 1);
    const unlock_level = Number.isFinite(level) && level > 0 ? Math.floor(level) : 1;
    const unlock_points = Math.max(0, Math.floor(Number(row.unlock_points ?? 0)));
    const res = await fetch("/api/admin/corner-borders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...row, unlock_level, unlock_points }),
    });
    const sj = await safeJson(res);
    setSaving(false);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to save corner border");
    setSavedId(row.id ?? row.key);
    window.setTimeout(() => setSavedId(null), 1600);
    if (!row.id) {
      setNewCornerBorder({
        key: "",
        name: "",
        image_url: "",
        render_mode: "image",
        z_layer: "above_avatar",
        offset_x: 0,
        offset_y: 0,
        offsets_by_context: {},
        html: "",
        css: "",
        js: "",
        unlock_level: 1,
        unlock_points: 0,
        rule_keeper_multiplier: 1,
        rule_breaker_multiplier: 1,
        skill_pulse_multiplier: 1,
        spotlight_multiplier: 1,
        daily_free_points: 0,
        challenge_completion_bonus_pct: 0,
        mvp_bonus_pct: 0,
        limited_event_only: false,
        limited_event_name: "",
        limited_event_description: "",
        enabled: true,
      });
    }
    await loadAll();
  }

  async function saveCardPlate(row: CardPlateRow) {
    setSaving(true);
    const level = Number(row.unlock_level ?? 1);
    const unlock_level = Number.isFinite(level) && level > 0 ? Math.floor(level) : 1;
    const unlock_points = Math.max(0, Math.floor(Number(row.unlock_points ?? 0)));
    const res = await fetch("/api/admin/card-plates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...row, unlock_level, unlock_points }),
    });
    const sj = await safeJson(res);
    setSaving(false);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to save card plate");
    setSavedId(row.id ?? row.key);
    window.setTimeout(() => setSavedId(null), 1600);
    if (!row.id) {
      setNewCardPlate({ key: "", name: "", image_url: "", unlock_level: 1, unlock_points: 0, enabled: true });
    }
    await loadAll();
  }

  async function openPicker(target: { type: "new" | "row"; id?: string }) {
    setPickerTarget(target);
    setPickerError("");
    setPickerOpen(true);
    if (bucketFiles.length) return;
    setPickerLoading(true);
    const res = await fetch("/api/admin/badge-library/browse", { cache: "no-store" });
    const sj = await safeJson(res);
    setPickerLoading(false);
    if (!sj.ok) {
      setPickerError(sj.json?.error || "Failed to load storage items");
      return;
    }
    setBucketFiles((sj.json?.items ?? []) as { path: string; public_url: string }[]);
  }

  function selectFromBucket(publicUrl: string) {
    if (!pickerTarget) return;
    if (pickerTarget.type === "new") {
      setNewBadge((prev) => ({ ...prev, image_url: publicUrl }));
    } else {
      setLibrary((prev) => prev.map((row) => (row.id === pickerTarget.id ? { ...row, image_url: publicUrl } : row)));
    }
    setPickerOpen(false);
  }

  async function openAvatarPicker(target: { type: "new" | "row"; id?: string }) {
    setAvatarPickerTarget(target);
    setAvatarPickerError("");
    setAvatarPickerOpen(true);
    if (avatarBucketFiles.length) return;
    setAvatarPickerLoading(true);
    const res = await fetch("/api/admin/avatars/browse", { cache: "no-store" });
    const sj = await safeJson(res);
    setAvatarPickerLoading(false);
    if (!sj.ok) {
      setAvatarPickerError(sj.json?.error || "Failed to load avatar storage");
      return;
    }
    setAvatarBucketFiles((sj.json?.items ?? []) as { path: string; public_url: string }[]);
  }

  function selectAvatarFromBucket(path: string) {
    if (!avatarPickerTarget) return;
    if (avatarPickerTarget.type === "new") {
      setNewAvatar((prev) => ({ ...prev, storage_path: path }));
    } else {
      setAvatars((prev) => prev.map((row) => (row.id === avatarPickerTarget.id ? { ...row, storage_path: path } : row)));
    }
    setAvatarPickerOpen(false);
  }

  async function openCornerPicker(target: { type: "new" | "row"; id?: string }) {
    setCornerPickerTarget(target);
    setCornerPickerError("");
    setCornerPickerOpen(true);
    if (cornerBucketFiles.length) return;
    setCornerPickerLoading(true);
    const res = await fetch("/api/admin/corner-borders/browse", { cache: "no-store" });
    const sj = await safeJson(res);
    setCornerPickerLoading(false);
    if (!sj.ok) {
      setCornerPickerError(sj.json?.error || "Failed to load corner borders");
      return;
    }
    setCornerBucketFiles((sj.json?.items ?? []) as { path: string; public_url: string }[]);
  }

  function selectCornerFromBucket(publicUrl: string) {
    if (!cornerPickerTarget) return;
    if (cornerPickerTarget.type === "new") {
      setNewCornerBorder((prev) => ({ ...prev, image_url: publicUrl }));
    } else {
      setCornerBorders((prev) => prev.map((row) => (row.id === cornerPickerTarget.id ? { ...row, image_url: publicUrl } : row)));
    }
    setCornerPickerOpen(false);
  }

  async function uploadCornerBorder(file: File | null, target: { type: "new" | "row"; id?: string }) {
    if (!file) return;
    setCornerUploading(true);
    setMsg("");
    try {
      const data = new FormData();
      data.append("file", file);
      const res = await fetch("/api/admin/corner-borders/upload", { method: "POST", body: data });
      const sj = await safeJson(res);
      if (!sj.ok) throw new Error(sj.json?.error || "Failed to upload corner border");
      const publicUrl = String(sj.json?.public_url ?? "");
      if (!publicUrl) throw new Error("Missing uploaded border URL");
      if (target.type === "new") {
        setNewCornerBorder((prev) => ({ ...prev, image_url: publicUrl }));
      } else {
        setCornerBorders((prev) => prev.map((row) => (row.id === target.id ? { ...row, image_url: publicUrl } : row)));
      }
    } catch (err: any) {
      setMsg(err?.message ?? "Failed to upload corner border");
    } finally {
      setCornerUploading(false);
    }
  }

  async function openPlatePicker(target: { type: "new" | "row"; id?: string }) {
    setPlatePickerTarget(target);
    setPlatePickerError("");
    setPlatePickerOpen(true);
    if (plateBucketFiles.length) return;
    setPlatePickerLoading(true);
    const res = await fetch("/api/admin/card-plates/browse", { cache: "no-store" });
    const sj = await safeJson(res);
    setPlatePickerLoading(false);
    if (!sj.ok) {
      setPlatePickerError(sj.json?.error || "Failed to load card plates");
      return;
    }
    setPlateBucketFiles((sj.json?.items ?? []) as { path: string; public_url: string }[]);
  }

  function selectPlateFromBucket(publicUrl: string) {
    if (!platePickerTarget) return;
    if (platePickerTarget.type === "new") {
      setNewCardPlate((prev) => ({ ...prev, image_url: publicUrl }));
    } else {
      setCardPlates((prev) => prev.map((row) => (row.id === platePickerTarget.id ? { ...row, image_url: publicUrl } : row)));
    }
    setPlatePickerOpen(false);
  }

  async function uploadCardPlate(file: File | null, target: { type: "new" | "row"; id?: string }) {
    if (!file) return;
    setPlateUploading(true);
    setMsg("");
    try {
      const data = new FormData();
      data.append("file", file);
      const res = await fetch("/api/admin/card-plates/upload", { method: "POST", body: data });
      const sj = await safeJson(res);
      if (!sj.ok) throw new Error(sj.json?.error || "Failed to upload card plate");
      const publicUrl = String(sj.json?.public_url ?? "");
      if (!publicUrl) throw new Error("Missing uploaded plate URL");
      if (target.type === "new") {
        setNewCardPlate((prev) => ({ ...prev, image_url: publicUrl }));
      } else {
        setCardPlates((prev) => prev.map((row) => (row.id === target.id ? { ...row, image_url: publicUrl } : row)));
      }
    } catch (err: any) {
      setMsg(err?.message ?? "Failed to upload card plate");
    } finally {
      setPlateUploading(false);
    }
  }

  async function uploadAvatar(file: File | null, target: { type: "new" | "row"; id?: string }) {
    if (!file) return;
    setAvatarUploading(true);
    setAvatarUploadTargetId(target.type === "new" ? "new" : String(target.id ?? ""));
    setAvatarUploadProgress(12);
    setAvatarUploadStatus("Uploading...");
    const nudge = window.setTimeout(() => setAvatarUploadProgress(62), 350);
    const data = new FormData();
    data.append("file", file);
    const res = await fetch("/api/admin/avatars/upload", { method: "POST", body: data });
    const sj = await safeJson(res);
    setAvatarUploading(false);
    window.clearTimeout(nudge);
    if (!sj.ok) {
      setMsg(sj.json?.error || "Failed to upload avatar");
      setAvatarUploadProgress(null);
      setAvatarUploadStatus("");
      return;
    }
    const path = String(sj.json?.path ?? "");
    if (!path) {
      setAvatarUploadProgress(null);
      setAvatarUploadStatus("");
      return;
    }
    if (target.type === "new") {
      setNewAvatar((prev) => ({ ...prev, storage_path: path }));
    } else {
      setAvatars((prev) => prev.map((row) => (row.id === target.id ? { ...row, storage_path: path } : row)));
    }
    setAvatarUploadProgress(100);
    setAvatarUploadStatus("Upload complete");
    window.setTimeout(() => {
      setAvatarUploadProgress(null);
      setAvatarUploadStatus("");
    }, 1200);
  }

  async function uploadAvatarBulk(files: FileList | null) {
    if (!files || !files.length) return;
    setAvatarBulkUploading(true);
    setMsg("");
    try {
      const data = new FormData();
      data.append("bulk", "1");
      Array.from(files).forEach((file) => data.append("files", file));
      const res = await fetch("/api/admin/avatars/upload", { method: "POST", body: data });
      const sj = await safeJson(res);
      if (!sj.ok) throw new Error(sj.json?.error || "Failed to bulk upload avatars");
      const createdCount = Array.isArray(sj.json?.created) ? sj.json.created.length : 0;
      setMsg(createdCount > 0 ? `Uploaded ${createdCount} avatars. Review and enable when ready.` : "Bulk upload complete.");
      await loadAll();
    } catch (err: any) {
      setMsg(err?.message ?? "Failed to bulk upload avatars");
    } finally {
      setAvatarBulkUploading(false);
    }
  }

  async function uploadSound(file: File | null, targetKey: string) {
    if (!file) return;
    if (!targetKey) return setMsg("Sound effect key missing.");
    setSoundUploading(true);
    setMsg("");
    try {
      const data = new FormData();
      data.append("file", file);
      const res = await fetch("/api/admin/sound-effects/upload", { method: "POST", body: data });
      const sj = await safeJson(res);
      if (!sj.ok) throw new Error(sj.json?.error || "Failed to upload sound");
      const publicUrl = String(sj.json?.public_url ?? "");
      if (!publicUrl) throw new Error("Missing uploaded sound URL");
      setEffects((prev) => prev.map((row) => (row.key === targetKey ? { ...row, audio_url: publicUrl } : row)));
      setSoundLibrary((prev) => [{ path: sj.json?.path ?? "", public_url: publicUrl }, ...prev]);
    } catch (err: any) {
      setMsg(err?.message ?? "Failed to upload sound");
    } finally {
      setSoundUploading(false);
    }
  }

  async function uploadMusic(file: File | null, targetKey: string) {
    if (!file) return;
    if (!targetKey) return setMsg("Music key missing.");
    setMusicUploading(true);
    setMsg("");
    try {
      const data = new FormData();
      data.append("file", file);
      const res = await fetch("/api/admin/music/upload", { method: "POST", body: data });
      const sj = await safeJson(res);
      if (!sj.ok) throw new Error(sj.json?.error || "Failed to upload music");
      const publicUrl = String(sj.json?.public_url ?? "");
      if (!publicUrl) throw new Error("Missing uploaded music URL");
      if (targetKey !== "music_library") {
        setEffects((prev) => prev.map((row) => (row.key === targetKey ? { ...row, audio_url: publicUrl } : row)));
      }
      setMusicLibrary((prev) => [{ path: sj.json?.path ?? "", public_url: publicUrl }, ...prev]);
    } catch (err: any) {
      setMsg(err?.message ?? "Failed to upload music");
    } finally {
      setMusicUploading(false);
    }
  }

  async function uploadNavLogo(file: File | null) {
    if (!file) return;
    setNavUploading(true);
    setMsg("");
    try {
      const data = new FormData();
      data.append("file", file);
      const res = await fetch("/api/admin/nav-logo/upload", { method: "POST", body: data });
      const sj = await safeJson(res);
      if (!sj.ok) throw new Error(sj.json?.error || "Failed to upload nav logo");
      const publicUrl = String(sj.json?.public_url ?? "");
      if (!publicUrl) throw new Error("Missing nav logo URL");
      setNavSettings((prev) => ({ ...prev, logo_url: publicUrl }));
      setNavSettingsDirty(true);
    } catch (err: any) {
      setMsg(err?.message ?? "Failed to upload nav logo");
    } finally {
      setNavUploading(false);
    }
  }

  async function saveTimerSettings() {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/timer-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(timerSettings),
      });
      const sj = await safeJson(res);
      if (!sj.ok) throw new Error(sj.json?.error || "Failed to save timer settings");
      setTimerSettings({
        music_url: String(sj.json?.settings?.music_url ?? ""),
        end_sound_key: String(sj.json?.settings?.end_sound_key ?? ""),
      });
      setTimerSettingsDirty(false);
    } catch (err: any) {
      setMsg(err?.message ?? "Failed to save timer settings");
    } finally {
      setSaving(false);
    }
  }

  async function saveAll() {
    setSaving(true);
    setMsg("");
    setSaveAllDone(false);
    try {
      if (!avatarView) {
        for (const row of effects) {
          if (!row.key || !row.label) continue;
          const res = await fetch("/api/admin/sound-effects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(row),
          });
          const sj = await safeJson(res);
          if (!sj.ok) throw new Error(sj.json?.error || "Failed to save sound effects");
        }
        for (const row of library) {
          if (!row.name) continue;
          const res = await fetch("/api/admin/badge-library/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(row),
          });
          const sj = await safeJson(res);
          if (!sj.ok) throw new Error(sj.json?.error || "Failed to save badge library");
        }
      }
      if (avatarView) {
        for (const row of avatars) {
          if (!row.name || !row.storage_path) continue;
          const level = Number(row.unlock_level ?? 1);
          const unlock_level = Number.isFinite(level) && level > 0 ? Math.floor(level) : 1;
          const unlock_points = Math.max(0, Math.floor(Number(row.unlock_points ?? 0)));
          const res = await fetch("/api/admin/avatars", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...row, unlock_level, unlock_points }),
          });
          const sj = await safeJson(res);
          if (!sj.ok) throw new Error(sj.json?.error || "Failed to save avatars");
        }
        for (const row of avatarEffects) {
          if (!row.key || !row.name) continue;
          const level = Number(row.unlock_level ?? 1);
          const unlock_level = Number.isFinite(level) && level > 0 ? Math.floor(level) : 1;
          const unlock_points = Math.max(0, Math.floor(Number(row.unlock_points ?? 0)));
          const res = await fetch("/api/admin/avatar-effects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...row, unlock_level, unlock_points }),
          });
          const sj = await safeJson(res);
          if (!sj.ok) throw new Error(sj.json?.error || "Failed to save avatar effects");
        }
        for (const row of cornerBorders) {
          if (!row.key || !row.name) continue;
          const level = Number(row.unlock_level ?? 1);
          const unlock_level = Number.isFinite(level) && level > 0 ? Math.floor(level) : 1;
          const unlock_points = Math.max(0, Math.floor(Number(row.unlock_points ?? 0)));
          const res = await fetch("/api/admin/corner-borders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...row, unlock_level, unlock_points }),
          });
          const sj = await safeJson(res);
          if (!sj.ok) throw new Error(sj.json?.error || "Failed to save corner borders");
        }
        for (const row of cardPlates) {
          if (!row.key || !row.name) continue;
          const level = Number(row.unlock_level ?? 1);
          const unlock_level = Number.isFinite(level) && level > 0 ? Math.floor(level) : 1;
          const unlock_points = Math.max(0, Math.floor(Number(row.unlock_points ?? 0)));
          const res = await fetch("/api/admin/card-plates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...row, unlock_level, unlock_points }),
          });
          const sj = await safeJson(res);
          if (!sj.ok) throw new Error(sj.json?.error || "Failed to save card plates");
        }
      }
      if (avatarView && cornerPositionsDirty) {
        const res = await fetch("/api/admin/corner-borders/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cornerPositions),
        });
        const sj = await safeJson(res);
        if (!sj.ok) throw new Error(sj.json?.error || "Failed to save corner positions");
        setCornerPositionsDirty(false);
      }
      if (avatarView && cardPlatePositionsDirty) {
        const res = await fetch("/api/admin/card-plates/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cardPlatePositions),
        });
        const sj = await safeJson(res);
        if (!sj.ok) throw new Error(sj.json?.error || "Failed to save card plate positions");
        setCardPlatePositionsDirty(false);
      }
      if (!avatarView && timerSettingsDirty) {
        const res = await fetch("/api/admin/timer-settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(timerSettings),
        });
        const sj = await safeJson(res);
        if (!sj.ok) throw new Error(sj.json?.error || "Failed to save timer settings");
        setTimerSettingsDirty(false);
      }
      if (!avatarView && navSettingsDirty) {
        const res = await fetch("/api/admin/nav-settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(navSettings),
        });
        const sj = await safeJson(res);
        if (!sj.ok) throw new Error(sj.json?.error || "Failed to save nav settings");
        setNavSettingsDirty(false);
      }
      setSaveAllDone(true);
      window.setTimeout(() => setSaveAllDone(false), 1600);
      await loadAll();
    } catch (err: any) {
      setMsg(err?.message ?? "Failed to save all");
    } finally {
      setSaving(false);
    }
  }

  const categoryLabels = avatarView ? AVATAR_CATEGORIES : MEDIA_CATEGORIES;
  const soundCategoryOptions = useMemo(() => {
    const labels = new Set<string>();
    effects.forEach((row) => labels.add(displaySoundCategory(row.category)));
    return Array.from(labels).sort((a, b) => a.localeCompare(b));
  }, [effects]);
  const filteredEffects = useMemo(() => {
    if (!soundCategoryFilters.length) return effects;
    return effects.filter((row) => soundCategoryFilters.includes(displaySoundCategory(row.category)));
  }, [effects, soundCategoryFilters]);

  useEffect(() => {
    if (categoryLabels.includes(activeCategory)) return;
    setActiveCategory("All");
  }, [activeCategory, categoryLabels]);

  function toggleSoundCategory(label: string) {
    if (label === "All") {
      setSoundCategoryFilters([]);
      return;
    }
    setSoundCategoryFilters((prev) => {
      if (prev.includes(label)) return prev.filter((item) => item !== label);
      return [...prev, label];
    });
  }

  const avatarBase = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previewAvatar = avatars.find((a) => String(a.id ?? "") === previewAvatarId) ?? avatars[0] ?? null;
  const previewSrc = previewAvatar?.storage_path && avatarBase
    ? `${avatarBase}/storage/v1/object/public/avatars/${previewAvatar.storage_path}`
    : "";
  const cornerPreviewAvatarItem = avatars.find((a) => String(a.id ?? "") === String(cornerPreviewAvatarId ?? "")) ?? null;
  const cornerPreviewSrc = cornerPreviewAvatarItem?.storage_path && avatarBase
    ? `${avatarBase}/storage/v1/object/public/avatars/${cornerPreviewAvatarItem.storage_path}`
    : "";
  const selectedPreviewCorner =
    cornerBorders.find((row) => String(row.key) === String(cornerPositionPreviewKey)) ??
    cornerBorders.find((row) => row.enabled !== false) ??
    null;
  const previewCornerUrl =
    String(newCornerBorder.image_url ?? "").trim() ||
    String(selectedPreviewCorner?.image_url ?? "");
  const previewCornerCode =
    selectedPreviewCorner?.render_mode === "code"
      ? buildCodePreview(selectedPreviewCorner?.html, selectedPreviewCorner?.css)
      : "";
  const previewPlateUrl =
    String(newCardPlate.image_url ?? "").trim() ||
    String(cardPlates.find((row) => row.enabled !== false && row.image_url)?.image_url ?? "");
  const avatarsByLevel = avatars.reduce((acc: Record<string, AvatarRow[]>, row) => {
    const key = String(row.unlock_level ?? 1);
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});
  const avatarLevels = Object.keys(avatarsByLevel).sort((a, b) => Number(a) - Number(b));

  function avatarSignature(row: AvatarRow) {
    return JSON.stringify({
      name: String(row.name ?? ""),
      storage_path: String(row.storage_path ?? ""),
      enabled: row.enabled !== false,
      is_secondary: row.is_secondary === true,
      unlock_level: Number(row.unlock_level ?? 1),
      unlock_points: Number(row.unlock_points ?? 0),
      rule_keeper_multiplier: Number(row.rule_keeper_multiplier ?? 1),
      rule_breaker_multiplier: Number(row.rule_breaker_multiplier ?? 1),
      skill_pulse_multiplier: Number(row.skill_pulse_multiplier ?? 1),
      spotlight_multiplier: Number(row.spotlight_multiplier ?? 1),
      daily_free_points: Number(row.daily_free_points ?? 0),
      challenge_completion_bonus_pct: Number(row.challenge_completion_bonus_pct ?? 0),
      mvp_bonus_pct: Number(row.mvp_bonus_pct ?? 0),
      zoom_pct: Number(row.zoom_pct ?? 100),
      competition_only: row.competition_only === true,
      competition_discount_pct: Number(row.competition_discount_pct ?? 0),
      limited_event_only: row.limited_event_only === true,
      limited_event_name: String(row.limited_event_name ?? ""),
      limited_event_description: String(row.limited_event_description ?? ""),
    });
  }

  function copyAvatarSettingsFrom(targetId: string, source: AvatarRow) {
    setAvatars((prev) =>
      prev.map((r) =>
        String(r.id ?? "") === String(targetId)
          ? {
              ...r,
              unlock_level: source.unlock_level ?? 1,
              unlock_points: source.unlock_points ?? 0,
              rule_keeper_multiplier: source.rule_keeper_multiplier ?? 1,
              rule_breaker_multiplier: source.rule_breaker_multiplier ?? 1,
              skill_pulse_multiplier: source.skill_pulse_multiplier ?? 1,
              spotlight_multiplier: source.spotlight_multiplier ?? 1,
              daily_free_points: source.daily_free_points ?? 0,
              challenge_completion_bonus_pct: source.challenge_completion_bonus_pct ?? 0,
              mvp_bonus_pct: source.mvp_bonus_pct ?? 0,
              zoom_pct: source.zoom_pct ?? 100,
            }
          : r
      )
    );
    setCopyOpenAvatarId("");
  }

  function commitAvatarUnlockLevel(rowId: string) {
    const key = String(rowId ?? "");
    if (!key) return;
    const draft = avatarUnlockLevelDrafts[key];
    if (draft === undefined) return;
    const raw = digitsOnly(draft);
    setAvatars((prev) =>
      prev.map((r) =>
        String(r.id ?? "") === key ? { ...r, unlock_level: raw === "" ? null : Number(raw) } : r
      )
    );
    setAvatarUnlockLevelDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  useEffect(() => {
    avatarsRef.current = avatars;
  }, [avatars]);

  useEffect(() => {
    const nextSigs: Record<string, string> = {};
    avatars.forEach((row) => {
      const id = String(row.id ?? "");
      if (!id) return;
      const sig = avatarSignature(row);
      nextSigs[id] = sig;
      const prevSig = avatarSignaturesRef.current[id];
      if (prevSig !== undefined && prevSig !== sig) {
        if (avatarAutosaveTimersRef.current[id]) {
          window.clearTimeout(avatarAutosaveTimersRef.current[id]);
        }
        avatarAutosaveTimersRef.current[id] = window.setTimeout(async () => {
          const latest = avatarsRef.current.find((a) => String(a.id ?? "") === id);
          if (!latest) return;
          setAutoSavingAvatarIds((prev) => ({ ...prev, [id]: true }));
          await saveAvatar(latest, { skipReload: true, silent: true, suppressSavedChip: true });
          setAutoSavingAvatarIds((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }, 700);
      }
    });
    avatarSignaturesRef.current = nextSigs;
  }, [avatars]);

  useEffect(() => {
    return () => {
      Object.values(avatarAutosaveTimersRef.current).forEach((timerId) => window.clearTimeout(timerId));
    };
  }, []);

  if (!pinOk) return null;

  return (
    <main style={{ display: "grid", gap: 18 }}>
      <style>{`
        @keyframes spinOrbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes sparkPulse { 0% { opacity: 0.6; transform: scale(0.96); } 50% { opacity: 1; transform: scale(1.03); } 100% { opacity: 0.6; transform: scale(0.96); } }
      `}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 1000 }}>
            {avatarView ? "Avatar Design and Settings" : "Media Vault"}
          </div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            {avatarView
              ? "Configure avatars, effects, and display treatments."
              : "Curate audio, badge art, and app branding for the app."}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button style={button(saveAllDone)} disabled={saving} onClick={saveAll}>
            {saveAllDone ? "Saved" : "Save All"}
          </button>
          <button style={ghostButton(false)} type="button" onClick={stopPreviewAudio}>
            Stop Preview Audio
          </button>
          <Link href="/admin/custom" style={backButton()}>
            Back
          </Link>
        </div>
      </div>

      <div style={categoryBar()}>
        {categoryLabels.map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => setActiveCategory(label)}
            style={categoryButton(activeCategory === label)}
          >
            {label}
          </button>
        ))}
      </div>

      {msg ? <div style={{ color: "#fca5a5", fontSize: 12 }}>{msg}</div> : null}

      {!avatarView && (activeCategory === "All" || activeCategory === "Sound") ? (
        <section style={sectionCard()}>
        <div style={{ fontWeight: 1000, fontSize: 16 }}>Sound Effects</div>
        <div style={{ opacity: 0.7, fontSize: 12 }}>
          Assign audio to each purpose. Upload files to `audio/sound-effects` or pick from library.
        </div>
        <div style={chipRow()}>
          <button
            type="button"
            onClick={() => toggleSoundCategory("All")}
            style={chipButton(!soundCategoryFilters.length)}
          >
            All
          </button>
          {soundCategoryOptions.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => toggleSoundCategory(label)}
              style={chipButton(soundCategoryFilters.includes(label))}
            >
              {label}
            </button>
          ))}
        </div>
        <div style={soundGrid()}>
          {filteredEffects.map((row) => {
            const preset = SOUND_EFFECT_PRESETS.find((p) => p.key === row.key);
            const categoryParts = parseSoundCategory(row.category);
            const isMusic = categoryParts.type === "music";
            return (
              <div
                key={row.id ?? row.key}
                style={soundCard()}
              >
                <div style={soundCardHeader()}>
                  <div style={{ fontWeight: 900, ...truncateLine() }}>{preset?.purpose ?? "Custom effect"}</div>
                  <div style={{ fontSize: 11, opacity: 0.7, ...truncateLine() }}>{row.key}</div>
                </div>
                <label style={fieldLabel()}>
                  Label
                  <input
                    value={row.label}
                    onChange={(e) => setEffects((prev) => prev.map((r) => (r === row ? { ...r, label: e.target.value } : r)))}
                    style={input()}
                    placeholder="Label"
                  />
                </label>
                <div style={soundCardRow()}>
                  <label style={fieldLabel()}>
                    Type
                    <select
                      value={categoryParts.type}
                      onChange={(e) => {
                        const nextType = e.target.value as "effect" | "music";
                        const nextCategory = formatSoundCategory(nextType, categoryParts.label);
                        setEffects((prev) => prev.map((r) => (r === row ? { ...r, category: nextCategory } : r)));
                      }}
                      style={input()}
                    >
                      <option value="effect">Effect</option>
                      <option value="music">Music</option>
                    </select>
                  </label>
                  <label style={fieldLabel()}>
                    Category
                    <input
                      value={categoryParts.label}
                      onChange={(e) => {
                        const nextCategory = formatSoundCategory(categoryParts.type, e.target.value);
                        setEffects((prev) => prev.map((r) => (r === row ? { ...r, category: nextCategory } : r)));
                      }}
                      style={input()}
                      placeholder="Category"
                    />
                  </label>
                </div>
                <label style={fieldLabel()}>
                  Library
                  <select
                    value={row.audio_url ?? ""}
                    onChange={(e) => setEffects((prev) => prev.map((r) => (r === row ? { ...r, audio_url: e.target.value } : r)))}
                    style={{ ...input(), ...truncateLine() }}
                  >
                    <option value="">Select from library</option>
                    {(isMusic ? musicLibrary : soundLibrary).map((item) => (
                      <option key={item.public_url} value={item.public_url}>
                        {item.path}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={fieldLabel()}>
                  URL
                  <input
                    value={row.audio_url ?? ""}
                    onChange={(e) => setEffects((prev) => prev.map((r) => (r === row ? { ...r, audio_url: e.target.value } : r)))}
                    style={{ ...input(), ...truncateLine() }}
                    placeholder="Or paste URL"
                  />
                </label>
                <div style={soundCardRow()}>
                  <label style={fieldLabel()}>
                    Volume
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={row.volume ?? 1}
                      onChange={(e) => setEffects((prev) => prev.map((r) => (r === row ? { ...r, volume: Number(e.target.value) } : r)))}
                      style={input()}
                    />
                  </label>
                  <label style={{ ...checkboxWrap(), marginTop: 18 }}>
                    <input
                      type="checkbox"
                      checked={row.enabled !== false}
                      onChange={(e) => setEffects((prev) => prev.map((r) => (r === row ? { ...r, enabled: e.target.checked } : r)))}
                    />
                    Enabled
                  </label>
                </div>
                <div style={soundCardRow()}>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) =>
                      isMusic
                        ? uploadMusic(e.target.files?.[0] ?? null, row.key)
                        : uploadSound(e.target.files?.[0] ?? null, row.key)
                    }
                    disabled={isMusic ? musicUploading : soundUploading}
                    style={fileInput()}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const url = String(row.audio_url ?? "");
                      if (!url) return;
                      playPreviewAudio(url, row.volume ?? 1, isMusic);
                      setSoundPreviewKey((prev) => (prev === row.key ? "" : row.key));
                    }}
                    style={{ ...ghostButton(soundPreviewKey === row.key), width: "100%" }}
                  >
                    {soundPreviewKey === row.key ? "Stop" : "Preview"}
                  </button>
                  <button
                    style={{ ...button(savedId === row.id), width: "100%" }}
                    disabled={saving}
                    onClick={() => saveEffect(row)}
                  >
                    {savedId === row.id ? "Saved" : "Save"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        </section>
      ) : null}

      {!avatarView && (activeCategory === "All" || activeCategory === "Sound" || activeCategory === "Music") ? (
        <section style={sectionCard()}>
          <div style={{ fontWeight: 1000, fontSize: 16 }}>Music Library</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            Upload music to `music/tracks` and select from the music library when setting music sounds.
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => uploadMusic(e.target.files?.[0] ?? null, "music_library")}
              disabled={musicUploading}
              style={fileInput()}
            />
            {musicUploading ? <div style={{ fontSize: 12, opacity: 0.7 }}>Uploading...</div> : null}
          </div>
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {musicLibrary.map((item) => (
              <div key={item.public_url} style={libraryRow()}>
                <div style={{ fontWeight: 800 }}>{item.path}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      playPreviewAudio(item.public_url, 0.9, true);
                      setMusicPreviewUrl((prev) => (prev === item.public_url ? "" : item.public_url));
                    }}
                    style={ghostButton(musicPreviewUrl === item.public_url)}
                  >
                    {musicPreviewUrl === item.public_url ? "Stop" : "Preview"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      navigator.clipboard?.writeText(item.public_url).catch(() => {})
                    }
                    style={ghostButton(false)}
                  >
                    Copy URL
                  </button>
                </div>
              </div>
            ))}
            {!musicLibrary.length ? <div style={{ opacity: 0.6, fontSize: 12 }}>No music uploaded yet.</div> : null}
          </div>
        </section>
      ) : null}

      {avatarView && (activeCategory === "All" || activeCategory === "Corner Badges") ? (
        <section style={sectionCard()}>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 1000 }}>Corner Borders</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>
              Upload corner badge art (top-left + bottom-right) and set the unlock level.
            </div>
            <label style={{ fontSize: 12, opacity: 0.8, maxWidth: 320 }}>
              Preview avatar
              <select
                value={cornerPreviewAvatarId}
                onChange={(e) => setCornerPreviewAvatarId(e.target.value)}
                style={{ ...input(), marginTop: 6 }}
              >
                {avatars.map((a) => (
                  <option key={a.id ?? a.name} value={String(a.id ?? "")}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <div style={cornerGrid()}>
              <div style={cornerCard()}>
                <div style={cornerPreview()}>
                  {cornerPreviewSrc ? <img src={cornerPreviewSrc} alt="Preview avatar" style={cornerPreviewAvatar()} /> : null}
                  {newCornerBorder.image_url ? (
                    <>
                      <img src={newCornerBorder.image_url} alt="Corner badge preview" style={cornerBadgeTopLeft()} />
                      <img src={newCornerBorder.image_url} alt="" style={cornerBadgeBottomRight()} />
                    </>
                  ) : (
                    <div style={{ fontSize: 11, opacity: 0.6 }}>No preview</div>
                  )}
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  <input
                    placeholder="key (ex: obsidian-frame)"
                    value={newCornerBorder.key}
                    onChange={(e) => setNewCornerBorder((prev) => ({ ...prev, key: e.target.value }))}
                    style={input()}
                  />
                  <input
                    placeholder="name"
                    value={newCornerBorder.name}
                    onChange={(e) => setNewCornerBorder((prev) => ({ ...prev, name: e.target.value }))}
                    style={input()}
                  />
                  <input
                    placeholder="image url"
                    value={newCornerBorder.image_url ?? ""}
                    onChange={(e) => setNewCornerBorder((prev) => ({ ...prev, image_url: e.target.value }))}
                    style={input()}
                  />
                  <select
                    value={String(newCornerBorder.render_mode ?? "image")}
                    onChange={(e) => setNewCornerBorder((prev) => ({ ...prev, render_mode: e.target.value }))}
                    style={input()}
                  >
                    <option value="image">image</option>
                    <option value="code">code</option>
                  </select>
                  {newCornerBorder.render_mode === "code" ? (
                    <>
                      <textarea
                        placeholder="HTML"
                        value={newCornerBorder.html ?? ""}
                        onChange={(e) => setNewCornerBorder((prev) => ({ ...prev, html: e.target.value }))}
                        style={{ ...input(), minHeight: 72, resize: "vertical", fontFamily: "monospace" }}
                      />
                      <textarea
                        placeholder="CSS"
                        value={newCornerBorder.css ?? ""}
                        onChange={(e) => setNewCornerBorder((prev) => ({ ...prev, css: e.target.value }))}
                        style={{ ...input(), minHeight: 84, resize: "vertical", fontFamily: "monospace" }}
                      />
                      <textarea
                        placeholder="JS"
                        value={newCornerBorder.js ?? ""}
                        onChange={(e) => setNewCornerBorder((prev) => ({ ...prev, js: e.target.value }))}
                        style={{ ...input(), minHeight: 72, resize: "vertical", fontFamily: "monospace" }}
                      />
                    </>
                  ) : null}
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <button style={ghostButton()} onClick={() => openCornerPicker({ type: "new" })}>
                      Browse Bucket
                    </button>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => uploadCornerBorder(e.target.files?.[0] ?? null, { type: "new" })}
                      disabled={cornerUploading}
                      style={fileInput()}
                    />
                  </div>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="unlock level"
                  value={newCornerBorder.unlock_level ?? ""}
                  onChange={(e) => setNewCornerBorder((prev) => ({ ...prev, unlock_level: clampLevel(e.target.value) }))}
                  style={input()}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="unlock points"
                  value={newCornerBorder.unlock_points ?? ""}
                  onChange={(e) => setNewCornerBorder((prev) => ({ ...prev, unlock_points: clampPoints(e.target.value) }))}
                  style={input()}
                />
                <label style={checkboxWrap()}>
                  <input
                    type="checkbox"
                    checked={newCornerBorder.limited_event_only === true}
                    onChange={(e) => setNewCornerBorder((prev) => ({ ...prev, limited_event_only: e.target.checked }))}
                  />
                  Limited event only
                </label>
                <input
                  placeholder="limited event name"
                  value={newCornerBorder.limited_event_name ?? ""}
                  onChange={(e) => setNewCornerBorder((prev) => ({ ...prev, limited_event_name: e.target.value }))}
                  style={input()}
                />
                <input
                  placeholder="limited event description"
                  value={newCornerBorder.limited_event_description ?? ""}
                  onChange={(e) => setNewCornerBorder((prev) => ({ ...prev, limited_event_description: e.target.value }))}
                  style={input()}
                />
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <label style={checkboxWrap()}>
                      <input
                        type="checkbox"
                        checked={newCornerBorder.enabled !== false}
                        onChange={(e) => setNewCornerBorder((prev) => ({ ...prev, enabled: e.target.checked }))}
                      />
                      Enabled
                    </label>
                    <button style={button()} disabled={saving || cornerUploading} onClick={() => saveCornerBorder(newCornerBorder)}>
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {cornerBorders.map((row) => {
                const isCode = row.render_mode === "code";
                const codePreview = buildCodePreview(row.html, row.css);
                const builderHref = row.id
                  ? `/admin/custom/create?tab=avatar-border&border=${row.id}`
                  : "/admin/custom/create?tab=avatar-border";
                return (
                  <div key={row.id ?? row.key} style={cornerCard()}>
                    <div style={cornerPreview()}>
                      {cornerPreviewSrc ? <img src={cornerPreviewSrc} alt="Preview avatar" style={cornerPreviewAvatar()} /> : null}
                      {isCode && (row.html || row.css) ? (
                        <div
                          style={cornerCodeLayer()}
                          dangerouslySetInnerHTML={{ __html: codePreview }}
                        />
                      ) : row.image_url ? (
                        <>
                          <img src={row.image_url} alt={row.name} style={cornerBadgeTopLeft()} />
                          <img src={row.image_url} alt="" style={cornerBadgeBottomRight()} />
                        </>
                      ) : (
                        <div style={{ fontSize: 11, opacity: 0.6 }}>No preview</div>
                      )}
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      <input value={row.key} readOnly style={{ ...input(), opacity: 0.7 }} />
                      <input
                        value={row.name}
                        onChange={(e) => setCornerBorders((prev) => prev.map((r) => (r === row ? { ...r, name: e.target.value } : r)))}
                        style={input()}
                      />
                    <input
                      value={row.image_url ?? ""}
                      onChange={(e) => setCornerBorders((prev) => prev.map((r) => (r === row ? { ...r, image_url: e.target.value } : r)))}
                      style={input()}
                    />
                    <select
                      value={String(row.render_mode ?? "image")}
                      onChange={(e) => setCornerBorders((prev) => prev.map((r) => (r === row ? { ...r, render_mode: e.target.value } : r)))}
                      style={input()}
                    >
                      <option value="image">image</option>
                      <option value="code">code</option>
                    </select>
                    {isCode ? (
                      <>
                        <textarea
                          placeholder="HTML"
                          value={row.html ?? ""}
                          onChange={(e) => setCornerBorders((prev) => prev.map((r) => (r === row ? { ...r, html: e.target.value } : r)))}
                          style={{ ...input(), minHeight: 72, resize: "vertical", fontFamily: "monospace" }}
                        />
                        <textarea
                          placeholder="CSS"
                          value={row.css ?? ""}
                          onChange={(e) => setCornerBorders((prev) => prev.map((r) => (r === row ? { ...r, css: e.target.value } : r)))}
                          style={{ ...input(), minHeight: 84, resize: "vertical", fontFamily: "monospace" }}
                        />
                        <textarea
                          placeholder="JS"
                          value={row.js ?? ""}
                          onChange={(e) => setCornerBorders((prev) => prev.map((r) => (r === row ? { ...r, js: e.target.value } : r)))}
                          style={{ ...input(), minHeight: 72, resize: "vertical", fontFamily: "monospace" }}
                        />
                      </>
                    ) : null}
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <button style={ghostButton()} onClick={() => openCornerPicker({ type: "row", id: row.id })}>
                          Browse
                        </button>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => uploadCornerBorder(e.target.files?.[0] ?? null, { type: "row", id: row.id })}
                          disabled={cornerUploading}
                          style={fileInput()}
                        />
                      </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={row.unlock_level ?? ""}
                    onChange={(e) =>
                      setCornerBorders((prev) =>
                        prev.map((r) => (r === row ? { ...r, unlock_level: clampLevel(e.target.value) } : r))
                      )
                    }
                    style={input()}
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={row.unlock_points ?? ""}
                    onChange={(e) =>
                      setCornerBorders((prev) =>
                        prev.map((r) => (r === row ? { ...r, unlock_points: clampPoints(e.target.value) } : r))
                      )
                    }
                    style={input()}
                  />
                    <label style={checkboxWrap()}>
                      <input
                        type="checkbox"
                        checked={row.limited_event_only === true}
                        onChange={(e) =>
                          setCornerBorders((prev) => prev.map((r) => (r === row ? { ...r, limited_event_only: e.target.checked } : r)))
                        }
                      />
                      Limited event only
                    </label>
                    <input
                      placeholder="limited event name"
                      value={row.limited_event_name ?? ""}
                      onChange={(e) => setCornerBorders((prev) => prev.map((r) => (r === row ? { ...r, limited_event_name: e.target.value } : r)))}
                      style={input()}
                    />
                    <input
                      placeholder="limited event description"
                      value={row.limited_event_description ?? ""}
                      onChange={(e) => setCornerBorders((prev) => prev.map((r) => (r === row ? { ...r, limited_event_description: e.target.value } : r)))}
                      style={input()}
                    />
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <Link
                        href={builderHref}
                        style={{ ...ghostButton(), textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                      >
                        Open Builder
                      </Link>
                      <label style={checkboxWrap()}>
                        <input
                          type="checkbox"
                          checked={row.enabled !== false}
                          onChange={(e) =>
                            setCornerBorders((prev) => prev.map((r) => (r === row ? { ...r, enabled: e.target.checked } : r)))
                          }
                        />
                        Enabled
                      </label>
                      <button
                        style={button(savedId === (row.id ?? row.key))}
                        disabled={saving || cornerUploading}
                        onClick={() => saveCornerBorder(row)}
                      >
                        {savedId === (row.id ?? row.key) ? "Saved" : "Save"}
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 1000 }}>Corner Badge Positioning</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            Adjust X/Y offsets (px) for each surface. Offsets apply to both corners consistently.
          </div>
            <label style={{ fontSize: 12, opacity: 0.8, maxWidth: 320 }}>
              Position preview border
              <select
                value={cornerPositionPreviewKey}
                onChange={(e) => setCornerPositionPreviewKey(e.target.value)}
                style={{ ...input(), marginTop: 6 }}
              >
                {cornerBorders.map((b) => (
                  <option key={b.id ?? b.key} value={String(b.key ?? "")}>
                    {b.name ?? b.key}
                  </option>
                ))}
              </select>
            </label>
            <div style={positionGrid()}>
              {[
                { key: "dashboard", label: "Dashboard student card", size: 150, bg: "rgba(15,23,42,0.6)" },
                { key: "selector", label: "Student selector", size: 132, bg: "rgba(15,23,42,0.5)" },
                { key: "skill_pulse", label: "Skill Pulse display", size: 120, bg: "rgba(12,17,28,0.6)" },
                { key: "skill_pulse_tracker", label: "Skill Pulse tracker (tablet)", size: 120, bg: "rgba(12,17,28,0.6)" },
                { key: "live_activity", label: "Live Activity display", size: 120, bg: "rgba(10,10,10,0.55)" },
                { key: "roster", label: "Roster cards", size: 180, bg: "rgba(0,0,0,0.4)" },
              ].map((row) => {
                const offset = {
                  x: (cornerPositions as any)[`${row.key}_x`],
                  y: (cornerPositions as any)[`${row.key}_y`],
                };
                const badgeSize = Number((cornerPositions as any)[`${row.key}_size`] ?? 72);
                return (
                  <div key={row.key} style={positionCard()}>
                    <div style={{ fontWeight: 900 }}>{row.label}</div>
                    <div style={offsetPreviewWrap(row.size, row.bg)}>
                      {previewCornerCode ? (
                        <div style={offsetPreviewCodeLayer()} dangerouslySetInnerHTML={{ __html: previewCornerCode }} />
                      ) : previewCornerUrl ? (
                        <>
                          <img src={previewCornerUrl} alt="" style={cornerBadgeOffsetTopLeft(offset, badgeSize)} />
                          <img src={previewCornerUrl} alt="" style={cornerBadgeOffsetBottomRight(offset, badgeSize)} />
                        </>
                      ) : null}
                      {cornerPreviewSrc ? (
                        <img src={cornerPreviewSrc} alt="Preview avatar" style={offsetPreviewImg()} />
                      ) : (
                        <div style={{ fontSize: 11, opacity: 0.6 }}>Preview avatar</div>
                      )}
                    </div>
                    <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                      <label style={fieldLabel()}>
                        X offset
                        <input
                          type="number"
                          value={(cornerPositions as any)[`${row.key}_x`]}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            setCornerPositions((prev) => ({ ...prev, [`${row.key}_x`]: Number.isFinite(value) ? value : 0 } as any));
                            setCornerPositionsDirty(true);
                          }}
                          style={input()}
                        />
                      </label>
                      <label style={fieldLabel()}>
                        Y offset
                        <input
                          type="number"
                          value={(cornerPositions as any)[`${row.key}_y`]}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            setCornerPositions((prev) => ({ ...prev, [`${row.key}_y`]: Number.isFinite(value) ? value : 0 } as any));
                            setCornerPositionsDirty(true);
                          }}
                          style={input()}
                        />
                      </label>
                      <label style={fieldLabel()}>
                        Size
                        <input
                          type="number"
                          value={(cornerPositions as any)[`${row.key}_size`]}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            setCornerPositions((prev) => ({ ...prev, [`${row.key}_size`]: Number.isFinite(value) ? value : 0 } as any));
                            setCornerPositionsDirty(true);
                          }}
                          style={input()}
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                style={button()}
                disabled={saving || !cornerPositionsDirty}
                onClick={async () => {
                  setSaving(true);
                  setMsg("");
                  try {
                    const res = await fetch("/api/admin/corner-borders/settings", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(cornerPositions),
                    });
                    const sj = await safeJson(res);
                    if (!sj.ok) throw new Error(sj.json?.error || "Failed to save corner positions");
                    setCornerPositionsDirty(false);
                  } catch (err: any) {
                    setMsg(err?.message ?? "Failed to save corner positions");
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Save Corner Positions
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {avatarView && (activeCategory === "All" || activeCategory === "Card Plates") ? (
        <section style={sectionCard()}>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 1000 }}>Card Plate Borders</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>
              Upload edge plate border art and set the unlock level + points.
            </div>
            <label style={{ fontSize: 12, opacity: 0.8, maxWidth: 320 }}>
              Preview avatar
              <select
                value={cornerPreviewAvatarId}
                onChange={(e) => setCornerPreviewAvatarId(e.target.value)}
                style={{ ...input(), marginTop: 6 }}
              >
                {avatars.map((a) => (
                  <option key={a.id ?? a.name} value={String(a.id ?? "")}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <div style={cornerGrid()}>
              <div style={cornerCard()}>
                <div style={platePreview()}>
                  {cornerPreviewSrc ? <img src={cornerPreviewSrc} alt="Preview avatar" style={platePreviewAvatar()} /> : null}
                  {newCardPlate.image_url ? (
                    <img src={newCardPlate.image_url} alt="Card plate preview" style={platePreviewLine(200)} />
                  ) : (
                    <div style={{ fontSize: 11, opacity: 0.6 }}>No preview</div>
                  )}
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  <input
                    placeholder="key (ex: iron-plate)"
                    value={newCardPlate.key}
                    onChange={(e) => setNewCardPlate((prev) => ({ ...prev, key: e.target.value }))}
                    style={input()}
                  />
                  <input
                    placeholder="name"
                    value={newCardPlate.name}
                    onChange={(e) => setNewCardPlate((prev) => ({ ...prev, name: e.target.value }))}
                    style={input()}
                  />
                  <input
                    placeholder="image url"
                    value={newCardPlate.image_url ?? ""}
                    onChange={(e) => setNewCardPlate((prev) => ({ ...prev, image_url: e.target.value }))}
                    style={input()}
                  />
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <button style={ghostButton()} onClick={() => openPlatePicker({ type: "new" })}>
                      Browse Bucket
                    </button>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => uploadCardPlate(e.target.files?.[0] ?? null, { type: "new" })}
                      disabled={plateUploading}
                      style={fileInput()}
                    />
                  </div>
                  <label style={fieldLabel()}>
                    Unlock level
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={newCardPlate.unlock_level ?? ""}
                      onChange={(e) => setNewCardPlate((prev) => ({ ...prev, unlock_level: clampLevel(e.target.value) }))}
                      style={input()}
                    />
                  </label>
                  <label style={fieldLabel()}>
                    Unlock points
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={newCardPlate.unlock_points ?? ""}
                      onChange={(e) => setNewCardPlate((prev) => ({ ...prev, unlock_points: clampPoints(e.target.value) }))}
                      style={input()}
                    />
                  </label>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <label style={checkboxWrap()}>
                      <input
                        type="checkbox"
                        checked={newCardPlate.enabled !== false}
                        onChange={(e) => setNewCardPlate((prev) => ({ ...prev, enabled: e.target.checked }))}
                      />
                      Enabled
                    </label>
                    <button style={button()} disabled={saving || plateUploading} onClick={() => saveCardPlate(newCardPlate)}>
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {cardPlates.map((row) => (
                <div key={row.id ?? row.key} style={cornerCard()}>
                  <div style={platePreview()}>
                    {cornerPreviewSrc ? <img src={cornerPreviewSrc} alt="Preview avatar" style={platePreviewAvatar()} /> : null}
                    {row.image_url ? (
                      <img src={row.image_url} alt={row.name} style={platePreviewLine(200)} />
                    ) : (
                      <div style={{ fontSize: 11, opacity: 0.6 }}>No preview</div>
                    )}
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    <input value={row.key} readOnly style={{ ...input(), opacity: 0.7 }} />
                    <input
                      value={row.name}
                      onChange={(e) => setCardPlates((prev) => prev.map((r) => (r === row ? { ...r, name: e.target.value } : r)))}
                      style={input()}
                    />
                    <input
                      value={row.image_url ?? ""}
                      onChange={(e) => setCardPlates((prev) => prev.map((r) => (r === row ? { ...r, image_url: e.target.value } : r)))}
                      style={input()}
                    />
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <button style={ghostButton()} onClick={() => openPlatePicker({ type: "row", id: row.id })}>
                        Browse
                      </button>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => uploadCardPlate(e.target.files?.[0] ?? null, { type: "row", id: row.id })}
                        disabled={plateUploading}
                        style={fileInput()}
                      />
                    </div>
                    <label style={fieldLabel()}>
                      Unlock level
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={row.unlock_level ?? ""}
                        onChange={(e) =>
                          setCardPlates((prev) =>
                            prev.map((r) => (r === row ? { ...r, unlock_level: clampLevel(e.target.value) } : r))
                          )
                        }
                        style={input()}
                      />
                    </label>
                    <label style={fieldLabel()}>
                      Unlock points
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={row.unlock_points ?? ""}
                        onChange={(e) =>
                          setCardPlates((prev) =>
                            prev.map((r) => (r === row ? { ...r, unlock_points: clampPoints(e.target.value) } : r))
                          )
                        }
                        style={input()}
                      />
                    </label>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <label style={checkboxWrap()}>
                        <input
                          type="checkbox"
                          checked={row.enabled !== false}
                          onChange={(e) =>
                            setCardPlates((prev) => prev.map((r) => (r === row ? { ...r, enabled: e.target.checked } : r)))
                          }
                        />
                        Enabled
                      </label>
                      <button
                        style={button(savedId === (row.id ?? row.key))}
                        disabled={saving || plateUploading}
                        onClick={() => saveCardPlate(row)}
                      >
                        {savedId === (row.id ?? row.key) ? "Saved" : "Save"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 1000 }}>Card Plate Positioning</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>
              Adjust X/Y offsets (px) and width (px) for each surface.
            </div>
            <div style={positionGrid()}>
              {[
                { key: "dashboard", label: "Dashboard student card", width: 520, height: 260 },
                { key: "selector", label: "Student selector", width: 340, height: 180 },
                { key: "skill_pulse", label: "Skill Pulse display", width: 320, height: 190 },
                { key: "skill_pulse_tracker", label: "Skill Pulse tracker (tablet)", width: 320, height: 190 },
                { key: "live_activity", label: "Live Activity display", width: 360, height: 210 },
                { key: "roster", label: "Roster cards", width: 360, height: 210 },
                { key: "taolu_tracker", label: "Taolu tracker cards", width: 360, height: 210 },
                { key: "battle_pulse", label: "Battle Pulse cards", width: 380, height: 220 },
              ].map((row) => {
                const offset = {
                  x: (cardPlatePositions as any)[`${row.key}_x`],
                  y: (cardPlatePositions as any)[`${row.key}_y`],
                  size: (cardPlatePositions as any)[`${row.key}_size`],
                };
                return (
                  <div key={row.key} style={positionCard()}>
                    <div style={{ fontWeight: 900 }}>{row.label}</div>
                    <div style={plateOffsetPreviewWrap(row.width, row.height)}>
                      {cornerPreviewSrc ? <img src={cornerPreviewSrc} alt="" style={plateOffsetAvatar()} /> : null}
                      {previewPlateUrl ? (
                        <img
                          src={previewPlateUrl}
                          alt=""
                          style={plateOffsetLine(offset)}
                        />
                      ) : null}
                    </div>
                    <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                      <label style={fieldLabel()}>
                        X offset
                        <input
                          type="number"
                          value={(cardPlatePositions as any)[`${row.key}_x`]}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            setCardPlatePositions((prev) => ({ ...prev, [`${row.key}_x`]: Number.isFinite(value) ? value : 0 } as any));
                            setCardPlatePositionsDirty(true);
                          }}
                          style={input()}
                        />
                      </label>
                      <label style={fieldLabel()}>
                        Y offset
                        <input
                          type="number"
                          value={(cardPlatePositions as any)[`${row.key}_y`]}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            setCardPlatePositions((prev) => ({ ...prev, [`${row.key}_y`]: Number.isFinite(value) ? value : 0 } as any));
                            setCardPlatePositionsDirty(true);
                          }}
                          style={input()}
                        />
                      </label>
                      <label style={fieldLabel()}>
                        Width
                        <input
                          type="number"
                          value={(cardPlatePositions as any)[`${row.key}_size`]}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            setCardPlatePositions((prev) => ({ ...prev, [`${row.key}_size`]: Number.isFinite(value) ? value : 0 } as any));
                            setCardPlatePositionsDirty(true);
                          }}
                          style={input()}
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                style={button()}
                disabled={saving || !cardPlatePositionsDirty}
                onClick={async () => {
                  setSaving(true);
                  setMsg("");
                  try {
                    const res = await fetch("/api/admin/card-plates/settings", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(cardPlatePositions),
                    });
                    const sj = await safeJson(res);
                    if (!sj.ok) throw new Error(sj.json?.error || "Failed to save card plate positions");
                    setCardPlatePositionsDirty(false);
                  } catch (err: any) {
                    setMsg(err?.message ?? "Failed to save card plate positions");
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Save Card Plate Positions
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {!avatarView && (activeCategory === "All" || activeCategory === "Timers") ? (
        <section style={sectionCard()}>
        <div style={{ fontWeight: 1000, fontSize: 16 }}>Timer Audio</div>
        <div style={{ opacity: 0.7, fontSize: 12 }}>
          Sets the default timer music and the sound that plays when the timer ends.
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          <label style={fieldLabel()}>
            Timer music URL
            <select
              value={timerSettings.music_url}
              onChange={(e) => {
                setTimerSettings((prev) => ({ ...prev, music_url: e.target.value }));
                setTimerSettingsDirty(true);
              }}
              style={input()}
            >
              <option value="">Select from library</option>
              {soundLibrary.map((item) => (
                <option key={item.public_url} value={item.public_url}>
                  {item.path}
                </option>
              ))}
            </select>
            <input
              value={timerSettings.music_url}
              onChange={(e) => {
                setTimerSettings((prev) => ({ ...prev, music_url: e.target.value }));
                setTimerSettingsDirty(true);
              }}
              placeholder="Or paste URL"
              style={input()}
            />
          </label>
          <label style={fieldLabel()}>
            Timer end sound
            <select
              value={timerSettings.end_sound_key}
              onChange={(e) => {
                setTimerSettings((prev) => ({ ...prev, end_sound_key: e.target.value }));
                setTimerSettingsDirty(true);
              }}
              style={input()}
            >
              <option value="">No end sound</option>
              {effects.map((row) => (
                <option key={row.id ?? row.key} value={row.key}>
                  {row.label || row.key}
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={button()}
              disabled={saving || !timerSettingsDirty}
              onClick={saveTimerSettings}
            >
              Save Timer Settings
            </button>
          </div>
        </div>
        </section>
      ) : null}

      {!avatarView && (activeCategory === "All" || activeCategory === "Branding") ? (
        <section style={sectionCard()}>
        <div style={{ fontWeight: 1000, fontSize: 16 }}>Navigation Logo</div>
        <div style={{ opacity: 0.7, fontSize: 12 }}>
          Upload to `badges/branding` or paste a URL. Adjust zoom to change how large the logo renders.
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(0,0,0,0.25)",
                display: "grid",
                placeItems: "center",
              }}
            >
              {navSettings.logo_url ? (
                <img
                  src={navSettings.logo_url}
                  alt="Navigation logo"
                  style={{
                    width: Math.max(20, 88 * navSettings.logo_zoom),
                    height: Math.max(20, 88 * navSettings.logo_zoom),
                    objectFit: "contain",
                  }}
                />
              ) : (
                <span style={{ fontSize: 11, opacity: 0.7 }}>No logo</span>
              )}
            </div>
            <div style={{ display: "grid", gap: 8, minWidth: 260 }}>
              <input
                value={navSettings.logo_url}
                onChange={(e) => {
                  setNavSettings((prev) => ({ ...prev, logo_url: e.target.value }));
                  setNavSettingsDirty(true);
                }}
                placeholder="Logo URL"
                style={input()}
              />
              <input
                type="file"
                accept="image/*"
                onChange={(e) => uploadNavLogo(e.target.files?.[0] ?? null)}
                disabled={navUploading}
                style={fileInput()}
              />
              <label style={fieldLabel()}>
                Logo zoom
                <input
                  type="number"
                  min={0.2}
                  max={3}
                  step={0.05}
                  value={navSettings.logo_zoom}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setNavSettings((prev) => ({ ...prev, logo_zoom: Number.isFinite(next) ? next : prev.logo_zoom }));
                    setNavSettingsDirty(true);
                  }}
                  style={input()}
                />
              </label>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={button()}
              disabled={saving || !navSettingsDirty}
              onClick={async () => {
                setSaving(true);
                setMsg("");
                try {
                  const res = await fetch("/api/admin/nav-settings", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(navSettings),
                  });
                  const sj = await safeJson(res);
                  if (!sj.ok) throw new Error(sj.json?.error || "Failed to save nav settings");
                  setNavSettings({
                    logo_url: String(sj.json?.settings?.logo_url ?? ""),
                    logo_zoom: Number(sj.json?.settings?.logo_zoom ?? 1) || 1,
                  });
                  setNavSettingsDirty(false);
                } catch (err: any) {
                  setMsg(err?.message ?? "Failed to save nav settings");
                } finally {
                  setSaving(false);
                }
              }}
            >
              Save Nav Logo
            </button>
          </div>
        </div>
        </section>
      ) : null}

      {!avatarView && (activeCategory === "All" || activeCategory === "Badges") ? (
        <section style={sectionCard()}>
        <div style={{ fontWeight: 1000, fontSize: 16 }}>Badge Library</div>
        <div style={{ opacity: 0.7, fontSize: 12 }}>
          Upload badge art and assign it to achievements. Manage achievements in{" "}
          <Link href="/admin/custom/achievements" style={{ color: "#93c5fd", textDecoration: "none" }}>
            Achievements & Badges
          </Link>
          .
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={formRow()}>
            <input
              placeholder="badge name"
              value={newBadge.name}
              onChange={(e) => setNewBadge((prev) => ({ ...prev, name: e.target.value }))}
              style={input()}
            />
            <input
              placeholder="category"
              value={newBadge.category ?? ""}
              onChange={(e) => setNewBadge((prev) => ({ ...prev, category: e.target.value }))}
              style={input()}
            />
            <input
              placeholder="image url"
              value={newBadge.image_url ?? ""}
              onChange={(e) => setNewBadge((prev) => ({ ...prev, image_url: e.target.value }))}
              style={input()}
            />
            <button style={ghostButton()} onClick={() => openPicker({ type: "new" })}>
              Browse
            </button>
            <label style={checkboxWrap()}>
              <input
                type="checkbox"
                checked={newBadge.enabled !== false}
                onChange={(e) => setNewBadge((prev) => ({ ...prev, enabled: e.target.checked }))}
              />
              Enabled
            </label>
            <button style={button()} disabled={saving} onClick={() => saveBadgeLibrary(newBadge)}>
              Add
            </button>
          </div>

          {library.map((row) => (
            <div key={row.id ?? row.name} style={formRow()}>
              <input
                value={row.name}
                onChange={(e) => setLibrary((prev) => prev.map((r) => (r === row ? { ...r, name: e.target.value } : r)))}
                style={input()}
              />
              <input
                value={row.category ?? ""}
                onChange={(e) => setLibrary((prev) => prev.map((r) => (r === row ? { ...r, category: e.target.value } : r)))}
                style={input()}
              />
              <input
                value={row.image_url ?? ""}
                onChange={(e) => setLibrary((prev) => prev.map((r) => (r === row ? { ...r, image_url: e.target.value } : r)))}
                style={input()}
              />
              <button style={ghostButton()} onClick={() => openPicker({ type: "row", id: row.id })}>
                Browse
              </button>
              <label style={checkboxWrap()}>
                <input
                  type="checkbox"
                  checked={row.enabled !== false}
                  onChange={(e) => setLibrary((prev) => prev.map((r) => (r === row ? { ...r, enabled: e.target.checked } : r)))}
                />
                Enabled
              </label>
              <button style={button(savedId === row.id)} disabled={saving} onClick={() => saveBadgeLibrary(row)}>
                {savedId === row.id ? "Saved" : "Save"}
              </button>
            </div>
          ))}
        </div>
        </section>
      ) : null}

      {avatarView && (activeCategory === "All" || activeCategory === "Avatars") ? (
        <section style={sectionCard()}>
        <div style={{ fontWeight: 1000, fontSize: 16 }}>Avatar Catalog</div>
        <div style={{ opacity: 0.7, fontSize: 12 }}>
          Toggle which avatars students can select, and flag limited secondary avatars.
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={formRow({ columns: "repeat(8, minmax(0, 1fr))" })}>
            <div style={fieldStack()}>
              <div style={fieldLabel()}>Avatar Name</div>
              <input
                value={newAvatar.name}
                onChange={(e) => setNewAvatar((prev) => ({ ...prev, name: e.target.value }))}
                style={input()}
              />
            </div>
            <div style={fieldStack()}>
              <div style={fieldLabel()}>Storage Path</div>
              <input
                value={newAvatar.storage_path ?? ""}
                onChange={(e) => setNewAvatar((prev) => ({ ...prev, storage_path: e.target.value }))}
                style={input()}
              />
            </div>
            <div style={fieldStack()}>
              <div style={fieldLabel()}>Unlock Level</div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={newAvatar.unlock_level ?? ""}
                onChange={(e) => {
                  const raw = digitsOnly(e.target.value);
                  setNewAvatar((prev) => ({ ...prev, unlock_level: raw === "" ? null : Number(raw) }));
                }}
                style={input()}
              />
            </div>
            <div style={fieldStack()}>
              <div style={fieldLabel()}>Unlock Points</div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={newAvatar.unlock_points ?? ""}
                onChange={(e) => {
                  const raw = digitsOnly(e.target.value);
                  setNewAvatar((prev) => ({ ...prev, unlock_points: raw === "" ? null : Number(raw) }));
                }}
                style={input()}
              />
            </div>
            <button style={ghostButton()} onClick={() => openAvatarPicker({ type: "new" })}>
              Browse Bucket
            </button>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => uploadAvatar(e.target.files?.[0] ?? null, { type: "new" })}
              style={fileInput()}
            />
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => uploadAvatarBulk(e.target.files)}
              style={fileInput()}
              disabled={avatarBulkUploading}
            />
            {avatarUploadProgress !== null && avatarUploadTargetId === "new" ? (
              <div style={uploadStatus()}>
                <div style={uploadText()}>{avatarUploadStatus}</div>
                <div style={uploadTrack()}>
                  <div style={{ ...uploadFill(), width: `${avatarUploadProgress}%` }} />
                </div>
              </div>
            ) : null}
            {avatarBulkUploading ? <div style={uploadText()}>Bulk uploading...</div> : null}
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <label style={checkboxWrap()}>
                <input
                  type="checkbox"
                  checked={newAvatar.enabled !== false}
                  onChange={(e) => setNewAvatar((prev) => ({ ...prev, enabled: e.target.checked }))}
                />
                Enabled
              </label>
              <label style={checkboxWrap()}>
                <input
                  type="checkbox"
                  checked={newAvatar.is_secondary === true}
                  onChange={(e) => setNewAvatar((prev) => ({ ...prev, is_secondary: e.target.checked }))}
                />
                Secondary
              </label>
              <button style={button()} disabled={saving || avatarUploading} onClick={() => saveAvatar(newAvatar)}>
                Add
              </button>
            </div>
          </div>
          <div style={noteCard()}>
            <div style={noteTitle()}>Avatar Aura Modifiers</div>
            <div style={noteBody()}>
              Avatar Aura modifies points for rule keeper/breaker, Skill Pulse, and Spotlight Stars. It can also award daily
              bonus points. These modifiers apply only at the time points are awarded and do not change past activity.
            </div>
          </div>
          <div style={formRow({ columns: "repeat(8, minmax(0, 1fr))" })}>
            <div style={fieldStack()} title="Percent multiplier for Rule Keeper points (100 = normal).">
              <div style={fieldLabel()}>Rule Keeper %</div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={newAvatar.rule_keeper_multiplier == null ? "" : multiplierPercent(newAvatar.rule_keeper_multiplier)}
                onChange={(e) => {
                  const raw = digitsOnly(e.target.value);
                  setNewAvatar((prev) => ({
                    ...prev,
                    rule_keeper_multiplier: raw === "" ? null : Number(raw) / 100,
                  }));
                }}
                style={input()}
              />
            </div>
            <div style={fieldStack()} title="Percent multiplier for Rule Breaker point loss (100 = normal).">
              <div style={fieldLabel()}>Rule Breaker %</div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={newAvatar.rule_breaker_multiplier == null ? "" : multiplierPercent(newAvatar.rule_breaker_multiplier)}
                onChange={(e) => {
                  const raw = digitsOnly(e.target.value);
                  setNewAvatar((prev) => ({
                    ...prev,
                    rule_breaker_multiplier: raw === "" ? null : Number(raw) / 100,
                  }));
                }}
                style={input()}
              />
            </div>
            <div style={fieldStack()} title="Percent multiplier for Skill Pulse points (100 = normal).">
              <div style={fieldLabel()}>Skill Pulse %</div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={newAvatar.skill_pulse_multiplier == null ? "" : multiplierPercent(newAvatar.skill_pulse_multiplier)}
                onChange={(e) => {
                  const raw = digitsOnly(e.target.value);
                  setNewAvatar((prev) => ({
                    ...prev,
                    skill_pulse_multiplier: raw === "" ? null : Number(raw) / 100,
                  }));
                }}
                style={input()}
              />
            </div>
            <div style={fieldStack()} title="Percent multiplier for Spotlight Stars points (100 = normal).">
              <div style={fieldLabel()}>Spotlight Stars %</div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={newAvatar.spotlight_multiplier == null ? "" : multiplierPercent(newAvatar.spotlight_multiplier)}
                onChange={(e) => {
                  const raw = digitsOnly(e.target.value);
                  setNewAvatar((prev) => ({
                    ...prev,
                    spotlight_multiplier: raw === "" ? null : Number(raw) / 100,
                  }));
                }}
                style={input()}
              />
            </div>
            <div style={fieldStack()} title="Free points awarded every 24 hours after the avatar is set.">
              <div style={fieldLabel()}>Daily Free Points</div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={newAvatar.daily_free_points ?? ""}
                onChange={(e) => {
                  const raw = digitsOnly(e.target.value);
                  setNewAvatar((prev) => ({ ...prev, daily_free_points: raw === "" ? null : Number(raw) }));
                }}
                style={input()}
              />
            </div>
            <div style={fieldStack()} title="Percent bonus applied to challenge completion points.">
              <div style={fieldLabel()}>Challenge Bonus %</div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={newAvatar.challenge_completion_bonus_pct ?? ""}
                onChange={(e) => {
                  const raw = digitsOnly(e.target.value);
                  setNewAvatar((prev) => ({ ...prev, challenge_completion_bonus_pct: raw === "" ? null : Number(raw) }));
                }}
                style={input()}
              />
            </div>
            <div style={fieldStack()} title="Percent bonus applied only to MVP bonus points in Battle Pulse modes.">
              <div style={fieldLabel()}>MVP Bonus %</div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={newAvatar.mvp_bonus_pct ?? ""}
                onChange={(e) => {
                  const raw = digitsOnly(e.target.value);
                  setNewAvatar((prev) => ({ ...prev, mvp_bonus_pct: raw === "" ? null : Number(raw) }));
                }}
                style={input()}
              />
            </div>
            <div style={fieldStack()} title="Avatar image zoom percent in displays (100 = normal).">
              <div style={fieldLabel()}>Avatar Zoom %</div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={newAvatar.zoom_pct ?? ""}
                onChange={(e) => {
                  const raw = digitsOnly(e.target.value);
                  setNewAvatar((prev) => ({ ...prev, zoom_pct: raw === "" ? null : Number(raw) }));
                }}
                style={input()}
              />
            </div>
          </div>
          <div style={formRow({ columns: "repeat(3, minmax(0, 1fr))" })}>
            <div style={fieldStack()}>
              <div style={fieldLabel()}>Competition Only</div>
              <label style={checkboxWrap()}>
                <input
                  type="checkbox"
                  checked={newAvatar.competition_only === true}
                  onChange={(e) => setNewAvatar((prev) => ({ ...prev, competition_only: e.target.checked }))}
                />
                Competition team only
              </label>
            </div>
            <div style={fieldStack()}>
              <div style={fieldLabel()}>Competition Discount %</div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={newAvatar.competition_discount_pct ?? ""}
                onChange={(e) => {
                  const raw = digitsOnly(e.target.value);
                  setNewAvatar((prev) => ({ ...prev, competition_discount_pct: raw === "" ? null : Number(raw) }));
                }}
                style={input()}
              />
            </div>
            <div style={fieldStack()}>
              <div style={fieldLabel()}>Limited Event Only</div>
              <label style={checkboxWrap()}>
                <input
                  type="checkbox"
                  checked={newAvatar.limited_event_only === true}
                  onChange={(e) => setNewAvatar((prev) => ({ ...prev, limited_event_only: e.target.checked }))}
                />
                Limited/special event
              </label>
            </div>
          </div>
          <div style={formRow({ columns: "repeat(2, minmax(0, 1fr))" })}>
            <div style={fieldStack()}>
              <div style={fieldLabel()}>Event Name</div>
              <input
                value={newAvatar.limited_event_name ?? ""}
                onChange={(e) => setNewAvatar((prev) => ({ ...prev, limited_event_name: e.target.value }))}
                style={input()}
                placeholder="Summer Camp 2026"
              />
            </div>
            <div style={fieldStack()}>
              <div style={fieldLabel()}>Event Description</div>
              <input
                value={newAvatar.limited_event_description ?? ""}
                onChange={(e) => setNewAvatar((prev) => ({ ...prev, limited_event_description: e.target.value }))}
                style={input()}
                placeholder="Limited edition unlock"
              />
            </div>
          </div>

          {!avatars.length ? (
            <div style={{ opacity: 0.7, fontSize: 12 }}>No avatars yet.</div>
          ) : (
            avatarLevels.map((level) => (
              <div key={`level-${level}`} style={levelGroup()}>
                <div style={{ fontWeight: 1000 }}>Level {level}</div>
                <div style={avatarGrid()}>
                  {avatarsByLevel[level].map((row) => {
                    const src = row.storage_path && avatarBase
                      ? `${avatarBase}/storage/v1/object/public/avatars/${row.storage_path}`
                      : "";
                    const zoomPctRaw = Number(row.zoom_pct ?? 100);
                    const zoomPct = Number.isFinite(zoomPctRaw) ? Math.max(40, Math.min(220, Math.round(zoomPctRaw))) : 100;
                    return (
                      <div key={row.id ?? row.name} style={avatarCard()}>
                        <div style={avatarThumb()}>
                          {src ? (
                            <img
                              src={src}
                              alt={row.name}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "contain",
                                transform: `scale(${zoomPct / 100})`,
                                transformOrigin: "center center",
                              }}
                            />
                          ) : (
                            <div style={{ opacity: 0.7, fontSize: 12 }}>No image</div>
                          )}
                        </div>
                        <div style={{ display: "grid", gap: 4 }}>
                          <div style={{ fontSize: 11, opacity: 0.82 }}>Scale: {zoomPct}%</div>
                          <input
                            type="range"
                            min={40}
                            max={220}
                            step={1}
                            value={zoomPct}
                            onChange={(e) => {
                              const value = Number(e.target.value);
                              setAvatars((prev) =>
                                prev.map((r) =>
                                  r === row ? { ...r, zoom_pct: Number.isFinite(value) ? value : 100 } : r
                                )
                              );
                            }}
                            style={{ width: "100%" }}
                          />
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.8 }}>
                          Used by {avatarUsage[row.id ?? ""]?.count ?? 0} students
                        </div>
                        <div style={fieldStack()}>
                          <div style={fieldLabel()}>Copy Settings</div>
                          <div style={{ position: "relative" }}>
                            <button
                              type="button"
                              style={ghostButton(false)}
                              onClick={() =>
                                setCopyOpenAvatarId((prev) =>
                                  prev === String(row.id ?? "") ? "" : String(row.id ?? "")
                                )
                              }
                            >
                              Copy from another avatar
                            </button>
                            {copyOpenAvatarId === String(row.id ?? "") ? (
                              <div style={copyPickerMenu()}>
                                {avatars
                                  .filter((src) => String(src.id ?? "") !== String(row.id ?? ""))
                                  .map((src) => {
                                    const srcThumb =
                                      src.storage_path && avatarBase
                                        ? `${avatarBase}/storage/v1/object/public/avatars/${src.storage_path}`
                                        : "";
                                    const rk = `${multiplierPercent(src.rule_keeper_multiplier ?? 1)}%`;
                                    const rb = `${multiplierPercent(src.rule_breaker_multiplier ?? 1)}%`;
                                    const sp = `${multiplierPercent(src.skill_pulse_multiplier ?? 1)}%`;
                                    const ss = `${multiplierPercent(src.spotlight_multiplier ?? 1)}%`;
                                    const mvp = `${Math.round(Number(src.mvp_bonus_pct ?? 0))}%`;
                                    const ch = `${Math.round(Number(src.challenge_completion_bonus_pct ?? 0))}%`;
                                    const free = `${Math.max(0, Math.floor(Number(src.daily_free_points ?? 0)))}`;
                                    return (
                                      <button
                                        key={`copy-${row.id}-${src.id}`}
                                        type="button"
                                        style={copyPickerOption()}
                                        onClick={() => copyAvatarSettingsFrom(String(row.id ?? ""), src)}
                                      >
                                        <div style={copyPickerThumbWrap()}>
                                          {srcThumb ? (
                                            <img src={srcThumb} alt={src.name} style={copyPickerThumb()} />
                                          ) : (
                                            <div style={{ fontSize: 10, opacity: 0.75 }}>No img</div>
                                          )}
                                        </div>
                                        <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
                                          <div style={{ fontWeight: 900, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                            {src.name}
                                          </div>
                                          <div style={{ fontSize: 10, opacity: 0.78 }}>Lvl {Math.max(1, Number(src.unlock_level ?? 1))}</div>
                                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                            <span style={copyModifierChip("#60a5fa")}>RK {rk}</span>
                                            <span style={copyModifierChip("#f87171")}>RB {rb}</span>
                                            <span style={copyModifierChip("#22d3ee")}>SP {sp}</span>
                                            <span style={copyModifierChip("#fbbf24")}>SS {ss}</span>
                                            <span style={copyModifierChip("#a78bfa")}>MVP {mvp}</span>
                                            <span style={copyModifierChip("#34d399")}>CH {ch}</span>
                                            <span style={copyModifierChip("#f59e0b")}>FREE {free}</span>
                                          </div>
                                        </div>
                                      </button>
                                    );
                                  })}
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {hasRecentUpload(row) ? (
                            <span style={{ ...pillChip(), borderColor: "rgba(251,191,36,0.6)", color: "#fde68a" }}>Uploaded recently</span>
                          ) : null}
                          {hasRecentUpdate(row) ? (
                            <span style={{ ...pillChip(), borderColor: "rgba(34,197,94,0.6)", color: "#86efac" }}>Updated recently</span>
                          ) : null}
                          {autoSavingAvatarIds[String(row.id ?? "")] ? (
                            <span style={{ ...pillChip(), borderColor: "rgba(56,189,248,0.6)", color: "#67e8f9" }}>Autosaving...</span>
                          ) : null}
                        </div>
                        <div style={fieldStack()}>
                          <div style={fieldLabel()}>Avatar Name</div>
                          <input
                            value={row.name}
                            onChange={(e) =>
                              setAvatars((prev) => prev.map((r) => (r === row ? { ...r, name: e.target.value } : r)))
                            }
                            style={input()}
                          />
                        </div>
                        <div style={fieldStack()}>
                          <div style={fieldLabel()}>Storage Path</div>
                          <input
                            value={row.storage_path ?? ""}
                            onChange={(e) =>
                              setAvatars((prev) => prev.map((r) => (r === row ? { ...r, storage_path: e.target.value } : r)))
                            }
                            style={input()}
                          />
                        </div>
                        <div style={fieldStack()}>
                          <div style={fieldLabel()}>Unlock Level</div>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={avatarUnlockLevelDrafts[String(row.id ?? "")] ?? String(row.unlock_level ?? "")}
                            onChange={(e) =>
                              setAvatarUnlockLevelDrafts((prev) => ({
                                ...prev,
                                [String(row.id ?? "")]: e.target.value,
                              }))
                            }
                            onBlur={() => commitAvatarUnlockLevel(String(row.id ?? ""))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                commitAvatarUnlockLevel(String(row.id ?? ""));
                              }
                            }}
                            style={input()}
                          />
                        </div>
                        <div style={fieldStack()}>
                          <div style={fieldLabel()}>Unlock Points</div>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={row.unlock_points ?? ""}
                            onChange={(e) => {
                              const raw = digitsOnly(e.target.value);
                              setAvatars((prev) =>
                                prev.map((r) => (r === row ? { ...r, unlock_points: raw === "" ? null : Number(raw) } : r))
                              );
                            }}
                            style={input()}
                          />
                        </div>
                        <div style={formRow({ columns: "repeat(4, minmax(0, 1fr))" })}>
                          <div style={fieldStack()} title="Percent multiplier for Rule Keeper points (100 = normal).">
                            <div style={fieldLabel()}>Rule Keeper %</div>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={row.rule_keeper_multiplier == null ? "" : multiplierPercent(row.rule_keeper_multiplier)}
                              onChange={(e) => {
                                const raw = digitsOnly(e.target.value);
                                setAvatars((prev) =>
                                  prev.map((r) =>
                                    r === row
                                      ? { ...r, rule_keeper_multiplier: raw === "" ? null : Number(raw) / 100 }
                                      : r
                                  )
                                );
                              }}
                              style={input()}
                            />
                          </div>
                          <div style={fieldStack()} title="Percent multiplier for Rule Breaker point loss (100 = normal).">
                            <div style={fieldLabel()}>Rule Breaker %</div>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={row.rule_breaker_multiplier == null ? "" : multiplierPercent(row.rule_breaker_multiplier)}
                              onChange={(e) => {
                                const raw = digitsOnly(e.target.value);
                                setAvatars((prev) =>
                                  prev.map((r) =>
                                    r === row
                                      ? { ...r, rule_breaker_multiplier: raw === "" ? null : Number(raw) / 100 }
                                      : r
                                  )
                                );
                              }}
                              style={input()}
                            />
                          </div>
                          <div style={fieldStack()} title="Percent multiplier for Skill Pulse points (100 = normal).">
                            <div style={fieldLabel()}>Skill Pulse %</div>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={row.skill_pulse_multiplier == null ? "" : multiplierPercent(row.skill_pulse_multiplier)}
                              onChange={(e) => {
                                const raw = digitsOnly(e.target.value);
                                setAvatars((prev) =>
                                  prev.map((r) =>
                                    r === row
                                      ? { ...r, skill_pulse_multiplier: raw === "" ? null : Number(raw) / 100 }
                                      : r
                                  )
                                );
                              }}
                              style={input()}
                            />
                          </div>
                        </div>
                        <div style={formRow({ columns: "repeat(4, minmax(0, 1fr))" })}>
                          <div style={fieldStack()} title="Percent multiplier for Spotlight Stars points (100 = normal).">
                            <div style={fieldLabel()}>Spotlight Stars %</div>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={row.spotlight_multiplier == null ? "" : multiplierPercent(row.spotlight_multiplier)}
                              onChange={(e) => {
                                const raw = digitsOnly(e.target.value);
                                setAvatars((prev) =>
                                  prev.map((r) =>
                                    r === row
                                      ? { ...r, spotlight_multiplier: raw === "" ? null : Number(raw) / 100 }
                                      : r
                                  )
                                );
                              }}
                              style={input()}
                            />
                          </div>
                          <div style={fieldStack()} title="Free points awarded every 24 hours after the avatar is set.">
                            <div style={fieldLabel()}>Daily Free Points</div>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={row.daily_free_points ?? ""}
                              onChange={(e) => {
                                const raw = digitsOnly(e.target.value);
                                setAvatars((prev) =>
                                  prev.map((r) =>
                                    r === row ? { ...r, daily_free_points: raw === "" ? null : Number(raw) } : r
                                  )
                                );
                              }}
                              style={input()}
                            />
                          </div>
                          <div style={fieldStack()} title="Avatar image zoom percent in displays (100 = normal).">
                            <div style={fieldLabel()}>Avatar Zoom %</div>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={row.zoom_pct ?? ""}
                              onChange={(e) => {
                                const raw = digitsOnly(e.target.value);
                                setAvatars((prev) =>
                                  prev.map((r) =>
                                    r === row ? { ...r, zoom_pct: raw === "" ? null : Number(raw) } : r
                                  )
                                );
                              }}
                              style={input()}
                            />
                          </div>
                          <div style={fieldStack()} title="Percent bonus applied only to MVP bonus points in Battle Pulse modes.">
                            <div style={fieldLabel()}>MVP Bonus %</div>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={row.mvp_bonus_pct ?? ""}
                              onChange={(e) => {
                                const raw = digitsOnly(e.target.value);
                                setAvatars((prev) =>
                                  prev.map((r) => (r === row ? { ...r, mvp_bonus_pct: raw === "" ? null : Number(raw) } : r))
                                );
                              }}
                              style={input()}
                            />
                          </div>
                          <div style={fieldStack()} title="Percent bonus applied to challenge completion points.">
                            <div style={fieldLabel()}>Challenge Bonus %</div>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={row.challenge_completion_bonus_pct ?? ""}
                              onChange={(e) => {
                                const raw = digitsOnly(e.target.value);
                                setAvatars((prev) =>
                                  prev.map((r) =>
                                    r === row ? { ...r, challenge_completion_bonus_pct: raw === "" ? null : Number(raw) } : r
                                  )
                                );
                              }}
                              style={input()}
                            />
                          </div>
                        </div>
                        <div style={formRow({ columns: "repeat(3, minmax(0, 1fr))" })}>
                          <div style={fieldStack()}>
                            <div style={fieldLabel()}>Competition Only</div>
                            <label style={checkboxWrap()}>
                              <input
                                type="checkbox"
                                checked={row.competition_only === true}
                                onChange={(e) =>
                                  setAvatars((prev) =>
                                    prev.map((r) => (r === row ? { ...r, competition_only: e.target.checked } : r))
                                  )
                                }
                              />
                              Competition team only
                            </label>
                          </div>
                          <div style={fieldStack()}>
                            <div style={fieldLabel()}>Competition Discount %</div>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={row.competition_discount_pct ?? ""}
                              onChange={(e) => {
                                const raw = digitsOnly(e.target.value);
                                setAvatars((prev) =>
                                  prev.map((r) =>
                                    r === row ? { ...r, competition_discount_pct: raw === "" ? null : Number(raw) } : r
                                  )
                                );
                              }}
                              style={input()}
                            />
                          </div>
                          <div style={fieldStack()}>
                            <div style={fieldLabel()}>Limited Event Only</div>
                            <label style={checkboxWrap()}>
                              <input
                                type="checkbox"
                                checked={row.limited_event_only === true}
                                onChange={(e) =>
                                  setAvatars((prev) =>
                                    prev.map((r) => (r === row ? { ...r, limited_event_only: e.target.checked } : r))
                                  )
                                }
                              />
                              Limited/special event
                            </label>
                          </div>
                        </div>
                        <div style={formRow({ columns: "repeat(2, minmax(0, 1fr))" })}>
                          <div style={fieldStack()}>
                            <div style={fieldLabel()}>Event Name</div>
                            <input
                              value={row.limited_event_name ?? ""}
                              onChange={(e) =>
                                setAvatars((prev) => prev.map((r) => (r === row ? { ...r, limited_event_name: e.target.value } : r)))
                              }
                              style={input()}
                              placeholder="Special Event"
                            />
                          </div>
                          <div style={fieldStack()}>
                            <div style={fieldLabel()}>Event Description</div>
                            <input
                              value={row.limited_event_description ?? ""}
                              onChange={(e) =>
                                setAvatars((prev) => prev.map((r) => (r === row ? { ...r, limited_event_description: e.target.value } : r)))
                              }
                              style={input()}
                              placeholder="How to unlock this event avatar"
                            />
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <label style={checkboxWrap()}>
                            <input
                              type="checkbox"
                              checked={row.enabled !== false}
                              onChange={(e) =>
                                setAvatars((prev) => prev.map((r) => (r === row ? { ...r, enabled: e.target.checked } : r)))
                              }
                            />
                            Enabled
                          </label>
                          <label style={checkboxWrap()}>
                            <input
                              type="checkbox"
                              checked={row.is_secondary === true}
                              onChange={(e) =>
                                setAvatars((prev) => prev.map((r) => (r === row ? { ...r, is_secondary: e.target.checked } : r)))
                              }
                            />
                            Secondary
                          </label>
                          <button style={ghostButton()} onClick={() => openAvatarPicker({ type: "row", id: row.id })}>
                            Browse
                          </button>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => uploadAvatar(e.target.files?.[0] ?? null, { type: "row", id: row.id })}
                            style={fileInput()}
                          />
                          {avatarUploadProgress !== null && avatarUploadTargetId === String(row.id ?? "") ? (
                            <div style={uploadStatus()}>
                              <div style={uploadText()}>{avatarUploadStatus}</div>
                              <div style={uploadTrack()}>
                                <div style={{ ...uploadFill(), width: `${avatarUploadProgress}%` }} />
                              </div>
                            </div>
                          ) : null}
                        </div>
                        <button style={button(savedId === row.id)} disabled={saving || avatarUploading} onClick={() => saveAvatar(row)}>
                          {savedId === row.id ? "Saved" : "Save"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 1000 }}>Avatar Effects</div>
          <div style={{ display: "grid", gap: 10 }}>
            <label style={{ fontSize: 12, opacity: 0.8 }}>
              Preview avatar
              <select
                value={previewAvatarId}
                onChange={(e) => setPreviewAvatarId(e.target.value)}
                style={{ ...input(), marginTop: 6 }}
              >
                {avatars.map((a) => (
                  <option key={a.id ?? a.name} value={String(a.id ?? "")}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <div style={effectGrid()}>
              {avatarEffects.map((row) => {
                const isCode = row.render_mode === "code";
                const codePreview = buildCodePreview(row.html, row.css);
                const builderHref = row.id
                  ? `/admin/custom/create?tab=avatar-effect&effect=${row.id}`
                  : "/admin/custom/create?tab=avatar-effect";
                return (
                  <div key={row.key} style={effectCard()}>
                    <div style={effectPreviewWrap()}>
                      <div style={effectPreviewFx()}>
                        {isCode ? (
                          <div
                            style={{ width: "100%", height: "100%" }}
                            dangerouslySetInnerHTML={{ __html: codePreview }}
                          />
                        ) : (
                          <AvatarEffectParticles effectKey={row.key} config={row.config ?? undefined} />
                        )}
                      </div>
                      {previewSrc ? (
                        <img src={previewSrc} alt={previewAvatar?.name ?? "Avatar"} style={effectPreviewImg()} />
                      ) : (
                        <div style={{ opacity: 0.7, fontSize: 12 }}>No preview avatar</div>
                      )}
                    </div>
                    <label style={effectLabel()}>
                      Effect name
                      <input
                        type="text"
                        value={row.name ?? ""}
                        onChange={(e) =>
                          setAvatarEffects((prev) =>
                            prev.map((r) => (r.key === row.key ? { ...r, name: e.target.value } : r))
                          )
                        }
                        style={input()}
                      />
                    </label>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>Key: {row.key}</div>
                    <label style={effectLabel()}>
                      Unlock level
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={row.unlock_level ?? ""}
                        onChange={(e) =>
                          setAvatarEffects((prev) =>
                            prev.map((r) => (r.key === row.key ? { ...r, unlock_level: clampLevel(e.target.value) } : r))
                          )
                        }
                        style={input()}
                      />
                    </label>
                    <label style={effectLabel()}>
                      Unlock points
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={row.unlock_points ?? ""}
                        onChange={(e) =>
                          setAvatarEffects((prev) =>
                            prev.map((r) => (r.key === row.key ? { ...r, unlock_points: clampPoints(e.target.value) } : r))
                          )
                        }
                        style={input()}
                      />
                    </label>
                    <label style={checkboxWrap()}>
                      <input
                        type="checkbox"
                        checked={row.limited_event_only === true}
                        onChange={(e) =>
                          setAvatarEffects((prev) =>
                            prev.map((r) => (r.key === row.key ? { ...r, limited_event_only: e.target.checked } : r))
                          )
                        }
                      />
                      Limited event only
                    </label>
                    <label style={effectLabel()}>
                      Event name
                      <input
                        type="text"
                        value={row.limited_event_name ?? ""}
                        onChange={(e) =>
                          setAvatarEffects((prev) =>
                            prev.map((r) => (r.key === row.key ? { ...r, limited_event_name: e.target.value } : r))
                          )
                        }
                        style={input()}
                      />
                    </label>
                    <label style={effectLabel()}>
                      Event description
                      <input
                        type="text"
                        value={row.limited_event_description ?? ""}
                        onChange={(e) =>
                          setAvatarEffects((prev) =>
                            prev.map((r) => (r.key === row.key ? { ...r, limited_event_description: e.target.value } : r))
                          )
                        }
                        style={input()}
                      />
                    </label>
                    {!isCode ? (
                      <>
                        <div style={effectControls()}>
                          <label style={effectLabel()}>
                            Density
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={row.config?.density ?? ""}
                              onChange={(e) =>
                                setAvatarEffects((prev) =>
                                  prev.map((r) =>
                                    r.key === row.key
                                      ? {
                                          ...r,
                                          config: {
                                            ...(r.config ?? {}),
                                            density: clampLevel(e.target.value),
                                          },
                                        }
                                      : r
                                  )
                                )
                              }
                              style={input()}
                            />
                          </label>
                          <label style={effectLabel()}>
                            Size
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={row.config?.size ?? ""}
                              onChange={(e) =>
                                setAvatarEffects((prev) =>
                                  prev.map((r) =>
                                    r.key === row.key
                                      ? {
                                          ...r,
                                          config: {
                                            ...(r.config ?? {}),
                                            size: clampLevel(e.target.value),
                                          },
                                        }
                                      : r
                                  )
                                )
                              }
                              style={input()}
                            />
                          </label>
                          <label style={effectLabel()}>
                            Speed
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={row.config?.speed ?? ""}
                              onChange={(e) =>
                                setAvatarEffects((prev) =>
                                  prev.map((r) =>
                                    r.key === row.key
                                      ? {
                                          ...r,
                                          config: {
                                            ...(r.config ?? {}),
                                            speed: clampLevel(e.target.value),
                                          },
                                        }
                                      : r
                                  )
                                )
                              }
                              style={input()}
                            />
                          </label>
                          <label style={effectLabel()}>
                            Opacity
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={row.config?.opacity ?? ""}
                              onChange={(e) =>
                                setAvatarEffects((prev) =>
                                  prev.map((r) =>
                                    r.key === row.key
                                      ? {
                                          ...r,
                                          config: {
                                            ...(r.config ?? {}),
                                            opacity: clampLevel(e.target.value),
                                          },
                                        }
                                      : r
                                  )
                                )
                              }
                              style={input()}
                            />
                          </label>
                        </div>
                        {row.key === "fireworks" ? (
                          <label style={effectLabel()}>
                            Firework frequency (bursts/min)
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={row.config?.frequency ?? ""}
                              onChange={(e) =>
                                setAvatarEffects((prev) =>
                                  prev.map((r) =>
                                    r.key === row.key
                                      ? {
                                          ...r,
                                          config: {
                                            ...(r.config ?? {}),
                                            frequency: clampLevel(e.target.value),
                                          },
                                        }
                                      : r
                                  )
                                )
                              }
                              style={input()}
                            />
                          </label>
                        ) : null}
                      </>
                    ) : (
                      <div style={{ fontSize: 11, opacity: 0.7 }}>Render mode: Code</div>
                    )}
                    <label style={checkboxWrap()}>
                      <input
                        type="checkbox"
                        checked={row.enabled === false}
                        onChange={(e) => {
                          const hidden = e.target.checked;
                          const updated = { ...row, enabled: !hidden };
                          setAvatarEffects((prev) => prev.map((r) => (r.key === row.key ? updated : r)));
                          saveAvatarEffect(updated);
                        }}
                      />
                      Hide from student picker
                    </label>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <Link
                        href={builderHref}
                        style={{ ...ghostButton(), textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                      >
                        Open Builder
                      </Link>
                      <button
                        style={button(savedId === (row.id ?? row.key))}
                        disabled={saving}
                        onClick={() => saveAvatarEffect(row)}
                      >
                        {savedId === (row.id ?? row.key) ? "Saved" : "Save"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 1000 }}>Avatar Usage</div>
          {avatars.map((row) => {
            const usage = avatarUsage[row.id ?? ""] ?? { count: 0, students: [] };
            if (!usage.count) return null;
            return (
              <div key={`usage-${row.id}`} style={usageCard()}>
                <div style={{ fontWeight: 900 }}>{row.name}</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>Used by {usage.count} students</div>
                <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
                  {usage.students.map((s) => (
                    <div key={`${row.id}-${s.id}`} style={{ fontSize: 12, opacity: 0.85 }}>
                      {s.name} {s.level ? `• L${s.level}` : ""}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        </section>
      ) : null}

      {pickerOpen ? (
        <div style={pickerOverlay()}>
          <div style={pickerPanel()}>
            <div style={{ fontWeight: 1000, fontSize: 16 }}>Badge Art Library</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>
              Choose a badge image from the badges library bucket.
            </div>
            {pickerLoading ? <div style={{ fontSize: 12 }}>Loading...</div> : null}
            {pickerError ? <div style={{ color: "#fca5a5", fontSize: 12 }}>{pickerError}</div> : null}
            <div style={{ display: "grid", gap: 8, maxHeight: 300, overflowY: "auto" }}>
              {bucketFiles.map((file) => (
                <button key={file.path} style={pickerItem()} onClick={() => selectFromBucket(file.public_url)}>
                  <div style={thumbRow()}>
                    <img src={file.public_url} alt={file.path} style={thumbImg()} />
                    <span style={{ fontSize: 12 }}>{file.path}</span>
                  </div>
                </button>
              ))}
            </div>
            <button style={ghostButton()} onClick={() => setPickerOpen(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}

      {avatarPickerOpen ? (
        <div style={pickerOverlay()}>
          <div style={pickerPanel()}>
            <div style={{ fontWeight: 1000, fontSize: 16 }}>Avatar Bucket</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>
              Choose an avatar image from the avatars bucket.
            </div>
            {avatarPickerLoading ? <div style={{ fontSize: 12 }}>Loading...</div> : null}
            {avatarPickerError ? <div style={{ color: "#fca5a5", fontSize: 12 }}>{avatarPickerError}</div> : null}
            <div style={{ display: "grid", gap: 8, maxHeight: 300, overflowY: "auto" }}>
              {avatarBucketFiles.map((file) => (
                <button key={file.path} style={pickerItem()} onClick={() => selectAvatarFromBucket(file.path)}>
                  <div style={thumbRow()}>
                    <img src={file.public_url} alt={file.path} style={thumbImg()} />
                    <span style={{ fontSize: 12 }}>{file.path}</span>
                  </div>
                </button>
              ))}
            </div>
            <button style={ghostButton()} onClick={() => setAvatarPickerOpen(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}

      {cornerPickerOpen ? (
        <div style={pickerOverlay()}>
          <div style={pickerPanel()}>
            <div style={{ fontWeight: 1000, fontSize: 16 }}>Corner Borders Bucket</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>
              Choose a corner badge image from the corner bucket.
            </div>
            {cornerPickerLoading ? <div style={{ fontSize: 12 }}>Loading...</div> : null}
            {cornerPickerError ? <div style={{ color: "#fca5a5", fontSize: 12 }}>{cornerPickerError}</div> : null}
            <div style={{ display: "grid", gap: 8, maxHeight: 300, overflowY: "auto" }}>
              {cornerBucketFiles.map((file) => (
                <button key={file.path} style={pickerItem()} onClick={() => selectCornerFromBucket(file.public_url)}>
                  <div style={thumbRow()}>
                    <img src={file.public_url} alt={file.path} style={thumbImg()} />
                    <span style={{ fontSize: 12 }}>{file.path}</span>
                  </div>
                </button>
              ))}
            </div>
            <button style={ghostButton()} onClick={() => setCornerPickerOpen(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}

      {platePickerOpen ? (
        <div style={pickerOverlay()}>
          <div style={pickerPanel()}>
            <div style={{ fontWeight: 1000, fontSize: 16 }}>Card Plates Bucket</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>
              Choose a card plate image from the card-plates bucket.
            </div>
            {platePickerLoading ? <div style={{ fontSize: 12 }}>Loading...</div> : null}
            {platePickerError ? <div style={{ color: "#fca5a5", fontSize: 12 }}>{platePickerError}</div> : null}
            <div style={{ display: "grid", gap: 8, maxHeight: 300, overflowY: "auto" }}>
              {plateBucketFiles.map((file) => (
                <button key={file.path} style={pickerItem()} onClick={() => selectPlateFromBucket(file.public_url)}>
                  <div style={thumbRow()}>
                    <img src={file.public_url} alt={file.path} style={thumbImg()} />
                    <span style={{ fontSize: 12 }}>{file.path}</span>
                  </div>
                </button>
              ))}
            </div>
            <button style={ghostButton()} onClick={() => setPlatePickerOpen(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function sectionCard(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    display: "grid",
    gap: 10,
    boxShadow: "0 12px 30px rgba(0,0,0,0.2)",
  };
}

function formRow(opts?: { columns?: string }): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: opts?.columns ?? "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 8,
    alignItems: "center",
  };
}

function input(): React.CSSProperties {
  return {
    borderRadius: 10,
    padding: "8px 10px",
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(10,10,10,0.45)",
    color: "white",
    fontSize: 12,
    outline: "none",
    minWidth: 0,
  };
}

function fieldLabel(): React.CSSProperties {
  return {
    display: "grid",
    gap: 6,
    fontSize: 12,
    fontWeight: 900,
  };
}

function fieldStack(): React.CSSProperties {
  return {
    display: "grid",
    gap: 6,
  };
}

function checkboxWrap(): React.CSSProperties {
  return {
    display: "flex",
    gap: 6,
    alignItems: "center",
    fontSize: 12,
  };
}

function button(active = false): React.CSSProperties {
  return {
    borderRadius: 10,
    padding: "8px 12px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: active ? "rgba(59,130,246,0.7)" : "rgba(255,255,255,0.12)",
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
  };
}

function ghostButton(active = false): React.CSSProperties {
  return {
    borderRadius: 10,
    padding: "8px 12px",
    border: "1px solid rgba(255,255,255,0.16)",
    background: active ? "rgba(59,130,246,0.18)" : "transparent",
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
  };
}

function fileInput(): React.CSSProperties {
  return {
    fontSize: 11,
    color: "white",
    width: "100%",
  };
}

function uploadStatus(): React.CSSProperties {
  return {
    display: "grid",
    gap: 6,
  };
}

function uploadText(): React.CSSProperties {
  return {
    fontSize: 11,
    opacity: 0.8,
  };
}

function uploadTrack(): React.CSSProperties {
  return {
    height: 8,
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  };
}

function uploadFill(): React.CSSProperties {
  return {
    height: "100%",
    background: "linear-gradient(90deg, rgba(34,197,94,0.9), rgba(59,130,246,0.8))",
    transition: "width 160ms ease",
  };
}

function libraryRow(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.6)",
  };
}

function pillChip(): React.CSSProperties {
  return {
    borderRadius: 999,
    padding: "2px 8px",
    border: "1px solid rgba(255,255,255,0.24)",
    background: "rgba(15,23,42,0.7)",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0.2,
  };
}

function copyPickerMenu(): React.CSSProperties {
  return {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: 0,
    right: 0,
    maxHeight: 280,
    overflowY: "auto",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.35)",
    background: "rgba(2,6,23,0.97)",
    zIndex: 30,
    display: "grid",
    gap: 6,
    padding: 8,
    boxShadow: "0 14px 34px rgba(0,0,0,0.45)",
  };
}

function copyPickerOption(): React.CSSProperties {
  return {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "52px 1fr",
    gap: 8,
    alignItems: "center",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.28)",
    background: "rgba(15,23,42,0.9)",
    padding: 6,
    textAlign: "left",
    cursor: "pointer",
    color: "white",
  };
}

function copyPickerThumbWrap(): React.CSSProperties {
  return {
    width: 52,
    height: 52,
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.4)",
    background: "rgba(15,23,42,0.9)",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
  };
}

function copyPickerThumb(): React.CSSProperties {
  return {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  };
}

function copyModifierChip(color: string): React.CSSProperties {
  return {
    borderRadius: 999,
    padding: "1px 6px",
    border: `1px solid ${color}66`,
    color,
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 0.2,
    background: "rgba(15,23,42,0.7)",
  };
}

function clampLevel(value: string) {
  const cleaned = value.replace(/[^\d]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Math.max(1, Number.isFinite(num) ? num : 1);
}

function clampPoints(value: string) {
  const cleaned = value.replace(/[^\d]/g, "");
  if (!cleaned) return 0;
  const num = Number(cleaned);
  return Math.max(0, Number.isFinite(num) ? num : 0);
}

function digitsOnly(value: string) {
  return value.replace(/[^\d]/g, "");
}

function clampPercent(value: string) {
  const cleaned = value.replace(/[^\d]/g, "");
  if (!cleaned) return 0;
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, Math.floor(num)));
}

function clampMultiplier(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(5, value));
}

function clampZoom(value: number) {
  if (!Number.isFinite(value)) return 100;
  return Math.max(0, Math.min(200, Math.floor(value)));
}

function clampMultiplierPercent(value: string) {
  const cleaned = value.replace(/[^\d]/g, "");
  if (!cleaned) return 0;
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(500, Math.floor(num)));
}

function multiplierPercent(value: number | string | null | undefined) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 100;
  return Math.round(num * 100);
}

function levelGroup(): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.2)",
    display: "grid",
    gap: 10,
  };
}

function avatarGrid(): React.CSSProperties {
  return {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  };
}

function noteCard(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: "10px 12px",
    border: "1px dashed rgba(250,204,21,0.5)",
    background: "linear-gradient(135deg, rgba(250,204,21,0.18), rgba(0,0,0,0.35))",
    display: "grid",
    gap: 6,
  };
}

function noteTitle(): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 1000,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "rgba(250,204,21,0.9)",
  };
}

function noteBody(): React.CSSProperties {
  return {
    fontSize: 12,
    opacity: 0.8,
    lineHeight: 1.4,
  };
}

function avatarCard(): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    display: "grid",
    gap: 8,
    minHeight: 360,
    alignContent: "start",
  };
}

function cornerGrid(): React.CSSProperties {
  return {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  };
}

function cornerCard(): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    display: "grid",
    gap: 10,
    alignContent: "start",
  };
}

function cornerPreview(): React.CSSProperties {
  return {
    position: "relative",
    height: 120,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.35)",
    overflow: "hidden",
    display: "grid",
    placeItems: "center",
  };
}

function cornerPreviewAvatar(): React.CSSProperties {
  return {
    width: 90,
    height: 90,
    objectFit: "contain",
    position: "relative",
    zIndex: 1,
    opacity: 0.9,
  };
}

function cornerCodeLayer(): React.CSSProperties {
  return {
    position: "absolute",
    inset: 8,
    borderRadius: 12,
    overflow: "hidden",
    pointerEvents: "none",
  };
}

function cornerBadgeTopLeft(): React.CSSProperties {
  return {
    position: "absolute",
    top: -6,
    left: -6,
    width: 64,
    height: 64,
    objectFit: "contain",
    pointerEvents: "none",
  };
}

function cornerBadgeBottomRight(): React.CSSProperties {
  return {
    position: "absolute",
    bottom: -6,
    right: -6,
    width: 64,
    height: 64,
    objectFit: "contain",
    transform: "rotate(180deg)",
    pointerEvents: "none",
  };
}

function platePreview(): React.CSSProperties {
  return {
    position: "relative",
    height: 120,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.35)",
    overflow: "hidden",
    display: "grid",
    placeItems: "center",
  };
}

function platePreviewAvatar(): React.CSSProperties {
  return {
    width: 90,
    height: 90,
    objectFit: "contain",
    position: "relative",
    zIndex: 1,
    opacity: 0.9,
  };
}

function platePreviewLine(width: number): React.CSSProperties {
  return {
    position: "absolute",
    left: "50%",
    top: 10,
    width,
    height: "auto",
    transform: "translateX(-50%)",
    pointerEvents: "none",
    zIndex: 2,
  };
}

function plateOffsetPreviewWrap(width: number, height: number): React.CSSProperties {
  return {
    width,
    height,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(10,10,10,0.45)",
    display: "grid",
    placeItems: "center",
    position: "relative",
    overflow: "hidden",
    marginTop: 8,
  };
}

function plateOffsetAvatar(): React.CSSProperties {
  return {
    width: 80,
    height: 80,
    objectFit: "contain",
    position: "relative",
    zIndex: 1,
    opacity: 0.85,
  };
}

function plateOffsetLine(offset: { x: number; y: number; size: number }): React.CSSProperties {
  return {
    position: "absolute",
    left: offset.x,
    top: offset.y,
    width: offset.size,
    height: "auto",
    pointerEvents: "none",
    zIndex: 2,
  };
}

function categoryBar(): React.CSSProperties {
  return {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    padding: "8px 10px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.2)",
  };
}

function categoryButton(active: boolean): React.CSSProperties {
  return {
    borderRadius: 999,
    border: active ? "1px solid rgba(59,130,246,0.6)" : "1px solid rgba(255,255,255,0.14)",
    background: active ? "rgba(59,130,246,0.22)" : "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    fontSize: 12,
    padding: "8px 14px",
    cursor: "pointer",
  };
}

function chipRow(): React.CSSProperties {
  return {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  };
}

function chipButton(active: boolean): React.CSSProperties {
  return {
    borderRadius: 999,
    border: active ? "1px solid rgba(34,197,94,0.6)" : "1px solid rgba(255,255,255,0.12)",
    background: active ? "rgba(34,197,94,0.22)" : "rgba(255,255,255,0.05)",
    color: "white",
    fontSize: 11,
    fontWeight: 900,
    padding: "6px 12px",
    cursor: "pointer",
  };
}

function soundGrid(): React.CSSProperties {
  return {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gridAutoRows: "1fr",
    alignItems: "stretch",
  };
}

function soundCard(): React.CSSProperties {
  return {
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(8,10,15,0.7)",
    padding: 12,
    display: "grid",
    gap: 10,
    boxShadow: "0 8px 20px rgba(0,0,0,0.18)",
    minWidth: 0,
    height: "100%",
    alignContent: "start",
  };
}

function soundCardHeader(): React.CSSProperties {
  return {
    display: "grid",
    gap: 4,
    minWidth: 0,
  };
}

function soundCardRow(): React.CSSProperties {
  return {
    display: "grid",
    gap: 8,
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    alignItems: "end",
    minWidth: 0,
  };
}

function truncateLine(): React.CSSProperties {
  return {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };
}

function offsetPreviewWrap(size: number, bg: string): React.CSSProperties {
  return {
    width: size,
    height: size,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.16)",
    background: bg,
    display: "grid",
    placeItems: "center",
    position: "relative",
    overflow: "hidden",
    marginTop: 8,
  };
}

function offsetPreviewImg(): React.CSSProperties {
  return {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    position: "relative",
    zIndex: 1,
  };
}

function offsetPreviewCodeLayer(): React.CSSProperties {
  return {
    position: "absolute",
    inset: 8,
    borderRadius: 12,
    overflow: "hidden",
    pointerEvents: "none",
    zIndex: 2,
  };
}

function cornerBadgeOffsetTopLeft(offset: { x: number; y: number }, badgeSize: number): React.CSSProperties {
  return {
    position: "absolute",
    top: offset.y,
    left: offset.x,
    width: badgeSize,
    height: badgeSize,
    objectFit: "contain",
    pointerEvents: "none",
    zIndex: 2,
  };
}

function cornerBadgeOffsetBottomRight(offset: { x: number; y: number }, badgeSize: number): React.CSSProperties {
  return {
    position: "absolute",
    bottom: offset.y,
    right: offset.x,
    width: badgeSize,
    height: badgeSize,
    objectFit: "contain",
    transform: "rotate(180deg)",
    pointerEvents: "none",
    zIndex: 2,
  };
}

function positionGrid(): React.CSSProperties {
  return {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  };
}

function positionCard(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.25)",
    display: "grid",
    gap: 6,
  };
}

function avatarThumb(): React.CSSProperties {
  return {
    height: 160,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  };
}

function usageCard(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    display: "grid",
    gap: 6,
  };
}

function effectGrid(): React.CSSProperties {
  return {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  };
}

function effectCard(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    display: "grid",
    gap: 8,
  };
}

function effectPreviewWrap(): React.CSSProperties {
  return {
    position: "relative",
    height: 140,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  };
}

function effectPreviewFx(): React.CSSProperties {
  return {
    position: "absolute",
    inset: 6,
    borderRadius: 16,
    opacity: 0.85,
  };
}

function effectPreviewImg(): React.CSSProperties {
  return {
    width: "88%",
    height: "88%",
    objectFit: "contain",
    position: "relative",
    zIndex: 2,
  };
}

function effectControls(): React.CSSProperties {
  return {
    display: "grid",
    gap: 8,
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  };
}

function effectLabel(): React.CSSProperties {
  return {
    display: "grid",
    gap: 6,
    fontSize: 11,
    opacity: 0.8,
  };
}

function thumbRow(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
  };
}

function thumbImg(): React.CSSProperties {
  return {
    width: 44,
    height: 44,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.45)",
    objectFit: "contain",
  };
}

function backButton(): React.CSSProperties {
  return {
    borderRadius: 999,
    padding: "6px 12px",
    border: "1px solid rgba(255,255,255,0.2)",
    color: "white",
    textDecoration: "none",
  };
}

function pickerOverlay(): React.CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "grid",
    placeItems: "center",
    zIndex: 50,
  };
}

function pickerPanel(): React.CSSProperties {
  return {
    width: "min(720px, 90vw)",
    borderRadius: 16,
    padding: 18,
    background: "rgba(10,10,10,0.95)",
    border: "1px solid rgba(255,255,255,0.2)",
    display: "grid",
    gap: 12,
  };
}

function pickerItem(): React.CSSProperties {
  return {
    borderRadius: 10,
    padding: "8px 10px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "white",
    textAlign: "left",
    cursor: "pointer",
  };
}

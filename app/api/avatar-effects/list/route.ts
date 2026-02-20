import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

const EFFECT_PRESETS: Array<{
  key: string;
  name: string;
  config: { density: number; size: number; speed: number; opacity: number; frequency: number; scale: number };
}> = [
  { key: "orbit", name: "Orbit Rings", config: { density: 40, size: 6, speed: 6, opacity: 85, frequency: 1, scale: 1 } },
  { key: "spark", name: "Spark Drift", config: { density: 40, size: 6, speed: 6, opacity: 85, frequency: 1, scale: 1 } },
  { key: "halo", name: "Soft Halo", config: { density: 40, size: 6, speed: 6, opacity: 85, frequency: 1, scale: 1 } },
  { key: "storm", name: "Storm Rings", config: { density: 40, size: 6, speed: 6, opacity: 85, frequency: 1, scale: 1 } },
  { key: "ember", name: "Ember Glow", config: { density: 40, size: 6, speed: 6, opacity: 85, frequency: 1, scale: 1 } },
  { key: "aura", name: "Electric Aura", config: { density: 40, size: 6, speed: 6, opacity: 85, frequency: 1, scale: 1 } },
  { key: "spray", name: "Confetti Spray", config: { density: 40, size: 6, speed: 6, opacity: 85, frequency: 1, scale: 1 } },
  { key: "nebula", name: "Nebula Mist", config: { density: 40, size: 6, speed: 6, opacity: 85, frequency: 1, scale: 1 } },
  { key: "starfield", name: "Starfield", config: { density: 80, size: 3, speed: 3, opacity: 50, frequency: 1, scale: 1 } },
  { key: "comet", name: "Comet Trails", config: { density: 35, size: 8, speed: 12, opacity: 70, frequency: 1, scale: 1 } },
  { key: "grid", name: "Neon Grid", config: { density: 60, size: 5, speed: 4, opacity: 45, frequency: 1, scale: 1 } },
  { key: "vortex", name: "Vortex Spin", config: { density: 50, size: 7, speed: 9, opacity: 65, frequency: 1, scale: 1 } },
  { key: "pulse", name: "Pulse Waves", config: { density: 20, size: 14, speed: 4, opacity: 30, frequency: 1, scale: 1 } },
  { key: "rain", name: "Digital Rain", config: { density: 70, size: 5, speed: 14, opacity: 40, frequency: 1, scale: 1 } },
  { key: "orbitals", name: "Orbital Rings", config: { density: 30, size: 9, speed: 6, opacity: 60, frequency: 1, scale: 1 } },
  { key: "fireworks", name: "Fireworks Burst", config: { density: 12, size: 8, speed: 14, opacity: 85, frequency: 1, scale: 1 } },
];

export async function GET() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  let { data, error } = await supabase
    .from("avatar_effects")
    .select("id,key,name,unlock_level,unlock_points,config,render_mode,z_layer,html,css,js,enabled,limited_event_only,limited_event_name,limited_event_description")
    .order("unlock_level", { ascending: true })
    .order("name", { ascending: true });

  if (error && /z_layer|limited_event_/i.test(error.message ?? "")) {
    const fallback = await supabase
      .from("avatar_effects")
      .select("id,key,name,unlock_level,unlock_points,config,render_mode,html,css,js,enabled")
      .order("unlock_level", { ascending: true })
      .order("name", { ascending: true });
    data = (fallback.data ?? []).map((row: any) => ({
      ...row,
      z_layer: "behind_avatar",
      limited_event_only: false,
      limited_event_name: "",
      limited_event_description: "",
    }));
    error = fallback.error;
  }

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const rows = (data ?? []) as Array<{
    id?: string;
    key: string;
    name: string;
    unlock_level?: number | null;
    unlock_points?: number | null;
    config?: any;
    render_mode?: string | null;
    z_layer?: string | null;
    html?: string | null;
    css?: string | null;
    js?: string | null;
    enabled?: boolean;
    limited_event_only?: boolean | null;
    limited_event_name?: string | null;
    limited_event_description?: string | null;
  }>;
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const merged = EFFECT_PRESETS.map((preset) => {
    const row = byKey.get(preset.key);
    return {
      id: row?.id ?? null,
      key: preset.key,
      name: row?.name ?? preset.name,
      unlock_level: row?.unlock_level ?? 1,
      unlock_points: row?.unlock_points ?? 0,
      config: { ...preset.config, ...(typeof row?.config === "object" && row?.config ? row.config : {}) },
      render_mode: row?.render_mode ?? "particles",
      z_layer: row?.z_layer ?? "behind_avatar",
      html: row?.html ?? "",
      css: row?.css ?? "",
      js: row?.js ?? "",
      enabled: row?.enabled ?? false,
      limited_event_only: row?.limited_event_only ?? false,
      limited_event_name: row?.limited_event_name ?? "",
      limited_event_description: row?.limited_event_description ?? "",
    };
  });
  const extras = rows
    .filter((row) => !EFFECT_PRESETS.some((preset) => preset.key === row.key))
    .map((row) => ({
      id: row?.id ?? null,
      key: row.key,
      name: row.name,
      unlock_level: row.unlock_level ?? 1,
      unlock_points: row.unlock_points ?? 0,
      config: row.config ?? {},
      render_mode: row.render_mode ?? "particles",
      z_layer: row?.z_layer ?? "behind_avatar",
      html: row.html ?? "",
      css: row.css ?? "",
      js: row.js ?? "",
      enabled: row.enabled ?? false,
      limited_event_only: row?.limited_event_only ?? false,
      limited_event_name: row?.limited_event_name ?? "",
      limited_event_description: row?.limited_event_description ?? "",
    }));
  const effects = [...merged, ...extras];

  return NextResponse.json({ ok: true, effects });
}

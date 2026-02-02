import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

const EFFECT_PRESETS: Array<{
  key: string;
  name: string;
  config: { density: number; size: number; speed: number; opacity: number };
}> = [
  { key: "orbit", name: "Orbit Rings", config: { density: 40, size: 6, speed: 6, opacity: 85 } },
  { key: "spark", name: "Spark Drift", config: { density: 40, size: 6, speed: 6, opacity: 85 } },
  { key: "halo", name: "Soft Halo", config: { density: 40, size: 6, speed: 6, opacity: 85 } },
  { key: "storm", name: "Storm Rings", config: { density: 40, size: 6, speed: 6, opacity: 85 } },
  { key: "ember", name: "Ember Glow", config: { density: 40, size: 6, speed: 6, opacity: 85 } },
  { key: "aura", name: "Electric Aura", config: { density: 40, size: 6, speed: 6, opacity: 85 } },
  { key: "spray", name: "Confetti Spray", config: { density: 40, size: 6, speed: 6, opacity: 85 } },
  { key: "nebula", name: "Nebula Mist", config: { density: 40, size: 6, speed: 6, opacity: 85 } },
  { key: "starfield", name: "Starfield", config: { density: 80, size: 3, speed: 3, opacity: 50 } },
  { key: "comet", name: "Comet Trails", config: { density: 35, size: 8, speed: 12, opacity: 70 } },
  { key: "grid", name: "Neon Grid", config: { density: 60, size: 5, speed: 4, opacity: 45 } },
  { key: "vortex", name: "Vortex Spin", config: { density: 50, size: 7, speed: 9, opacity: 65 } },
  { key: "pulse", name: "Pulse Waves", config: { density: 20, size: 14, speed: 4, opacity: 30 } },
  { key: "rain", name: "Digital Rain", config: { density: 70, size: 5, speed: 14, opacity: 40 } },
  { key: "orbitals", name: "Orbital Rings", config: { density: 30, size: 9, speed: 6, opacity: 60 } },
  { key: "fireworks", name: "Fireworks Burst", config: { density: 12, size: 8, speed: 14, opacity: 85 } },
];

export async function GET() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const { data, error } = await supabase
    .from("avatar_effects")
    .select("id,key,name,unlock_level,unlock_points,config,render_mode,html,css,js,enabled")
    .order("unlock_level", { ascending: true })
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const rows = (data ?? []) as Array<{
    id?: string;
    key: string;
    name: string;
    unlock_level?: number | null;
    unlock_points?: number | null;
    config?: any;
    render_mode?: string | null;
    html?: string | null;
    css?: string | null;
    js?: string | null;
    enabled?: boolean;
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
      config: row?.config ?? preset.config,
      render_mode: row?.render_mode ?? "particles",
      html: row?.html ?? "",
      css: row?.css ?? "",
      js: row?.js ?? "",
      enabled: row?.enabled ?? false,
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
      html: row.html ?? "",
      css: row.css ?? "",
      js: row.js ?? "",
      enabled: row.enabled ?? false,
    }));
  const effects = [...merged, ...extras];

  return NextResponse.json({ ok: true, effects });
}

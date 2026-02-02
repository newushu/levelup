import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const admin = supabaseAdmin();
  const { data: nav, error: navErr } = await admin
    .from("ui_nav_settings")
    .select("logo_url,logo_zoom")
    .limit(1)
    .maybeSingle();
  if (navErr) return NextResponse.json({ ok: false, error: navErr.message }, { status: 500 });

  const { data: introSound } = await admin
    .from("ui_sound_effects")
    .select("audio_url,volume,enabled")
    .eq("key", "logo_intro")
    .maybeSingle();

  const enabled = introSound?.enabled !== false;
  return NextResponse.json({
    ok: true,
    logo_url: nav?.logo_url ?? null,
    logo_zoom: Number(nav?.logo_zoom ?? 1) || 1,
    intro_audio_url: enabled ? introSound?.audio_url ?? null : null,
    intro_volume: enabled ? Number(introSound?.volume ?? 1) : null,
  });
}

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("skill_strike_settings")
      .select("id,hp_default,max_team_size,max_effects_in_play,updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    if (!data) {
      const { data: created, error: createErr } = await admin
        .from("skill_strike_settings")
        .insert({})
        .select("id,hp_default,max_team_size,max_effects_in_play,updated_at")
        .single();
      if (createErr) {
        return NextResponse.json({ ok: false, error: createErr.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, settings: created });
    }

    return NextResponse.json({ ok: true, settings: data });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? "Failed to load settings" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const hp_default = Math.max(1, Number(body?.hp_default ?? 50));
    const max_team_size = Math.max(2, Number(body?.max_team_size ?? 4));
    const max_effects_in_play = Math.max(1, Number(body?.max_effects_in_play ?? 3));

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("skill_strike_settings")
      .upsert({
        id: body?.id,
        hp_default,
        max_team_size,
        max_effects_in_play,
        updated_at: new Date().toISOString(),
      })
      .select("id,hp_default,max_team_size,max_effects_in_play,updated_at")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, settings: data });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? "Failed to save settings" }, { status: 500 });
  }
}

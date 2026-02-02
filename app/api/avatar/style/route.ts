import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  const bg_color = String(body?.bg_color ?? "").trim();
  const particle_style = String(body?.particle_style ?? "").trim();
  const corner_border_key = String(body?.corner_border_key ?? "").trim();
  const card_plate_key = String(body?.card_plate_key ?? "").trim();

  if (!student_id) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });
  if (!bg_color && !particle_style && !corner_border_key && !card_plate_key) {
    return NextResponse.json({ ok: false, error: "Missing bg_color, particle_style, corner_border_key, or card_plate_key" }, { status: 400 });
  }

  const payload: Record<string, any> = {
    student_id,
    updated_at: new Date().toISOString(),
  };
  if (bg_color) payload.bg_color = bg_color;
  if (particle_style) {
    payload.particle_style = particle_style === "none" ? null : particle_style;
  }
  if (corner_border_key) {
    payload.corner_border_key = corner_border_key === "none" ? null : corner_border_key;
  }
  if (card_plate_key) {
    payload.card_plate_key = card_plate_key === "none" ? null : card_plate_key;
  }

  // Upsert style updates
  const up = await supabase
    .from("student_avatar_settings")
    .upsert(
      payload,
      { onConflict: "student_id" }
    )
    .select("student_id, avatar_id, bg_color, border_color, glow_color, pattern, particle_style, aura_style, planet_style, corner_border_key, card_plate_key, updated_at")
    .maybeSingle();

  if (up.error) return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });

  return NextResponse.json({ ok: true, settings: up.data ?? null });
}

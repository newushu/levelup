import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

const DEFAULTS = {
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
};

export async function GET() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const { data, error } = await supabase
    .from("ui_card_plate_positions")
    .select(
      "dashboard_x,dashboard_y,dashboard_size,selector_x,selector_y,selector_size,skill_pulse_x,skill_pulse_y,skill_pulse_size,skill_pulse_tracker_x,skill_pulse_tracker_y,skill_pulse_tracker_size,live_activity_x,live_activity_y,live_activity_size,roster_x,roster_y,roster_size,taolu_tracker_x,taolu_tracker_y,taolu_tracker_size,battle_pulse_x,battle_pulse_y,battle_pulse_size,updated_at"
    )
    .eq("id", 1)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, settings: data ?? DEFAULTS });
}

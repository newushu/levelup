import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

const DEFAULTS = {
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
};

export async function GET() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const { data, error } = await supabase
    .from("ui_corner_border_positions")
    .select(
      "dashboard_x,dashboard_y,dashboard_size,selector_x,selector_y,selector_size,skill_pulse_x,skill_pulse_y,skill_pulse_size,skill_pulse_tracker_x,skill_pulse_tracker_y,skill_pulse_tracker_size,live_activity_x,live_activity_y,live_activity_size,roster_x,roster_y,roster_size,updated_at"
    )
    .eq("id", 1)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, settings: data ?? DEFAULTS });
}

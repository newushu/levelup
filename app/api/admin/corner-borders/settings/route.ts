import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { ok: false as const, error: "Not logged in" };

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id)
    .eq("role", "admin")
    .limit(1);

  if (error) return { ok: false as const, error: error.message };
  if (!roles || roles.length === 0) return { ok: false as const, error: "Admin access required" };

  return { ok: true as const };
}

function toInt(value: any, fallback: number) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(-200, Math.min(200, Math.round(num)));
}

function toSize(value: any, fallback: number) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(24, Math.min(220, Math.round(num)));
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const admin = supabaseAdmin();
  const payload = {
    id: 1,
    dashboard_x: toInt(body?.dashboard_x, -8),
    dashboard_y: toInt(body?.dashboard_y, -8),
    dashboard_size: toSize(body?.dashboard_size, 88),
    selector_x: toInt(body?.selector_x, -8),
    selector_y: toInt(body?.selector_y, -8),
    selector_size: toSize(body?.selector_size, 84),
    skill_pulse_x: toInt(body?.skill_pulse_x, -10),
    skill_pulse_y: toInt(body?.skill_pulse_y, -10),
    skill_pulse_size: toSize(body?.skill_pulse_size, 72),
    skill_pulse_tracker_x: toInt(body?.skill_pulse_tracker_x, -10),
    skill_pulse_tracker_y: toInt(body?.skill_pulse_tracker_y, -10),
    skill_pulse_tracker_size: toSize(body?.skill_pulse_tracker_size, 72),
    live_activity_x: toInt(body?.live_activity_x, -10),
    live_activity_y: toInt(body?.live_activity_y, -10),
    live_activity_size: toSize(body?.live_activity_size, 72),
    roster_x: toInt(body?.roster_x, -8),
    roster_y: toInt(body?.roster_y, -8),
    roster_size: toSize(body?.roster_size, 96),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from("ui_corner_border_positions")
    .upsert(payload, { onConflict: "id" })
    .select(
      "dashboard_x,dashboard_y,dashboard_size,selector_x,selector_y,selector_size,skill_pulse_x,skill_pulse_y,skill_pulse_size,skill_pulse_tracker_x,skill_pulse_tracker_y,skill_pulse_tracker_size,live_activity_x,live_activity_y,live_activity_size,roster_x,roster_y,roster_size,updated_at"
    )
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, settings: data ?? payload });
}

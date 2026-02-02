import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("leaderboard_bonus_settings")
    .select("id,total_points,skill_pulse_points,performance_lab_points,skill_tracker_points_per_rep,updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, settings: data ?? null });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const total_points = Math.max(0, Math.floor(Number(body?.total_points ?? 0)));
  const skill_pulse_points = Math.max(0, Math.floor(Number(body?.skill_pulse_points ?? 0)));
  const performance_lab_points = Math.max(0, Math.floor(Number(body?.performance_lab_points ?? 0)));
  const skill_tracker_points_per_rep = Math.max(0, Math.floor(Number(body?.skill_tracker_points_per_rep ?? 0)));

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("leaderboard_bonus_settings")
    .upsert(
      {
        id: 1,
        total_points,
        skill_pulse_points,
        performance_lab_points,
        skill_tracker_points_per_rep,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    )
    .select("id,total_points,skill_pulse_points,performance_lab_points,skill_tracker_points_per_rep,updated_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, settings: data });
}

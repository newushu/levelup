import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function mondayOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: parent, error: pErr } = await admin
    .from("parents")
    .select("id")
    .eq("auth_user_id", gate.user.id)
    .maybeSingle();
  if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });
  if (!parent?.id) return NextResponse.json({ ok: false, error: "Not a parent account" }, { status: 403 });

  const { data: settings } = await admin.from("app_settings").select("parent_weekly_points_limit").eq("id", 1).single();
  const limit = Number(settings?.parent_weekly_points_limit ?? 30);
  const weekStart = mondayOfWeek(new Date()).toISOString().slice(0, 10);

  const { data: awards, error: aErr } = await admin
    .from("parent_weekly_awards")
    .select("points")
    .eq("parent_id", parent.id)
    .eq("week_start", weekStart);
  if (aErr) return NextResponse.json({ ok: false, error: aErr.message }, { status: 500 });

  const used = (awards ?? []).reduce((sum: number, row: any) => sum + Number(row.points ?? 0), 0);

  return NextResponse.json({ ok: true, limit, used, week_start: weekStart });
}

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveParentContext } from "../_parentContext";

function mondayOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function GET(req: Request) {
  const ctx = await resolveParentContext(req);
  if (!ctx.ok) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status });
  const parent = ctx.parent;

  const admin = supabaseAdmin();
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

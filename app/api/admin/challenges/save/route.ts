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

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  const name = String(body?.name ?? "").trim();
  const description = String(body?.description ?? "").trim();
  const category = String(body?.category ?? "").trim();
  const tier = String(body?.tier ?? "bronze").trim();
  const enabled = body?.enabled !== false;
  const badge_id = String(body?.badge_id ?? "").trim() || null;
  const challenge_type = String(body?.challenge_type ?? "task").trim();
  const quota_type = String(body?.quota_type ?? "").trim() || null;
  const quota_target = Number(body?.quota_target ?? 0) || null;
  const stat_id = String(body?.stat_id ?? "").trim() || null;
  const stat_threshold = body?.stat_threshold !== undefined && body?.stat_threshold !== "" ? Number(body?.stat_threshold) : null;
  const stat_compare = String(body?.stat_compare ?? ">=").trim();
  const data_point_key = String(body?.data_point_key ?? "").trim() || null;
  const data_point_window_days = Number(body?.data_point_window_days ?? 0) || null;
  const fallbackDefaults: Record<string, number> = {
    bronze: 15,
    silver: 30,
    gold: 60,
    platinum: 100,
    diamond: 200,
    master: 500,
  };
  const tierDefaults = { ...fallbackDefaults };
  const admin = supabaseAdmin();
  const { data: tierRows, error: tierErr } = await admin.from("challenge_tier_defaults").select("tier,points");
  if (!tierErr && tierRows) {
    (tierRows ?? []).forEach((row: any) => {
      const key = String(row.tier ?? "").toLowerCase();
      const pts = Number(row.points ?? NaN);
      if (key && Number.isFinite(pts)) tierDefaults[key] = pts;
    });
  }
  const points_awarded =
    body?.points_awarded !== undefined && body?.points_awarded !== ""
      ? Number(body?.points_awarded)
      : (tierDefaults[String(tier).toLowerCase()] ?? null);
  const limit_mode = String(body?.limit_mode ?? "once").trim();
  const limit_count = Number(body?.limit_count ?? 1) || 1;
  const limit_window_days = Number(body?.limit_window_days ?? 0) || null;

  if (!id) return NextResponse.json({ ok: false, error: "ID is required" }, { status: 400 });
  if (!name) return NextResponse.json({ ok: false, error: "Name is required" }, { status: 400 });

  const payload: any = {
    id,
    name,
    description: description || null,
    category: category || null,
    tier,
    enabled,
    badge_id,
    challenge_type,
    quota_type,
    quota_target,
    stat_id,
    stat_threshold,
    stat_compare,
    data_point_key,
    data_point_window_days,
    points_awarded,
    limit_mode,
    limit_count,
    limit_window_days,
  };

  const { data, error } = await admin
    .from("challenges")
    .upsert(payload, { onConflict: "id" })
    .select(
      [
        "id",
        "name",
        "description",
        "category",
        "tier",
        "enabled",
        "badge_id",
        "challenge_type",
        "quota_type",
        "quota_target",
        "stat_id",
        "stat_threshold",
        "stat_compare",
        "data_point_key",
        "data_point_window_days",
        "points_awarded",
        "limit_mode",
        "limit_count",
        "limit_window_days",
      ].join(",")
    )
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, challenge: data });
}

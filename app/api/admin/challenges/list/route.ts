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

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const admin = supabaseAdmin();
  let { data, error } = await admin
    .from("challenges")
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
        "daily_limit_count",
        "home_available",
        "home_origin",
        "home_parent_id",
        "home_approved_at",
        "created_at",
      ].join(",")
    )
    .order("tier", { ascending: true })
    .order("name", { ascending: true });
  if (error && String(error.message || "").toLowerCase().includes("daily_limit_count")) {
    const retry = await admin
      .from("challenges")
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
          "home_available",
          "home_origin",
          "home_parent_id",
          "home_approved_at",
          "created_at",
        ].join(",")
      )
      .order("tier", { ascending: true })
      .order("name", { ascending: true });
    data = retry.data as any;
    error = retry.error as any;
  }
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, challenges: data ?? [] });
}

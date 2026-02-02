import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: levels, error } = await admin
    .from("avatar_level_thresholds")
    .select("level,min_lifetime_points")
    .order("level", { ascending: true });

  const { data: settings, error: sErr } = await admin
    .from("avatar_level_settings")
    .select("base_jump,difficulty_pct")
    .eq("id", 1)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, levels: levels ?? [], settings: settings ?? null });
}

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
  const [{ data: achievements, error: aErr }, { data: library, error: lErr }] = await Promise.all([
    admin
      .from("achievement_badges")
      .select("id,name,description,category,icon_path,criteria_type,criteria_json,enabled,points_award,badge_library_id,icon_zoom")
      .order("category", { ascending: true })
      .order("name", { ascending: true }),
    admin
      .from("badge_library")
      .select("id,name,description,image_url,enabled,category")
      .order("category", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  if (aErr) return NextResponse.json({ ok: false, error: aErr.message }, { status: 500 });
  if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, achievements: achievements ?? [], badgeLibrary: library ?? [] });
}

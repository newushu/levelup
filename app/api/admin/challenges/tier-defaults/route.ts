import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabase/server";

const fallbackDefaults: Record<string, number> = {
  bronze: 15,
  silver: 30,
  gold: 60,
  platinum: 100,
  diamond: 200,
  master: 500,
};

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
  const { data, error } = await admin
    .from("challenge_tier_defaults")
    .select("tier,points");

  if (error && String(error.message || "").includes("relation")) {
    return NextResponse.json({ ok: true, defaults: fallbackDefaults });
  }
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const defaults = { ...fallbackDefaults };
  (data ?? []).forEach((row: any) => {
    const tier = String(row.tier ?? "").toLowerCase();
    const points = Number(row.points ?? NaN);
    if (tier && Number.isFinite(points)) defaults[tier] = points;
  });

  return NextResponse.json({ ok: true, defaults });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const defaults = body?.defaults ?? {};
  const rows = Object.entries(defaults).map(([tier, points]) => ({
    tier: String(tier),
    points: Number(points),
  }));

  const admin = supabaseAdmin();
  const { error } = await admin.from("challenge_tier_defaults").upsert(rows, { onConflict: "tier" });

  if (error && String(error.message || "").includes("relation")) {
    return NextResponse.json({ ok: false, error: "Missing challenge_tier_defaults table" }, { status: 500 });
  }
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

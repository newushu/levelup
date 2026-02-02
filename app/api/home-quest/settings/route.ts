import { NextResponse } from "next/server";
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

const DEFAULTS = {
  max_points: 50,
  features: {
    games: true,
    home_tracker: true,
    daily_checkin: true,
    quiz: true,
  },
};

export async function GET() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("home_quest_settings")
    .select("id,max_points,features,parent_pin_hash")
    .eq("id", "default")
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const settings = data
    ? {
        max_points: Number(data.max_points ?? DEFAULTS.max_points),
        features: { ...DEFAULTS.features, ...(data.features ?? {}) },
        parent_pin_set: Boolean(data.parent_pin_hash),
      }
    : { ...DEFAULTS, parent_pin_set: false };

  return NextResponse.json({ ok: true, settings });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const supabase = await supabaseServer();
  const body = await req.json().catch(() => ({}));
  const max_points = Number(body?.max_points ?? DEFAULTS.max_points);
  const features = body?.features ?? DEFAULTS.features;
  const parent_pin = String(body?.parent_pin ?? "").trim();

  let parent_pin_hash: string | null = null;
  if (parent_pin) {
    const encoder = new TextEncoder();
    const data = encoder.encode(parent_pin);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    parent_pin_hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  const payload: any = {
    id: "default",
    max_points: Number.isFinite(max_points) ? max_points : DEFAULTS.max_points,
    features,
  };
  if (parent_pin_hash) payload.parent_pin_hash = parent_pin_hash;

  const { error } = await supabase
    .from("home_quest_settings")
    .upsert(payload, { onConflict: "id" });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

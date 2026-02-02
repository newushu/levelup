import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

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

  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("skill_tracker_settings")
    .select("id,admin_pin_hash")
    .eq("id", "default")
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    settings: {
      admin_pin_set: Boolean(data?.admin_pin_hash),
    },
  });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const supabase = await supabaseServer();
  const body = await req.json().catch(() => ({}));
  const admin_pin = String(body?.admin_pin ?? "").trim();

  let admin_pin_hash: string | null = null;
  if (admin_pin) {
    const encoder = new TextEncoder();
    const data = encoder.encode(admin_pin);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    admin_pin_hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  if (!admin_pin_hash) {
    return NextResponse.json({ ok: false, error: "Admin PIN required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("skill_tracker_settings")
    .upsert({ id: "default", admin_pin_hash }, { onConflict: "id" });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

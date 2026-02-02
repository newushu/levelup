import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";

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

async function hashPin(pin: string) {
  const data = new TextEncoder().encode(pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const supabase = await supabaseServer();
  const body = await req.json().catch(() => ({}));
  const pin = String(body?.pin ?? "").trim();
  if (!pin) return NextResponse.json({ ok: false, error: "PIN required" }, { status: 400 });

  const { data, error } = await supabase
    .from("skill_tracker_settings")
    .select("admin_pin_hash")
    .eq("id", "default")
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  if (!data?.admin_pin_hash) return NextResponse.json({ ok: false, error: "Admin PIN not set" }, { status: 400 });
  const pinHash = await hashPin(pin);
  if (pinHash !== data.admin_pin_hash) return NextResponse.json({ ok: false, error: "Invalid PIN" }, { status: 403 });

  return NextResponse.json({ ok: true });
}

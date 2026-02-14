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

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const supabase = await supabaseServer();
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

  const payload = {
    name: String(body?.name ?? "").trim() || null,
    timezone: String(body?.timezone ?? "").trim() || null,
    address_line1: String(body?.address_line1 ?? "").trim() || null,
    address_line2: String(body?.address_line2 ?? "").trim() || null,
    city: String(body?.city ?? "").trim() || null,
    state: String(body?.state ?? "").trim() || null,
    postal_code: String(body?.postal_code ?? "").trim() || null,
    country: String(body?.country ?? "").trim() || null,
  };

  if (!payload.name) return NextResponse.json({ ok: false, error: "Location name required" }, { status: 400 });

  const { error } = await supabase.from("locations").update(payload).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

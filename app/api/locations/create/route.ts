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

  return { ok: true as const, userId: u.user.id };
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const supabase = await supabaseServer();
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();
  const timezone = String(body?.timezone ?? "").trim() || null;

  if (!name) {
    return NextResponse.json({ ok: false, error: "Missing name" }, { status: 400 });
  }

  const payload = {
    name,
    timezone,
    address_line1: String(body?.address_line1 ?? "").trim() || null,
    address_line2: String(body?.address_line2 ?? "").trim() || null,
    city: String(body?.city ?? "").trim() || null,
    state: String(body?.state ?? "").trim() || null,
    postal_code: String(body?.postal_code ?? "").trim() || null,
    country: String(body?.country ?? "").trim() || null,
  };

  const { data, error } = await supabase.from("locations").insert(payload).select("id").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data?.id ?? null });
}

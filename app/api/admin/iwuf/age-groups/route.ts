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

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("iwuf_age_groups")
    .select("id,name,min_age,max_age,created_at")
    .order("min_age", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, groups: data ?? [] });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim() || undefined;
  const name = String(body?.name ?? "").trim();
  const min_age = body?.min_age === "" || body?.min_age === null ? null : Number(body?.min_age);
  const max_age = body?.max_age === "" || body?.max_age === null ? null : Number(body?.max_age);

  if (!name) return NextResponse.json({ ok: false, error: "Missing name" }, { status: 400 });
  if (min_age !== null && Number.isNaN(min_age)) return NextResponse.json({ ok: false, error: "Invalid min_age" }, { status: 400 });
  if (max_age !== null && Number.isNaN(max_age)) return NextResponse.json({ ok: false, error: "Invalid max_age" }, { status: 400 });

  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("iwuf_age_groups")
    .upsert({ id, name, min_age, max_age })
    .select("id,name,min_age,max_age,created_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, group: data });
}

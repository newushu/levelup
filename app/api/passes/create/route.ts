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
  const name = String(body?.name ?? "").trim();
  const description = String(body?.description ?? "").trim() || null;
  const price_usd = Number.isFinite(Number(body?.price_usd)) ? Number(body.price_usd) : null;
  const discount_price_usd = Number.isFinite(Number(body?.discount_price_usd)) ? Number(body.discount_price_usd) : null;
  const discount_start = String(body?.discount_start ?? "").trim() || null;
  const discount_end = String(body?.discount_end ?? "").trim() || null;
  const access_scope = String(body?.access_scope ?? "").trim() || null;
  const default_valid_days = Number.isFinite(Number(body?.default_valid_days))
    ? Number(body.default_valid_days)
    : null;
  const image_url = String(body?.image_url ?? "").trim() || null;
  const image_text = String(body?.image_text ?? "").trim() || null;
  const use_text = body?.use_text === true;

  if (!name) return NextResponse.json({ ok: false, error: "Missing pass name" }, { status: 400 });
  if (price_usd === null || Number.isNaN(price_usd)) {
    return NextResponse.json({ ok: false, error: "Pass price is required" }, { status: 400 });
  }

  const insertBase = { name, description, enabled: true };
  let { data, error } = await supabase
    .from("pass_types")
    .insert({
      ...insertBase,
      price_usd,
      discount_price_usd,
      discount_start,
      discount_end,
      access_scope,
      default_valid_days,
      image_url,
      image_text,
      use_text,
    })
    .select("id")
    .single();
  const isMissingColumn = (err: any) => String(err?.message || "").toLowerCase().includes("column");
  if (error && isMissingColumn(error)) {
    const retry = await supabase.from("pass_types").insert(insertBase).select("id").single();
    data = retry.data;
    error = retry.error;
  }

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data?.id });
}

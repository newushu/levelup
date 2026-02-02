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
  const baseSelect =
    "id,name,description,enabled,price_usd,discount_price_usd,discount_start,discount_end,access_scope,default_valid_days,image_url,image_text,use_text";
  let { data, error } = await supabase.from("pass_types").select(baseSelect).order("name", { ascending: true });
  const isMissingColumn = (err: any) => String(err?.message || "").toLowerCase().includes("column");
  if (error && isMissingColumn(error)) {
    const retry = await supabase.from("pass_types").select("id,name,description,enabled").order("name", { ascending: true });
    data = retry.data;
    error = retry.error;
  }

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, passes: data ?? [] });
}

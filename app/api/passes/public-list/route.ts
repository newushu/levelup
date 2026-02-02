import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const admin = supabaseAdmin();
  const baseSelect =
    "id,name,description,enabled,price_usd,discount_price_usd,discount_start,discount_end,access_scope,default_valid_days,image_url,image_text,use_text";
  let { data, error } = await admin.from("pass_types").select(baseSelect).eq("enabled", true).order("name", { ascending: true });
  const isMissingColumn = (err: any) => String(err?.message || "").toLowerCase().includes("column");
  if (error && isMissingColumn(error)) {
    const retry = await admin.from("pass_types").select("id,name,description,enabled").eq("enabled", true).order("name", { ascending: true });
    data = retry.data;
    error = retry.error;
  }

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, passes: data ?? [] });
}

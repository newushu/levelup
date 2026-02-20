import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseServer } from "@/lib/supabase/server";

async function hashPin(pin: string) {
  const data = new TextEncoder().encode(pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isMissingColumn(error: any, col: string) {
  const msg = String(error?.message ?? "").toLowerCase();
  return msg.includes("column") && msg.includes(col.toLowerCase()) && msg.includes("does not exist");
}

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("camp_settings")
    .select("id,accounting_pin_hash")
    .eq("id", "default")
    .maybeSingle();
  if (error && isMissingColumn(error, "accounting_pin_hash")) {
    return NextResponse.json(
      { ok: false, error: "Missing accounting_pin_hash column. Run supabase/camp_accounting_and_price_modifier.sql." },
      { status: 500 }
    );
  }
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, pin_set: Boolean(data?.accounting_pin_hash) });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  const supabase = await supabaseServer();
  const body = await req.json().catch(() => ({}));
  const pin = String(body?.accounting_pin ?? "").trim();
  if (!pin) return NextResponse.json({ ok: false, error: "Accounting PIN required" }, { status: 400 });
  const pinHash = await hashPin(pin);
  const { error } = await supabase
    .from("camp_settings")
    .upsert({ id: "default", accounting_pin_hash: pinHash }, { onConflict: "id" });
  if (error && isMissingColumn(error, "accounting_pin_hash")) {
    return NextResponse.json(
      { ok: false, error: "Missing accounting_pin_hash column. Run supabase/camp_accounting_and_price_modifier.sql." },
      { status: 500 }
    );
  }
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}


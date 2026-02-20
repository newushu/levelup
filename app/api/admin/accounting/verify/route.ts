import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseServer } from "@/lib/supabase/server";
import { verifyNfcAccess } from "@/lib/nfc";

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

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const pinOrCode = String(body?.pin ?? body?.code ?? "").trim();
  if (!pinOrCode) return NextResponse.json({ ok: false, error: "PIN or NFC code required" }, { status: 400 });

  const nfcAccounting = await verifyNfcAccess({ code: pinOrCode, permissionKey: "accounting_workspace" });
  if (nfcAccounting.ok) return NextResponse.json({ ok: true, method: "nfc" });
  const nfcAdmin = await verifyNfcAccess({ code: pinOrCode, permissionKey: "admin_workspace" });
  if (nfcAdmin.ok) return NextResponse.json({ ok: true, method: "nfc" });

  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("camp_settings")
    .select("accounting_pin_hash")
    .eq("id", "default")
    .maybeSingle();
  if (error && isMissingColumn(error, "accounting_pin_hash")) {
    return NextResponse.json(
      { ok: false, error: "Missing accounting_pin_hash column. Run supabase/camp_accounting_and_price_modifier.sql." },
      { status: 500 }
    );
  }
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data?.accounting_pin_hash) return NextResponse.json({ ok: false, error: "Accounting PIN is not set." }, { status: 403 });

  const pinHash = await hashPin(pinOrCode);
  if (pinHash !== data.accounting_pin_hash) return NextResponse.json({ ok: false, error: "Invalid accounting PIN" }, { status: 403 });
  return NextResponse.json({ ok: true, method: "pin" });
}


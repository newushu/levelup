import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { verifyNfcAccess } from "@/lib/nfc";

async function hashPin(pin: string) {
  const data = new TextEncoder().encode(pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const pin = String(body?.pin ?? "").trim();
  if (!pin) return NextResponse.json({ ok: false, error: "PIN required" }, { status: 400 });

  const nfc = await verifyNfcAccess({ code: pin, permissionKey: "camp_access" });
  if (nfc.ok) return NextResponse.json({ ok: true, method: "nfc" });

  const { data: adminPinRow } = await supabase
    .from("skill_tracker_settings")
    .select("admin_pin_hash")
    .eq("id", "default")
    .maybeSingle();
  if (adminPinRow?.admin_pin_hash) {
    const adminHash = await hashPin(pin);
    if (adminHash === adminPinRow.admin_pin_hash) return NextResponse.json({ ok: true, method: "admin_pin" });
  }

  const { data, error } = await supabase
    .from("camp_settings")
    .select("camp_pin_hash")
    .eq("id", "default")
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  if (data?.camp_pin_hash) {
    const pinHash = await hashPin(pin);
    if (pinHash === data.camp_pin_hash) return NextResponse.json({ ok: true, method: "pin" });
  }

  const { data: student } = await supabase.from("students").select("id").eq("nfc_code", pin).maybeSingle();
  if (!student?.id) return NextResponse.json({ ok: false, error: "Invalid PIN" }, { status: 403 });

  const today = todayISO();
  const { data: leader } = await supabase
    .from("camp_leaders")
    .select("id")
    .eq("student_id", student.id)
    .eq("enabled", true)
    .lte("start_date", today)
    .or(`end_date.is.null,end_date.gte.${today}`)
    .maybeSingle();

  if (!leader?.id) return NextResponse.json({ ok: false, error: "Invalid PIN" }, { status: 403 });

  return NextResponse.json({ ok: true, method: "nfc", student_id: student.id });
}

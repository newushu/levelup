import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { verifyNfcAccess } from "@/lib/nfc";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const code = String(body?.code ?? "").trim();
  const permissionKey = String(body?.permission_key ?? "").trim();
  if (!code) return NextResponse.json({ ok: false, error: "Missing NFC code" }, { status: 400 });

  const verified = await verifyNfcAccess({ code, permissionKey });
  if (!verified.ok) return NextResponse.json({ ok: false, error: verified.error }, { status: 403 });

  return NextResponse.json({ ok: true, method: "nfc", role: verified.role });
}

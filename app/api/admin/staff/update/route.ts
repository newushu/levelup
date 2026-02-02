import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const user_id = String(body?.user_id ?? "").trim();
  const username = String(body?.username ?? "").trim();

  if (!user_id) return NextResponse.json({ ok: false, error: "user_id required" }, { status: 400 });

  const admin = supabaseAdmin();
  const { error } = await admin
    .from("profiles")
    .update({ username: username || null })
    .eq("user_id", user_id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

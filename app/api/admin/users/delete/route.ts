import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const user_id = String(body?.user_id ?? "").trim();
  if (!user_id) return NextResponse.json({ ok: false, error: "user_id required" }, { status: 400 });

  const admin = supabaseAdmin();
  const { error: pErr } = await admin.from("profiles").delete().eq("user_id", user_id);
  if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });

  const { error: rErr } = await admin.from("user_roles").delete().eq("user_id", user_id);
  if (rErr) return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 });

  const { error: aErr } = await admin.auth.admin.deleteUser(user_id);
  if (aErr) return NextResponse.json({ ok: false, error: aErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

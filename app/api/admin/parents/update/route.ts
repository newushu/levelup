import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parent_id = String(body?.parent_id ?? "").trim();
  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim();
  const phone = String(body?.phone ?? "").trim();
  const dob = String(body?.dob ?? "").trim();

  if (!parent_id) return NextResponse.json({ ok: false, error: "parent_id required" }, { status: 400 });

  const admin = supabaseAdmin();
  const payload: Record<string, any> = {};
  if (name) payload.name = name;
  if (email) payload.email = email;
  if (phone) payload.phone = phone;
  if (Object.prototype.hasOwnProperty.call(body, "dob")) {
    payload.dob = dob ? dob : null;
  }

  if (!Object.keys(payload).length) {
    return NextResponse.json({ ok: false, error: "No fields to update" }, { status: 400 });
  }

  const { error } = await admin.from("parents").update(payload).eq("id", parent_id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

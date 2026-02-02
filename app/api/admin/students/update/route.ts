import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  if (!student_id) return NextResponse.json({ ok: false, error: "student_id required" }, { status: 400 });

  const payload: Record<string, any> = {};
  if (Object.prototype.hasOwnProperty.call(body, "name")) payload.name = String(body?.name ?? "").trim() || null;
  if (Object.prototype.hasOwnProperty.call(body, "email")) payload.email = String(body?.email ?? "").trim() || null;
  if (Object.prototype.hasOwnProperty.call(body, "phone")) payload.phone = String(body?.phone ?? "").trim() || null;
  if (Object.prototype.hasOwnProperty.call(body, "dob")) {
    payload.dob = String(body?.dob ?? "").trim() || null;
  }

  if (!Object.keys(payload).length) {
    return NextResponse.json({ ok: false, error: "No updates provided" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { error } = await admin.from("students").update(payload).eq("id", student_id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

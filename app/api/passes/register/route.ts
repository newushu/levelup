import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const admin = supabaseAdmin();
  const body = await req.json().catch(() => ({}));
  const student_name = String(body?.student_name ?? "").trim();
  const email = String(body?.email ?? "").trim();
  const phone = String(body?.phone ?? "").trim();
  const pass_type_ids = Array.isArray(body?.pass_type_ids) ? body.pass_type_ids.map((id: any) => String(id)) : [];
  const desired_start_date = String(body?.desired_start_date ?? "").trim() || null;
  const desired_end_date = String(body?.desired_end_date ?? "").trim() || null;
  const amount_usd = Number.isFinite(Number(body?.amount_usd)) ? Number(body.amount_usd) : null;
  const notes = String(body?.notes ?? "").trim() || null;

  if (!student_name || !pass_type_ids.length) {
    return NextResponse.json({ ok: false, error: "Missing student_name or pass_type_ids" }, { status: 400 });
  }

  const { error } = await admin.from("pass_registrations").insert({
    student_name,
    email: email || null,
    phone: phone || null,
    pass_type_ids,
    desired_start_date,
    desired_end_date,
    amount_usd,
    notes,
    status: "pending",
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

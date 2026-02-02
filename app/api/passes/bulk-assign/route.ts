import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const supabase = await supabaseServer();
  const body = await req.json().catch(() => ({}));
  const pass_type_id = String(body?.pass_type_id ?? "").trim();
  const valid_from = String(body?.valid_from ?? "").trim();
  const valid_to = String(body?.valid_to ?? "").trim();
  const student_ids = Array.isArray(body?.student_ids) ? body.student_ids.map((id: any) => String(id)).filter(Boolean) : [];
  const payment_id = String(body?.payment_id ?? "").trim();
  const payment_confirmed = body?.payment_confirmed === true || !!payment_id;

  if (!pass_type_id || !valid_from || !student_ids.length) {
    return NextResponse.json({ ok: false, error: "Missing pass_type_id/valid_from/student_ids" }, { status: 400 });
  }

  const rows = student_ids.map((student_id: string) => ({
    student_id,
    pass_type_id,
    valid_from,
    valid_to: valid_to || null,
    active: true,
    payment_id: payment_id || null,
    payment_confirmed,
  }));

  const { error } = await supabase.from("student_passes").insert(rows);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, assigned: rows.length });
}

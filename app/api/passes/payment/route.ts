import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const supabase = await supabaseServer();
  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  const pass_type_ids = Array.isArray(body?.pass_type_ids) ? body.pass_type_ids.map((id: any) => String(id)) : [];
  const amount_usd = Number.isFinite(Number(body?.amount_usd)) ? Number(body.amount_usd) : null;
  const note = String(body?.note ?? "").trim() || null;

  if (!student_id || !pass_type_ids.length || amount_usd === null) {
    return NextResponse.json({ ok: false, error: "Missing student_id/pass_type_ids/amount_usd" }, { status: 400 });
  }

  const { error } = await supabase.from("pass_payments").insert({
    student_id,
    pass_type_ids,
    amount_usd,
    note,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

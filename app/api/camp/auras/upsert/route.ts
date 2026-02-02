import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const supabase = await supabaseServer();
  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  const aura_name = String(body?.aura_name ?? "").trim() || null;
  const discount_points = Number.isFinite(Number(body?.discount_points)) ? Number(body.discount_points) : 0;

  if (!student_id) return NextResponse.json({ ok: false, error: "student_id required" }, { status: 400 });

  const row = {
    student_id,
    aura_name,
    discount_points,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("camp_student_auras").upsert(row, { onConflict: "student_id" });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

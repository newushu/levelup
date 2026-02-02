import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  if (!student_id) return NextResponse.json({ ok: false, error: "student_id required" }, { status: 400 });

  const { data, error } = await supabase
    .from("camp_student_coupons")
    .select("id,student_id,coupon_type_id,remaining_qty,camp_coupon_types(id,name,coupon_type,points_value,item_id,enabled)")
    .eq("student_id", student_id)
    .gt("remaining_qty", 0);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const rows = (data ?? []).map((row: any) => ({
    id: row.id,
    student_id: row.student_id,
    coupon_type_id: row.coupon_type_id,
    remaining_qty: row.remaining_qty,
    type: row.camp_coupon_types ?? null,
  }));

  return NextResponse.json({ ok: true, coupons: rows });
}

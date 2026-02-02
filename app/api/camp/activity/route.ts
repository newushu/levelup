import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  const limit = Math.max(1, Math.min(30, Number(body?.limit ?? 12)));
  if (!student_id) return NextResponse.json({ ok: false, error: "student_id required" }, { status: 400 });

  const { data: orders } = await supabase
    .from("camp_orders")
    .select("id,student_id,student_name,total_points,paid_at")
    .eq("student_id", student_id)
    .order("paid_at", { ascending: false })
    .limit(limit);

  const { data: coupons } = await supabase
    .from("camp_coupon_redemptions")
    .select("id,student_id,qty,redeemed_at,camp_coupon_types(name,coupon_type,points_value,item_id)")
    .eq("student_id", student_id)
    .order("redeemed_at", { ascending: false })
    .limit(limit);

  return NextResponse.json({
    ok: true,
    orders: orders ?? [],
    coupons: coupons ?? [],
  });
}

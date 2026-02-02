import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  const supabase = await supabaseServer();
  const { data: roles, error: rErr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", auth.user.id);
  if (rErr) return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 });

  const roleList = (roles ?? []).map((r) => String(r.role ?? "").toLowerCase());
  const canGrant = roleList.some((r) => ["admin", "coach"].includes(r));
  if (!canGrant) return NextResponse.json({ ok: false, error: "Admin or coach access required" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  const coupon_type_id = String(body?.coupon_type_id ?? "").trim();
  const grant_qty = Number.isFinite(Number(body?.grant_qty)) ? Number(body.grant_qty) : 0;

  if (!student_id || !coupon_type_id) {
    return NextResponse.json({ ok: false, error: "student_id and coupon_type_id required" }, { status: 400 });
  }
  if (grant_qty <= 0) return NextResponse.json({ ok: false, error: "grant_qty must be > 0" }, { status: 400 });

  const { data: existing, error: eErr } = await supabase
    .from("camp_student_coupons")
    .select("id,remaining_qty")
    .eq("student_id", student_id)
    .eq("coupon_type_id", coupon_type_id)
    .maybeSingle();
  if (eErr) return NextResponse.json({ ok: false, error: eErr.message }, { status: 500 });

  const remaining_qty = Number(existing?.remaining_qty ?? 0) + grant_qty;
  const row = {
    ...(existing?.id ? { id: existing.id } : {}),
    student_id,
    coupon_type_id,
    remaining_qty,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("camp_student_coupons").upsert(row, { onConflict: "student_id,coupon_type_id" });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, remaining_qty });
}

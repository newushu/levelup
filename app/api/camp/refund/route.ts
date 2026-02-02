import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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
  const canRefund = roleList.some((r) => ["admin", "camp", "coach"].includes(r));
  if (!canRefund) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const order_id = String(body?.order_id ?? "").trim();
  if (!order_id) return NextResponse.json({ ok: false, error: "order_id required" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: existing } = await admin
    .from("camp_order_refunds")
    .select("id")
    .eq("order_id", order_id)
    .maybeSingle();
  if (existing?.id) {
    return NextResponse.json({ ok: false, error: "Order already refunded" }, { status: 400 });
  }

  const { data: order, error: oErr } = await admin
    .from("camp_orders")
    .select("id,total_points,payments")
    .eq("id", order_id)
    .maybeSingle();
  if (oErr) return NextResponse.json({ ok: false, error: oErr.message }, { status: 500 });
  if (!order) return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });

  const payments = Array.isArray(order.payments) ? order.payments : [];
  const payerIds = payments
    .map((p: any) => String(p?.student_id ?? "").trim())
    .filter(Boolean);
  if (payerIds.length) {
    const { data: accounts } = await admin
      .from("camp_accounts")
      .select("student_id,balance_points")
      .in("student_id", payerIds);
    const balanceMap = new Map<string, number>();
    (accounts ?? []).forEach((row: any) => balanceMap.set(String(row.student_id), Number(row.balance_points ?? 0)));

    const updates = payments
      .map((p: any) => {
        const sid = String(p?.student_id ?? "").trim();
        if (!sid) return null;
        const amt = Number(p?.amount_points ?? 0);
        return {
          student_id: sid,
          balance_points: (balanceMap.get(sid) ?? 0) + (Number.isFinite(amt) ? amt : 0),
          updated_at: new Date().toISOString(),
        };
      })
      .filter(Boolean) as Array<{ student_id: string; balance_points: number; updated_at: string }>;

    if (updates.length) {
      const { error: bErr } = await admin.from("camp_accounts").upsert(updates, { onConflict: "student_id" });
      if (bErr) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 });
    }
  }

  const refunded_points = Number(order.total_points ?? 0);
  const { error: rInsertErr } = await admin.from("camp_order_refunds").insert({
    order_id,
    refunded_points,
    refunded_by: auth.user.id,
  });
  if (rInsertErr) return NextResponse.json({ ok: false, error: rInsertErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, refunded_points });
}

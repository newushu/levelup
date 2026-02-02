import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  const student_name = String(body?.student_name ?? "").trim();
  const paid_by = String(body?.paid_by ?? "").trim();
  const items = Array.isArray(body?.items) ? body.items : [];
  const discount_points = Number.isFinite(Number(body?.discount_points)) ? Math.max(0, Number(body.discount_points)) : 0;
  const coupon_uses = Array.isArray(body?.coupons) ? body.coupons : [];
  const aura_discount_points = Number.isFinite(Number(body?.aura_discount_points))
    ? Math.max(0, Number(body.aura_discount_points))
    : 0;
  const items_total = items.reduce((sum: number, item: any) => {
    const price = Number(item?.price_points ?? 0);
    const qty = Number(item?.qty ?? 1);
    const safePrice = Number.isFinite(price) ? price : 0;
    const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 1;
    return sum + safePrice * safeQty;
  }, 0);
  const total_points = Math.max(0, items_total - Math.max(0, discount_points) - Math.max(0, aura_discount_points));

  if (!items.length) return NextResponse.json({ ok: false, error: "No items selected" }, { status: 400 });

  const rawPayments = Array.isArray(body?.payments) ? body.payments : [];
  const payments = (rawPayments.length
    ? rawPayments
    : student_id || student_name
    ? [{ student_id, student_name, amount_points: total_points }]
    : []
  ).slice(0, 4);

  if (!payments.length) {
    return NextResponse.json({ ok: false, error: "Select at least one payer" }, { status: 400 });
  }

  const paymentTotal = payments.reduce((sum: number, p: any) => {
    const amt = Number(p?.amount_points ?? 0);
    return sum + (Number.isFinite(amt) ? amt : 0);
  }, 0);
  const expectedTotal = Math.max(0, total_points);
  const supabase = await supabaseServer();
  let coupon_discount_points = 0;
  const couponUpdates: Array<{ coupon_type_id: string; remaining_qty: number }> = [];
  const coupons_used: any[] = [];
  const couponStudentId = String(payments[0]?.student_id ?? "").trim();
  if (coupon_uses.length && couponStudentId) {
    const admin = supabaseAdmin();
    const couponIds = coupon_uses.map((c: any) => String(c.coupon_type_id ?? "")).filter(Boolean);
    const { data: couponTypes } = await admin
      .from("camp_coupon_types")
      .select("id,name,coupon_type,points_value,item_id")
      .in("id", couponIds);
    const typeMap = new Map<string, any>();
    (couponTypes ?? []).forEach((row: any) => typeMap.set(String(row.id), row));
    for (const use of coupon_uses) {
      const couponTypeId = String(use?.coupon_type_id ?? "").trim();
      const qty = Number.isFinite(Number(use?.qty)) ? Number(use.qty) : 0;
      if (!couponTypeId || qty <= 0) continue;
      const typeRow = typeMap.get(couponTypeId);
      if (!typeRow) continue;

      const { data: studentCoupon } = await admin
        .from("camp_student_coupons")
        .select("remaining_qty")
        .eq("student_id", couponStudentId)
        .eq("coupon_type_id", couponTypeId)
        .maybeSingle();
      const remaining = Number(studentCoupon?.remaining_qty ?? 0);
      if (remaining <= 0) continue;
      const appliedQty = Math.min(remaining, qty);

      const typeName = String(typeRow.coupon_type ?? "points");
      if (typeName === "points") {
        const pointsValue = Number(typeRow.points_value ?? 0);
        coupon_discount_points += Math.max(0, pointsValue) * appliedQty;
        coupons_used.push({ coupon_type_id: couponTypeId, qty: appliedQty, type: "points", points_value: pointsValue });
      } else if (typeName === "percent") {
        const percentValue = Number(typeRow.points_value ?? 0);
        const safePercent = Math.max(0, Number.isFinite(percentValue) ? percentValue : 0);
        const itemId = String(typeRow.item_id ?? "").trim();
        if (itemId) {
          const cartItem = items.find((i: any) => String(i.id ?? "") === itemId);
          if (!cartItem) continue;
          const itemPrice = Number(cartItem?.price_points ?? 0);
          const perItemDiscount = Math.round(Math.max(0, itemPrice) * (safePercent / 100));
          coupon_discount_points += perItemDiscount * appliedQty;
          coupons_used.push({
            coupon_type_id: couponTypeId,
            qty: appliedQty,
            type: "percent",
            percent_value: safePercent,
            item_id: itemId,
          });
        } else {
          const perOrderDiscount = Math.round(items_total * (safePercent / 100));
          coupon_discount_points += perOrderDiscount * appliedQty;
          coupons_used.push({
            coupon_type_id: couponTypeId,
            qty: appliedQty,
            type: "percent",
            percent_value: safePercent,
          });
        }
      } else if (typeName === "item") {
        const itemId = String(typeRow.item_id ?? "").trim();
        if (!itemId) continue;
        const cartItem = items.find((i: any) => String(i.id ?? "") === itemId);
        if (!cartItem) continue;
        const itemPrice = Number(cartItem?.price_points ?? 0);
        coupon_discount_points += Math.max(0, itemPrice) * appliedQty;
        coupons_used.push({ coupon_type_id: couponTypeId, qty: appliedQty, type: "item", item_id: itemId });
      }

      couponUpdates.push({ coupon_type_id: couponTypeId, remaining_qty: remaining - appliedQty });
    }
  }

  const final_total_points = Math.max(0, total_points - coupon_discount_points);
  if (paymentTotal !== final_total_points) {
    return NextResponse.json({ ok: false, error: "Payments must equal total points" }, { status: 400 });
  }
  const { data: orderRow, error: oErr } = await supabase
    .from("camp_orders")
    .insert({
      student_id: payments[0]?.student_id ? String(payments[0].student_id) : student_id || null,
      student_name: payments[0]?.student_name ? String(payments[0].student_name) : student_name || null,
      paid_by: paid_by || null,
      items,
      total_points: final_total_points,
      discount_points: discount_points || null,
      coupons_used: coupons_used.length ? coupons_used : null,
      payments,
    })
    .select("id")
    .maybeSingle();
  if (oErr) return NextResponse.json({ ok: false, error: oErr.message }, { status: 500 });
  const orderId = String(orderRow?.id ?? "").trim();

  if (orderId && coupons_used.length && couponStudentId) {
    const admin = supabaseAdmin();
    if (couponUpdates.length) {
      for (const update of couponUpdates) {
        await admin
          .from("camp_student_coupons")
          .update({ remaining_qty: update.remaining_qty, updated_at: new Date().toISOString() })
          .eq("student_id", couponStudentId)
          .eq("coupon_type_id", update.coupon_type_id);
      }
    }
    const redemptionRows = coupons_used.map((c) => ({
      student_id: couponStudentId,
      coupon_type_id: c.coupon_type_id,
      order_id: orderId,
      qty: c.qty,
    }));
    await admin.from("camp_coupon_redemptions").insert(redemptionRows);
  }

  const admin = supabaseAdmin();
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
          balance_points: (balanceMap.get(sid) ?? 0) - (Number.isFinite(amt) ? amt : 0),
          updated_at: new Date().toISOString(),
        };
      })
      .filter(Boolean) as Array<{ student_id: string; balance_points: number; updated_at: string }>;
    if (updates.length) {
      const { error: bErr } = await admin.from("camp_accounts").upsert(updates, { onConflict: "student_id" });
      if (bErr) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 });
    }
  }

  const receipts: any[] = [];
  for (const payment of payments) {
    const sid = String(payment?.student_id ?? "").trim();
    const amt = Number(payment?.amount_points ?? 0);
    if (!sid) {
      receipts.push({ student: null, amount_points: amt, balance_points: null });
      continue;
    }
    const { data: sRow } = await admin.from("students").select("id,name").eq("id", sid).maybeSingle();
    let student: any = sRow ?? null;
    if (student) {
      const { data: avatarSettings } = await admin
        .from("student_avatar_settings")
        .select("student_id,avatar_id,bg_color,particle_style")
        .eq("student_id", sid)
        .maybeSingle();
      const avatarId = String(avatarSettings?.avatar_id ?? "").trim();
      let avatarPath: string | null = null;
      if (avatarId) {
        const { data: avatar } = await admin.from("avatars").select("id,storage_path").eq("id", avatarId).maybeSingle();
        avatarPath = avatar?.storage_path ?? null;
      }
      student = {
        ...student,
        avatar_storage_path: avatarPath,
        avatar_bg: avatarSettings?.bg_color ?? null,
        avatar_effect: avatarSettings?.particle_style ?? null,
      };
    }
    const { data: acct } = await admin.from("camp_accounts").select("balance_points").eq("student_id", sid).maybeSingle();
    receipts.push({
      student,
      amount_points: Number.isFinite(amt) ? amt : 0,
      balance_points: Number(acct?.balance_points ?? 0),
    });
  }

  return NextResponse.json({ ok: true, receipts, total_points });
}

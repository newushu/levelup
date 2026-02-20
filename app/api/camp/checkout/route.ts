import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function applyMenuModifier(points: number, modifierPct: number) {
  const base = Number.isFinite(points) ? points : 0;
  const pct = Number.isFinite(modifierPct) ? modifierPct : 0;
  return Math.max(0, Math.round(base * (1 + pct / 100)));
}

function isMissingColumn(error: any, col: string) {
  const msg = String(error?.message ?? "").toLowerCase();
  return msg.includes("column") && msg.includes(col.toLowerCase()) && msg.includes("does not exist");
}

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

  if (!items.length) return NextResponse.json({ ok: false, error: "No items selected" }, { status: 400 });
  const admin = supabaseAdmin();
  const supabase = await supabaseServer();

  const itemIds = Array.from(new Set(items.map((item: any) => String(item?.id ?? "").trim()).filter(Boolean)));
  if (!itemIds.length) return NextResponse.json({ ok: false, error: "No valid items selected" }, { status: 400 });
  let { data: menuItemRows, error: menuItemErr } = await admin
    .from("camp_menu_items")
    .select("id,name,price_points,allow_second,second_price_points,menu_id,camp_menus(price_modifier_pct)")
    .in("id", itemIds);
  if (menuItemErr && isMissingColumn(menuItemErr, "price_modifier_pct")) {
    const fallback = await admin
      .from("camp_menu_items")
      .select("id,name,price_points,allow_second,second_price_points,menu_id")
      .in("id", itemIds);
    menuItemRows = (fallback.data ?? []).map((row: any) => ({ ...row, camp_menus: { price_modifier_pct: 0 } }));
    menuItemErr = fallback.error as any;
  }
  if (menuItemErr) return NextResponse.json({ ok: false, error: menuItemErr.message }, { status: 500 });
  const itemById = new Map<string, any>();
  (menuItemRows ?? []).forEach((row: any) => itemById.set(String(row.id), row));

  const normalizedOrderItems = items
    .map((item: any) => {
      const id = String(item?.id ?? "").trim();
      const row = itemById.get(id);
      if (!id || !row) return null;
      const qtyRaw = Number(item?.qty ?? 1);
      const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? Math.floor(qtyRaw) : 1;
      const second = item?.second === true && row.allow_second === true;
      const basePrice = second ? Number(row.second_price_points ?? row.price_points ?? 0) : Number(row.price_points ?? 0);
      const modifierPct = Number(row?.camp_menus?.price_modifier_pct ?? 0);
      const adjustedPrice = applyMenuModifier(basePrice, modifierPct);
      return {
        id,
        name: String(row.name ?? item?.name ?? "Item"),
        qty,
        second,
        base_price_points: Math.max(0, Math.round(basePrice)),
        menu_modifier_pct: modifierPct,
        price_points: adjustedPrice,
      };
    })
    .filter(Boolean) as Array<{
      id: string;
      name: string;
      qty: number;
      second: boolean;
      base_price_points: number;
      menu_modifier_pct: number;
      price_points: number;
    }>;
  if (!normalizedOrderItems.length) {
    return NextResponse.json({ ok: false, error: "Selected items are unavailable" }, { status: 400 });
  }
  const items_total = normalizedOrderItems.reduce((sum, item) => sum + item.price_points * item.qty, 0);
  const total_points = Math.max(0, items_total - Math.max(0, discount_points) - Math.max(0, aura_discount_points));

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
  let coupon_discount_points = 0;
  const couponUpdates: Array<{ coupon_type_id: string; remaining_qty: number }> = [];
  const coupons_used: any[] = [];
  const couponStudentId = String(payments[0]?.student_id ?? "").trim();
  if (coupon_uses.length && couponStudentId) {
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
          const cartItem = normalizedOrderItems.find((i: any) => String(i.id ?? "") === itemId);
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
        const cartItem = normalizedOrderItems.find((i: any) => String(i.id ?? "") === itemId);
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
  const normalizeItems = (value: any) =>
    (Array.isArray(value) ? value : [])
      .map((item: any) => ({
        id: String(item?.id ?? ""),
        qty: Number(item?.qty ?? 1),
        price_points: Number(item?.price_points ?? 0),
        second: !!item?.second,
      }))
      .sort((a: any, b: any) => a.id.localeCompare(b.id));
  const normalizePayments = (value: any) =>
    (Array.isArray(value) ? value : [])
      .map((p: any) => ({
        student_id: String(p?.student_id ?? ""),
        amount_points: Number(p?.amount_points ?? 0),
      }))
      .sort((a: any, b: any) => `${a.student_id}:${a.amount_points}`.localeCompare(`${b.student_id}:${b.amount_points}`));

  const primaryStudentId = String(payments[0]?.student_id ?? "").trim();
  const duplicateWindowIso = new Date(Date.now() - 10_000).toISOString();
  const normalizedItems = JSON.stringify(normalizeItems(normalizedOrderItems));
  const normalizedPayments = JSON.stringify(normalizePayments(payments));
  if (primaryStudentId) {
    const { data: recentOrders } = await supabase
      .from("camp_orders")
      .select("id,student_id,total_points,paid_at,items,payments")
      .eq("student_id", primaryStudentId)
      .eq("total_points", final_total_points)
      .gte("paid_at", duplicateWindowIso)
      .order("paid_at", { ascending: false })
      .limit(8);
    const dupe = (recentOrders ?? []).find((row: any) => {
      const rowItems = JSON.stringify(normalizeItems(row?.items));
      const rowPayments = JSON.stringify(normalizePayments(row?.payments));
      return rowItems === normalizedItems && rowPayments === normalizedPayments;
    });
    if (dupe?.id) {
      return NextResponse.json({ ok: true, duplicate: true, order_id: String(dupe.id), total_points: final_total_points });
    }
  }

  const payerIds = payments
    .map((p: any) => String(p?.student_id ?? "").trim())
    .filter(Boolean);
  const balanceMap = new Map<string, number>();
  if (payerIds.length) {
    const { data: students } = await admin
      .from("students")
      .select("id,points_total")
      .in("id", payerIds);
    (students ?? []).forEach((row: any) => balanceMap.set(String(row.id), Number(row.points_total ?? 0)));
  }
  const enrichedPayments = payments.map((p: any) => {
    const sid = String(p?.student_id ?? "").trim();
    const amount = Math.max(0, Number(p?.amount_points ?? 0));
    if (!sid) {
      return {
        student_id: sid || null,
        student_name: String(p?.student_name ?? "").trim() || null,
        amount_points: amount,
      };
    }
    const before = Number(balanceMap.get(sid) ?? 0);
    const after = before - amount;
    return {
      student_id: sid,
      student_name: String(p?.student_name ?? "").trim() || null,
      amount_points: amount,
      delta_points: -amount,
      balance_before: before,
      balance_after: after,
      changed_at: new Date().toISOString(),
    };
  });

  const insufficient = enrichedPayments.find((p: any) => {
    if (!p?.student_id) return false;
    return Number(p?.balance_before ?? 0) < Number(p?.amount_points ?? 0);
  });
  if (insufficient) {
    return NextResponse.json({ ok: false, error: `Insufficient points for ${String(insufficient.student_name ?? "payer")}` }, { status: 400 });
  }

  const { data: orderRow, error: oErr } = await supabase
    .from("camp_orders")
    .insert({
      student_id: payments[0]?.student_id ? String(payments[0].student_id) : student_id || null,
      student_name: payments[0]?.student_name ? String(payments[0].student_name) : student_name || null,
      paid_by: paid_by || null,
      items: normalizedOrderItems,
      total_points: final_total_points,
      discount_points: discount_points || null,
      coupons_used: coupons_used.length ? coupons_used : null,
      payments: enrichedPayments,
    })
    .select("id")
    .maybeSingle();
  if (oErr) return NextResponse.json({ ok: false, error: oErr.message }, { status: 500 });
  const orderId = String(orderRow?.id ?? "").trim();

  if (orderId && coupons_used.length && couponStudentId) {
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

  if (payerIds.length) {
    const updates = enrichedPayments
      .map((p: any) => {
        const sid = String(p?.student_id ?? "").trim();
        if (!sid) return null;
        return { student_id: sid, points_total: Number(p?.balance_after ?? 0) };
      })
      .filter(Boolean) as Array<{ student_id: string; points_total: number }>;
    if (updates.length) {
      for (const u of updates) {
        const { error: bErr } = await admin.from("students").update({ points_total: u.points_total }).eq("id", u.student_id);
        if (bErr) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 });
      }
    }
  }

  const receipts: any[] = [];
  for (const payment of enrichedPayments) {
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
    const { data: acct } = await admin.from("students").select("points_total").eq("id", sid).maybeSingle();
    receipts.push({
      student,
      amount_points: Number.isFinite(amt) ? amt : 0,
      balance_before: Number(payment?.balance_before ?? NaN),
      balance_points: Number(acct?.points_total ?? 0),
      delta_points: Number(payment?.delta_points ?? -Math.max(0, amt)),
    });
  }

  return NextResponse.json({ ok: true, order_id: orderId, receipts, total_points });
}

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const gate = await requireUser();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const studentGiftId = String(body?.student_gift_id ?? "").trim();
  const studentId = String(body?.student_id ?? "").trim();
  if (!studentGiftId || !studentId) {
    return NextResponse.json({ ok: false, error: "student_gift_id and student_id required" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: giftRow, error: giftErr } = await admin
    .from("student_gifts")
    .select("id,student_id,gift_item_id,qty,opened_qty,enabled,expires_at,expired_at")
    .eq("id", studentGiftId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (giftErr) return NextResponse.json({ ok: false, error: giftErr.message }, { status: 500 });
  if (!giftRow?.id || giftRow.enabled === false) return NextResponse.json({ ok: false, error: "Gift not found" }, { status: 404 });
  const expiresMs = Date.parse(String(giftRow.expires_at ?? ""));
  const alreadyExpired = Boolean(giftRow.expired_at) || (Number.isFinite(expiresMs) && expiresMs <= Date.now());
  if (alreadyExpired) {
    if (!giftRow.expired_at) {
      await admin
        .from("student_gifts")
        .update({ expired_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", studentGiftId)
        .is("expired_at", null);
    }
    return NextResponse.json({ ok: false, error: "Gift expired" }, { status: 400 });
  }

  const qty = Math.max(0, Number(giftRow.qty ?? 0));
  const openedQty = Math.max(0, Number(giftRow.opened_qty ?? 0));
  if (openedQty >= qty) return NextResponse.json({ ok: false, error: "No unopened gifts left" }, { status: 400 });

  const { data: giftItem, error: itemErr } = await admin
    .from("gift_items")
    .select("id,name,category,gift_type,points_value,enabled")
    .eq("id", String(giftRow.gift_item_id))
    .maybeSingle();
  if (itemErr) return NextResponse.json({ ok: false, error: itemErr.message }, { status: 500 });
  if (!giftItem?.id || giftItem.enabled === false) return NextResponse.json({ ok: false, error: "Gift item not found" }, { status: 404 });

  const nextOpened = openedQty + 1;
  const { error: upErr } = await admin
    .from("student_gifts")
    .update({ opened_qty: nextOpened, updated_at: new Date().toISOString() })
    .eq("id", studentGiftId)
    .eq("student_id", studentId)
    .eq("opened_qty", openedQty);
  if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });

  const pointsAwarded = Math.max(0, Number(giftItem.points_value ?? 0));
  let ledgerId: string | null = null;
  let packageItemsAdded = 0;
  const { data: beforeStudentRow, error: beforeStudentErr } = await admin
    .from("students")
    .select("points_total")
    .eq("id", studentId)
    .maybeSingle();
  if (beforeStudentErr) return NextResponse.json({ ok: false, error: beforeStudentErr.message }, { status: 500 });
  const pointsBeforeOpen = Math.round(Number(beforeStudentRow?.points_total ?? 0));

  if (String(giftItem.category ?? "") === "package") {
    const { data: components, error: compErr } = await admin
      .from("gift_package_components")
      .select("component_category,component_name,component_points_value,component_design_id,component_design_image_url,component_design_html,component_design_css,component_design_js,component_qty,component_order")
      .eq("package_gift_item_id", giftItem.id)
      .order("component_order", { ascending: true });
    if (compErr) return NextResponse.json({ ok: false, error: compErr.message }, { status: 500 });

    for (const row of components ?? []) {
      const qty = Math.max(1, Number((row as any).component_qty ?? 1) || 1);
      const componentPayload = {
        name: String((row as any).component_name ?? "Gift Item"),
        category: String((row as any).component_category ?? "item"),
        category_tags: [String((row as any).component_category ?? "item")],
        gift_type: "package_component",
        design_id: String((row as any).component_design_id ?? "").trim() || null,
        design_image_url: String((row as any).component_design_image_url ?? "").trim() || null,
        design_html: String((row as any).component_design_html ?? "").trim() || null,
        design_css: String((row as any).component_design_css ?? "").trim() || null,
        design_js: String((row as any).component_design_js ?? "").trim() || null,
        points_value: Math.max(0, Number((row as any).component_points_value ?? 0) || 0),
        enabled: true,
        created_by: gate.user.id,
      };
      const { data: newGift, error: newGiftErr } = await admin.from("gift_items").insert(componentPayload).select("id").single();
      if (newGiftErr) return NextResponse.json({ ok: false, error: newGiftErr.message }, { status: 500 });
      const { error: assignErr } = await admin.from("student_gifts").insert({
        student_id: studentId,
        gift_item_id: String(newGift?.id),
        qty,
        opened_qty: 0,
        expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        expired_at: null,
        granted_by: gate.user.id,
        note: `From package: ${String(giftItem.name ?? "Package")}`,
        enabled: true,
      });
      if (assignErr) return NextResponse.json({ ok: false, error: assignErr.message }, { status: 500 });
      packageItemsAdded += qty;
    }
  } else if (pointsAwarded > 0) {
    const note = `Gift Opened: ${String(giftItem.name ?? "Gift")}`;
    const { data: inserted, error: lErr } = await admin
      .from("ledger")
      .insert({
        student_id: studentId,
        points: pointsAwarded,
        points_base: pointsAwarded,
        points_multiplier: 1,
        note,
        category: "gift_open",
        created_by: gate.user.id,
      })
      .select("id")
      .single();
    if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });
    ledgerId = String(inserted?.id ?? "") || null;

    const rpc = await admin.rpc("recompute_student_points", { p_student_id: studentId });
    if (rpc.error) return NextResponse.json({ ok: false, error: rpc.error.message }, { status: 500 });
  }

  const { data: afterStudentRow, error: afterStudentErr } = await admin
    .from("students")
    .select("points_total")
    .eq("id", studentId)
    .maybeSingle();
  if (afterStudentErr) return NextResponse.json({ ok: false, error: afterStudentErr.message }, { status: 500 });
  const pointsAfterOpen = Math.round(Number(afterStudentRow?.points_total ?? pointsBeforeOpen));

  const { error: eventErr } = await admin.from("gift_open_events").insert({
    student_id: studentId,
    student_gift_id: studentGiftId,
    gift_item_id: giftItem.id,
    points_awarded: pointsAwarded,
    points_before_open: pointsBeforeOpen,
    points_after_open: pointsAfterOpen,
    ledger_id: ledgerId,
  });
  if (eventErr) return NextResponse.json({ ok: false, error: eventErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    result: {
      gift_name: String(giftItem.name ?? "Gift"),
      category: String(giftItem.category ?? "item"),
      gift_type: String(giftItem.gift_type ?? "generic"),
      points_awarded: pointsAwarded,
      remaining: Math.max(0, qty - nextOpened),
      package_items_added: packageItemsAdded,
    },
  });
}

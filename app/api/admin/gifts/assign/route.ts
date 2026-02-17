import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const giftItemId = String(body?.gift_item_id ?? "").trim();
  const qty = Math.max(1, Number(body?.qty ?? 1) || 1);
  const studentIds = Array.isArray(body?.student_ids)
    ? body.student_ids.map((v: any) => String(v ?? "").trim()).filter(Boolean)
    : [String(body?.student_id ?? "").trim()].filter(Boolean);

  if (!giftItemId) return NextResponse.json({ ok: false, error: "gift_item_id required" }, { status: 400 });
  if (!studentIds.length) return NextResponse.json({ ok: false, error: "student_ids required" }, { status: 400 });

  const admin = supabaseAdmin();
  const rows = studentIds.map((sid) => ({
    student_id: sid,
    gift_item_id: giftItemId,
    qty,
    opened_qty: 0,
    granted_by: gate.user.id,
    note: String(body?.note ?? "").trim() || null,
    enabled: true,
  }));

  const { error } = await admin.from("student_gifts").insert(rows);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, assigned_count: rows.length });
}

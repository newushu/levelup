import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const admin = supabaseAdmin();
  const url = new URL(req.url);
  const studentQuery = String(url.searchParams.get("student_query") ?? "").trim();
  const giftItemId = String(url.searchParams.get("gift_item_id") ?? "").trim();

  let studentIds: string[] | null = null;
  if (studentQuery) {
    const { data: students } = await admin
      .from("students")
      .select("id")
      .ilike("name", `%${studentQuery}%`)
      .limit(120);
    studentIds = (students ?? []).map((r: any) => String(r.id ?? "")).filter(Boolean);
    if (!studentIds.length) return NextResponse.json({ ok: true, student_gifts: [] });
  }

  let q = admin
    .from("student_gifts")
    .select(`
      id,
      student_id,
      gift_item_id,
      qty,
      opened_qty,
      note,
      enabled,
      created_at,
      updated_at,
      students(name,points_total),
      gift_items(name,category,category_tags,gift_type,points_value)
    `)
    .eq("enabled", true)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (giftItemId) q = q.eq("gift_item_id", giftItemId);
  if (studentIds) q = q.in("student_id", studentIds);

  const { data, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const rows = (data ?? []) as any[];
  const studentGiftIds = rows.map((r) => String(r?.id ?? "")).filter(Boolean);
  const latestByStudentGiftId = new Map<string, any>();

  if (studentGiftIds.length) {
    const { data: events, error: eventsErr } = await admin
      .from("gift_open_events")
      .select("id,student_gift_id,points_awarded,points_before_open,points_after_open,opened_at")
      .in("student_gift_id", studentGiftIds)
      .order("opened_at", { ascending: false });
    if (eventsErr) return NextResponse.json({ ok: false, error: eventsErr.message }, { status: 500 });

    for (const event of events ?? []) {
      const key = String((event as any)?.student_gift_id ?? "");
      if (!key || latestByStudentGiftId.has(key)) continue;
      latestByStudentGiftId.set(key, event);
    }
  }

  const payload = rows.map((row) => ({
    ...row,
    latest_open_event: latestByStudentGiftId.get(String(row?.id ?? "")) ?? null,
  }));

  return NextResponse.json({ ok: true, student_gifts: payload });
}

export async function DELETE(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const studentGiftId = String(body?.student_gift_id ?? "").trim();
  const studentId = String(body?.student_id ?? "").trim();
  const giftItemId = String(body?.gift_item_id ?? "").trim();

  const admin = supabaseAdmin();
  let q = admin
    .from("student_gifts")
    .update({ enabled: false, updated_at: new Date().toISOString() })
    .eq("enabled", true);

  if (studentGiftId) q = q.eq("id", studentGiftId);
  else {
    if (!studentId || !giftItemId) {
      return NextResponse.json({ ok: false, error: "student_gift_id or (student_id + gift_item_id) required" }, { status: 400 });
    }
    q = q.eq("student_id", studentId).eq("gift_item_id", giftItemId);
  }

  const { data, error } = await q.select("id");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, removed_count: (data ?? []).length });
}

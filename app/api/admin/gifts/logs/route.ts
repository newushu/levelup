import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function rangeToSince(range: string) {
  const now = Date.now();
  if (range === "7d") return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  if (range === "30d") return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  return "";
}

export async function GET(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const admin = supabaseAdmin();
  const url = new URL(req.url);
  const range = String(url.searchParams.get("range") ?? "7d").trim().toLowerCase();
  const studentQuery = String(url.searchParams.get("student_query") ?? "").trim();
  const giftItemId = String(url.searchParams.get("gift_item_id") ?? "").trim();

  let studentIds: string[] | null = null;
  if (studentQuery) {
    const { data: students } = await admin
      .from("students")
      .select("id")
      .ilike("name", `%${studentQuery}%`)
      .limit(100);
    studentIds = (students ?? []).map((r: any) => String(r.id ?? "")).filter(Boolean);
    if (!studentIds.length) return NextResponse.json({ ok: true, logs: [] });
  }

  let q = admin
    .from("gift_open_events")
    .select(`
      id,
      student_id,
      student_gift_id,
      gift_item_id,
      points_awarded,
      points_before_open,
      points_after_open,
      opened_at,
      ledger_id,
      students(name,points_total),
      gift_items(name,category,category_tags,gift_type)
    `)
    .order("opened_at", { ascending: false })
    .limit(600);

  const since = rangeToSince(range);
  if (since) q = q.gte("opened_at", since);
  if (giftItemId) q = q.eq("gift_item_id", giftItemId);
  if (studentIds) q = q.in("student_id", studentIds);

  const { data, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, logs: data ?? [] });
}

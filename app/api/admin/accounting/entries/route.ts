import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseServer } from "@/lib/supabase/server";

function isMissingTable(error: any, table: string) {
  const msg = String(error?.message ?? "").toLowerCase();
  return msg.includes("relation") && msg.includes(table.toLowerCase()) && msg.includes("does not exist");
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeEntry(entry: any, userId: string, tabId: string) {
  const id = String(entry?.id ?? "").trim();
  const payload: any = {
    student_id: isUuid(String(entry?.student_id ?? "").trim()) ? String(entry.student_id).trim() : null,
    student_name: String(entry?.student_name ?? "").trim(),
    camp_type: String(entry?.camp_type ?? "general").trim(),
    enrollment_by_day: entry?.enrollment_by_day ?? {},
    lunch_by_day: entry?.lunch_by_day ?? {},
    lunch_item_by_day: entry?.lunch_item_by_day ?? {},
    lunch_price_by_day: entry?.lunch_price_by_day ?? {},
    manual_discount: Number(entry?.manual_discount ?? 0) || 0,
    payment_date: String(entry?.payment_date ?? "").trim() || null,
    payment_method: String(entry?.payment_method ?? "").trim() || null,
    paid_amount: Number(entry?.paid_amount ?? 0) || 0,
    fees_paid: Number(entry?.fees_paid ?? 0) || 0,
    payment_log: Array.isArray(entry?.payment_log) ? entry.payment_log : [],
    total_revenue: Number(entry?.total_revenue ?? 0) || 0,
    notes: String(entry?.notes ?? "").trim() || null,
    accounting_tab_id: tabId || null,
    updated_at: new Date().toISOString(),
  };
  if (isUuid(id)) payload.id = id;
  if (!payload.id) payload.created_by = userId;
  return payload;
}

export async function GET(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  const supabase = await supabaseServer();
  const url = new URL(req.url);
  const tabId = String(url.searchParams.get("tab_id") ?? "").trim();
  let query = supabase
    .from("camp_accounting_entries")
    .select("*")
    .order("updated_at", { ascending: false });
  if (tabId) query = query.eq("accounting_tab_id", tabId);
  const { data, error } = await query.limit(600);
  if (error) {
    if (isMissingTable(error, "camp_accounting_entries")) {
      return NextResponse.json(
        { ok: false, error: "Missing camp accounting tables. Run supabase/camp_accounting_and_price_modifier.sql." },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, rows: data ?? [] });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const tabId = String(body?.tab_id ?? "").trim();
  if (!tabId) return NextResponse.json({ ok: false, error: "tab_id required" }, { status: 400 });
  const entries = Array.isArray(body?.entries) ? body.entries : [];
  if (!entries.length) return NextResponse.json({ ok: false, error: "Missing entries" }, { status: 400 });
  const rows = entries.map((entry) => normalizeEntry(entry, gate.user.id, tabId)).filter((row) => row.student_name);
  const existing = rows.filter((row) => row.id);
  const fresh = rows.filter((row) => !row.id);

  const supabase = await supabaseServer();
  if (existing.length) {
    const { error } = await supabase.from("camp_accounting_entries").upsert(existing, { onConflict: "id" });
    if (error) {
      if (isMissingTable(error, "camp_accounting_entries")) {
        return NextResponse.json(
          { ok: false, error: "Missing camp accounting tables. Run supabase/camp_accounting_and_price_modifier.sql." },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
  }
  if (fresh.length) {
    const { error } = await supabase.from("camp_accounting_entries").insert(fresh);
    if (error) {
      if (isMissingTable(error, "camp_accounting_entries")) {
        return NextResponse.json(
          { ok: false, error: "Missing camp accounting tables. Run supabase/camp_accounting_and_price_modifier.sql." },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
  }
  const { data, error } = await supabase
    .from("camp_accounting_entries")
    .select("*")
    .eq("accounting_tab_id", tabId)
    .order("updated_at", { ascending: false })
    .limit(600);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, rows: data ?? [] });
}

export async function DELETE(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  if (!isUuid(id)) return NextResponse.json({ ok: false, error: "Valid id required" }, { status: 400 });
  const supabase = await supabaseServer();
  const { error } = await supabase.from("camp_accounting_entries").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

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

function normalizeExpense(expense: any, userId: string, tabId: string) {
  const id = String(expense?.id ?? "").trim();
  const payload: any = {
    accounting_tab_id: tabId,
    item: String(expense?.item ?? "").trim(),
    amount: Math.max(0, Number(expense?.amount ?? 0) || 0),
    category: String(expense?.category ?? "other").trim() || "other",
    notes: String(expense?.notes ?? "").trim() || null,
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
  const reqUrl = new URL(req.url);
  const tabId = String(reqUrl.searchParams.get("tab_id") ?? "").trim();
  if (!isUuid(tabId)) return NextResponse.json({ ok: false, error: "Valid tab_id required" }, { status: 400 });
  const { data, error } = await supabase
    .from("accounting_expenses")
    .select("*")
    .eq("accounting_tab_id", tabId)
    .order("updated_at", { ascending: false })
    .limit(1000);
  if (error) {
    if (isMissingTable(error, "accounting_expenses")) {
      return NextResponse.json(
        { ok: false, error: "Missing accounting expenses table. Run supabase/camp_accounting_and_price_modifier.sql." },
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
  if (!isUuid(tabId)) return NextResponse.json({ ok: false, error: "Valid tab_id required" }, { status: 400 });
  const expenses = Array.isArray(body?.expenses) ? body.expenses : [];
  if (!expenses.length) return NextResponse.json({ ok: false, error: "Missing expenses" }, { status: 400 });
  const rows = expenses
    .map((expense) => normalizeExpense(expense, gate.user.id, tabId))
    .filter((row) => row.item);
  const existing = rows.filter((row) => row.id);
  const fresh = rows.filter((row) => !row.id);
  const supabase = await supabaseServer();
  if (existing.length) {
    const { error } = await supabase.from("accounting_expenses").upsert(existing, { onConflict: "id" });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (fresh.length) {
    const { error } = await supabase.from("accounting_expenses").insert(fresh);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  const { data, error } = await supabase
    .from("accounting_expenses")
    .select("*")
    .eq("accounting_tab_id", tabId)
    .order("updated_at", { ascending: false })
    .limit(1000);
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
  const { error } = await supabase.from("accounting_expenses").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseServer } from "@/lib/supabase/server";

function isMissingColumn(error: any, col: string) {
  const msg = String(error?.message ?? "").toLowerCase();
  return msg.includes("column") && msg.includes(col.toLowerCase()) && msg.includes("does not exist");
}

const DEFAULT_ROW = {
  id: "default",
  general_full_week: 0,
  general_full_day: 0,
  general_am: 0,
  general_pm: 0,
  general_enabled: true,
  competition_full_week: 0,
  competition_full_day: 0,
  competition_am: 0,
  competition_pm: 0,
  competition_enabled: true,
  overnight_per_day: 0,
  overnight_full_week: 0,
  overnight_enabled: true,
  lunch_expenses: 0,
};

export async function GET(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  const supabase = await supabaseServer();
  const reqUrl = new URL(req.url);
  const tabId = String(reqUrl.searchParams.get("tab_id") ?? "").trim();
  let query = supabase.from("camp_accounting_pricing").select("*");
  if (tabId) query = query.eq("accounting_tab_id", tabId);
  else query = query.eq("id", "default");
  const { data, error } = await query.maybeSingle();
  if (error) {
    if (isMissingColumn(error, "general_full_week")) {
      return NextResponse.json(
        { ok: false, error: "Missing camp accounting pricing table. Run supabase/camp_accounting_and_price_modifier.sql." },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, pricing: data ?? DEFAULT_ROW });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const tabId = String(body?.tab_id ?? "").trim();
  const p = body?.pricing ?? {};
  const row = {
    id: tabId || "default",
    accounting_tab_id: tabId || null,
    general_full_week: Number(p?.general_full_week ?? 0) || 0,
    general_full_day: Number(p?.general_full_day ?? 0) || 0,
    general_am: Number(p?.general_am ?? 0) || 0,
    general_pm: Number(p?.general_pm ?? 0) || 0,
    general_enabled: p?.general_enabled !== false,
    competition_full_week: Number(p?.competition_full_week ?? 0) || 0,
    competition_full_day: Number(p?.competition_full_day ?? 0) || 0,
    competition_am: Number(p?.competition_am ?? 0) || 0,
    competition_pm: Number(p?.competition_pm ?? 0) || 0,
    competition_enabled: p?.competition_enabled !== false,
    overnight_per_day: Number(p?.overnight_per_day ?? 0) || 0,
    overnight_full_week: Number(p?.overnight_full_week ?? 0) || 0,
    overnight_enabled: p?.overnight_enabled !== false,
    lunch_expenses: Number(p?.lunch_expenses ?? 0) || 0,
    updated_at: new Date().toISOString(),
  };
  const supabase = await supabaseServer();
  let error: any = null;
  if (tabId) {
    const { data: existing } = await supabase
      .from("camp_accounting_pricing")
      .select("id")
      .eq("accounting_tab_id", tabId)
      .maybeSingle();
    if (existing?.id) {
      const updated = await supabase
        .from("camp_accounting_pricing")
        .update(row)
        .eq("id", existing.id);
      error = updated.error;
    } else {
      const inserted = await supabase.from("camp_accounting_pricing").insert(row);
      error = inserted.error;
    }
  } else {
    const upserted = await supabase.from("camp_accounting_pricing").upsert(row, { onConflict: "id" });
    error = upserted.error;
  }
  if (error) {
    if (isMissingColumn(error, "general_full_week")) {
      return NextResponse.json(
        { ok: false, error: "Missing camp accounting pricing table. Run supabase/camp_accounting_and_price_modifier.sql." },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, pricing: row });
}

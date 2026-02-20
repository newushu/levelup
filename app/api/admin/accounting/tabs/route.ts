import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseServer } from "@/lib/supabase/server";

const ALLOWED_TAB_TYPES = new Set(["camp", "normal_classes", "events", "testing", "expenses"]);

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isMissingTable(error: any, table: string) {
  const msg = String(error?.message ?? "").toLowerCase();
  return msg.includes("relation") && msg.includes(table.toLowerCase()) && msg.includes("does not exist");
}

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("admin_accounting_tabs")
    .select("id,title,tab_type,accounting_year,accounting_season_id,enabled,created_at,updated_at")
    .eq("enabled", true)
    .order("accounting_year", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) {
    if (isMissingTable(error, "admin_accounting_tabs")) {
      return NextResponse.json(
        { ok: false, error: "Missing accounting tabs table. Run supabase/camp_accounting_and_price_modifier.sql." },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, tabs: data ?? [] });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const title = String(body?.title ?? "").trim();
  const tabType = String(body?.tab_type ?? "").trim();
  const accountingYearRaw = Number(body?.accounting_year ?? 0);
  const accountingSeasonId = String(body?.accounting_season_id ?? "").trim();
  if (!title) return NextResponse.json({ ok: false, error: "title required" }, { status: 400 });
  if (!ALLOWED_TAB_TYPES.has(tabType)) return NextResponse.json({ ok: false, error: "invalid tab_type" }, { status: 400 });
  const accountingYear = Number.isFinite(accountingYearRaw) ? Math.round(accountingYearRaw) : 0;
  if (accountingYear < 2000 || accountingYear > 2100) {
    return NextResponse.json({ ok: false, error: "valid accounting_year required" }, { status: 400 });
  }
  if (!isUuid(accountingSeasonId)) {
    return NextResponse.json({ ok: false, error: "valid accounting_season_id required" }, { status: 400 });
  }
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("admin_accounting_tabs")
    .insert({
      title,
      tab_type: tabType,
      accounting_year: accountingYear,
      accounting_season_id: accountingSeasonId,
      enabled: true,
      created_by: gate.user.id,
    })
    .select("id,title,tab_type,accounting_year,accounting_season_id,enabled,created_at,updated_at")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, tab: data });
}

export async function DELETE(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  if (!isUuid(id)) return NextResponse.json({ ok: false, error: "valid id required" }, { status: 400 });
  const supabase = await supabaseServer();
  const { error } = await supabase.from("admin_accounting_tabs").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  const title = String(body?.title ?? "").trim();
  const accountingYearRaw = Number(body?.accounting_year ?? 0);
  const accountingSeasonId = String(body?.accounting_season_id ?? "").trim();

  if (!isUuid(id)) return NextResponse.json({ ok: false, error: "valid id required" }, { status: 400 });
  if (!title) return NextResponse.json({ ok: false, error: "title required" }, { status: 400 });

  const accountingYear = Number.isFinite(accountingYearRaw) ? Math.round(accountingYearRaw) : 0;
  if (accountingYear < 2000 || accountingYear > 2100) {
    return NextResponse.json({ ok: false, error: "valid accounting_year required" }, { status: 400 });
  }
  if (!isUuid(accountingSeasonId)) {
    return NextResponse.json({ ok: false, error: "valid accounting_season_id required" }, { status: 400 });
  }

  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("admin_accounting_tabs")
    .update({
      title,
      accounting_year: accountingYear,
      accounting_season_id: accountingSeasonId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id,title,tab_type,accounting_year,accounting_season_id,enabled,created_at,updated_at")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, tab: data });
}

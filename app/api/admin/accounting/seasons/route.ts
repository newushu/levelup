import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseServer } from "@/lib/supabase/server";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("admin_accounting_seasons")
    .select("id,name,enabled,created_at,updated_at")
    .eq("enabled", true)
    .order("name", { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, seasons: data ?? [] });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("admin_accounting_seasons")
    .insert({ name, enabled: true, created_by: gate.user.id })
    .select("id,name,enabled,created_at,updated_at")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, season: data });
}

export async function DELETE(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  if (!isUuid(id)) return NextResponse.json({ ok: false, error: "valid id required" }, { status: 400 });
  const supabase = await supabaseServer();
  const { error } = await supabase.from("admin_accounting_seasons").update({ enabled: false }).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

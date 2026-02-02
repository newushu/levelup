import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const supabase = await supabaseServer();
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "Missing pass id" }, { status: 400 });

  const patch: Record<string, any> = {};
  if (body?.name !== undefined) patch.name = String(body.name ?? "").trim();
  if (body?.description !== undefined) patch.description = String(body.description ?? "").trim() || null;
  if (body?.enabled !== undefined) patch.enabled = body.enabled === true;
  if (body?.price_usd !== undefined) patch.price_usd = Number.isFinite(Number(body.price_usd)) ? Number(body.price_usd) : null;
  if (body?.discount_price_usd !== undefined) {
    patch.discount_price_usd = Number.isFinite(Number(body.discount_price_usd)) ? Number(body.discount_price_usd) : null;
  }
  if (body?.discount_start !== undefined) patch.discount_start = String(body.discount_start ?? "").trim() || null;
  if (body?.discount_end !== undefined) patch.discount_end = String(body.discount_end ?? "").trim() || null;
  if (body?.access_scope !== undefined) patch.access_scope = String(body.access_scope ?? "").trim() || null;
  if (body?.default_valid_days !== undefined) {
    patch.default_valid_days = Number.isFinite(Number(body.default_valid_days)) ? Number(body.default_valid_days) : null;
  }
  if (body?.image_url !== undefined) patch.image_url = String(body.image_url ?? "").trim() || null;
  if (body?.image_text !== undefined) patch.image_text = String(body.image_text ?? "").trim() || null;
  if (body?.use_text !== undefined) patch.use_text = body.use_text === true;

  if (!Object.keys(patch).length) {
    return NextResponse.json({ ok: false, error: "No fields to update" }, { status: 400 });
  }

  let { error } = await supabase.from("pass_types").update(patch).eq("id", id);
  const isMissingColumn = (err: any) => String(err?.message || "").toLowerCase().includes("column");
  if (error && isMissingColumn(error)) {
    const fallback: Record<string, any> = {};
    if (patch.name !== undefined) fallback.name = patch.name;
    if (patch.description !== undefined) fallback.description = patch.description;
    if (patch.enabled !== undefined) fallback.enabled = patch.enabled;
    if (!Object.keys(fallback).length) {
      return NextResponse.json({ ok: false, error: "Missing columns for update" }, { status: 400 });
    }
    const retry = await supabase.from("pass_types").update(fallback).eq("id", id);
    error = retry.error;
  }

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

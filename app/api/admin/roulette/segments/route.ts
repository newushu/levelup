import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const SEGMENT_TYPES = new Set(["points_add", "points_subtract", "prize", "item", "task"]);

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = body?.id ? String(body.id) : null;
  const wheel_id = String(body?.wheel_id ?? "").trim();
  const label = String(body?.label ?? "").trim();
  const segment_type = String(body?.segment_type ?? "points_add").trim();
  const points_value = Math.max(0, Math.floor(Number(body?.points_value ?? 0)));
  const prize_text = String(body?.prize_text ?? "").trim() || null;
  const item_key = String(body?.item_key ?? "").trim() || null;
  const color = String(body?.color ?? "").trim() || null;
  const sort_order = Math.max(0, Math.floor(Number(body?.sort_order ?? 0)));

  if (!wheel_id) return NextResponse.json({ ok: false, error: "wheel_id required" }, { status: 400 });
  if (!label) return NextResponse.json({ ok: false, error: "Label required" }, { status: 400 });
  if (!SEGMENT_TYPES.has(segment_type)) {
    return NextResponse.json({ ok: false, error: "Invalid segment type" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const payload = {
    id: id ?? undefined,
    wheel_id,
    label,
    segment_type,
    points_value,
    prize_text,
    item_key,
    color,
    sort_order,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from("roulette_segments")
    .upsert(payload, { onConflict: "id" })
    .select("id,wheel_id,label,segment_type,points_value,prize_text,item_key,color,sort_order,updated_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, segment: data });
}

export async function DELETE(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = String(searchParams.get("id") ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

  const admin = supabaseAdmin();
  const { error } = await admin.from("roulette_segments").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

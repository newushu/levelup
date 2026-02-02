import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const WHEEL_TYPES = new Set(["prize", "task"]);

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const admin = supabaseAdmin();
  const { data: wheels, error } = await admin
    .from("roulette_wheels")
    .select("id,name,wheel_type,enabled,created_at,updated_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const wheelIds = (wheels ?? []).map((w: any) => w.id);
  const { data: segments, error: sErr } = wheelIds.length
    ? await admin
        .from("roulette_segments")
        .select("id,wheel_id,label,segment_type,points_value,prize_text,item_key,color,sort_order,updated_at")
        .in("wheel_id", wheelIds)
        .order("sort_order", { ascending: true })
    : { data: [], error: null };

  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });

  const segmentsByWheel = new Map<string, any[]>();
  (segments ?? []).forEach((seg: any) => {
    const key = String(seg.wheel_id ?? "");
    if (!segmentsByWheel.has(key)) segmentsByWheel.set(key, []);
    segmentsByWheel.get(key)!.push(seg);
  });

  const bundles = (wheels ?? []).map((wheel: any) => ({
    ...wheel,
    segments: segmentsByWheel.get(String(wheel.id ?? "")) ?? [],
  }));

  return NextResponse.json({ ok: true, wheels: bundles });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = body?.id ? String(body.id) : null;
  const name = String(body?.name ?? "").trim();
  const wheel_type = String(body?.wheel_type ?? "prize").trim();
  const enabled = body?.enabled !== false;

  if (!name) return NextResponse.json({ ok: false, error: "Wheel name required" }, { status: 400 });
  if (!WHEEL_TYPES.has(wheel_type)) {
    return NextResponse.json({ ok: false, error: "Invalid wheel type" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const payload = {
    id: id ?? undefined,
    name,
    wheel_type,
    enabled,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await admin
    .from("roulette_wheels")
    .upsert(payload, { onConflict: "id" })
    .select("id,name,wheel_type,enabled,created_at,updated_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, wheel: data });
}

export async function DELETE(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = String(searchParams.get("id") ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

  const admin = supabaseAdmin();
  const { error } = await admin.from("roulette_wheels").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

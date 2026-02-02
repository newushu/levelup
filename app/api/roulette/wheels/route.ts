import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

async function requireCoachOrAdmin() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false as const, error: error?.message || "Not logged in" };

  const { data: roles, error: rErr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id);

  if (rErr) return { ok: false as const, error: rErr.message };
  const allowed = (roles ?? []).some((r: any) => ["admin", "coach"].includes(String(r.role ?? "").toLowerCase()));
  if (!allowed) return { ok: false as const, error: "Coach access required" };

  return { ok: true as const, supabase };
}

export async function GET() {
  const gate = await requireCoachOrAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const supabase = gate.supabase;
  const { data: wheels, error } = await supabase
    .from("roulette_wheels")
    .select("id,name,wheel_type,enabled,created_at,updated_at")
    .eq("enabled", true)
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const wheelIds = (wheels ?? []).map((w: any) => w.id);
  const { data: segments, error: sErr } = wheelIds.length
    ? await supabase
        .from("roulette_segments")
        .select("id,wheel_id,label,segment_type,points_value,prize_text,item_key,color,sort_order")
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

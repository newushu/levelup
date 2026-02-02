import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

const SEGMENT_TYPES = new Set(["points_add", "points_subtract", "prize", "item", "task"]);

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

  return { ok: true as const, supabase, userId: data.user.id };
}

function randomIndex(max: number) {
  if (max <= 0) return 0;
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return Math.floor((arr[0] / 2 ** 32) * max);
}

export async function POST(req: Request) {
  const gate = await requireCoachOrAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  const wheel_id = String(body?.wheel_id ?? "").trim();
  if (!student_id) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });
  if (!wheel_id) return NextResponse.json({ ok: false, error: "Missing wheel_id" }, { status: 400 });

  const supabase = gate.supabase;
  const { data: wheel, error: wErr } = await supabase
    .from("roulette_wheels")
    .select("id,name,wheel_type,enabled")
    .eq("id", wheel_id)
    .maybeSingle();

  if (wErr) return NextResponse.json({ ok: false, error: wErr.message }, { status: 500 });
  if (!wheel || wheel.enabled === false) return NextResponse.json({ ok: false, error: "Wheel not available" }, { status: 404 });

  const { data: segments, error: sErr } = await supabase
    .from("roulette_segments")
    .select("id,wheel_id,label,segment_type,points_value,prize_text,item_key,color,sort_order")
    .eq("wheel_id", wheel_id)
    .order("sort_order", { ascending: true });

  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });
  if (!segments || segments.length === 0) {
    return NextResponse.json({ ok: false, error: "Wheel has no segments" }, { status: 400 });
  }

  const { data: recentSpins } = await supabase
    .from("roulette_spins")
    .select("segment_id")
    .eq("wheel_id", wheel_id)
    .order("created_at", { ascending: false })
    .limit(5);

  const blockedIds = new Set((recentSpins ?? []).map((s: any) => String(s.segment_id ?? "")).filter(Boolean));
  const eligibleIndices = segments
    .map((seg: any, index: number) => ({ seg, index }))
    .filter(({ seg }) => !blockedIds.has(String(seg.id ?? "")))
    .map(({ index }) => index);
  const pool = eligibleIndices.length ? eligibleIndices : segments.map((_, i) => i);
  const pickIdx = randomIndex(pool.length);
  const idx = pool[pickIdx];
  const segment = segments[idx];
  const segmentType = String(segment.segment_type ?? "points_add");
  if (!SEGMENT_TYPES.has(segmentType)) {
    return NextResponse.json({ ok: false, error: "Invalid segment type" }, { status: 400 });
  }

  const pointsValue = Math.max(0, Math.floor(Number(segment.points_value ?? 0)));
  const pointsDelta =
    segmentType === "points_add" ? pointsValue : segmentType === "points_subtract" ? -pointsValue : 0;

  const insertPayload = {
    wheel_id,
    segment_id: segment.id,
    student_id,
    result_type: segmentType,
    points_delta: pointsDelta,
    prize_text: segmentType === "prize" || segmentType === "task" ? String(segment.prize_text ?? "").trim() || null : null,
    item_key: segmentType === "item" ? String(segment.item_key ?? "").trim() || null : null,
    created_by: gate.userId,
  };

  const { data: spin, error: spinErr } = await supabase
    .from("roulette_spins")
    .insert(insertPayload)
    .select("id,wheel_id,segment_id,student_id,result_type,points_delta,prize_text,item_key,created_at")
    .single();

  if (spinErr) return NextResponse.json({ ok: false, error: spinErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    spin,
    wheel,
    segment,
    segment_index: idx,
  });
}

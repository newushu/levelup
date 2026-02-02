import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const admin = supabaseAdmin();
  const { data: rows, error: rErr } = await admin
    .from("student_challenges")
    .select("challenge_id,completed,completed_at")
    .eq("completed", true);

  if (rErr) return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 });

  const challengeIds = Array.from(new Set((rows ?? []).map((r: any) => String(r.challenge_id ?? "").trim()).filter(Boolean)));
  const { data: challenges, error: cErr } = challengeIds.length
    ? await admin.from("challenges").select("id,tier").in("id", challengeIds)
    : { data: [], error: null };

  if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });

  const tierById = new Map((challenges ?? []).map((c: any) => [String(c.id), String(c.tier ?? "").trim()]));
  const byTier: Record<string, number> = {};
  let total = 0;
  (rows ?? []).forEach((row: any) => {
    const tier = tierById.get(String(row.challenge_id ?? "")) ?? "";
    if (!tier) return;
    total += 1;
    const key = tier.toLowerCase();
    byTier[key] = (byTier[key] ?? 0) + 1;
  });

  return NextResponse.json({ ok: true, total, by_tier: byTier });
}

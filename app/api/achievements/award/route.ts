import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

async function requireCoachOrAdmin(supabase: any) {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return { ok: false, error: "Not authenticated" as const };

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  const roleSet = new Set((roles ?? []).map((r: any) => String(r.role)));
  if (!roleSet.has("coach") && !roleSet.has("admin")) return { ok: false, error: "Forbidden" as const };

  return { ok: true, user };
}

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const gate = await requireCoachOrAdmin(supabase);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  const badge_id = String(body?.badge_id ?? "").trim();
  const award_note = String(body?.award_note ?? "").trim();

  if (!student_id || !badge_id) {
    return NextResponse.json({ ok: false, error: "Missing student_id or badge_id" }, { status: 400 });
  }

  // avoid duplicates
  const { data: existing, error: exErr } = await supabase
    .from("student_achievement_badges")
    .select("id")
    .eq("student_id", student_id)
    .eq("badge_id", badge_id)
    .limit(1);

  if (exErr) return NextResponse.json({ ok: false, error: exErr.message }, { status: 500 });
  if (existing?.length) return NextResponse.json({ ok: true, already: true });

  const { data: badgeMeta, error: bErr } = await supabase
    .from("achievement_badges")
    .select("id,name,points_award")
    .eq("id", badge_id)
    .maybeSingle();
  if (bErr) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 });
  const pointsAward = Number(badgeMeta?.points_award ?? 0);

  const { error } = await supabase
    .from("student_achievement_badges")
    .insert({
      student_id,
      badge_id,
      source: "coach",
      awarded_by: gate.user.id,
      award_note: award_note || null,
      points_awarded: pointsAward,
    });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  if (pointsAward) {
    const { error: lErr } = await supabase.from("ledger").insert({
      student_id,
      points: pointsAward,
      note: `Badge award: ${badgeMeta?.name ?? badge_id}`,
      category: "badge_award",
      created_by: gate.user.id,
    });
    if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });

    const { error: rpcErr } = await supabase.rpc("recompute_student_points", { p_student_id: student_id });
    if (rpcErr) return NextResponse.json({ ok: false, error: rpcErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

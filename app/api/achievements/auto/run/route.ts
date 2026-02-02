import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * This route uses SERVICE ROLE and should be protected.
 * Easiest: require a secret header.
 */
function requireSecret(req: NextRequest) {
  const got = req.headers.get("x-achievement-secret") || "";
  return got && got === process.env.ACHIEVEMENTS_CRON_SECRET;
}

export async function POST(req: NextRequest) {
  if (!requireSecret(req)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const admin = supabaseAdmin();

  const { data: students, error: sErr } = await admin
    .from("students")
    .select("id, level, lifetime_points");

  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });

  const { data: badges, error: bErr } = await admin
    .from("achievement_badges")
    .select("id,name,points_award,criteria_type,criteria_json,category,enabled")
    .eq("enabled", true)
    .neq("category", "prestige");
  if (bErr) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 });

  const checkinCounts = new Map<string, number>();
  const studentIds = (students ?? []).map((s: any) => String(s.id));
  if (studentIds.length) {
    const { data: checkins, error: cErr } = await admin
      .from("attendance_checkins")
      .select("student_id")
      .in("student_id", studentIds);
    if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });
    (checkins ?? []).forEach((row: any) => {
      const id = String(row.student_id ?? "");
      if (!id) return;
      checkinCounts.set(id, (checkinCounts.get(id) ?? 0) + 1);
    });
  }

  let awarded = 0;

  for (const badge of badges ?? []) {
    const criteriaType = String((badge as any)?.criteria_type ?? "").trim().toLowerCase();
    const criteria = (badge as any)?.criteria_json ?? {};
    const badgeId = String((badge as any)?.id ?? "");
    if (!badgeId || !criteriaType) continue;

    const min = Number(criteria.min ?? criteria.threshold ?? criteria.min_points ?? 0);
    const eligibleIds = (students ?? [])
      .filter((st: any) => {
        if (criteriaType === "checkins") {
          return (checkinCounts.get(String(st.id)) ?? 0) >= min;
        }
        if (criteriaType === "lifetime_points") {
          return Number(st.lifetime_points ?? 0) >= min;
        }
        if (criteriaType === "level") {
          return Number(st.level ?? 0) >= min;
        }
        return false;
      })
      .map((st: any) => String(st.id));

    if (!eligibleIds.length) continue;

    const { data: existing, error: exErr } = await admin
      .from("student_achievement_badges")
      .select("student_id")
      .eq("badge_id", badgeId)
      .in("student_id", eligibleIds);
    if (exErr) return NextResponse.json({ ok: false, error: exErr.message }, { status: 500 });

    const existingSet = new Set((existing ?? []).map((r: any) => String(r.student_id)));
    const toInsert = eligibleIds.filter((id) => !existingSet.has(id));
    if (!toInsert.length) continue;

    const pointsAward = Number((badge as any)?.points_award ?? 0);
    const { error } = await admin.from("student_achievement_badges").insert(
      toInsert.map((id) => ({
        student_id: id,
        badge_id: badgeId,
        source: "auto",
        awarded_by: null,
        award_note: null,
        points_awarded: pointsAward,
      }))
    );
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    awarded += toInsert.length;

    if (pointsAward) {
      const { error: lErr } = await admin.from("ledger").insert(
        toInsert.map((id) => ({
          student_id: id,
          points: pointsAward,
          note: `Badge award: ${(badge as any)?.name ?? badgeId}`,
          category: "badge_award",
          created_by: null,
        }))
      );
      if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });
      for (const id of toInsert) {
        const { error: rpcErr } = await admin.rpc("recompute_student_points", { p_student_id: id });
        if (rpcErr) return NextResponse.json({ ok: false, error: rpcErr.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ ok: true, awarded });
}

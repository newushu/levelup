import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const { student_id, reward_id } = await req.json();
  if (!student_id || !reward_id) return NextResponse.json({ ok: false, error: "Missing student_id/reward_id" }, { status: 400 });

  const { data: roles, error: roleErr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id);
  if (roleErr) return NextResponse.json({ ok: false, error: roleErr.message }, { status: 500 });
  const roleList = (roles ?? []).map((r) => String(r.role ?? "").toLowerCase());
  if (roleList.includes("student")) {
    return NextResponse.json({ ok: false, error: "Students cannot instant redeem" }, { status: 403 });
  }

  const { data: reward, error: rErr } = await supabase.from("rewards").select("id,name,cost").eq("id", reward_id).single();
  if (rErr) return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 });

  const { data: student, error: sErr } = await supabase.from("students").select("id,name,points_total,level").eq("id", student_id).single();
  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });

  if ((student.points_total ?? 0) < reward.cost) {
    return NextResponse.json({ ok: false, error: "Not enough points" }, { status: 400 });
  }

  // Log redemption
  const { error: redErr } = await supabase.from("reward_redemptions").insert({
    student_id,
    reward_id,
    cost: reward.cost,
    qty: 1,
    status: "approved",
    mode: "instant",
    requested_at: new Date().toISOString(),
    approved_at: new Date().toISOString(),
    approved_by: u.user.id,
    redeemed_at: new Date().toISOString(),
    redeemed_by: u.user.id,
  });
  if (redErr) return NextResponse.json({ ok: false, error: redErr.message }, { status: 500 });

  // Deduct points via ledger
  const { error: ledErr } = await supabase.from("ledger").insert({
    student_id,
    points: -Math.abs(reward.cost),
    note: `Redeemed: ${reward.name}`,
    category: "redeem",
  });
  if (ledErr) return NextResponse.json({ ok: false, error: ledErr.message }, { status: 500 });

  // Recompute totals (no glow handled client-side)
  const { error: r1 } = await supabase.rpc("recompute_student_points", { p_student_id: student_id });
  if (r1) return NextResponse.json({ ok: false, error: r1.message }, { status: 500 });

  const { data: after, error: aErr } = await supabase.from("students").select("points_total,level").eq("id", student_id).single();
  if (aErr) return NextResponse.json({ ok: false, error: aErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    studentName: student.name,
    rewardName: reward.name,
    remainingPoints: after.points_total,
    level: after.level,
  });
}

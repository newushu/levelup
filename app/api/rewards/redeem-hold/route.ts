import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const reward_id = String(body?.reward_id ?? "").trim();
  const requestedStudentId = String(body?.student_id ?? "").trim();
  if (!reward_id) return NextResponse.json({ ok: false, error: "Missing reward_id" }, { status: 400 });

  const { data: roles, error: roleErr } = await supabase
    .from("user_roles")
    .select("role,student_id")
    .eq("user_id", u.user.id);
  if (roleErr) return NextResponse.json({ ok: false, error: roleErr.message }, { status: 500 });

  const roleList = (roles ?? []).map((r) => String(r.role ?? "").toLowerCase());
  const isStudent = roleList.includes("student");
  const isAdminLike = roleList.some((r) => ["admin", "coach", "classroom"].includes(r));

  let student_id = "";
  if (isStudent) {
    student_id = String((roles ?? []).find((r) => String(r.role ?? "").toLowerCase() === "student")?.student_id ?? "");
  } else if (isAdminLike) {
    student_id = requestedStudentId;
  }

  if (!student_id) {
    return NextResponse.json(
      { ok: false, error: "student_id is required for admin/coach requests" },
      { status: 400 }
    );
  }

  if (!isStudent && !isAdminLike) {
    return NextResponse.json({ ok: false, error: "Not allowed to request holds" }, { status: 403 });
  }

  if (!student_id) return NextResponse.json({ ok: false, error: "Student mapping missing" }, { status: 400 });

  const { data: reward, error: rErr } = await supabase.from("rewards").select("id,name,cost").eq("id", reward_id).single();
  if (rErr) return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 });

  const { data: student, error: sErr } = await supabase
    .from("students")
    .select("id,points_total,points_balance")
    .eq("id", student_id)
    .single();
  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });

  const available = Number(student.points_balance ?? student.points_total ?? 0);
  if (available < reward.cost) {
    return NextResponse.json({ ok: false, error: "Not enough points" }, { status: 400 });
  }

  const holdUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();

  const { data: redemption, error: redErr } = await supabase
    .from("reward_redemptions")
    .insert({
      student_id,
      reward_id,
      cost: reward.cost,
      qty: 1,
      status: "pending",
      mode: "hold",
      requested_at: nowIso,
      hold_until: holdUntil,
    })
    .select("id")
    .single();
  if (redErr) return NextResponse.json({ ok: false, error: redErr.message }, { status: 500 });

  const { error: ledErr } = await supabase.from("ledger").insert({
    student_id,
    points: -Math.abs(reward.cost),
    note: `Hold Request: ${reward.name}`,
    category: "redeem_hold",
  });
  if (ledErr) return NextResponse.json({ ok: false, error: ledErr.message }, { status: 500 });

  const { error: r1 } = await supabase.rpc("recompute_student_points", { p_student_id: student_id });
  if (r1) return NextResponse.json({ ok: false, error: r1.message }, { status: 500 });

  return NextResponse.json({ ok: true, redemption_id: redemption?.id });
}

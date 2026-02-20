import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";
import { getStudentModifierStack } from "@/lib/modifierStack";
import { supabaseAdmin } from "@/lib/supabaseAdmin";


export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const admin = supabaseAdmin();


  const { data: u, error: uErr } = await supabase.auth.getUser();
  if (uErr || !u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });


  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  const points = Number(body?.points ?? 0);
  const note = String(body?.note ?? "").slice(0, 200);
  const category = String(body?.category ?? "manual").slice(0, 64);


  if (!student_id) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });
  if (!Number.isFinite(points) || points === 0)
    return NextResponse.json({ ok: false, error: "points must be a non-zero number" }, { status: 400 });


  const categoryLower = category.toLowerCase();
  let pointsBase: number | null = null;
  let pointsMultiplier: number | null = null;
  let adjustedPoints = points;

  if (categoryLower === "rule_keeper" || categoryLower === "rule_breaker") {
    const stack = await getStudentModifierStack(student_id);
    const multiplier =
      categoryLower === "rule_keeper"
        ? Number(stack.rule_keeper_multiplier ?? 1)
        : Number(stack.rule_breaker_multiplier ?? 1);
    if (Number.isFinite(multiplier) && multiplier !== 1) {
      const magnitude = Math.round(Math.abs(points) * multiplier);
      adjustedPoints = points >= 0 ? magnitude : -magnitude;
      pointsBase = points;
      pointsMultiplier = multiplier;
    }
    if (Number.isFinite(multiplier) && multiplier === 1) {
      pointsBase = points;
      pointsMultiplier = 1;
    }
  }

  const ins = await admin.from("ledger").insert({
    student_id,
    points: adjustedPoints,
    points_base: pointsBase,
    points_multiplier: pointsMultiplier,
    note,
    category,
    created_by: u.user.id, // uses your ledger column
  });


  if (ins.error) return NextResponse.json({ ok: false, error: ins.error.message }, { status: 500 });


  // recompute balance + lifetime + level
  const rpc = await admin.rpc("recompute_student_points", { p_student_id: student_id });
  let recomputeWarning: string | null = null;
  if (rpc.error) {
    recomputeWarning = rpc.error.message;
    const { data: current } = await admin
      .from("students")
      .select("id,points_total,points_balance,lifetime_points")
      .eq("id", student_id)
      .maybeSingle();
    if (current) {
      const prevTotal = Number(current.points_total ?? current.points_balance ?? 0);
      const prevBalance = Number(current.points_balance ?? current.points_total ?? 0);
      const prevLifetime = Number(current.lifetime_points ?? 0);
      const nextTotal = prevTotal + adjustedPoints;
      const nextBalance = prevBalance + adjustedPoints;
      const nextLifetime = prevLifetime + Math.max(0, adjustedPoints);
      await admin
        .from("students")
        .update({
          points_total: nextTotal,
          points_balance: nextBalance,
          lifetime_points: nextLifetime,
        })
        .eq("id", student_id);
    }
  }


  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const baseUrl = process.env.APP_URL ?? (host ? `${proto}://${host}` : "");
  const prestigeSecret = process.env.ACHIEVEMENTS_CRON_SECRET ?? "";
  if (baseUrl && prestigeSecret) {
    void (async () => {
      try {
        await fetch(`${baseUrl}/api/achievements/auto/prestige`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-achievement-secret": prestigeSecret,
          },
          body: JSON.stringify({ student_id }),
        });
      } catch {}
    })();
  }


  // return fresh student snapshot so UI can update immediately
  const { data: s, error: sErr } = await admin
    .from("students")
    .select("id,name,level,points_total,points_balance,lifetime_points,is_competition_team")
    .eq("id", student_id)
    .maybeSingle();


  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, student: s, prestigeAutoError: null, recomputeWarning });
}

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  if (!student_id) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });

  const { data: rows, error } = await supabase
    .from("ledger")
    .select("points,points_base,points_multiplier,category")
    .eq("student_id", student_id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  let auraBonus = 0;
  let auraDaily = 0;
  let auraMultiplier = 0;

  (rows ?? []).forEach((row: any) => {
    const category = String(row.category ?? "").toLowerCase();
    const points = Number(row.points ?? 0);
    if (category === "avatar_daily") {
      auraDaily += points;
      auraBonus += points;
      return;
    }
    const base = row.points_base !== undefined && row.points_base !== null ? Number(row.points_base ?? 0) : null;
    const multiplier =
      row.points_multiplier !== undefined && row.points_multiplier !== null ? Number(row.points_multiplier ?? 1) : null;
    if (base !== null && multiplier !== null && multiplier !== 1) {
      const delta = points - base;
      auraMultiplier += delta;
      auraBonus += delta;
    }
  });

  return NextResponse.json({
    ok: true,
    total_bonus: auraBonus,
    multiplier_bonus: auraMultiplier,
    daily_bonus: auraDaily,
  });
}

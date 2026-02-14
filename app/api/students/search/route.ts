import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });
  const isMissingColumn = (err: any, column: string) => {
    const msg = String(err?.message || "").toLowerCase();
    const key = column.toLowerCase();
    return (
      msg.includes(`column "${key}"`) ||
      msg.includes(`.${key}`) ||
      msg.includes(key)
    );
  };

  const { query } = await req.json();
  const q = String(query ?? "").trim();
  if (!q) return NextResponse.json({ ok: true, students: [] });

  const primary = await supabase
    .from("students")
    .select("id,name,level,points_total,lifetime_points,avatar_storage_path,is_competition_team")
    .ilike("name", `%${q}%`)
    .order("name", { ascending: true })
    .limit(25);
  let rowsRaw = (primary.data ?? []) as any[];
  let error = primary.error;
  if (error && isMissingColumn(error, "lifetime_points")) {
    const fallback = await supabase
      .from("students")
      .select("id,name,level,points_total,avatar_storage_path,is_competition_team")
      .ilike("name", `%${q}%`)
      .order("name", { ascending: true })
      .limit(25);
    rowsRaw = (fallback.data ?? []) as any[];
    error = fallback.error;
  }
  if (error && isMissingColumn(error, "avatar_storage_path")) {
    const fallback = await supabase
      .from("students")
      .select("id,name,level,points_total,lifetime_points,is_competition_team")
      .ilike("name", `%${q}%`)
      .order("name", { ascending: true })
      .limit(25);
    rowsRaw = (fallback.data ?? []) as any[];
    error = fallback.error;
  }
  if (error && isMissingColumn(error, "lifetime_points")) {
    const fallback = await supabase
      .from("students")
      .select("id,name,level,points_total,is_competition_team")
      .ilike("name", `%${q}%`)
      .order("name", { ascending: true })
      .limit(25);
    rowsRaw = (fallback.data ?? []) as any[];
    error = fallback.error;
  }

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const rows = rowsRaw;
  const ids = rows.map((r) => r.id);
  if (!ids.length) return NextResponse.json({ ok: true, students: [] });

  const { data: checkins, error: cErr } = await supabase
    .from("attendance_checkins")
    .select("student_id")
    .in("student_id", ids);
  if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });

  const checkinCount: Record<string, number> = {};
  (checkins ?? []).forEach((row: any) => {
    const sid = String(row.student_id ?? "");
    if (!sid) return;
    checkinCount[sid] = (checkinCount[sid] ?? 0) + 1;
  });

  const { data: levelRows, error: levelErr } = await supabase
    .from("avatar_level_thresholds")
    .select("level,min_lifetime_points")
    .order("level", { ascending: true });
  const thresholds = (levelErr ? [] : (levelRows ?? []))
    .map((row: any) => ({ level: Number(row.level), min: Number(row.min_lifetime_points ?? 0) }))
    .filter((row: any) => Number.isFinite(row.level))
    .sort((a: any, b: any) => a.level - b.level);

  const out = rows.map((r) => {
    let computedLevel = Number(r.level ?? 1);
    if (thresholds.length) {
      const points = Number(r.lifetime_points ?? 0);
      thresholds.forEach((lvl: any) => {
        if (points >= lvl.min) computedLevel = lvl.level;
      });
    }
    return {
    ...r,
    level: computedLevel,
    checkin_count: checkinCount[r.id] ?? 0,
    };
  });

  return NextResponse.json({ ok: true, students: out });
}

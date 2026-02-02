import { NextResponse } from "next/server";
import { requireUser } from "../../../../lib/authz";
import { supabaseAdmin } from "../../../../lib/supabase/admin";

function mondayOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay(); // 0 Sun
  const diff = (day + 6) % 7; // shift so Mon=0
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function POST(req: Request) {
  const gate = await requireUser();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: 401 });

  const { student_id, points, note, photo1_url, photo2_url, photo3_url } = await req.json();
  if (!student_id || typeof points !== "number") {
    return NextResponse.json({ error: "student_id and points required" }, { status: 400 });
  }

  // Resolve parent_id from auth user
  const admin = supabaseAdmin();

  const { data: parent, error: pErr } = await admin
    .from("parents")
    .select("id")
    .eq("auth_user_id", gate.user.id)
    .maybeSingle();

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (!parent?.id) return NextResponse.json({ error: "Not a parent account" }, { status: 403 });

  // Limit points by app_settings
  const { data: settings } = await admin.from("app_settings").select("parent_weekly_points_limit").eq("id", 1).single();
  const limit = settings?.parent_weekly_points_limit ?? 30;
  if (points < 0 || points > limit) {
    return NextResponse.json({ error: `Points must be 0-${limit}` }, { status: 400 });
  }

  // Ensure parent linked to student
  const { data: link } = await admin
    .from("parent_students")
    .select("parent_id,student_id")
    .eq("parent_id", parent.id)
    .eq("student_id", student_id)
    .maybeSingle();

  if (!link) return NextResponse.json({ error: "Parent not linked to this student" }, { status: 403 });

  const weekStart = mondayOfWeek(new Date()).toISOString().slice(0, 10);

  const { error } = await admin.from("parent_weekly_awards").upsert({
    parent_id: parent.id,
    student_id,
    week_start: weekStart,
    points,
    note: note ?? null,
    photo1_url: photo1_url ?? null,
    photo2_url: photo2_url ?? null,
    photo3_url: photo3_url ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, week_start: weekStart });
}

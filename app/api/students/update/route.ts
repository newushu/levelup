import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  if (!student_id) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });

  const payload: Record<string, any> = {};
  if (Object.prototype.hasOwnProperty.call(body, "first_name")) {
    payload.first_name = String(body?.first_name ?? "").trim() || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "last_name")) {
    payload.last_name = String(body?.last_name ?? "").trim() || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "gender")) {
    const gender = String(body?.gender ?? "").trim().toLowerCase();
    payload.gender = gender === "female" ? "female" : gender === "male" ? "male" : null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "dob")) {
    payload.dob = body?.dob ? String(body.dob) : null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "email")) {
    payload.email = String(body?.email ?? "").trim() || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "phone")) {
    payload.phone = String(body?.phone ?? "").trim() || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "emergency_contact")) {
    payload.emergency_contact = String(body?.emergency_contact ?? "").trim() || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "goals")) {
    payload.goals = String(body?.goals ?? "").trim() || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "notes")) {
    payload.notes = String(body?.notes ?? "").trim() || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "enrollment_info")) {
    payload.enrollment_info = body?.enrollment_info ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "is_competition_team")) {
    payload.is_competition_team = Boolean(body?.is_competition_team);
  }

  if (!Object.keys(payload).length) {
    return NextResponse.json({ ok: false, error: "No updates provided" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("students")
    .update(payload)
    .eq("id", student_id)
    .select(
      [
        "id",
        "name",
        "level",
        "points_total",
        "points_balance",
        "lifetime_points",
        "is_competition_team",
        "first_name",
        "last_name",
        "gender",
        "dob",
        "email",
        "phone",
        "emergency_contact",
        "goals",
        "notes",
        "enrollment_info",
      ].join(",")
    )
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, student: data });
}

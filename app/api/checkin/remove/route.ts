import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const checkin_id = String(body?.checkin_id ?? "").trim();
  const instance_id = String(body?.instance_id ?? "").trim();
  const student_id = String(body?.student_id ?? "").trim();

  if (!checkin_id && !(instance_id && student_id)) {
    return NextResponse.json(
      { ok: false, error: "Missing checkin_id or instance_id/student_id" },
      { status: 400 }
    );
  }

  let q = supabase.from("attendance_checkins").delete();
  if (checkin_id) q = q.eq("id", checkin_id);
  if (!checkin_id && instance_id) {
    q = q.eq("instance_id", instance_id).eq("student_id", student_id);
  }

  const { error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

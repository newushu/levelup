import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

async function isCoach(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["coach", "admin"])
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  return { ok: !!data, error: data ? null : "Forbidden (coach/admin only)" };
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();

  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const coach = await isCoach(supabase, u.user.id);
  if (!coach.ok) return NextResponse.json({ ok: false, error: coach.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  const skill_id = String(body?.skill_id ?? "").trim();

  if (!student_id) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });
  if (!skill_id) return NextResponse.json({ ok: false, error: "Missing skill_id" }, { status: 400 });

  const del = await supabase
    .from("student_skill_completions")
    .delete()
    .eq("student_id", student_id)
    .eq("skill_id", skill_id);

  if (del.error) return NextResponse.json({ ok: false, error: del.error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

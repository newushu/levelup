import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await supabaseServer();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) return NextResponse.json({ ok: false, error: userErr.message }, { status: 401 });

  const user = userData?.user;
  if (!user) return NextResponse.json({ ok: false, error: "No session" }, { status: 401 });

  const { data: roles, error: roleErr } = await supabase
    .from("user_roles")
    .select("role,student_id")
    .eq("user_id", user.id);
  if (roleErr) return NextResponse.json({ ok: false, error: roleErr.message }, { status: 500 });

  const studentRole = (roles ?? []).find((r: any) => String(r.role ?? "").toLowerCase() === "student");
  const studentId = String(studentRole?.student_id ?? "");
  if (!studentId) return NextResponse.json({ ok: false, error: "No student role" }, { status: 403 });

  const { data: student, error } = await supabase
    .from("students")
    .select("id,name,first_name,last_name")
    .eq("id", studentId)
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, student });
}

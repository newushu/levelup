import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

async function getUserScope(supabase: Awaited<ReturnType<typeof supabaseServer>>) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { ok: false as const, error: "Not logged in" };

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role,student_id")
    .eq("user_id", u.user.id);
  if (error) return { ok: false as const, error: error.message };

  const isStudent = (roles ?? []).some((r) => String(r.role ?? "").toLowerCase() === "student");
  const isAdmin = (roles ?? []).some((r) => ["admin", "coach"].includes(String(r.role ?? "").toLowerCase()));
  const studentId = isStudent
    ? String((roles ?? []).find((r) => String(r.role ?? "").toLowerCase() === "student")?.student_id ?? "")
    : "";

  return { ok: true as const, isStudent, isAdmin, studentId };
}

export async function GET() {
  const supabase = await supabaseServer();
  const scope = await getUserScope(supabase);
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: 401 });
  if (!scope.isAdmin) return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });

  const { data, error } = await supabase
    .from("chat_presence")
    .select("student_id,last_seen,students(id,name,level)")
    .gte("last_seen", new Date(Date.now() - 2 * 60 * 1000).toISOString())
    .order("last_seen", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const online = (data ?? []).map((row: any) => ({
    student_id: row.student_id,
    last_seen: row.last_seen,
    name: row.students?.name ?? "Student",
    level: row.students?.level ?? 0,
  }));

  return NextResponse.json({ ok: true, online });
}

export async function POST() {
  const supabase = await supabaseServer();
  const scope = await getUserScope(supabase);
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: 401 });
  if (!scope.isStudent || !scope.studentId) return NextResponse.json({ ok: true });

  const { error } = await supabase
    .from("chat_presence")
    .upsert({ student_id: scope.studentId, last_seen: new Date().toISOString() }, { onConflict: "student_id" });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

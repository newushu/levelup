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

  const roleList = (roles ?? []).map((r) => String(r.role ?? "").toLowerCase()).filter(Boolean);
  const { data: parent } = await supabase.from("parents").select("id").eq("auth_user_id", user.id).maybeSingle();
  const role =
    roleList.includes("admin")
      ? "admin"
      : parent?.id || roleList.includes("parent")
      ? "parent"
      : roleList.includes("coach")
      ? "coach"
      : roleList.includes("camp")
      ? "camp"
      : roleList.includes("checkin")
      ? "checkin"
      : roleList.includes("classroom")
      ? "classroom"
      : roleList.includes("skill_user")
      ? "skill_user"
      : roleList.includes("skill_pulse")
      ? "skill_pulse"
      : roleList.includes("display")
      ? "display"
      : roleList.includes("student")
      ? "student"
      : "coach";
  const student_id =
    role === "student"
      ? String((roles ?? []).find((r) => String(r.role ?? "").toLowerCase() === "student")?.student_id ?? "")
      : "";

  const parent_id = String(parent?.id ?? "");

  return NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email },
    role,
    roles: roleList,
    student_id: student_id || null,
    parent_id: parent_id || null,
  });
}

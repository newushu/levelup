import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const supabase = await supabaseServer();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) return NextResponse.json({ ok: false, error: userErr.message }, { status: 401 });
  const user = userData?.user;
  if (!user) return NextResponse.json({ ok: false, error: "No session" }, { status: 401 });

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role,student_id")
    .eq("user_id", user.id);
  const roleList = (roles ?? []).map((r) => String(r.role ?? "").toLowerCase()).filter(Boolean);

  const admin = supabaseAdmin();
  const { data: parent } = await admin
    .from("parents")
    .select("id,name")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const role = roleList.includes("admin")
    ? "admin"
    : parent?.id || roleList.includes("parent")
    ? "parent"
    : roleList.includes("coach")
    ? "coach"
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

  let display_name = "";
  if (role === "parent") {
    display_name = String(parent?.name ?? "").trim();
  } else if (role === "student") {
    const studentId = String((roles ?? []).find((r) => String(r.role ?? "").toLowerCase() === "student")?.student_id ?? "");
    if (studentId) {
      const { data: student } = await admin.from("students").select("name").eq("id", studentId).maybeSingle();
      display_name = String(student?.name ?? "").trim();
    }
  } else {
    const { data: profile } = await admin
      .from("profiles")
      .select("username")
      .eq("user_id", user.id)
      .maybeSingle();
    display_name = String(profile?.username ?? "").trim();
  }

  if (!display_name) {
    display_name = String(user.email ?? "").split("@")[0] || "Welcome";
  }

  return NextResponse.json({ ok: true, role, display_name });
}

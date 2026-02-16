import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ALLOWED_ROLES: Set<string> = new Set([
  "admin",
  "coach",
  "student",
  "parent",
  "display",
  "skill_pulse",
  "camp",
  "checkin",
  "classroom",
  "skill-tablet",
  "coach-dashboard",
]);

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const user_id = String(body?.user_id ?? "").trim();
  const email = String(body?.email ?? "").trim();
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "").trim();
  const roleArray: string[] = Array.isArray(body?.roles)
    ? body.roles.map((r: any) => String(r ?? "").toLowerCase().trim()).filter(Boolean)
    : [];
  const uniqueRoles: string[] = Array.from(new Set<string>(roleArray)).filter((r): r is string => ALLOWED_ROLES.has(r));

  if (!user_id) return NextResponse.json({ ok: false, error: "user_id required" }, { status: 400 });
  if (!email) return NextResponse.json({ ok: false, error: "email required" }, { status: 400 });
  if (!username) return NextResponse.json({ ok: false, error: "username required" }, { status: 400 });
  if (!uniqueRoles.length) return NextResponse.json({ ok: false, error: "At least one valid role required" }, { status: 400 });

  const preferredRole = String(body?.primary_role ?? "").toLowerCase().trim();
  const role = uniqueRoles.includes(preferredRole) ? preferredRole : uniqueRoles[0];
  const student_id_input = body?.student_id ? String(body.student_id).trim() : null;

  const admin = supabaseAdmin();

  const authUpdates: { email?: string; password?: string } = {};
  if (email) authUpdates.email = email;
  if (password) authUpdates.password = password;
  if (Object.keys(authUpdates).length) {
    const { error: authErr } = await admin.auth.admin.updateUserById(user_id, authUpdates);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: 500 });
  }

  const { error: pErr } = await admin.from("profiles").upsert({
    user_id,
    email,
    username: username.toLowerCase(),
    role,
  });
  if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });

  let studentIdToKeep: string | null = student_id_input;
  if (!studentIdToKeep && uniqueRoles.includes("student")) {
    const { data: existingStudentRole } = await admin
      .from("user_roles")
      .select("student_id")
      .eq("user_id", user_id)
      .eq("role", "student")
      .maybeSingle();
    studentIdToKeep = String(existingStudentRole?.student_id ?? "").trim() || null;
  }

  const { error: clearErr } = await admin.from("user_roles").delete().eq("user_id", user_id);
  if (clearErr) return NextResponse.json({ ok: false, error: clearErr.message }, { status: 500 });

  const roleRows = uniqueRoles.map((r) => {
    if (r === "student" && studentIdToKeep) {
      return { user_id, role: r, student_id: studentIdToKeep };
    }
    return { user_id, role: r };
  });
  const { error: roleErr } = await admin.from("user_roles").insert(roleRows as any[]);
  if (roleErr) {
    const msg = String(roleErr.message ?? "");
    const singleRoleSchema =
      msg.includes("user_roles_pkey") ||
      msg.toLowerCase().includes("duplicate key value") ||
      msg.toLowerCase().includes("unique constraint");
    if (!singleRoleSchema || uniqueRoles.length <= 1) {
      return NextResponse.json({ ok: false, error: roleErr.message }, { status: 500 });
    }

    const fallbackRolePayload: any = { user_id, role };
    if (role === "student" && studentIdToKeep) fallbackRolePayload.student_id = studentIdToKeep;
    const { error: fallbackErr } = await admin.from("user_roles").upsert(fallbackRolePayload, { onConflict: "user_id" });
    if (fallbackErr) return NextResponse.json({ ok: false, error: fallbackErr.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      warning: "This database currently supports one role per user. Applied only the primary role.",
      applied_roles: [role],
      dropped_roles: uniqueRoles.filter((r) => r !== role),
    });
  }

  return NextResponse.json({ ok: true, applied_roles: uniqueRoles });
}

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ALLOWED_ROLES = new Set([
  "admin",
  "coach",
  "student",
  "parent",
  "classroom",
  "display",
  "skill_pulse",
  "camp",
  "coach-dashboard",
  "skill-tablet",
]);

function normalizeRole(value: any) {
  const role = String(value ?? "").trim().toLowerCase();
  if (!role) return null;
  return ALLOWED_ROLES.has(role) ? role : null;
}

function usernameFromEmail(email: string | null) {
  if (!email) return null;
  const base = email.split("@")[0] || "";
  return base ? base.toLowerCase().replace(/\s+/g, "_") : null;
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const admin = supabaseAdmin();
  const body = await req.json().catch(() => ({}));
  const requestedUsers: Array<{ user_id?: string; role?: string | null }> = Array.isArray(body?.users)
    ? body.users
    : [];
  const requestedIds = new Set(
    requestedUsers
      .map((u) => String(u?.user_id ?? "").trim())
      .filter(Boolean)
  );
  const requestedRoleMap = new Map<string, string>();
  for (const row of requestedUsers) {
    const id = String(row?.user_id ?? "").trim();
    if (!id) continue;
    const role = normalizeRole(row?.role);
    if (role) requestedRoleMap.set(id, role);
  }

  const allUsers: any[] = [];
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    const batch = data?.users ?? [];
    for (const user of batch) {
      if (requestedIds.size === 0 || requestedIds.has(String(user.id))) {
        allUsers.push(user);
      }
    }
    if (batch.length < perPage) break;
    page += 1;
  }

  if (requestedIds.size > 0 && allUsers.length === 0) {
    return NextResponse.json({ ok: false, error: "No matching users found" }, { status: 404 });
  }

  const ids = allUsers.map((u) => String(u.id));
  const profileMap = new Map<string, any>();
  const roleMap = new Map<string, string[]>();

  for (let i = 0; i < ids.length; i += 500) {
    const slice = ids.slice(i, i + 500);
    const { data: profiles, error: pErr } = await admin
      .from("profiles")
      .select("user_id,email,username,role")
      .in("user_id", slice);
    if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });
    (profiles ?? []).forEach((row) => profileMap.set(String(row.user_id), row));

    const { data: roles, error: rErr } = await admin
      .from("user_roles")
      .select("user_id,role")
      .in("user_id", slice);
    if (rErr) return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 });
    (roles ?? []).forEach((row) => {
      const key = String(row.user_id);
      const list = roleMap.get(key) ?? [];
      list.push(String(row.role));
      roleMap.set(key, list);
    });
  }

  let fixedProfiles = 0;
  let fixedRoles = 0;

  for (const u of allUsers) {
    const userId = String(u.id);
    const profile = profileMap.get(userId);
    const roles = roleMap.get(userId) ?? [];
    const selectedRole = requestedRoleMap.get(userId) || null;
    const metaRole = normalizeRole(u.user_metadata?.role ?? u.app_metadata?.role);
    const profileRole = normalizeRole(profile?.role);
    const roleFromRoles = normalizeRole(roles[0]);
    const resolvedRole = selectedRole || profileRole || roleFromRoles || metaRole || "coach";

    if (!profile) {
      const resolvedUsername =
        String(u.user_metadata?.username ?? "").trim() ||
        String(u.user_metadata?.display_name ?? "").trim().toLowerCase().replace(/\s+/g, "_") ||
        usernameFromEmail(u.email ?? null);
      const { error: pErr } = await admin.from("profiles").upsert({
        user_id: userId,
        email: u.email ?? null,
        username: resolvedUsername || null,
        role: resolvedRole,
      });
      if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });
      fixedProfiles += 1;
    }

    if (!roles.length) {
      const rolePayload: any = { user_id: userId, role: resolvedRole };
      if (resolvedRole === "student") {
        const studentId = profile?.student_id ?? u.user_metadata?.student_id ?? u.app_metadata?.student_id ?? null;
        if (studentId) rolePayload.student_id = String(studentId);
      }
      const { error: rErr } = await admin.from("user_roles").upsert(rolePayload, { onConflict: "user_id,role" });
      if (rErr) return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 });
      fixedRoles += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    fixed_profiles: fixedProfiles,
    fixed_roles: fixedRoles,
  });
}

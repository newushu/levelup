import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const admin = supabaseAdmin();
  const allUsers: any[] = [];
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    const batch = data?.users ?? [];
    allUsers.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }

  const authIds = new Set(allUsers.map((u) => String(u.id)));
  const profileIds = new Set<string>();
  const roleIds = new Set<string>();

  for (let i = 0; i < allUsers.length; i += 500) {
    const slice = allUsers.slice(i, i + 500).map((u) => String(u.id));
    const { data: profiles, error: pErr } = await admin
      .from("profiles")
      .select("user_id")
      .in("user_id", slice);
    if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });
    (profiles ?? []).forEach((row) => profileIds.add(String(row.user_id)));

    const { data: roles, error: rErr } = await admin
      .from("user_roles")
      .select("user_id")
      .in("user_id", slice);
    if (rErr) return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 });
    (roles ?? []).forEach((row) => roleIds.add(String(row.user_id)));
  }

  const missingProfiles = allUsers
    .filter((u) => !profileIds.has(String(u.id)))
    .map((u) => ({ user_id: u.id, email: u.email ?? null }));
  const missingRoles = allUsers
    .filter((u) => !roleIds.has(String(u.id)))
    .map((u) => ({ user_id: u.id, email: u.email ?? null }));

  const { data: allProfiles, error: allPErr } = await admin
    .from("profiles")
    .select("user_id,email");
  if (allPErr) return NextResponse.json({ ok: false, error: allPErr.message }, { status: 500 });
  const orphanProfiles = (allProfiles ?? [])
    .filter((p) => !authIds.has(String(p.user_id)))
    .map((p) => ({ user_id: p.user_id, email: p.email ?? null }));

  const { data: allRoles, error: allRErr } = await admin
    .from("user_roles")
    .select("user_id,role");
  if (allRErr) return NextResponse.json({ ok: false, error: allRErr.message }, { status: 500 });
  const orphanRoles = (allRoles ?? [])
    .filter((r) => !authIds.has(String(r.user_id)))
    .map((r) => ({ user_id: r.user_id, role: r.role }));

  return NextResponse.json({
    ok: true,
    totals: {
      auth_users: allUsers.length,
      missing_profiles: missingProfiles.length,
      missing_roles: missingRoles.length,
      orphan_profiles: orphanProfiles.length,
      orphan_roles: orphanRoles.length,
    },
    missing_profiles: missingProfiles,
    missing_roles: missingRoles,
    orphan_profiles: orphanProfiles,
    orphan_roles: orphanRoles,
  });
}

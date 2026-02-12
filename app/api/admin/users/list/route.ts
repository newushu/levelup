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

  const ids = allUsers.map((u) => u.id).filter(Boolean);
  const profileMap = new Map<string, any>();
  const roleMap = new Map<string, string[]>();

  for (let i = 0; i < ids.length; i += 500) {
    const slice = ids.slice(i, i + 500);
    const { data: profiles, error: pErr } = await admin
      .from("profiles")
      .select("user_id,email,username,role,created_at")
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

  const users = allUsers.map((u) => {
    const profile = profileMap.get(String(u.id));
    const roles = roleMap.get(String(u.id)) ?? [];
    return {
      user_id: u.id,
      email: profile?.email ?? u.email ?? null,
      username: profile?.username ?? u.user_metadata?.username ?? null,
      role: profile?.role ?? roles[0] ?? null,
      created_at: profile?.created_at ?? u.created_at ?? null,
    };
  });

  users.sort((a, b) => {
    const ra = String(a.role ?? "");
    const rb = String(b.role ?? "");
    if (ra !== rb) return ra.localeCompare(rb);
    return String(a.username ?? "").localeCompare(String(b.username ?? ""));
  });

  return NextResponse.json({ ok: true, users });
}

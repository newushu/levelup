import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: profiles, error: pErr } = await admin
    .from("profiles")
    .select("user_id,email,username,role")
    .order("username", { ascending: true });

  if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });

  const userIds = Array.from(new Set((profiles ?? []).map((row: any) => String(row.user_id ?? "")).filter(Boolean)));
  let rolesByUser = new Map<string, string[]>();
  if (userIds.length) {
    const { data: roleRows } = await admin
      .from("user_roles")
      .select("user_id,role")
      .in("user_id", userIds)
      .in("role", ["admin", "coach", "staff"]);
    const map = new Map<string, Set<string>>();
    (roleRows ?? []).forEach((row: any) => {
      const uid = String(row.user_id ?? "");
      const role = String(row.role ?? "").toLowerCase();
      if (!uid || !role) return;
      const set = map.get(uid) ?? new Set<string>();
      set.add(role);
      map.set(uid, set);
    });
    rolesByUser = new Map(Array.from(map.entries()).map(([uid, set]) => [uid, Array.from(set)]));
  }

  const staff = (profiles ?? [])
    .map((row: any) => {
      const uid = String(row.user_id ?? "");
      const profileRole = String(row.role ?? "").toLowerCase();
      const roles = rolesByUser.get(uid) ?? (profileRole ? [profileRole] : []);
      const uniqueRoles = Array.from(new Set(roles));
      const isCoach = uniqueRoles.includes("coach");
      const isAdmin = uniqueRoles.includes("admin");
      const isStaff = uniqueRoles.includes("staff") || isAdmin;
      if (!isCoach && !isStaff && !isAdmin) return null;
      const primaryRole = isCoach ? "coach" : isAdmin ? "admin" : "staff";
      return {
        user_id: uid,
        email: row.email ?? null,
        username: row.username ?? null,
        role: primaryRole,
        roles: uniqueRoles,
        is_coach: isCoach,
        is_staff: isStaff,
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => {
      const roleCmp = String(a.role).localeCompare(String(b.role));
      if (roleCmp !== 0) return roleCmp;
      return String(a.username ?? "").localeCompare(String(b.username ?? ""));
    });

  return NextResponse.json({ ok: true, staff });
}

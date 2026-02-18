import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const admin = supabaseAdmin();
  const [rostersRes, membersRes, studentsRes] = await Promise.all([
    admin
      .from("camp_display_rosters")
      .select("id,name,start_date,end_date,enabled,sort_order")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    admin
      .from("camp_display_members")
      .select("id,roster_id,student_id,secondary_role,secondary_role_days,enabled")
      .eq("enabled", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    admin.from("students").select("id,name"),
  ]);

  if (rostersRes.error) return NextResponse.json({ ok: false, error: rostersRes.error.message }, { status: 500 });
  if (membersRes.error) return NextResponse.json({ ok: false, error: membersRes.error.message }, { status: 500 });
  if (studentsRes.error) return NextResponse.json({ ok: false, error: studentsRes.error.message }, { status: 500 });

  const studentById = new Map((studentsRes.data ?? []).map((s: any) => [String(s.id ?? ""), String(s.name ?? "Student")]));
  const members = (membersRes.data ?? []).map((m: any) => ({
    id: String(m.id ?? ""),
    roster_id: String(m.roster_id ?? ""),
    student_id: String(m.student_id ?? ""),
    student_name: studentById.get(String(m.student_id ?? "")) ?? "Student",
    secondary_role: String(m.secondary_role ?? "").trim().toLowerCase(),
    secondary_role_days: Array.isArray(m.secondary_role_days) ? m.secondary_role_days : [],
  }));

  return NextResponse.json({
    ok: true,
    rosters: rostersRes.data ?? [],
    members,
  });
}


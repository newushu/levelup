import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const admin = supabaseAdmin();
  const { data: students, error } = await admin
    .from("students")
    .select("id,name,is_competition_team")
    .eq("is_competition_team", true)
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    count: (students ?? []).length,
    students: (students ?? []).map((s: any) => ({ id: s.id, name: s.name ?? "Student" })),
  });
}

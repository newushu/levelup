import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabase/server";

async function getUserScope() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { ok: false as const, error: "Not logged in" };

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role,student_id")
    .eq("user_id", u.user.id);

  if (error) return { ok: false as const, error: error.message };

  const roleList = (roles ?? []).map((r: any) => String(r.role ?? "").toLowerCase());
  const isAdmin = roleList.includes("admin");
  const isCoach = roleList.includes("coach");
  const studentId = String((roles ?? []).find((r: any) => String(r.role ?? "").toLowerCase() === "student")?.student_id ?? "");

  return { ok: true as const, isAdmin, isCoach, studentId };
}

export async function GET(req: Request) {
  const gate = await getUserScope();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const requestedId = String(searchParams.get("student_id") ?? "").trim();
  const studentId = gate.isAdmin || gate.isCoach ? requestedId : gate.studentId;
  if (!studentId) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: sessions, error: sErr } = await admin
    .from("taolu_sessions")
    .select("id")
    .eq("student_id", studentId);
  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });

  const sessionIds = (sessions ?? []).map((s) => s.id);
  if (!sessionIds.length) return NextResponse.json({ ok: true, counts: {} });

  const { data: deductions, error: dErr } = await admin
    .from("taolu_deductions")
    .select("code_id,session_id")
    .in("session_id", sessionIds);
  if (dErr) return NextResponse.json({ ok: false, error: dErr.message }, { status: 500 });

  const counts: Record<string, number> = {};
  (deductions ?? []).forEach((d: any) => {
    if (!d.code_id) return;
    const key = String(d.code_id);
    counts[key] = (counts[key] ?? 0) + 1;
  });

  return NextResponse.json({ ok: true, counts });
}

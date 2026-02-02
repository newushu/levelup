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

  return { ok: true as const, userId: u.user.id, isAdmin, isCoach, studentId };
}

export async function GET(req: Request) {
  const gate = await getUserScope();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const studentId = String(searchParams.get("student_id") ?? "").trim();
  if (!studentId) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });
  if (!gate.isAdmin && !gate.isCoach && gate.studentId !== studentId) {
    return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 403 });
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("student_stats")
    .select("stat_id,value,recorded_at")
    .eq("student_id", studentId)
    .order("recorded_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const latest: Record<string, any> = {};
  (data ?? []).forEach((row) => {
    if (!latest[row.stat_id]) latest[row.stat_id] = row;
  });

  return NextResponse.json({ ok: true, records: Object.values(latest) });
}

export async function POST(req: Request) {
  const gate = await getUserScope();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  if (!gate.isAdmin && !gate.isCoach) {
    return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  const stat_id = String(body?.stat_id ?? "").trim();
  const value = Number(body?.value);

  if (!student_id || !stat_id) {
    return NextResponse.json({ ok: false, error: "Missing student_id or stat_id" }, { status: 400 });
  }
  if (Number.isNaN(value)) {
    return NextResponse.json({ ok: false, error: "Value must be numeric" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("student_stats")
    .insert({
      student_id,
      stat_id,
      value,
      recorded_by: gate.userId,
    })
    .select("stat_id,value,recorded_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, record: data });
}

export async function DELETE(req: Request) {
  const gate = await getUserScope();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  if (!gate.isAdmin) {
    return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  const stat_id = String(body?.stat_id ?? "").trim();

  if (!student_id || !stat_id) {
    return NextResponse.json({ ok: false, error: "Missing student_id or stat_id" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: latest, error: latestErr } = await admin
    .from("student_stats")
    .select("id")
    .eq("student_id", student_id)
    .eq("stat_id", stat_id)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestErr) return NextResponse.json({ ok: false, error: latestErr.message }, { status: 500 });
  if (!latest?.id) return NextResponse.json({ ok: false, error: "No record found" }, { status: 404 });

  const { error } = await admin
    .from("student_stats")
    .delete()
    .eq("id", latest.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

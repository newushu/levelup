import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabase/server";

async function getUserScope() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { ok: false as const, error: "Not logged in" };

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id);

  if (error) return { ok: false as const, error: error.message };

  const roleList = (roles ?? []).map((r: any) => String(r.role ?? "").toLowerCase());
  const isAdmin = roleList.includes("admin");
  const isCoach = roleList.includes("coach");

  return { ok: true as const, userId: u.user.id, isAdmin, isCoach };
}

export async function GET() {
  const gate = await getUserScope();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  if (!gate.isAdmin && !gate.isCoach) {
    return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("performance_lab_sessions")
    .select("id,label,student_ids,stat_ids,created_at,updated_at,created_by")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, sessions: data ?? [] });
}

export async function POST(req: Request) {
  const gate = await getUserScope();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  if (!gate.isAdmin && !gate.isCoach) {
    return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  const label = String(body?.label ?? "").trim();
  const student_ids = Array.isArray(body?.student_ids) ? body.student_ids.map((v: any) => String(v)) : [];
  const stat_ids = Array.isArray(body?.stat_ids) ? body.stat_ids.map((v: any) => String(v)) : [];

  if (!label || !student_ids.length || !stat_ids.length) {
    return NextResponse.json({ ok: false, error: "Missing label, student_ids, or stat_ids" }, { status: 400 });
  }

  const payload = {
    id: id || undefined,
    label,
    student_ids,
    stat_ids,
    created_by: gate.userId,
    updated_at: new Date().toISOString(),
  };

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("performance_lab_sessions")
    .upsert(payload, { onConflict: "id" })
    .select("id,label,student_ids,stat_ids,created_at,updated_at,created_by")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, session: data });
}

export async function DELETE(req: Request) {
  const gate = await getUserScope();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  if (!gate.isAdmin && !gate.isCoach) {
    return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

  const admin = supabaseAdmin();
  const { error } = await admin.from("performance_lab_sessions").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

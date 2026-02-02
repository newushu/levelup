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

export async function POST(req: Request) {
  const gate = await getUserScope();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  if (!gate.isAdmin && !gate.isCoach) {
    return NextResponse.json({ ok: false, error: "Coach access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const taolu_form_id = String(body?.taolu_form_id ?? "").trim();
  const student_ids = Array.isArray(body?.student_ids) ? body.student_ids : [];

  if (!taolu_form_id) return NextResponse.json({ ok: false, error: "Missing taolu_form_id" }, { status: 400 });
  if (!student_ids.length) return NextResponse.json({ ok: false, error: "Missing student_ids" }, { status: 400 });

  const rows = student_ids.map((student_id: string) => ({
    student_id,
    taolu_form_id,
    coach_user_id: gate.userId,
  }));

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("preps_sessions")
    .insert(rows)
    .select("id,student_id,taolu_form_id,created_at,ended_at");

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, sessions: data ?? [] });
}

export async function GET(req: Request) {
  const gate = await getUserScope();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  if (!gate.isAdmin && !gate.isCoach) {
    return NextResponse.json({ ok: false, error: "Coach access required" }, { status: 403 });
  }

  const admin = supabaseAdmin();
  const url = new URL(req.url);
  const status = String(url.searchParams.get("status") ?? "active").toLowerCase();
  let query = admin
    .from("preps_sessions")
    .select("id,student_id,taolu_form_id,created_at,ended_at")
    .order("created_at", { ascending: false });
  if (status === "active") {
    query = query.is("ended_at", null);
  } else if (status === "ended") {
    query = query.not("ended_at", "is", null);
  }
  const { data, error } = await query;

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, sessions: data ?? [] });
}

export async function DELETE(req: Request) {
  const gate = await getUserScope();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  if (!gate.isAdmin && !gate.isCoach) {
    return NextResponse.json({ ok: false, error: "Coach access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const session_id = String(body?.session_id ?? "").trim();
  if (!session_id) return NextResponse.json({ ok: false, error: "Missing session_id" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("preps_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", session_id)
    .is("ended_at", null)
    .select("id,student_id,taolu_form_id,created_at,ended_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, session: data });
}

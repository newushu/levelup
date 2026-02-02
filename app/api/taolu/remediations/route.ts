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

export async function GET(req: Request) {
  const gate = await getUserScope();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  if (!gate.isAdmin && !gate.isCoach) {
    return NextResponse.json({ ok: false, error: "Coach access required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const sessionId = String(searchParams.get("session_id") ?? "").trim();
  if (!sessionId) return NextResponse.json({ ok: false, error: "Missing session_id" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("taolu_remediations")
    .select("session_id,points_awarded,deduction_ids,completed_at")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, remediation: data ?? null });
}

export async function POST(req: Request) {
  const gate = await getUserScope();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  if (!gate.isAdmin && !gate.isCoach) {
    return NextResponse.json({ ok: false, error: "Coach access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const session_id = String(body?.session_id ?? "").trim();
  const deduction_ids = Array.isArray(body?.deduction_ids) ? body.deduction_ids.map(String) : [];
  if (!session_id) return NextResponse.json({ ok: false, error: "Missing session_id" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: prior } = await admin
    .from("taolu_remediations")
    .select("id")
    .eq("session_id", session_id)
    .limit(1);
  if (prior?.length) {
    return NextResponse.json({ ok: false, error: "Refinement round already completed" }, { status: 400 });
  }

  const { data: session, error: sErr } = await admin
    .from("taolu_sessions")
    .select("id,student_id,taolu_form_id")
    .eq("id", session_id)
    .maybeSingle();
  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });
  if (!session) return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });

  const pointsAwarded = deduction_ids.length;
  const { data: remediation, error } = await admin
    .from("taolu_remediations")
    .insert({
      session_id,
      student_id: session.student_id,
      taolu_form_id: session.taolu_form_id,
      deduction_ids,
      points_awarded: pointsAwarded,
      completed_at: new Date().toISOString(),
      created_by: gate.userId,
    })
    .select("session_id,points_awarded,deduction_ids,completed_at,id")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const { data: form } = await admin
    .from("iwuf_taolu_forms")
    .select("name")
    .eq("id", session.taolu_form_id)
    .maybeSingle();
  const formName = String(form?.name ?? "Taolu");
  const note = `Taolu Tracker • Refinement Round • ${formName}`;
  const { error: ledErr } = await admin.from("ledger").insert({
    student_id: session.student_id,
    points: pointsAwarded,
    note: note.slice(0, 200),
    category: "taolu_tracker_remediation",
    source_id: remediation.id,
    source_type: "taolu_remediation",
    created_by: gate.userId,
  });
  if (ledErr) return NextResponse.json({ ok: false, error: ledErr.message }, { status: 500 });

  const rpc = await admin.rpc("recompute_student_points", { p_student_id: session.student_id });
  if (rpc.error) return NextResponse.json({ ok: false, error: rpc.error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    remediation: {
      session_id: remediation.session_id,
      points_awarded: remediation.points_awarded,
      deduction_ids: remediation.deduction_ids,
      completed_at: remediation.completed_at,
    },
  });
}

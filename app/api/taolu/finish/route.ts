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
  const session_id = String(body?.session_id ?? "").trim();
  if (!session_id) return NextResponse.json({ ok: false, error: "Missing session_id" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: session, error: sErr } = await admin
    .from("taolu_sessions")
    .select("id,student_id,taolu_form_id,sections,ended_at")
    .eq("id", session_id)
    .maybeSingle();

  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });
  if (!session) return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });

  const { data: deductions, error: dErr } = await admin
    .from("taolu_deductions")
    .select("id,voided")
    .eq("session_id", session_id);
  if (dErr) return NextResponse.json({ ok: false, error: dErr.message }, { status: 500 });

  const liveCount = (deductions ?? []).filter((d: any) => !d.voided).length;
  const pointsLost = liveCount * 4;
  const pointsEarned = 10 - pointsLost;

  const { data: form } = await admin
    .from("iwuf_taolu_forms")
    .select("name")
    .eq("id", session.taolu_form_id)
    .maybeSingle();
  const formName = String(form?.name ?? "Taolu");

  const { data: prior } = await admin
    .from("ledger")
    .select("id")
    .eq("source_type", "taolu_tracker")
    .eq("source_id", session_id)
    .limit(1);

  if (!prior?.length) {
    const note = `Taolu Tracker • ${formName} • ${liveCount} deductions`;
    const { error: ledErr } = await admin.from("ledger").insert({
      student_id: session.student_id,
      points: pointsEarned,
      note: note.slice(0, 200),
      category: "taolu_tracker",
      source_id: session_id,
      source_type: "taolu_tracker",
      created_by: gate.userId,
    });
    if (ledErr) return NextResponse.json({ ok: false, error: ledErr.message }, { status: 500 });

    const rpc = await admin.rpc("recompute_student_points", { p_student_id: session.student_id });
    if (rpc.error) return NextResponse.json({ ok: false, error: rpc.error.message }, { status: 500 });
  }

  if (!session.ended_at) {
    const { error: updErr } = await admin
      .from("taolu_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", session_id)
      .is("ended_at", null);
    if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    session,
    deductions_count: liveCount,
    points_lost: pointsLost,
    points_earned: pointsEarned,
  });
}

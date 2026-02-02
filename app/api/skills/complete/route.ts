import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  const skill_id = String(body?.skill_id ?? "").trim();

  if (!student_id || !skill_id) {
    return NextResponse.json({ ok: false, error: "Missing student_id or skill_id" }, { status: 400 });
  }

  // 1) load skill points
  const { data: sk, error: skErr } = await supabase
    .from("skills")
    .select("id,name,points_award,points,set_name,category")
    .eq("id", skill_id)
    .maybeSingle();

  if (skErr) return NextResponse.json({ ok: false, error: skErr.message }, { status: 500 });
  if (!sk) return NextResponse.json({ ok: false, error: "Skill not found" }, { status: 404 });

  const pts = Number(sk.points_award ?? sk.points ?? 0) || 0;

  // 2) mark skill complete (idempotent) without double-awarding
  // Ensure you have UNIQUE(student_id, skill_id) on student_skills.
  const ins = await supabase
    .from("student_skills")
    .insert(
      {
        student_id,
        skill_id,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "student_id,skill_id", ignoreDuplicates: true }
    )
    .select("student_id");

  if (ins.error) return NextResponse.json({ ok: false, error: ins.error.message }, { status: 500 });
  if (!ins.data || ins.data.length === 0) {
    return NextResponse.json({ ok: true, already: true, awarded_points: 0 });
  }

  // 3) ledger points (+)
  if (pts !== 0) {
    const led = await supabase.from("ledger").insert({
      student_id,
      points: pts,
      category: "skill_complete",
      note: `Skill: ${sk.name ?? skill_id}`,
      source_type: "skill",
      source_id: skill_id,
      created_by: u.user.id,
    });

    if (led.error) return NextResponse.json({ ok: false, error: led.error.message }, { status: 500 });
  }

  // 4) recompute
  const rpc = await supabase.rpc("recompute_student_points", { p_student_id: student_id });
  if (rpc.error) return NextResponse.json({ ok: false, error: rpc.error.message }, { status: 500 });

  return NextResponse.json({ ok: true, awarded_points: pts });
}

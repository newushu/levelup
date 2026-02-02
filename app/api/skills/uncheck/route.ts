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

  // Root skill
  const { data: root, error: rErr } = await supabase
    .from("skills")
    .select("id,name,set_name,level")
    .eq("id", skill_id)
    .maybeSingle();

  if (rErr) return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 });
  if (!root) return NextResponse.json({ ok: false, error: "Skill not found" }, { status: 404 });

  const setName = String(root.set_name ?? "").trim();
  const rootLevel = Number(root.level ?? 0);

  // Skills in same set at >= root level (simple downstream rule)
  const { data: setSkills, error: sErr } = await supabase
    .from("skills")
    .select("id,name,level,points_award,points")
    .eq("set_name", setName);

  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });

  const candidateIds = (setSkills ?? [])
    .filter((s) => Number(s.level ?? 0) >= rootLevel)
    .map((s) => String(s.id));

  if (!candidateIds.length) {
    return NextResponse.json({ ok: true, removed: [], removed_points: 0 });
  }

  // Completed rows for this student among candidates
  const { data: doneRows, error: dErr } = await supabase
    .from("student_skills")
    .select("skill_id")
    .eq("student_id", student_id)
    .in("skill_id", candidateIds);

  if (dErr) return NextResponse.json({ ok: false, error: dErr.message }, { status: 500 });

  const doneSet = new Set((doneRows ?? []).map((r) => String(r.skill_id)));

  // Only remove completed ones, but always include root if completed
  const toRemove = candidateIds.filter((id) => doneSet.has(id));

  if (!toRemove.length) {
    return NextResponse.json({ ok: true, removed: [], removed_points: 0 });
  }

  // Compute total points removed
  const byId = new Map<string, any>();
  (setSkills ?? []).forEach((s) => byId.set(String(s.id), s));

  const removedPoints = toRemove.reduce((sum, id) => {
    const sk = byId.get(id);
    const pts = Number(sk?.points_award ?? sk?.points ?? 0) || 0;
    return sum + pts;
  }, 0);

  // Delete student_skills rows
  const del = await supabase.from("student_skills").delete().eq("student_id", student_id).in("skill_id", toRemove);
  if (del.error) return NextResponse.json({ ok: false, error: del.error.message }, { status: 500 });

  // Ledger negative entry (reduces balance; lifetime should not decrease if you compute lifetime from positives)
  if (removedPoints !== 0) {
    const led = await supabase.from("ledger").insert({
      student_id,
      points: -Math.abs(removedPoints),
      category: "skill_uncheck",
      note: `Uncheck skill(s): ${toRemove.length} (from ${root.name ?? root.id})`,
      source_type: "skill_uncheck",
      source_id: root.id,
      created_by: u.user.id,
    });
    if (led.error) return NextResponse.json({ ok: false, error: led.error.message }, { status: 500 });
  }

  const rpc = await supabase.rpc("recompute_student_points", { p_student_id: student_id });
  if (rpc.error) return NextResponse.json({ ok: false, error: rpc.error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    removed: toRemove,
    removed_points: removedPoints,
  });
}

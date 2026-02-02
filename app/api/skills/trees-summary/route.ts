import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();

  if (!student_id) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });

  // Load enabled skills (id, set_name)
  const { data: skills, error: sErr } = await supabase
    .from("skills")
    .select("id,set_name,set_id,enabled")
    .eq("enabled", true);

  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });

  // Load completed skills for student
  const { data: done, error: dErr } = await supabase
    .from("student_skills")
    .select("skill_id")
    .eq("student_id", student_id);

  if (dErr) return NextResponse.json({ ok: false, error: dErr.message }, { status: 500 });

  const doneSet = new Set((done ?? []).map((r: any) => String(r.skill_id)));

  // Group skills into sets (prefer set_name, then set_id, else Unsorted)
  const sets = new Map<string, string[]>();
  for (const row of skills ?? []) {
    const setKey = String(row?.set_name ?? row?.set_id ?? "Unsorted");
    if (!sets.has(setKey)) sets.set(setKey, []);
    sets.get(setKey)!.push(String(row.id));
  }

  const totalTrees = sets.size;
  let completedTrees = 0;

  for (const [, ids] of sets.entries()) {
    if (ids.length > 0 && ids.every((id) => doneSet.has(id))) completedTrees += 1;
  }

  return NextResponse.json({ ok: true, completedTrees, totalTrees });
}

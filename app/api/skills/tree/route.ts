import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

type SkillSetRow = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  enabled: boolean;
};

type SkillRow = {
  id: string;
  set_id: string;
  name: string;
  description: string | null;
  level: number;
  sort_in_level: number;
  points: number;
  enabled: boolean;
};

type CompletionRow = {
  skill_id: string;
  completed_at: string;
  completed_by: string;
};

export async function POST(req: Request) {
  const supabase = await supabaseServer();

  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  if (!student_id) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });

  // 1) Sets
  const setsRes = await supabase
    .from("skill_sets")
    .select("id,name,category,description,enabled")
    .eq("enabled", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (setsRes.error) return NextResponse.json({ ok: false, error: setsRes.error.message }, { status: 500 });
  const sets = (setsRes.data ?? []) as SkillSetRow[];

  // 2) Skills
  const skillsRes = await supabase
    .from("skills")
    .select("id,set_id,name,description,level,sort_in_level,points,enabled")
    .eq("enabled", true)
    .order("set_id", { ascending: true })
    .order("level", { ascending: true })
    .order("sort_in_level", { ascending: true })
    .order("name", { ascending: true });

  if (skillsRes.error) return NextResponse.json({ ok: false, error: skillsRes.error.message }, { status: 500 });
  const skills = (skillsRes.data ?? []) as SkillRow[];

  // 3) Completions for student
  const compRes = await supabase
    .from("student_skill_completions")
    .select("skill_id,completed_at,completed_by")
    .eq("student_id", student_id);

  if (compRes.error) return NextResponse.json({ ok: false, error: compRes.error.message }, { status: 500 });
  const completions = (compRes.data ?? []) as CompletionRow[];

  // Build completion set for fast lookup
  const completedSet = new Set<string>(completions.map((c) => c.skill_id));

  // Summary per set + totals
  const totalSkillsBySet: Record<string, number> = {};
  const completedSkillsBySet: Record<string, number> = {};
  const pointsTotalBySet: Record<string, number> = {};
  const pointsCompletedBySet: Record<string, number> = {};

  for (const sk of skills) {
    totalSkillsBySet[sk.set_id] = (totalSkillsBySet[sk.set_id] ?? 0) + 1;
    pointsTotalBySet[sk.set_id] = (pointsTotalBySet[sk.set_id] ?? 0) + (Number(sk.points) || 0);

    if (completedSet.has(sk.id)) {
      completedSkillsBySet[sk.set_id] = (completedSkillsBySet[sk.set_id] ?? 0) + 1;
      pointsCompletedBySet[sk.set_id] = (pointsCompletedBySet[sk.set_id] ?? 0) + (Number(sk.points) || 0);
    }
  }

  let setsCompleted = 0;
  sets.forEach((s) => {
    const total = totalSkillsBySet[s.id] ?? 0;
    const done = completedSkillsBySet[s.id] ?? 0;
    if (total > 0 && done === total) setsCompleted += 1;
  });

  const summary = {
    skills_completed: completions.length,
    sets_completed: setsCompleted,
    total_sets: sets.length,
    per_set: sets.map((s) => ({
      set_id: s.id,
      total_skills: totalSkillsBySet[s.id] ?? 0,
      completed_skills: completedSkillsBySet[s.id] ?? 0,
      points_total: pointsTotalBySet[s.id] ?? 0,
      points_completed: pointsCompletedBySet[s.id] ?? 0,
    })),
  };

  return NextResponse.json({ ok: true, sets, skills, completions, summary });
}

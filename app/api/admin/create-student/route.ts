import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/authz";
import { supabaseAdmin } from "../../../../lib/supabase/admin";

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: 403 });

  const { name, age, rank, is_competition_team, level } = await req.json();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const admin = supabaseAdmin();

  const { data, error } = await admin
    .from("students")
    .insert({
      name,
      age: age ?? null,
      rank: rank ?? null,
      is_competition_team: !!is_competition_team,
      level: level ?? 1,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, student: data });
}

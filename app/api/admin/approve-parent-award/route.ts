import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/authz";
import { supabaseAdmin } from "../../../../lib/supabase/admin";

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: 403 });

  const { award_id } = await req.json();
  if (!award_id) return NextResponse.json({ error: "award_id required" }, { status: 400 });

  const admin = supabaseAdmin();

  const { data: award, error: aErr } = await admin
    .from("parent_weekly_awards")
    .select("id,parent_id,student_id,points,week_start,note")
    .eq("id", award_id)
    .single();

  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });

  // Create ledger entry
  const { error: lErr } = await admin.from("ledger_entries").insert({
    student_id: award.student_id,
    category: "achievement",
    points: award.points,
    note: `Parent weekly award (${award.week_start}): ${award.note ?? ""}`.trim(),
    source_type: "parent_weekly_award",
    source_id: award.id,
    created_by: gate.user.id,
  });

  if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

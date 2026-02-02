import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const student_id_a = String(body?.student_id_a ?? "").trim();
  const student_id_b = String(body?.student_id_b ?? "").trim();
  const relationship_type = String(body?.relationship_type ?? "sibling").trim() || "sibling";

  if (!student_id_a || !student_id_b) {
    return NextResponse.json({ ok: false, error: "student_id_a and student_id_b required" }, { status: 400 });
  }
  if (student_id_a === student_id_b) {
    return NextResponse.json({ ok: false, error: "Students must be different" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: existing } = await admin
    .from("parent_relationships")
    .select("id")
    .or(
      `and(student_id_a.eq.${student_id_a},student_id_b.eq.${student_id_b}),and(student_id_a.eq.${student_id_b},student_id_b.eq.${student_id_a})`
    )
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await admin
      .from("parent_relationships")
      .update({ relationship_type })
      .eq("id", existing.id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    await admin.from("parent_pairing_events").insert({
      event_type: "student_relationship_updated",
      student_id: student_id_a,
      student_id_b: student_id_b,
      relationship_type,
      actor_user_id: gate.user.id,
    });
    return NextResponse.json({ ok: true, updated: true });
  }

  const { error } = await admin.from("parent_relationships").insert({
    student_id_a,
    student_id_b,
    relationship_type,
    created_by_parent_id: null,
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  await admin.from("parent_pairing_events").insert({
    event_type: "student_relationship_created",
    student_id: student_id_a,
    student_id_b: student_id_b,
    relationship_type,
    actor_user_id: gate.user.id,
  });

  return NextResponse.json({ ok: true, created: true });
}

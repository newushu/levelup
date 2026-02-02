import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parent_id = String(body?.parent_id ?? "").trim();
  const student_id = String(body?.student_id ?? "").trim();
  const relationship_type = String(body?.relationship_type ?? "parent").trim().toLowerCase() || "parent";

  if (!parent_id || !student_id) {
    return NextResponse.json({ ok: false, error: "parent_id and student_id required" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { error } = await admin
    .from("parent_students")
    .update({ relationship_type })
    .eq("parent_id", parent_id)
    .eq("student_id", student_id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  await admin.from("parent_pairing_events").insert({
    event_type: "relationship_updated",
    parent_id,
    student_id,
    relationship_type,
    actor_user_id: gate.user.id,
  });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parent_id = String(body?.parent_id ?? "").trim();
  const student_id = String(body?.student_id ?? "").trim();

  if (!parent_id) return NextResponse.json({ ok: false, error: "parent_id required" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: parent } = await admin
    .from("parents")
    .select("id,auth_user_id")
    .eq("id", parent_id)
    .maybeSingle();
  let query = admin.from("parent_students").delete().eq("parent_id", parent_id);
  if (student_id) query = query.eq("student_id", student_id);
  const { error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  await admin.from("parent_pairing_events").insert({
    event_type: "unpaired",
    parent_id,
    student_id: student_id || null,
    actor_user_id: gate.user.id,
  });

  if (parent?.auth_user_id) {
    await admin
      .from("parent_requests")
      .update({ status: "unpaired" })
      .eq("auth_user_id", parent.auth_user_id)
      .eq("status", "paired");
  }

  return NextResponse.json({ ok: true });
}

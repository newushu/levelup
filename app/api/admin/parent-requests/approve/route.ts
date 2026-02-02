import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const request_id = String(body?.request_id ?? "").trim();
  const student_ids: string[] = Array.isArray(body?.student_ids)
    ? body.student_ids.map((id: any) => String(id))
    : [];
  const relationship_types: Record<string, string> =
    body?.relationship_types && typeof body.relationship_types === "object"
      ? (body.relationship_types as Record<string, string>)
      : {};
  const uniqueStudentIds: string[] = Array.from(new Set(student_ids)).filter(Boolean);

  if (!request_id || !uniqueStudentIds.length) {
    return NextResponse.json({ ok: false, error: "request_id and student_ids required" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: request, error: rErr } = await admin
    .from("parent_requests")
    .select("id,auth_user_id,email,status")
    .eq("id", request_id)
    .maybeSingle();
  if (rErr) return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 });
  if (!request?.id) return NextResponse.json({ ok: false, error: "Request not found" }, { status: 404 });

  const { data: parent, error: pErr } = await admin
    .from("parents")
    .select("id")
    .eq("auth_user_id", request.auth_user_id)
    .maybeSingle();
  if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });
  if (!parent?.id) return NextResponse.json({ ok: false, error: "Parent not found for this request" }, { status: 404 });

  const links = uniqueStudentIds.map((student_id) => ({
    parent_id: parent.id,
    student_id,
    relationship_type: String(relationship_types[student_id] ?? "parent").toLowerCase() || "parent",
  }));
  const { error: lErr } = await admin.from("parent_students").upsert(links, { onConflict: "parent_id,student_id" });
  if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });

  const events = links.map((link) => ({
    event_type: "paired",
    parent_id: parent.id,
    student_id: link.student_id,
    relationship_type: link.relationship_type,
    actor_user_id: gate.user.id,
  }));
  await admin.from("parent_pairing_events").insert(events);

  const { error: uErr } = await admin
    .from("parent_requests")
    .update({ status: "paired", approved_at: new Date().toISOString() })
    .eq("id", request_id);
  if (uErr) return NextResponse.json({ ok: false, error: uErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

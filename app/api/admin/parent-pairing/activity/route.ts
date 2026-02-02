import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: events, error } = await admin
    .from("parent_pairing_events")
    .select("id,event_type,parent_id,student_id,student_id_b,relationship_type,actor_user_id,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const parentIds = Array.from(new Set((events ?? []).map((e: any) => String(e.parent_id ?? "")).filter(Boolean)));
  const studentIds = Array.from(
    new Set(
      (events ?? [])
        .flatMap((e: any) => [String(e.student_id ?? ""), String(e.student_id_b ?? "")])
        .filter(Boolean)
    )
  );
  const actorIds = Array.from(new Set((events ?? []).map((e: any) => String(e.actor_user_id ?? "")).filter(Boolean)));

  const { data: parents } = parentIds.length
    ? await admin.from("parents").select("id,name,email").in("id", parentIds)
    : { data: [] };
  const { data: students } = studentIds.length
    ? await admin.from("students").select("id,name").in("id", studentIds)
    : { data: [] };
  const { data: profiles } = actorIds.length
    ? await admin.from("profiles").select("user_id,username,email").in("user_id", actorIds)
    : { data: [] };

  const parentById = new Map((parents ?? []).map((p: any) => [String(p.id), p]));
  const studentById = new Map((students ?? []).map((s: any) => [String(s.id), s]));
  const profileById = new Map((profiles ?? []).map((p: any) => [String(p.user_id), p]));

  const enriched = (events ?? []).map((e: any) => ({
    ...e,
    parent: parentById.get(String(e.parent_id)) ?? null,
    student: studentById.get(String(e.student_id)) ?? null,
    student_b: studentById.get(String(e.student_id_b)) ?? null,
    actor: profileById.get(String(e.actor_user_id)) ?? null,
  }));

  return NextResponse.json({ ok: true, events: enriched });
}

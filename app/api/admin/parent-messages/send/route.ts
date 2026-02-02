import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parent_id = String(body?.parent_id ?? "").trim();
  const message = String(body?.body ?? "").trim();
  const thread_key = String(body?.thread_key ?? "general").trim().toLowerCase() || "general";
  const student_id = String(body?.student_id ?? "").trim();

  if (!parent_id || !message) {
    return NextResponse.json({ ok: false, error: "parent_id and body required" }, { status: 400 });
  }

  const coachIdFromThread = thread_key.startsWith("coach:") ? thread_key.split("coach:")[1] || "" : "";

  const admin = supabaseAdmin();
  const { error } = await admin.from("parent_messages").insert({
    parent_id,
    body: message,
    is_from_admin: true,
    admin_user_id: gate.user.id,
    thread_key,
    coach_user_id: coachIdFromThread || null,
    student_id: student_id || null,
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

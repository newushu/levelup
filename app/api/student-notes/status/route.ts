import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function requireRole(roleSet: string[]) {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error) return { ok: false as const, error: error.message };
  const user = data?.user ?? null;
  if (!user) return { ok: false as const, error: "Not authenticated" };

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const hasRole = (roles ?? []).some((r: any) => roleSet.includes(String(r.role ?? "").toLowerCase()));
  if (!hasRole) return { ok: false as const, error: "Forbidden" };
  return { ok: true as const, user, supabase };
}

export async function PATCH(req: Request) {
  const gate = await requireRole(["admin", "coach"]);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  const { supabase, user } = gate;

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  const status = String(body?.status ?? "").trim().toLowerCase();

  if (!id || (status !== "open" && status !== "done")) {
    return NextResponse.json({ ok: false, error: "id and status are required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const updates =
    status === "done"
      ? { status, completed_by: user.id, completed_at: now }
      : { status, completed_by: null, completed_at: null };

  const { data, error } = await supabase
    .from("student_notes")
    .update(updates)
    .eq("id", id)
    .select("id,status,completed_by,completed_at,created_at,student_id,body,category")
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  if (data && status === "done" && String(data.category ?? "").toLowerCase() === "todo") {
    await notifyParents({
      student_id: String(data.student_id ?? ""),
      body: String(data.body ?? ""),
      admin_user_id: user.id,
      note_id: String(data.id ?? ""),
    });
  }

  return NextResponse.json({ ok: true, note: data });
}

async function notifyParents(payload: { student_id: string; body: string; admin_user_id: string; note_id?: string }) {
  if (!payload.student_id) return;
  const admin = supabaseAdmin();
  const { data: links, error } = await admin
    .from("parent_students")
    .select("parent_id")
    .eq("student_id", payload.student_id);
  if (error || !links?.length) return;

  const { data: student } = await admin
    .from("students")
    .select("name")
    .eq("id", payload.student_id)
    .maybeSingle();
  const studentName = student?.name ?? "Student";
  const message = `Coach To-Do completed for ${studentName}: ${payload.body}`;

  await admin.from("parent_messages").insert(
    (links ?? []).map((row: any) => ({
      parent_id: row.parent_id,
      body: message,
      is_from_admin: true,
      admin_user_id: payload.admin_user_id,
      thread_key: "coach_todos",
      student_id: payload.student_id,
      note_id: payload.note_id || null,
    }))
  );
}

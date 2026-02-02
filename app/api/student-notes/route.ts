import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const URGENCY = new Set(["low", "medium", "high", "critical"]);
const CATEGORY = new Set(["note", "todo"]);
const STATUS = new Set(["open", "done", "all"]);

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

export async function GET(req: Request) {
  const gate = await requireRole(["admin", "coach"]);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  const { supabase } = gate;

  const url = new URL(req.url);
  const studentId = String(url.searchParams.get("student_id") ?? "").trim();
  const category = String(url.searchParams.get("category") ?? "").trim().toLowerCase();
  const status = String(url.searchParams.get("status") ?? "all").trim().toLowerCase();
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") ?? 50)));

  let query = supabase
    .from("student_notes")
    .select("id,student_id,body,category,urgency,status,created_by,created_at,completed_by,completed_at,students(name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (studentId) query = query.eq("student_id", studentId);
  if (category && CATEGORY.has(category)) query = query.eq("category", category);
  if (STATUS.has(status) && status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const rows =
    (data ?? []).map((row: any) => ({
      id: row.id,
      student_id: row.student_id,
      student_name: row.students?.name ?? "Student",
      body: row.body,
      category: row.category,
      urgency: row.urgency,
      status: row.status,
      created_by: row.created_by,
      created_at: row.created_at,
      completed_by: row.completed_by ?? null,
      completed_at: row.completed_at ?? null,
    })) ?? [];

  return NextResponse.json({ ok: true, notes: rows });
}

export async function POST(req: Request) {
  const gate = await requireRole(["admin", "coach"]);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  const { supabase, user } = gate;

  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  const noteBody = String(body?.body ?? "").trim();
  const category = String(body?.category ?? "note").toLowerCase();
  const urgency = String(body?.urgency ?? "medium").toLowerCase();

  if (!student_id || !noteBody) {
    return NextResponse.json({ ok: false, error: "student_id and body are required" }, { status: 400 });
  }
  if (!CATEGORY.has(category)) {
    return NextResponse.json({ ok: false, error: "Invalid category" }, { status: 400 });
  }
  if (!URGENCY.has(urgency)) {
    return NextResponse.json({ ok: false, error: "Invalid urgency" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("student_notes")
    .insert({
      student_id,
      body: noteBody,
      category,
      urgency,
      status: "open",
      created_by: user.id,
    })
    .select("id,student_id,body,category,urgency,status,created_at")
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  await notifyParents({
    student_id,
    body: noteBody,
    category,
    admin_user_id: user.id,
    note_id: String(data?.id ?? ""),
  });

  return NextResponse.json({ ok: true, note: data });
}

async function notifyParents(payload: { student_id: string; body: string; category: string; admin_user_id: string; note_id?: string }) {
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
  const threadKey = payload.category === "todo" ? "coach_todos" : "coach_notes";
  const prefix = payload.category === "todo" ? "Coach To-Do" : "Important Coach Note";
  const message = `${prefix} for ${studentName}: ${payload.body}`;

  await admin.from("parent_messages").insert(
    (links ?? []).map((row: any) => ({
      parent_id: row.parent_id,
      body: message,
      is_from_admin: true,
      admin_user_id: payload.admin_user_id,
      thread_key: threadKey,
      student_id: payload.student_id,
      note_id: payload.note_id || null,
    }))
  );
}

export async function DELETE(req: Request) {
  const gate = await requireRole(["admin"]);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  const { supabase } = gate;

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });

  const { error } = await supabase.from("student_notes").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

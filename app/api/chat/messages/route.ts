import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

async function getUserScope(supabase: Awaited<ReturnType<typeof supabaseServer>>) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { ok: false as const, error: "Not logged in" };

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role,student_id")
    .eq("user_id", u.user.id);
  if (error) return { ok: false as const, error: error.message };

  const isStudent = (roles ?? []).some((r) => String(r.role ?? "").toLowerCase() === "student");
  const studentId = isStudent
    ? String((roles ?? []).find((r) => String(r.role ?? "").toLowerCase() === "student")?.student_id ?? "")
    : "";

  return { ok: true as const, isStudent, studentId };
}

export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const scope = await getUserScope(supabase);
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: 401 });

  const url = new URL(req.url);
  const conversationId = String(url.searchParams.get("conversation_id") ?? "").trim();
  if (!conversationId) return NextResponse.json({ ok: false, error: "Missing conversation_id" }, { status: 400 });

  const { data: messages, error } = await supabase
    .from("chat_messages")
    .select("id,conversation_id,sender_student_id,body,created_at,sender:students(name)")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, messages: messages ?? [] });
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const scope = await getUserScope(supabase);
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const conversationId = String(body?.conversation_id ?? "").trim();
  const requestedStudentId = String(body?.student_id ?? "").trim();
  const studentId = scope.isStudent ? scope.studentId : requestedStudentId;
  const rawBody = String(body?.body ?? "");
  const messageBody = rawBody.trim();

  if (!conversationId || !studentId || !messageBody) {
    return NextResponse.json({ ok: false, error: "Missing conversation/student/body" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      conversation_id: conversationId,
      sender_student_id: studentId,
      body: messageBody,
    })
    .select("id,conversation_id,sender_student_id,body,created_at")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, message: data });
}

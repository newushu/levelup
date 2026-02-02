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
  const requestedStudentId = String(url.searchParams.get("student_id") ?? "").trim();
  const studentId = scope.isStudent ? scope.studentId : requestedStudentId;
  if (!studentId) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });

  const { data: myParts, error: pErr } = await supabase
    .from("chat_participants")
    .select("conversation_id")
    .eq("student_id", studentId);
  if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });

  const convIds = (myParts ?? []).map((p: any) => p.conversation_id).filter(Boolean);
  const { data: existingPublic, error: existingErr } = await supabase
    .from("chat_conversations")
    .select("id,title,is_public")
    .eq("kind", "public")
    .maybeSingle();
  if (existingErr) return NextResponse.json({ ok: false, error: existingErr.message }, { status: 500 });

  let pubConv = existingPublic ?? null;
  if (!pubConv) {
    const { data: createdPublic, error: createErr } = await supabase
      .from("chat_conversations")
      .insert({ kind: "public", title: "Public Room", is_public: true })
      .select("id,title,is_public")
      .single();
    if (createErr) return NextResponse.json({ ok: false, error: createErr.message }, { status: 500 });
    pubConv = createdPublic ?? null;
  } else if (!pubConv.is_public) {
    const { data: updatedPublic, error: updateErr } = await supabase
      .from("chat_conversations")
      .update({ is_public: true })
      .eq("id", pubConv.id)
      .select("id,title,is_public")
      .single();
    if (updateErr) return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
    pubConv = updatedPublic ?? pubConv;
  }

  const allConvIds = pubConv?.id ? Array.from(new Set([...convIds, pubConv.id])) : convIds;
  if (!allConvIds.length) return NextResponse.json({ ok: true, threads: [] });

  const { data: parts, error: partsErr } = await supabase
    .from("chat_participants")
    .select("conversation_id,student_id")
    .in("conversation_id", allConvIds);
  if (partsErr) return NextResponse.json({ ok: false, error: partsErr.message }, { status: 500 });

  const otherIds = Array.from(
    new Set((parts ?? []).filter((p: any) => p.student_id !== studentId).map((p: any) => p.student_id))
  );

  const { data: students, error: sErr } = await supabase
    .from("students")
    .select("id,name,level")
    .in("id", otherIds);
  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });

  const { data: messages, error: mErr } = await supabase
    .from("chat_messages")
    .select("conversation_id,body,created_at,sender_student_id")
    .in("conversation_id", allConvIds)
    .order("created_at", { ascending: false });
  if (mErr) return NextResponse.json({ ok: false, error: mErr.message }, { status: 500 });

  const lastByConv = new Map<string, any>();
  (messages ?? []).forEach((m: any) => {
    const id = String(m.conversation_id ?? "");
    if (!lastByConv.has(id)) lastByConv.set(id, m);
  });

  const studentById = new Map((students ?? []).map((s: any) => [String(s.id), s]));

  const threads = allConvIds.map((cid) => {
    if (pubConv?.id === cid) {
      const last = lastByConv.get(String(cid)) ?? null;
      return {
        id: cid,
        other_student_id: "",
        other_name: pubConv.title ?? "Public Room",
        other_level: 0,
        last_message: last?.body ?? "",
        last_at: last?.created_at ?? null,
        last_sender_id: last?.sender_student_id ?? null,
        is_public: true,
      };
    }
    const others = (parts ?? []).filter((p: any) => p.conversation_id === cid && p.student_id !== studentId);
    const other = studentById.get(String(others[0]?.student_id ?? ""));
    const last = lastByConv.get(String(cid)) ?? null;
    return {
      id: cid,
      other_student_id: other?.id ?? "",
      other_name: other?.name ?? "Student",
      other_level: other?.level ?? 0,
      last_message: last?.body ?? "",
      last_at: last?.created_at ?? null,
      last_sender_id: last?.sender_student_id ?? null,
      is_public: false,
    };
  });

  threads.sort((a, b) => String(b.last_at ?? "").localeCompare(String(a.last_at ?? "")));
  return NextResponse.json({ ok: true, threads });
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const scope = await getUserScope(supabase);
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const left = String(body?.student_id ?? "").trim();
  const right = String(body?.other_student_id ?? "").trim();
  const studentId = scope.isStudent ? scope.studentId : left;

  if (!studentId || !right) return NextResponse.json({ ok: false, error: "Missing student ids" }, { status: 400 });
  if (studentId === right) return NextResponse.json({ ok: false, error: "Cannot chat with self" }, { status: 400 });

  const { data: myParts, error: pErr } = await supabase
    .from("chat_participants")
    .select("conversation_id")
    .eq("student_id", studentId);
  if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });

  const myConvIds = (myParts ?? []).map((p: any) => p.conversation_id).filter(Boolean);
  if (myConvIds.length) {
    const { data: otherParts, error: oErr } = await supabase
      .from("chat_participants")
      .select("conversation_id")
      .eq("student_id", right)
      .in("conversation_id", myConvIds);
    if (oErr) return NextResponse.json({ ok: false, error: oErr.message }, { status: 500 });
    const existing = otherParts?.[0]?.conversation_id;
    if (existing) return NextResponse.json({ ok: true, thread_id: existing });
  }

  const { data: conv, error: cErr } = await supabase
    .from("chat_conversations")
    .insert({})
    .select("id")
    .single();
  if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });

  const { error: selfErr } = await supabase.from("chat_participants").insert({
    conversation_id: conv.id,
    student_id: studentId,
  });
  if (selfErr) return NextResponse.json({ ok: false, error: selfErr.message }, { status: 500 });

  const { error: otherErr } = await supabase.from("chat_participants").insert({
    conversation_id: conv.id,
    student_id: right,
  });
  if (otherErr) return NextResponse.json({ ok: false, error: otherErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, thread_id: conv.id });
}

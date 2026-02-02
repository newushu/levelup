import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function parseStudentNames(input: string) {
  return input
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 6);
}

export async function POST(req: Request) {
  const gate = await requireUser();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const studentNames = parseStudentNames(String(body?.student_name ?? ""));
  const note = String(body?.note ?? "").trim();

  if (!studentNames.length) {
    return NextResponse.json({ ok: false, error: "Student name is required." }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: parent, error: pErr } = await admin
    .from("parents")
    .select("id,name,email")
    .eq("auth_user_id", gate.user.id)
    .maybeSingle();
  if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });
  if (!parent?.id) return NextResponse.json({ ok: false, error: "Not a parent account" }, { status: 403 });

  const { error } = await admin.from("parent_requests").insert({
    auth_user_id: gate.user.id,
    parent_name: parent.name,
    email: parent.email,
    student_names: studentNames,
    request_note: note || null,
    status: "pending",
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

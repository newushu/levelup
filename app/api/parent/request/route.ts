import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function parseStudentNames(input: string) {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parent_name = String(body?.parent_name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "").trim();
  const student_names = parseStudentNames(String(body?.student_names ?? ""));

  if (!parent_name || !email || !password) {
    return NextResponse.json({ ok: false, error: "Parent name, email, and password are required." }, { status: 400 });
  }

  const admin = supabaseAdmin();

  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });

  const userId = created?.user?.id ?? "";
  if (!userId) return NextResponse.json({ ok: false, error: "Failed to create auth user." }, { status: 500 });

  const { data: parent, error: pErr } = await admin
    .from("parents")
    .insert({ auth_user_id: userId, name: parent_name, email })
    .select("id")
    .single();
  if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });

  await admin.from("user_roles").insert({ user_id: userId, role: "parent" });

  const { error: rErr } = await admin
    .from("parent_requests")
    .insert({ auth_user_id: userId, parent_name, email, student_names, status: "pending" });
  if (rErr) return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, parent_id: parent?.id ?? null });
}

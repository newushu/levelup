import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/authz";
import { supabaseAdmin } from "../../../../lib/supabase/admin";

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: 403 });

  const { name, email, password, phone, student_id } = await req.json();
  if (!name || !email || !password || !student_id) {
    return NextResponse.json({ error: "name, email, password, student_id required" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  const { data: userData, error: uErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
  const user = userData.user;
  if (!user) return NextResponse.json({ error: "No user returned" }, { status: 500 });

  const { data: parent, error: pErr } = await admin
    .from("parents")
    .insert({ auth_user_id: user.id, name, email, phone: phone ?? null })
    .select("*")
    .single();

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  const { error: linkErr } = await admin.from("parent_students").insert({ parent_id: parent.id, student_id });
  if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, parent });
}

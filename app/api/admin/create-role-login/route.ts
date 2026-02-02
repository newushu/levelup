import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/authz";

const ALLOWED_ROLES = new Set(["classroom", "display", "skill_pulse", "camp"]);

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim();
  const password = String(body?.password ?? "").trim();
  const username = String(body?.username ?? "").trim();
  const role = String(body?.role ?? "").trim().toLowerCase();

  if (!email || !password) {
    return NextResponse.json({ error: "email and password required" }, { status: 400 });
  }
  if (!ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const user = data.user;
  if (!user) return NextResponse.json({ error: "No user returned" }, { status: 500 });

  const { error: pErr } = await admin.from("profiles").upsert({
    user_id: user.id,
    email,
    username: username ? username.toLowerCase() : null,
    role,
  });

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  const { error: rErr } = await admin.from("user_roles").upsert(
    {
      user_id: user.id,
      role,
    },
    { onConflict: "user_id,role" }
  );

  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, user_id: user.id });
}

import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/authz";

const ALLOWED_ROLES = new Set([
  "admin",
  "coach",
  "student",
  "parent",
  "display",
  "skill_pulse",
  "camp",
  "classroom",
  "skill-tablet",
  "coach-dashboard",
]);

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim();
  const display_name = String(body?.display_name ?? "").trim();
  const password = String(body?.password ?? "").trim();
  const username = String(body?.username ?? "").trim();
  const role = String(body?.role ?? "").trim().toLowerCase();
  const student_id = body?.student_id ? String(body.student_id).trim() : null;

  if (!email) {
    return NextResponse.json({ ok: false, error: "email required" }, { status: 400 });
  }
  if (!display_name && !username) {
    return NextResponse.json({ ok: false, error: "name or username required" }, { status: 400 });
  }
  if (!ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ ok: false, error: "Invalid role" }, { status: 400 });
  }
  if (role === "student" && !student_id) {
    return NextResponse.json({ ok: false, error: "student_id required for student role" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const tempPassword = password || crypto.randomBytes(6).toString("base64url");
  let user = null as any;
  let createdNew = true;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });
  if (error) {
    const msg = String(error.message || "");
    const alreadyExists =
      msg.toLowerCase().includes("already registered") ||
      msg.toLowerCase().includes("already exists") ||
      msg.toLowerCase().includes("duplicate");
    if (!alreadyExists) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    const existing = await admin.auth.admin.getUserByEmail(email);
    user = existing.data?.user || null;
    createdNew = false;
    if (!user) return NextResponse.json({ ok: false, error: "User exists but could not be fetched" }, { status: 500 });
  } else {
    user = data.user;
  }
  if (!user) return NextResponse.json({ ok: false, error: "No user returned" }, { status: 500 });

  const resolvedUsername = username
    ? username.toLowerCase()
    : display_name
    ? display_name.toLowerCase().replace(/\s+/g, "_")
    : null;
  const { error: pErr } = await admin.from("profiles").upsert({
    user_id: user.id,
    email,
    username: resolvedUsername,
    role,
  });
  if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });

  const rolePayload: any = { user_id: user.id, role };
  if (role === "student") rolePayload.student_id = student_id;
  const { error: rErr } = await admin.from("user_roles").upsert(rolePayload, { onConflict: "user_id,role" });
  if (rErr) return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    user_id: user.id,
    temp_password: createdNew && !password ? tempPassword : null,
    existed: !createdNew,
  });
}

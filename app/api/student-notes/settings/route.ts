import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error) return { ok: false as const, error: error.message };
  const user = data?.user ?? null;
  if (!user) return { ok: false as const, error: "Not authenticated" };

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const isAdmin = (roles ?? []).some((r: any) => String(r.role ?? "").toLowerCase() === "admin");
  if (!isAdmin) return { ok: false as const, error: "Admin access required" };
  return { ok: true as const, user, supabase };
}

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  const { supabase } = gate;

  const { data, error } = await supabase
    .from("admin_note_settings")
    .select("todo_notify_email,todo_notify_emails")
    .eq("id", 1)
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, settings: data ?? { todo_notify_email: "" } });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  const { supabase } = gate;

  const body = await req.json().catch(() => ({}));
  const todo_notify_email = String(body?.todo_notify_email ?? "").trim() || null;
  const todo_notify_emails = Array.isArray(body?.todo_notify_emails)
    ? body.todo_notify_emails.map((v: any) => String(v ?? "").trim()).filter(Boolean)
    : [];

  const { data, error } = await supabase
    .from("admin_note_settings")
    .upsert({ id: 1, todo_notify_email, todo_notify_emails, updated_at: new Date().toISOString() })
    .select("todo_notify_email,todo_notify_emails")
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, settings: data ?? { todo_notify_email, todo_notify_emails } });
}

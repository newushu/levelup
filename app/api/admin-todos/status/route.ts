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
    .eq("user_id", user.id)
    .eq("role", "admin")
    .limit(1);

  if (!roles || roles.length === 0) return { ok: false as const, error: "Forbidden" };
  return { ok: true as const, supabase, user };
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  const { supabase, user } = gate;

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  const status = String(body?.status ?? "done").toLowerCase();
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  if (!['open','done'].includes(status)) {
    return NextResponse.json({ ok: false, error: "Invalid status" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("admin_todos")
    .update({ status, resolved_by: status === "done" ? user.id : null, resolved_at: status === "done" ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id,kind,body,status,created_at,resolved_at")
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, todo: data });
}

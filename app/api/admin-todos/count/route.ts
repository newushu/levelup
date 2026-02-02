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
  return { ok: true as const, supabase };
}

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  const { supabase } = gate;

  const { count, error } = await supabase
    .from("admin_todos")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, count: count ?? 0 });
}

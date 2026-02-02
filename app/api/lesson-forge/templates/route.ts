import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

async function requireCoachOrAdmin() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { ok: false as const, error: "Not logged in" };

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id);

  if (error) return { ok: false as const, error: error.message };
  const allowed = (roles ?? []).some((r: any) => ["admin", "coach"].includes(String(r.role ?? "")));
  if (!allowed) return { ok: false as const, error: "Coach or admin access required" };
  return { ok: true as const, supabase, user: u.user };
}

export async function GET() {
  const gate = await requireCoachOrAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const { data, error } = await gate.supabase
    .from("lesson_forge_templates")
    .select("id,name,created_at,updated_at")
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, templates: data ?? [] });
}

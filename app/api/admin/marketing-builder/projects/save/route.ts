import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { ok: false as const, error: "Not logged in" };

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id)
    .eq("role", "admin")
    .limit(1);

  if (error) return { ok: false as const, error: error.message };
  if (!roles || roles.length === 0) return { ok: false as const, error: "Admin access required" };

  return { ok: true as const };
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  const name = String(body?.name ?? "").trim() || "Untitled";
  const kind = String(body?.kind ?? "email").trim();
  const theme_key = String(body?.theme_key ?? "").trim() || null;
  const data = body?.data ?? {};

  const payload: any = {
    name,
    kind,
    theme_key,
    data,
    updated_at: new Date().toISOString(),
  };

  const admin = supabaseAdmin();
  if (id) {
    const { data: row, error } = await admin
      .from("marketing_builder_projects")
      .upsert({ id, ...payload }, { onConflict: "id" })
      .select("id,name,kind,data,theme_key,updated_at")
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, project: row });
  }

  const { data: row, error } = await admin
    .from("marketing_builder_projects")
    .insert(payload)
    .select("id,name,kind,data,theme_key,updated_at")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, project: row });
}

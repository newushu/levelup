import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

async function requireCoachOrAdmin(supabase: any) {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return { ok: false, error: "Not authenticated" as const };

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  const roleSet = new Set((roles ?? []).map((r: any) => String(r.role)));
  if (!roleSet.has("coach") && !roleSet.has("admin")) return { ok: false, error: "Forbidden" as const };

  return { ok: true, user };
}

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const gate = await requireCoachOrAdmin(supabase);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const message = String(body?.message ?? "").trim().slice(0, 180);
  const kind = String(body?.kind ?? "manual").trim().slice(0, 40);

  if (!message) return NextResponse.json({ ok: false, error: "Missing message" }, { status: 400 });

  const { data, error } = await supabase
    .from("critical_notices")
    .insert({ message, kind })
    .select("id,message,created_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, notice: data });
}

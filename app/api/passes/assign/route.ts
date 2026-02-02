import { NextResponse } from "next/server";
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

  const supabase = await supabaseServer();
  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  const pass_type_id = String(body?.pass_type_id ?? "").trim();
  const valid_from = String(body?.valid_from ?? "").trim();
  const valid_to = String(body?.valid_to ?? "").trim();
  const payment_id = String(body?.payment_id ?? "").trim();
  const payment_confirmed = body?.payment_confirmed === true || !!payment_id;

  if (!student_id || !pass_type_id || !valid_from) {
    return NextResponse.json({ ok: false, error: "Missing student_id/pass_type_id/valid_from" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("student_passes")
    .insert({
      student_id,
      pass_type_id,
      valid_from,
      valid_to: valid_to || null,
      active: true,
      payment_id: payment_id || null,
      payment_confirmed,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data?.id });
}

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
  if (!student_id) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });

  const baseSelect = "id,pass_type_id,valid_from,valid_to,active,payment_confirmed,payment_id,pass_types(name)";
  let { data, error } = await supabase
    .from("student_passes")
    .select(baseSelect)
    .eq("student_id", student_id)
    .order("valid_from", { ascending: false });
  const isMissingColumn = (err: any) => String(err?.message || "").toLowerCase().includes("column");
  if (error && isMissingColumn(error)) {
    const retry = await supabase
      .from("student_passes")
      .select("id,pass_type_id,valid_from,valid_to,active,pass_types(name)")
      .eq("student_id", student_id)
      .order("valid_from", { ascending: false });
    data = retry.data;
    error = retry.error;
  }

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const rows = (data ?? []).map((row: any) => ({
    id: row.id,
    pass_type_id: row.pass_type_id,
    name: row.pass_types?.name ?? "Pass",
    valid_from: row.valid_from,
    valid_to: row.valid_to,
    active: row.active,
    payment_confirmed: row.payment_confirmed ?? null,
    payment_id: row.payment_id ?? null,
  }));

  return NextResponse.json({ ok: true, passes: rows });
}

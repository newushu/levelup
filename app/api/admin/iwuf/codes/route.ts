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

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("iwuf_codes")
    .select("id,event_type,code_number,name,description,deduction_amount,created_at")
    .order("code_number", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, codes: data ?? [] });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim() || undefined;
  const event_type = String(body?.event_type ?? "taolu").trim() || "taolu";
  const code_number = String(body?.code_number ?? "").trim();
  const name = String(body?.name ?? "").trim();
  const description = String(body?.description ?? "").trim() || null;
  const deduction_amount = Number(body?.deduction_amount ?? 0);

  if (!code_number || !name) {
    return NextResponse.json({ ok: false, error: "Missing code_number or name" }, { status: 400 });
  }
  if (Number.isNaN(deduction_amount)) {
    return NextResponse.json({ ok: false, error: "Invalid deduction_amount" }, { status: 400 });
  }

  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("iwuf_codes")
    .upsert({ id, event_type, code_number, name, description, deduction_amount })
    .select("id,event_type,code_number,name,description,deduction_amount,created_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, code: data });
}

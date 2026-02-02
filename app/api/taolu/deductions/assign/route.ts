import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabase/server";

async function getUserScope() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { ok: false as const, error: "Not logged in" };

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id);

  if (error) return { ok: false as const, error: error.message };
  const roleList = (roles ?? []).map((r: any) => String(r.role ?? "").toLowerCase());
  const isAdmin = roleList.includes("admin");
  const isCoach = roleList.includes("coach");

  return { ok: true as const, userId: u.user.id, isAdmin, isCoach };
}

export async function POST(req: Request) {
  const gate = await getUserScope();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  if (!gate.isAdmin && !gate.isCoach) {
    return NextResponse.json({ ok: false, error: "Coach access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const deduction_id = String(body?.deduction_id ?? "").trim();
  const code_id = String(body?.code_id ?? "").trim() || null;
  const section_number = body?.section_number !== undefined && body?.section_number !== null
    ? Number(body.section_number)
    : undefined;
  const note = typeof body?.note === "string" ? body.note.trim() : undefined;
  const voided = typeof body?.voided === "boolean" ? body.voided : undefined;

  if (!deduction_id) return NextResponse.json({ ok: false, error: "Missing deduction_id" }, { status: 400 });

  const admin = supabaseAdmin();
  const updates: Record<string, any> = {
    assigned_by: gate.userId,
    assigned_at: new Date().toISOString(),
  };
  if (code_id !== null || body?.code_id === "") updates.code_id = code_id;
  if (section_number !== undefined && !Number.isNaN(section_number)) updates.section_number = section_number;
  if (note !== undefined) updates.note = note;
  if (voided !== undefined) updates.voided = voided;
  const { data, error } = await admin
    .from("taolu_deductions")
    .update(updates)
    .eq("id", deduction_id)
    .select("id,session_id,occurred_at,section_number,note,voided,code_id,assigned_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, deduction: data });
}

export async function DELETE(req: Request) {
  const gate = await getUserScope();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  if (!gate.isAdmin && !gate.isCoach) {
    return NextResponse.json({ ok: false, error: "Coach access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const deduction_id = String(body?.deduction_id ?? "").trim();
  if (!deduction_id) return NextResponse.json({ ok: false, error: "Missing deduction_id" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("taolu_deductions")
    .delete()
    .eq("id", deduction_id)
    .select("id,session_id")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, removed: data });
}

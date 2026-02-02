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

export async function GET(req: Request) {
  const gate = await getUserScope();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  if (!gate.isAdmin && !gate.isCoach) {
    return NextResponse.json({ ok: false, error: "Coach access required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const sessionId = String(searchParams.get("session_id") ?? "").trim();
  if (!sessionId) return NextResponse.json({ ok: false, error: "Missing session_id" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("taolu_deductions")
    .select("id,session_id,occurred_at,section_number,note,voided,code_id,assigned_at")
    .eq("session_id", sessionId)
    .order("occurred_at", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, deductions: data ?? [] });
}

export async function POST(req: Request) {
  const gate = await getUserScope();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  if (!gate.isAdmin && !gate.isCoach) {
    return NextResponse.json({ ok: false, error: "Coach access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const session_id = String(body?.session_id ?? "").trim();
  const section_number = body?.section_number ? Number(body.section_number) : null;
  const note = typeof body?.note === "string" ? body.note.trim() : null;
  if (!session_id) return NextResponse.json({ ok: false, error: "Missing session_id" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("taolu_deductions")
    .insert({ session_id, section_number, note, voided: false })
    .select("id,session_id,occurred_at,section_number,note,voided,code_id,assigned_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, deduction: data });
}

export async function PATCH(req: Request) {
  const gate = await getUserScope();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  if (!gate.isAdmin && !gate.isCoach) {
    return NextResponse.json({ ok: false, error: "Coach access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const session_id = String(body?.session_id ?? "").trim();
  if (!session_id) return NextResponse.json({ ok: false, error: "Missing session_id" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("taolu_deductions")
    .update({ voided: true })
    .eq("session_id", session_id)
    .is("code_id", null)
    .select("id");

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, voided_count: (data ?? []).length });
}

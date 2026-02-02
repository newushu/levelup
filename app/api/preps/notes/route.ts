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
    .from("preps_notes")
    .select("id,session_id,occurred_at,prep_key,note")
    .eq("session_id", sessionId)
    .order("occurred_at", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, notes: data ?? [] });
}

export async function POST(req: Request) {
  const gate = await getUserScope();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  if (!gate.isAdmin && !gate.isCoach) {
    return NextResponse.json({ ok: false, error: "Coach access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const session_id = String(body?.session_id ?? "").trim();
  const prep_key = String(body?.prep_key ?? "").trim() || null;
  const note = typeof body?.note === "string" ? body.note.trim() : null;
  if (!session_id) return NextResponse.json({ ok: false, error: "Missing session_id" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("preps_notes")
    .insert({ session_id, prep_key, note })
    .select("id,session_id,occurred_at,prep_key,note")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, note: data });
}

export async function PATCH(req: Request) {
  const gate = await getUserScope();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  if (!gate.isAdmin && !gate.isCoach) {
    return NextResponse.json({ ok: false, error: "Coach access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const note_id = String(body?.note_id ?? "").trim();
  const prep_key = String(body?.prep_key ?? "").trim() || null;
  const note = typeof body?.note === "string" ? body.note.trim() : null;

  if (!note_id) return NextResponse.json({ ok: false, error: "Missing note_id" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("preps_notes")
    .update({ prep_key, note })
    .eq("id", note_id)
    .select("id,session_id,occurred_at,prep_key,note")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, note: data });
}

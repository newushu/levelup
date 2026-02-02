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
  const taolu_form_id = String(body?.taolu_form_id ?? "").trim();
  const student_ids = Array.isArray(body?.student_ids) ? body.student_ids : [];
  const sections = Array.isArray(body?.sections)
    ? body.sections.map((n: any) => Number(n)).filter((n: number) => !Number.isNaN(n))
    : [];
  const separate_sections = !!body?.separate_sections;

  if (!taolu_form_id) return NextResponse.json({ ok: false, error: "Missing taolu_form_id" }, { status: 400 });
  if (!student_ids.length) return NextResponse.json({ ok: false, error: "Missing student_ids" }, { status: 400 });
  if (!sections.length) return NextResponse.json({ ok: false, error: "Missing sections" }, { status: 400 });

  const admin = supabaseAdmin();
  const rows: any[] = [];

  student_ids.forEach((student_id: string) => {
    if (separate_sections) {
      sections.forEach((section) => {
        rows.push({
          student_id,
          taolu_form_id,
          sections: [section],
          separate_sections: true,
          coach_user_id: gate.userId,
        });
      });
    } else {
      rows.push({
        student_id,
        taolu_form_id,
        sections,
        separate_sections: false,
        coach_user_id: gate.userId,
      });
    }
  });

  const { data, error } = await admin
    .from("taolu_sessions")
    .insert(rows)
    .select("id,student_id,taolu_form_id,sections,separate_sections,created_at");

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, sessions: data ?? [] });
}

export async function PATCH(req: Request) {
  const gate = await getUserScope();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  if (!gate.isAdmin && !gate.isCoach) {
    return NextResponse.json({ ok: false, error: "Coach access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const session_id = String(body?.session_id ?? "").trim();
  const sections = Array.isArray(body?.sections)
    ? body.sections.map((n: any) => Number(n)).filter((n: number) => !Number.isNaN(n))
    : [];

  if (!session_id) return NextResponse.json({ ok: false, error: "Missing session_id" }, { status: 400 });
  if (!sections.length) return NextResponse.json({ ok: false, error: "Missing sections" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("taolu_sessions")
    .update({ sections })
    .eq("id", session_id)
    .select("id,student_id,taolu_form_id,sections,separate_sections,created_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, session: data });
}

export async function GET() {
  const gate = await getUserScope();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  if (!gate.isAdmin && !gate.isCoach) {
    return NextResponse.json({ ok: false, error: "Coach access required" }, { status: 403 });
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("taolu_sessions")
    .select("id,student_id,taolu_form_id,sections,separate_sections,created_at,ended_at")
    .is("ended_at", null)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, sessions: data ?? [] });
}

export async function DELETE(req: Request) {
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
    .from("taolu_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", session_id)
    .is("ended_at", null)
    .select("id,student_id,taolu_form_id,sections,separate_sections,created_at,ended_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, session: data });
}

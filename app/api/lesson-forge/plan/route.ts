import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

export async function GET(req: Request) {
  const gate = await requireCoachOrAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const url = new URL(req.url);
  const id = String(url.searchParams.get("id") ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "Plan id required" }, { status: 400 });

  const { data: plan, error: pErr } = await gate.supabase
    .from("lesson_forge_plans")
    .select("id,template_id,class_id,session_start_date,session_end_date,session_date,week_index,week_label,archived_at,created_at,updated_at,classes(name)")
    .eq("id", id)
    .single();

  if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });

  const { data: sections, error: sErr } = await gate.supabase
    .from("lesson_forge_plan_sections")
    .select("id,plan_id,section_order,section_title,entry")
    .eq("plan_id", id)
    .order("section_order", { ascending: true });

  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, plan, sections: sections ?? [] });
}

export async function POST(req: Request) {
  const gate = await requireCoachOrAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  const template_id = String(body?.template_id ?? "").trim();
  if (!template_id) return NextResponse.json({ ok: false, error: "Template id required" }, { status: 400 });

  const session_start_date = body?.session_start_date ? String(body.session_start_date) : null;
  const session_end_date = body?.session_end_date ? String(body.session_end_date) : null;
  const session_date = body?.session_date ? String(body.session_date) : null;
  const week_index = Number(body?.week_index ?? 1) || 1;
  const week_label = String(body?.week_label ?? "").trim() || null;
  const class_id = body?.class_id ? String(body.class_id) : null;

  const planPayload: any = {
    template_id,
    class_id,
    session_start_date,
    session_end_date,
    session_date,
    week_index,
    week_label,
    created_by: gate.user.id,
  };
  if (id) planPayload.id = id;

  const { data: plan, error: pErr } = await gate.supabase
    .from("lesson_forge_plans")
    .upsert(planPayload, { onConflict: "id" })
    .select("id,template_id,class_id,session_start_date,session_end_date,session_date,week_index,week_label,archived_at,created_at,updated_at")
    .single();

  if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });

  const sectionRows = Array.isArray(body?.sections) ? body.sections : [];

  const admin = supabaseAdmin();
  await admin.from("lesson_forge_plan_sections").delete().eq("plan_id", plan.id);

  if (sectionRows.length) {
    const payload = sectionRows.map((s: any, idx: number) => ({
      plan_id: plan.id,
      section_order: Number(s?.section_order ?? idx),
      section_title: String(s?.section_title ?? `Section ${idx + 1}`),
      entry: String(s?.entry ?? ""),
    }));
    const { error: sErr } = await admin.from("lesson_forge_plan_sections").insert(payload);
    if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, plan });
}

export async function DELETE(req: Request) {
  const gate = await requireCoachOrAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "Plan id required" }, { status: 400 });

  const { error } = await gate.supabase.from("lesson_forge_plans").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

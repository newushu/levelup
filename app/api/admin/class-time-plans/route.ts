import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type SectionPayload = {
  id?: string;
  label?: string;
  duration_minutes?: number;
  color?: string;
  sort_order?: number;
};

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const admin = supabaseAdmin();
  const [plansRes, sectionsRes, assignmentsRes, classesRes] = await Promise.all([
    admin.from("class_time_plans").select("id,name,description,created_at,updated_at").order("name", { ascending: true }),
    admin
      .from("class_time_plan_sections")
      .select("id,plan_id,label,duration_minutes,color,sort_order")
      .order("sort_order", { ascending: true }),
    admin.from("class_time_plan_assignments").select("id,plan_id,class_id"),
    admin.from("classes").select("id,name").order("name", { ascending: true }),
  ]);

  if (plansRes.error) return NextResponse.json({ ok: false, error: plansRes.error.message }, { status: 500 });
  if (sectionsRes.error) return NextResponse.json({ ok: false, error: sectionsRes.error.message }, { status: 500 });
  if (assignmentsRes.error) return NextResponse.json({ ok: false, error: assignmentsRes.error.message }, { status: 500 });
  if (classesRes.error) return NextResponse.json({ ok: false, error: classesRes.error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    plans: plansRes.data ?? [],
    sections: sectionsRes.data ?? [],
    assignments: assignmentsRes.data ?? [],
    classes: classesRes.data ?? [],
  });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const deleteId = String(body?.delete_id ?? "").trim();
  const admin = supabaseAdmin();

  if (deleteId) {
    const { error } = await admin.from("class_time_plans").delete().eq("id", deleteId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const id = String(body?.id ?? "").trim() || null;
  const name = String(body?.name ?? "").trim();
  const description = String(body?.description ?? "").trim() || null;
  const sections = Array.isArray(body?.sections) ? (body.sections as SectionPayload[]) : [];
  const classIds = Array.isArray(body?.class_ids) ? body.class_ids.map((c: any) => String(c)) : [];

  if (!name) return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });
  if (!sections.length) return NextResponse.json({ ok: false, error: "sections required" }, { status: 400 });

  const { data: plan, error: pErr } = await admin
    .from("class_time_plans")
    .upsert(
      {
        id: id || undefined,
        name,
        description,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    )
    .select("id,name,description,created_at,updated_at")
    .single();
  if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });

  const planId = String(plan?.id ?? id ?? "");
  if (!planId) return NextResponse.json({ ok: false, error: "Failed to resolve plan id" }, { status: 500 });

  const { error: delSectionsErr } = await admin.from("class_time_plan_sections").delete().eq("plan_id", planId);
  if (delSectionsErr) return NextResponse.json({ ok: false, error: delSectionsErr.message }, { status: 500 });

  const sectionPayload = sections.map((row, idx) => ({
    plan_id: planId,
    label: String(row.label ?? `Section ${idx + 1}`).trim() || `Section ${idx + 1}`,
    duration_minutes: Math.max(1, Number(row.duration_minutes ?? 5) || 5),
    color: String(row.color ?? "#60a5fa").trim() || "#60a5fa",
    sort_order: Number(row.sort_order ?? idx) || 0,
    updated_at: new Date().toISOString(),
  }));
  const { error: sErr } = await admin.from("class_time_plan_sections").insert(sectionPayload);
  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });

  if (classIds.length) {
    const { error: clearErr } = await admin
      .from("class_time_plan_assignments")
      .delete()
      .in("class_id", classIds);
    if (clearErr) return NextResponse.json({ ok: false, error: clearErr.message }, { status: 500 });
  }
  const { error: delAssignErr } = await admin.from("class_time_plan_assignments").delete().eq("plan_id", planId);
  if (delAssignErr) return NextResponse.json({ ok: false, error: delAssignErr.message }, { status: 500 });

  if (classIds.length) {
    const payload = classIds.map((class_id: string) => ({ plan_id: planId, class_id }));
    const { error: aErr } = await admin.from("class_time_plan_assignments").insert(payload);
    if (aErr) return NextResponse.json({ ok: false, error: aErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, plan_id: planId });
}

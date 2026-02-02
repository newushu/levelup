import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

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
  if (!id) return NextResponse.json({ ok: false, error: "Template id required" }, { status: 400 });

  const { data: template, error: tErr } = await gate.supabase
    .from("lesson_forge_templates")
    .select("id,name,created_at,updated_at")
    .eq("id", id)
    .single();

  if (tErr) return NextResponse.json({ ok: false, error: tErr.message }, { status: 500 });
  if (!template) return NextResponse.json({ ok: false, error: "Template not found" }, { status: 404 });

  const { data: sections, error: sErr } = await gate.supabase
    .from("lesson_forge_sections")
    .select("id,template_id,title,sort_order")
    .eq("template_id", id)
    .order("sort_order", { ascending: true });

  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });

  const sectionIds = (sections ?? []).map((s: any) => s.id);
  const { data: tools, error: toolErr } = sectionIds.length
    ? await gate.supabase
        .from("lesson_forge_section_tools")
        .select("id,section_id,tool_type,config,sort_order")
        .in("section_id", sectionIds)
        .order("sort_order", { ascending: true })
    : { data: [], error: null };

  if (toolErr) return NextResponse.json({ ok: false, error: toolErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, template, sections: sections ?? [], tools: tools ?? [] });
}

export async function POST(req: Request) {
  const gate = await requireCoachOrAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();
  const id = String(body?.id ?? "").trim();
  const sections = Array.isArray(body?.sections) ? body.sections : [];
  if (!name) return NextResponse.json({ ok: false, error: "Template name required" }, { status: 400 });

  const upsertPayload: any = { name, created_by: gate.user.id };
  if (id) upsertPayload.id = id;
  const { data: template, error: tErr } = await gate.supabase
    .from("lesson_forge_templates")
    .upsert(upsertPayload, { onConflict: "id" })
    .select("id,name,created_at,updated_at")
    .single();

  if (tErr) return NextResponse.json({ ok: false, error: tErr.message }, { status: 500 });
  const templateId = template.id;

  // Reset sections/tools for this template
  const { data: existingSections } = await gate.supabase
    .from("lesson_forge_sections")
    .select("id")
    .eq("template_id", templateId);
  const existingSectionIds = (existingSections ?? []).map((s: any) => s.id);
  if (existingSectionIds.length) {
    await gate.supabase.from("lesson_forge_section_tools").delete().in("section_id", existingSectionIds);
  }
  await gate.supabase.from("lesson_forge_sections").delete().eq("template_id", templateId);

  const sectionRows = sections.map((s: any, idx: number) => ({
    template_id: templateId,
    title: String(s?.title ?? "").trim() || `Section ${idx + 1}`,
    sort_order: Number(s?.sort_order ?? idx),
  }));

  const { data: insertedSections, error: sErr } = sectionRows.length
    ? await gate.supabase.from("lesson_forge_sections").insert(sectionRows).select("id,template_id,title,sort_order")
    : { data: [], error: null };

  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });

  const toolsPayload: any[] = [];
  (sections ?? []).forEach((s: any, idx: number) => {
    const section = (insertedSections ?? [])[idx];
    if (!section) return;
    const tools = Array.isArray(s?.tools) ? s.tools : [];
    tools.forEach((tool: any, tIdx: number) => {
      toolsPayload.push({
        section_id: section.id,
        tool_type: String(tool?.tool_type ?? ""),
        config: tool?.config ?? {},
        sort_order: Number(tool?.sort_order ?? tIdx),
      });
    });
  });

  if (toolsPayload.length) {
    const { error: toolErr } = await gate.supabase.from("lesson_forge_section_tools").insert(toolsPayload);
    if (toolErr) return NextResponse.json({ ok: false, error: toolErr.message }, { status: 500 });
  }

  const titleRows = sectionRows
    .map((s) => String(s.title ?? "").trim())
    .filter(Boolean)
    .map((title) => ({ name: title }));
  if (titleRows.length) {
    await gate.supabase.from("lesson_forge_section_titles").upsert(titleRows, { onConflict: "name" });
  }

  return NextResponse.json({ ok: true, template, sections: insertedSections ?? [] });
}

export async function DELETE(req: Request) {
  const gate = await requireCoachOrAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "Template id required" }, { status: 400 });

  const { error } = await gate.supabase.from("lesson_forge_templates").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

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
  return { ok: true as const, supabase };
}

export async function GET(req: Request) {
  const gate = await requireCoachOrAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const url = new URL(req.url);
  const templateId = String(url.searchParams.get("template_id") ?? "").trim();
  const classId = String(url.searchParams.get("class_id") ?? "").trim();
  const sessionDate = String(url.searchParams.get("session_date") ?? "").trim();
  const includeArchived = url.searchParams.get("archived") === "1";

  const admin = supabaseAdmin();
  if (templateId) {
    const todayIso = new Date().toISOString();
    await admin
      .from("lesson_forge_plans")
      .update({ archived_at: todayIso })
      .eq("template_id", templateId)
      .is("archived_at", null)
      .lt("session_end_date", new Date().toISOString().slice(0, 10));
  }

  let query = gate.supabase
    .from("lesson_forge_plans")
    .select("id,template_id,class_id,session_start_date,session_end_date,session_date,week_index,week_label,archived_at,created_at,updated_at,classes(name)");
  if (templateId) query = query.eq("template_id", templateId);
  if (classId) query = query.eq("class_id", classId);
  if (sessionDate) query = query.eq("session_date", sessionDate);
  if (!includeArchived) query = query.is("archived_at", null);
  const { data, error } = await query.order("session_date", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, plans: data ?? [] });
}

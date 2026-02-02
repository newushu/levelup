import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

async function requireCoachOrAdmin() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { ok: false as const, error: "Not logged in" };

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id)
    .in("role", ["admin", "coach"]);
  if (error) return { ok: false as const, error: error.message };
  if (!roles || roles.length === 0) return { ok: false as const, error: "Coach access required" };

  return { ok: true as const, supabase };
}

export async function POST(req: Request) {
  const gate = await requireCoachOrAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const element_id = String(body?.element_id ?? "").trim();
  const label = body?.label !== undefined ? String(body?.label ?? "").trim() : undefined;
  const enabled = typeof body?.enabled === "boolean" ? body.enabled : undefined;
  const sort_order = Number.isFinite(Number(body?.sort_order)) ? Number(body?.sort_order) : undefined;

  if (!element_id) return NextResponse.json({ ok: false, error: "Missing element_id" }, { status: 400 });

  const payload: Record<string, any> = {};
  if (label !== undefined) payload.label = label;
  if (typeof enabled === "boolean") payload.enabled = enabled;
  if (typeof sort_order === "number") payload.sort_order = sort_order;

  if (!Object.keys(payload).length) {
    return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await gate.supabase
    .from("tracker_skill_elements")
    .update(payload)
    .eq("id", element_id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

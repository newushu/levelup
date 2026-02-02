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
  const element_type = String(body?.element_type ?? "").trim();
  const label = String(body?.label ?? "").trim();
  const sort_order = Number.isFinite(Number(body?.sort_order)) ? Number(body?.sort_order) : 0;

  if (!element_type) return NextResponse.json({ ok: false, error: "Missing element_type" }, { status: 400 });
  if (!label) return NextResponse.json({ ok: false, error: "Missing label" }, { status: 400 });

  const { data: dupes, error: dErr } = await gate.supabase
    .from("tracker_skill_elements")
    .select("id")
    .eq("element_type", element_type)
    .ilike("label", label)
    .limit(1);
  if (dErr) return NextResponse.json({ ok: false, error: dErr.message }, { status: 500 });
  if ((dupes ?? []).length) {
    return NextResponse.json({ ok: false, error: "Element already exists" }, { status: 400 });
  }

  const { data, error } = await gate.supabase
    .from("tracker_skill_elements")
    .insert({
      element_type,
      label,
      is_skill_name: element_type === "name",
      enabled: true,
      sort_order,
    })
    .select("id,element_type,label,is_skill_name,enabled,sort_order,created_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, element: data });
}

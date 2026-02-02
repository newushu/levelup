import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { ok: false as const, error: "Not logged in" };

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id)
    .eq("role", "admin")
    .limit(1);

  if (error) return { ok: false as const, error: error.message };
  if (!roles || roles.length === 0) return { ok: false as const, error: "Admin access required" };

  return { ok: true as const, userId: u.user.id };
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const supabase = await supabaseServer();
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();
  const location_id = String(body?.location_id ?? "").trim();
  const class_color = String(body?.class_color ?? "").trim() || null;
  const passIds = Array.isArray(body?.pass_type_ids) ? body.pass_type_ids.map((v: any) => String(v)) : [];

  if (!name || !location_id) {
    return NextResponse.json({ ok: false, error: "Missing name/location_id" }, { status: 400 });
  }

  let { data, error } = await supabase
    .from("classes")
    .insert({
      name,
      location_id,
      class_color,
      enabled: true,
    })
    .select("id")
    .single();

  if (error && String(error.message || "").includes("class_color")) {
    const retry = await supabase
      .from("classes")
      .insert({
        name,
        location_id,
        enabled: true,
      })
      .select("id")
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const classId = data?.id;
  if (classId && passIds.length) {
    const rows = passIds.filter(Boolean).map((id: string) => ({ class_id: classId, pass_type_id: id }));
    const { error: pErr } = await supabase.from("class_pass_access").insert(rows);
    if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: classId });
}

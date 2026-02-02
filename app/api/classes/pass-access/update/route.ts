import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const supabase = await supabaseServer();
  const body = await req.json().catch(() => ({}));
  const class_id = String(body?.class_id ?? "").trim();
  const pass_type_ids = Array.isArray(body?.pass_type_ids) ? body.pass_type_ids.map((id: any) => String(id)) : [];

  if (!class_id) return NextResponse.json({ ok: false, error: "Missing class_id" }, { status: 400 });

  const { error: delErr } = await supabase.from("class_pass_access").delete().eq("class_id", class_id);
  if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });

  const rows = pass_type_ids.filter(Boolean).map((pass_type_id: string) => ({ class_id, pass_type_id }));
  if (!rows.length) return NextResponse.json({ ok: true, updated: 0 });

  const { error: insErr } = await supabase.from("class_pass_access").insert(rows);
  if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, updated: rows.length });
}

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("class_pass_access")
    .select("class_id,pass_type_id,pass_types(name)");

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const map: Record<string, { id: string; name: string }[]> = {};
  (data ?? []).forEach((row: any) => {
    const cid = String(row.class_id ?? "").trim();
    const pid = String(row.pass_type_id ?? "").trim();
    const name = String(row.pass_types?.name ?? "").trim();
    if (!cid || !pid) return;
    if (!map[cid]) map[cid] = [];
    map[cid].push({ id: pid, name: name || "Pass" });
  });

  return NextResponse.json({ ok: true, access: map });
}

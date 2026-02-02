import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("class_pass_access")
    .select("class_id,pass_type_id,pass_types(name)");

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const map: Record<string, string[]> = {};
  (data ?? []).forEach((row: any) => {
    const cid = String(row.class_id);
    if (!map[cid]) map[cid] = [];
    const name = row.pass_types?.name;
    if (name) map[cid].push(name);
  });

  return NextResponse.json({ ok: true, access: map });
}

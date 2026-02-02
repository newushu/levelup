import { NextResponse } from "next/server";
import { requireUser } from "../../../../lib/authz";
import { supabaseServer } from "../../../../lib/supabase/server";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("classes").select("*").order("name");

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, classes: data });
}

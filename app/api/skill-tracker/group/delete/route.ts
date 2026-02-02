import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const group_id = String(body?.group_id ?? "").trim();
  if (!group_id) return NextResponse.json({ ok: false, error: "Missing group_id" }, { status: 400 });

  const { error } = await supabase
    .from("skill_trackers")
    .update({ archived_at: new Date().toISOString() })
    .eq("group_id", group_id)
    .is("archived_at", null);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const log_id = String(body?.log_id ?? "").trim();
  const failure_reason = String(body?.failure_reason ?? "").trim();

  if (!log_id) return NextResponse.json({ ok: false, error: "Missing log_id" }, { status: 400 });

  const { error } = await supabase
    .from("skill_tracker_logs")
    .update({ failure_reason: failure_reason || null })
    .eq("id", log_id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

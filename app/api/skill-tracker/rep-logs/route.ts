import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const url = new URL(req.url);
  const tracker_id = String(url.searchParams.get("tracker_id") ?? "").trim();
  if (!tracker_id) return NextResponse.json({ ok: false, error: "Missing tracker_id" }, { status: 400 });

  const { data, error } = await supabase
    .from("skill_tracker_logs")
    .select("id,success,created_at,failure_reason")
    .eq("tracker_id", tracker_id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, logs: data ?? [] });
}

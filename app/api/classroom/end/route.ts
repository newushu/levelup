import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const class_id = String(body?.class_id ?? "").trim();
  const instance_id = String(body?.instance_id ?? "").trim();
  if (!class_id && !instance_id) {
    return NextResponse.json({ ok: false, error: "Missing class_id or instance_id" }, { status: 400 });
  }

  let q = supabase.from("class_sessions").select("id");
  if (instance_id) {
    q = q.eq("instance_id", instance_id);
  } else {
    q = q.eq("class_id", class_id);
  }
  const { data: active, error: aErr } = await q
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (aErr) return NextResponse.json({ ok: false, error: aErr.message }, { status: 500 });
  if (!active?.id) return NextResponse.json({ ok: true, ended: false });

  const { error: endErr } = await supabase
    .from("class_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", active.id);

  if (endErr) return NextResponse.json({ ok: false, error: endErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, ended: true });
}

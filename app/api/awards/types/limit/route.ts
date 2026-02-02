import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  const supabase = await supabaseServer();
  const body = await req.json().catch(() => ({}));
  const limit = Math.max(0, Math.min(20, Number(body?.limit ?? 0)));

  const { data, error } = await supabase
    .from("class_award_types")
    .select("id")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const ids = (data ?? []).map((row: any) => String(row.id));
  const enableIds = ids.slice(0, limit);
  const disableIds = ids.slice(limit);

  if (enableIds.length) {
    const { error: eErr } = await supabase.from("class_award_types").update({ enabled: true }).in("id", enableIds);
    if (eErr) return NextResponse.json({ ok: false, error: eErr.message }, { status: 500 });
  }
  if (disableIds.length) {
    const { error: dErr } = await supabase.from("class_award_types").update({ enabled: false }).in("id", disableIds);
    if (dErr) return NextResponse.json({ ok: false, error: dErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, limit });
}

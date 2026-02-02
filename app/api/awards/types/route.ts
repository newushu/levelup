import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  const supabase = await supabaseServer();
  const url = new URL(req.url);
  const includeDisabled = url.searchParams.get("include_disabled") === "1";
  let query = supabase
    .from("class_award_types")
    .select("id,name,points,enabled,created_at")
    .order("created_at", { ascending: true });
  if (!includeDisabled) query = query.eq("enabled", true);
  const { data, error } = await query;

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, types: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  const supabase = await supabaseServer();
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();
  const points = Number(body?.points ?? 0);
  const enabled = body?.enabled === false ? false : true;

  if (!name) return NextResponse.json({ ok: false, error: "Missing name" }, { status: 400 });
  if (!Number.isFinite(points) || points <= 0)
    return NextResponse.json({ ok: false, error: "Points must be a positive number" }, { status: 400 });

  const { data, error } = await supabase
    .from("class_award_types")
    .insert({ name, points, enabled })
    .select("id")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data?.id ?? null });
}

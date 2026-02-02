import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { randomUUID } from "crypto";

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  const supabase = supabaseAdmin();
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  const name = String(body?.name ?? "").trim();
  const setName = String(body?.set_name ?? "").trim();
  const level = Math.max(1, Number(body?.level ?? 1));
  const points = Number(body?.points ?? 0);
  const enabled = body?.enabled === false ? false : true;
  const category = String(body?.category ?? "").trim();
  const description = String(body?.description ?? "").trim();
  const sortOrder = Number(body?.sort_order ?? level);

  if (!name) return NextResponse.json({ ok: false, error: "Missing skill name" }, { status: 400 });
  if (!setName) return NextResponse.json({ ok: false, error: "Missing set name" }, { status: 400 });
  if (!Number.isFinite(level) || level <= 0) {
    return NextResponse.json({ ok: false, error: "Level must be positive" }, { status: 400 });
  }
  if (!Number.isFinite(points) || points < 0) {
    return NextResponse.json({ ok: false, error: "Points must be 0 or higher" }, { status: 400 });
  }

  let dupQuery = supabase
    .from("skills")
    .select("id")
    .eq("set_name", setName)
    .ilike("name", name);
  if (id) dupQuery = dupQuery.neq("id", id);
  const { data: dupes, error: dErr } = await dupQuery;
  if (dErr) return NextResponse.json({ ok: false, error: dErr.message }, { status: 500 });
  if ((dupes ?? []).length) {
    return NextResponse.json({ ok: false, error: "Duplicate skill name in this set." }, { status: 400 });
  }

  const payload = {
    id: id || randomUUID(),
    name,
    set_name: setName,
    level,
    points,
    points_award: points,
    enabled,
    category: category || null,
    description: description || null,
    sort_order: sortOrder,
  };

  if (id) {
    const { data, error } = await supabase
      .from("skills")
      .update(payload)
      .eq("id", id)
      .select("id,name,description,category,level,points,points_award,enabled,set_id,set_name,sort_order")
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, skill: data });
  }

  const { data, error } = await supabase
    .from("skills")
    .insert(payload)
    .select("id,name,description,category,level,points,points_award,enabled,set_id,set_name,sort_order")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, skill: data });
}

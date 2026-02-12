import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/authz";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("challenges")
    .select("id,name,category,tier,enabled,home_available,home_origin")
    .order("category", { ascending: true })
    .order("name", { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const rows = (data ?? []).filter((row: any) => String(row.home_origin ?? "") !== "parent");
  return NextResponse.json({ ok: true, challenges: rows });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  const home_available = Boolean(body?.home_available);

  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

  const admin = supabaseAdmin();
  const { error } = await admin.from("challenges").update({ home_available }).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

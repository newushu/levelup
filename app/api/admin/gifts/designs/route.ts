import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("gift_designs")
    .select("id,name,preview_image_url,html,css,js,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, designs: data ?? [] });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ ok: false, error: "Design name required" }, { status: 400 });

  const payload = {
    name,
    preview_image_url: String(body?.preview_image_url ?? "").trim() || null,
    html: String(body?.html ?? "").trim() || null,
    css: String(body?.css ?? "").trim() || null,
    js: String(body?.js ?? "").trim() || null,
    updated_at: new Date().toISOString(),
  } as any;

  const admin = supabaseAdmin();
  if (!id) {
    payload.created_by = gate.user.id;
    const { data, error } = await admin
      .from("gift_designs")
      .insert(payload)
      .select("id,name,preview_image_url,html,css,js,created_at,updated_at")
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, design: data });
  }

  const { data, error } = await admin
    .from("gift_designs")
    .update(payload)
    .eq("id", id)
    .select("id,name,preview_image_url,html,css,js,created_at,updated_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, design: data });
}

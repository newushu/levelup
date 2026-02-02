import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { ok: false as const, error: "Not logged in" };

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id)
    .eq("role", "admin")
    .limit(1);

  if (error) return { ok: false as const, error: error.message };
  if (!roles || roles.length === 0) return { ok: false as const, error: "Admin access required" };

  return { ok: true as const };
}

function normalizeTags(input: string | string[]) {
  if (Array.isArray(input)) return input.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
  return String(input ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeList(input: string | string[]) {
  if (Array.isArray(input)) return input.map((t) => String(t).trim()).filter(Boolean);
  return String(input ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("video_library")
    .select("id,name,url,categories,levels,tags,created_at,updated_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, videos: data ?? [] });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  const name = String(body?.name ?? "").trim();
  const url = String(body?.url ?? "").trim();
  const categories = normalizeList(body?.categories ?? "");
  const levels = normalizeList(body?.levels ?? "");
  const tags = normalizeTags(body?.tags ?? "");

  if (!name) return NextResponse.json({ ok: false, error: "Name is required" }, { status: 400 });
  if (!url) return NextResponse.json({ ok: false, error: "URL is required" }, { status: 400 });

  const admin = supabaseAdmin();
  const payload: any = { name, url, categories, levels, tags };
  if (id) payload.id = id;
  const { data, error } = await admin
    .from("video_library")
    .upsert(payload, { onConflict: "id" })
    .select("id,name,url,categories,levels,tags,created_at,updated_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, video: data });
}

export async function DELETE(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "Video id required" }, { status: 400 });

  const admin = supabaseAdmin();
  const { error } = await admin.from("video_library").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

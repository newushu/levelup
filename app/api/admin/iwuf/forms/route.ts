import { NextResponse } from "next/server";
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

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("iwuf_taolu_forms")
    .select("id,name,age_group_id,sections_count,video_links,is_active,created_at")
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, forms: data ?? [] });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim() || undefined;
  const name = String(body?.name ?? "").trim();
  const age_group_id = String(body?.age_group_id ?? "").trim() || null;
  const sections_count = Number(body?.sections_count ?? 0);
  const is_active = body?.is_active !== false;
  const rawLinks = Array.isArray(body?.video_links) ? body?.video_links : [];
  const video_links = rawLinks.map((l: any) => String(l ?? "").trim()).filter(Boolean);

  if (!name) return NextResponse.json({ ok: false, error: "Missing name" }, { status: 400 });
  if (!sections_count || Number.isNaN(sections_count) || sections_count < 1) {
    return NextResponse.json({ ok: false, error: "sections_count must be >= 1" }, { status: 400 });
  }

  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("iwuf_taolu_forms")
    .upsert({ id, name, age_group_id, sections_count, video_links, is_active })
    .select("id,name,age_group_id,sections_count,video_links,is_active,created_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, form: data });
}

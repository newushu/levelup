import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const supabase = await supabaseServer();
  const body = await req.json().catch(() => ({}));
  const menus = Array.isArray(body?.menus) ? body.menus : [];
  if (!menus.length) return NextResponse.json({ ok: false, error: "Missing menus" }, { status: 400 });

  const isUuid = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  const rows = menus.map((m: any, idx: number) => {
    const rawId = String(m.id ?? "").trim();
    const id = isUuid(rawId) ? rawId : "";
    return {
      ...(id ? { id } : {}),
      name: String(m.name ?? "").trim(),
      enabled: m.enabled !== false,
      display_order: Number.isFinite(Number(m.display_order)) ? Number(m.display_order) : idx,
    };
  });

  if (rows.some((r: any) => !r.name)) {
    return NextResponse.json({ ok: false, error: "Menu name required" }, { status: 400 });
  }

  const existing = rows.filter((r: any) => r.id);
  const fresh = rows.filter((r: any) => !r.id).map((r: any) => {
    const { id, ...rest } = r;
    return rest;
  });

  if (fresh.length) {
    const { error: insErr } = await supabase.from("camp_menus").insert(fresh);
    if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
  }
  if (existing.length) {
    const { error: upErr } = await supabase.from("camp_menus").upsert(existing, { onConflict: "id" });
    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: rows.length });
}

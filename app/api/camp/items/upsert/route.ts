import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const gate = await requireUser();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const supabase = await supabaseServer();
  const { data: roles, error: rolesErr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", gate.user.id);
  if (rolesErr) return NextResponse.json({ ok: false, error: rolesErr.message }, { status: 500 });
  const allowed = new Set(
    (roles ?? []).map((r: any) => String(r?.role ?? "").toLowerCase()).filter(Boolean)
  );
  if (!allowed.has("admin") && !allowed.has("camp")) {
    return NextResponse.json({ ok: false, error: "Admin or camp access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const items = Array.isArray(body?.items) ? body.items : [];
  if (!items.length) return NextResponse.json({ ok: false, error: "Missing items" }, { status: 400 });

  const isUuid = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  const rows = items.map((item: any, idx: number) => {
    const rawId = String(item.id ?? "").trim();
    const id = isUuid(rawId) ? rawId : "";
    return {
      ...(id ? { id } : {}),
      menu_id: String(item.menu_id ?? "").trim(),
      name: String(item.name ?? "").trim(),
      price_points: Number.isFinite(Number(item.price_points)) ? Number(item.price_points) : 0,
      allow_second: item.allow_second === true,
      second_price_points: Number.isFinite(Number(item.second_price_points)) ? Number(item.second_price_points) : null,
      image_url: String(item.image_url ?? "").trim() || null,
      image_text: String(item.image_text ?? "").trim() || null,
      use_text: item.use_text === true,
      image_x: Number.isFinite(Number(item.image_x)) ? Number(item.image_x) : null,
      image_y: Number.isFinite(Number(item.image_y)) ? Number(item.image_y) : null,
      image_zoom: Number.isFinite(Number(item.image_zoom)) ? Number(item.image_zoom) : null,
      enabled: item.enabled !== false,
      visible_on_menu: item.visible_on_menu !== false,
      visible_on_pos: item.visible_on_pos !== false,
      sold_out: item.sold_out === true,
      display_order: Number.isFinite(Number(item.display_order)) ? Number(item.display_order) : idx,
    };
  });

  if (rows.some((r: any) => !r.menu_id || !r.name)) {
    return NextResponse.json({ ok: false, error: "menu_id and item name required" }, { status: 400 });
  }

  const newRows = rows.filter((r: any) => !r.id);
  const existingRows = rows.filter((r: any) => r.id);

  if (newRows.length) {
    const { error: insErr } = await supabase.from("camp_menu_items").insert(newRows);
    if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
  }

  if (existingRows.length) {
    const { error: upErr } = await supabase.from("camp_menu_items").upsert(existingRows, { onConflict: "id" });
    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: rows.length });
}

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/lib/authz";

function isMissingColumn(error: any, col: string) {
  const msg = String(error?.message ?? "").toLowerCase();
  return msg.includes("column") && msg.includes(col.toLowerCase()) && msg.includes("does not exist");
}

export async function GET(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const includeItems = searchParams.get("items") === "1";

  const supabase = await supabaseServer();
  let { data: menus, error: mErr } = await supabase
    .from("camp_menus")
    .select("id,name,enabled,display_order,price_modifier_pct")
    .order("display_order", { ascending: true });
  if (mErr && isMissingColumn(mErr, "price_modifier_pct")) {
    const fallback = await supabase
      .from("camp_menus")
      .select("id,name,enabled,display_order")
      .order("display_order", { ascending: true });
    menus = (fallback.data ?? []).map((m: any) => ({ ...m, price_modifier_pct: 0 }));
    mErr = fallback.error as any;
  }
  if (mErr) return NextResponse.json({ ok: false, error: mErr.message }, { status: 500 });

  if (!includeItems) return NextResponse.json({ ok: true, menus: menus ?? [] });

  const menuIds = (menus ?? []).map((m: any) => String(m.id));
  let items: any[] = [];
  if (menuIds.length) {
    const { data: rows, error: iErr } = await supabase
      .from("camp_menu_items")
      .select("id,menu_id,name,price_points,allow_second,second_price_points,image_url,image_text,use_text,image_x,image_y,image_zoom,enabled,visible_on_menu,visible_on_pos,sold_out,display_order")
      .in("menu_id", menuIds)
      .order("display_order", { ascending: true });
    if (iErr) return NextResponse.json({ ok: false, error: iErr.message }, { status: 500 });
    items = rows ?? [];
  }

  const itemsByMenu: Record<string, any[]> = {};
  items.forEach((item: any) => {
    const mid = String(item.menu_id ?? "");
    if (!itemsByMenu[mid]) itemsByMenu[mid] = [];
    itemsByMenu[mid].push(item);
  });

  const combined = (menus ?? []).map((m: any) => ({
    ...m,
    items: itemsByMenu[String(m.id)] ?? [],
  }));

  return NextResponse.json({ ok: true, menus: combined });
}

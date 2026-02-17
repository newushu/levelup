import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function normalizeCategory(v: string) {
  const key = String(v ?? "").trim().toLowerCase();
  if (["item", "points", "discount", "weapon", "uniform", "package"].includes(key)) return key;
  return "item";
}

function normalizeCategoryTags(input: any): string[] {
  const allowed = new Set(["item", "points", "discount", "weapon", "uniform", "package"]);
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input
        .map((v: any) => String(v ?? "").trim().toLowerCase())
        .filter((v: string) => allowed.has(v))
    )
  );
}

function normalizePackageComponents(input: any) {
  const allowed = new Set(["item", "points", "discount", "weapon", "uniform"]);
  if (!Array.isArray(input)) return [] as any[];
  return input
    .map((row: any, idx: number) => {
      const category = String(row?.component_category ?? row?.category ?? "").trim().toLowerCase();
      if (!allowed.has(category)) return null;
      const name = String(row?.component_name ?? row?.name ?? "").trim();
      if (!name) return null;
      return {
        component_order: Math.max(0, Number(row?.component_order ?? idx) || idx),
        component_category: category,
        component_name: name,
        component_points_value: Math.max(0, Number(row?.component_points_value ?? row?.points_value ?? 0) || 0),
        component_design_id: String(row?.component_design_id ?? row?.design_id ?? "").trim() || null,
        component_design_image_url: String(row?.component_design_image_url ?? row?.design_image_url ?? "").trim() || null,
        component_design_html: String(row?.component_design_html ?? row?.design_html ?? "").trim() || null,
        component_design_css: String(row?.component_design_css ?? row?.design_css ?? "").trim() || null,
        component_design_js: String(row?.component_design_js ?? row?.design_js ?? "").trim() || null,
        component_qty: Math.max(1, Number(row?.component_qty ?? row?.qty ?? 1) || 1),
      };
    })
    .filter(Boolean);
}

function isMissingRelation(err: any) {
  const msg = String(err?.message ?? "").toLowerCase();
  return msg.includes("does not exist") || msg.includes("relation") || msg.includes("not found");
}

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("gift_items")
    .select("id,name,category,category_tags,gift_type,design_id,design_image_url,design_html,design_css,design_js,points_value,enabled,created_at,updated_at,gift_designs(id,name,preview_image_url)")
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const items = (data ?? []) as any[];
  const ids = items.map((r: any) => String(r.id ?? "")).filter(Boolean);
  let componentsByPackage: Record<string, any[]> = {};
  if (ids.length) {
    const { data: components, error: cErr } = await admin
      .from("gift_package_components")
      .select("id,package_gift_item_id,component_order,component_category,component_name,component_points_value,component_design_id,component_design_image_url,component_design_html,component_design_css,component_design_js,component_qty,created_at,updated_at")
      .in("package_gift_item_id", ids)
      .order("component_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (!cErr) {
      (components ?? []).forEach((c: any) => {
        const key = String(c.package_gift_item_id ?? "");
        if (!key) return;
        if (!componentsByPackage[key]) componentsByPackage[key] = [];
        componentsByPackage[key].push(c);
      });
    } else if (!isMissingRelation(cErr)) {
      return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });
    }
  }
  const merged = items.map((it: any) => ({
    ...it,
    package_components: componentsByPackage[String(it.id)] ?? [],
  }));
  return NextResponse.json({ ok: true, items: merged });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ ok: false, error: "Gift name required" }, { status: 400 });

  const payload: any = {
    name,
    category: normalizeCategory(String(body?.category ?? "item")),
    category_tags: normalizeCategoryTags(body?.category_tags),
    gift_type: String(body?.gift_type ?? "generic").trim() || "generic",
    design_id: String(body?.design_id ?? "").trim() || null,
    design_image_url: String(body?.design_image_url ?? "").trim() || null,
    design_html: String(body?.design_html ?? "").trim() || null,
    design_css: String(body?.design_css ?? "").trim() || null,
    design_js: String(body?.design_js ?? "").trim() || null,
    points_value: Math.max(0, Number(body?.points_value ?? 0) || 0),
    enabled: body?.enabled !== false,
    updated_at: new Date().toISOString(),
  };
  const packageComponents = normalizePackageComponents(body?.package_components);

  const admin = supabaseAdmin();
  if (!id) {
    if (!payload.category_tags.length) payload.category_tags = [payload.category];
    payload.category = String(payload.category_tags?.[0] ?? payload.category ?? "item");
    payload.created_by = gate.user.id;
    const { data, error } = await admin
      .from("gift_items")
      .insert(payload)
      .select("id,name,category,category_tags,gift_type,design_id,design_image_url,design_html,design_css,design_js,points_value,enabled,created_at,updated_at")
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (String(data?.category ?? "") === "package") {
      if (packageComponents.length) {
        const rows = packageComponents.map((row: any) => ({ ...row, package_gift_item_id: data.id, updated_at: new Date().toISOString() }));
        const { error: pErr } = await admin.from("gift_package_components").insert(rows);
        if (pErr && !isMissingRelation(pErr)) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });
      }
    }
    return NextResponse.json({ ok: true, item: data });
  }

  if (!payload.category_tags.length) payload.category_tags = [payload.category];
  payload.category = String(payload.category_tags?.[0] ?? payload.category ?? "item");
  const { data, error } = await admin
    .from("gift_items")
    .update(payload)
    .eq("id", id)
    .select("id,name,category,category_tags,gift_type,design_id,design_image_url,design_html,design_css,design_js,points_value,enabled,created_at,updated_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const { error: wipeErr } = await admin.from("gift_package_components").delete().eq("package_gift_item_id", id);
  if (wipeErr && !isMissingRelation(wipeErr)) return NextResponse.json({ ok: false, error: wipeErr.message }, { status: 500 });
  if (String(data?.category ?? "") === "package" && packageComponents.length) {
    const rows = packageComponents.map((row: any) => ({ ...row, package_gift_item_id: id, updated_at: new Date().toISOString() }));
    const { error: pErr } = await admin.from("gift_package_components").insert(rows);
    if (pErr && !isMissingRelation(pErr)) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, item: data });
}

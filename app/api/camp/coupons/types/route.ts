import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/lib/authz";

async function requireCampManager() {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const supabase = await supabaseServer();
  const { data: roles, error } = await supabase.from("user_roles").select("role").eq("user_id", auth.user.id);
  if (error) return { ok: false as const, error: error.message };
  const roleList = (roles ?? []).map((r) => String(r.role ?? "").toLowerCase());
  const allowed = roleList.some((r) => ["admin", "coach"].includes(r));
  if (!allowed) return { ok: false as const, error: "Admin or coach access required" };
  return { ok: true as const, user: auth.user };
}

export async function GET() {
  const gate = await requireCampManager();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("camp_coupon_types")
    .select("id,name,coupon_type,points_value,item_id,enabled,created_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, types: data ?? [] });
}

export async function POST(req: Request) {
  const gate = await requireCampManager();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const supabase = await supabaseServer();
  const body = await req.json().catch(() => ({}));
  const types = Array.isArray(body?.types) ? body.types : [];
  if (!types.length) return NextResponse.json({ ok: false, error: "Missing types" }, { status: 400 });

  const isUuid = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  const rows = types.map((t: any) => {
    const rawId = String(t.id ?? "").trim();
    const id = isUuid(rawId) ? rawId : "";
    const couponType = String(t.coupon_type ?? "").trim() || "points";
    return {
      ...(id ? { id } : {}),
      name: String(t.name ?? "").trim(),
      coupon_type: couponType,
      points_value: Number.isFinite(Number(t.points_value)) ? Number(t.points_value) : null,
      item_id: isUuid(String(t.item_id ?? "")) ? String(t.item_id) : null,
      enabled: t.enabled !== false,
    };
  });

  if (rows.some((r: any) => !r.name)) {
    return NextResponse.json({ ok: false, error: "Coupon name required" }, { status: 400 });
  }

  const { error } = await supabase.from("camp_coupon_types").upsert(rows, { onConflict: "id" });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, updated: rows.length });
}

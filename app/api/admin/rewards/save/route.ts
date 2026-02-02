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

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  const name = String(body?.name ?? "").trim();
  const category = String(body?.category ?? "").trim();
  const reward_type = String(body?.reward_type ?? "").trim();
  const enabled = body?.enabled !== false;
  const cost = Number(body?.cost ?? 0);
  const redeem_limit =
    body?.redeem_limit === null || body?.redeem_limit === "" || Number.isNaN(Number(body?.redeem_limit))
      ? null
      : Number(body?.redeem_limit);
  const allowed_groups = Array.isArray(body?.allowed_groups)
    ? body.allowed_groups.map((g: any) => String(g).trim()).filter(Boolean)
    : null;

  if (!id) return NextResponse.json({ ok: false, error: "Reward id is required" }, { status: 400 });
  if (!name) return NextResponse.json({ ok: false, error: "Reward name is required" }, { status: 400 });

  const payload: any = {
    id,
    name,
    category: category || null,
    reward_type: reward_type || null,
    enabled,
    cost,
    redeem_limit,
    allowed_groups,
  };

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("rewards")
    .upsert(payload, { onConflict: "id" })
    .select("id,name,category,cost,enabled,redeem_limit,allowed_groups,reward_type")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, reward: data });
}

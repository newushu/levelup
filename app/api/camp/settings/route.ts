import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

async function hashPin(pin: string) {
  const data = new TextEncoder().encode(pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function GET() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });
  const { data: roles, error: roleErr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id);
  if (roleErr) return NextResponse.json({ ok: false, error: roleErr.message }, { status: 500 });
  const roleList = (roles ?? []).map((r: any) => String(r.role ?? "").toLowerCase());
  const allowed = roleList.some((r: string) => ["admin", "coach", "camp"].includes(r));
  if (!allowed) return NextResponse.json({ ok: false, error: "Not allowed" }, { status: 403 });

  const { data, error } = await supabase.from("camp_settings").select("*").eq("id", "default").maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    settings: data ?? {
      id: "default",
      daily_points: 0,
      helper_points: 0,
      seller_daily_points: 300,
      cleaner_daily_points: 500,
      camp_pin_hash: null,
    },
  });
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });
  const { data: roles, error: roleErr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id);
  if (roleErr) return NextResponse.json({ ok: false, error: roleErr.message }, { status: 500 });
  const roleList = (roles ?? []).map((r: any) => String(r.role ?? "").toLowerCase());
  const allowed = roleList.some((r: string) => ["admin", "coach", "camp"].includes(r));
  if (!allowed) return NextResponse.json({ ok: false, error: "Not allowed" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const daily_points = Number.isFinite(Number(body?.daily_points)) ? Number(body.daily_points) : 0;
  const helper_points = Number.isFinite(Number(body?.helper_points)) ? Number(body.helper_points) : 0;
  const seller_daily_points = Number.isFinite(Number(body?.seller_daily_points)) ? Number(body.seller_daily_points) : 300;
  const cleaner_daily_points = Number.isFinite(Number(body?.cleaner_daily_points)) ? Number(body.cleaner_daily_points) : 500;
  const pin = String(body?.camp_pin ?? "").trim();

  const next: Record<string, any> = {
    id: "default",
    daily_points,
    helper_points,
    seller_daily_points,
    cleaner_daily_points,
  };
  if (pin) next.camp_pin_hash = await hashPin(pin);

  const { error } = await supabase.from("camp_settings").upsert(next, { onConflict: "id" });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

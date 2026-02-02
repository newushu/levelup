import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/authz";

async function hashPin(pin: string) {
  const data = new TextEncoder().encode(pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("camp_settings").select("*").eq("id", "default").maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    settings: data ?? { id: "default", daily_points: 0, helper_points: 0, camp_pin_hash: null },
  });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const supabase = await supabaseServer();
  const body = await req.json().catch(() => ({}));
  const daily_points = Number.isFinite(Number(body?.daily_points)) ? Number(body.daily_points) : 0;
  const helper_points = Number.isFinite(Number(body?.helper_points)) ? Number(body.helper_points) : 0;
  const pin = String(body?.camp_pin ?? "").trim();

  const next: Record<string, any> = { id: "default", daily_points, helper_points };
  if (pin) next.camp_pin_hash = await hashPin(pin);

  const { error } = await supabase.from("camp_settings").upsert(next, { onConflict: "id" });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

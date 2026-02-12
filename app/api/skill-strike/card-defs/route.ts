import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("skill_strike_card_defs")
      .select("id,card_type,category,damage,shield_value,copies,image_url,enabled,updated_at")
      .order("card_type", { ascending: true })
      .order("category", { ascending: true })
      .order("damage", { ascending: true })
      .order("shield_value", { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, defs: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? "Failed to load card defs" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const defs = Array.isArray(body?.defs) ? body.defs : [];
    const payload = defs.map((d: any) => ({
      id: d?.id,
      card_type: String(d?.card_type ?? "").trim(),
      category: d?.category ?? null,
      damage: d?.damage ?? null,
      shield_value: d?.shield_value ?? null,
      copies: Math.max(0, Number(d?.copies ?? 0)),
      image_url: d?.image_url ?? null,
      enabled: d?.enabled !== false,
      updated_at: new Date().toISOString(),
    }));

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("skill_strike_card_defs")
      .upsert(payload)
      .select("id,card_type,category,damage,shield_value,copies,image_url,enabled,updated_at");

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, defs: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? "Failed to save card defs" }, { status: 500 });
  }
}

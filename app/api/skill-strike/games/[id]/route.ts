import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(_: NextRequest, context: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const { id } = await Promise.resolve(context.params);
    const safeId = String(id ?? "");
    if (!safeId) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("skill_strike_games")
      .select("id,code,status,state,created_at,started_at,ended_at")
      .eq("id", safeId)
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, game: data });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? "Failed to load game" }, { status: 500 });
  }
}

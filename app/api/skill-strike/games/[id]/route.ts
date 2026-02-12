import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const id = String(params.id ?? "");
    if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("skill_strike_games")
      .select("id,code,status,state,created_at,started_at,ended_at")
      .eq("id", id)
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, game: data });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? "Failed to load game" }, { status: 500 });
  }
}

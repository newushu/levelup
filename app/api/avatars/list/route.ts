import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";


const AVATAR_BUCKET = process.env.NEXT_PUBLIC_AVATAR_BUCKET || "avatars";


export async function GET() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });


  const { data, error } = await supabase
    .from("avatars")
    .select(
      "id,name,storage_path,enabled,is_secondary,unlock_level,unlock_points,rule_keeper_multiplier,rule_breaker_multiplier,skill_pulse_multiplier,spotlight_multiplier,daily_free_points,zoom_pct,competition_only,competition_discount_pct"
    )
    .order("name", { ascending: true });


  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });


  const avatars = (data ?? []).map((a: any) => {
    const storage_path = a.storage_path ? String(a.storage_path) : null;


    let public_url: string | null = null;
    if (storage_path) {
      const { data: pub } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(storage_path);
      public_url = pub?.publicUrl ?? null;
    }


    return {
      id: a.id,
      name: a.name,
      storage_path,
      enabled: !!a.enabled,
      is_secondary: !!a.is_secondary,
      unlock_level: Number(a.unlock_level ?? 1),
      unlock_points: Number(a.unlock_points ?? 0),
      rule_keeper_multiplier: Number(a.rule_keeper_multiplier ?? 1),
      rule_breaker_multiplier: Number(a.rule_breaker_multiplier ?? 1),
      skill_pulse_multiplier: Number(a.skill_pulse_multiplier ?? 1),
      spotlight_multiplier: Number(a.spotlight_multiplier ?? 1),
      daily_free_points: Number(a.daily_free_points ?? 0),
      zoom_pct: Number(a.zoom_pct ?? 100),
      competition_only: !!a.competition_only,
      competition_discount_pct: Number(a.competition_discount_pct ?? 0),
      public_url,
    };
  });


  return NextResponse.json({ ok: true, avatars });
}

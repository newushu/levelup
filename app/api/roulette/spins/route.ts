import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

async function requireCoachOrAdmin() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false as const, error: error?.message || "Not logged in" };

  const { data: roles, error: rErr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id);

  if (rErr) return { ok: false as const, error: rErr.message };
  const allowed = (roles ?? []).some((r: any) => ["admin", "coach"].includes(String(r.role ?? "").toLowerCase()));
  if (!allowed) return { ok: false as const, error: "Coach access required" };

  return { ok: true as const, supabase };
}

export async function GET(req: Request) {
  const gate = await requireCoachOrAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const wheel_id = String(searchParams.get("wheel_id") ?? "").trim();
  const student_id = String(searchParams.get("student_id") ?? "").trim();
  const limitRaw = Number(searchParams.get("limit") ?? 12);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 50) : 12;

  if (!wheel_id) return NextResponse.json({ ok: false, error: "Missing wheel_id" }, { status: 400 });
  if (!student_id) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });

  const { data, error } = await gate.supabase
    .from("roulette_spins")
    .select(
      "id,student_id,wheel_id,points_delta,prize_text,item_key,confirmed_at,roulette_wheels(name),roulette_segments(label,segment_type),students(name,avatar_storage_path)"
    )
    .eq("wheel_id", wheel_id)
    .eq("student_id", student_id)
    .not("confirmed_at", "is", null)
    .order("confirmed_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, spins: data ?? [] });
}

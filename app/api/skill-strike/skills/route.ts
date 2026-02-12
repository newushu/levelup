import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const search = String(url.searchParams.get("search") ?? "").trim().toLowerCase();
    const category = String(url.searchParams.get("category") ?? "").trim();

    const admin = supabaseAdmin();
    let query = admin.from("tracker_skills").select("id,name,category").eq("enabled", true);
    if (category) query = query.eq("category", category);
    if (search) query = query.ilike("name", `%${search}%`);

    const { data: skills, error } = await query.order("category", { ascending: true }).order("name", { ascending: true });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const skillIds = (skills ?? []).map((s: any) => s.id);
    const diffMap = new Map<string, number>();
    if (skillIds.length) {
      const { data: diffs, error: dErr } = await admin
        .from("skill_strike_skill_difficulty")
        .select("skill_id,damage")
        .in("skill_id", skillIds);
      if (dErr) {
        return NextResponse.json({ ok: false, error: dErr.message }, { status: 500 });
      }
      (diffs ?? []).forEach((row: any) => diffMap.set(String(row.skill_id), Number(row.damage ?? 3)));
    }

    const rows = (skills ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      damage: diffMap.get(String(s.id)) ?? 3,
    }));

    return NextResponse.json({ ok: true, skills: rows });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? "Failed to load skills" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    const payload = rows.map((row: any) => ({
      skill_id: row.skill_id ?? row.id,
      damage: Math.max(3, Math.min(7, Number(row.damage ?? 3))),
      updated_at: new Date().toISOString(),
    }));

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("skill_strike_skill_difficulty")
      .upsert(payload)
      .select("skill_id,damage,updated_at");

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, rows: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? "Failed to save difficulties" }, { status: 500 });
  }
}

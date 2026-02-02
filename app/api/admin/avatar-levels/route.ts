import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("avatar_level_thresholds")
    .select("level,min_lifetime_points")
    .order("level", { ascending: true });

  const { data: settings, error: sErr } = await admin
    .from("avatar_level_settings")
    .select("base_jump,difficulty_pct")
    .eq("id", 1)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, levels: data ?? [], settings: settings ?? null });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const payload = Array.isArray(body?.levels) ? body.levels : [body];
  const cleaned = payload
    .map((row: any) => ({
      level: Math.max(1, Math.floor(Number(row?.level ?? 0))),
      min_lifetime_points: Math.max(0, Math.floor(Number(row?.min_lifetime_points ?? 0))),
    }))
    .filter((row: any) => Number.isFinite(row.level));

  if (!cleaned.length) return NextResponse.json({ ok: false, error: "No level data provided" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("avatar_level_thresholds")
    .upsert(cleaned, { onConflict: "level" })
    .select("level,min_lifetime_points");

  const base_jump = Math.max(0, Math.floor(Number(body?.settings?.base_jump ?? 0)));
  const difficulty_pct = Math.max(0, Math.floor(Number(body?.settings?.difficulty_pct ?? 0)));
  if (Number.isFinite(base_jump) && Number.isFinite(difficulty_pct)) {
    const { error: sErr } = await admin
      .from("avatar_level_settings")
      .upsert({ id: 1, base_jump, difficulty_pct }, { onConflict: "id" });
    if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });
  }

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  if (body?.recalc_levels && data?.length) {
    const sorted = (data ?? []).slice().sort((a: any, b: any) => Number(a.min_lifetime_points) - Number(b.min_lifetime_points));
    const { data: students, error: sErr } = await admin
      .from("students")
      .select("id,name,lifetime_points");
    if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });

    const updates = (students ?? []).map((s: any) => {
      if (!s?.name) return null;
      const lifetime = Math.max(0, Math.floor(Number(s.lifetime_points ?? 0)));
      let level = 1;
      for (const row of sorted) {
        const min = Math.max(0, Math.floor(Number(row.min_lifetime_points ?? 0)));
        if (lifetime >= min) level = Math.max(level, Number(row.level ?? 1));
      }
      return { id: s.id, name: s.name, level };
    }).filter(Boolean);

    const chunkSize = 200;
    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize);
      const { error: uErr } = await admin.from("students").upsert(chunk, { onConflict: "id" });
      if (uErr) return NextResponse.json({ ok: false, error: uErr.message }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true, levels: data ?? [] });
}

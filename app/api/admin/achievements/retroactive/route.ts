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

  return { ok: true as const, userId: u.user.id };
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const badge_id = String(body?.badge_id ?? "").trim();
  const confirm = Boolean(body?.confirm);

  if (!badge_id) return NextResponse.json({ ok: false, error: "Missing badge_id" }, { status: 400 });
  if (!confirm) return NextResponse.json({ ok: false, error: "Confirmation required" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: badge, error: bErr } = await admin
    .from("achievement_badges")
    .select("id,name,points_award")
    .eq("id", badge_id)
    .maybeSingle();
  if (bErr) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 });
  if (!badge) return NextResponse.json({ ok: false, error: "Badge not found" }, { status: 404 });

  const targetPoints = Number(badge.points_award ?? 0);
  const { data: rows, error: rErr } = await admin
    .from("student_achievement_badges")
    .select("id,student_id,points_awarded")
    .eq("badge_id", badge_id);
  if (rErr) return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 });

  let adjusted = 0;
  for (const row of rows ?? []) {
    const current = Number((row as any).points_awarded ?? 0);
    const delta = targetPoints - current;
    if (!delta) continue;

    const { error: lErr } = await admin.from("ledger").insert({
      student_id: row.student_id,
      points: delta,
      note: `Badge points adjustment: ${badge.name ?? badge_id}`,
      category: "badge_adjustment",
      created_by: gate.userId,
    });
    if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });

    const { error: uErr } = await admin
      .from("student_achievement_badges")
      .update({ points_awarded: targetPoints })
      .eq("id", row.id);
    if (uErr) return NextResponse.json({ ok: false, error: uErr.message }, { status: 500 });

    const { error: rpcErr } = await admin.rpc("recompute_student_points", { p_student_id: row.student_id });
    if (rpcErr) return NextResponse.json({ ok: false, error: rpcErr.message }, { status: 500 });

    adjusted += 1;
  }

  return NextResponse.json({ ok: true, adjusted });
}

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveParentContext } from "../../../_parentContext";
import { getStudentModifierStack } from "@/lib/modifierStack";

const MAX_PARENT_CHALLENGE_POINTS = 15;

async function hashPin(pin: string) {
  const data = new TextEncoder().encode(pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(req: Request) {
  const ctx = await resolveParentContext(req);
  if (!ctx.ok) {
    const { error, status } = ctx as { ok: false; status: number; error: string };
    return NextResponse.json({ ok: false, error }, { status });
  }

  const admin = supabaseAdmin();
  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  const challenge_id = String(body?.challenge_id ?? body?.challengeId ?? "").trim();
  const parent_pin = String(body?.parent_pin ?? "").trim();

  if (!student_id || !challenge_id) {
    return NextResponse.json({ ok: false, error: "Missing student_id or challenge_id" }, { status: 400 });
  }

  const { data: link } = await admin
    .from("parent_students")
    .select("student_id")
    .eq("parent_id", ctx.parent.id)
    .eq("student_id", student_id)
    .limit(1);
  if (!link?.length) {
    return NextResponse.json({ ok: false, error: "Student not linked to parent" }, { status: 403 });
  }

  if (!ctx.isAdmin) {
    if (!parent_pin) {
      return NextResponse.json({ ok: false, error: "Parent PIN required" }, { status: 403 });
    }
    const { data: parentRow, error: pErr } = await admin
      .from("parents")
      .select("pin_hash")
      .eq("id", ctx.parent.id)
      .maybeSingle();
    if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });
    if (!parentRow?.pin_hash) {
      return NextResponse.json({ ok: false, error: "Parent PIN not set" }, { status: 403 });
    }
    const pinHash = await hashPin(parent_pin);
    if (pinHash !== parentRow.pin_hash) {
      return NextResponse.json({ ok: false, error: "Invalid parent PIN" }, { status: 403 });
    }
  }

  const { data: challenge, error: cErr } = await admin
    .from("challenges")
    .select("id,name,tier,points_awarded,enabled,limit_mode,limit_count,limit_window_days,home_available,home_origin,home_parent_id,home_approved_at")
    .eq("id", challenge_id)
    .maybeSingle();
  if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });
  if (!challenge?.id) return NextResponse.json({ ok: false, error: "Challenge not found" }, { status: 404 });

  const isParentChallenge = String(challenge.home_origin ?? "") === "parent";
  if (isParentChallenge) {
    if (String(challenge.home_parent_id ?? "") !== String(ctx.parent.id)) {
      return NextResponse.json({ ok: false, error: "Challenge not available for this parent" }, { status: 403 });
    }
    if (!challenge.enabled) {
      return NextResponse.json({ ok: false, error: "Challenge pending coach approval" }, { status: 403 });
    }
  } else {
    if (!challenge.home_available || !challenge.enabled) {
      return NextResponse.json({ ok: false, error: "Challenge not available at home" }, { status: 403 });
    }
  }

  let defaultPoints = 0;
  const tierKey = String(challenge?.tier ?? "").toLowerCase().trim();
  if (tierKey) {
    const { data: defaults } = await admin.from("challenge_tier_defaults").select("tier,points");
    const match = (defaults ?? []).find((row: any) => String(row.tier ?? "").toLowerCase().trim() === tierKey);
    defaultPoints = Number(match?.points ?? 0);
  }
  let resolvedPoints = Number(challenge?.points_awarded ?? defaultPoints ?? 0);

  // Apply stacked challenge completion bonus (%), rounded to whole number.
  try {
    const stack = await getStudentModifierStack(student_id);
    const bonusPct = Math.max(0, Number(stack.challenge_completion_bonus_pct ?? 0));
    if (bonusPct > 0 && resolvedPoints > 0) {
      resolvedPoints = Math.max(0, Math.round(resolvedPoints * (1 + bonusPct / 100)));
    }
  } catch {}
  if (isParentChallenge) {
    resolvedPoints = Math.min(MAX_PARENT_CHALLENGE_POINTS, Math.max(0, resolvedPoints || MAX_PARENT_CHALLENGE_POINTS));
  }

  const payload: any = {
    student_id,
    challenge_id,
    completed: true,
    completed_at: new Date().toISOString(),
    tier: challenge?.tier ?? null,
    points_awarded: resolvedPoints || null,
  };

  let allowAward = true;
  const mode = String(challenge?.limit_mode ?? "once").toLowerCase();
  const limitCount = Math.max(1, Number(challenge?.limit_count ?? 1));
  const windowDays = Number(challenge?.limit_window_days ?? 0);
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();

  let windowStart: number | null = null;
  if (mode === "daily") windowStart = now - 1 * dayMs;
  else if (mode === "weekly") windowStart = now - 7 * dayMs;
  else if (mode === "monthly") windowStart = now - 30 * dayMs;
  else if (mode === "yearly") windowStart = now - 365 * dayMs;
  else if (mode === "custom" && windowDays > 0) windowStart = now - windowDays * dayMs;

  try {
    let count = 0;
    if (mode === "once" || mode === "lifetime") {
      const { count: total } = await admin
        .from("challenge_completions")
        .select("id", { count: "exact", head: true })
        .eq("student_id", student_id)
        .eq("challenge_id", challenge_id);
      count = Number(total ?? 0);
    } else if (windowStart !== null) {
      const { count: windowCount } = await admin
        .from("challenge_completions")
        .select("id", { count: "exact", head: true })
        .eq("student_id", student_id)
        .eq("challenge_id", challenge_id)
        .gte("completed_at", new Date(windowStart).toISOString());
      count = Number(windowCount ?? 0);
    }
    if (count >= limitCount) allowAward = false;
  } catch {
    allowAward = true;
  }

  const { data, error } = await admin
    .from("student_challenges")
    .upsert(payload, { onConflict: "student_id,challenge_id" })
    .select("challenge_id,completed,completed_at,tier")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  if (resolvedPoints > 0 && allowAward) {
    const note = `Home Quest: ${challenge?.name ?? challenge?.id ?? "challenge"}`;
    const { error: lErr } = await admin.from("ledger").insert({
      student_id,
      points: resolvedPoints,
      note,
      category: "challenge",
      created_by: ctx.userId,
    });
    if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });
    try {
      await admin.from("challenge_completions").insert({
        student_id,
        challenge_id,
        completed_at: new Date().toISOString(),
        tier: challenge?.tier ?? null,
        points_awarded: resolvedPoints,
      });
    } catch {}

    const rpc = await admin.rpc("recompute_student_points", { p_student_id: student_id });
    if (rpc.error) return NextResponse.json({ ok: false, error: rpc.error.message }, { status: 500 });
  }

  if (!allowAward) {
    return NextResponse.json({
      ok: true,
      row: data ?? null,
      points_awarded: 0,
      warning: "Limit reached for this challenge",
    });
  }

  return NextResponse.json({ ok: true, row: data ?? null, points_awarded: resolvedPoints });
}

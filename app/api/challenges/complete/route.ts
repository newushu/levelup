import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getStudentModifierStack } from "@/lib/modifierStack";

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  const supabase = await supabaseServer();
  const body = await req.json().catch(() => ({}));
  const studentId = String(body?.studentId ?? body?.student_id ?? "").trim();
  const challengeId = String(body?.challengeId ?? body?.challenge_id ?? "").trim();
  const completed = body?.completed !== false;

  if (!studentId || !challengeId) {
    return NextResponse.json({ ok: false, error: "Missing studentId or challengeId" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  let { data: challenge, error: cErr } = await admin
    .from("challenges")
    .select("id,tier,points_awarded,name,limit_mode,limit_count,limit_window_days,daily_limit_count")
    .eq("id", challengeId)
    .maybeSingle();
  if (cErr && String(cErr.message || "").toLowerCase().includes("daily_limit_count")) {
    const retry = await admin
      .from("challenges")
      .select("id,tier,points_awarded,name,limit_mode,limit_count,limit_window_days")
      .eq("id", challengeId)
      .maybeSingle();
    challenge = retry.data as any;
    cErr = retry.error as any;
  }
  if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });

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
    const stack = await getStudentModifierStack(studentId);
    const bonusPct = Math.max(0, Number(stack.challenge_completion_bonus_pct ?? 0));
    if (bonusPct > 0 && resolvedPoints > 0) {
      resolvedPoints = Math.max(0, Math.round(resolvedPoints * (1 + bonusPct / 100)));
    }
  } catch {}

  const payload: any = {
    student_id: studentId,
    challenge_id: challengeId,
    completed,
    completed_at: completed ? new Date().toISOString() : null,
    tier: challenge?.tier ?? null,
    points_awarded: resolvedPoints || null,
  };

  let existingCompleted = false;
  let existingCompletedAt: string | null = null;
  const { data: existing } = await admin
    .from("student_challenges")
    .select("completed,completed_at")
    .eq("student_id", studentId)
    .eq("challenge_id", challengeId)
    .maybeSingle();
  existingCompleted = Boolean(existing?.completed);
  existingCompletedAt = existing?.completed_at ? String(existing.completed_at) : null;

  let allowAward = true;
  if (completed) {
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

    let count = 0;
    try {
      if (mode === "once" || mode === "lifetime") {
        const { count: total } = await admin
          .from("challenge_completions")
          .select("id", { count: "exact", head: true })
          .eq("student_id", studentId)
          .eq("challenge_id", challengeId);
        count = Number(total ?? 0);
      } else if (windowStart !== null) {
        const { count: windowCount } = await admin
          .from("challenge_completions")
          .select("id", { count: "exact", head: true })
          .eq("student_id", studentId)
          .eq("challenge_id", challengeId)
          .gte("completed_at", new Date(windowStart).toISOString());
        count = Number(windowCount ?? 0);
      }
      if (count >= limitCount) allowAward = false;

      if (allowAward) {
        const dailyLimit = Math.max(0, Number(challenge?.daily_limit_count ?? 0));
        if (dailyLimit > 0) {
          const { count: dailyCount } = await admin
            .from("challenge_completions")
            .select("id", { count: "exact", head: true })
            .eq("student_id", studentId)
            .eq("challenge_id", challengeId)
            .gte("completed_at", new Date(now - dayMs).toISOString());
          if (Number(dailyCount ?? 0) >= dailyLimit) allowAward = false;
        }
      }
    } catch {
      allowAward = true;
    }
  }

  let { data, error } = await admin
    .from("student_challenges")
    .upsert(payload, { onConflict: "student_id,challenge_id" })
    .select("challenge_id,completed,completed_at,tier")
    .single();

  if (error && String(error.message || "").includes("column")) {
    const fallback = {
      student_id: studentId,
      challenge_id: challengeId,
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    };
    const retry = await admin
      .from("student_challenges")
      .upsert(fallback, { onConflict: "student_id,challenge_id" })
      .select("challenge_id,completed,completed_at")
      .single();
    data = retry.data as any;
    error = retry.error as any;
  }

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const points = resolvedPoints;
  if (completed && points > 0 && allowAward) {
    const note = `Challenge Complete: ${challenge?.name ?? challenge?.id ?? "challenge"}`;
    const { error: lErr } = await admin.from("ledger").insert({
      student_id: studentId,
      points,
      note,
      category: "challenge",
      created_by: auth.user.id,
    });
    if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });
    try {
      await admin.from("challenge_completions").insert({
        student_id: studentId,
        challenge_id: challengeId,
        completed_at: new Date().toISOString(),
        tier: challenge?.tier ?? null,
        points_awarded: points,
      });
    } catch {}

    const rpc = await admin.rpc("recompute_student_points", { p_student_id: studentId });
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

  return NextResponse.json({ ok: true, row: data ?? null, points_awarded: points });
}

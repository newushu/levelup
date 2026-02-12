import { NextResponse } from "next/server";
import { resolveParentContext } from "../../_parentContext";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const MAX_PARENT_CHALLENGES_PER_STUDENT = 2;
const MAX_PARENT_CHALLENGE_POINTS = 15;

export async function GET(req: Request) {
  const ctx = await resolveParentContext(req);
  if (!ctx.ok) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status });

  const admin = supabaseAdmin();
  const { data: links, error: lErr } = await admin
    .from("parent_students")
    .select("student_id")
    .eq("parent_id", ctx.parent.id);
  if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });

  const studentIds = (links ?? []).map((row: any) => String(row.student_id ?? "")).filter(Boolean);
  const maxParentChallenges = Math.max(0, studentIds.length * MAX_PARENT_CHALLENGES_PER_STUDENT);

  const { data: homeRows, error: hErr } = await admin
    .from("challenges")
    .select("id,name,description,category,tier,points_awarded,enabled,home_available,home_origin,home_parent_id,home_approved_at")
    .eq("home_available", true)
    .eq("enabled", true)
    .or("home_origin.is.null,home_origin.neq.parent")
    .order("tier", { ascending: true })
    .order("name", { ascending: true });
  if (hErr) return NextResponse.json({ ok: false, error: hErr.message }, { status: 500 });

  const { data: parentRows, error: pErr } = await admin
    .from("challenges")
    .select("id,name,description,category,tier,points_awarded,enabled,home_available,home_origin,home_parent_id,home_approved_at,created_at")
    .eq("home_origin", "parent")
    .eq("home_parent_id", ctx.parent.id)
    .order("created_at", { ascending: false });
  if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });

  const parentChallenges = (parentRows ?? []).map((row: any) => ({
    ...row,
    status: row.enabled ? "approved" : "pending",
  }));

  return NextResponse.json({
    ok: true,
    limits: {
      max_parent_challenges: maxParentChallenges,
      current_parent_challenges: parentChallenges.length,
    },
    challenges: {
      available: homeRows ?? [],
      parent_created: parentChallenges,
    },
  });
}

export async function POST(req: Request) {
  const ctx = await resolveParentContext(req);
  if (!ctx.ok) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status });

  const admin = supabaseAdmin();
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();
  const description = String(body?.description ?? "").trim();
  const category = String(body?.category ?? "Home Quest").trim() || "Home Quest";
  const requestedPoints = Number(body?.points_awarded ?? body?.points ?? MAX_PARENT_CHALLENGE_POINTS);
  const points_awarded = Math.min(MAX_PARENT_CHALLENGE_POINTS, Math.max(1, requestedPoints || MAX_PARENT_CHALLENGE_POINTS));

  if (!name) {
    return NextResponse.json({ ok: false, error: "Challenge name required" }, { status: 400 });
  }

  const { data: links, error: lErr } = await admin
    .from("parent_students")
    .select("student_id")
    .eq("parent_id", ctx.parent.id);
  if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });
  const studentCount = (links ?? []).length;
  const maxAllowed = Math.max(0, studentCount * MAX_PARENT_CHALLENGES_PER_STUDENT);

  const { data: existing, error: eErr } = await admin
    .from("challenges")
    .select("id")
    .eq("home_origin", "parent")
    .eq("home_parent_id", ctx.parent.id);
  if (eErr) return NextResponse.json({ ok: false, error: eErr.message }, { status: 500 });
  if ((existing ?? []).length >= maxAllowed) {
    return NextResponse.json({ ok: false, error: "Parent challenge limit reached" }, { status: 400 });
  }

  const id = `parent_${ctx.parent.id}_${Date.now().toString(36)}`;
  const { data, error } = await admin
    .from("challenges")
    .insert({
      id,
      name,
      description: description || null,
      category,
      tier: "bronze",
      points_awarded,
      enabled: false,
      challenge_type: "task",
      limit_mode: "once",
      limit_count: 1,
      home_available: true,
      home_origin: "parent",
      home_parent_id: ctx.parent.id,
      home_requires_approval: true,
      home_approved_at: null,
      home_approved_by: null,
    })
    .select("id,name,description,category,tier,points_awarded,enabled,home_available,home_origin,home_parent_id,home_approved_at")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, challenge: data });
}

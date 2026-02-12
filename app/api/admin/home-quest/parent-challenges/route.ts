import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabase/server";

const MAX_PARENT_CHALLENGE_POINTS = 15;

async function requireCoachOrAdmin() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { ok: false as const, error: "Not logged in" };

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id);
  if (error) return { ok: false as const, error: error.message };

  const hasAccess = (roles ?? []).some((r: any) => {
    const role = String(r.role ?? "").toLowerCase();
    return role === "admin" || role === "coach";
  });
  if (!hasAccess) return { ok: false as const, error: "Coach or admin access required" };

  return { ok: true as const, userId: u.user.id };
}

export async function GET() {
  const gate = await requireCoachOrAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("challenges")
    .select("id,name,description,category,tier,points_awarded,enabled,home_parent_id,home_approved_at,created_at")
    .eq("home_origin", "parent")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const rows = (data ?? []).map((row: any) => ({
    ...row,
    status: row.enabled ? "approved" : "pending",
  }));

  return NextResponse.json({ ok: true, challenges: rows });
}

export async function POST(req: Request) {
  const gate = await requireCoachOrAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const admin = supabaseAdmin();
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  const tier = String(body?.tier ?? "").trim() || "bronze";
  const approve = body?.approve !== false;
  const requestedPoints = body?.points_awarded !== undefined ? Number(body.points_awarded) : null;

  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

  const { data: challenge, error: cErr } = await admin
    .from("challenges")
    .select("id,home_origin,points_awarded")
    .eq("id", id)
    .maybeSingle();
  if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });
  if (!challenge?.id || String(challenge.home_origin ?? "") !== "parent") {
    return NextResponse.json({ ok: false, error: "Parent challenge not found" }, { status: 404 });
  }

  let points_awarded = Number.isFinite(requestedPoints as number)
    ? Number(requestedPoints)
    : Number(challenge.points_awarded ?? MAX_PARENT_CHALLENGE_POINTS);
  if (!Number.isFinite(points_awarded) || points_awarded <= 0) points_awarded = MAX_PARENT_CHALLENGE_POINTS;
  points_awarded = Math.min(MAX_PARENT_CHALLENGE_POINTS, points_awarded);

  const payload: any = {
    tier,
    points_awarded,
  };
  if (approve) {
    payload.enabled = true;
    payload.home_available = true;
    payload.home_approved_at = new Date().toISOString();
    payload.home_approved_by = gate.userId;
    payload.home_requires_approval = false;
  }

  const { error } = await admin.from("challenges").update(payload).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

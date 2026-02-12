import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveParentContext } from "../../_parentContext";

const DEFAULTS = {
  max_points: 50,
  features: {
    games: true,
    home_tracker: true,
    daily_checkin: true,
    quiz: true,
  },
};

const ALLOWED_FEATURES = new Set(["games", "daily_checkin", "quiz"]);

async function hashPin(pin: string) {
  const data = new TextEncoder().encode(pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(req: Request) {
  const ctx = await resolveParentContext(req);
  if (!ctx.ok) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status });

  const admin = supabaseAdmin();
  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  const feature = String(body?.feature ?? "").trim();
  const points = Number(body?.points ?? 0);
  const parent_pin = String(body?.parent_pin ?? "").trim();

  if (!student_id || !feature) {
    return NextResponse.json({ ok: false, error: "Missing student_id or feature" }, { status: 400 });
  }
  if (!ALLOWED_FEATURES.has(feature)) {
    return NextResponse.json({ ok: false, error: "Invalid feature" }, { status: 400 });
  }
  if (!Number.isFinite(points) || points <= 0) {
    return NextResponse.json({ ok: false, error: "Points must be positive" }, { status: 400 });
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

  const { data: settings } = await admin
    .from("home_quest_settings")
    .select("max_points,features")
    .eq("id", "default")
    .maybeSingle();

  const max_points = Number(settings?.max_points ?? DEFAULTS.max_points);
  const features = { ...DEFAULTS.features, ...(settings?.features ?? {}) };

  if (!features[feature as keyof typeof features]) {
    return NextResponse.json({ ok: false, error: "Feature disabled" }, { status: 403 });
  }

  const { data: ledgerRows, error } = await admin
    .from("ledger")
    .select("points")
    .eq("student_id", student_id)
    .eq("category", "home_quest");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const current = (ledgerRows ?? []).reduce((sum: number, row: any) => sum + Number(row.points ?? 0), 0);
  const remaining = Math.max(0, max_points - current);
  if (remaining <= 0) {
    return NextResponse.json({ ok: false, error: "Home Quest cap reached." }, { status: 400 });
  }

  const awardPoints = Math.min(remaining, points);
  const note = `Home Quest (Parent): ${feature.replace(/_/g, " ")}`;
  const { error: insErr } = await admin.from("ledger").insert({
    student_id,
    points: awardPoints,
    note,
    category: "home_quest",
    created_by: ctx.userId,
  });
  if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });

  const rpc = await admin.rpc("recompute_student_points", { p_student_id: student_id });
  if (rpc.error) return NextResponse.json({ ok: false, error: rpc.error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    awarded: awardPoints,
    message: awardPoints < points ? `Cap reached, awarded ${awardPoints} pts.` : `Awarded ${awardPoints} pts.`,
  });
}

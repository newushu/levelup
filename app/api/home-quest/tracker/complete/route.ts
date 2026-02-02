import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const DEFAULTS = {
  max_points: 50,
  features: {
    games: true,
    home_tracker: true,
    daily_checkin: true,
    quiz: true,
  },
};

const TRACKER_POINTS = 5;

function hashPin(pin: string) {
  const data = new TextEncoder().encode(pin);
  return crypto.subtle.digest("SHA-256", data).then((buf) =>
    Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  const tracker_id = String(body?.tracker_id ?? "").trim();
  const parent_pin = String(body?.parent_pin ?? "").trim();

  if (!student_id || !tracker_id || !parent_pin) {
    return NextResponse.json({ ok: false, error: "Missing student_id, tracker_id, or parent_pin" }, { status: 400 });
  }

  const { data: settings } = await supabase
    .from("home_quest_settings")
    .select("max_points,features,parent_pin_hash")
    .eq("id", "default")
    .maybeSingle();

  const features = { ...DEFAULTS.features, ...(settings?.features ?? {}) };
  if (!features.home_tracker) {
    return NextResponse.json({ ok: false, error: "Home Tracker disabled" }, { status: 403 });
  }

  const pinHash = await hashPin(parent_pin);
  let pinOk = Boolean(settings?.parent_pin_hash && pinHash === settings.parent_pin_hash);
  if (!pinOk) {
    const admin = supabaseAdmin();
    const { data: links, error: lErr } = await admin
      .from("parent_students")
      .select("parent_id")
      .eq("student_id", student_id);
    if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });
    const parentIds = (links ?? []).map((row: any) => String(row.parent_id ?? "")).filter(Boolean);
    if (parentIds.length) {
      const { data: parents, error: pErr } = await admin
        .from("parents")
        .select("id,pin_hash")
        .in("id", parentIds);
      if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });
      pinOk = (parents ?? []).some((p: any) => p?.pin_hash && p.pin_hash === pinHash);
    }
  }
  if (!pinOk) {
    return NextResponse.json({ ok: false, error: "Invalid parent PIN" }, { status: 403 });
  }

  const { data: tracker, error: tErr } = await supabase
    .from("home_quest_trackers")
    .select("id,student_id,completed_at")
    .eq("id", tracker_id)
    .eq("student_id", student_id)
    .maybeSingle();
  if (tErr) return NextResponse.json({ ok: false, error: tErr.message }, { status: 500 });
  if (!tracker) return NextResponse.json({ ok: false, error: "Tracker not found" }, { status: 404 });
  if (tracker.completed_at) return NextResponse.json({ ok: true, message: "Already completed." });

  const max_points = Number(settings?.max_points ?? DEFAULTS.max_points);
  const { data: ledgerRows, error } = await supabase
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

  const awardPoints = Math.min(remaining, TRACKER_POINTS);

  const { error: updErr } = await supabase
    .from("home_quest_trackers")
    .update({ completed_at: new Date().toISOString(), points_awarded: awardPoints })
    .eq("id", tracker_id);
  if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });

  const { error: insErr } = await supabase.from("ledger").insert({
    student_id,
    points: awardPoints,
    note: "Home Quest: tracker",
    category: "home_quest",
    created_by: u.user.id,
  });
  if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });

  const rpc = await supabase.rpc("recompute_student_points", { p_student_id: student_id });
  if (rpc.error) return NextResponse.json({ ok: false, error: rpc.error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    awarded: awardPoints,
    message: awardPoints < TRACKER_POINTS ? `Cap reached, awarded ${awardPoints} pts.` : `Awarded ${awardPoints} pts.`,
  });
}

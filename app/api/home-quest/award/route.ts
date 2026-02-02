import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

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

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  const feature = String(body?.feature ?? "").trim();
  const points = Number(body?.points ?? 0);

  if (!student_id || !feature) {
    return NextResponse.json({ ok: false, error: "Missing student_id or feature" }, { status: 400 });
  }
  if (!ALLOWED_FEATURES.has(feature)) {
    return NextResponse.json({ ok: false, error: "Invalid feature" }, { status: 400 });
  }
  if (!Number.isFinite(points) || points <= 0) {
    return NextResponse.json({ ok: false, error: "Points must be positive" }, { status: 400 });
  }

  const { data: settings } = await supabase
    .from("home_quest_settings")
    .select("max_points,features")
    .eq("id", "default")
    .maybeSingle();

  const max_points = Number(settings?.max_points ?? DEFAULTS.max_points);
  const features = { ...DEFAULTS.features, ...(settings?.features ?? {}) };

  if (!features[feature as keyof typeof features]) {
    return NextResponse.json({ ok: false, error: "Feature disabled" }, { status: 403 });
  }

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

  const awardPoints = Math.min(remaining, points);

  const note = `Home Quest: ${feature.replace(/_/g, " ")}`;
  const { error: insErr } = await supabase.from("ledger").insert({
    student_id,
    points: awardPoints,
    note,
    category: "home_quest",
    created_by: u.user.id,
  });
  if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });

  const rpc = await supabase.rpc("recompute_student_points", { p_student_id: student_id });
  if (rpc.error) return NextResponse.json({ ok: false, error: rpc.error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    awarded: awardPoints,
    message: awardPoints < points ? `Cap reached, awarded ${awardPoints} pts.` : `Awarded ${awardPoints} pts.`,
  });
}

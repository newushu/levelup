import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseServer } from "@/lib/supabase/server";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  const supabase = await supabaseServer();
  const body = await req.json().catch(() => ({}));
  const class_id = String(body?.class_id ?? "").trim();
  const student_id = String(body?.student_id ?? "").trim();
  const award_type_id = String(body?.award_type_id ?? "").trim();
  const day = String(body?.award_date ?? "").trim() || todayISO();

  if (!class_id || !student_id || !award_type_id) {
    return NextResponse.json({ ok: false, error: "Missing class_id, student_id, or award_type_id" }, { status: 400 });
  }

  const { data: active, error: sErr } = await supabase
    .from("class_sessions")
    .select("id,ended_at,started_at")
    .eq("class_id", class_id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });
  if (!active?.id) return NextResponse.json({ ok: false, error: "No class session found." }, { status: 400 });
  if (active.ended_at) {
    const lockAt = new Date(active.ended_at).getTime() + 30 * 60 * 1000;
    if (Date.now() > lockAt) {
      return NextResponse.json({ ok: false, error: "Spotlight selections are locked 30 minutes after class ends." }, { status: 400 });
    }
  }

  const { data: awardRow, error: findErr } = await supabase
    .from("class_awards")
    .select("id,points_awarded")
    .eq("class_id", class_id)
    .eq("student_id", student_id)
    .eq("award_type_id", award_type_id)
    .eq("session_id", active.id)
    .maybeSingle();
  if (findErr) return NextResponse.json({ ok: false, error: findErr.message }, { status: 500 });
  if (!awardRow?.id) return NextResponse.json({ ok: true, removed: false });

  const { error: delErr } = await supabase
    .from("class_awards")
    .delete()
    .eq("id", awardRow.id);
  if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });

  const points = Number(awardRow.points_awarded ?? 0);
  if (points > 0) {
    const { error: lErr } = await supabase.from("ledger").insert({
      student_id,
      points: -Math.abs(points),
      note: "Spotlight Stars: removed",
      category: "class_award",
      created_by: auth.user.id,
    });
    if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });
  }

  const rpc = await supabase.rpc("recompute_student_points", { p_student_id: student_id });
  if (rpc.error) return NextResponse.json({ ok: false, error: rpc.error.message }, { status: 500 });

  return NextResponse.json({ ok: true, removed: true });
}

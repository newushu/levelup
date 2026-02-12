import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabase/server";

async function getUserScope() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { ok: false as const, error: "Not logged in" };

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id);

  if (error) return { ok: false as const, error: error.message };
  const roleList = (roles ?? []).map((r: any) => String(r.role ?? "").toLowerCase());
  const isAdmin = roleList.includes("admin");
  const isCoach = roleList.includes("coach");

  return { ok: true as const, userId: u.user.id, isAdmin, isCoach };
}

type RefinementSelection = {
  taolu_form_id: string;
  section_number: number;
  code_id: string | null;
  code_number?: string;
  code_name?: string;
  deduction_ids: string[];
  notes?: string[];
  fixed: boolean;
};

type NewDeduction = {
  taolu_form_id: string;
  section_number: number;
  code_id: string;
  note?: string | null;
};

export async function POST(req: Request) {
  const gate = await getUserScope();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  if (!gate.isAdmin && !gate.isCoach) {
    return NextResponse.json({ ok: false, error: "Coach access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  const window_days = Number(body?.window_days ?? 7);
  const allowedWindows = new Set([7, 30, 90]);
  const windowDays = allowedWindows.has(window_days) ? window_days : 7;
  const selections = Array.isArray(body?.selections) ? (body.selections as RefinementSelection[]) : [];
  const new_deductions = Array.isArray(body?.new_deductions) ? (body.new_deductions as NewDeduction[]) : [];

  if (!student_id) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });

  const fixed = selections.filter((s) => s.fixed);
  const missed = selections.filter((s) => !s.fixed);

  const fixedCount = fixed.length;
  const missedCount = missed.length;
  const newCount = new_deductions.length;
  const newPenalty = 3;

  const pointsFixed = fixedCount * 5;
  const pointsMissed = missedCount * 5;
  const pointsNew = newCount * newPenalty;
  const pointsNet = pointsFixed - pointsMissed - pointsNew;

  const now = new Date();
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const admin = supabaseAdmin();

  const { data: round, error: rErr } = await admin
    .from("taolu_refinement_rounds")
    .insert({
      student_id,
      window_days: windowDays,
      window_start: windowStart.toISOString(),
      window_end: now.toISOString(),
      points_fixed: pointsFixed,
      points_missed: pointsMissed,
      points_new: pointsNew,
      points_net: pointsNet,
      created_by: gate.userId,
    })
    .select("id,student_id,points_fixed,points_missed,points_new,points_net,created_at")
    .single();

  if (rErr || !round) {
    return NextResponse.json({ ok: false, error: rErr?.message || "Failed to create refinement round" }, { status: 500 });
  }

  if (selections.length) {
    const items = selections.map((s) => ({
      round_id: round.id,
      student_id,
      taolu_form_id: s.taolu_form_id,
      section_number: Number(s.section_number),
      code_id: s.code_id,
      code_number: s.code_number ?? null,
      code_name: s.code_name ?? null,
      status: s.fixed ? "fixed" : "missed",
      deduction_ids: s.deduction_ids ?? [],
      note_samples: s.notes ?? [],
    }));

    const { error: iErr } = await admin.from("taolu_refinement_items").insert(items);
    if (iErr) return NextResponse.json({ ok: false, error: iErr.message }, { status: 500 });
  }

  const refinementDeductions: any[] = [];
  missed.forEach((s) => {
    const ids = Array.isArray(s.deduction_ids) ? s.deduction_ids : [];
    const note = (s.notes ?? [])[0] ?? null;
    if (!ids.length) {
      refinementDeductions.push({
        student_id,
        taolu_form_id: s.taolu_form_id,
        section_number: Number(s.section_number),
        code_id: s.code_id,
        note,
        kind: "missed",
        source_round_id: round.id,
      });
      return;
    }
    ids.forEach(() => {
      refinementDeductions.push({
        student_id,
        taolu_form_id: s.taolu_form_id,
        section_number: Number(s.section_number),
        code_id: s.code_id,
        note,
        kind: "missed",
        source_round_id: round.id,
      });
    });
  });

  new_deductions.forEach((d) => {
    refinementDeductions.push({
      student_id,
      taolu_form_id: d.taolu_form_id,
      section_number: Number(d.section_number),
      code_id: d.code_id,
      note: d.note ?? null,
      kind: "new",
      source_round_id: round.id,
    });
  });

  if (refinementDeductions.length) {
    const { error: dErr } = await admin.from("taolu_refinement_deductions").insert(refinementDeductions);
    if (dErr) return NextResponse.json({ ok: false, error: dErr.message }, { status: 500 });
  }

  const note = `Taolu Refinement • ${windowDays}d • +${pointsFixed} / -${pointsMissed} / -${pointsNew}`;
  const { error: ledErr } = await admin.from("ledger").insert({
    student_id,
    points: pointsNet,
    note: note.slice(0, 200),
    category: "taolu_refinement",
    source_id: round.id,
    source_type: "taolu_refinement",
    created_by: gate.userId,
  });

  if (ledErr) return NextResponse.json({ ok: false, error: ledErr.message }, { status: 500 });

  const rpc = await admin.rpc("recompute_student_points", { p_student_id: student_id });
  if (rpc.error) return NextResponse.json({ ok: false, error: rpc.error.message }, { status: 500 });

  return NextResponse.json({ ok: true, round });
}

import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const left_student_id = String(body?.left_student_id ?? "").trim();
  const right_student_id = String(body?.right_student_id ?? "").trim();
  const battle_mode = String(body?.battle_mode ?? "duel").trim() || "duel";
  const rawParticipants = Array.isArray(body?.participant_ids) ? body.participant_ids : [];
  const rawTeamA = Array.isArray(body?.team_a_ids) ? body.team_a_ids : [];
  const rawTeamB = Array.isArray(body?.team_b_ids) ? body.team_b_ids : [];
  const skill_id = String(body?.skill_id ?? "").trim();
  const repetitions_target = Math.max(1, Math.min(20, Number(body?.repetitions_target ?? 5)));
  const requested_wager = Math.max(0, Number(body?.wager_amount ?? 0));
  const requested_points_per_rep = Math.max(3, Number(body?.points_per_rep ?? 5));
  const requestedSource = String(body?.created_source ?? "").trim().toLowerCase();
  const created_source = requestedSource === "skill_pulse" ? "skill_pulse" : "admin";

  const normalizeIds = (items: any[]) =>
    Array.from(
      new Set(
        items
          .map((id) => String(id ?? "").trim())
          .filter((id) => id && id !== "null" && id !== "undefined")
      )
    );

  let participant_ids: string[] = [];
  let team_a_ids: string[] = [];
  let team_b_ids: string[] = [];

  if (battle_mode === "teams") {
    team_a_ids = normalizeIds(rawTeamA);
    team_b_ids = normalizeIds(rawTeamB);
    const overlap = team_a_ids.filter((id) => team_b_ids.includes(id));
    if (overlap.length) {
      return NextResponse.json({ ok: false, error: "Students cannot be on both teams." }, { status: 400 });
    }
    participant_ids = normalizeIds([...team_a_ids, ...team_b_ids]);
    if (team_a_ids.length < 1 || team_b_ids.length < 1) {
      return NextResponse.json({ ok: false, error: "Both teams need at least one student." }, { status: 400 });
    }
  } else if (battle_mode === "ffa") {
    participant_ids = normalizeIds(rawParticipants);
  } else {
    participant_ids = normalizeIds([left_student_id, right_student_id]);
  }

  if (!participant_ids.length || !skill_id) {
    return NextResponse.json({ ok: false, error: "Missing student/skill" }, { status: 400 });
  }
  if (participant_ids.length < 2) {
    return NextResponse.json({ ok: false, error: "Battle needs at least 2 students." }, { status: 400 });
  }
  if (participant_ids.length !== new Set(participant_ids).size) {
    return NextResponse.json({ ok: false, error: "Duplicate students are not allowed." }, { status: 400 });
  }
  if (participant_ids.length === 2 && participant_ids[0] === participant_ids[1]) {
    return NextResponse.json({ ok: false, error: "Students must be different" }, { status: 400 });
  }

  const { data: balances, error: balErr } = await supabase
    .from("students")
    .select("id,points_total")
    .in("id", participant_ids);
  if (balErr) return NextResponse.json({ ok: false, error: balErr.message }, { status: 500 });
  const minBalance = Math.min(
    ...participant_ids.map((id) => Number(balances?.find((s: any) => s.id === id)?.points_total ?? 0))
  );

  let wager_amount = 0;
  let wager_pct = 5;

  if (battle_mode === "ffa" && requested_wager <= 0) {
    return NextResponse.json({ ok: false, error: "FFA battles must use wager mode." }, { status: 400 });
  }

  if (requested_wager > 0) {
    if (minBalance < 15) {
      return NextResponse.json({ ok: false, error: "Both students need at least 15 points to wager." }, { status: 400 });
    }
    const maxWager = Math.min(100, minBalance);
    if (requested_wager < 15) {
      return NextResponse.json({ ok: false, error: "Minimum wager is 15 points." }, { status: 400 });
    }
    wager_amount = Math.max(15, Math.min(maxWager, requested_wager));
  } else {
    const maxPerRep = Math.floor(minBalance / Math.max(1, repetitions_target));
    if (maxPerRep < 3) {
      return NextResponse.json({ ok: false, error: "Not enough points for min 3 per rep." }, { status: 400 });
    }
    wager_pct = Math.max(3, Math.min(maxPerRep, requested_points_per_rep));
  }

  const battleLeftId = participant_ids[0] ?? left_student_id;
  const battleRightId = participant_ids[1] ?? right_student_id;

  const { data, error } = await supabase
    .from("battle_trackers")
    .insert({
      left_student_id: battleLeftId,
      right_student_id: battleRightId,
      skill_id,
      repetitions_target,
      wager_amount,
      wager_pct,
      battle_mode,
      participant_ids,
      team_a_ids,
      team_b_ids,
      created_by: u.user.id,
      created_source,
    })
    .select("id,left_student_id,right_student_id,skill_id,repetitions_target,wager_amount,wager_pct,battle_mode,participant_ids,team_a_ids,team_b_ids,created_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, battle: data });
}

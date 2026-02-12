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
  const rawTeamC = Array.isArray(body?.team_c_ids) ? body.team_c_ids : [];
  const rawTeamD = Array.isArray(body?.team_d_ids) ? body.team_d_ids : [];
  const skill_id = String(body?.skill_id ?? "").trim();
  const battle_meta = body?.battle_meta ?? {};
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
  let team_c_ids: string[] = [];
  let team_d_ids: string[] = [];

  if (battle_mode === "teams" || battle_mode === "lanes") {
    team_a_ids = normalizeIds(rawTeamA);
    team_b_ids = normalizeIds(rawTeamB);
    team_c_ids = normalizeIds(rawTeamC);
    team_d_ids = normalizeIds(rawTeamD);
    const overlap = [...team_a_ids, ...team_b_ids, ...team_c_ids, ...team_d_ids].filter(
      (id, idx, all) => all.indexOf(id) !== idx
    );
    if (overlap.length) {
      return NextResponse.json({ ok: false, error: "Students cannot be on both teams." }, { status: 400 });
    }
    participant_ids = normalizeIds([...team_a_ids, ...team_b_ids, ...team_c_ids, ...team_d_ids]);
    if (team_a_ids.length < 1 || team_b_ids.length < 1) {
      return NextResponse.json({ ok: false, error: "Both teams need at least one student." }, { status: 400 });
    }
    if (battle_mode === "lanes") {
      if (team_a_ids.length < 2 || team_b_ids.length < 2) {
        return NextResponse.json({ ok: false, error: "Skill Lanes needs at least 2 players per team." }, { status: 400 });
      }
      if (team_a_ids.length !== team_b_ids.length) {
        return NextResponse.json({ ok: false, error: "Skill Lanes teams must be the same size." }, { status: 400 });
      }
      const categories = Array.isArray(battle_meta?.categories) ? battle_meta.categories : [];
      if (categories.length < 1) {
        return NextResponse.json({ ok: false, error: "Skill Lanes needs at least 1 category." }, { status: 400 });
      }
      const categorySkills = battle_meta?.category_skills ?? {};
      const skillMin = Math.max(1, Math.max(team_a_ids.length, team_b_ids.length) > 3 ? 3 : 1);
      const allCatsHaveSkills = categories.every(
        (cat: string) => Array.isArray(categorySkills[cat]) && categorySkills[cat].length >= skillMin
      );
      if (!allCatsHaveSkills) {
        return NextResponse.json(
          { ok: false, error: `Each category needs at least ${skillMin} skills selected.` },
          { status: 400 }
        );
      }
      const assignments = battle_meta?.assignments ?? {};
      const normalizeCategories = (value: any) => {
        if (Array.isArray(value)) {
          const seen = new Set<string>();
          return value
            .map((entry) => String(entry ?? "").trim())
            .filter((entry) => entry)
            .filter((entry) => {
              if (seen.has(entry)) return false;
              seen.add(entry);
              return true;
            });
        }
        const single = String(value ?? "").trim();
        return single ? [single] : [];
      };
      const allowed = new Set(categories.map((cat: string) => String(cat)));
      for (const id of participant_ids) {
        const cats = normalizeCategories(assignments[id]);
        if (!cats.length) {
          return NextResponse.json({ ok: false, error: "All players must have at least one category." }, { status: 400 });
        }
        if (cats.some((cat) => !allowed.has(cat))) {
          return NextResponse.json({ ok: false, error: "Invalid category assignment." }, { status: 400 });
        }
      }
    }
    if (battle_mode === "teams") {
      const teams = [team_a_ids, team_b_ids, team_c_ids, team_d_ids].filter((t) => t.length);
      if (teams.length < 2) {
        return NextResponse.json({ ok: false, error: "Battle Pulse teams need at least two teams." }, { status: 400 });
      }
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

  const normalizedBattleMeta =
    battle_mode === "teams"
      ? {
          ...(battle_meta ?? {}),
          team_ids: [team_a_ids, team_b_ids, team_c_ids, team_d_ids].filter((t) => t.length),
        }
      : battle_meta ?? {};

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
      battle_meta: normalizedBattleMeta,
      created_by: u.user.id,
      created_source,
    })
    .select("id,left_student_id,right_student_id,skill_id,repetitions_target,wager_amount,wager_pct,battle_mode,participant_ids,team_a_ids,team_b_ids,battle_meta,created_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, battle: data });
}

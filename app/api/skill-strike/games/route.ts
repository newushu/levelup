import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildDeck, dealHands, type SkillStrikePlayer, type SkillStrikeState } from "@/lib/skillStrike";

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function buildTurnOrder(teamA: SkillStrikePlayer[], teamB: SkillStrikePlayer[]) {
  const order: string[] = [];
  const max = Math.max(teamA.length, teamB.length);
  for (let i = 0; i < max; i += 1) {
    if (teamA[i]) order.push(teamA[i].id);
    if (teamB[i]) order.push(teamB[i].id);
  }
  return order;
}

export async function GET() {
  try {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("skill_strike_games")
      .select("id,code,status,created_at,started_at,ended_at")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, games: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? "Failed to load games" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const teamAIds = Array.isArray(body?.team_a_ids) ? body.team_a_ids.map(String).filter(Boolean) : [];
    const teamBIds = Array.isArray(body?.team_b_ids) ? body.team_b_ids.map(String).filter(Boolean) : [];
    if (!teamAIds.length || !teamBIds.length) {
      return NextResponse.json({ ok: false, error: "Select Team A and Team B players." }, { status: 400 });
    }

    const admin = supabaseAdmin();

    const { data: settings } = await admin
      .from("skill_strike_settings")
      .select("hp_default,max_team_size,max_effects_in_play")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const hpStart = Math.max(1, Number(body?.hp_start ?? settings?.hp_default ?? 50));
    const maxTeamSize = Math.max(2, Number(settings?.max_team_size ?? 4));
    const maxEffects = Math.max(1, Number(settings?.max_effects_in_play ?? 3));

    const teamA = teamAIds.slice(0, maxTeamSize);
    const teamB = teamBIds.slice(0, maxTeamSize);
    const ids = Array.from(new Set([...teamA, ...teamB]));

    const { data: students, error: sErr } = await admin
      .from("students")
      .select("id,name,level,points_total")
      .in("id", ids);
    if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });

    const byId = new Map((students ?? []).map((s: any) => [String(s.id), s]));
    const teamAPlayers: SkillStrikePlayer[] = teamA.map((id, idx) => {
      const s: any = byId.get(id) ?? {};
      return { id, name: s.name ?? "Student", level: s.level ?? 1, points: s.points_total ?? 0, team: "a", seat: idx };
    });
    const teamBPlayers: SkillStrikePlayer[] = teamB.map((id, idx) => {
      const s: any = byId.get(id) ?? {};
      return { id, name: s.name ?? "Student", level: s.level ?? 1, points: s.points_total ?? 0, team: "b", seat: idx };
    });

    const { data: defs, error: dErr } = await admin
      .from("skill_strike_card_defs")
      .select("id,card_type,category,damage,shield_value,copies,image_url,enabled");
    if (dErr) return NextResponse.json({ ok: false, error: dErr.message }, { status: 500 });

    const drawPile = buildDeck(defs ?? []);
    const players = [...teamAPlayers, ...teamBPlayers];
    const dealt = dealHands(drawPile, players, 5);

    const order = buildTurnOrder(teamAPlayers, teamBPlayers);
    const activePlayerId = order[0] ?? teamAPlayers[0]?.id ?? teamBPlayers[0]?.id ?? "";
    const activeTeam = teamAPlayers.some((p) => p.id === activePlayerId) ? "a" : "b";

    const state: SkillStrikeState = {
      settings: {
        hp_start: hpStart,
        max_team_size: maxTeamSize,
        max_effects_in_play: maxEffects,
      },
      teams: {
        a: { hp: hpStart, players: teamAPlayers, block_count: 0, effects_in_play: [] },
        b: { hp: hpStart, players: teamBPlayers, block_count: 0, effects_in_play: [] },
      },
      turn: {
        order,
        index: 0,
        active_team: activeTeam,
        active_player_id: activePlayerId,
      },
      deck: {
        draw: dealt.deck,
        discard: [],
      },
      hands: dealt.hands,
      pending_attack: null,
      turn_number: 1,
      turn_effects_played: [],
      started_at: new Date().toISOString(),
    };

    let code = makeCode();
    for (let i = 0; i < 3; i += 1) {
      const { data: existing } = await admin.from("skill_strike_games").select("id").eq("code", code).maybeSingle();
      if (!existing) break;
      code = makeCode();
    }

    const { data: created, error: cErr } = await admin
      .from("skill_strike_games")
      .insert({
        code,
        status: "active",
        state,
        started_at: new Date().toISOString(),
      })
      .select("id,code,status,created_at,started_at")
      .single();

    if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, game: created, state });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? "Failed to create game" }, { status: 500 });
  }
}

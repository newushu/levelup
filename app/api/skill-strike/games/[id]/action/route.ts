import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ensureHandSize, nextTurn, type SkillStrikeCard, type SkillStrikeState } from "@/lib/skillStrike";

function findTeam(state: SkillStrikeState, playerId: string): "a" | "b" | null {
  if (state.teams.a.players.some((p) => p.id === playerId)) return "a";
  if (state.teams.b.players.some((p) => p.id === playerId)) return "b";
  return null;
}

function pickDefender(state: SkillStrikeState, attackerId: string): string {
  const attackerTeam = findTeam(state, attackerId);
  if (!attackerTeam) return "";
  const opponentTeam = attackerTeam === "a" ? state.teams.b : state.teams.a;
  const attacker = (attackerTeam === "a" ? state.teams.a.players : state.teams.b.players).find((p) => p.id === attackerId);
  const seat = attacker?.seat ?? 0;
  const bySeat = opponentTeam.players.find((p) => p.seat === seat);
  return bySeat?.id ?? opponentTeam.players[0]?.id ?? "";
}

function removeCardFromHand(state: SkillStrikeState, playerId: string, cardId: string) {
  const hand = state.hands[playerId] ?? [];
  const next = hand.filter((c) => c.id !== cardId);
  return { ...state, hands: { ...state.hands, [playerId]: next } };
}

function findCardInHand(state: SkillStrikeState, playerId: string, cardId: string): SkillStrikeCard | null {
  return (state.hands[playerId] ?? []).find((c) => c.id === cardId) ?? null;
}

function consumeEffect(
  effects: Array<{ card: SkillStrikeCard; placed_turn: number }>,
  turnNumber: number
) {
  const available = effects.filter((e) => e.placed_turn < turnNumber);
  const negate = available.find((e) => e.card.type === "negate");
  if (negate) {
    return {
      effect: negate,
      remaining: effects.filter((e) => e !== negate),
      damage: 0,
      used: true,
    };
  }
  const shields = available.filter((e) => e.card.type === "shield");
  if (!shields.length) return { effect: null, remaining: effects, damage: null, used: false };
  const best = shields.sort((a, b) => (b.card.shield_value ?? 0) - (a.card.shield_value ?? 0))[0];
  const shieldValue = Number(best.card.shield_value ?? 0);
  return {
    effect: best,
    remaining: effects.filter((e) => e !== best),
    damage: -shieldValue,
    used: true,
  };
}

export async function POST(req: NextRequest, context: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const { id } = await Promise.resolve(context.params);
    const safeId = String(id ?? "");
    if (!safeId) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    const body = await req.json();
    const action = String(body?.action ?? "");

    const admin = supabaseAdmin();
    const { data: game, error: gErr } = await admin
      .from("skill_strike_games")
      .select("id,state,status")
      .eq("id", safeId)
      .single();
    if (gErr) return NextResponse.json({ ok: false, error: gErr.message }, { status: 500 });

    let state = (game?.state ?? {}) as SkillStrikeState;

    if (action === "play_effect") {
      const playerId = String(body?.player_id ?? "");
      const cardId = String(body?.card_id ?? "");
      if (!playerId || !cardId) return NextResponse.json({ ok: false, error: "Missing player/card" }, { status: 400 });
      if (state.turn.active_player_id !== playerId) {
        return NextResponse.json({ ok: false, error: "Not your turn" }, { status: 400 });
      }
      const team = findTeam(state, playerId);
      if (!team) return NextResponse.json({ ok: false, error: "Player not in game" }, { status: 400 });
      const card = findCardInHand(state, playerId, cardId);
      if (!card || (card.type !== "shield" && card.type !== "negate")) {
        return NextResponse.json({ ok: false, error: "Invalid effect card" }, { status: 400 });
      }
      const effects = state.teams[team].effects_in_play ?? [];
      if (effects.length >= state.settings.max_effects_in_play) {
        return NextResponse.json({ ok: false, error: "Max effects already in play" }, { status: 400 });
      }
      const teamTurn = state.turn_effects_played.find((t) => t.team === team && t.turn === state.turn_number);
      if (teamTurn && teamTurn.count >= 2) {
        return NextResponse.json({ ok: false, error: "Max 2 effects per turn" }, { status: 400 });
      }
      state = removeCardFromHand(state, playerId, cardId);
      const nextEffects = [...effects, { card, placed_turn: state.turn_number }];
      const nextTurnEffects = state.turn_effects_played.filter((t) => !(t.team === team && t.turn === state.turn_number));
      nextTurnEffects.push({ team, count: (teamTurn?.count ?? 0) + 1, turn: state.turn_number });
      state = {
        ...state,
        teams: {
          ...state.teams,
          [team]: { ...state.teams[team], effects_in_play: nextEffects },
        },
        turn_effects_played: nextTurnEffects,
      };
    }

    if (action === "play_attack") {
      const playerId = String(body?.player_id ?? "");
      const cardId = String(body?.card_id ?? "");
      const skillId = String(body?.skill_id ?? "");
      if (!playerId || !cardId) return NextResponse.json({ ok: false, error: "Missing player/card" }, { status: 400 });
      if (state.pending_attack) {
        return NextResponse.json({ ok: false, error: "Resolve the current attack first" }, { status: 400 });
      }
      if (state.turn.active_player_id !== playerId) {
        return NextResponse.json({ ok: false, error: "Not your turn" }, { status: 400 });
      }
      const team = findTeam(state, playerId);
      if (!team) return NextResponse.json({ ok: false, error: "Player not in game" }, { status: 400 });
      const card = findCardInHand(state, playerId, cardId);
      if (!card || (card.type !== "attack" && card.type !== "joker")) {
        return NextResponse.json({ ok: false, error: "Invalid attack card" }, { status: 400 });
      }
      const defenderId = String(body?.defender_id ?? "") || pickDefender(state, playerId);
      const damage = Math.max(1, Number(card.damage ?? 5));
      state = removeCardFromHand(state, playerId, cardId);
      state = {
        ...state,
        pending_attack: {
          attacker_team: team,
          attacker_id: playerId,
          defender_id: defenderId,
          card,
          category: card.category ?? null,
          skill_id: skillId || null,
          damage,
          created_at: new Date().toISOString(),
        },
      };
    }

    if (action === "resolve_attack") {
      const success = Boolean(body?.success);
      const pending = state.pending_attack;
      if (!pending) return NextResponse.json({ ok: false, error: "No pending attack" }, { status: 400 });
      const defenderTeam = pending.attacker_team === "a" ? "b" : "a";
      const defender = state.teams[defenderTeam];
      const attacker = state.teams[pending.attacker_team];
      let damage = pending.damage;
      let effects = defender.effects_in_play ?? [];

      if (success) {
        const nextBlock = defender.block_count + 1;
        let attackerHp = attacker.hp;
        let defenderBlock = nextBlock;
        if (nextBlock >= 3) {
          attackerHp = Math.max(0, attackerHp - 3);
          defenderBlock = 0;
        }
        state = {
          ...state,
          teams: {
            ...state.teams,
            [defenderTeam]: { ...defender, block_count: defenderBlock },
            [pending.attacker_team]: { ...attacker, hp: attackerHp },
          },
          deck: { ...state.deck, discard: [...state.deck.discard, pending.card] },
          pending_attack: null,
        };
      } else {
        const consumed = consumeEffect(effects, state.turn_number);
        effects = consumed.remaining;
        if (consumed.used) {
          if (consumed.damage === 0) {
            damage = 0;
          } else {
            damage = Math.max(0, damage + (consumed.damage ?? 0));
          }
        }
        const nextHp = Math.max(0, defender.hp - damage);
        state = {
          ...state,
          teams: {
            ...state.teams,
            [defenderTeam]: { ...defender, hp: nextHp, effects_in_play: effects, block_count: 0 },
          },
          deck: { ...state.deck, discard: [...state.deck.discard, pending.card] },
          pending_attack: null,
        };
      }
    }

    if (action === "end_turn") {
      const activePlayer = state.turn.active_player_id;
      state = ensureHandSize(state, activePlayer, 5);
      state = nextTurn(state);
    }

    const { data: updated, error: uErr } = await admin
      .from("skill_strike_games")
      .update({ state })
      .eq("id", safeId)
      .select("id,state")
      .single();

    if (uErr) return NextResponse.json({ ok: false, error: uErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, state: updated.state });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? "Failed to update game" }, { status: 500 });
  }
}

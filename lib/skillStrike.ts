export type SkillStrikeCardDef = {
  id: string;
  card_type: "attack" | "shield" | "negate" | "joker";
  category?: string | null;
  damage?: number | null;
  shield_value?: number | null;
  copies: number;
  image_url?: string | null;
  enabled?: boolean | null;
};

export type SkillStrikeCard = {
  id: string;
  def_id: string;
  type: "attack" | "shield" | "negate" | "joker";
  category?: string | null;
  damage?: number | null;
  shield_value?: number | null;
  image_url?: string | null;
  label: string;
};

export type SkillStrikePlayer = {
  id: string;
  name: string;
  level?: number | null;
  points?: number | null;
  avatar_path?: string | null;
  team: "a" | "b";
  seat: number;
};

export type SkillStrikeState = {
  settings: {
    hp_start: number;
    max_team_size: number;
    max_effects_in_play: number;
  };
  teams: {
    a: {
      hp: number;
      players: SkillStrikePlayer[];
      block_count: number;
      effects_in_play: Array<{ card: SkillStrikeCard; placed_turn: number }>;
    };
    b: {
      hp: number;
      players: SkillStrikePlayer[];
      block_count: number;
      effects_in_play: Array<{ card: SkillStrikeCard; placed_turn: number }>;
    };
  };
  turn: {
    order: string[];
    index: number;
    active_team: "a" | "b";
    active_player_id: string;
  };
  deck: {
    draw: SkillStrikeCard[];
    discard: SkillStrikeCard[];
  };
  hands: Record<string, SkillStrikeCard[]>;
  pending_attack?: {
    attacker_team: "a" | "b";
    attacker_id: string;
    defender_id: string;
    card: SkillStrikeCard;
    category?: string | null;
    skill_id?: string | null;
    damage: number;
    created_at: string;
  } | null;
  turn_number: number;
  turn_effects_played: { team: "a" | "b"; count: number; turn: number }[];
  started_at?: string | null;
};

function randomId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function shuffle<T>(list: T[]) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildDeck(defs: SkillStrikeCardDef[]) {
  const cards: SkillStrikeCard[] = [];
  defs
    .filter((d) => d.enabled !== false)
    .forEach((def) => {
      const copies = Math.max(0, Number(def.copies ?? 0));
      for (let i = 0; i < copies; i += 1) {
        const label =
          def.card_type === "attack"
            ? `${def.category ?? "Attack"} ${def.damage ?? ""}`.trim()
            : def.card_type === "shield"
            ? `Shield -${def.shield_value ?? 1}`
            : def.card_type === "negate"
            ? "Negate"
            : "Joker";
        cards.push({
          id: randomId(),
          def_id: def.id,
          type: def.card_type,
          category: def.category ?? null,
          damage: def.damage ?? null,
          shield_value: def.shield_value ?? null,
          image_url: def.image_url ?? null,
          label,
        });
      }
    });
  return shuffle(cards);
}

export function dealHands(deck: SkillStrikeCard[], players: SkillStrikePlayer[], handSize = 5) {
  const hands: Record<string, SkillStrikeCard[]> = {};
  players.forEach((p) => {
    hands[p.id] = [];
    for (let i = 0; i < handSize; i += 1) {
      const card = deck.shift();
      if (!card) break;
      hands[p.id].push(card);
    }
  });
  return { hands, deck };
}

export function nextTurn(state: SkillStrikeState): SkillStrikeState {
  const order = state.turn.order;
  if (!order.length) return state;
  const nextIndex = (state.turn.index + 1) % order.length;
  const activePlayer = order[nextIndex];
  const activeTeam: "a" | "b" = state.teams.a.players.some((p) => p.id === activePlayer) ? "a" : "b";
  return {
    ...state,
    turn: {
      ...state.turn,
      index: nextIndex,
      active_player_id: activePlayer,
      active_team: activeTeam,
    },
    turn_number: state.turn_number + 1,
  };
}

export function ensureHandSize(state: SkillStrikeState, playerId: string, handSize = 5) {
  const hand = state.hands[playerId] ?? [];
  const draw = [...state.deck.draw];
  const nextHand = [...hand];
  while (nextHand.length < handSize && draw.length) {
    const card = draw.shift();
    if (card) nextHand.push(card);
  }
  return {
    ...state,
    hands: { ...state.hands, [playerId]: nextHand },
    deck: { ...state.deck, draw },
  };
}

export type SkillNode = {
  id: string;
  name: string;
  level: number; // 1-11
  category: string; // e.g. Tumbling / Basics / Weapons
  set: string; // skills in same "set" relate; can require same-level completion to unlock next level
  points: number; // points awarded (optional)
  prereqIds: string[];
  icon?: string; // optional emoji for now
};

// DEMO DATA (you’ll expand in a sheet later)
export const skillNodes: SkillNode[] = [
  {
    id: "tumble:cartwheel",
    name: "Cartwheel",
    level: 1,
    category: "Tumbling",
    set: "Cartwheel Path",
    points: 5,
    prereqIds: [],
    icon: "🤸",
  },
  {
    id: "tumble:cartwheel_straight",
    name: "Straight Cartwheel",
    level: 2,
    category: "Tumbling",
    set: "Cartwheel Path",
    points: 6,
    prereqIds: ["tumble:cartwheel"],
    icon: "🧭",
  },
  {
    id: "tumble:cartwheel_fast",
    name: "Fast Cartwheel",
    level: 2,
    category: "Tumbling",
    set: "Cartwheel Path",
    points: 6,
    prereqIds: ["tumble:cartwheel"],
    icon: "⚡",
  },
  {
    id: "aerial:step1",
    name: "Aerial Step 1 (Early Release)",
    level: 3,
    category: "Tumbling",
    set: "Aerial Cartwheel",
    points: 10,
    prereqIds: ["tumble:cartwheel_straight", "tumble:cartwheel_fast"],
    icon: "✨",
  },

  // Add more examples
  {
    id: "basic:horse_stance",
    name: "Horse Stance (30s)",
    level: 1,
    category: "Basics",
    set: "Basics Foundation",
    points: 3,
    prereqIds: [],
    icon: "🐴",
  },
  {
    id: "basic:front_kick",
    name: "Front Kick (Form)",
    level: 2,
    category: "Basics",
    set: "Basics Foundation",
    points: 4,
    prereqIds: ["basic:horse_stance"],
    icon: "🦵",
  },
];

export type Challenge = {
  id: string;
  name: string;
  category: "Memory" | "Strength" | "Speed" | "Sanda" | "Mindset";
  points: number;
  maxCompletions: number; // most are 1
  description: string;
};

export const challenges: Challenge[] = [
  {
    id: "ch:traits_cn",
    name: "Recite 10 Academy Traits (Chinese)",
    category: "Memory",
    points: 20,
    maxCompletions: 1,
    description: "Recite all 10 academy traits in Chinese without prompts.",
  },
  {
    id: "ch:traits_en",
    name: "Recite 10 Academy Traits (English)",
    category: "Memory",
    points: 15,
    maxCompletions: 1,
    description: "Recite all 10 academy traits in English without prompts.",
  },
  {
    id: "ch:horse_5min",
    name: "Horse Stance 5 Minutes",
    category: "Strength",
    points: 25,
    maxCompletions: 1,
    description: "Hold a correct horse stance for 5 minutes.",
  },
  {
    id: "ch:combo_2p5",
    name: "3-Point Combo Under 2.5s",
    category: "Speed",
    points: 20,
    maxCompletions: 3,
    description: "Perform a clean 3-point combo in under 2.5 seconds.",
  },
];

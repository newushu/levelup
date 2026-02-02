export type Reward = {
  id: string;
  name: string;
  cost: number;
};

export const rewards: Reward[] = [
  { id: "snack-bar", name: "Protein Bar", cost: 50 },
  { id: "drink", name: "Sports Drink", cost: 80 },
  { id: "patch", name: "Academy Patch", cost: 200 },
  { id: "shirt", name: "Academy T-Shirt", cost: 500 },
];

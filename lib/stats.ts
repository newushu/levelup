import { Student } from "./appState";

export function currentTotalPoints(s: Student) {
  // “current points” = achievement balance
  return Math.round((s.achievementPoints ?? 0) + (s.leadershipPoints ?? 0));
}

export function lifetimeEarnedPoints(s: Student) {
  const ledger = Array.isArray(s.ledger) ? s.ledger : [];
  // lifetime = sum of ONLY positive entries
  return ledger.reduce((sum, e) => sum + (e.points > 0 ? e.points : 0), 0);
}

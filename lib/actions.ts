import { AppState, LedgerCategory } from "./appState";
import { lifetimeEarnedPoints } from "./stats";
import { avatarLevelFromLifetime } from "./avatar";

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function pushCriticalNotice(app: AppState, message: string): AppState {
  const entry = { id: uid(), message, timestamp: Date.now() };
  const next = [entry, ...(app.criticalNotices ?? [])].slice(0, 3);
  return { ...app, criticalNotices: next };
}

/**
 * Core points mutation (single source of truth).
 * Use this for add/remove points so ledger always stays consistent.
 */
export function addPoints(
  app: AppState,
  studentId: string,
  category: LedgerCategory,
  points: number,
  note: string
): AppState {
  const s = app.students[studentId];
  if (!s) return app;

  const beforeAvatar = avatarLevelFromLifetime(lifetimeEarnedPoints(s));

  const entry = { id: uid(), category, points, note, timestamp: Date.now() };

  const nextStudent = {
    ...s,
    achievementPoints: category === "achievement" ? s.achievementPoints + points : s.achievementPoints,
    leadershipPoints: category === "leadership" ? s.leadershipPoints + points : s.leadershipPoints,
    ledger: [entry, ...(Array.isArray(s.ledger) ? s.ledger : [])],
  };

  let next: AppState = { ...app, students: { ...app.students, [studentId]: nextStudent } };

  const afterAvatar = avatarLevelFromLifetime(lifetimeEarnedPoints(nextStudent));
  if (afterAvatar > beforeAvatar) {
    next = pushCriticalNotice(next, `${nextStudent.name} leveled up! Avatar Level ${afterAvatar}`);
  }

  return next;
}

/**
 * Skill completion:
 * - adds skillId to completedSkillIds
 * - awards points (achievement)
 */
export function completeSkill(app: AppState, studentId: string, skillId: string, points: number): AppState {
  const s = app.students[studentId];
  if (!s) return app;

  const completed = new Set(Array.isArray(s.completedSkillIds) ? s.completedSkillIds : []);
  if (completed.has(skillId)) return app;

  const nextStudent = {
    ...s,
    completedSkillIds: [skillId, ...s.completedSkillIds],
  };

  let next: AppState = { ...app, students: { ...app.students, [studentId]: nextStudent } };
  next = addPoints(next, studentId, "achievement", Math.abs(points), `Completed Skill: ${skillId}`);
  return next;
}

/**
 * Challenge completion:
 * - increments completion count up to max
 * - awards points (achievement)
 */
export function completeChallenge(
  app: AppState,
  studentId: string,
  challengeId: string,
  points: number,
  maxCompletions: number,
  challengeName: string
): AppState {
  const s = app.students[studentId];
  if (!s) return app;

  const map = { ...(s.completedChallenges ?? {}) };
  const current = map[challengeId] ?? 0;
  if (current >= maxCompletions) return app;

  map[challengeId] = current + 1;

  let next: AppState = {
    ...app,
    students: {
      ...app.students,
      [studentId]: { ...s, completedChallenges: map },
    },
  };

  next = addPoints(next, studentId, "achievement", Math.abs(points), `Challenge: ${challengeName}`);
  return next;
}

/**
 * Rewards redeemable multiple times:
 * - subtracts points
 * - increments redeemed count
 */
export function redeemReward(
  app: AppState,
  studentId: string,
  rewardId: string,
  cost: number,
  rewardName: string
) {
  const s = app.students[studentId];
  if (!s) return app;

  let next = addPoints(app, studentId, "achievement", -Math.abs(cost), `Redeemed: ${rewardName}`);

  const after = next.students[studentId];
  const counts = { ...(after.redeemedRewards ?? {}) };
  counts[rewardId] = (counts[rewardId] ?? 0) + 1;

  next = {
    ...next,
    students: {
      ...next.students,
      [studentId]: { ...after, redeemedRewards: counts },
    },
  };

  return next;
}

export function setAvatarBase(app: AppState, studentId: string, base: "dragon" | "panda") {
  const s = app.students[studentId];
  if (!s) return app;
  return {
    ...app,
    students: {
      ...app.students,
      [studentId]: { ...s, avatarBase: base },
    },
  };
}

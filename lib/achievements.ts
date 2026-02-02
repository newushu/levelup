import { AppState } from "./appState";
import { lifetimeEarnedPoints } from "./stats";

type AchievementBadgeId = string;

function ensureArray<T>(x: any): T[] {
  return Array.isArray(x) ? (x as T[]) : [];
}

function addAchievementBadge(app: AppState, studentId: string, badgeId: AchievementBadgeId): AppState {
  const s = app.students[studentId];
  if (!s) return app;

  const current = ensureArray<AchievementBadgeId>(s.achievementBadges);
  const already = current.includes(badgeId);
  if (already) return app;

  const nextStudent = {
    ...s,
    achievementBadges: [badgeId, ...current], // newest first
  };

  return {
    ...app,
    students: {
      ...app.students,
      [studentId]: nextStudent,
    },
  };
}

/**
 * Auto achievements (meta badges).
 * Safe even if some arrays are missing due to older stored state.
 */
export function applyAutoAchievements(app: AppState, studentId: string): AppState {
  const s = app.students[studentId];
  if (!s) return app;

  const lifetime = lifetimeEarnedPoints(s);
  let next = app;

  // Examples you asked for:
  if (lifetime >= 100) next = addAchievementBadge(next, studentId, "badge_100");
  if (lifetime >= 1000) next = addAchievementBadge(next, studentId, "badge_1000");

  // Tumbling trio: for now detect tumbling by skill id prefix "tumble:" (you can change later)
  const completed = ensureArray<string>(s.completedSkillIds);
  const tumblingCount = completed.filter((id) => id.startsWith("tumble:")).length;
  if (tumblingCount >= 3) next = addAchievementBadge(next, studentId, "badge_tumble_trio");

  // Step 1 Aerial badge by skill id
  if (completed.includes("aerial:step1")) next = addAchievementBadge(next, studentId, "badge_aerial_step1");

  return next;
}

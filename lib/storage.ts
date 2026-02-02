import { AppState, defaultState, defaultStudent } from "./appState";

const KEY = "lead-achieve-appstate";

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeToStateChanges(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) fn();
}

function migrate(raw: any): AppState {
  // If bad data, fallback safely
  if (!raw || typeof raw !== "object" || !raw.students || typeof raw.students !== "object") {
    return defaultState;
  }

  const app: AppState = {
    ...defaultState,
    ...raw,
    students: { ...raw.students },
  };

  // Ensure every student has the full schema so nothing is undefined
  for (const [id, s0] of Object.entries(app.students)) {
    const s: any = s0;
    const base = defaultStudent(id, s?.name ?? id);
    const merged: any = { ...base, ...s };

    merged.ledger = Array.isArray(merged.ledger) ? merged.ledger : [];
    merged.completedSkillIds = Array.isArray(merged.completedSkillIds) ? merged.completedSkillIds : [];

    merged.completedChallenges =
      merged.completedChallenges && typeof merged.completedChallenges === "object"
        ? merged.completedChallenges
        : {};

    merged.redeemedRewards =
      merged.redeemedRewards && typeof merged.redeemedRewards === "object" ? merged.redeemedRewards : {};

    // Backward compatibility: old redeemedRewardIds[] -> redeemedRewards{ id: count }
    if (Array.isArray(merged.redeemedRewardIds)) {
      for (const rid of merged.redeemedRewardIds) {
        merged.redeemedRewards[rid] = (merged.redeemedRewards[rid] ?? 0) + 1;
      }
      delete merged.redeemedRewardIds;
    }

    merged.prestigeBadges = Array.isArray(merged.prestigeBadges) ? merged.prestigeBadges : [];
    merged.achievementBadges = Array.isArray(merged.achievementBadges) ? merged.achievementBadges : [];

    merged.avatarBase = merged.avatarBase === "panda" ? "panda" : "dragon";

    // Ensure competition flag exists (default false)
    merged.isCompetitionTeam = !!merged.isCompetitionTeam;

    app.students[id] = merged;
  }

  // Active student fallback
  if (!app.activeStudentId || !app.students[app.activeStudentId]) {
    app.activeStudentId = Object.keys(app.students)[0] ?? defaultState.activeStudentId;
  }

  // Classes fallback
  app.classes = app.classes && typeof app.classes === "object" ? app.classes : {};
  app.classTabs = Array.isArray(app.classTabs) ? app.classTabs : [];
  app.activeClassId = app.activeClassId ?? null;

  // Critical notices fallback (support older single-notice shape)
  let notices: any[] = [];
  if (Array.isArray((app as any).criticalNotices)) {
    notices = (app as any).criticalNotices;
  } else if ((app as any).criticalNotice && typeof (app as any).criticalNotice === "object") {
    notices = [(app as any).criticalNotice];
  }
  app.criticalNotices = notices.filter(Boolean).slice(0, 3);

  return app;
}

export function loadState(): AppState {
  if (typeof window === "undefined") return defaultState;

  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState;
    return migrate(JSON.parse(raw));
  } catch {
    return defaultState;
  }
}

export function saveState(app: AppState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(app));
  notify();
}

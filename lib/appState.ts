import type { AvatarBase } from "./avatar";

export type LedgerCategory = "achievement" | "leadership";

export type LedgerEntry = {
  id: string;
  category: LedgerCategory;
  points: number;
  note: string;
  timestamp: number;
};

export type Student = {
  id: string;
  name: string;
  age?: number;
  rank?: string;
  isCompetitionTeam?: boolean;

  // Program-facing level (coach-defined)
  level: number;

  // Current balances
  achievementPoints: number;
  leadershipPoints: number;

  // History
  ledger: LedgerEntry[];

  // Skills + challenges
  completedSkillIds: string[];
  completedChallenges: Record<string, number>; // challengeId -> times completed

  // Rewards can be redeemed multiple times
  redeemedRewards: Record<string, number>; // rewardId -> count

  // Badges
  prestigeBadges: string[];     // coach/manual + some automatic
  achievementBadges: string[];  // automatic/earned (store most-recent-first)

  // Avatar preference
  avatarBase: AvatarBase;
};

export type ClassSession = {
  id: string;
  name: string;
  studentIds: string[];
  createdAt: number;
};

export type CriticalNotice = {
  id: string;
  message: string;
  timestamp: number;
};

export type AppState = {
  students: Record<string, Student>;
  activeStudentId: string;

  // classes
  classes: Record<string, ClassSession>;
  classTabs: string[];
  activeClassId: string | null;

  // global notices
  criticalNotices: CriticalNotice[];
};

export const defaultStudent = (id: string, name: string): Student => ({
  id,
  name,

  level: 1,

  achievementPoints: 0,
  leadershipPoints: 0,

  ledger: [],

  completedSkillIds: [],
  completedChallenges: {},

  redeemedRewards: {},

  prestigeBadges: [],
  achievementBadges: [],

  avatarBase: "dragon",
  isCompetitionTeam: false,
});

export const defaultState: AppState = (() => {
  const evalina = defaultStudent("evalina", "Evalina");
  evalina.isCompetitionTeam = true;
  evalina.age = 10;
  evalina.rank = "—";
  // Evalina has the Competition Team prestige badge by default
  evalina.prestigeBadges = ["prestige:comp_team"];

  const demo = defaultStudent("demo", "Demo Student");
  demo.age = 9;

  return {
    students: { [evalina.id]: evalina, [demo.id]: demo },
    activeStudentId: evalina.id,
    classes: {},
    classTabs: [],
    activeClassId: null,
    criticalNotices: [
      {
        id: "init",
        message: "Welcome! Select a student and start awarding points.",
        timestamp: Date.now(),
      },
    ],
  };
})();

export function getActiveStudent(app: AppState) {
  return app.students[app.activeStudentId] ?? Object.values(app.students)[0];
}

export function getActiveClass(app: AppState) {
  if (!app.activeClassId) return null;
  return app.classes[app.activeClassId] ?? null;
}

export function setActiveStudent(app: AppState, studentId: string) {
  if (!app.students[studentId]) return app;
  return { ...app, activeStudentId: studentId };
}

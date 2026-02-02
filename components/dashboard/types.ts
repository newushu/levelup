export type Tier = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "master";

export type StudentRow = {
  id: string;
  name: string;
  level: number;
  points_total: number;
  points_balance?: number;
  lifetime_points?: number;
  is_competition_team: boolean;
};

export type Challenge = {
  id: string;
  name: string;
  description: string;
  category: string;
  comp_team_only: boolean;
};

export type StudentChallenge = { challenge_id: string; tier: Tier };

export type EarnedBadge = {
  badge_id: string;
  earned_at: string;
  achievement_badges?: { name: string; description: string };
};

export type AvatarChoice = { id: string; name: string; storage_path: string | null; enabled: boolean };

export type AvatarSettings = {
  student_id: string;
  avatar_id?: string | null;
  bg_color?: string | null;
  border_color?: string | null;
  glow_color?: string | null;
  pattern?: string | null;
  particle_style?: string | null;
  aura_style?: string | null;
  planet_style?: string | null;
  updated_at?: string | null;
};

export type Tab = "Overview" | "Skills" | "Rewards" | "Challenges" | "Badges" | "Activity";

export type ScheduleLocation = {
  id: string;
  name: string;
  rooms: string[];
};

export type ScheduleConfig = {
  locations: ScheduleLocation[];
};

const KEY = "lead-achieve-schedule-config";

export const defaultScheduleConfig: ScheduleConfig = {
  locations: [
    { id: "burlington", name: "Burlington", rooms: ["Main Floor"] },
    { id: "acton", name: "Acton", rooms: ["Room 1", "Room 2"] },
    { id: "wellesley", name: "Wellesley", rooms: ["Studio"] },
  ],
};

export function loadScheduleConfig(): ScheduleConfig {
  if (typeof window === "undefined") return defaultScheduleConfig;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultScheduleConfig;
    const parsed = JSON.parse(raw);
    if (!parsed?.locations?.length) return defaultScheduleConfig;
    return parsed as ScheduleConfig;
  } catch {
    return defaultScheduleConfig;
  }
}

export function saveScheduleConfig(cfg: ScheduleConfig) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(cfg));
}

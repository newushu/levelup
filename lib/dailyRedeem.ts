import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getStudentModifierStack } from "@/lib/modifierStack";

const DAY_MS = 24 * 60 * 60 * 1000;
const BOARD_POINTS_PER_TOP10 = 15;
const BOARD_POINTS_TOP1 = 50;
const CAMP_ROLE_REDEEM_HOUR_ET = 16;
const DEFAULT_CAMP_ROLE_DAILY_POINTS: Record<string, number> = {
  seller: 300,
  cleaner: 500,
};

type AdminClient = ReturnType<typeof supabaseAdmin>;
type RankedRow = { student_id: string; points: number; recorded_at?: string };
type BoardAward = { board_key: string; student_id: string; rank: number; board_points: number };

type BoardSnapshotBundle = {
  boardMap: Map<string, string[]>;
  boardPointsByStudent: Map<string, number>;
  boardAwardsByStudent: Map<string, Array<{ board_key: string; board_points: number; rank: number }>>;
};
type LiveBoardAwardsResult = { ok: true; awards: BoardAward[] } | { ok: false; error: string };
type BoardBundleResult = ({ ok: true } & BoardSnapshotBundle) | { ok: false; error: string };
type EventDailyPointsResult =
  | { ok: true; points: number; chips: string[]; event_keys: string[] }
  | { ok: false; error: string };

function getWeekStartUTC(now: Date) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function getEasternDateKey(value: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(value);
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  return year && month && day ? `${year}-${month}-${day}` : new Date().toISOString().slice(0, 10);
}

function getEasternHour(value: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(value);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  return Number.isFinite(hour) ? hour : 0;
}

function getEasternDayCode(value: Date) {
  const dayName = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
  })
    .format(value)
    .toLowerCase();
  if (dayName.startsWith("mon")) return "m";
  if (dayName.startsWith("tue")) return "t";
  if (dayName.startsWith("wed")) return "w";
  if (dayName.startsWith("thu")) return "r";
  if (dayName.startsWith("fri")) return "f";
  if (dayName.startsWith("sat")) return "sa";
  if (dayName.startsWith("sun")) return "su";
  return "";
}

function addDaysToDateKey(key: string, days: number) {
  const [y, m, d] = key.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return key;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function getSnapshotCycleDateKey(value: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(value);
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const base = year && month && day ? `${year}-${month}-${day}` : getEasternDateKey(value);
  const afterCutoff = hour > 21 || (hour === 21 && minute >= 30);
  return afterCutoff ? addDaysToDateKey(base, 1) : base;
}

function isMissingColumn(err: any, column: string) {
  const msg = String(err?.message || "").toLowerCase();
  const key = column.toLowerCase();
  return msg.includes(`column \"${key}\"`) || msg.includes(`.${key}`) || msg.includes(key);
}

function isMissingRelation(err: any, relation: string) {
  const msg = String(err?.message || "").toLowerCase();
  const key = relation.toLowerCase();
  return msg.includes(`relation \"${key}\" does not exist`) || msg.includes(`${key} does not exist`);
}

function normalizeRole(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizeDayCode(value: unknown) {
  const v = String(value ?? "").trim().toLowerCase();
  if (!v) return "";
  if (v === "monday" || v === "mon") return "m";
  if (v === "tuesday" || v === "tues" || v === "tue") return "t";
  if (v === "wednesday" || v === "wed") return "w";
  if (v === "thursday" || v === "thurs" || v === "thu" || v === "th") return "r";
  if (v === "friday" || v === "fri") return "f";
  if (v === "saturday" || v === "sat") return "sa";
  if (v === "sunday" || v === "sun") return "su";
  if (v === "mtwrf") return "";
  if (v === "th") return "r";
  if (v === "sat") return "sa";
  if (v === "sun") return "su";
  return v;
}

function roleDayAllowed(role: string, days: unknown, todayCode: string) {
  if (!todayCode) return false;
  if (role !== "seller" && role !== "cleaner") return false;
  const list = Array.isArray(days) ? days : [];
  if (!list.length) return true;
  return list.map((d) => normalizeDayCode(d)).includes(todayCode);
}

async function getCampRolePointMap(admin: AdminClient) {
  const settingsRes = await admin
    .from("camp_settings")
    .select("seller_daily_points,cleaner_daily_points")
    .eq("id", "default")
    .maybeSingle();
  if (settingsRes.error && isMissingRelation(settingsRes.error, "camp_settings")) {
    return { ...DEFAULT_CAMP_ROLE_DAILY_POINTS };
  }
  if (settingsRes.error) return { ...DEFAULT_CAMP_ROLE_DAILY_POINTS };
  return {
    seller: Number(settingsRes.data?.seller_daily_points ?? DEFAULT_CAMP_ROLE_DAILY_POINTS.seller),
    cleaner: Number(settingsRes.data?.cleaner_daily_points ?? DEFAULT_CAMP_ROLE_DAILY_POINTS.cleaner),
  };
}

async function wasCampRoleClaimedToday(admin: AdminClient, studentId: string, todayKey: string) {
  const claimRes = await admin
    .from("student_camp_role_daily_claims")
    .select("student_id")
    .eq("student_id", studentId)
    .eq("claim_date", todayKey)
    .maybeSingle();
  if (!claimRes.error) return { claimed: !!claimRes.data };
  if (!isMissingRelation(claimRes.error, "student_camp_role_daily_claims")) {
    return { error: claimRes.error.message };
  }

  const fallbackRes = await admin
    .from("ledger")
    .select("id")
    .eq("student_id", studentId)
    .eq("category", "redeem_camp_role")
    .ilike("note", `%claim_date=${todayKey}%`)
    .limit(1);
  if (fallbackRes.error) return { error: fallbackRes.error.message };
  return { claimed: (fallbackRes.data ?? []).length > 0 };
}

function isDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""));
}

function isWithinRosterWindow(todayKey: string, startDate?: string | null, endDate?: string | null) {
  const start = String(startDate ?? "").trim();
  const end = String(endDate ?? "").trim();
  const hasStart = isDateKey(start);
  const hasEnd = isDateKey(end);
  if (hasStart && todayKey < start) return false;
  if (hasEnd && todayKey > end) return false;
  return true;
}

async function getCampRoleDailyPoints(admin: AdminClient, studentId: string) {
  const todayEt = getEasternDateKey(new Date());
  const easternHour = getEasternHour(new Date());
  const roleRedeemWindowOpen = easternHour >= CAMP_ROLE_REDEEM_HOUR_ET;
  const todayDayCode = getEasternDayCode(new Date());
  const rolePoints = await getCampRolePointMap(admin);
  const alreadyClaimedRes = await wasCampRoleClaimedToday(admin, studentId, todayEt);
  if ("error" in alreadyClaimedRes) return { error: alreadyClaimedRes.error };
  if (alreadyClaimedRes.claimed) {
    return {
      points: 0,
      chips: [] as string[],
      pending_chips: [] as string[],
      claimed_today: true,
    };
  }
  const membersRes = await admin
    .from("camp_display_members")
    .select("roster_id,display_role,secondary_role,secondary_role_days")
    .eq("student_id", studentId)
    .eq("enabled", true);

  if (membersRes.error && isMissingRelation(membersRes.error, "camp_display_members")) {
    return { points: 0, chips: [] as string[] };
  }
  if (membersRes.error) return { error: membersRes.error.message };

  const members = (membersRes.data ?? []) as Array<{
    roster_id?: string | null;
    display_role?: string | null;
    secondary_role?: string | null;
    secondary_role_days?: string[] | null;
  }>;
  if (!members.length) return { points: 0, chips: [] as string[] };

  const rosterIds = Array.from(new Set(members.map((m) => String(m.roster_id ?? "")).filter(Boolean)));
  if (!rosterIds.length) return { points: 0, chips: [] as string[] };

  const rostersRes = await admin
    .from("camp_display_rosters")
    .select("id,start_date,end_date")
    .in("id", rosterIds)
    .eq("enabled", true);

  if (rostersRes.error && isMissingRelation(rostersRes.error, "camp_display_rosters")) {
    return { points: 0, chips: [] as string[] };
  }
  if (rostersRes.error && (isMissingColumn(rostersRes.error, "start_date") || isMissingColumn(rostersRes.error, "end_date"))) {
    const fallbackRostersRes = await admin
      .from("camp_display_rosters")
      .select("id")
      .in("id", rosterIds)
      .eq("enabled", true);
    if (fallbackRostersRes.error) return { error: fallbackRostersRes.error.message };
    const allActiveRosterIds = new Set((fallbackRostersRes.data ?? []).map((r: any) => String(r.id ?? "")).filter(Boolean));
    let fallbackPoints = 0;
    const labels: string[] = [];
    for (const m of members) {
      const rid = String(m.roster_id ?? "");
      if (!rid || !allActiveRosterIds.has(rid)) continue;
      const displayRole = normalizeRole(m.display_role);
      if (displayRole) {
        const pts = Number(rolePoints[displayRole] ?? 0);
        if (pts <= 0) continue;
        fallbackPoints += pts;
        labels.push(`${displayRole[0]?.toUpperCase() ?? ""}${displayRole.slice(1)}`);
      }
      const secondaryRole = normalizeRole(m.secondary_role);
      if (secondaryRole && roleDayAllowed(secondaryRole, m.secondary_role_days, todayDayCode)) {
        const pts = Number(rolePoints[secondaryRole] ?? 0);
        if (pts <= 0) continue;
        fallbackPoints += pts;
        labels.push(`${secondaryRole[0]?.toUpperCase() ?? ""}${secondaryRole.slice(1)}`);
      }
    }
    const uniqueLabels = Array.from(new Set(labels));
    if (!roleRedeemWindowOpen && fallbackPoints > 0) {
      return {
        points: 0,
        chips: [],
        pending_chips: [`Camp role points unlock at 4:00 PM ET (${uniqueLabels.join(", ")})`],
        claimed_today: false,
      };
    }
    return {
      points: fallbackPoints,
      chips: fallbackPoints > 0 ? [`+${fallbackPoints} camp role (${uniqueLabels.join(", ")})`] : [],
      claimed_today: false,
    };
  }
  if (rostersRes.error) return { error: rostersRes.error.message };

  const activeRosterIds = new Set(
    (rostersRes.data ?? [])
      .filter((r: any) => isWithinRosterWindow(todayEt, String(r.start_date ?? ""), String(r.end_date ?? "")))
      .map((r: any) => String(r.id ?? ""))
      .filter(Boolean)
  );

  if (!activeRosterIds.size) return { points: 0, chips: [] as string[] };

  let points = 0;
  const labels: string[] = [];
  for (const m of members) {
    const rid = String(m.roster_id ?? "");
    if (!rid || !activeRosterIds.has(rid)) continue;
    const displayRole = normalizeRole(m.display_role);
    if (displayRole) {
      const pts = Number(rolePoints[displayRole] ?? 0);
      if (pts <= 0) continue;
      points += pts;
      labels.push(`${displayRole[0]?.toUpperCase() ?? ""}${displayRole.slice(1)}`);
    }
    const secondaryRole = normalizeRole(m.secondary_role);
    if (secondaryRole && roleDayAllowed(secondaryRole, m.secondary_role_days, todayDayCode)) {
      const pts = Number(rolePoints[secondaryRole] ?? 0);
      if (pts <= 0) continue;
      points += pts;
      labels.push(`${secondaryRole[0]?.toUpperCase() ?? ""}${secondaryRole.slice(1)}`);
    }
  }

  const uniqueLabels = Array.from(new Set(labels));
  if (!roleRedeemWindowOpen && points > 0) {
    return {
      points: 0,
      chips: [],
      pending_chips: [`Camp role points unlock at 4:00 PM ET (${uniqueLabels.join(", ")})`],
      claimed_today: false,
    };
  }
  return {
    points,
    chips: points > 0 ? [`+${points} camp role (${uniqueLabels.join(", ")})`] : [],
    claimed_today: false,
  };
}

async function getLimitedEventDailyPoints(admin: AdminClient, studentId: string): Promise<EventDailyPointsResult> {
  const todayKey = getEasternDateKey(new Date());
  let defsRes = await admin
    .from("unlock_criteria_definitions")
    .select("key,label,enabled,start_date,end_date,daily_free_points")
    .ilike("key", "event_%")
    .eq("enabled", true);
  if (defsRes.error && (isMissingColumn(defsRes.error, "start_date") || isMissingColumn(defsRes.error, "end_date") || isMissingColumn(defsRes.error, "daily_free_points"))) {
    return { ok: true, points: 0, chips: [], event_keys: [] };
  }
  if (defsRes.error && isMissingRelation(defsRes.error, "unlock_criteria_definitions")) {
    return { ok: true, points: 0, chips: [], event_keys: [] };
  }
  if (defsRes.error) return { ok: false, error: defsRes.error.message };

  const activeDefs = (defsRes.data ?? [])
    .map((row: any) => ({
      key: String(row?.key ?? ""),
      label: String(row?.label ?? "Event"),
      start_date: String(row?.start_date ?? ""),
      end_date: String(row?.end_date ?? ""),
      daily_free_points: Math.max(0, Math.floor(Number(row?.daily_free_points ?? 0))),
    }))
    .filter((row) => row.key && row.daily_free_points > 0)
    .filter((row) => isWithinRosterWindow(todayKey, row.start_date || null, row.end_date || null));
  if (!activeDefs.length) return { ok: true, points: 0, chips: [], event_keys: [] };

  const eligibleRes = await admin
    .from("student_unlock_criteria")
    .select("criteria_key,fulfilled")
    .eq("student_id", studentId)
    .in("criteria_key", activeDefs.map((d) => d.key));
  if (eligibleRes.error && isMissingRelation(eligibleRes.error, "student_unlock_criteria")) {
    return { ok: true, points: 0, chips: [], event_keys: [] };
  }
  if (eligibleRes.error) return { ok: false, error: eligibleRes.error.message };
  const eligibleKeys = new Set(
    (eligibleRes.data ?? [])
      .filter((row: any) => row?.fulfilled === true)
      .map((row: any) => String(row?.criteria_key ?? ""))
      .filter(Boolean)
  );
  const eligibleDefs = activeDefs.filter((d) => eligibleKeys.has(d.key));
  if (!eligibleDefs.length) return { ok: true, points: 0, chips: [], event_keys: [] };

  const claimRes = await admin
    .from("student_event_daily_claims")
    .select("criteria_key")
    .eq("student_id", studentId)
    .eq("claim_date", todayKey)
    .in("criteria_key", eligibleDefs.map((d) => d.key));
  if (claimRes.error && isMissingRelation(claimRes.error, "student_event_daily_claims")) {
    return { ok: true, points: 0, chips: [], event_keys: [] };
  }
  if (claimRes.error) return { ok: false, error: claimRes.error.message };
  const claimedSet = new Set((claimRes.data ?? []).map((row: any) => String(row?.criteria_key ?? "")).filter(Boolean));
  const claimableDefs = eligibleDefs.filter((d) => !claimedSet.has(d.key));
  if (!claimableDefs.length) return { ok: true, points: 0, chips: [], event_keys: [] };

  const points = claimableDefs.reduce((sum, row) => sum + row.daily_free_points, 0);
  const chips = claimableDefs.map((row) => `+${row.daily_free_points} limited event (${row.label})`);
  const eventKeys = claimableDefs.map((row) => row.key);
  return { ok: true, points, chips, event_keys: eventKeys };
}

function rankWithTies(rows: RankedRow[], boardKey: string, higherIsBetter = true, excludeNonPositive = false): BoardAward[] {
  const sorted = rows
    .filter((r) => String(r.student_id ?? "").trim())
    .filter((r) => (excludeNonPositive ? Number(r.points ?? 0) > 0 : true))
    .slice()
    .sort((a, b) => {
      if (a.points === b.points) {
        const aAt = String(a.recorded_at ?? "");
        const bAt = String(b.recorded_at ?? "");
        return bAt.localeCompare(aAt);
      }
      return higherIsBetter ? b.points - a.points : a.points - b.points;
    });

  const awards: BoardAward[] = [];
  let prevPoints: number | null = null;
  let prevRank = 0;

  for (let i = 0; i < sorted.length; i += 1) {
    const row = sorted[i];
    const rank = prevPoints !== null && row.points === prevPoints ? prevRank : i + 1;
    prevPoints = row.points;
    prevRank = rank;
    if (rank > 10) break;
    awards.push({
      board_key: boardKey,
      student_id: row.student_id,
      rank,
      board_points: rank === 1 ? BOARD_POINTS_TOP1 : BOARD_POINTS_PER_TOP10,
    });
  }

  return awards;
}

function summarizeAwards(awards: BoardAward[]): BoardSnapshotBundle {
  const boardMap = new Map<string, string[]>();
  const boardPointsByStudent = new Map<string, number>();
  const boardAwardsByStudent = new Map<string, Array<{ board_key: string; board_points: number; rank: number }>>();

  awards.forEach((row) => {
    const sid = String(row.student_id ?? "");
    const boardKey = String(row.board_key ?? "");
    if (!sid || !boardKey) return;

    const keys = boardMap.get(sid) ?? [];
    keys.push(boardKey);
    boardMap.set(sid, keys);

    boardPointsByStudent.set(sid, (boardPointsByStudent.get(sid) ?? 0) + Number(row.board_points ?? 0));

    const detailed = boardAwardsByStudent.get(sid) ?? [];
    detailed.push({ board_key: boardKey, board_points: Number(row.board_points ?? 0), rank: Number(row.rank ?? 999) });
    boardAwardsByStudent.set(sid, detailed);
  });

  return { boardMap, boardPointsByStudent, boardAwardsByStudent };
}

export async function getRoleAccess(userId: string, studentId: string) {
  const admin = supabaseAdmin();
  const { data: roles, error } = await admin
    .from("user_roles")
    .select("role,student_id")
    .eq("user_id", userId);

  if (error) return { ok: false as const, error: error.message };

  const roleList = (roles ?? []).map((r: any) => String(r.role ?? "").toLowerCase());
  if (roleList.some((r) => ["admin", "coach", "classroom"].includes(r))) {
    return { ok: true as const, roles: roleList };
  }

  const studentRole = (roles ?? []).find((r: any) => String(r.role ?? "").toLowerCase() === "student");
  if (studentRole && String(studentRole.student_id ?? "") === String(studentId)) {
    return { ok: true as const, roles: roleList };
  }

  return { ok: false as const, error: "Not allowed" };
}

async function computeLiveLeaderboardBoardAwards(admin: AdminClient): Promise<LiveBoardAwardsResult> {
  const { data: students, error: sErr } = await admin
    .from("students")
    .select("id,points_total");
  if (sErr) return { ok: false as const, error: sErr.message };

  const rows = (students ?? []).map((s: any) => ({
    student_id: String(s.id ?? ""),
    total: Number(s.points_total ?? 0),
  }));

  const weekStart = getWeekStartUTC(new Date()).toISOString();
  const { data: weekLedger, error: wErr } = await admin
    .from("ledger")
    .select("student_id,points")
    .gte("created_at", weekStart);
  if (wErr) return { ok: false as const, error: wErr.message };

  const weeklyById = new Map<string, number>();
  (weekLedger ?? []).forEach((r: any) => {
    const sid = String(r.student_id ?? "");
    if (!sid) return;
    weeklyById.set(sid, (weeklyById.get(sid) ?? 0) + Number(r.points ?? 0));
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const taoluCountById = new Map<string, number>();
  const taoluLatestAtById = new Map<string, string>();
  const taoluRes = await admin
    .from("taolu_sessions")
    .select("student_id,created_at")
    .gte("created_at", todayStart.toISOString());
  if (!taoluRes.error) {
    (taoluRes.data ?? []).forEach((row: any) => {
      const sid = String(row?.student_id ?? "");
      const createdAt = String(row?.created_at ?? "");
      if (!sid) return;
      taoluCountById.set(sid, (taoluCountById.get(sid) ?? 0) + 1);
      const prev = taoluLatestAtById.get(sid) ?? "";
      if (createdAt > prev) taoluLatestAtById.set(sid, createdAt);
    });
  } else if (!isMissingRelation(taoluRes.error, "taolu_sessions")) {
    return { ok: false as const, error: taoluRes.error.message };
  }

  const refinementRoundRes = await admin
    .from("taolu_refinement_rounds")
    .select("student_id,created_at")
    .gte("created_at", todayStart.toISOString());
  if (!refinementRoundRes.error) {
    (refinementRoundRes.data ?? []).forEach((row: any) => {
      const sid = String(row?.student_id ?? "");
      const createdAt = String(row?.created_at ?? "");
      if (!sid) return;
      taoluCountById.set(sid, (taoluCountById.get(sid) ?? 0) + 1);
      const prev = taoluLatestAtById.get(sid) ?? "";
      if (createdAt > prev) taoluLatestAtById.set(sid, createdAt);
    });
  } else if (!isMissingRelation(refinementRoundRes.error, "taolu_refinement_rounds")) {
    return { ok: false as const, error: refinementRoundRes.error.message };
  }

  const prepsRemediationRes = await admin
    .from("preps_remediations")
    .select("student_id,completed_at")
    .gte("completed_at", todayStart.toISOString());
  if (!prepsRemediationRes.error) {
    (prepsRemediationRes.data ?? []).forEach((row: any) => {
      const sid = String(row?.student_id ?? "");
      const createdAt = String(row?.completed_at ?? "");
      if (!sid) return;
      taoluCountById.set(sid, (taoluCountById.get(sid) ?? 0) + 1);
      const prev = taoluLatestAtById.get(sid) ?? "";
      if (createdAt > prev) taoluLatestAtById.set(sid, createdAt);
    });
  } else if (!isMissingRelation(prepsRemediationRes.error, "preps_remediations")) {
    return { ok: false as const, error: prepsRemediationRes.error.message };
  }

  const pulseRepsById = new Map<string, number>();
  const pulseLatestAtById = new Map<string, string>();

  const skillLogRes = await admin
    .from("skill_tracker_logs")
    .select("tracker_id,created_at,success")
    .gte("created_at", todayStart.toISOString());
  if (!skillLogRes.error) {
    const trackerIds = Array.from(
      new Set((skillLogRes.data ?? []).map((row: any) => String(row?.tracker_id ?? "")).filter(Boolean))
    );
    const trackerToStudent = new Map<string, string>();
    if (trackerIds.length) {
      const trackerRes = await admin
        .from("skill_trackers")
        .select("id,student_id")
        .in("id", trackerIds);
      if (trackerRes.error && !isMissingRelation(trackerRes.error, "skill_trackers")) {
        return { ok: false as const, error: trackerRes.error.message };
      }
      (trackerRes.data ?? []).forEach((tracker: any) => {
        const tid = String(tracker?.id ?? "");
        const sid = String(tracker?.student_id ?? "");
        if (!tid || !sid) return;
        trackerToStudent.set(tid, sid);
      });
    }
    (skillLogRes.data ?? []).forEach((row: any) => {
      if (row?.success !== true) return;
      const sid = trackerToStudent.get(String(row?.tracker_id ?? "")) ?? "";
      const createdAt = String(row?.created_at ?? "");
      if (!sid) return;
      pulseRepsById.set(sid, (pulseRepsById.get(sid) ?? 0) + 1);
      const prev = pulseLatestAtById.get(sid) ?? "";
      if (createdAt > prev) pulseLatestAtById.set(sid, createdAt);
    });
  } else if (!isMissingRelation(skillLogRes.error, "skill_tracker_logs")) {
    return { ok: false as const, error: skillLogRes.error.message };
  }

  const battleLogRes = await admin
    .from("battle_tracker_logs")
    .select("student_id,created_at,success")
    .gte("created_at", todayStart.toISOString());
  if (!battleLogRes.error) {
    (battleLogRes.data ?? []).forEach((row: any) => {
      if (row?.success !== true) return;
      const sid = String(row?.student_id ?? "");
      const createdAt = String(row?.created_at ?? "");
      if (!sid) return;
      pulseRepsById.set(sid, (pulseRepsById.get(sid) ?? 0) + 1);
      const prev = pulseLatestAtById.get(sid) ?? "";
      if (createdAt > prev) pulseLatestAtById.set(sid, createdAt);
    });
  } else if (!isMissingRelation(battleLogRes.error, "battle_tracker_logs")) {
    return { ok: false as const, error: battleLogRes.error.message };
  }

  const { data: mvpRows, error: mErr } = await admin
    .from("battle_mvp_awards")
    .select("student_id");
  const safeMvpRows = mErr && isMissingRelation(mErr, "battle_mvp_awards") ? [] : (mvpRows ?? []);
  if (mErr && !isMissingRelation(mErr, "battle_mvp_awards")) return { ok: false as const, error: mErr.message };

  const mvpById = new Map<string, number>();
  safeMvpRows.forEach((r: any) => {
    const sid = String(r.student_id ?? "");
    if (!sid) return;
    mvpById.set(sid, (mvpById.get(sid) ?? 0) + 1);
  });

  const awards: BoardAward[] = [];
  awards.push(
    ...rankWithTies(rows.map((r) => ({ student_id: r.student_id, points: weeklyById.get(r.student_id) ?? 0 })), "weekly", true),
    ...rankWithTies(
      rows.map((r) => ({
        student_id: r.student_id,
        points: taoluCountById.get(r.student_id) ?? 0,
        recorded_at: taoluLatestAtById.get(r.student_id) ?? "",
      })),
      "taolu_today",
      true,
      true
    ),
    ...rankWithTies(
      rows.map((r) => ({
        student_id: r.student_id,
        points: pulseRepsById.get(r.student_id) ?? 0,
        recorded_at: pulseLatestAtById.get(r.student_id) ?? "",
      })),
      "skill_pulse_reps_today",
      true,
      true
    ),
    ...rankWithTies(rows.map((r) => ({ student_id: r.student_id, points: mvpById.get(r.student_id) ?? 0 })), "mvp", true)
  );

  const statsRes = await admin.from("stats").select("id,higher_is_better");
  const statsRows = statsRes.error && isMissingRelation(statsRes.error, "stats") ? [] : (statsRes.data ?? []);
  if (statsRes.error && !isMissingRelation(statsRes.error, "stats")) {
    return { ok: false as const, error: statsRes.error.message };
  }

  for (const stat of statsRows as any[]) {
    const statId = String(stat?.id ?? "").trim();
    if (!statId) continue;
    const higherIsBetter = stat?.higher_is_better !== false;
    const statRowsRes = await admin
      .from("student_stats")
      .select("student_id,value,recorded_at")
      .eq("stat_id", statId);
    if (statRowsRes.error && !isMissingRelation(statRowsRes.error, "student_stats")) {
      return { ok: false as const, error: statRowsRes.error.message };
    }
    const statRows = statRowsRes.error ? [] : (statRowsRes.data ?? []);

    const bestByStudent = new Map<string, { value: number; recordedAt: string }>();
    statRows.forEach((row: any) => {
      const sid = String(row?.student_id ?? "");
      if (!sid) return;
      const value = Number(row?.value ?? 0);
      const recordedAt = String(row?.recorded_at ?? "");
      const existing = bestByStudent.get(sid);
      if (!existing) {
        bestByStudent.set(sid, { value, recordedAt });
        return;
      }
      const isBetter = higherIsBetter ? value > existing.value : value < existing.value;
      const isTieNewer = value === existing.value && recordedAt > existing.recordedAt;
      if (isBetter || isTieNewer) bestByStudent.set(sid, { value, recordedAt });
    });

    awards.push(
      ...rankWithTies(
        Array.from(bestByStudent.entries()).map(([student_id, entry]) => ({
          student_id,
          points: entry.value,
          recorded_at: entry.recordedAt,
        })),
        `performance_stat:${statId}`,
        higherIsBetter
        , true
      )
    );
  }

  return { ok: true as const, awards };
}

export async function getLeaderboardBoardMapForDate(admin: AdminClient, snapshotDate: string): Promise<BoardBundleResult> {
  const tableName = "leaderboard_bonus_daily_snapshots";
  const existing = await admin
    .from(tableName)
    .select("snapshot_date,board_key,student_id,board_points")
    .eq("snapshot_date", snapshotDate);

  if (existing.error && !isMissingColumn(existing.error, "snapshot_date") && !isMissingRelation(existing.error, tableName)) {
    return { ok: false as const, error: existing.error.message };
  }

  const snapshotTableAvailable = !existing.error;

  if (snapshotTableAvailable && (existing.data ?? []).length) {
    const hasLegacyBonus = (existing.data ?? []).some((row: any) => Number(row?.board_points ?? 0) === 30);
    if (!hasLegacyBonus) {
    const awards = (existing.data ?? []).map((row: any) => ({
      board_key: String(row.board_key ?? ""),
      student_id: String(row.student_id ?? ""),
      rank: 0,
      board_points: Number(row.board_points ?? BOARD_POINTS_PER_TOP10),
    }));
    return { ok: true as const, ...summarizeAwards(awards) };
    }
  }

  const live = await computeLiveLeaderboardBoardAwards(admin);
  if ("error" in live) return { ok: false, error: live.error };

  const rows = live.awards.map((row) => ({
    snapshot_date: snapshotDate,
    board_key: row.board_key,
    student_id: row.student_id,
    board_points: row.board_points,
  }));

  if (rows.length && snapshotTableAvailable) {
    const upsertRes = await admin
      .from(tableName)
      .upsert(rows, { onConflict: "snapshot_date,board_key,student_id" });
    if (upsertRes.error && !isMissingColumn(upsertRes.error, "snapshot_date") && !isMissingRelation(upsertRes.error, tableName)) {
      return { ok: false as const, error: upsertRes.error.message };
    }
  }

  return { ok: true as const, ...summarizeAwards(live.awards) };
}

export async function computeDailyRedeemStatus(
  admin: AdminClient,
  studentId: string,
  boardBundle: BoardSnapshotBundle,
  snapshotDateKey?: string
) {
  const avatarSettingsRes = await admin
    .from("student_avatar_settings")
    .select("*")
    .eq("student_id", studentId)
    .maybeSingle();
  const avatarSettings = avatarSettingsRes.error && isMissingRelation(avatarSettingsRes.error, "student_avatar_settings")
    ? null
    : avatarSettingsRes.data;
  if (avatarSettingsRes.error && !isMissingRelation(avatarSettingsRes.error, "student_avatar_settings")) {
    return { ok: false as const, error: avatarSettingsRes.error.message };
  }

  let avatar: any = null;
  const avatarId = String(avatarSettings?.avatar_id ?? "").trim();
  if (avatarId) {
    const avatarRes = await admin
      .from("avatars")
      .select("*")
      .eq("id", avatarId)
      .maybeSingle();
    avatar = avatarRes.error && isMissingRelation(avatarRes.error, "avatars") ? null : avatarRes.data;
    if (avatarRes.error && !isMissingRelation(avatarRes.error, "avatars")) {
      return { ok: false as const, error: avatarRes.error.message };
    }
  }

  const bonusRes = await admin
    .from("leaderboard_bonus_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  const bonusSettings = bonusRes.error && isMissingRelation(bonusRes.error, "leaderboard_bonus_settings")
    ? null
    : bonusRes.data;
  if (bonusRes.error && !isMissingRelation(bonusRes.error, "leaderboard_bonus_settings")) {
    return { ok: false as const, error: bonusRes.error.message };
  }

  const grantRes = await admin
    .from("student_leaderboard_bonus_grants")
    .select("*")
    .eq("student_id", studentId)
    .maybeSingle();
  const grantRow = grantRes.error && isMissingRelation(grantRes.error, "student_leaderboard_bonus_grants")
    ? null
    : grantRes.data;
  if (grantRes.error && !isMissingRelation(grantRes.error, "student_leaderboard_bonus_grants")) {
    return { ok: false as const, error: grantRes.error.message };
  }

  const stack = await getStudentModifierStack(studentId);
  const avatarPointsBase = Math.max(0, Math.round(Number(stack.daily_free_points ?? avatar?.daily_free_points ?? 0)));
  const campRoleRes = await getCampRoleDailyPoints(admin, studentId);
  if ("error" in campRoleRes) {
    return { ok: false as const, error: campRoleRes.error };
  }
  const campRolePointsBase = Math.max(0, Math.round(Number(campRoleRes.points ?? 0)));
  const boardKeys = boardBundle.boardMap.get(studentId) ?? [];
  const boardAwardRows = boardBundle.boardAwardsByStudent.get(studentId) ?? [];
  const leaderboardPointsBase = Math.max(0, Math.round(Number(boardBundle.boardPointsByStudent.get(studentId) ?? 0)));

  const avatarGrantedAt = avatarSettings?.avatar_daily_granted_at ? Date.parse(String(avatarSettings.avatar_daily_granted_at)) : Number.NaN;
  const boardGrantedAt = grantRow?.last_granted_at ? Date.parse(String(grantRow.last_granted_at)) : Number.NaN;
  const lastGrantedMs = Math.max(Number.isFinite(avatarGrantedAt) ? avatarGrantedAt : 0, Number.isFinite(boardGrantedAt) ? boardGrantedAt : 0);

  const nowMs = Date.now();
  const nextRedeemAtMs = lastGrantedMs > 0 ? lastGrantedMs + DAY_MS : nowMs;
  const cooldownMs = Math.max(0, nextRedeemAtMs - nowMs);
  const regularReady = cooldownMs === 0;
  const avatarPoints = regularReady ? avatarPointsBase : 0;
  const leaderboardPoints = regularReady ? leaderboardPointsBase : 0;
  const regularPoints = Math.max(0, Math.round(avatarPoints + leaderboardPoints));
  const campRolePoints = campRolePointsBase;

  const eventRes = await getLimitedEventDailyPoints(admin, studentId);
  if (!eventRes.ok) {
    return { ok: false as const, error: "error" in eventRes ? eventRes.error : "Failed to load limited event daily points" };
  }
  const limitedEventDailyPoints = Math.max(0, Math.round(Number(eventRes.points ?? 0)));
  const totalPoints = Math.max(0, Math.round(regularPoints + limitedEventDailyPoints));
  const canRedeem = totalPoints > 0;

  const contributions: string[] = [];
  if (avatarPoints > 0) contributions.push(`+${avatarPoints} avatar points`);
  if (!regularReady && (avatarPointsBase > 0 || leaderboardPointsBase > 0)) {
    contributions.push(`Base daily points unlock at ${new Date(nextRedeemAtMs).toLocaleString("en-US", { timeZone: "America/New_York" })} ET`);
  }
  if (campRolePoints > 0) {
    contributions.push("Camp role points ready to redeem");
    contributions.push(...campRoleRes.chips);
  }
  if ((campRoleRes as any).claimed_today === true) {
    contributions.push("Camp role points already claimed today");
  }
  if (Array.isArray((campRoleRes as any).pending_chips) && (campRoleRes as any).pending_chips.length) {
    contributions.push("Camp role points pending");
    contributions.push(...(campRoleRes as any).pending_chips);
  }
  const top1Count = boardAwardRows.filter((r) => Number(r.rank ?? 999) === 1).length;
  const nonTop1Count = Math.max(0, boardAwardRows.length - top1Count);
  if (top1Count > 0) contributions.push(`Top #1 bonus: +${BOARD_POINTS_TOP1} each (${top1Count} board${top1Count === 1 ? "" : "s"})`);
  if (nonTop1Count > 0) contributions.push(`Top 10 bonus: +${BOARD_POINTS_PER_TOP10} each (${nonTop1Count} board${nonTop1Count === 1 ? "" : "s"})`);
  if (limitedEventDailyPoints > 0) contributions.push(...eventRes.chips);

  const skillBase = Math.max(0, Math.round(Number(bonusSettings?.skill_tracker_points_per_rep ?? 2)));
  const skillMultiplier = Number(stack.skill_pulse_multiplier ?? avatar?.skill_pulse_multiplier ?? 1);

  return {
    ok: true as const,
    status: {
      student_id: studentId,
      can_redeem: canRedeem,
      available_points: totalPoints,
      next_redeem_at: new Date(nextRedeemAtMs).toISOString(),
      cooldown_ms: cooldownMs,
      leaderboard_points: leaderboardPoints,
      avatar_points: avatarPoints,
      camp_role_points: campRolePoints,
      limited_event_daily_points: limitedEventDailyPoints,
      claimable_event_keys: eventRes.event_keys,
      leaderboard_boards: boardKeys,
      leaderboard_awards: boardAwardRows,
      leaderboard_snapshot_date: snapshotDateKey ?? getSnapshotCycleDateKey(new Date()),
      contribution_chips: contributions,
      avatar_name: String(avatar?.name ?? "Avatar"),
      modifiers: {
        rule_keeper_multiplier: Number(stack.rule_keeper_multiplier ?? avatar?.rule_keeper_multiplier ?? 1),
        rule_breaker_multiplier: Number(stack.rule_breaker_multiplier ?? avatar?.rule_breaker_multiplier ?? 1),
        spotlight_multiplier: Number(stack.spotlight_multiplier ?? avatar?.spotlight_multiplier ?? 1),
        skill_pulse_multiplier: skillMultiplier,
        daily_free_points: avatarPoints,
        camp_role_daily_points: campRolePoints,
        challenge_completion_bonus_pct: Number(stack.challenge_completion_bonus_pct ?? avatar?.challenge_completion_bonus_pct ?? 0),
        mvp_bonus_pct: Number(stack.mvp_bonus_pct ?? avatar?.mvp_bonus_pct ?? 0),
        base_skill_pulse_points_per_rep: skillBase,
        skill_pulse_points_per_rep: Math.max(0, Math.round(skillBase * skillMultiplier)),
      },
    },
  };
}

export { BOARD_POINTS_PER_TOP10, BOARD_POINTS_TOP1, getEasternDateKey, getSnapshotCycleDateKey };

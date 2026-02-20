const DAY_MS = 24 * 60 * 60 * 1000;

function toMs(value: string | null | undefined) {
  const ms = Date.parse(String(value ?? ""));
  return Number.isFinite(ms) ? ms : Number.NaN;
}

export function skillSprintDurationDays(assignedAtIso?: string | null, dueAtIso?: string | null) {
  const assignedMs = toMs(assignedAtIso);
  const dueMs = toMs(dueAtIso);
  if (!Number.isFinite(assignedMs) || !Number.isFinite(dueMs) || dueMs <= assignedMs) return 1;
  return Math.max(1, Math.ceil((dueMs - assignedMs) / DAY_MS));
}

export function skillSprintPrizeDropPerDay(initialPrize: number, assignedAtIso?: string | null, dueAtIso?: string | null) {
  const initial = Math.max(0, Number(initialPrize ?? 0));
  if (initial <= 0) return 0;
  const days = skillSprintDurationDays(assignedAtIso, dueAtIso);
  return Math.max(0, initial / days);
}

export function skillSprintPrizeNow(
  initialPrize: number,
  assignedAtIso?: string | null,
  dueAtIso?: string | null,
  nowMs = Date.now()
) {
  const initial = Math.max(0, Number(initialPrize ?? 0));
  if (initial <= 0) return 0;

  const assignedMs = toMs(assignedAtIso);
  const dueMs = toMs(dueAtIso);
  if (!Number.isFinite(assignedMs) || !Number.isFinite(dueMs) || dueMs <= assignedMs) {
    return Math.round(initial);
  }

  if (nowMs >= dueMs + DAY_MS) return 0;

  const days = Math.max(1, Math.ceil((dueMs - assignedMs) / DAY_MS));
  const oneDayValue = initial / days;
  const boundedNow = Math.min(nowMs, dueMs);
  const elapsedDays = Math.max(0, Math.floor((boundedNow - assignedMs) / DAY_MS));
  const chargedDecayDays = Math.min(days - 1, elapsedDays);
  const value = initial - chargedDecayDays * oneDayValue;
  return Math.max(Math.round(oneDayValue), Math.round(value));
}

export function skillSprintPoolDropped(
  initialPrize: number,
  assignedAtIso?: string | null,
  dueAtIso?: string | null,
  nowMs = Date.now()
) {
  const initial = Math.max(0, Math.round(Number(initialPrize ?? 0)));
  const current = skillSprintPrizeNow(initial, assignedAtIso, dueAtIso, nowMs);
  return Math.max(0, initial - current);
}


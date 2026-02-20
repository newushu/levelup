import { supabaseAdmin } from "@/lib/supabase/admin";

const DAY_MS = 24 * 60 * 60 * 1000;

export type SkillCountdownRow = {
  id: string;
  student_id: string;
  source_type: string;
  source_key: string | null;
  source_label: string;
  due_at: string;
  penalty_points_per_day: number;
  reward_points: number;
  charged_days: number;
  enabled: boolean;
  assigned_by: string | null;
  assigned_at: string;
  completed_at: string | null;
  completed_by: string | null;
  last_penalty_at: string | null;
  note: string | null;
};

export type SkillCountdownView = SkillCountdownRow & {
  remaining_ms: number;
  overdue_days: number;
  status: "upcoming" | "overdue";
};

export type SkillCountdownSummary = {
  active_count: number;
  overdue_count: number;
  next_due_at: string | null;
  next_due_in_ms: number | null;
  total_penalty_points_per_day: number;
  total_reward_points: number;
};

function toMs(value: string | null | undefined) {
  const ms = Date.parse(String(value ?? ""));
  return Number.isFinite(ms) ? ms : Number.NaN;
}

function computeView(row: SkillCountdownRow, nowMs: number): SkillCountdownView {
  const dueMs = toMs(row.due_at);
  const remainingMs = Number.isFinite(dueMs) ? dueMs - nowMs : 0;
  const overdueDays = Number.isFinite(dueMs) && nowMs > dueMs ? Math.floor((nowMs - dueMs) / DAY_MS) : 0;
  return {
    ...row,
    remaining_ms: remainingMs,
    overdue_days: overdueDays,
    status: remainingMs < 0 ? "overdue" : "upcoming",
  };
}

function computeSummary(rows: SkillCountdownView[]): SkillCountdownSummary {
  const activeCount = rows.length;
  const overdueCount = rows.filter((r) => r.status === "overdue").length;
  const next = rows
    .filter((r) => r.status === "upcoming")
    .sort((a, b) => a.remaining_ms - b.remaining_ms)[0];

  return {
    active_count: activeCount,
    overdue_count: overdueCount,
    next_due_at: next?.due_at ?? null,
    next_due_in_ms: next ? next.remaining_ms : null,
    total_penalty_points_per_day: rows.reduce((sum, r) => sum + Math.max(0, Number(r.penalty_points_per_day ?? 0)), 0),
    total_reward_points: rows.reduce((sum, r) => sum + Math.max(0, Number(r.reward_points ?? 0)), 0),
  };
}

export async function processSkillCountdownPenalties(studentId: string, actorId?: string | null) {
  const sid = String(studentId ?? "").trim();
  if (!sid) return { ok: false as const, error: "Missing student_id" };

  const admin = supabaseAdmin();
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const { data, error } = await admin
    .from("student_skill_countdowns")
    .select(
      "id,student_id,source_type,source_key,source_label,due_at,penalty_points_per_day,reward_points,charged_days,enabled,assigned_by,assigned_at,completed_at,completed_by,last_penalty_at,note"
    )
    .eq("student_id", sid)
    .eq("enabled", true)
    .is("completed_at", null)
    .order("due_at", { ascending: true });

  if (error) return { ok: false as const, error: error.message };

  const rows = ((data ?? []) as SkillCountdownRow[]).map((row) => ({
    ...row,
    penalty_points_per_day: Math.max(0, Number(row.penalty_points_per_day ?? 0)),
    reward_points: Math.max(0, Number(row.reward_points ?? 0)),
    charged_days: Math.max(0, Number(row.charged_days ?? 0)),
  }));

  const ledgerRows: Array<{
    student_id: string;
    points: number;
    note: string;
    category: string;
    created_by: string | null;
  }> = [];
  const updates: Array<{ id: string; charged_days: number }> = [];

  for (const row of rows) {
    const dueMs = toMs(row.due_at);
    if (!Number.isFinite(dueMs)) continue;
    if (nowMs <= dueMs) continue;

    const overdueDays = Math.floor((nowMs - dueMs) / DAY_MS);
    const pendingDays = Math.max(0, overdueDays - Math.max(0, Number(row.charged_days ?? 0)));
    if (!pendingDays) continue;

    const perDay = Math.max(0, Number(row.penalty_points_per_day ?? 0));
    const penalty = pendingDays * perDay;
    updates.push({ id: row.id, charged_days: Number(row.charged_days ?? 0) + pendingDays });

    if (penalty <= 0) continue;

    ledgerRows.push({
      student_id: sid,
      points: -penalty,
      note: `Skill Sprint missed: ${row.source_label} (${pendingDays} day${pendingDays === 1 ? "" : "s"})`,
      category: "skill_sprint_penalty",
      created_by: actorId ?? null,
    });
  }

  if (ledgerRows.length) {
    const { error: ledgerErr } = await admin.from("ledger").insert(ledgerRows);
    if (ledgerErr) return { ok: false as const, error: ledgerErr.message };
  }

  for (const update of updates) {
    const { error: upErr } = await admin
      .from("student_skill_countdowns")
      .update({ charged_days: update.charged_days, last_penalty_at: nowIso })
      .eq("id", update.id);
    if (upErr) return { ok: false as const, error: upErr.message };
  }

  if (ledgerRows.length) {
    const { error: rpcErr } = await admin.rpc("recompute_student_points", { p_student_id: sid });
    if (rpcErr) return { ok: false as const, error: rpcErr.message };
  }

  return { ok: true as const, penalties_applied: ledgerRows.length, updates_applied: updates.length };
}

export function skillSprintPointsLostSoFar(chargedDays: number, penaltyPerDay: number) {
  return Math.max(0, Math.round(Math.max(0, Number(chargedDays ?? 0)) * Math.max(0, Number(penaltyPerDay ?? 0))));
}

export async function fetchSkillCountdownSnapshot(studentId: string) {
  const sid = String(studentId ?? "").trim();
  if (!sid) return { ok: false as const, error: "Missing student_id" };

  const admin = supabaseAdmin();
  const nowMs = Date.now();
  const { data, error } = await admin
    .from("student_skill_countdowns")
    .select(
      "id,student_id,source_type,source_key,source_label,due_at,penalty_points_per_day,reward_points,charged_days,enabled,assigned_by,assigned_at,completed_at,completed_by,last_penalty_at,note"
    )
    .eq("student_id", sid)
    .eq("enabled", true)
    .is("completed_at", null)
    .order("due_at", { ascending: true });

  if (error) return { ok: false as const, error: error.message };

  const rows = ((data ?? []) as SkillCountdownRow[]).map((row) => ({
    ...row,
    penalty_points_per_day: Math.max(0, Number(row.penalty_points_per_day ?? 0)),
    reward_points: Math.max(0, Number(row.reward_points ?? 0)),
    charged_days: Math.max(0, Number(row.charged_days ?? 0)),
  }));

  const viewRows = rows.map((row) => computeView(row, nowMs));
  const summary = computeSummary(viewRows);

  return { ok: true as const, rows: viewRows, summary };
}

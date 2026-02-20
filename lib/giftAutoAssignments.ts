import { supabaseAdmin } from "@/lib/supabaseAdmin";

type AdminClient = ReturnType<typeof supabaseAdmin>;

type RunOptions = {
  now?: Date;
  dryRun?: boolean;
  grantedBy?: string | null;
};

function getEasternDateParts(now: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const weekday = String(parts.find((p) => p.type === "weekday")?.value ?? "").toLowerCase();
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const dateKey = year && month && day ? `${year}-${month}-${day}` : new Date().toISOString().slice(0, 10);
  return { dateKey, weekday, hour, minute };
}

function toDayCode(weekday: string) {
  if (weekday.startsWith("mon")) return "m";
  if (weekday.startsWith("tue")) return "t";
  if (weekday.startsWith("wed")) return "w";
  if (weekday.startsWith("thu")) return "r";
  if (weekday.startsWith("fri")) return "f";
  if (weekday.startsWith("sat")) return "sa";
  if (weekday.startsWith("sun")) return "su";
  return "";
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
  if (["m", "t", "w", "r", "f", "sa", "su"].includes(v)) return v;
  return "";
}

function parseTimeToMinuteOfDay(value: unknown) {
  const v = String(value ?? "").trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(v);
  if (!m) return 16 * 60;
  const h = Math.max(0, Math.min(23, Number(m[1] ?? 16) || 16));
  const min = Math.max(0, Math.min(59, Number(m[2] ?? 0) || 0));
  return h * 60 + min;
}

function isWithinDateRange(dateKey: string, startDate?: string | null, endDate?: string | null) {
  const start = String(startDate ?? "").trim();
  const end = String(endDate ?? "").trim();
  if (start && dateKey < start) return false;
  if (end && dateKey > end) return false;
  return true;
}

function isWithinRosterWindow(dateKey: string, startDate?: string | null, endDate?: string | null) {
  return isWithinDateRange(dateKey, startDate, endDate);
}

export async function runDueGiftAutoAssignments(admin: AdminClient, options: RunOptions = {}) {
  const now = options.now ?? new Date();
  const dryRun = options.dryRun === true;
  const grantedBy = String(options.grantedBy ?? "").trim() || null;

  const et = getEasternDateParts(now);
  const todayCode = toDayCode(et.weekday);
  const nowMinute = et.hour * 60 + et.minute;

  const { data: assignments, error: assignErr } = await admin
    .from("gift_auto_assignments")
    .select("id,gift_item_id,scope_type,roster_id,secondary_role,day_codes,time_et,start_date,end_date,qty,student_ids,enabled")
    .eq("enabled", true)
    .eq("scope_type", "camp_secondary_role");
  if (assignErr) return { ok: false as const, error: assignErr.message };

  const list = (assignments ?? []) as Array<any>;
  if (!list.length) return { ok: true as const, checked: 0, delivered: 0, skipped: 0, dry_run: dryRun };

  const rosterIds = Array.from(new Set(list.map((a) => String(a.roster_id ?? "")).filter(Boolean)));
  const { data: rosters, error: rosterErr } = rosterIds.length
    ? await admin.from("camp_display_rosters").select("id,start_date,end_date,enabled").in("id", rosterIds)
    : { data: [], error: null as any };
  if (rosterErr) return { ok: false as const, error: rosterErr.message };
  const rosterById = new Map((rosters ?? []).map((r: any) => [String(r.id ?? ""), r]));

  const { data: members, error: membersErr } = await admin
    .from("camp_display_members")
    .select("roster_id,student_id,secondary_role,secondary_role_days,enabled")
    .eq("enabled", true);
  if (membersErr) return { ok: false as const, error: membersErr.message };
  const membersList = (members ?? []) as Array<any>;

  let delivered = 0;
  let skipped = 0;
  let checked = 0;

  for (const a of list) {
    checked += 1;
    const rosterId = String(a.roster_id ?? "").trim();
    const secondaryRole = String(a.secondary_role ?? "").trim().toLowerCase();
    const dayCodes = Array.isArray(a.day_codes) ? a.day_codes.map(normalizeDayCode).filter(Boolean) : [];
    const timeMinute = parseTimeToMinuteOfDay(a.time_et);
    const qty = Math.max(1, Number(a.qty ?? 1) || 1);
    if (!secondaryRole || !rosterId) {
      skipped += 1;
      continue;
    }
    if (dayCodes.length && !dayCodes.includes(todayCode)) {
      skipped += 1;
      continue;
    }
    if (nowMinute < timeMinute) {
      skipped += 1;
      continue;
    }
    if (!isWithinDateRange(et.dateKey, a.start_date, a.end_date)) {
      skipped += 1;
      continue;
    }

    const roster = rosterById.get(rosterId);
    if (!roster || roster.enabled === false || !isWithinRosterWindow(et.dateKey, roster.start_date, roster.end_date)) {
      skipped += 1;
      continue;
    }

    const scopedStudents = new Set(
      (membersList ?? [])
        .filter((m: any) => String(m.roster_id ?? "") === rosterId)
        .filter((m: any) => String(m.secondary_role ?? "").trim().toLowerCase() === secondaryRole)
        .filter((m: any) => {
          const memberDays = Array.isArray(m.secondary_role_days) ? m.secondary_role_days.map(normalizeDayCode).filter(Boolean) : [];
          if (!memberDays.length) return true;
          return memberDays.includes(todayCode);
        })
        .map((m: any) => String(m.student_id ?? ""))
        .filter(Boolean)
    );
    if (!scopedStudents.size) {
      skipped += 1;
      continue;
    }

    const specificStudentIds = Array.isArray(a.student_ids) ? a.student_ids.map((v: any) => String(v ?? "").trim()).filter(Boolean) : [];
    const targets = specificStudentIds.length
      ? specificStudentIds.filter((sid) => scopedStudents.has(sid))
      : Array.from(scopedStudents.values());
    if (!targets.length) {
      skipped += 1;
      continue;
    }

    const runKey = `${et.dateKey}|${String(a.time_et ?? "16:00").trim() || "16:00"}`;
    const { data: existingRuns, error: runErr } = await admin
      .from("gift_auto_assignment_runs")
      .select("student_id")
      .eq("assignment_id", String(a.id))
      .eq("run_key", runKey);
    if (runErr) return { ok: false as const, error: runErr.message };
    const already = new Set((existingRuns ?? []).map((r: any) => String(r.student_id ?? "")).filter(Boolean));
    const toDeliver = targets.filter((sid) => !already.has(sid));
    if (!toDeliver.length) {
      skipped += 1;
      continue;
    }

    if (dryRun) {
      delivered += toDeliver.length;
      continue;
    }

    const insertRows = toDeliver.map((studentId) => ({
      student_id: studentId,
      gift_item_id: String(a.gift_item_id),
      qty,
      opened_qty: 0,
      expires_at: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      expired_at: null,
      granted_by: grantedBy,
      note: `Auto gift: camp ${secondaryRole} (${et.dateKey} ${String(a.time_et ?? "16:00")})`,
      enabled: true,
    }));
    const { data: inserted, error: insErr } = await admin
      .from("student_gifts")
      .insert(insertRows)
      .select("id,student_id");
    if (insErr) return { ok: false as const, error: insErr.message };

    const insertedByStudent = new Map((inserted ?? []).map((r: any) => [String(r.student_id ?? ""), String(r.id ?? "")]));
    const runRows = toDeliver.map((studentId) => ({
      assignment_id: String(a.id),
      gift_item_id: String(a.gift_item_id),
      student_id: studentId,
      run_key: runKey,
      student_gift_id: insertedByStudent.get(studentId) || null,
    }));
    const { error: runInsertErr } = await admin.from("gift_auto_assignment_runs").insert(runRows);
    if (runInsertErr) return { ok: false as const, error: runInsertErr.message };

    delivered += toDeliver.length;
  }

  return { ok: true as const, checked, delivered, skipped, dry_run: dryRun };
}

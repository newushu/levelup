import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function getEasternNowParts(now: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const dateKey = year && month && day ? `${year}-${month}-${day}` : now.toISOString().slice(0, 10);
  return { dateKey, hour: Number.isFinite(hour) ? hour : 0, minute: Number.isFinite(minute) ? minute : 0 };
}

function parseMinuteOfDay(value?: string | null) {
  const raw = String(value ?? "").trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (!m) return 16 * 60;
  const h = Math.max(0, Math.min(23, Number(m[1] ?? 16) || 16));
  const min = Math.max(0, Math.min(59, Number(m[2] ?? 0) || 0));
  return h * 60 + min;
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const assignmentId = String(body?.assignment_id ?? "").trim();
  const giftItemId = String(body?.gift_item_id ?? "").trim();
  const studentId = String(body?.student_id ?? "").trim();
  const requestedTimeEt = String(body?.time_et ?? "").trim();
  const requestedDateKey = String(body?.date_key ?? "").trim();

  if (!assignmentId || !giftItemId || !studentId) {
    return NextResponse.json({ ok: false, error: "assignment_id, gift_item_id, and student_id are required." }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: assignment, error: assignmentErr } = await admin
    .from("gift_auto_assignments")
    .select("id,gift_item_id,time_et,enabled")
    .eq("id", assignmentId)
    .single();

  if (assignmentErr || !assignment) {
    return NextResponse.json({ ok: false, error: assignmentErr?.message ?? "Assignment not found." }, { status: 404 });
  }
  if (assignment.enabled !== true) {
    return NextResponse.json({ ok: false, error: "Assignment is not enabled." }, { status: 400 });
  }
  if (String(assignment.gift_item_id ?? "") !== giftItemId) {
    return NextResponse.json({ ok: false, error: "Gift does not match assignment." }, { status: 400 });
  }

  const etNow = getEasternNowParts(new Date());
  const timeEt = requestedTimeEt || String(assignment.time_et ?? "16:00");
  const dateKey = requestedDateKey || etNow.dateKey;
  const nowMinute = etNow.hour * 60 + etNow.minute;
  const targetMinute = parseMinuteOfDay(timeEt);

  if (dateKey !== etNow.dateKey || nowMinute >= targetMinute) {
    return NextResponse.json({ ok: false, error: "You can only remove a scheduled gift before its scheduled time (today ET)." }, { status: 400 });
  }

  const runKey = `${dateKey}|${timeEt}`;
  const { error: insertErr } = await admin.from("gift_auto_assignment_runs").insert({
    assignment_id: assignmentId,
    gift_item_id: giftItemId,
    student_id: studentId,
    run_key: runKey,
    student_gift_id: null,
  });

  if (insertErr) {
    if (String(insertErr.code ?? "") === "23505") {
      return NextResponse.json({ ok: true, already_exists: true, run_key: runKey });
    }
    return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, run_key: runKey });
}

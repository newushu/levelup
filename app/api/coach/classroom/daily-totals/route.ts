import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function getTimeZoneOffset(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  parts.forEach((p) => {
    if (p.type !== "literal") map[p.type] = p.value;
  });
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );
  return asUTC - date.getTime();
}

function getDayRange(timeZone: string) {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = dtf.formatToParts(now);
  const map: Record<string, string> = {};
  parts.forEach((p) => {
    if (p.type !== "literal") map[p.type] = p.value;
  });
  const y = Number(map.year);
  const m = Number(map.month);
  const d = Number(map.day);
  const utcMidnight = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const offset = getTimeZoneOffset(utcMidnight, timeZone);
  const start = new Date(utcMidnight.getTime() - offset);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const { data: roles, error: rErr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);
  if (rErr) return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 });
  const roleList = (roles ?? []).map((r: any) => String(r.role ?? "").toLowerCase());
  const isCoach = roleList.includes("coach");
  const isAdmin = roleList.includes("admin");
  if (!isCoach && !isAdmin) return NextResponse.json({ ok: false, error: "Coach access required" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const student_ids = Array.isArray(body?.student_ids) ? body.student_ids.map(String).filter(Boolean) : [];
  const timeZone = String(body?.time_zone ?? "UTC").trim() || "UTC";
  if (!student_ids.length) return NextResponse.json({ ok: true, totals: {} });

  const { start, end } = getDayRange(timeZone);
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("ledger")
    .select("student_id,points,created_at")
    .in("student_id", student_ids)
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const totals: Record<string, { green: number; red: number }> = {};
  (data ?? []).forEach((row: any) => {
    const sid = String(row.student_id ?? "");
    if (!sid) return;
    const pts = Number(row.points ?? 0);
    const cur = totals[sid] ?? { green: 0, red: 0 };
    if (pts >= 0) cur.green += pts;
    else cur.red += Math.abs(pts);
    totals[sid] = cur;
  });

  return NextResponse.json({ ok: true, totals, range: { start: start.toISOString(), end: end.toISOString() } });
}

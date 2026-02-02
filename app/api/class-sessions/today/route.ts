import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const includeEnded = searchParams.get("include_ended") === "1";
  const daysAhead = Math.max(0, Number(searchParams.get("days_ahead") ?? 0) || 0);

  const today = todayISO();
  const rangeEnd = (() => {
    if (!daysAhead) return today;
    const d = new Date(`${today}T00:00:00`);
    d.setDate(d.getDate() + daysAhead);
    return d.toISOString().slice(0, 10);
  })();
  let { data: schedule, error: sErr } = await supabase
    .from("class_schedule_instances")
    .select("id,schedule_entry_id,class_id,start_time,end_time,instructor_name,room_name,is_cancelled,session_date")
    .gte("session_date", today)
    .lte("session_date", rangeEnd)
    .order("start_time", { ascending: true });

  if (sErr && String(sErr.message || "").includes("is_cancelled")) {
    const retry = await supabase
      .from("class_schedule_instances")
      .select("id,schedule_entry_id,class_id,start_time,end_time,instructor_name,room_name,session_date")
      .gte("session_date", today)
      .lte("session_date", rangeEnd)
      .order("start_time", { ascending: true });
    schedule = (retry.data ?? []).map((row: any) => ({ ...row, is_cancelled: false }));
    sErr = retry.error;
  }

  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });

  const scheduleRows = (schedule ?? []).filter((row: any) => !row.is_cancelled);
  if (!scheduleRows.length) return NextResponse.json({ ok: true, today, sessions: [] });

  const classIds = Array.from(new Set(scheduleRows.map((r: any) => String(r.class_id))));
  const instanceIds = Array.from(new Set(scheduleRows.map((r: any) => String(r.id))));
  if (daysAhead > 0) {
    const classesRes = await supabase.from("classes").select("id,name").in("id", classIds);
    if (classesRes.error) return NextResponse.json({ ok: false, error: classesRes.error.message }, { status: 500 });
    const classMap = new Map((classesRes.data ?? []).map((row: any) => [row.id, row.name]));
    const sessions = scheduleRows.map((row: any) => ({
      session_id: null,
      instance_id: row.id,
      class_id: row.class_id,
      class_name: classMap.get(row.class_id) ?? "",
      schedule_entry_id: row.schedule_entry_id ?? row.id,
      start_time: row.start_time,
      end_time: row.end_time,
      instructor_name: row.instructor_name,
      room_name: row.room_name,
      session_date: row.session_date,
    }));
    return NextResponse.json({ ok: true, today, sessions });
  }
  let sessionQuery = supabase
    .from("class_sessions")
    .select("id,class_id,instance_id,started_at,ended_at")
    .eq("session_date", today)
    .in("instance_id", instanceIds);
  if (!includeEnded) sessionQuery = sessionQuery.is("ended_at", null);
  const { data: existingSessions, error: eErr } = await sessionQuery;

  if (eErr) return NextResponse.json({ ok: false, error: eErr.message }, { status: 500 });

  const existingByInstance = new Map<string, any>();
  (existingSessions ?? []).forEach((s: any) => {
    if (s.instance_id) existingByInstance.set(String(s.instance_id), s);
  });

  const toCreate = scheduleRows.filter((row: any) => !existingByInstance.has(String(row.id)));
  if (toCreate.length) {
    const { data: created, error: cErr } = await supabase
      .from("class_sessions")
      .insert(
        toCreate.map((row: any) => ({
          class_id: row.class_id,
          schedule_entry_id: row.schedule_entry_id ?? row.id,
          instance_id: row.id,
          session_date: today,
          started_at: new Date().toISOString(),
        }))
      )
      .select("id,class_id,instance_id,started_at,ended_at");
    if (cErr) {
      if ((cErr as any)?.code === "23505") {
        const { data: retrySessions, error: rErr } = await supabase
          .from("class_sessions")
          .select("id,class_id,instance_id,started_at,ended_at")
          .eq("session_date", today)
          .is("ended_at", null)
          .in("instance_id", instanceIds);
        if (rErr) return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 });
        (retrySessions ?? []).forEach((s: any) => {
          if (s.instance_id) existingByInstance.set(String(s.instance_id), s);
        });
      } else {
        return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });
      }
    } else {
      (created ?? []).forEach((s: any) => {
        if (s.instance_id) existingByInstance.set(String(s.instance_id), s);
      });
    }
  }

  const classesRes = await supabase.from("classes").select("id,name").in("id", classIds);
  if (classesRes.error) return NextResponse.json({ ok: false, error: classesRes.error.message }, { status: 500 });
  const classMap = new Map((classesRes.data ?? []).map((row: any) => [row.id, row.name]));

  const sessions = scheduleRows
    .map((row: any) => {
      const session = existingByInstance.get(String(row.id));
      if (!session) return null;
      return {
        session_id: session.id,
        instance_id: row.id,
        class_id: row.class_id,
        class_name: classMap.get(row.class_id) ?? "",
        schedule_entry_id: row.schedule_entry_id ?? row.id,
        start_time: row.start_time,
        end_time: row.end_time,
        instructor_name: row.instructor_name,
        room_name: row.room_name,
      };
    })
    .filter(Boolean);

  return NextResponse.json({ ok: true, today, sessions });
}

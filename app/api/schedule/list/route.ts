import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const timeSort = (a?: string | null, b?: string | null) => String(a ?? "").localeCompare(String(b ?? ""));

export async function GET(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  const supabase = await supabaseServer();
  const admin = supabaseAdmin();
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (date || (start && end)) {
    const rangeStart = date ?? start ?? "";
    const rangeEnd = date ?? end ?? "";
    const baseSelect =
      "id,schedule_entry_id,class_id,location_id,session_date,start_time,end_time,instructor_name,room_name,is_cancelled,entry_type";
    let { data, error } = await admin
      .from("class_schedule_instances")
      .select(baseSelect)
      .gte("session_date", rangeStart)
      .lte("session_date", rangeEnd)
      .order("session_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (error && (String(error.message || "").includes("room_name") || String(error.message || "").includes("entry_type"))) {
      const fallbackSelect =
        "id,schedule_entry_id,class_id,location_id,session_date,start_time,end_time,instructor_name,is_cancelled";
      const retry = await admin
        .from("class_schedule_instances")
        .select(fallbackSelect)
        .gte("session_date", rangeStart)
        .lte("session_date", rangeEnd)
        .order("session_date", { ascending: true })
        .order("start_time", { ascending: true });
      data = retry.data;
      error = retry.error;
    }

    const cancelMissing = error && String(error.message || "").includes("is_cancelled");
    if (cancelMissing) {
      const retry = await admin
        .from("class_schedule_instances")
        .select(
          "id,schedule_entry_id,class_id,location_id,session_date,start_time,end_time,instructor_name,room_name"
        )
        .gte("session_date", rangeStart)
        .lte("session_date", rangeEnd)
        .order("session_date", { ascending: true })
        .order("start_time", { ascending: true });
      data = retry.data;
      error = retry.error;
    }

    if (error && String(error.message || "").includes("class_schedule_instances")) {
      error = null;
      data = [];
    }

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const classesRes = await admin.from("classes").select("id,name");
    if (classesRes.error) return NextResponse.json({ ok: false, error: classesRes.error.message }, { status: 500 });
    const locationsRes = await admin.from("locations").select("id,name,timezone");
    if (locationsRes.error) return NextResponse.json({ ok: false, error: locationsRes.error.message }, { status: 500 });
    const classMap = new Map((classesRes.data ?? []).map((row: any) => [row.id, row.name]));
    const locationMap = new Map(
      (locationsRes.data ?? []).map((row: any) => [row.id, { name: row.name, timezone: row.timezone ?? null }])
    );

    let entries = (data ?? []).map((row: any) => ({
      id: row.id,
      schedule_entry_id: row.schedule_entry_id ?? null,
      class_id: row.class_id,
      location_id: row.location_id,
      session_date: row.session_date,
      start_time: row.start_time,
      end_time: row.end_time,
      instructor_name: row.instructor_name,
      room_name: row.room_name ?? null,
      class_name: classMap.get(row.class_id) ?? "",
      location_name: locationMap.get(row.location_id)?.name ?? "",
      location_timezone: locationMap.get(row.location_id)?.timezone ?? null,
      entry_type: row.entry_type ?? null,
      is_cancelled: Boolean(row.is_cancelled),
      is_fallback: false,
    }));

    const missingInstructorIds = Array.from(
      new Set(
        entries
          .filter((e: any) => !e.instructor_name && e.schedule_entry_id)
          .map((e: any) => String(e.schedule_entry_id))
      )
    );
    if (missingInstructorIds.length) {
      const { data: scheduleRows, error: schedErr } = await admin
        .from("class_schedule")
        .select("id,instructor_name")
        .in("id", missingInstructorIds);
      if (!schedErr) {
        const instructorById = new Map(
          (scheduleRows ?? []).map((row: any) => [String(row.id), String(row.instructor_name ?? "").trim()])
        );
        entries = entries.map((entry: any) => {
          if (entry.instructor_name || !entry.schedule_entry_id) return entry;
          const fallback = instructorById.get(String(entry.schedule_entry_id)) ?? "";
          return fallback ? { ...entry, instructor_name: fallback } : entry;
        });
      }
    }

    if (!entries.length) {
      return NextResponse.json({ ok: true, entries: [] });
    }

    const activeEntries = entries.filter((entry: any) => !entry.is_cancelled);
    activeEntries.sort((a, b) => {
      if (a.session_date === b.session_date) return timeSort(a.start_time, b.start_time);
      return String(a.session_date).localeCompare(String(b.session_date));
    });
    return NextResponse.json({ ok: true, entries: activeEntries });
  }
  const baseSelect =
      "id,class_id,location_id,day_of_week,start_time,end_time,instructor_name,room_name,start_date,end_date,entry_type,classes(name),locations(name,timezone)";
  let { data, error } = await supabase
    .from("class_schedule")
    .select(baseSelect)
    .eq("enabled", true)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (error && (String(error.message || "").includes("room_name") || String(error.message || "").includes("entry_type"))) {
    const fallbackSelect =
      "id,class_id,location_id,day_of_week,start_time,end_time,instructor_name,classes(name),locations(name,timezone)";
    const retry = await supabase
      .from("class_schedule")
      .select(fallbackSelect)
      .eq("enabled", true)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });
    data = retry.data;
    error = retry.error;
  }

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const entries = (data ?? []).map((row: any) => ({
    id: row.id,
    class_id: row.class_id,
    location_id: row.location_id,
    day_of_week: row.day_of_week,
    start_time: row.start_time,
    end_time: row.end_time,
    start_date: row.start_date ?? null,
    end_date: row.end_date ?? null,
    instructor_name: row.instructor_name,
    room_name: row.room_name ?? null,
    class_name: row.classes?.name ?? "",
    location_name: row.locations?.name ?? "",
    location_timezone: row.locations?.timezone ?? null,
    entry_type: row.entry_type ?? null,
  }));

  return NextResponse.json({ ok: true, entries });
}

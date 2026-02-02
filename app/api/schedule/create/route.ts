import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { ok: false as const, error: "Not logged in" };

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id)
    .eq("role", "admin")
    .limit(1);

  if (error) return { ok: false as const, error: error.message };
  if (!roles || roles.length === 0) return { ok: false as const, error: "Admin access required" };

  return { ok: true as const, userId: u.user.id };
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const supabase = await supabaseServer();
  const body = await req.json().catch(() => ({}));
  const class_id = String(body?.class_id ?? "").trim();
  const location_id = String(body?.location_id ?? "").trim();
  const day_of_week = Number(body?.day_of_week ?? 0);
  const start_time = String(body?.start_time ?? "").trim();
  const end_time = String(body?.end_time ?? "").trim() || null;
  const start_date = String(body?.start_date ?? "").trim();
  const end_date = String(body?.end_date ?? "").trim();
  const instructor_name = String(body?.instructor_name ?? "").trim() || null;
  const room_name = String(body?.room_name ?? "").trim() || null;
  const entry_type = String(body?.entry_type ?? "").trim() || null;
  const break_dates = Array.isArray(body?.break_dates) ? body.break_dates : [];

  if (!class_id || !location_id || !start_time || !Number.isFinite(day_of_week) || !start_date || !end_date) {
    return NextResponse.json({ ok: false, error: "Missing class_id/location_id/day_of_week/start_time/start_date/end_date" }, { status: 400 });
  }

  let { data, error } = await supabase
    .from("class_schedule")
    .insert({
      class_id,
      location_id,
      day_of_week,
      start_time,
      end_time,
      start_date,
      end_date,
      instructor_name,
      room_name,
      entry_type,
      enabled: true,
    })
    .select("id")
    .single();

  if (error && (String(error.message || "").includes("room_name") || String(error.message || "").includes("entry_type"))) {
    const retry = await supabase
      .from("class_schedule")
      .insert({
        class_id,
        location_id,
        day_of_week,
        start_time,
        end_time,
        start_date,
        end_date,
        instructor_name,
        enabled: true,
      })
      .select("id")
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const entryId = data?.id;
  if (entryId) {
    const instances: any[] = [];
    const cursor = new Date(`${start_date}T00:00:00`);
    const end = new Date(`${end_date}T00:00:00`);
    const maxDays = 370;
    let guard = 0;
    while (cursor <= end && guard < maxDays) {
      if (cursor.getDay() === day_of_week) {
        const session_date = cursor.toISOString().slice(0, 10);
        instances.push({
          schedule_entry_id: entryId,
          class_id,
          location_id,
          session_date,
          start_time,
          end_time,
          instructor_name,
          room_name,
          entry_type,
        });
      }
      cursor.setDate(cursor.getDate() + 1);
      guard += 1;
    }

    if (instances.length) {
      let { error: iErr } = await supabase
        .from("class_schedule_instances")
        .upsert(instances, { onConflict: "schedule_entry_id,session_date" });
      if (iErr && String(iErr.message || "").includes("entry_type")) {
        const trimmed = instances.map(({ entry_type, ...rest }) => rest);
        const retry = await supabase
          .from("class_schedule_instances")
          .upsert(trimmed, { onConflict: "schedule_entry_id,session_date" });
        iErr = retry.error;
      }
      if (iErr) return NextResponse.json({ ok: false, error: iErr.message }, { status: 500 });
    }
  }

  if (entryId && break_dates.length) {
    const normalized = break_dates
      .map((d: any) => String(d ?? "").trim())
      .filter(Boolean);
    if (normalized.length) {
      const { error: bErr } = await supabase
        .from("class_schedule_instances")
        .update({ is_cancelled: true })
        .eq("schedule_entry_id", entryId)
        .in("session_date", normalized);
      if (bErr && !String(bErr.message || "").includes("is_cancelled")) {
        return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ ok: true, id: entryId });
}

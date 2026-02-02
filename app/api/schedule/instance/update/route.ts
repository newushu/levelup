import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function requireAdmin() {
  const supabase = await supabaseServer();
  const admin = supabaseAdmin();
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

  return { ok: true as const };
}

export async function POST(req: Request) {
  try {
    const gate = await requireAdmin();
    if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

    const admin = supabaseAdmin();
    const body = await req.json().catch(() => ({}));
    const asString = (value: unknown) => (typeof value === "string" ? value.trim() : "");
    const id = asString(body?.id);
    const schedule_entry_id = asString(body?.schedule_entry_id);
    const session_date = asString(body?.session_date);
    const original_date = asString(body?.original_date);
    const class_id = asString(body?.class_id);
    const location_id = asString(body?.location_id);

    if (!id && !(schedule_entry_id && session_date)) {
      return NextResponse.json({ ok: false, error: "Missing id or schedule_entry_id/session_date" }, { status: 400 });
    }

    const patch: Record<string, any> = {};
    if (body?.session_date) patch.session_date = String(body.session_date).trim();
    if (body?.start_time) patch.start_time = String(body.start_time).trim();
    if (body?.end_time !== undefined) patch.end_time = body.end_time ? String(body.end_time).trim() : null;
    if (body?.instructor_name !== undefined) patch.instructor_name = String(body.instructor_name ?? "").trim() || null;
    if (body?.room_name !== undefined) patch.room_name = String(body.room_name ?? "").trim() || null;
    if (body?.is_cancelled !== undefined) patch.is_cancelled = Boolean(body.is_cancelled);

    if (!Object.keys(patch).length) {
      return NextResponse.json({ ok: false, error: "No updates provided" }, { status: 400 });
    }

    const isUuid = (value: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

    const safeScheduleId = isUuid(schedule_entry_id) ? schedule_entry_id : "";
    const targetDate = patch.session_date ? String(patch.session_date).trim() : session_date;
    const hasDateMove = patch.session_date && safeScheduleId && original_date;
    if (hasDateMove) {
      const { error: delErr } = await admin
        .from("class_schedule_instances")
        .delete()
        .eq("schedule_entry_id", safeScheduleId)
        .eq("session_date", targetDate);
      if (delErr) {
        return NextResponse.json({ ok: false, error: `Pre-move cleanup failed: ${delErr.message}` }, { status: 500 });
      }
    }

    let updatedById: any = null;
    let resolvedClassId = class_id;
    let resolvedLocationId = location_id;
    if ((!resolvedClassId || !resolvedLocationId) && safeScheduleId) {
      const { data: schedRow, error: sErr } = await admin
        .from("class_schedule")
        .select("class_id,location_id")
        .eq("id", safeScheduleId)
        .maybeSingle();
      if (sErr) {
        return NextResponse.json({ ok: false, error: `Schedule lookup failed: ${sErr.message}` }, { status: 500 });
      }
      if (schedRow) {
        resolvedClassId = resolvedClassId || schedRow.class_id;
        resolvedLocationId = resolvedLocationId || schedRow.location_id;
      }
    }

    if (id && isUuid(id)) {
      const { data, error } = await admin
        .from("class_schedule_instances")
        .update(patch)
        .eq("id", id)
        .select("id,schedule_entry_id,session_date,start_time,end_time,instructor_name,room_name,is_cancelled");
      if (error) {
        return NextResponse.json({ ok: false, error: `Update by id failed: ${error.message}` }, { status: 500 });
      }
      updatedById = (data ?? [])[0] ?? null;
    }

    if (updatedById) {
      return NextResponse.json({ ok: true, action: "update", instance: updatedById });
    }

    if (safeScheduleId && original_date) {
      const { data: moved, error } = await admin
        .from("class_schedule_instances")
        .update(patch)
        .eq("schedule_entry_id", safeScheduleId)
        .eq("session_date", original_date)
        .select("id,schedule_entry_id,session_date,start_time,end_time,instructor_name,room_name,is_cancelled");
      if (!error && moved && moved.length) {
        return NextResponse.json({ ok: true, action: "move", instance: moved[0] });
      }
      if (error) {
        return NextResponse.json({ ok: false, error: `Move update failed: ${error.message}` }, { status: 500 });
      }
    }

    if (!resolvedClassId || !resolvedLocationId) {
      return NextResponse.json({ ok: false, error: "Missing class_id/location_id for upsert" }, { status: 400 });
    }

    let { data: upserted, error } = await admin
      .from("class_schedule_instances")
      .upsert(
        {
          schedule_entry_id: safeScheduleId,
          session_date: targetDate,
          class_id: resolvedClassId,
          location_id: resolvedLocationId,
          ...patch,
        },
        { onConflict: "schedule_entry_id,session_date" }
      )
      .select("id,schedule_entry_id,session_date,start_time,end_time,instructor_name,room_name,is_cancelled");
    if (error && String(error.message || "").includes("location_id")) {
      const retry = await admin
        .from("class_schedule_instances")
        .upsert(
          {
            schedule_entry_id: safeScheduleId,
            session_date: targetDate,
            class_id: resolvedClassId,
            ...patch,
          },
          { onConflict: "schedule_entry_id,session_date" }
        )
        .select("id,schedule_entry_id,session_date,start_time,end_time,instructor_name,room_name,is_cancelled");
      error = retry.error;
      upserted = retry.data;
    }
    if (error) return NextResponse.json({ ok: false, error: `Upsert failed: ${error.message}` }, { status: 500 });

    return NextResponse.json({ ok: true, action: "upsert", instance: upserted?.[0] ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: `Instance update crashed: ${message}` }, { status: 500 });
  }
}

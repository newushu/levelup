import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const isMissingColumn = (err: any, column: string) =>
  String(err?.message || "").toLowerCase().includes(`column "${column.toLowerCase()}"`);

const normalizeName = (value: string) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const admin = supabaseAdmin();

  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  let instance_id = String(body?.instance_id ?? "").trim();
  let student_id = String(body?.student_id ?? "").trim();
  if (instance_id === "null" || instance_id === "undefined") instance_id = "";
  if (student_id === "null" || student_id === "undefined") student_id = "";

  if (!instance_id || !student_id) {
    return NextResponse.json({ ok: false, error: "Missing instance_id or student_id" }, { status: 400 });
  }

  const { data: instance, error: iErr } = await admin
    .from("class_schedule_instances")
    .select("id,class_id,schedule_entry_id,session_date,start_time,created_at")
    .eq("id", instance_id)
    .maybeSingle();
  if (iErr) return NextResponse.json({ ok: false, error: iErr.message }, { status: 500 });
  if (!instance) {
    return NextResponse.json({ ok: false, error: "Class instance not found" }, { status: 404 });
  }

  let class_id = String(instance.class_id ?? "").trim();
  if (class_id === "null" || class_id === "undefined") class_id = "";
  if (!class_id) {
    return NextResponse.json({ ok: false, error: "Class instance missing class_id" }, { status: 500 });
  }

  const today = String(instance.session_date ?? new Date().toISOString().slice(0, 10));
  const { data: requiredPasses, error: pErr } = await admin
    .from("class_pass_access")
    .select("pass_type_id")
    .eq("class_id", class_id);
  if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });

  if (requiredPasses && requiredPasses.length > 0) {
    const passIds = requiredPasses.map((r: any) => String(r.pass_type_id));
    let { data: validPasses, error: vErr } = await admin
      .from("student_passes")
      .select("id,payment_confirmed")
      .eq("student_id", student_id)
      .eq("active", true)
      .in("pass_type_id", passIds)
      .lte("valid_from", today)
      .or(`valid_to.is.null,valid_to.gte.${today}`);

    if (vErr && isMissingColumn(vErr, "payment_confirmed")) {
      const retry = await admin
        .from("student_passes")
        .select("id")
        .eq("student_id", student_id)
        .eq("active", true)
        .in("pass_type_id", passIds)
        .lte("valid_from", today)
        .or(`valid_to.is.null,valid_to.gte.${today}`);
      validPasses = retry.data as any;
      vErr = retry.error;
    }

    if (vErr) return NextResponse.json({ ok: false, error: vErr.message }, { status: 500 });
    const paidPasses = (validPasses ?? []).filter(
      (p: any) => p.payment_confirmed === true || p.payment_confirmed === null || p.payment_confirmed === undefined
    );
    if (!paidPasses.length) {
      return NextResponse.json({ ok: false, error: "No valid pass for this class" }, { status: 403 });
    }
  }

  const now = new Date();
  let scheduleEntryId =
    instance.schedule_entry_id && String(instance.schedule_entry_id) !== "null"
      ? String(instance.schedule_entry_id)
      : String(instance.id);
  if (scheduleEntryId === "null" || scheduleEntryId === "undefined") scheduleEntryId = "";
  if (!scheduleEntryId) {
    return NextResponse.json({ ok: false, error: "Class instance missing schedule entry id" }, { status: 500 });
  }

  const instanceId = String(instance.id ?? "").trim();
  if (!instanceId) {
    return NextResponse.json({ ok: false, error: "Class instance missing instance_id" }, { status: 500 });
  }

  let sessionId: string | null = null;
  let lastSessionInsertError: string | null = null;
  const findSession = async () => {
    const { data: activeSession, error: sErr } = await admin
      .from("class_sessions")
      .select("id")
      .eq("instance_id", instanceId)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sErr && !isMissingColumn(sErr, "instance_id")) return { error: sErr };
    if (!sErr && activeSession?.id) return { id: activeSession.id };

    const { data: bySchedule, error: seErr } = await admin
      .from("class_sessions")
      .select("id")
      .eq("class_id", class_id)
      .eq("schedule_entry_id", scheduleEntryId)
      .eq("session_date", today)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (seErr && !(isMissingColumn(seErr, "schedule_entry_id") || isMissingColumn(seErr, "session_date"))) {
      return { error: seErr };
    }
    if (!seErr && bySchedule?.id) return { id: bySchedule.id };
    return { id: null };
  };

  const findSessionAny = async () => {
    const { data: byInstance, error: sErr } = await admin
      .from("class_sessions")
      .select("id")
      .eq("instance_id", instanceId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sErr && !isMissingColumn(sErr, "instance_id")) return { error: sErr };
    if (!sErr && byInstance?.id) return { id: byInstance.id };

    const { data: bySchedule, error: seErr } = await admin
      .from("class_sessions")
      .select("id")
      .eq("class_id", class_id)
      .eq("schedule_entry_id", scheduleEntryId)
      .eq("session_date", today)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (seErr && !(isMissingColumn(seErr, "schedule_entry_id") || isMissingColumn(seErr, "session_date"))) {
      return { error: seErr };
    }
    return { id: bySchedule?.id ?? null };
  };

  const found = await findSession();
  if ((found as any).error) {
    return NextResponse.json({ ok: false, error: (found as any).error.message }, { status: 500 });
  }
  sessionId = (found as any).id ?? null;

  if (!sessionId) {
    const payloads: Record<string, any>[] = [
      {
        class_id,
        schedule_entry_id: scheduleEntryId,
        instance_id: instanceId,
        started_at: now.toISOString(),
        session_date: today,
      },
      {
        class_id,
        schedule_entry_id: scheduleEntryId,
        started_at: now.toISOString(),
        session_date: today,
      },
      {
        class_id,
        schedule_entry_id: scheduleEntryId,
        started_at: now.toISOString(),
      },
      {
        class_id,
        instance_id: instanceId,
        started_at: now.toISOString(),
      },
      {
        class_id,
        started_at: now.toISOString(),
      },
    ];

    let created: any = null;
    let cErr: any = null;

    for (const payload of payloads) {
      const attempt = await admin.from("class_sessions").insert(payload).select("id").single();
      created = attempt.data;
      cErr = attempt.error;
      if (!cErr) break;
      if (!String(cErr.message || "").toLowerCase().includes("column")) break;
    }

    if (cErr) {
      lastSessionInsertError = cErr.message ?? String(cErr);
      const isUniqueViolation = (cErr as any)?.code === "23505";
      if (isUniqueViolation) {
        const retry = await findSession();
        if ((retry as any).error) {
          return NextResponse.json({ ok: false, error: (retry as any).error.message }, { status: 500 });
        }
        sessionId = (retry as any).id ?? null;
        if (!sessionId) {
          const retryAny = await findSessionAny();
          if ((retryAny as any).error) {
            return NextResponse.json({ ok: false, error: (retryAny as any).error.message }, { status: 500 });
          }
          sessionId = (retryAny as any).id ?? null;
        }
      }

      const isActiveUniqueViolation =
        isUniqueViolation && String(cErr.message || "").includes("class_sessions_active_unique");
      if (!sessionId && isActiveUniqueViolation) {
        const { error: endErr } = await admin
          .from("class_sessions")
          .update({ ended_at: now.toISOString() })
          .eq("class_id", class_id)
          .is("ended_at", null);
        if (endErr) {
          return NextResponse.json({ ok: false, error: endErr.message }, { status: 500 });
        }

        const retryInsert = await admin
          .from("class_sessions")
          .insert({
            class_id,
            schedule_entry_id: scheduleEntryId,
            instance_id: instanceId,
            started_at: now.toISOString(),
            session_date: today,
          })
          .select("id")
          .single();
        if (!retryInsert.error) {
          sessionId = retryInsert.data?.id ?? null;
        } else {
          lastSessionInsertError = retryInsert.error.message ?? String(retryInsert.error);
        }
      }

      if (!sessionId) {
        return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });
      }
    } else {
      sessionId = created?.id ?? null;
    }
  }

  if (sessionId === "null" || sessionId === "undefined") sessionId = null;
  if (!sessionId) {
    const { data: lastSession } = await admin
      .from("class_sessions")
      .select("id")
      .eq("class_id", class_id)
      .eq("schedule_entry_id", scheduleEntryId)
      .eq("session_date", today)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    sessionId = lastSession?.id ?? null;
  }
  if (!sessionId) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unable to resolve active class session",
        debug: {
          instance_id: instanceId,
          class_id,
          schedule_entry_id: scheduleEntryId,
          session_date: today,
          last_session_insert_error: lastSessionInsertError,
        },
      },
      { status: 500 }
    );
  }

  const insertPayload = {
    class_id,
    student_id,
    checked_in_at: new Date().toISOString(),
    instance_id: instanceId,
    session_id: sessionId,
  };

  const consumeQueuedEmote = async () => {
    const { data: student } = await admin
      .from("students")
      .select("name")
      .eq("id", student_id)
      .maybeSingle();
    const fullName = String(student?.name ?? "").trim();
    if (!fullName) return null;
    const normalized = normalizeName(fullName);
    if (!normalized) return null;
    const parts = normalized.split(" ").filter(Boolean);
    const short = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1].slice(0, 1)}` : normalized;

    const { data: queued } = await admin
      .from("class_emote_messages")
      .select("id,sender_name,recipient_name,emote_id,created_at")
      .is("consumed_at", null)
      .eq("instance_id", instanceId)
      .in("recipient_search", [normalized, short])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!queued?.id) return null;

    const { data: emote } = await admin
      .from("class_emotes")
      .select("label,emoji,image_url,html,css,js")
      .eq("id", queued.emote_id)
      .maybeSingle();

    await admin.from("class_emote_messages").update({ consumed_at: new Date().toISOString() }).eq("id", queued.id);

    return {
      sender_name: String(queued.sender_name ?? "Someone"),
      recipient_name: String(queued.recipient_name ?? fullName),
      message: `${String(queued.sender_name ?? "Someone")} sends you ${String(emote?.label ?? "an emote")}, welcome to class.`,
      emote: {
        label: String(emote?.label ?? "Emote"),
        emoji: String(emote?.emoji ?? "✨"),
        image_url: emote?.image_url ?? null,
        html: String(emote?.html ?? ""),
        css: String(emote?.css ?? ""),
        js: String(emote?.js ?? ""),
      },
    };
  };
  const insertAttempt = await admin.from("attendance_checkins").insert(insertPayload).select("id").single();

  const finalizeDuplicate = async (useInstance: boolean) => {
    let q = admin
      .from("attendance_checkins")
      .select("id")
      .eq("class_id", class_id)
      .eq("student_id", student_id)
      .order("checked_in_at", { ascending: false })
      .limit(1);
    if (useInstance && instanceId) {
      q = q.eq("instance_id", instanceId);
    } else if (!useInstance && sessionId) {
      q = q.eq("session_id", sessionId);
    }
    const { data: existing, error: exErr } = await q.maybeSingle();
    if (exErr) return NextResponse.json({ ok: false, error: exErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, already: true, checkin_id: existing?.id ?? null });
  };

  if (insertAttempt.error) {
    if (isMissingColumn(insertAttempt.error, "instance_id")) {
      const retry = await admin
        .from("attendance_checkins")
        .insert({
          class_id,
          student_id,
          checked_in_at: insertPayload.checked_in_at,
          session_id: sessionId,
        })
        .select("id")
        .single();
      if (retry.error) {
        if ((retry.error as any)?.code === "23505") return finalizeDuplicate(false);
        return NextResponse.json({ ok: false, error: retry.error.message }, { status: 500 });
      }
      const emote_popup = await consumeQueuedEmote();
      return NextResponse.json({ ok: true, checkin_id: retry.data.id, emote_popup });
    }
    if ((insertAttempt.error as any)?.code === "23505") return finalizeDuplicate(true);
    return NextResponse.json({ ok: false, error: insertAttempt.error.message }, { status: 500 });
  }

  const emote_popup = await consumeQueuedEmote();
  return NextResponse.json({ ok: true, checkin_id: insertAttempt.data.id, emote_popup });
}

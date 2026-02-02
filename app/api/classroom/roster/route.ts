import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServer();
    const admin = supabaseAdmin();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    let instance_id = String(body?.instance_id ?? "").trim();
    if (instance_id === "null" || instance_id === "undefined") instance_id = "";
    if (!instance_id) {
      return NextResponse.json({ ok: false, error: "Missing instance_id" }, { status: 400 });
    }

    const { data: instance, error: iErr } = await admin
      .from("class_schedule_instances")
      .select("id,class_id,schedule_entry_id,session_date")
      .eq("id", instance_id)
      .maybeSingle();
    if (iErr) return NextResponse.json({ ok: false, error: iErr.message, step: "load_instance" }, { status: 500 });
    if (!instance) return NextResponse.json({ ok: true, roster: [] });
    let activeSessionId: string | null = null;
  const classId = String(instance.class_id ?? "").trim();
  const scheduleEntryId = String(instance.schedule_entry_id ?? "").trim();
  const sessionDate = String(instance.session_date ?? "").trim();
  let checkinIds: string[] = [];
  const isMissingColumn = (err: any, column: string) =>
    String(err?.message || "").toLowerCase().includes(`column "${column.toLowerCase()}"`);

  const { data: checkins, error: cErr } = await admin
    .from("attendance_checkins")
    .select("id")
    .eq("instance_id", instance_id);
  if (cErr && !isMissingColumn(cErr, "instance_id")) {
    return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });
  }
  checkinIds = (checkins ?? []).map((c: any) => c.id);

  const findSessionId = async () => {
    let { data: session, error: sErr } = await admin
      .from("class_sessions")
      .select("id")
      .eq("instance_id", instance_id)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sErr && !isMissingColumn(sErr, "instance_id")) {
      return { error: sErr };
    }
    if (!sErr && session?.id) return { id: session.id };

    if (classId && scheduleEntryId && sessionDate) {
      const { data: bySchedule, error: seErr } = await admin
        .from("class_sessions")
        .select("id")
        .eq("class_id", classId)
        .eq("schedule_entry_id", scheduleEntryId)
        .eq("session_date", sessionDate)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (seErr && !(isMissingColumn(seErr, "schedule_entry_id") || isMissingColumn(seErr, "session_date"))) {
        return { error: seErr };
      }
      if (!seErr && bySchedule?.id) return { id: bySchedule.id };
    }

    return { id: null };
  };

  const { id: sessionId, error: sErr } = await findSessionId();
  if (sErr) return NextResponse.json({ ok: false, error: sErr.message, step: "load_session" }, { status: 500 });
  activeSessionId = sessionId ?? null;
  if (sessionId) {
    const { data: bySession, error: bsErr } = await admin
      .from("attendance_checkins")
      .select("id")
      .eq("session_id", sessionId);
    if (bsErr) return NextResponse.json({ ok: false, error: bsErr.message }, { status: 500 });
    const merged = new Set([...(checkinIds ?? []), ...(bySession ?? []).map((c: any) => c.id)]);
    checkinIds = Array.from(merged);
  }
    if (!checkinIds.length) return NextResponse.json({ ok: true, roster: [] });

  const { data: rows, error } = await admin
    .from("classroom_roster_view")
    .select(
      "checkin_id,class_id,checked_in_at,student_id,student_name,student_level,student_points_total,student_is_competition_team,challenge_count,master_stars,badge_count,checkin_count"
    )
    .in("checkin_id", checkinIds)
    .order("checked_in_at", { ascending: true });

  const isViewMissing = (err: any) =>
    String(err?.message || "").toLowerCase().includes("classroom_roster_view") ||
    String(err?.message || "").toLowerCase().includes("does not exist") ||
    String(err?.message || "").toLowerCase().includes("relation");

  let out: any[] = [];
  const hasViewRows = !!rows?.length;
  if (!error && hasViewRows) {
    out = (rows ?? [])
      .map((r: any) => ({
        checkin_id: r.checkin_id,
        checked_in_at: r.checked_in_at,
        student: {
          id: r.student_id,
          name: r.student_name,
          level: r.student_level,
          points_total: r.student_points_total,
          is_competition_team: r.student_is_competition_team,
        },
        badgeCount: Number(r.badge_count ?? 0),
        challengeCount: Number(r.challenge_count ?? 0),
        masterStars: Math.min(10, Number(r.master_stars ?? 0)),
        checkinCount: Number(r.checkin_count ?? 0),
      }))
      .sort((a: any, b: any) => String(a.student.name).localeCompare(String(b.student.name)));
    const returnedIds = new Set(out.map((r: any) => String(r.checkin_id)));
    const missingIds = checkinIds.filter((id) => !returnedIds.has(String(id)));
    if (missingIds.length) {
      const { data: checkinRows, error: ciErr } = await admin
        .from("attendance_checkins")
        .select("id,class_id,checked_in_at,student_id")
        .in("id", missingIds)
        .order("checked_in_at", { ascending: true });
      if (ciErr) return NextResponse.json({ ok: false, error: ciErr.message, step: "load_missing_checkins" }, { status: 500 });

      const studentIds = Array.from(
        new Set((checkinRows ?? []).map((r: any) => String(r.student_id ?? "")).filter(Boolean))
      );
      const { data: students, error: sErr } = await admin
        .from("students")
        .select("id,name,level,points_total,is_competition_team")
        .in("id", studentIds);
      if (sErr) return NextResponse.json({ ok: false, error: sErr.message, step: "load_missing_students" }, { status: 500 });

      const studentMap = new Map(
        (students ?? []).map((s: any) => [
          String(s.id),
          {
            id: s.id,
            name: s.name,
            level: s.level ?? 1,
            points_total: s.points_total ?? 0,
            is_competition_team: s.is_competition_team ?? false,
          },
        ])
      );

      const { data: allCheckins } = await admin
        .from("attendance_checkins")
        .select("student_id")
        .in("student_id", studentIds);
      const checkinCountByStudent: Record<string, number> = {};
      (allCheckins ?? []).forEach((row: any) => {
        const sid = String(row.student_id ?? "");
        if (!sid) return;
        checkinCountByStudent[sid] = (checkinCountByStudent[sid] ?? 0) + 1;
      });

      const missingRows = (checkinRows ?? [])
        .map((r: any) => {
          const studentId = String(r.student_id ?? "");
          const student =
            studentMap.get(studentId) ??
            (studentId
              ? { id: studentId, name: "Unknown student", level: 1, points_total: 0, is_competition_team: false }
              : { id: `checkin:${String(r.id ?? "")}`, name: "Unknown student", level: 1, points_total: 0, is_competition_team: false });
          return {
            checkin_id: r.id,
            checked_in_at: r.checked_in_at,
            student,
            badgeCount: 0,
            challengeCount: 0,
            masterStars: 0,
            checkinCount: Number(checkinCountByStudent[student.id] ?? 0),
          };
        })
        .filter(Boolean);
      out = [...out, ...missingRows].sort((a: any, b: any) => String(a.student.name).localeCompare(String(b.student.name)));
    }
    } else if (error && !isViewMissing(error)) {
      return NextResponse.json({ ok: false, error: error.message, step: "load_view" }, { status: 500 });
    } else {
    const { data: checkinRows, error: ciErr } = await admin
      .from("attendance_checkins")
      .select("id,class_id,checked_in_at,student_id")
      .in("id", checkinIds)
      .order("checked_in_at", { ascending: true });
      if (ciErr) return NextResponse.json({ ok: false, error: ciErr.message, step: "load_checkins" }, { status: 500 });

    const studentIds = Array.from(
      new Set((checkinRows ?? []).map((r: any) => String(r.student_id ?? "")).filter(Boolean))
    );
    const { data: students, error: sErr } = await admin
      .from("students")
      .select("id,name,level,points_total,is_competition_team")
      .in("id", studentIds);
      if (sErr) return NextResponse.json({ ok: false, error: sErr.message, step: "load_students" }, { status: 500 });

    const studentMap = new Map(
      (students ?? []).map((s: any) => [
        String(s.id),
        {
          id: s.id,
          name: s.name,
          level: s.level ?? 1,
          points_total: s.points_total ?? 0,
          is_competition_team: s.is_competition_team ?? false,
        },
      ])
    );

    const { data: badgeRows } = await admin
      .from("student_achievement_badges")
      .select("student_id")
      .in("student_id", studentIds);
    const badgeCountByStudent: Record<string, number> = {};
    (badgeRows ?? []).forEach((row: any) => {
      const sid = String(row.student_id ?? "");
      if (!sid) return;
      badgeCountByStudent[sid] = (badgeCountByStudent[sid] ?? 0) + 1;
    });

    const { data: allCheckins } = await admin
      .from("attendance_checkins")
      .select("student_id")
      .in("student_id", studentIds);
    const checkinCountByStudent: Record<string, number> = {};
    (allCheckins ?? []).forEach((row: any) => {
      const sid = String(row.student_id ?? "");
      if (!sid) return;
      checkinCountByStudent[sid] = (checkinCountByStudent[sid] ?? 0) + 1;
    });

    out = (checkinRows ?? [])
      .map((r: any) => {
        const student = studentMap.get(String(r.student_id ?? ""));
        if (!student) return null;
        return {
          checkin_id: r.id,
          checked_in_at: r.checked_in_at,
          student,
          badgeCount: Number(badgeCountByStudent[student.id] ?? 0),
          challengeCount: 0,
          masterStars: 0,
          checkinCount: Number(checkinCountByStudent[student.id] ?? 0),
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => String(a.student.name).localeCompare(String(b.student.name)));
  }

    const { data: levelRows } = await admin
    .from("avatar_level_thresholds")
    .select("level,min_lifetime_points")
    .order("level", { ascending: true });
  if (levelRows?.length) {
    const sorted = levelRows
      .map((row: any) => ({
        level: Number(row.level),
        min: Number(row.min_lifetime_points ?? 0),
      }))
      .filter((row: any) => Number.isFinite(row.level))
      .sort((a: any, b: any) => a.level - b.level);

    out.forEach((row: any) => {
      const points = Number(row.student.points_total ?? 0);
      let nextLevel = row.student.level ?? 1;
      sorted.forEach((lvl: any) => {
        if (points >= lvl.min) nextLevel = lvl.level;
      });
      row.student.level = nextLevel;
    });
  }

    const studentIds = out.map((r: any) => r.student.id);
    if (studentIds.length) {
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const { data: legacyAvatars } = await admin
        .from("students")
        .select("id,avatar_storage_path")
        .in("id", studentIds);
      const legacyAvatarByStudent = new Map<string, string | null>();
      (legacyAvatars ?? []).forEach((row: any) =>
        legacyAvatarByStudent.set(String(row.id), row.avatar_storage_path ?? null)
      );
      const { data: settings, error: sErr } = await admin
        .from("student_avatar_settings")
        .select("student_id,avatar_id,bg_color,particle_style,corner_border_key,card_plate_key")
        .in("student_id", studentIds);
      if (sErr) return NextResponse.json({ ok: false, error: sErr.message, step: "load_avatar_settings" }, { status: 500 });

      const avatarIds = Array.from(
        new Set((settings ?? []).map((s: any) => String(s.avatar_id ?? "").trim()).filter(Boolean))
      );
      let avatarMap = new Map<string, { storage_path: string | null }>();
      if (avatarIds.length) {
        const { data: avatars, error: aErr } = await admin
          .from("avatars")
          .select("id,storage_path")
          .in("id", avatarIds);
        if (aErr) return NextResponse.json({ ok: false, error: aErr.message, step: "load_avatars" }, { status: 500 });
        (avatars ?? []).forEach((a: any) => avatarMap.set(String(a.id), { storage_path: a.storage_path ?? null }));
      }

    const borderKeys = Array.from(
      new Set((settings ?? []).map((s: any) => String(s.corner_border_key ?? "").trim()).filter(Boolean))
    );
    const borderByKey = new Map<
      string,
      {
        image_url: string | null;
        render_mode?: string | null;
        html?: string | null;
        css?: string | null;
        js?: string | null;
        offset_x?: number | null;
        offset_y?: number | null;
        offsets_by_context?: Record<string, { x?: number | null; y?: number | null; scale?: number | null }> | null;
        unlock_level: number;
        unlock_points: number;
        enabled: boolean;
      }
    >();
    if (borderKeys.length) {
      const { data: borders } = await admin
        .from("ui_corner_borders")
        .select("key,image_url,render_mode,html,css,js,offset_x,offset_y,offsets_by_context,unlock_level,unlock_points,enabled")
        .in("key", borderKeys);
      (borders ?? []).forEach((b: any) =>
        borderByKey.set(String(b.key), {
          image_url: b.image_url ?? null,
          render_mode: b.render_mode ?? "image",
          html: b.html ?? "",
          css: b.css ?? "",
          js: b.js ?? "",
          offset_x: Number(b.offset_x ?? 0),
          offset_y: Number(b.offset_y ?? 0),
          offsets_by_context: b.offsets_by_context ?? {},
          unlock_level: Number(b.unlock_level ?? 1),
          unlock_points: Number(b.unlock_points ?? 0),
          enabled: b.enabled !== false,
        })
      );
    }
    const plateKeys = Array.from(
      new Set((settings ?? []).map((s: any) => String(s.card_plate_key ?? "").trim()).filter(Boolean))
    );
    const plateByKey = new Map<string, { image_url: string | null; unlock_level: number; unlock_points: number; enabled: boolean }>();
    if (plateKeys.length) {
      const { data: plates } = await admin
        .from("ui_card_plate_borders")
        .select("key,image_url,unlock_level,unlock_points,enabled")
        .in("key", plateKeys);
      (plates ?? []).forEach((p: any) =>
        plateByKey.set(String(p.key), {
          image_url: p.image_url ?? null,
          unlock_level: Number(p.unlock_level ?? 1),
          unlock_points: Number(p.unlock_points ?? 0),
          enabled: p.enabled !== false,
        })
      );
    }

    const effectKeys = Array.from(
      new Set(
        (settings ?? [])
          .map((s: any) => String(s.particle_style ?? "").trim())
          .filter((key: string) => key && key !== "none")
      )
    );
    const effectByKey = new Map<string, { unlock_level: number; unlock_points: number; enabled: boolean }>();
    if (effectKeys.length) {
      const { data: effects } = await admin
        .from("avatar_effects")
        .select("key,unlock_level,unlock_points,enabled")
        .in("key", effectKeys);
      (effects ?? []).forEach((e: any) =>
        effectByKey.set(String(e.key), {
          unlock_level: Number(e.unlock_level ?? 1),
          unlock_points: Number(e.unlock_points ?? 0),
          enabled: e.enabled !== false,
        })
      );
    }

    const cornerUnlocksByStudent = new Map<string, Set<string>>();
    const plateUnlocksByStudent = new Map<string, Set<string>>();
    const effectUnlocksByStudent = new Map<string, Set<string>>();
    if (studentIds.length) {
      const { data: unlockRows } = await admin
        .from("student_custom_unlocks")
        .select("student_id,item_type,item_key")
        .in("student_id", studentIds)
        .in("item_type", ["corner_border", "card_plate", "effect"]);
      (unlockRows ?? []).forEach((row: any) => {
        const sid = String(row.student_id ?? "");
        const key = String(row.item_key ?? "");
        const type = String(row.item_type ?? "");
        if (!sid || !key) return;
        if (type === "corner_border") {
          const set = cornerUnlocksByStudent.get(sid) ?? new Set<string>();
          set.add(key);
          cornerUnlocksByStudent.set(sid, set);
        } else if (type === "card_plate") {
          const set = plateUnlocksByStudent.get(sid) ?? new Set<string>();
          set.add(key);
          plateUnlocksByStudent.set(sid, set);
        } else if (type === "effect") {
          const set = effectUnlocksByStudent.get(sid) ?? new Set<string>();
          set.add(key);
          effectUnlocksByStudent.set(sid, set);
        }
      });
    }
    const avatarByStudent = new Map<
      string,
      {
        storage_path: string | null;
        bg_color: string | null;
        particle_style: string | null;
        corner_border_url: string | null;
        corner_border_render_mode?: string | null;
        corner_border_html?: string | null;
        corner_border_css?: string | null;
        corner_border_js?: string | null;
        corner_border_offset_x?: number | null;
        corner_border_offset_y?: number | null;
        corner_border_offsets_by_context?: Record<string, { x?: number | null; y?: number | null; scale?: number | null }> | null;
        card_plate_url: string | null;
      }
    >();
    (settings ?? []).forEach((s: any) => {
      const id = String(s.student_id ?? "");
      const avatarId = String(s.avatar_id ?? "");
      const avatar = avatarMap.get(avatarId) ?? { storage_path: null };
      const legacyPath = legacyAvatarByStudent.get(id) ?? null;
      const borderKey = String(s.corner_border_key ?? "").trim();
      const border = borderKey ? borderByKey.get(borderKey) : null;
      const level = out.find((row: any) => row.student.id === id)?.student.level ?? 1;
      const borderUnlocked = border && border.unlock_points > 0
        ? (cornerUnlocksByStudent.get(id)?.has(borderKey) ?? false)
        : true;
      const borderOk = border && border.enabled && Number(level) >= border.unlock_level && borderUnlocked;
      const plateKey = String(s.card_plate_key ?? "").trim();
      const plate = plateKey ? plateByKey.get(plateKey) : null;
      const plateUnlocked = plate && plate.unlock_points > 0
        ? (plateUnlocksByStudent.get(id)?.has(plateKey) ?? false)
        : true;
      const plateOk = plate && plate.enabled && Number(level) >= plate.unlock_level && plateUnlocked;
      const effectKey = String(s.particle_style ?? "").trim();
      const effect = effectKey ? effectByKey.get(effectKey) : null;
      const effectUnlocked = effect && effect.unlock_points > 0
        ? (effectUnlocksByStudent.get(id)?.has(effectKey) ?? false)
        : true;
      const effectOk = effect && effect.enabled && Number(level) >= effect.unlock_level && effectUnlocked;
      avatarByStudent.set(id, {
        storage_path: avatar.storage_path ?? legacyPath ?? null,
        bg_color: s.bg_color ?? null,
        particle_style: effectOk ? effectKey || null : null,
        corner_border_url: borderOk ? border?.image_url ?? null : null,
        corner_border_render_mode: borderOk ? border?.render_mode ?? "image" : null,
        corner_border_html: borderOk ? border?.html ?? "" : null,
        corner_border_css: borderOk ? border?.css ?? "" : null,
        corner_border_js: borderOk ? border?.js ?? "" : null,
        corner_border_offset_x: borderOk ? Number(border?.offset_x ?? 0) : 0,
        corner_border_offset_y: borderOk ? Number(border?.offset_y ?? 0) : 0,
        corner_border_offsets_by_context: borderOk ? (border?.offsets_by_context ?? {}) : {},
        card_plate_url: plateOk ? plate?.image_url ?? null : null,
      });
    });

    out.forEach((row: any) => {
      const legacyPath = legacyAvatarByStudent.get(row.student.id) ?? null;
      const avatar =
        avatarByStudent.get(row.student.id) ?? {
          storage_path: legacyPath ?? null,
          bg_color: null,
          corner_border_url: null,
          card_plate_url: null,
        };
      row.student.avatar_storage_path = avatar.storage_path;
      row.student.avatar_bg = avatar.bg_color;
      row.student.avatar_effect = avatar.particle_style;
      row.student.corner_border_url = avatar.corner_border_url;
      row.student.corner_border_render_mode = avatar.corner_border_render_mode ?? null;
      row.student.corner_border_html = avatar.corner_border_html ?? null;
      row.student.corner_border_css = avatar.corner_border_css ?? null;
      row.student.corner_border_js = avatar.corner_border_js ?? null;
      row.student.corner_border_offset_x = avatar.corner_border_offset_x ?? 0;
      row.student.corner_border_offset_y = avatar.corner_border_offset_y ?? 0;
      row.student.corner_border_offsets_by_context = avatar.corner_border_offsets_by_context ?? {};
      row.student.card_plate_url = avatar.card_plate_url;
    });

    let { data: badgeRows, error: badgeErr } = await admin
      .from("student_achievement_badges")
      .select("student_id,achievement_badges:badge_id(id,category,icon_path,badge_library:badge_library_id(image_url))")
      .in("student_id", studentIds);

    if (badgeErr && (String(badgeErr.message || "").includes("relationship") || String(badgeErr.message || "").includes("column"))) {
      const retry = await admin
        .from("student_achievement_badges")
        .select("student_id,achievement_badges:badge_id(id,category,icon_path)")
        .in("student_id", studentIds);
      badgeRows = retry.data;
    }

    const prestigeMap = new Map<string, string[]>();
    (badgeRows ?? []).forEach((row: any) => {
      const sid = String(row.student_id ?? "");
      const category = String(row?.achievement_badges?.category ?? "").toLowerCase();
      if (category !== "prestige") return;
      const badgeId = String(row?.achievement_badges?.id ?? "").trim();
      const libraryUrl = String(row?.achievement_badges?.badge_library?.image_url ?? "").trim();
      const rawIconPath = String(row?.achievement_badges?.icon_path ?? "").trim();
      const iconPath = rawIconPath || (badgeId === "prestige:comp_team" ? "prestige/compteam.png" : "");
      const clean = iconPath.replace(/^\/+/, "");
      const fullPath = clean && clean.startsWith("badges/") ? clean : clean ? `badges/${clean}` : "";
      const iconUrl = libraryUrl || (baseUrl && fullPath ? `${baseUrl}/storage/v1/object/public/${fullPath}` : "");
      if (!iconUrl) return;
      const next = new Set([...(prestigeMap.get(sid) ?? []), iconUrl]);
      prestigeMap.set(sid, Array.from(next));
    });

    out.forEach((row: any) => {
      const sid = row.student.id;
      row.student.prestige_badges = prestigeMap.get(sid) ?? [];
    });
  }

    return NextResponse.json({ ok: true, session_id: activeSessionId, roster: out });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Unexpected error", step: "unexpected" },
      { status: 500 }
    );
  }
}

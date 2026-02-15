import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { computeDailyRedeemStatus, getLeaderboardBoardMapForDate, getSnapshotCycleDateKey } from "@/lib/dailyRedeem";

type RoleAuth = { ok: boolean; roleList: string[]; status?: number; error?: string };

async function getRoleList(): Promise<RoleAuth> {
  const supabase = await supabaseServer();
  const admin = supabaseAdmin();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { ok: false, roleList: [], status: 401, error: "Not logged in" };
  const { data: roles, error } = await admin.from("user_roles").select("role").eq("user_id", user.user.id);
  if (error) return { ok: false, roleList: [], status: 500, error: error.message };
  const roleList = (roles ?? []).map((r: any) => String(r.role ?? "").toLowerCase());
  return { ok: true, roleList };
}

function canRead(roleList: string[]) {
  return roleList.some((r) => ["admin", "coach", "camp", "display", "classroom"].includes(r));
}

function canWrite(roleList: string[]) {
  return roleList.some((r) => ["admin", "coach", "camp"].includes(r));
}

function asBool(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function asInt(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function isMissingRelation(err: any) {
  const msg = String(err?.message ?? "").toLowerCase();
  return msg.includes("does not exist") || msg.includes("relation") || msg.includes("not found");
}
function isMissingColumn(err: any, column: string) {
  const msg = String(err?.message ?? "").toLowerCase();
  const key = column.toLowerCase();
  return msg.includes(`column \"${key}\"`) || msg.includes(`.${key}`) || msg.includes(key);
}

async function hasV2Tables(admin: ReturnType<typeof supabaseAdmin>) {
  const { error } = await admin.from("camp_display_rosters").select("id").limit(1);
  return !error;
}

async function loadStudentsByIds(admin: ReturnType<typeof supabaseAdmin>, ids: string[]) {
  const studentsById = new Map<string, any>();
  if (!ids.length) return studentsById;

  let students: any[] = [];
  const richSelect = await admin
    .from("students")
    .select(
      "id,name,level,points_total,lifetime_points,avatar_storage_path,avatar_bg,avatar_zoom_pct,avatar_effect,corner_border_url,corner_border_render_mode,corner_border_html,corner_border_css,corner_border_js,corner_border_offset_x,corner_border_offset_y,corner_border_offsets_by_context"
    )
    .in("id", ids);
  if (!richSelect.error) {
    students = (richSelect.data ?? []) as any[];
  } else {
    const mediumSelect = await admin
      .from("students")
      .select("id,name,level,points_total,lifetime_points,avatar_storage_path,avatar_bg,avatar_effect,corner_border_url")
      .in("id", ids);
    if (!mediumSelect.error) {
      students = (mediumSelect.data ?? []) as any[];
    } else {
      const basicSelect = await admin.from("students").select("id,name,level,points_total").in("id", ids);
      students = (basicSelect.data ?? []) as any[];
    }
  }
  const thresholdsRes = await admin
    .from("avatar_level_thresholds")
    .select("level,min_lifetime_points")
    .order("level", { ascending: true });
  const thresholds = (thresholdsRes.error ? [] : (thresholdsRes.data ?? []))
    .map((row: any) => ({ level: Number(row.level), min: Number(row.min_lifetime_points ?? 0) }))
    .filter((row: any) => Number.isFinite(row.level))
    .sort((a: any, b: any) => a.level - b.level);

  (students ?? []).forEach((s: any) => {
    if (thresholds.length) {
      // Keep camp display level logic consistent with classroom view.
      const points = Number(s?.points_total ?? s?.lifetime_points ?? 0);
      let computedLevel = Number(s?.level ?? 1);
      thresholds.forEach((lvl) => {
        if (points >= lvl.min) computedLevel = lvl.level;
      });
      s.level = computedLevel;
    }
    studentsById.set(String(s.id), s);
  });

  const studentIds = Array.from(studentsById.keys());
  if (!studentIds.length) return studentsById;

  const settingsRes = await admin
    .from("student_avatar_settings")
    .select("student_id,avatar_id,bg_color,particle_style,corner_border_key")
    .in("student_id", studentIds);
  if (settingsRes.error && !isMissingRelation(settingsRes.error)) {
    return studentsById;
  }
  const settings = settingsRes.error ? [] : (settingsRes.data ?? []);

  const avatarIds = Array.from(
    new Set(settings.map((s: any) => String(s.avatar_id ?? "").trim()).filter(Boolean))
  );
  const avatarById = new Map<string, { storage_path: string | null; zoom_pct: number | null }>();
  if (avatarIds.length) {
    const avatarRes = await admin
      .from("avatars")
      .select("id,storage_path,zoom_pct")
      .in("id", avatarIds);
    if (!avatarRes.error) {
      (avatarRes.data ?? []).forEach((a: any) => {
        avatarById.set(String(a.id), {
          storage_path: a.storage_path ?? null,
          zoom_pct: Number.isFinite(Number(a.zoom_pct)) ? Number(a.zoom_pct) : null,
        });
      });
    }
  }

  const borderKeys = Array.from(
    new Set(settings.map((s: any) => String(s.corner_border_key ?? "").trim()).filter(Boolean))
  );
  const borderByKey = new Map<
    string,
    {
      image_url?: string | null;
      render_mode?: string | null;
      html?: string | null;
      css?: string | null;
      js?: string | null;
      offset_x?: number | null;
      offset_y?: number | null;
      offsets_by_context?: Record<string, { x?: number | null; y?: number | null; scale?: number | null; rotate?: number | null }> | null;
    }
  >();
  if (borderKeys.length) {
    const richBorders = await admin
      .from("ui_corner_borders")
      .select("key,image_url,render_mode,html,css,js,offset_x,offset_y,offsets_by_context")
      .in("key", borderKeys);
    if (!richBorders.error) {
      (richBorders.data ?? []).forEach((b: any) =>
        borderByKey.set(String(b.key), {
          image_url: b.image_url ?? null,
          render_mode: b.render_mode ?? null,
          html: b.html ?? null,
          css: b.css ?? null,
          js: b.js ?? null,
          offset_x: Number.isFinite(Number(b.offset_x)) ? Number(b.offset_x) : null,
          offset_y: Number.isFinite(Number(b.offset_y)) ? Number(b.offset_y) : null,
          offsets_by_context: b.offsets_by_context ?? null,
        })
      );
    } else if (isMissingColumn(richBorders.error, "render_mode")) {
      const basicBorders = await admin
        .from("ui_corner_borders")
        .select("key,image_url")
        .in("key", borderKeys);
      if (!basicBorders.error) {
        (basicBorders.data ?? []).forEach((b: any) =>
          borderByKey.set(String(b.key), {
            image_url: b.image_url ?? null,
          })
        );
      }
    }
  }

  settings.forEach((cfg: any) => {
    const sid = String(cfg.student_id ?? "");
    if (!sid) return;
    const student = studentsById.get(sid);
    if (!student) return;

    const avatar = avatarById.get(String(cfg.avatar_id ?? ""));
    if ((!student.avatar_storage_path || String(student.avatar_storage_path).trim() === "") && avatar?.storage_path) {
      student.avatar_storage_path = avatar.storage_path;
    }
    if ((student.avatar_zoom_pct === null || student.avatar_zoom_pct === undefined) && avatar?.zoom_pct != null) {
      student.avatar_zoom_pct = avatar.zoom_pct;
    }
    if (!student.avatar_bg && cfg.bg_color) {
      student.avatar_bg = cfg.bg_color;
    }
    if (!student.avatar_effect && cfg.particle_style && String(cfg.particle_style) !== "none") {
      student.avatar_effect = cfg.particle_style;
    }

    const border = borderByKey.get(String(cfg.corner_border_key ?? ""));
    if (border) {
      if (!student.corner_border_url && border.image_url) student.corner_border_url = border.image_url;
      if (!student.corner_border_render_mode && border.render_mode) student.corner_border_render_mode = border.render_mode;
      if (!student.corner_border_html && border.html) student.corner_border_html = border.html;
      if (!student.corner_border_css && border.css) student.corner_border_css = border.css;
      if (!student.corner_border_js && border.js) student.corner_border_js = border.js;
      if ((student.corner_border_offset_x == null) && border.offset_x != null) student.corner_border_offset_x = border.offset_x;
      if ((student.corner_border_offset_y == null) && border.offset_y != null) student.corner_border_offset_y = border.offset_y;
      if (!student.corner_border_offsets_by_context && border.offsets_by_context) {
        student.corner_border_offsets_by_context = border.offsets_by_context;
      }
    }

    studentsById.set(sid, student);
  });

  return studentsById;
}

async function loadRecentLedgerByStudent(admin: ReturnType<typeof supabaseAdmin>, ids: string[]) {
  const map = new Map<string, { points: number; note: string; category: string; created_at: string }>();
  if (!ids.length) return map;

  const { data: rows } = await admin
    .from("ledger")
    .select("student_id,points,note,category,created_at")
    .in("student_id", ids)
    .order("created_at", { ascending: false })
    .limit(Math.min(ids.length * 12, 600));

  for (const row of rows ?? []) {
    const sid = String((row as any).student_id ?? "");
    if (!sid || map.has(sid)) continue;
    map.set(sid, {
      points: Number((row as any).points ?? 0),
      note: String((row as any).note ?? ""),
      category: String((row as any).category ?? ""),
      created_at: String((row as any).created_at ?? ""),
    });
  }
  return map;
}

async function loadCampTallyByStudent(admin: ReturnType<typeof supabaseAdmin>, ids: string[]) {
  const empty = new Map<string, { spotlight: number; rule_keeper: number; rule_breaker: number }>();
  if (!ids.length) return empty;
  const { data: rows } = await admin
    .from("ledger")
    .select("student_id,category,points,note")
    .in("student_id", ids)
    .or("category.eq.rule_keeper,category.eq.rule_breaker,category.eq.camp_spotlight,note.ilike.%camp spotlight%");
  for (const row of rows ?? []) {
    const sid = String((row as any).student_id ?? "");
    if (!sid) continue;
    const cur = empty.get(sid) ?? { spotlight: 0, rule_keeper: 0, rule_breaker: 0 };
    const category = String((row as any).category ?? "").toLowerCase();
    if (category === "rule_keeper") cur.rule_keeper += 1;
    else if (category === "rule_breaker") cur.rule_breaker += 1;
    else if (category === "camp_spotlight" || String((row as any).note ?? "").toLowerCase().includes("camp spotlight")) cur.spotlight += 1;
    empty.set(sid, cur);
  }
  return empty;
}

function rosterWindowBounds(roster: any) {
  const createdAt = String(roster?.created_at ?? "");
  const startDate = String(roster?.start_date ?? "").trim();
  const endDate = String(roster?.end_date ?? "").trim();
  const start = startDate || (createdAt ? createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const endBase = endDate || start;
  const endDateObj = new Date(`${endBase}T00:00:00.000Z`);
  if (!Number.isFinite(endDateObj.getTime())) {
    return { startIso: `${start}T00:00:00.000Z`, endIsoExclusive: `${start}T23:59:59.999Z` };
  }
  endDateObj.setUTCDate(endDateObj.getUTCDate() + 1);
  return { startIso: `${start}T00:00:00.000Z`, endIsoExclusive: endDateObj.toISOString() };
}

async function loadDailyRedeemByStudent(admin: ReturnType<typeof supabaseAdmin>, ids: string[]) {
  const result = new Map<string, { can_redeem: boolean; available_points: number }>();
  if (!ids.length) return result;
  const snapshotDate = getSnapshotCycleDateKey(new Date());
  const boardMapRes = await getLeaderboardBoardMapForDate(admin, snapshotDate);
  if (!boardMapRes.ok) return result;
  for (const studentId of ids) {
    const status = await computeDailyRedeemStatus(admin, studentId, boardMapRes, snapshotDate);
    if (!status.ok) continue;
    result.set(studentId, {
      can_redeem: status.status.can_redeem === true,
      available_points: Math.max(0, Number(status.status.available_points ?? 0)),
    });
  }
  return result;
}

async function loadRecentMvpAnnouncements(admin: ReturnType<typeof supabaseAdmin>, ids: string[]) {
  if (!ids.length) return [] as Array<{ student_id: string; name: string; created_at: string }>;
  const { data, error } = await admin
    .from("battle_mvp_awards")
    .select("student_id,created_at")
    .in("student_id", ids)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return [];

  const studentIds = Array.from(new Set((data ?? []).map((d: any) => String(d.student_id ?? "")).filter(Boolean)));
  const { data: students } = await admin.from("students").select("id,name").in("id", studentIds);
  const byId = new Map((students ?? []).map((s: any) => [String(s.id), String(s.name ?? "Student")])) as Map<string, string>;

  return (data ?? []).map((row: any) => ({
    student_id: String(row.student_id ?? ""),
    name: byId.get(String(row.student_id ?? "")) ?? "Student",
    created_at: String(row.created_at ?? ""),
  }));
}

async function getLegacyPayload(admin: ReturnType<typeof supabaseAdmin>) {
  const { data: rosterRows, error: rosterErr } = await admin
    .from("camp_display_students")
    .select("id,student_id,display_role,sort_order,enabled")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (rosterErr) {
    return NextResponse.json({ ok: false, error: rosterErr.message }, { status: 500 });
  }

  const ids = (rosterRows ?? []).map((r: any) => String(r.student_id ?? "")).filter(Boolean);
  const studentsById = await loadStudentsByIds(admin, ids);

  const roster = (rosterRows ?? []).map((row: any) => ({
    id: String(row.id),
    student_id: String(row.student_id),
    display_role: String(row.display_role ?? "camper"),
    sort_order: Number(row.sort_order ?? 0),
    enabled: row.enabled !== false,
    student: studentsById.get(String(row.student_id)) ?? null,
  }));

  return NextResponse.json({ ok: true, version: 1, roster });
}

export async function GET(req: Request) {
  const auth = await getRoleList();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error ?? "Not allowed" }, { status: auth.status ?? 401 });
  }
  if (!canRead(auth.roleList)) return NextResponse.json({ ok: false, error: "Not allowed" }, { status: 403 });

  const admin = supabaseAdmin();
  const v2 = await hasV2Tables(admin);
  if (!v2) return getLegacyPayload(admin);

  const url = new URL(req.url);
  const screenId = Math.min(3, Math.max(1, asInt(url.searchParams.get("screen"), 1)));
  const classroomInstanceId = String(url.searchParams.get("instance_id") ?? "").trim();

  const [rostersRes, groupsRes, membersRes, screensRes] = await Promise.all([
    admin.from("camp_display_rosters").select("id,name,start_date,end_date,enabled,sort_order,created_at,updated_at").order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
    admin.from("camp_display_groups").select("id,roster_id,name,sort_order,enabled,created_at,updated_at").order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
    admin.from("camp_display_members").select("id,roster_id,group_id,student_id,display_role,secondary_role,faction_id,sort_order,enabled,created_at,updated_at").order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
    admin.from("camp_display_screens").select("id,title,roster_id,group_id,show_all_groups,enabled,updated_at").order("id", { ascending: true }),
  ]);

  const richFactionsRes = await admin
    .from("camp_factions")
    .select("id,name,color,icon,logo_url,enabled,sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  const factionsRes =
    richFactionsRes.error && isMissingRelation(richFactionsRes.error)
      ? await admin
          .from("camp_factions")
          .select("id,name,color,icon,enabled,sort_order")
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true })
      : richFactionsRes;

  if (rostersRes.error) return NextResponse.json({ ok: false, error: rostersRes.error.message }, { status: 500 });
  if (groupsRes.error) return NextResponse.json({ ok: false, error: groupsRes.error.message }, { status: 500 });
  if (membersRes.error) return NextResponse.json({ ok: false, error: membersRes.error.message }, { status: 500 });
  if (screensRes.error) return NextResponse.json({ ok: false, error: screensRes.error.message }, { status: 500 });
  if (factionsRes.error && !isMissingRelation(factionsRes.error)) return NextResponse.json({ ok: false, error: factionsRes.error.message }, { status: 500 });

  const rosters = rostersRes.data ?? [];
  const groups = groupsRes.data ?? [];
  const members = membersRes.data ?? [];
  const screens = screensRes.data ?? [];
  const factions = factionsRes.error ? [] : (factionsRes.data ?? []);

  const activeScreen = screens.find((s: any) => Number(s.id) === screenId) ?? screens[0] ?? null;
  const activeRosterId = String(activeScreen?.roster_id ?? "") || String(rosters[0]?.id ?? "");
  const activeGroupId = String(activeScreen?.group_id ?? "");
  const showAllGroups = asBool(activeScreen?.show_all_groups, true);

  if (classroomInstanceId) {
    const { data: checkins, error: checkinErr } = await admin
      .from("attendance_checkins")
      .select("id,checked_in_at,student_id")
      .eq("instance_id", classroomInstanceId)
      .order("checked_in_at", { ascending: true });
    if (checkinErr) return NextResponse.json({ ok: false, error: checkinErr.message }, { status: 500 });

    const studentIdsFromCheckin = Array.from(
      new Set((checkins ?? []).map((r: any) => String(r.student_id ?? "")).filter(Boolean))
    );
    const studentsByIdFromCheckin = await loadStudentsByIds(admin, studentIdsFromCheckin);
    const recentLedgerByStudent = await loadRecentLedgerByStudent(admin, studentIdsFromCheckin);
    const redeemByStudent = await loadDailyRedeemByStudent(admin, studentIdsFromCheckin);
    const tallyByStudent = await loadCampTallyByStudent(admin, studentIdsFromCheckin);

    const displayMembers = (checkins ?? [])
      .map((row: any, idx: number) => {
        const sid = String(row.student_id ?? "");
        if (!sid) return null;
        const student = studentsByIdFromCheckin.get(sid) ?? null;
        const tally = tallyByStudent.get(sid) ?? { spotlight: 0, rule_keeper: 0, rule_breaker: 0 };
        const redeem = redeemByStudent.get(sid) ?? { can_redeem: false, available_points: 0 };
        return {
          id: `classroom-checkin:${String(row.id ?? idx)}`,
          roster_id: "classroom_instance",
          group_id: null,
          student_id: sid,
          display_role: "camper",
          secondary_role: "",
          faction_id: null,
          sort_order: idx,
          enabled: true,
          student,
          last_change: recentLedgerByStudent.get(sid) ?? null,
          camp_tally: {
            spotlight_stars: tally.spotlight,
            rule_keepers: tally.rule_keeper,
            rule_breakers: tally.rule_breaker,
            spotlight_bonus_ready: tally.spotlight >= 10,
            spotlight_bonus_progress: `${Math.min(10, tally.spotlight)}/10`,
          },
          redeem_status: redeem,
          roster_name: "Classroom Check-In",
          group_name: "",
          roster_start_date: "",
          roster_end_date: "",
        };
      })
      .filter((m: any) => m && m.student);

    const announcementStudentIds = Array.from(new Set(displayMembers.map((m: any) => String(m.student_id ?? "")).filter(Boolean)));
    const announcements = await loadRecentMvpAnnouncements(admin, announcementStudentIds);

    return NextResponse.json({
      ok: true,
      version: 2,
      source_mode: "classroom_instance",
      source_instance_id: classroomInstanceId,
      rosters,
      groups,
      factions,
      members,
      members_hydrated: [],
      screens,
      active_screen: activeScreen,
      active_roster_id: activeRosterId,
      active_group_id: activeGroupId || null,
      show_all_groups: true,
      display_members: displayMembers,
      announcements,
    });
  }

  const allStudentIds = Array.from(new Set(members.map((m: any) => String(m.student_id ?? "")).filter(Boolean)));
  const studentsById = await loadStudentsByIds(admin, allStudentIds);
  const recentLedgerByStudent = await loadRecentLedgerByStudent(admin, allStudentIds);
  const redeemByStudent = await loadDailyRedeemByStudent(admin, allStudentIds);

  const rosterById = new Map((rosters ?? []).map((r: any) => [String(r.id), r]));
  const groupById = new Map((groups ?? []).map((g: any) => [String(g.id), g]));
  const activeRoster = rosterById.get(activeRosterId) ?? null;
  const { startIso, endIsoExclusive } = rosterWindowBounds(activeRoster);
  const campTallyByStudent = await (async () => {
    const map = new Map<
      string,
      { spotlight: number; rule_keeper: number; rule_breaker: number; rule_keeper_points: number; rule_breaker_points: number }
    >();
    if (!allStudentIds.length) return map;
    const { data: rows } = await admin
      .from("ledger")
      .select("student_id,category,note,points,created_at")
      .in("student_id", allStudentIds)
      .gte("created_at", startIso)
      .lt("created_at", endIsoExclusive)
      .or("category.eq.rule_keeper,category.eq.rule_breaker,category.eq.camp_spotlight,note.ilike.%camp spotlight%");
    for (const row of rows ?? []) {
      const sid = String((row as any).student_id ?? "");
      if (!sid) continue;
      const cur = map.get(sid) ?? { spotlight: 0, rule_keeper: 0, rule_breaker: 0, rule_keeper_points: 0, rule_breaker_points: 0 };
      const category = String((row as any).category ?? "").toLowerCase();
      const points = Number((row as any).points ?? 0);
      if (category === "rule_keeper") {
        cur.rule_keeper += 1;
        cur.rule_keeper_points += Math.max(0, Math.round(points));
      } else if (category === "rule_breaker") {
        cur.rule_breaker += 1;
        cur.rule_breaker_points += Math.max(0, Math.round(-points));
      }
      else if (category === "camp_spotlight" || String((row as any).note ?? "").toLowerCase().includes("camp spotlight")) cur.spotlight += 1;
      map.set(sid, cur);
    }
    return map;
  })();

  const hydratedMembers = members
    .map((m: any) => {
      const studentId = String(m.student_id ?? "");
      const tally = campTallyByStudent.get(studentId) ?? {
        spotlight: 0,
        rule_keeper: 0,
        rule_breaker: 0,
        rule_keeper_points: 0,
        rule_breaker_points: 0,
      };
      const redeem = redeemByStudent.get(studentId) ?? { can_redeem: false, available_points: 0 };
      return {
        id: String(m.id),
        roster_id: String(m.roster_id),
        group_id: m.group_id ? String(m.group_id) : null,
        student_id: studentId,
        display_role: String(m.display_role ?? "camper"),
        secondary_role: String(m.secondary_role ?? ""),
        faction_id: m.faction_id ? String(m.faction_id) : null,
        sort_order: Number(m.sort_order ?? 0),
        enabled: m.enabled !== false,
        student: studentsById.get(studentId) ?? null,
        last_change: recentLedgerByStudent.get(studentId) ?? null,
        camp_tally: {
          spotlight_stars: tally.spotlight,
          rule_keepers: tally.rule_keeper,
          rule_breakers: tally.rule_breaker,
          rule_keeper_points_earned: tally.rule_keeper_points,
          rule_breaker_points_lost: tally.rule_breaker_points,
          spotlight_bonus_ready: tally.spotlight >= 10,
          spotlight_bonus_progress: `${Math.min(10, tally.spotlight)}/10`,
        },
        redeem_status: redeem,
        roster_name: String(rosterById.get(String(m.roster_id))?.name ?? ""),
        group_name: String(groupById.get(String(m.group_id ?? ""))?.name ?? ""),
        roster_start_date: String(rosterById.get(String(m.roster_id))?.start_date ?? ""),
        roster_end_date: String(rosterById.get(String(m.roster_id))?.end_date ?? ""),
      };
    })
    .filter((m: any) => m.student_id);

  const membersForActive = hydratedMembers.filter((m: any) => {
    if (String(m.roster_id ?? "") !== activeRosterId) return false;
    if (!showAllGroups && activeGroupId) return String(m.group_id ?? "") === activeGroupId;
    return true;
  });

  const studentIds = Array.from(new Set(membersForActive.map((m: any) => String(m.student_id ?? "")).filter(Boolean)));
  const announcements = await loadRecentMvpAnnouncements(admin, studentIds);
  const displayMembers = membersForActive.filter((m: any) => m.student);

  return NextResponse.json({
    ok: true,
    version: 2,
    rosters,
    groups,
    factions,
    members,
    members_hydrated: hydratedMembers,
    screens,
    active_screen: activeScreen,
    active_roster_id: activeRosterId,
    active_group_id: activeGroupId || null,
    show_all_groups: showAllGroups,
    display_members: displayMembers,
    announcements,
  });
}

export async function POST(req: Request) {
  const auth = await getRoleList();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error ?? "Not allowed" }, { status: auth.status ?? 401 });
  }
  if (!canWrite(auth.roleList)) return NextResponse.json({ ok: false, error: "Not allowed" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const admin = supabaseAdmin();

  const v2 = await hasV2Tables(admin);
  const hasV2Payload = Array.isArray(body?.rosters) || Array.isArray(body?.groups) || Array.isArray(body?.members) || Array.isArray(body?.screens) || Array.isArray(body?.factions);

  if (v2 && hasV2Payload) {
    const hasRosters = Array.isArray(body?.rosters);
    const hasGroups = Array.isArray(body?.groups);
    const hasMembers = Array.isArray(body?.members);
    const hasScreens = Array.isArray(body?.screens);
    const hasFactions = Array.isArray(body?.factions);

    const rosters = (Array.isArray(body?.rosters) ? body.rosters : [])
      .map((row: any, idx: number) => ({
        id: String(row?.id ?? "").trim() || crypto.randomUUID(),
        name: String(row?.name ?? "Roster").trim() || `Roster ${idx + 1}`,
        start_date: String(row?.start_date ?? "").trim() || null,
        end_date: String(row?.end_date ?? "").trim() || null,
        enabled: asBool(row?.enabled, true),
        sort_order: asInt(row?.sort_order, idx),
      }));

    const rosterIds = new Set(rosters.map((r: any) => String(r.id)));

    const groups = (Array.isArray(body?.groups) ? body.groups : [])
      .map((row: any, idx: number) => ({
        id: String(row?.id ?? "").trim() || crypto.randomUUID(),
        roster_id: String(row?.roster_id ?? "").trim(),
        name: String(row?.name ?? "Group").trim() || `Group ${idx + 1}`,
        sort_order: asInt(row?.sort_order, idx),
        enabled: asBool(row?.enabled, true),
      }))
      .filter((row: any) => row.roster_id && rosterIds.has(row.roster_id));

    const groupIds = new Set(groups.map((g: any) => String(g.id)));

    const members = (Array.isArray(body?.members) ? body.members : [])
      .map((row: any, idx: number) => ({
        id: String(row?.id ?? "").trim() || crypto.randomUUID(),
        roster_id: String(row?.roster_id ?? "").trim(),
        group_id: String(row?.group_id ?? "").trim() || null,
        student_id: String(row?.student_id ?? "").trim(),
        display_role: String(row?.display_role ?? "camper").trim() || "camper",
        secondary_role: String(row?.secondary_role ?? "").trim().slice(0, 40),
        faction_id: String(row?.faction_id ?? "").trim() || null,
        sort_order: asInt(row?.sort_order, idx),
        enabled: asBool(row?.enabled, true),
      }))
      .filter((row: any) => row.student_id && row.roster_id && rosterIds.has(row.roster_id) && (!row.group_id || groupIds.has(String(row.group_id))));

    const screens = (Array.isArray(body?.screens) ? body.screens : [])
      .map((row: any, idx: number) => ({
        id: Math.min(3, Math.max(1, asInt(row?.id, idx + 1))),
        title: String(row?.title ?? `Camp Display ${idx + 1}`).slice(0, 80),
        roster_id: String(row?.roster_id ?? "").trim() || null,
        group_id: String(row?.group_id ?? "").trim() || null,
        show_all_groups: asBool(row?.show_all_groups, true),
        enabled: asBool(row?.enabled, true),
      }))
      .slice(0, 3);

    const dedupedScreens = Array.from(new Map(screens.map((s: any) => [s.id, s])).values());
    const factions = (Array.isArray(body?.factions) ? body.factions : [])
      .map((row: any, idx: number) => ({
        id: String(row?.id ?? "").trim() || crypto.randomUUID(),
        name: String(row?.name ?? "").trim(),
        color: String(row?.color ?? "#38bdf8").trim() || "#38bdf8",
        icon: String(row?.icon ?? "🏕️").trim() || "🏕️",
        enabled: asBool(row?.enabled, true),
        sort_order: asInt(row?.sort_order, idx),
      }))
      .filter((f: any) => f.name);

    if (hasMembers) {
      const wipeMembers = await admin.from("camp_display_members").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (wipeMembers.error && !isMissingRelation(wipeMembers.error)) return NextResponse.json({ ok: false, error: wipeMembers.error.message }, { status: 500 });
    }

    if (hasGroups) {
      const wipeGroups = await admin.from("camp_display_groups").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (wipeGroups.error && !isMissingRelation(wipeGroups.error)) return NextResponse.json({ ok: false, error: wipeGroups.error.message }, { status: 500 });
    }

    if (hasRosters) {
      const wipeRosters = await admin.from("camp_display_rosters").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (wipeRosters.error && !isMissingRelation(wipeRosters.error)) return NextResponse.json({ ok: false, error: wipeRosters.error.message }, { status: 500 });
    }

    if (hasFactions) {
      const wipeFactions = await admin.from("camp_factions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (wipeFactions.error && !isMissingRelation(wipeFactions.error)) return NextResponse.json({ ok: false, error: wipeFactions.error.message }, { status: 500 });
      if (factions.length) {
        const add = await admin.from("camp_factions").insert(factions);
        if (add.error && !isMissingRelation(add.error)) return NextResponse.json({ ok: false, error: add.error.message }, { status: 500 });
      }
    }

    if (hasRosters && rosters.length) {
      const add = await admin.from("camp_display_rosters").insert(rosters);
      if (add.error) return NextResponse.json({ ok: false, error: add.error.message }, { status: 500 });
    }

    if (hasGroups && groups.length) {
      const add = await admin.from("camp_display_groups").insert(groups);
      if (add.error) return NextResponse.json({ ok: false, error: add.error.message }, { status: 500 });
    }

    if (hasMembers && members.length) {
      const add = await admin.from("camp_display_members").insert(members);
      if (add.error) return NextResponse.json({ ok: false, error: add.error.message }, { status: 500 });
    }

    if (hasScreens && dedupedScreens.length) {
      const upsertScreens = await admin.from("camp_display_screens").upsert(dedupedScreens, { onConflict: "id" });
      if (upsertScreens.error) return NextResponse.json({ ok: false, error: upsertScreens.error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, version: 2 });
  }

  const rows = Array.isArray(body?.rows) ? body.rows : [];
  const cleanRows = rows
    .map((row: any, idx: number) => {
      const id = String(row?.id ?? "").trim();
      return {
        ...(id ? { id } : {}),
        student_id: String(row?.student_id ?? "").trim(),
        display_role: String(row?.display_role ?? "camper").trim() || "camper",
        sort_order: Number.isFinite(Number(row?.sort_order)) ? Number(row.sort_order) : idx,
        enabled: row?.enabled !== false,
      };
    })
    .filter((row: any) => row.student_id);

  const wipe = await admin.from("camp_display_students").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (wipe.error && !isMissingRelation(wipe.error)) {
    return NextResponse.json({ ok: false, error: wipe.error.message }, { status: 500 });
  }

  if (!cleanRows.length) return NextResponse.json({ ok: true, version: 1 });

  const { error } = await admin.from("camp_display_students").upsert(cleanRows, { onConflict: "student_id" });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, version: 1 });
}

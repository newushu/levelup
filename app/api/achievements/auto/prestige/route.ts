import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase/admin";

function requireSecret(req: NextRequest) {
  const got = req.headers.get("x-achievement-secret") || "";
  return got && got === process.env.ACHIEVEMENTS_CRON_SECRET;
}

type StudentRow = {
  id: string;
  name: string | null;
  is_competition_team: boolean | null;
  lifetime_points: number | null;
  level: number | null;
};

type BadgeRuleRow = {
  id: string;
  name: string | null;
  criteria_type: string | null;
  criteria_json: Record<string, any> | null;
  points_award: number | null;
};

type SkillSetRow = { id: string; name: string | null; category: string | null };
type SkillRow = { id: string; set_id: string };
type CompletionRow = { student_id: string; skill_id: string };

function countByStudentId(rows: Array<Record<string, any>>, key: string) {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const id = String(row?.[key] ?? "");
    if (!id) return;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  });
  return counts;
}

export async function POST(req: NextRequest) {
  if (!requireSecret(req)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const payload = await req.json().catch(() => ({}));
  const targetStudentId = String(payload?.student_id ?? "").trim();

  const admin = supabaseAdmin();
  const studentQuery = admin.from("students").select("id,name,is_competition_team,lifetime_points,level");
  const { data: students, error: sErr } = targetStudentId ? await studentQuery.eq("id", targetStudentId) : await studentQuery;
  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });

  const studentRows = (students ?? []) as StudentRow[];
  if (!studentRows.length) {
    return NextResponse.json({ ok: true, awarded: 0 });
  }
  const studentName = new Map(studentRows.map((s) => [s.id, s.name ?? "Student"]));
  const studentIds = studentRows.map((s) => s.id);

  const { data: badges, error: bErr } = await admin
    .from("achievement_badges")
    .select("id,name,criteria_type,criteria_json,points_award")
    .eq("category", "prestige")
    .eq("enabled", true);
  if (bErr) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 });

  const { data: sets, error: setErr } = await admin
    .from("skill_sets")
    .select("id,name,category")
    .or("category.ilike.%tumble%,name.ilike.%tumble%");
  if (setErr) return NextResponse.json({ ok: false, error: setErr.message }, { status: 500 });

  const tumbleSets = (sets ?? []) as SkillSetRow[];
  const tumbleSetIds = tumbleSets.map((s) => s.id);
  const completedTumbleSetsByStudent = new Map<string, number>();
  const completedSetsByStudent = new Map<string, number>();
  const completedTaoluSetsByStudent = new Map<string, number>();

  if (tumbleSetIds.length) {
    const { data: skills, error: skErr } = await admin
      .from("skills")
      .select("id,set_id")
      .in("set_id", tumbleSetIds);
    if (skErr) return NextResponse.json({ ok: false, error: skErr.message }, { status: 500 });

    const skillRows = (skills ?? []) as SkillRow[];
    const skillIds = skillRows.map((s) => s.id);
    const totalBySet = new Map<string, number>();
    skillRows.forEach((s) => totalBySet.set(s.set_id, (totalBySet.get(s.set_id) ?? 0) + 1));

    if (skillIds.length) {
      const { data: comps, error: cErr } = await admin
        .from("student_skills")
        .select("student_id,skill_id")
        .in("skill_id", skillIds);
      if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });

      const completionRows = (comps ?? []) as CompletionRow[];
      const skillToSet = new Map(skillRows.map((s) => [s.id, s.set_id]));
      const byStudent = new Map<string, Map<string, Set<string>>>();

      for (const row of completionRows) {
        const setId = skillToSet.get(row.skill_id);
        if (!setId) continue;
        const sMap = byStudent.get(row.student_id) ?? new Map<string, Set<string>>();
        const set = sMap.get(setId) ?? new Set<string>();
        set.add(row.skill_id);
        sMap.set(setId, set);
        byStudent.set(row.student_id, sMap);
      }

      byStudent.forEach((setsMap, studentId) => {
        let done = 0;
        setsMap.forEach((skillsSet, setId) => {
          const total = totalBySet.get(setId) ?? 0;
          if (total > 0 && skillsSet.size === total) done += 1;
        });
        completedTumbleSetsByStudent.set(studentId, done);
      });
    }
  }

  if (studentIds.length) {
    const [
      { data: checkins, error: cErr },
      { data: challenges, error: chErr },
      { data: battles, error: bErr },
      { data: awards, error: aErr },
      { data: medals, error: mErr },
      { data: taoluSessions, error: tErr },
    ] =
      await Promise.all([
        admin.from("attendance_checkins").select("student_id,session_id").in("student_id", studentIds),
        admin.from("student_challenges").select("student_id,completed").eq("completed", true).in("student_id", studentIds),
        admin.from("battle_trackers").select("winner_id").not("winner_id", "is", null).in("winner_id", studentIds),
        admin.from("class_awards").select("student_id").in("student_id", studentIds),
        admin.from("student_medals").select("student_id,medal_type").eq("medal_type", "gold").in("student_id", studentIds),
        admin.from("taolu_sessions").select("student_id").in("student_id", studentIds),
      ]);

    if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });
    if (chErr) return NextResponse.json({ ok: false, error: chErr.message }, { status: 500 });
    if (bErr) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 });
    if (aErr) return NextResponse.json({ ok: false, error: aErr.message }, { status: 500 });
    if (mErr) return NextResponse.json({ ok: false, error: mErr.message }, { status: 500 });
    if (tErr) return NextResponse.json({ ok: false, error: tErr.message }, { status: 500 });

    const checkinRows = (checkins ?? []) as Array<{ student_id?: string | null; session_id?: string | null }>;
    const checkinsByStudent = countByStudentId(checkinRows as any[], "student_id");
    const campCheckinsByStudent = new Map<string, number>();

    const sessionIds = Array.from(
      new Set(checkinRows.map((row) => String(row.session_id ?? "").trim()).filter(Boolean))
    );
    if (sessionIds.length) {
      const { data: sessions, error: sessErr } = await admin
        .from("class_sessions")
        .select("id,instance_id")
        .in("id", sessionIds);
      if (sessErr) return NextResponse.json({ ok: false, error: sessErr.message }, { status: 500 });

      const instanceIds = Array.from(
        new Set((sessions ?? []).map((row: any) => String(row.instance_id ?? "").trim()).filter(Boolean))
      );
      if (instanceIds.length) {
        let { data: instances, error: instErr } = await admin
          .from("class_schedule_instances")
          .select("id,entry_type")
          .in("id", instanceIds);
        if (instErr && String(instErr.message || "").includes("entry_type")) {
          const retry = await admin
            .from("class_schedule_instances")
            .select("id")
            .in("id", instanceIds);
          instances = retry.data;
          instErr = retry.error;
        }
        if (instErr) return NextResponse.json({ ok: false, error: instErr.message }, { status: 500 });

        const instanceType = new Map<string, string>();
        (instances ?? []).forEach((row: any) => {
          const id = String(row.id ?? "").trim();
          if (!id) return;
          instanceType.set(id, String(row.entry_type ?? ""));
        });

        const sessionType = new Map<string, string>();
        (sessions ?? []).forEach((row: any) => {
          const id = String(row.id ?? "").trim();
          const instanceId = String(row.instance_id ?? "").trim();
          if (!id || !instanceId) return;
          sessionType.set(id, instanceType.get(instanceId) ?? "");
        });

        checkinRows.forEach((row) => {
          const studentId = String(row.student_id ?? "").trim();
          if (!studentId) return;
          const entryType = sessionType.get(String(row.session_id ?? "").trim()) ?? "";
          if (entryType.toLowerCase() !== "camp") return;
          campCheckinsByStudent.set(studentId, (campCheckinsByStudent.get(studentId) ?? 0) + 1);
        });
      }
    }
    const challengesByStudent = countByStudentId((challenges ?? []) as any[], "student_id");
    const battleWinsByStudent = countByStudentId((battles ?? []) as any[], "winner_id");
    const spotlightByStudent = countByStudentId((awards ?? []) as any[], "student_id");
    const goldByStudent = countByStudentId((medals ?? []) as any[], "student_id");
    const taoluSessionsByStudent = countByStudentId((taoluSessions ?? []) as any[], "student_id");

    const { data: allSets, error: allSetsErr } = await admin.from("skill_sets").select("id");
    if (allSetsErr) return NextResponse.json({ ok: false, error: allSetsErr.message }, { status: 500 });
    const allSetIds = (allSets ?? []).map((s: any) => String(s.id));

    if (allSetIds.length) {
      const { data: allSkills, error: allSkillsErr } = await admin
        .from("skills")
        .select("id,set_id")
        .in("set_id", allSetIds);
      if (allSkillsErr) return NextResponse.json({ ok: false, error: allSkillsErr.message }, { status: 500 });
      const allSkillRows = (allSkills ?? []) as SkillRow[];
      const allSkillIds = allSkillRows.map((s) => s.id);
      const totalBySet = new Map<string, number>();
      allSkillRows.forEach((s) => totalBySet.set(s.set_id, (totalBySet.get(s.set_id) ?? 0) + 1));

      if (allSkillIds.length) {
        const { data: comps, error: compsErr } = await admin
          .from("student_skills")
          .select("student_id,skill_id")
          .in("skill_id", allSkillIds)
          .in("student_id", studentIds);
        if (compsErr) return NextResponse.json({ ok: false, error: compsErr.message }, { status: 500 });

        const skillToSet = new Map(allSkillRows.map((s) => [s.id, s.set_id]));
        const byStudent = new Map<string, Map<string, Set<string>>>();
        (comps ?? []).forEach((row: any) => {
          const setId = skillToSet.get(String(row.skill_id ?? ""));
          if (!setId) return;
          const sMap = byStudent.get(String(row.student_id ?? "")) ?? new Map<string, Set<string>>();
          const set = sMap.get(setId) ?? new Set<string>();
          set.add(String(row.skill_id ?? ""));
          sMap.set(setId, set);
          byStudent.set(String(row.student_id ?? ""), sMap);
        });

        byStudent.forEach((setsMap, studentId) => {
          let done = 0;
          setsMap.forEach((skillsSet, setId) => {
            const total = totalBySet.get(setId) ?? 0;
            if (total > 0 && skillsSet.size === total) done += 1;
          });
          completedSetsByStudent.set(studentId, done);
        });

        const taoluSetIds = new Set(
          (allSets ?? [])
            .filter((s: any) => String(s.category ?? "").toLowerCase().includes("taolu") || String(s.name ?? "").toLowerCase().includes("taolu"))
            .map((s: any) => String(s.id))
        );
        if (taoluSetIds.size) {
          const taoluSkillRows = allSkillRows.filter((s) => taoluSetIds.has(s.set_id));
          const taoluCounts = new Map<string, number>();
          const taoluTotals = new Map<string, number>();
          taoluSkillRows.forEach((s) => taoluTotals.set(s.set_id, (taoluTotals.get(s.set_id) ?? 0) + 1));
          const skillToSet = new Map(taoluSkillRows.map((s) => [s.id, s.set_id]));
          const byStudentTaolu = new Map<string, Map<string, Set<string>>>();
          (comps ?? []).forEach((row: any) => {
            const setId = skillToSet.get(String(row.skill_id ?? ""));
            if (!setId) return;
            const sMap = byStudentTaolu.get(String(row.student_id ?? "")) ?? new Map<string, Set<string>>();
            const set = sMap.get(setId) ?? new Set<string>();
            set.add(String(row.skill_id ?? ""));
            sMap.set(setId, set);
            byStudentTaolu.set(String(row.student_id ?? ""), sMap);
          });
          byStudentTaolu.forEach((setsMap, studentId) => {
            let done = 0;
            setsMap.forEach((skillsSet, setId) => {
              const total = taoluTotals.get(setId) ?? 0;
              if (total > 0 && skillsSet.size === total) done += 1;
            });
            taoluCounts.set(studentId, done);
          });
          taoluCounts.forEach((val, id) => completedTaoluSetsByStudent.set(id, val));
        }
      }
    }

    const results: Record<string, number> = { notices: 0 };

    async function awardBadge(badgeId: string, studentIds: string[], reason: string, pointsAward: number) {
      if (!studentIds.length) return;
      const { data: existing, error: exErr } = await admin
        .from("student_achievement_badges")
        .select("student_id")
        .eq("badge_id", badgeId)
        .in("student_id", studentIds);
      if (exErr) throw new Error(exErr.message);

      const existingSet = new Set((existing ?? []).map((r: any) => String(r.student_id)));
      const toInsert = studentIds.filter((id) => !existingSet.has(id));
      if (!toInsert.length) return;

      const { error: insErr } = await admin.from("student_achievement_badges").insert(
        toInsert.map((id) => ({
          student_id: id,
          badge_id: badgeId,
          source: "auto",
          awarded_by: null,
          award_note: reason,
          points_awarded: pointsAward,
        }))
      );
      if (insErr) throw new Error(insErr.message);

      if (pointsAward) {
        const { error: lErr } = await admin.from("ledger").insert(
          toInsert.map((id) => ({
            student_id: id,
            points: pointsAward,
            note: `Badge award: ${reason}`,
            category: "badge_award",
            created_by: null,
          }))
        );
        if (lErr) throw new Error(lErr.message);

        for (const id of toInsert) {
          const { error: rpcErr } = await admin.rpc("recompute_student_points", { p_student_id: id });
          if (rpcErr) throw new Error(rpcErr.message);
        }
      }

      const noticeRows = toInsert.map((id) => ({
        message: `${studentName.get(id) ?? "Student"} earned ${reason}.`,
        kind: "badge_awarded",
        student_id: id,
        badge_id: badgeId,
      }));

      const { error: nErr } = await admin.from("critical_notices").insert(noticeRows);
      if (!nErr) results.notices += noticeRows.length;
      return toInsert.length;
    }

    try {
      const rules = (badges ?? []) as BadgeRuleRow[];
      for (const badge of rules) {
        const criteriaType = String(badge.criteria_type ?? "").trim().toLowerCase();
        const criteria = badge.criteria_json ?? {};
        let eligible: string[] = [];

        if (criteriaType === "comp_team" || badge.id === "prestige:comp_team") {
          eligible = studentRows.filter((s) => s.is_competition_team).map((s) => s.id);
        } else if (criteriaType === "lifetime_points" || badge.id === "prestige:5000_points") {
          const minPoints = Number(criteria.min_points ?? criteria.min ?? (badge.id === "prestige:5000_points" ? 5000 : 0));
          eligible = studentRows
            .filter((s) => Number(s.lifetime_points ?? 0) >= minPoints)
            .map((s) => s.id);
        } else if (criteriaType === "tumble_sets_completed" || criteriaType === "tumble_skill_trees_completed" || badge.id === "prestige:tumble_10") {
          const minSets = Number(criteria.min_sets ?? criteria.min ?? 10);
          eligible = Array.from(completedTumbleSetsByStudent.entries())
            .filter(([, count]) => count >= minSets)
            .map(([id]) => id);
        } else if (criteriaType === "taolu_trackers_completed") {
          const min = Number(criteria.sessions_min ?? criteria.min ?? 1);
          eligible = studentRows
            .filter((s) => (taoluSessionsByStudent.get(s.id) ?? 0) >= min)
            .map((s) => s.id);
        } else if (criteriaType === "taolu_skill_trees_completed") {
          const min = Number(criteria.trees_min ?? criteria.min ?? 1);
          eligible = Array.from(completedTaoluSetsByStudent.entries())
            .filter(([, count]) => count >= min)
            .map(([id]) => id);
        } else if (criteriaType === "taolu_master") {
          const trackersMin = Number(criteria.trackers_min ?? criteria.sessions_min ?? 1);
          const treesMin = Number(criteria.trees_min ?? 1);
          eligible = studentRows
            .filter((s) => {
              const tCount = taoluSessionsByStudent.get(s.id) ?? 0;
              const treeCount = completedTaoluSetsByStudent.get(s.id) ?? 0;
              return tCount >= trackersMin && treeCount >= treesMin;
            })
            .map((s) => s.id);
        } else if (criteriaType === "checkins") {
          const min = Number(criteria.min ?? 1);
          eligible = studentRows
            .filter((s) => (checkinsByStudent.get(s.id) ?? 0) >= min)
            .map((s) => s.id);
        } else if (criteriaType === "camp_checkins") {
          const min = Number(criteria.min ?? 1);
          eligible = studentRows
            .filter((s) => (campCheckinsByStudent.get(s.id) ?? 0) >= min)
            .map((s) => s.id);
        } else if (criteriaType === "challenges_completed") {
          const min = Number(criteria.min ?? 1);
          eligible = studentRows
            .filter((s) => (challengesByStudent.get(s.id) ?? 0) >= min)
            .map((s) => s.id);
        } else if (criteriaType === "battle_pulse_wins") {
          const min = Number(criteria.min ?? 1);
          eligible = studentRows
            .filter((s) => (battleWinsByStudent.get(s.id) ?? 0) >= min)
            .map((s) => s.id);
        } else if (criteriaType === "spotlight_stars") {
          const min = Number(criteria.min ?? 1);
          eligible = studentRows
            .filter((s) => (spotlightByStudent.get(s.id) ?? 0) >= min)
            .map((s) => s.id);
        } else if (criteriaType === "gold_medals") {
          const min = Number(criteria.min ?? 1);
          eligible = studentRows
            .filter((s) => (goldByStudent.get(s.id) ?? 0) >= min)
            .map((s) => s.id);
        } else if (criteriaType === "skill_trees_completed") {
          const min = Number(criteria.min ?? 1);
          eligible = studentRows
            .filter((s) => (completedSetsByStudent.get(s.id) ?? 0) >= min)
            .map((s) => s.id);
        } else if (criteriaType === "level") {
          const min = Number(criteria.min ?? 1);
          eligible = studentRows
            .filter((s) => Number(s.level ?? 0) >= min)
            .map((s) => s.id);
        } else {
          continue;
        }

        const awarded = await awardBadge(
          badge.id,
          eligible,
          badge.name ?? "Prestige Badge",
          Number(badge.points_award ?? 0)
        );
        results[`${badge.id}_awarded`] = awarded ?? 0;
      }
    } catch (err: any) {
      return NextResponse.json({ ok: false, error: err?.message || "Failed to award prestige badges" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, results });
  }

  return NextResponse.json({ ok: true, results: { notices: 0 } });
}

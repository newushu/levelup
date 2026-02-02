import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";

type BattleRow = {
  id: string;
  left_student_id: string;
  right_student_id: string;
  battle_mode?: string | null;
  participant_ids?: string[] | null;
  team_a_ids?: string[] | null;
  team_b_ids?: string[] | null;
  skill_id: string;
  repetitions_target: number;
  wager_amount: number;
  wager_pct?: number | null;
  created_at: string;
  archived_at?: string | null;
  settled_at?: string | null;
  winner_id?: string | null;
  left?: { id: string; name: string; level?: number; points_total?: number } | null;
  right?: { id: string; name: string; level?: number; points_total?: number } | null;
  tracker_skills?: { id: string; name: string } | null;
};

export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const url = new URL(req.url);
  const source = String(url.searchParams.get("source") ?? "").trim().toLowerCase();

  let q = supabase
    .from("battle_trackers")
    .select(
      "id,left_student_id,right_student_id,battle_mode,participant_ids,team_a_ids,team_b_ids,skill_id,repetitions_target,wager_amount,wager_pct,created_at,archived_at,settled_at,winner_id,created_source,left:students!battle_trackers_left_student_id_fkey(id,name,level,points_total),right:students!battle_trackers_right_student_id_fkey(id,name,level,points_total),tracker_skills(id,name)"
    )
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (source) q = q.eq("created_source", source);

  const { data, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const rows = (data ?? []) as unknown as BattleRow[];
  const ids = rows.map((r) => r.id);
  const logMap = new Map<string, Map<string, Array<{ success: boolean }>>>();
  const participantsByBattle = new Map<string, string[]>();
  rows.forEach((r) => {
    const raw = Array.isArray(r.participant_ids) ? r.participant_ids : [];
    const idsForRow = raw.map((id) => String(id ?? "").trim()).filter(Boolean);
    const fallback = [r.left_student_id, r.right_student_id].map((id) => String(id ?? "").trim()).filter(Boolean);
    const participants = idsForRow.length ? idsForRow : fallback;
    participantsByBattle.set(r.id, Array.from(new Set(participants)));
  });
  const allStudentIds = Array.from(
    new Set(rows.flatMap((r) => participantsByBattle.get(r.id) ?? []))
  );
  const skillIds = Array.from(new Set(rows.map((r) => r.skill_id)));
  const { data: studentRows, error: sErr } = await supabase
    .from("students")
    .select("id,name,level,points_total")
    .in("id", allStudentIds);
  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });
  const studentById = new Map<string, { name: string; level: number; points_total: number }>();
  (studentRows ?? []).forEach((s: any) =>
    studentById.set(String(s.id), {
      name: String(s.name ?? "Student"),
      level: Number(s.level ?? 1),
      points_total: Number(s.points_total ?? 0),
    })
  );

  const { data: trackersForStats, error: tsErr } = await supabase
    .from("skill_trackers")
    .select("id,student_id,skill_id")
    .in("student_id", allStudentIds)
    .in("skill_id", skillIds);
  if (tsErr) return NextResponse.json({ ok: false, error: tsErr.message }, { status: 500 });

  const trackerMeta = new Map<string, { student_id: string; skill_id: string }>();
  (trackersForStats ?? []).forEach((t: any) => {
    trackerMeta.set(String(t.id), { student_id: String(t.student_id), skill_id: String(t.skill_id) });
  });

  const statMap = new Map<string, { successes: number; attempts: number }>();
  const statMap30 = new Map<string, { successes: number; attempts: number }>();
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const trackerIds = Array.from(trackerMeta.keys());
  if (trackerIds.length) {
    const { data: tLogs, error: tlErr } = await supabase
      .from("skill_tracker_logs")
      .select("tracker_id,success,created_at")
      .in("tracker_id", trackerIds);
    if (tlErr) return NextResponse.json({ ok: false, error: tlErr.message }, { status: 500 });

    for (const row of tLogs ?? []) {
      const tid = String((row as any)?.tracker_id ?? "");
      const meta = trackerMeta.get(tid);
      if (!meta) continue;
      const key = `${meta.student_id}:${meta.skill_id}`;
      const prev = statMap.get(key) ?? { successes: 0, attempts: 0 };
      const next = {
        successes: prev.successes + ((row as any)?.success ? 1 : 0),
        attempts: prev.attempts + 1,
      };
      statMap.set(key, next);
      const createdAt = String((row as any)?.created_at ?? "");
      const createdMs = createdAt ? Date.parse(createdAt) : 0;
      if (createdMs && createdMs >= cutoff) {
        const prev30 = statMap30.get(key) ?? { successes: 0, attempts: 0 };
        statMap30.set(key, {
          successes: prev30.successes + ((row as any)?.success ? 1 : 0),
          attempts: prev30.attempts + 1,
        });
      }
    }
  }

  if (ids.length) {
    const { data: logs, error: lErr } = await supabase
      .from("battle_tracker_logs")
      .select("battle_id,student_id,success,created_at")
      .in("battle_id", ids);
    if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });

    const ordered = (logs ?? []).slice().sort((a: any, b: any) => String(a.created_at).localeCompare(String(b.created_at)));
    for (const row of ordered) {
      const bid = String((row as any)?.battle_id ?? "");
      if (!bid) continue;
      const prev = logMap.get(bid) ?? new Map<string, Array<{ success: boolean }>>();
      const success = !!(row as any)?.success;
      const createdAt = String((row as any)?.created_at ?? "");
      const createdMs = createdAt ? Date.parse(createdAt) : 0;
      const studentId = String((row as any)?.student_id ?? "");
      if (studentId) {
        const list = prev.get(studentId) ?? [];
        list.push({ success });
        prev.set(studentId, list);
      }
      logMap.set(bid, prev);

      const battle = rows.find((r) => r.id === bid);
      if (battle?.skill_id && studentId) {
        const key = `${studentId}:${battle.skill_id}`;
        const prevStat = statMap.get(key) ?? { successes: 0, attempts: 0 };
        const nextStat = {
          successes: prevStat.successes + (success ? 1 : 0),
          attempts: prevStat.attempts + 1,
        };
        statMap.set(key, nextStat);
        if (createdMs && createdMs >= cutoff) {
          const prevStat30 = statMap30.get(key) ?? { successes: 0, attempts: 0 };
          statMap30.set(key, {
            successes: prevStat30.successes + (success ? 1 : 0),
            attempts: prevStat30.attempts + 1,
          });
        }
      }
    }
  }

  const mvpByBattle = new Map<string, string[]>();
  if (ids.length) {
    const { data: mvpRows, error: mvpErr } = await supabase
      .from("battle_mvp_awards")
      .select("battle_id,student_id")
      .in("battle_id", ids);
    if (mvpErr) return NextResponse.json({ ok: false, error: mvpErr.message }, { status: 500 });
    (mvpRows ?? []).forEach((row: any) => {
      const bid = String(row.battle_id ?? "");
      const sid = String(row.student_id ?? "");
      if (!bid || !sid) return;
      const list = mvpByBattle.get(bid) ?? [];
      list.push(sid);
      mvpByBattle.set(bid, list);
    });
  }

  const { data: settings, error: aErr } = await supabase
    .from("student_avatar_settings")
    .select("student_id,avatar_id,bg_color,particle_style,corner_border_key,card_plate_key")
    .in("student_id", allStudentIds);
  if (aErr) return NextResponse.json({ ok: false, error: aErr.message }, { status: 500 });

  const avatarIds = Array.from(new Set((settings ?? []).map((s: any) => String(s.avatar_id ?? "").trim()).filter(Boolean)));
  const borderKeys = Array.from(
    new Set((settings ?? []).map((s: any) => String(s.corner_border_key ?? "").trim()).filter(Boolean))
  );
  const plateKeys = Array.from(
    new Set((settings ?? []).map((s: any) => String(s.card_plate_key ?? "").trim()).filter(Boolean))
  );
  let avatarMap = new Map<string, { storage_path: string | null }>();
  if (avatarIds.length) {
    const { data: avatars, error: avErr } = await supabase
      .from("avatars")
      .select("id,storage_path")
      .in("id", avatarIds);
    if (avErr) return NextResponse.json({ ok: false, error: avErr.message }, { status: 500 });
    (avatars ?? []).forEach((a: any) => avatarMap.set(String(a.id), { storage_path: a.storage_path ?? null }));
  }

  const borderByKey = new Map<string, {
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
  }>();
  if (borderKeys.length) {
    const { data: borders, error: bErr } = await supabase
      .from("ui_corner_borders")
      .select("key,image_url,render_mode,html,css,js,offset_x,offset_y,offsets_by_context,unlock_level,unlock_points,enabled")
      .in("key", borderKeys);
    if (bErr) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 });
    (borders ?? []).forEach((b: any) => {
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
      });
    });
  }

  const plateByKey = new Map<string, { image_url: string | null; unlock_level: number; unlock_points: number; enabled: boolean }>();
  if (plateKeys.length) {
    const { data: plates, error: pErr } = await supabase
      .from("ui_card_plate_borders")
      .select("key,image_url,unlock_level,unlock_points,enabled")
      .in("key", plateKeys);
    if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });
    (plates ?? []).forEach((p: any) => {
      plateByKey.set(String(p.key), {
        image_url: p.image_url ?? null,
        unlock_level: Number(p.unlock_level ?? 1),
        unlock_points: Number(p.unlock_points ?? 0),
        enabled: p.enabled !== false,
      });
    });
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
    const { data: effects, error: efErr } = await supabase
      .from("avatar_effects")
      .select("key,unlock_level,unlock_points,enabled")
      .in("key", effectKeys);
    if (efErr) return NextResponse.json({ ok: false, error: efErr.message }, { status: 500 });
    (effects ?? []).forEach((e: any) =>
      effectByKey.set(String(e.key), {
        unlock_level: Number(e.unlock_level ?? 1),
        unlock_points: Number(e.unlock_points ?? 0),
        enabled: e.enabled !== false,
      })
    );
  }

  const effectUnlocksByStudent = new Map<string, Set<string>>();
  const borderUnlocksByStudent = new Map<string, Set<string>>();
  const plateUnlocksByStudent = new Map<string, Set<string>>();
  if (allStudentIds.length) {
    const { data: unlockRows, error: uErr } = await supabase
      .from("student_custom_unlocks")
      .select("student_id,item_type,item_key")
      .in("student_id", allStudentIds)
      .in("item_type", ["effect", "corner_border", "card_plate"]);
    if (uErr) return NextResponse.json({ ok: false, error: uErr.message }, { status: 500 });
    (unlockRows ?? []).forEach((row: any) => {
      const sid = String(row.student_id ?? "");
      const key = String(row.item_key ?? "");
      const type = String(row.item_type ?? "");
      if (!sid || !key) return;
      if (type === "corner_border") {
        const set = borderUnlocksByStudent.get(sid) ?? new Set<string>();
        set.add(key);
        borderUnlocksByStudent.set(sid, set);
      } else if (type === "card_plate") {
        const set = plateUnlocksByStudent.get(sid) ?? new Set<string>();
        set.add(key);
        plateUnlocksByStudent.set(sid, set);
      } else {
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
    const effectKey = String(s.particle_style ?? "").trim();
    const effect = effectKey ? effectByKey.get(effectKey) : null;
    const level = studentById.get(id)?.level ?? 1;
    const effectUnlocked = effect && effect.unlock_points > 0
      ? (effectUnlocksByStudent.get(id)?.has(effectKey) ?? false)
      : true;
    const effectOk = effect && effect.enabled && level >= effect.unlock_level && effectUnlocked;
    const borderKey = String(s.corner_border_key ?? "").trim();
    const border = borderKey ? borderByKey.get(borderKey) : null;
    const borderUnlocked = border && border.unlock_points > 0
      ? (borderUnlocksByStudent.get(id)?.has(borderKey) ?? false)
      : true;
    const borderOk = border && border.enabled && level >= border.unlock_level && borderUnlocked;
    const plateKey = String(s.card_plate_key ?? "").trim();
    const plate = plateKey ? plateByKey.get(plateKey) : null;
    const plateUnlocked = plate && plate.unlock_points > 0
      ? (plateUnlocksByStudent.get(id)?.has(plateKey) ?? false)
      : true;
    const plateOk = plate && plate.enabled && level >= plate.unlock_level && plateUnlocked;
    avatarByStudent.set(id, {
      storage_path: avatar.storage_path ?? null,
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

  const battles = rows.map((r) => {
    const participants = participantsByBattle.get(r.id) ?? [];
    const logsForBattle = logMap.get(r.id) ?? new Map<string, Array<{ success: boolean }>>();
    const participantDetails = participants.map((pid) => {
      const list = logsForBattle.get(pid) ?? [];
      const successes = list.filter((x) => x.success).length;
      const attempts = list.length;
      const key = `${pid}:${r.skill_id}`;
      const hist = statMap.get(key) ?? { successes: 0, attempts: 0 };
      const hist30 = statMap30.get(key) ?? { successes: 0, attempts: 0 };
      const histRate = hist.attempts ? Math.round((hist.successes / hist.attempts) * 100) : 0;
      const histRate30 = hist30.attempts ? Math.round((hist30.successes / hist30.attempts) * 100) : 0;
      const student = studentById.get(pid) ?? { name: "Student", level: 0, points_total: 0 };
      const avatar = avatarByStudent.get(pid) ?? {
        storage_path: null,
        bg_color: null,
        particle_style: null,
        corner_border_url: null,
        card_plate_url: null,
      };
      return {
        id: pid,
        name: student.name,
        level: student.level,
        points: student.points_total,
        avatar_path: avatar.storage_path ?? null,
        avatar_bg: avatar.bg_color ?? null,
        avatar_effect: avatar.particle_style ?? null,
        corner_border_url: avatar.corner_border_url ?? null,
        corner_border_render_mode: avatar.corner_border_render_mode ?? null,
        corner_border_html: avatar.corner_border_html ?? null,
        corner_border_css: avatar.corner_border_css ?? null,
        corner_border_js: avatar.corner_border_js ?? null,
        corner_border_offset_x: avatar.corner_border_offset_x ?? 0,
        corner_border_offset_y: avatar.corner_border_offset_y ?? 0,
        corner_border_offsets_by_context: avatar.corner_border_offsets_by_context ?? {},
        card_plate_url: avatar.card_plate_url ?? null,
        attempts,
        successes,
        attempts_list: list.map((x) => x.success),
        history_attempts: hist.attempts,
        history_successes: hist.successes,
        history_rate: histRate,
        history_last30_attempts: hist30.attempts,
        history_last30_successes: hist30.successes,
        history_last30_rate: histRate30,
      };
    });

    const leftId = String(r.left_student_id ?? "");
    const rightId = String(r.right_student_id ?? "");
    const leftList = logsForBattle.get(leftId) ?? [];
    const rightList = logsForBattle.get(rightId) ?? [];
    const left_successes = leftList.filter((x) => x.success).length;
    const right_successes = rightList.filter((x) => x.success).length;
    const leftKey = `${leftId}:${r.skill_id}`;
    const rightKey = `${rightId}:${r.skill_id}`;
    const leftHist = statMap.get(leftKey) ?? { successes: 0, attempts: 0 };
    const rightHist = statMap.get(rightKey) ?? { successes: 0, attempts: 0 };
    const leftHist30 = statMap30.get(leftKey) ?? { successes: 0, attempts: 0 };
    const rightHist30 = statMap30.get(rightKey) ?? { successes: 0, attempts: 0 };
    const leftRate = leftHist.attempts ? Math.round((leftHist.successes / leftHist.attempts) * 100) : 0;
    const rightRate = rightHist.attempts ? Math.round((rightHist.successes / rightHist.attempts) * 100) : 0;
    const leftRate30 = leftHist30.attempts ? Math.round((leftHist30.successes / leftHist30.attempts) * 100) : 0;
    const rightRate30 = rightHist30.attempts ? Math.round((rightHist30.successes / rightHist30.attempts) * 100) : 0;
    const leftStudent = studentById.get(leftId) ?? { name: "Student", level: 0, points_total: 0 };
    const rightStudent = studentById.get(rightId) ?? { name: "Student", level: 0, points_total: 0 };
    const left_avatar = avatarByStudent.get(leftId) ?? { storage_path: null, bg_color: null, particle_style: null, corner_border_url: null, card_plate_url: null };
    const right_avatar = avatarByStudent.get(rightId) ?? { storage_path: null, bg_color: null, particle_style: null, corner_border_url: null, card_plate_url: null };
    let mvpIds = (r.battle_mode ?? "duel") === "teams" ? mvpByBattle.get(r.id) ?? [] : [];
    const teamAIds = Array.isArray(r.team_a_ids) && r.team_a_ids.length ? r.team_a_ids.map(String) : participants.slice(0, Math.max(1, Math.ceil(participants.length / 2)));
    const teamBIds = Array.isArray(r.team_b_ids) && r.team_b_ids.length ? r.team_b_ids.map(String) : participants.filter((id) => !teamAIds.includes(id));

    if ((r.battle_mode ?? "duel") === "teams") {
      const pickTeamMvp = (ids: string[]) => {
        const eligible = participantDetails
          .filter((p) => ids.includes(p.id))
          .map((p) => {
            const attempts = Number(p.attempts ?? 0);
            const successes = Number(p.successes ?? 0);
            const rate = attempts > 0 ? successes / attempts : 0;
            return { id: p.id, successes, rate };
          })
          .filter((row) => row.rate >= 0.6 && row.successes > 0);
        if (!eligible.length) return [];
        const top = Math.max(...eligible.map((row) => row.successes));
        return eligible.filter((row) => row.successes === top).map((row) => row.id);
      };
      mvpIds = [...pickTeamMvp(teamAIds), ...pickTeamMvp(teamBIds)];
    }

    const computePointsDelta = () => {
      if (!r.settled_at) return new Map<string, number>();
      const battleMode = r.battle_mode ?? "duel";
      const target = Math.max(1, Number(r.repetitions_target ?? 1));
      const pointsPerRep = Math.max(3, Number(r.wager_pct ?? 5));
      const wagerAmount = Math.max(0, Number(r.wager_amount ?? 0));
      const attemptsById = new Map(participantDetails.map((p) => [p.id, { attempts: p.attempts, successes: p.successes }]));
      const teamAIds = Array.isArray(r.team_a_ids) && r.team_a_ids.length ? r.team_a_ids.map(String) : participants.slice(0, Math.max(1, Math.ceil(participants.length / 2)));
      const teamBIds = Array.isArray(r.team_b_ids) && r.team_b_ids.length ? r.team_b_ids.map(String) : participants.filter((id) => !teamAIds.includes(id));
      let winnerIds: string[] = [];
      let payoutTotal = 0;
      if (battleMode === "teams") {
        const teamASuccesses = teamAIds.reduce((sum, id) => sum + (attemptsById.get(id)?.successes ?? 0), 0);
        const teamBSuccesses = teamBIds.reduce((sum, id) => sum + (attemptsById.get(id)?.successes ?? 0), 0);
        if (teamASuccesses > teamBSuccesses) winnerIds = teamAIds;
        if (teamBSuccesses > teamASuccesses) winnerIds = teamBIds;
        const lead = Math.abs(teamASuccesses - teamBSuccesses);
        payoutTotal = lead * pointsPerRep;
      } else {
        const ranked = participants
          .map((id) => ({ id, successes: attemptsById.get(id)?.successes ?? 0 }))
          .sort((a, b) => b.successes - a.successes);
        const top = ranked[0]?.successes ?? 0;
        const second = ranked[1]?.successes ?? 0;
        const tiedTop = ranked.filter((row) => row.successes === top);
        if (tiedTop.length === 1) winnerIds = [tiedTop[0].id];
        const lead = Math.max(0, top - second);
        payoutTotal = wagerAmount > 0 ? wagerAmount * participants.length : lead * pointsPerRep;
      }
      const pointsDeltaById = new Map<string, number>();
      participants.forEach((id) => pointsDeltaById.set(id, 0));
      if (!winnerIds.length || payoutTotal <= 0) {
        return pointsDeltaById;
      }

      const baseWinById = new Map<string, number>();
      if (wagerAmount > 0) {
        const share = Math.floor(payoutTotal / Math.max(1, winnerIds.length));
        participants.forEach((id) => {
          pointsDeltaById.set(id, (pointsDeltaById.get(id) ?? 0) - wagerAmount);
        });
        winnerIds.forEach((id) => {
          pointsDeltaById.set(id, (pointsDeltaById.get(id) ?? 0) + share);
          baseWinById.set(id, share);
        });
      } else {
        const losers = participants.filter((id) => !winnerIds.includes(id));
        const balances = losers.map((id) => ({
          id,
          balance: Math.max(0, Number(studentById.get(id)?.points_total ?? 0)),
        }));
        const loserDebits = new Map<string, number>();
        if (losers.length) {
          if (battleMode === "teams") {
            const baseLoss = Math.floor(payoutTotal / Math.max(1, losers.length));
            const remainder = payoutTotal - baseLoss * losers.length;
            let maxLoser: { id: string; balance: number } | null = null;
            balances.forEach((entry) => {
              if (!maxLoser || entry.balance > maxLoser.balance) maxLoser = entry;
            });
            balances.forEach((entry) => {
              let debit = Math.min(entry.balance, baseLoss);
              if (remainder > 0 && maxLoser?.id === entry.id) {
                debit = Math.min(entry.balance, baseLoss + remainder);
              }
              if (debit > 0) loserDebits.set(entry.id, debit);
            });
          } else {
            let remaining = Math.max(0, Math.min(payoutTotal, balances.reduce((sum, b) => sum + b.balance, 0)));
            for (let i = 0; i < balances.length; i += 1) {
              const remainingCount = balances.length - i;
              const entry = balances[i];
              if (remaining <= 0) break;
              const fairShare = Math.floor(remaining / remainingCount);
              const debit = Math.min(entry.balance, Math.max(0, i === balances.length - 1 ? remaining : fairShare));
              if (debit > 0) {
                loserDebits.set(entry.id, debit);
                remaining -= debit;
              }
            }
          }
        }
        const totalDebits = Array.from(loserDebits.values()).reduce((sum, v) => sum + v, 0);
        if (totalDebits > 0) {
          const baseWin = Math.floor(totalDebits / Math.max(1, winnerIds.length));
          const remainderWin = totalDebits - baseWin * winnerIds.length;
          let maxWinner: { id: string; balance: number } | null = null;
          winnerIds.forEach((id) => {
            const balance = Math.max(0, Number(studentById.get(id)?.points_total ?? 0));
            if (!maxWinner || balance > maxWinner.balance) maxWinner = { id, balance };
          });
          loserDebits.forEach((debit, id) => {
            pointsDeltaById.set(id, (pointsDeltaById.get(id) ?? 0) - debit);
          });
          winnerIds.forEach((id) => {
            const extra = remainderWin > 0 && maxWinner?.id === id ? remainderWin : 0;
            const payout = Math.max(0, baseWin + extra);
            if (payout <= 0) return;
            pointsDeltaById.set(id, (pointsDeltaById.get(id) ?? 0) + payout);
            baseWinById.set(id, payout);
          });
        }
      }

      mvpIds.forEach((id) => {
        const baseWin = baseWinById.get(id) ?? 0;
        if (baseWin > 0) {
          pointsDeltaById.set(id, (pointsDeltaById.get(id) ?? 0) + baseWin);
          return;
        }
        if (winnerIds.length && !winnerIds.includes(id)) {
          pointsDeltaById.set(id, (pointsDeltaById.get(id) ?? 0) + 10);
        }
      });
      return pointsDeltaById;
    };

    const pointsDeltaById = computePointsDelta();

    return {
      id: r.id,
      battle_mode: r.battle_mode ?? "duel",
      participant_ids: participants,
      team_a_ids: Array.isArray(r.team_a_ids) ? r.team_a_ids : [],
      team_b_ids: Array.isArray(r.team_b_ids) ? r.team_b_ids : [],
      participants: participantDetails,
      left_student_id: leftId,
      right_student_id: rightId,
      left_name: leftStudent.name ?? "Student",
      right_name: rightStudent.name ?? "Student",
      left_level: leftStudent.level ?? 0,
      right_level: rightStudent.level ?? 0,
      left_points: leftStudent.points_total ?? 0,
      right_points: rightStudent.points_total ?? 0,
      left_avatar_path: left_avatar.storage_path ?? null,
      right_avatar_path: right_avatar.storage_path ?? null,
      left_avatar_bg: left_avatar.bg_color ?? null,
      right_avatar_bg: right_avatar.bg_color ?? null,
      left_avatar_effect: left_avatar.particle_style ?? null,
      right_avatar_effect: right_avatar.particle_style ?? null,
      left_corner_border_url: left_avatar.corner_border_url ?? null,
      left_corner_border_render_mode: left_avatar.corner_border_render_mode ?? null,
      left_corner_border_html: left_avatar.corner_border_html ?? null,
      left_corner_border_css: left_avatar.corner_border_css ?? null,
      left_corner_border_js: left_avatar.corner_border_js ?? null,
      left_corner_border_offset_x: left_avatar.corner_border_offset_x ?? 0,
      left_corner_border_offset_y: left_avatar.corner_border_offset_y ?? 0,
      left_corner_border_offsets_by_context: left_avatar.corner_border_offsets_by_context ?? {},
      right_corner_border_url: right_avatar.corner_border_url ?? null,
      right_corner_border_render_mode: right_avatar.corner_border_render_mode ?? null,
      right_corner_border_html: right_avatar.corner_border_html ?? null,
      right_corner_border_css: right_avatar.corner_border_css ?? null,
      right_corner_border_js: right_avatar.corner_border_js ?? null,
      right_corner_border_offset_x: right_avatar.corner_border_offset_x ?? 0,
      right_corner_border_offset_y: right_avatar.corner_border_offset_y ?? 0,
      right_corner_border_offsets_by_context: right_avatar.corner_border_offsets_by_context ?? {},
      left_card_plate_url: left_avatar.card_plate_url ?? null,
      right_card_plate_url: right_avatar.card_plate_url ?? null,
      skill_id: r.skill_id,
      skill_name: r.tracker_skills?.name ?? "Skill",
      repetitions_target: r.repetitions_target,
      wager_amount: r.wager_amount,
      points_per_rep: r.wager_pct ?? 5,
      left_attempts: leftList.length,
      right_attempts: rightList.length,
      left_successes,
      right_successes,
      left_attempts_list: leftList.map((x) => x.success),
      right_attempts_list: rightList.map((x) => x.success),
      left_history_attempts: leftHist.attempts,
      left_history_successes: leftHist.successes,
      left_history_rate: leftRate,
      left_history_last30_attempts: leftHist30.attempts,
      left_history_last30_successes: leftHist30.successes,
      left_history_last30_rate: leftRate30,
      right_history_attempts: rightHist.attempts,
      right_history_successes: rightHist.successes,
      right_history_rate: rightRate,
      right_history_last30_attempts: rightHist30.attempts,
      right_history_last30_successes: rightHist30.successes,
      right_history_last30_rate: rightRate30,
      settled_at: r.settled_at ?? null,
      winner_id: r.winner_id ?? null,
      mvp_ids: mvpIds,
      points_delta_by_id: Object.fromEntries(pointsDeltaById.entries()),
    };
  });

  return NextResponse.json({ ok: true, battles });
}

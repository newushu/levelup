import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const { data: roles, error: roleErr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id);
  if (roleErr) return NextResponse.json({ ok: false, error: roleErr.message }, { status: 500 });
  const roleList = (roles ?? []).map((r: any) => String(r.role ?? "").toLowerCase());
  const isSkillUser = roleList.includes("skill_user") || roleList.includes("skill_pulse");

  const body = await req.json().catch(() => ({}));
  const battle_id = String(body?.battle_id ?? "").trim();
  if (!battle_id) return NextResponse.json({ ok: false, error: "Missing battle_id" }, { status: 400 });

  const { data: battle, error: bErr } = await supabase
    .from("battle_trackers")
    .select("id,left_student_id,right_student_id,repetitions_target,wager_amount,wager_pct,battle_mode,participant_ids,team_a_ids,team_b_ids,battle_meta,settled_at")
    .eq("id", battle_id)
    .single();
  if (bErr) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 });
  if (battle?.settled_at) return NextResponse.json({ ok: true, settled: true, already_settled: true });

  const participants = (() => {
    const list = Array.isArray(battle?.participant_ids) ? battle.participant_ids : [];
    const ids = list.map((id: any) => String(id ?? "").trim()).filter(Boolean);
    if (ids.length) return Array.from(new Set(ids));
    const fallback = [battle.left_student_id, battle.right_student_id].map((id: any) => String(id ?? "").trim()).filter(Boolean);
    return Array.from(new Set(fallback));
  })();
  const teamA = (Array.isArray(battle?.team_a_ids) ? battle.team_a_ids : [])
    .map((id: any) => String(id ?? "").trim())
    .filter(Boolean);
  const teamB = (Array.isArray(battle?.team_b_ids) ? battle.team_b_ids : [])
    .map((id: any) => String(id ?? "").trim())
    .filter(Boolean);
  const teamMetaRaw = Array.isArray((battle as any)?.battle_meta?.team_ids) ? (battle as any).battle_meta.team_ids : [];
  const teamMeta = teamMetaRaw
    .map((team: any) =>
      Array.isArray(team) ? team.map((id: any) => String(id ?? "").trim()).filter(Boolean) : []
    )
    .filter((team: string[]) => team.length);

  const { data: logs2, error: l2Err } = await supabase
    .from("battle_tracker_logs")
    .select("student_id,success")
    .eq("battle_id", battle_id);
  if (l2Err) return NextResponse.json({ ok: false, error: l2Err.message }, { status: 500 });

  const target = Number(battle.repetitions_target ?? 1);
  const attemptsByStudent = new Map<string, { attempts: number; successes: number }>();
  for (const pid of participants) attemptsByStudent.set(pid, { attempts: 0, successes: 0 });
  for (const row of logs2 ?? []) {
    const sid = String((row as any)?.student_id ?? "");
    if (!attemptsByStudent.has(sid)) continue;
    const prev = attemptsByStudent.get(sid) ?? { attempts: 0, successes: 0 };
    attemptsByStudent.set(sid, {
      attempts: prev.attempts + 1,
      successes: prev.successes + ((row as any)?.success ? 1 : 0),
    });
  }

  const allDone = participants.every((pid) => (attemptsByStudent.get(pid)?.attempts ?? 0) >= target);
  if (!allDone) return NextResponse.json({ ok: false, error: "Not all participants have completed reps." }, { status: 400 });

  let winnerIds: string[] = [];
  let payoutTotal = 0;
  let mvpIds: string[] = [];
  const wagerAmount = Number(battle.wager_amount ?? 0);
  const pointsPerRep = Math.max(3, Number(battle.wager_pct ?? 5));

  if (battle?.battle_mode === "teams" || battle?.battle_mode === "lanes") {
    const fallbackA = teamA.length ? teamA : participants.slice(0, Math.max(1, Math.ceil(participants.length / 2)));
    const fallbackB = teamB.length ? teamB : participants.filter((id) => !fallbackA.includes(id));
    const teamGroups =
      battle?.battle_mode === "teams"
        ? (teamMeta.length ? teamMeta : [fallbackA, fallbackB].filter((t) => t.length))
        : [fallbackA, fallbackB];
    const teamScores = teamGroups.map((ids) => ({
      ids,
      successes: ids.reduce((sum, id) => sum + (attemptsByStudent.get(id)?.successes ?? 0), 0),
    }));
    const topScore = Math.max(0, ...teamScores.map((t) => t.successes));
    const topTeams = teamScores.filter((t) => t.successes === topScore);
    if (topTeams.length === 1) winnerIds = topTeams[0].ids;
    const sortedScores = teamScores.map((t) => t.successes).sort((a, b) => b - a);
    const lead = sortedScores.length >= 2 ? Math.max(0, sortedScores[0] - sortedScores[1]) : 0;
    const losers = participants.filter((id) => !winnerIds.includes(id));
    const perPerson = lead * pointsPerRep;
    payoutTotal = wagerAmount > 0 ? wagerAmount * participants.length : perPerson * losers.length;
    const pickTeamMvp = (ids: string[]) => {
      const eligible = ids
        .map((id) => {
          const attempts = attemptsByStudent.get(id)?.attempts ?? 0;
          const successes = attemptsByStudent.get(id)?.successes ?? 0;
          const rate = attempts > 0 ? successes / attempts : 0;
          return { id, successes, rate };
        })
        .filter((row) => row.rate >= 0.6 && row.successes > 0);
      if (!eligible.length) return [];
      const top = Math.max(...eligible.map((row) => row.successes));
      return eligible.filter((row) => row.successes === top).map((row) => row.id);
    };
    mvpIds = teamGroups.flatMap((team) => pickTeamMvp(team));
  } else {
    const ranked = participants
      .map((id) => ({ id, successes: attemptsByStudent.get(id)?.successes ?? 0 }))
      .sort((a, b) => b.successes - a.successes);
    const top = ranked[0]?.successes ?? 0;
    const second = ranked[1]?.successes ?? 0;
    const tiedTop = ranked.filter((r) => r.successes === top);
    if (tiedTop.length === 1) winnerIds = [tiedTop[0].id];
    const lead = Math.max(0, top - second);
    payoutTotal = wagerAmount > 0 ? wagerAmount * participants.length : lead * pointsPerRep;
  }

  if (battle?.battle_mode !== "teams" && battle?.battle_mode !== "lanes") {
    mvpIds = [];
  }

  if (mvpIds.length) {
    const insMvp = await supabase.from("battle_mvp_awards").upsert(
      mvpIds.map((student_id) => ({
        battle_id,
        student_id,
      })),
      { onConflict: "battle_id,student_id" }
    );
    if (insMvp.error) return NextResponse.json({ ok: false, error: insMvp.error.message }, { status: 500 });
  }

  const mvpBonusPctByStudent = new Map<string, number>();
  if (mvpIds.length) {
    const { data: avatarSettings, error: asErr } = await supabase
      .from("student_avatar_settings")
      .select("student_id,avatar_id")
      .in("student_id", mvpIds);
    if (asErr) return NextResponse.json({ ok: false, error: asErr.message }, { status: 500 });
    const avatarIds = Array.from(
      new Set((avatarSettings ?? []).map((row: any) => String(row.avatar_id ?? "").trim()).filter(Boolean))
    );
    const pctByAvatarId = new Map<string, number>();
    if (avatarIds.length) {
      const { data: avatarRows, error: avErr } = await supabase
        .from("avatars")
        .select("id,mvp_bonus_pct")
        .in("id", avatarIds);
      if (avErr) return NextResponse.json({ ok: false, error: avErr.message }, { status: 500 });
      (avatarRows ?? []).forEach((row: any) => {
        pctByAvatarId.set(String(row.id ?? ""), Math.max(0, Number(row.mvp_bonus_pct ?? 0)));
      });
    }
    (avatarSettings ?? []).forEach((row: any) => {
      const sid = String(row.student_id ?? "");
      const aid = String(row.avatar_id ?? "");
      if (!sid || !aid) return;
      mvpBonusPctByStudent.set(sid, pctByAvatarId.get(aid) ?? 0);
    });
  }

  let limitReached = false;
  if (isSkillUser) {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: trackerRows, error: trErr } = await supabase
      .from("skill_trackers")
      .select("id,student_id")
      .in("student_id", participants);
    if (trErr) return NextResponse.json({ ok: false, error: trErr.message }, { status: 500 });
    const trackerMeta = new Map<string, string>();
    const trackerIds: string[] = [];
    (trackerRows ?? []).forEach((row: any) => {
      const tid = String(row.id ?? "");
      const sid = String(row.student_id ?? "");
      if (!tid || !sid) return;
      trackerMeta.set(tid, sid);
      trackerIds.push(tid);
    });

    const repsByStudent = new Map<string, number>();
    participants.forEach((pid) => repsByStudent.set(pid, 0));

    if (trackerIds.length) {
      const { data: skillLogs, error: slErr } = await supabase
        .from("skill_tracker_logs")
        .select("tracker_id")
        .in("tracker_id", trackerIds)
        .eq("created_by", u.user.id)
        .gte("created_at", cutoff);
      if (slErr) return NextResponse.json({ ok: false, error: slErr.message }, { status: 500 });
      (skillLogs ?? []).forEach((row: any) => {
        const tid = String(row.tracker_id ?? "");
        const sid = trackerMeta.get(tid);
        if (!sid) return;
        repsByStudent.set(sid, (repsByStudent.get(sid) ?? 0) + 1);
      });
    }

    const { data: battleLogs, error: blErr } = await supabase
      .from("battle_tracker_logs")
      .select("student_id")
      .in("student_id", participants)
      .eq("created_by", u.user.id)
      .gte("created_at", cutoff);
    if (blErr) return NextResponse.json({ ok: false, error: blErr.message }, { status: 500 });
    (battleLogs ?? []).forEach((row: any) => {
      const sid = String(row.student_id ?? "");
      if (!sid) return;
      repsByStudent.set(sid, (repsByStudent.get(sid) ?? 0) + 1);
    });

    limitReached = participants.some((pid) => (repsByStudent.get(pid) ?? 0) > 20);
  }

  const { data: balances, error: balErr } = await supabase
    .from("students")
    .select("id,points_total")
    .in("id", participants);
  if (balErr) return NextResponse.json({ ok: false, error: balErr.message }, { status: 500 });
  const balanceById = new Map<string, number>();
  (balances ?? []).forEach((row: any) =>
    balanceById.set(String(row.id ?? ""), Math.max(0, Number(row.points_total ?? 0)))
  );

  const ledgerRows: Array<{ student_id: string; points: number; note: string; category: string; created_by: string }> = [];
  const mvpLedgerRows: Array<{ student_id: string; points: number; note: string; category: string; created_by: string }> = [];
  const baseWinById = new Map<string, number>();
  const netWinById = new Map<string, number>();
  const lossById = new Map<string, number>();

  if (!limitReached && winnerIds.length && payoutTotal > 0) {
    if (wagerAmount > 0) {
      if (winnerIds.length) {
        const share = Math.floor(payoutTotal / Math.max(1, winnerIds.length));
        const netShare = Math.max(0, share - wagerAmount);
        const losers = participants.filter((pid) => !winnerIds.includes(pid));
        losers.forEach((pid) => {
          ledgerRows.push({
            student_id: pid,
            points: -wagerAmount,
            note: `Battle Pulse loss (-${wagerAmount})`,
            category: "manual",
            created_by: u.user.id,
          });
          lossById.set(pid, wagerAmount);
        });
        winnerIds.forEach((pid) => {
          if (netShare > 0) {
            ledgerRows.push({
              student_id: pid,
              points: netShare,
              note: `Battle Pulse win (+${netShare})`,
              category: "manual",
              created_by: u.user.id,
            });
          }
          baseWinById.set(pid, netShare);
          netWinById.set(pid, netShare);
        });
      }
    } else {
      const losers = participants.filter((pid) => !winnerIds.includes(pid));
      if (losers.length) {
        const loserDebits = new Map<string, number>();
        if (battle?.battle_mode === "teams" || battle?.battle_mode === "lanes") {
          const baseLoss = Math.floor(payoutTotal / Math.max(1, losers.length));
          const remainder = payoutTotal - baseLoss * losers.length;
          let maxLoser: { id: string; balance: number } | null = null;
          losers.forEach((pid) => {
            const balance = balanceById.get(pid) ?? 0;
            if (!maxLoser || balance > maxLoser.balance) maxLoser = { id: pid, balance };
          });
          losers.forEach((pid) => {
            const balance = balanceById.get(pid) ?? 0;
            let debit = Math.min(balance, baseLoss);
            if (remainder > 0 && maxLoser?.id === pid) {
              debit = Math.min(balance, baseLoss + remainder);
            }
            if (debit > 0) loserDebits.set(pid, debit);
          });
        } else {
          const maxAffordable = losers.reduce((sum, pid) => sum + (balanceById.get(pid) ?? 0), 0);
          let remaining = Math.max(0, Math.min(payoutTotal, maxAffordable));
          const loserQueue = losers.map((pid) => ({ id: pid, balance: balanceById.get(pid) ?? 0 }));
          for (let i = 0; i < loserQueue.length; i += 1) {
            const remainingCount = loserQueue.length - i;
            const entry = loserQueue[i];
            if (remaining <= 0) break;
            const fairShare = Math.floor(remaining / remainingCount);
            const debit = Math.min(entry.balance, Math.max(0, i === loserQueue.length - 1 ? remaining : fairShare));
            if (debit > 0) {
              loserDebits.set(entry.id, debit);
              remaining -= debit;
            }
          }
        }

        const totalDebits = Array.from(loserDebits.values()).reduce((sum, v) => sum + v, 0);
        if (totalDebits > 0 && winnerIds.length) {
          const baseWin = Math.floor(totalDebits / Math.max(1, winnerIds.length));
          const remainderWin = totalDebits - baseWin * winnerIds.length;
          let maxWinner: { id: string; balance: number } | null = null;
          winnerIds.forEach((pid) => {
            const balance = balanceById.get(pid) ?? 0;
            if (!maxWinner || balance > maxWinner.balance) maxWinner = { id: pid, balance };
          });

          loserDebits.forEach((debit, pid) => {
            ledgerRows.push({
              student_id: pid,
              points: -debit,
              note: `Battle Pulse loss (-${debit})`,
              category: "manual",
              created_by: u.user.id,
            });
            lossById.set(pid, debit);
          });
          winnerIds.forEach((pid) => {
            const extra = remainderWin > 0 && maxWinner?.id === pid ? remainderWin : 0;
            const payout = Math.max(0, baseWin + extra);
            if (payout <= 0) return;
            ledgerRows.push({
              student_id: pid,
              points: payout,
              note: `Battle Pulse win (+${payout})`,
              category: "manual",
              created_by: u.user.id,
            });
            baseWinById.set(pid, payout);
            netWinById.set(pid, payout);
          });
        }
      }
    }

    if (ledgerRows.length) {
      const insLedger = await supabase.from("ledger").insert(ledgerRows);
      if (insLedger.error) return NextResponse.json({ ok: false, error: insLedger.error.message }, { status: 500 });
    }
  }

  if (!limitReached && mvpIds.length) {
    const buildMvpAward = (studentId: string, basePoints: number, baseNote: string, category: string) => {
      const base = Math.max(0, Math.round(Number(basePoints ?? 0)));
      if (base <= 0) return;
      const pct = Math.max(0, Number(mvpBonusPctByStudent.get(studentId) ?? 0));
      const bonus = Math.max(0, Math.round(base * (pct / 100)));
      const total = base + bonus;
      const note = bonus > 0 ? `${baseNote} (+${bonus} MVP modifier)` : baseNote;
      mvpLedgerRows.push({
        student_id: studentId,
        points: total,
        note,
        category,
        created_by: u.user.id,
      });
    };
    mvpIds.forEach((pid) => {
      const baseWin = baseWinById.get(pid) ?? 0;
      const netWin = netWinById.get(pid) ?? baseWin;
      const isWinner = winnerIds.includes(pid);
      if (battle?.battle_mode === "teams") {
        if (!winnerIds.length) return;
        if (isWinner) {
          const bonus = Math.max(0, netWin);
          buildMvpAward(pid, bonus, `Battle Pulse MVP bonus (+${bonus})`, "manual");
          return;
        }
        const refund = lossById.get(pid) ?? 0;
        const refundCap = Math.max(0, Math.min(refund, 50));
        if (refundCap > 0) {
          mvpLedgerRows.push({
            student_id: pid,
            points: refundCap,
            note: `Battle Pulse MVP protection (+${refundCap})`,
            category: "manual",
            created_by: u.user.id,
          });
        }
        return;
      }
      if (battle?.battle_mode === "lanes") {
        if (!winnerIds.length) {
          buildMvpAward(pid, 10, "Skill Lanes MVP tie (+10)", "system");
          return;
        }
        if (isWinner && netWin > 0) {
          buildMvpAward(pid, netWin, `Skill Lanes MVP bonus (+${netWin})`, "system");
        } else if (!isWinner) {
          const refund = lossById.get(pid) ?? 0;
          buildMvpAward(pid, refund, `Skill Lanes MVP refund (+${refund}) (non-lifetime)`, "system");
        }
        return;
      }
      if (!winnerIds.length) {
        buildMvpAward(pid, 10, "Battle Pulse MVP tie (+10)", "manual");
        return;
      }
      if (baseWin > 0) {
        buildMvpAward(pid, baseWin, `Battle Pulse MVP bonus (+${baseWin})`, "manual");
        return;
      }
      if (winnerIds.length && !winnerIds.includes(pid)) {
        buildMvpAward(pid, 10, "Battle Pulse MVP consolation (+10)", "manual");
      }
    });

    if (mvpLedgerRows.length) {
      const insLedger = await supabase.from("ledger").insert(mvpLedgerRows);
      if (insLedger.error) return NextResponse.json({ ok: false, error: insLedger.error.message }, { status: 500 });
    }
  }

  if (!limitReached && (ledgerRows.length || mvpLedgerRows.length)) {
    for (const pid of participants) {
      const rpc = await supabase.rpc("recompute_student_points", { p_student_id: pid });
      if (rpc.error) return NextResponse.json({ ok: false, error: rpc.error.message }, { status: 500 });
    }
  }

  const settledAtIso = new Date().toISOString();
  const currentMeta =
    battle?.battle_meta && typeof battle.battle_meta === "object" && !Array.isArray(battle.battle_meta)
      ? (battle.battle_meta as Record<string, any>)
      : {};
  let nextMeta: Record<string, any> = { ...currentMeta };
  if (!limitReached && (ledgerRows.length || mvpLedgerRows.length)) {
    const totalDeltaById = new Map<string, number>();
    participants.forEach((pid) => totalDeltaById.set(pid, 0));
    [...ledgerRows, ...mvpLedgerRows].forEach((row) => {
      const sid = String(row.student_id ?? "").trim();
      if (!sid) return;
      totalDeltaById.set(sid, (totalDeltaById.get(sid) ?? 0) + Number(row.points ?? 0));
    });
    const { data: latestRows, error: latestErr } = await supabase
      .from("students")
      .select("id,points_total")
      .in("id", participants);
    if (latestErr) return NextResponse.json({ ok: false, error: latestErr.message }, { status: 500 });
    const afterById: Record<string, number> = {};
    const beforeById: Record<string, number> = {};
    (latestRows ?? []).forEach((row: any) => {
      const sid = String(row.id ?? "").trim();
      if (!sid) return;
      const after = Math.round(Number(row.points_total ?? 0));
      const delta = Math.round(Number(totalDeltaById.get(sid) ?? 0));
      afterById[sid] = after;
      beforeById[sid] = after - delta;
    });
    nextMeta = {
      ...nextMeta,
      settlement_points_after_by_id: afterById,
      settlement_points_before_by_id: beforeById,
      settlement_snapshot_at: settledAtIso,
    };
  }

  const winner_id = winnerIds.length === 1 ? winnerIds[0] : null;
  const upd = await supabase
    .from("battle_trackers")
    .update({ settled_at: settledAtIso, winner_id, battle_meta: nextMeta })
    .eq("id", battle_id);
  if (upd.error) return NextResponse.json({ ok: false, error: upd.error.message }, { status: 500 });

  return NextResponse.json({ ok: true, settled: true });
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { skillSprintPoolDropped, skillSprintPrizeDropPerDay, skillSprintPrizeNow } from "@/lib/skillSprintMath";

type StudentRow = { id: string; name: string; points_total?: number | null; points_balance?: number | null };
type SkillRow = { id: string; name: string; set_name?: string | null; category?: string | null };
type TrackerSkillRow = { id: string; name: string; category?: string | null };
type ElementRow = { id: string; element_type: string; label: string; is_skill_name?: boolean | null; enabled?: boolean | null };

type AssignmentRow = {
  id: string;
  student_id: string;
  source_type: "skill_tree" | "skill_pulse" | "manual";
  source_key: string | null;
  source_label: string;
  due_at: string;
  penalty_points_per_day: number;
  reward_points: number;
  charged_days: number;
  note?: string | null;
  assigned_at: string;
  completed_at?: string | null;
  students?: { name?: string | null } | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function roundToHourRemaining(dueAtIso: string, nowMs = Date.now()) {
  const dueMs = Date.parse(String(dueAtIso ?? ""));
  if (!Number.isFinite(dueMs)) return "-";
  const diff = dueMs - nowMs;
  const abs = Math.abs(diff);
  const totalHours = Math.floor(abs / (60 * 60 * 1000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (diff >= 0) return `${days}d ${hours}h left`;
  return `${days}d ${hours}h overdue`;
}

function pointsLostSoFar(chargedDays: number, penaltyPerDay: number) {
  return Math.max(0, Math.round(Number(chargedDays ?? 0) * Number(penaltyPerDay ?? 0)));
}

export default function SkillSprintAdminPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [assignToEveryone, setAssignToEveryone] = useState(false);
  const [skillTreeRows, setSkillTreeRows] = useState<SkillRow[]>([]);
  const [skillPulseRows, setSkillPulseRows] = useState<TrackerSkillRow[]>([]);
  const [manualRows, setManualRows] = useState<ElementRow[]>([]);
  const [sourceType, setSourceType] = useState<"skill_tree" | "skill_pulse" | "manual">("skill_tree");
  const [sourceKey, setSourceKey] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [requirementDescription, setRequirementDescription] = useState("");
  const [globalEndAt, setGlobalEndAt] = useState("");
  const [penaltyPerDayInput, setPenaltyPerDayInput] = useState("5");
  const [rewardPointsInput, setRewardPointsInput] = useState("100");
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const selectedStudent = useMemo(
    () => students.find((s) => String(s.id) === String(selectedStudentId)) ?? null,
    [students, selectedStudentId]
  );

  const sourceOptions = useMemo(() => {
    if (sourceType === "skill_tree") {
      return skillTreeRows.map((row) => ({ key: row.id, label: `${row.name}${row.set_name ? ` (${row.set_name})` : ""}` }));
    }
    if (sourceType === "skill_pulse") {
      return skillPulseRows.map((row) => ({ key: row.id, label: row.name }));
    }
    return manualRows.filter((row) => row.enabled !== false).map((row) => ({ key: row.id, label: row.label }));
  }, [sourceType, skillTreeRows, skillPulseRows, manualRows]);

  const suggestedLossCap = useMemo(() => {
    const base = Math.max(
      0,
      Number(selectedStudent?.points_balance ?? selectedStudent?.points_total ?? 0)
    );
    const suggestion = Math.max(0, Math.floor(base * 0.08));
    return Number.isFinite(suggestion) ? suggestion : 0;
  }, [selectedStudent?.points_balance, selectedStudent?.points_total]);

  const suggestedPrize = useMemo(() => {
    const value = Math.max(20, Math.round(suggestedLossCap * 25));
    return value;
  }, [suggestedLossCap]);

  const dueDateLabel = useMemo(() => {
    const dueMs = Date.parse(String(globalEndAt ?? ""));
    if (!Number.isFinite(dueMs)) return "Set end date";
    return new Date(dueMs).toLocaleString();
  }, [globalEndAt]);
  const penaltyPerDay = useMemo(() => Math.max(0, Math.floor(Number(penaltyPerDayInput || 0))), [penaltyPerDayInput]);
  const rewardPoints = useMemo(() => Math.max(0, Math.floor(Number(rewardPointsInput || 0))), [rewardPointsInput]);
  const previewPrizeDropPerDay = useMemo(() => {
    const dueMs = Date.parse(String(globalEndAt ?? ""));
    if (!Number.isFinite(dueMs)) return 0;
    return Math.round(skillSprintPrizeDropPerDay(rewardPoints, new Date().toISOString(), new Date(dueMs).toISOString()));
  }, [rewardPoints, globalEndAt]);
  const suggestedLoss = suggestedLossCap;
  const selectedStudentCap = useMemo(
    () => Math.max(0, Math.floor(Math.max(0, Number(selectedStudent?.points_total ?? 0)) * 0.4)),
    [selectedStudent?.points_total]
  );

  useEffect(() => {
    const end = new Date(Date.now() + 10 * DAY_MS);
    end.setMinutes(end.getMinutes() - end.getTimezoneOffset());
    setGlobalEndAt(end.toISOString().slice(0, 16));

    (async () => {
      const [studentsRes, skillsRes, trackerRes, elementsRes] = await Promise.all([
        fetch("/api/students/list", { cache: "no-store" }),
        fetch("/api/skills/list", { cache: "no-store" }),
        fetch("/api/tracker-skills/list", { cache: "no-store" }),
        fetch("/api/tracker-skill-elements/list", { cache: "no-store" }),
      ]);
      const [studentsJson, skillsJson, trackerJson, elementsJson] = await Promise.all([
        studentsRes.json().catch(() => ({})),
        skillsRes.json().catch(() => ({})),
        trackerRes.json().catch(() => ({})),
        elementsRes.json().catch(() => ({})),
      ]);

      if (studentsRes.ok) {
        const rows = ((studentsJson?.students ?? []) as StudentRow[]).sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));
        setStudents(rows);
        if (rows.length) setSelectedStudentId(String(rows[0].id ?? ""));
      }
      if (skillsRes.ok) setSkillTreeRows((skillsJson?.skills ?? []) as SkillRow[]);
      if (trackerRes.ok) setSkillPulseRows((trackerJson?.skills ?? []) as TrackerSkillRow[]);
      if (elementsRes.ok) {
        setManualRows(
          ((elementsJson?.elements ?? []) as ElementRow[]).filter(
            (row) => String(row.element_type ?? "") === "name" && (row.is_skill_name ?? true)
          )
        );
      }
    })();
  }, []);

  useEffect(() => {
    setSourceKey("");
    setSourceLabel("");
  }, [sourceType]);

  useEffect(() => {
    if (!selectedStudentId && !assignToEveryone) return;
    void loadAssignments();
  }, [selectedStudentId, assignToEveryone]);

  async function loadAssignments() {
    const res = assignToEveryone
      ? await fetch("/api/skill-sprint/list", { cache: "no-store" })
      : await fetch(`/api/skill-sprint/list?student_id=${encodeURIComponent(selectedStudentId)}`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(String(json?.error ?? "Failed to load Skill Sprint assignments"));
      return;
    }
    const rows = (json?.rows ?? []) as AssignmentRow[];
    setAssignments(rows);
  }

  async function assignSprint() {
    const label = sourceLabel.trim();
    if (!label) return setMsg("Select or enter a skill.");
    if (!globalEndAt) return setMsg("Set an end date.");

    const dueIso = new Date(globalEndAt).toISOString();
    setBusy(true);
    setMsg("");

    const targets = assignToEveryone
      ? students.map((s) => s.id)
      : selectedStudentId
        ? [selectedStudentId]
        : [];

    if (!targets.length) {
      setBusy(false);
      return setMsg("Select a student or assign to everyone.");
    }

    for (const sid of targets) {
      const studentPoints = Math.max(0, Number(students.find((s) => String(s.id) === String(sid))?.points_total ?? 0));
      const rewardCap = Math.max(0, Math.floor(studentPoints * 0.4));
      const cappedReward = Math.min(Math.max(0, Math.round(rewardPoints)), rewardCap);
      const res = await fetch("/api/skill-sprint/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: sid,
          source_type: sourceType,
          source_key: sourceKey || null,
          source_label: label,
          due_at: dueIso,
          penalty_points_per_day: penaltyPerDay,
          reward_points: cappedReward,
          note: requirementDescription.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBusy(false);
        return setMsg(String(json?.error ?? "Failed assigning Skill Sprint"));
      }
    }

    setBusy(false);
    setMsg(assignToEveryone ? "Skill Sprint assigned to everyone." : "Skill Sprint assigned.");
    await loadAssignments();
  }

  async function completeAssignment(id: string) {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/skill-sprint/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignment_id: id }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(String(json?.error ?? "Failed to mark complete"));
    setMsg(`Skill Sprint completed. Awarded +${Math.round(Number(json?.reward_points ?? 0))} pts.`);
    await loadAssignments();
  }

  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: 16, display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 1000 }}>Skill Sprint</div>
          <div style={{ opacity: 0.76 }}>Set skill deadlines with daily point loss and a decaying completion prize.</div>
        </div>
        <Link href="/admin/custom" style={ghostBtn()}>Return to Custom</Link>
      </div>

      {msg ? <div style={notice()}>{msg}</div> : null}

      <section style={panel()}>
        <div style={{ fontSize: 18, fontWeight: 1000 }}>Assign Skill Sprint</div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
          <label style={labelStyle()}>
            Student
            <select value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)} disabled={assignToEveryone}>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>

          <label style={labelStyle()}>
            Source Type
            <select value={sourceType} onChange={(e) => setSourceType(e.target.value as any)}>
              <option value="skill_tree">Skill Tree Skill</option>
              <option value="skill_pulse">Skill Pulse Skill</option>
              <option value="manual">Manual Skill Entry</option>
            </select>
          </label>

          <label style={labelStyle()}>
            Global End Date
            <input type="datetime-local" value={globalEndAt} onChange={(e) => setGlobalEndAt(e.target.value)} />
          </label>

          <label style={{ ...labelStyle(), justifyContent: "end" }}>
            Assign Scope
            <button type="button" style={chipBtn(assignToEveryone)} onClick={() => setAssignToEveryone((v) => !v)}>
              {assignToEveryone ? "Everyone" : "Single Student"}
            </button>
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
          <label style={labelStyle()}>
            Skill
            <select
              value={sourceKey}
              onChange={(e) => {
                const key = e.target.value;
                setSourceKey(key);
                const found = sourceOptions.find((o) => o.key === key);
                if (found) setSourceLabel(found.label);
              }}
            >
              <option value="">Select a skill...</option>
              {sourceOptions.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </label>

          <label style={labelStyle()}>
            Skill Label
            <input value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} placeholder="Skill name" />
          </label>

          <div style={{ display: "grid", gap: 8 }}>
            <label style={labelStyle()}>
              Daily Loss (points)
              <input
                type="text"
                inputMode="numeric"
                value={penaltyPerDayInput}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^\d]/g, "");
                  setPenaltyPerDayInput(raw);
                }}
                onBlur={() => setPenaltyPerDayInput(String(Math.max(0, Math.floor(Number(penaltyPerDayInput || 0)))))}
              />
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" style={chipBtn(false)} onClick={() => setPenaltyPerDayInput(String(suggestedLoss))}>
                Suggest max 8% ({suggestedLoss})
              </button>
              <span style={chipInfo("#fef3c7", "rgba(120,53,15,0.35)", "rgba(251,191,36,0.5)")}>
                Pool drop/day preview: {previewPrizeDropPerDay}
              </span>
            </div>
          </div>
        </div>

        <label style={labelStyle()}>
          Requirement Description
          <textarea
            value={requirementDescription}
            onChange={(e) => setRequirementDescription(e.target.value)}
            placeholder="Describe what counts as completed for this skill sprint."
            style={{
              minHeight: 72,
              resize: "vertical",
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(148,163,184,0.45)",
              background: "rgba(2,6,23,0.55)",
              color: "white",
              fontWeight: 800,
            }}
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, alignItems: "start" }}>
          <div style={{ display: "grid", gap: 8 }}>
            <label style={labelStyle()}>
              Prize (initial points)
              <input
                type="text"
                inputMode="numeric"
                value={rewardPointsInput}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^\d]/g, "");
                  if (assignToEveryone) {
                    setRewardPointsInput(raw);
                    return;
                  }
                  const cap = selectedStudentCap;
                  const parsed = Math.max(0, Math.floor(Number(raw || 0)));
                  setRewardPointsInput(raw === "" ? "" : String(Math.min(parsed, cap)));
                }}
                onBlur={() => {
                  const parsed = Math.max(0, Math.floor(Number(rewardPointsInput || 0)));
                  const next = assignToEveryone ? parsed : Math.min(parsed, selectedStudentCap);
                  setRewardPointsInput(String(next));
                }}
              />
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                style={chipBtn(false)}
                onClick={() => setRewardPointsInput(String(assignToEveryone ? suggestedPrize : Math.min(suggestedPrize, selectedStudentCap)))}
              >
                Suggest Prize ({suggestedPrize})
              </button>
              <span style={chipInfo("#dbeafe", "rgba(30,64,175,0.3)", "rgba(96,165,250,0.5)")}>
                Cap (40% total points): {assignToEveryone ? "applied per student" : selectedStudentCap}
              </span>
            </div>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.82 }}>Break-even estimate</div>
            <div style={statCard()}>
              {dueDateLabel === "Set end date" ? dueDateLabel : `Due date (fixed): ${dueDateLabel}`}
            </div>
          </div>

          <div style={{ display: "grid", alignItems: "end", justifyItems: "start" }}>
            <button type="button" style={primaryBtn()} onClick={assignSprint} disabled={busy}>
              {busy ? "Assigning..." : assignToEveryone ? "Assign Skill Sprint to Everyone" : "Assign Skill Sprint"}
            </button>
          </div>
        </div>
      </section>

      <section style={panel()}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 1000 }}>Skill Sprint Rows</div>
          <button type="button" style={ghostBtn()} onClick={() => loadAssignments()}>Refresh In-Page</button>
        </div>
        {!assignments.length ? <div style={{ opacity: 0.75 }}>No Skill Sprint rows yet.</div> : null}

        <div style={{ display: "grid", gap: 8 }}>
          {assignments.map((row) => {
            const left = roundToHourRemaining(row.due_at);
            const lost = pointsLostSoFar(row.charged_days, row.penalty_points_per_day);
            const prizeNow = Math.round(skillSprintPrizeNow(row.reward_points, row.assigned_at, row.due_at));
            const prizeDropPerDay = Math.round(skillSprintPrizeDropPerDay(row.reward_points, row.assigned_at, row.due_at));
            const poolDropped = Math.round(skillSprintPoolDropped(row.reward_points, row.assigned_at, row.due_at));
            const isDone = Boolean(row.completed_at);
            return (
              <div key={row.id} style={rowCard(isDone)}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ fontWeight: 1000, fontSize: 15 }}>
                    {row.students?.name ? `${row.students.name} • ` : ""}
                    {row.source_label}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span style={chipInfo("#bfdbfe", "rgba(3,105,161,0.26)", "rgba(56,189,248,0.45)")}>{left}</span>
                    <span style={chipInfo("#fecaca", "rgba(153,27,27,0.4)", "rgba(248,113,113,0.65)")}>Lost: {lost}</span>
                    <span style={chipInfo("#dcfce7", "rgba(22,101,52,0.3)", "rgba(74,222,128,0.55)")}>Prize now: {prizeNow}</span>
                    <span style={chipInfo("#fde68a", "rgba(120,53,15,0.35)", "rgba(251,191,36,0.55)")}>Pool drop/day: {prizeDropPerDay}</span>
                    <span style={chipInfo("#fca5a5", "rgba(127,29,29,0.35)", "rgba(248,113,113,0.5)")}>Pool dropped: {poolDropped}</span>
                  </div>
                </div>
                {row.note ? (
                  <div style={{ fontSize: 12, opacity: 0.92, fontWeight: 800, color: "#bfdbfe" }}>
                    Requirement: {row.note}
                  </div>
                ) : null}

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, opacity: 0.9 }}>
                  <span>Type: {row.source_type}</span>
                  <span>Penalty/day: -{Math.round(Number(row.penalty_points_per_day ?? 0))}</span>
                  <span>Initial prize: +{Math.round(Number(row.reward_points ?? 0))}</span>
                  <span>Charged days: {Math.round(Number(row.charged_days ?? 0))}</span>
                </div>

                {!isDone ? (
                  <div>
                    <button type="button" style={secondaryBtn()} onClick={() => completeAssignment(row.id)} disabled={busy}>
                      Verify Complete (+{prizeNow})
                    </button>
                  </div>
                ) : (
                  <div style={{ color: "#86efac", fontWeight: 900, fontSize: 12 }}>
                    Completed: {new Date(String(row.completed_at)).toLocaleString()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function panel(): React.CSSProperties {
  return {
    border: "1px solid rgba(148,163,184,0.3)",
    borderRadius: 14,
    padding: 12,
    background: "rgba(15,23,42,0.62)",
    display: "grid",
    gap: 10,
  };
}

function labelStyle(): React.CSSProperties {
  return {
    display: "grid",
    gap: 6,
    fontWeight: 900,
    fontSize: 12,
  };
}

function primaryBtn(): React.CSSProperties {
  return {
    border: "1px solid rgba(34,197,94,0.6)",
    background: "rgba(22,163,74,0.25)",
    color: "white",
    borderRadius: 10,
    padding: "10px 12px",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function secondaryBtn(): React.CSSProperties {
  return {
    border: "1px solid rgba(56,189,248,0.55)",
    background: "rgba(2,132,199,0.24)",
    color: "white",
    borderRadius: 10,
    padding: "8px 10px",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function ghostBtn(): React.CSSProperties {
  return {
    border: "1px solid rgba(148,163,184,0.45)",
    background: "rgba(30,41,59,0.45)",
    color: "white",
    borderRadius: 10,
    padding: "8px 10px",
    textDecoration: "none",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function notice(): React.CSSProperties {
  return {
    border: "1px solid rgba(56,189,248,0.45)",
    background: "rgba(14,116,144,0.18)",
    padding: "8px 10px",
    borderRadius: 12,
    fontWeight: 800,
  };
}

function chipBtn(active: boolean): React.CSSProperties {
  return {
    border: active ? "1px solid rgba(34,197,94,0.66)" : "1px solid rgba(148,163,184,0.45)",
    background: active ? "rgba(21,128,61,0.3)" : "rgba(30,41,59,0.45)",
    color: "white",
    borderRadius: 999,
    padding: "5px 10px",
    fontSize: 12,
    fontWeight: 900,
    fontStyle: "italic",
    cursor: "pointer",
  };
}

function chipInfo(color: string, bg: string, border: string): React.CSSProperties {
  return {
    color,
    background: bg,
    border: `1px solid ${border}`,
    borderRadius: 999,
    padding: "5px 9px",
    fontSize: 12,
    fontWeight: 900,
  };
}

function statCard(): React.CSSProperties {
  return {
    border: "1px solid rgba(148,163,184,0.35)",
    borderRadius: 10,
    background: "rgba(2,6,23,0.55)",
    padding: "8px 10px",
    fontWeight: 900,
  };
}

function rowCard(done: boolean): React.CSSProperties {
  return {
    border: `1px solid ${done ? "rgba(74,222,128,0.45)" : "rgba(148,163,184,0.28)"}`,
    borderRadius: 12,
    padding: 10,
    background: done ? "rgba(20,83,45,0.25)" : "rgba(2,6,23,0.6)",
    display: "grid",
    gap: 7,
  };
}

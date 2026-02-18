"use client";

import { useEffect, useMemo, useState } from "react";
import AuthGate from "../../components/AuthGate";
import Overlay from "../../components/dashboard/Overlay";
import TimerTool from "@/components/TimerTool";

type StatRow = {
  id: string;
  name: string;
  category?: string | null;
  unit?: string | null;
  higher_is_better?: boolean;
  minimum_value_for_ranking?: number | null;
};

type StudentRow = {
  id: string;
  name: string;
};
type RecentRecord = {
  stat_id: string;
  value: number;
  recorded_at: string;
};
type LabSession = {
  id: string;
  student_ids: string[];
  stat_ids: string[];
  created_at: string;
  label: string;
};
type ClassSession = {
  session_id: string;
  instance_id: string;
  class_id: string;
  class_name: string;
  schedule_entry_id: string;
  start_time?: string | null;
  end_time?: string | null;
  instructor_name?: string | null;
  room_name?: string | null;
};
type LeaderboardRow = {
  rank: number;
  student_id: string;
  student_name: string;
  value: number;
  recorded_at: string;
};
type LeaderboardData = {
  stat_id: string;
  stat_name: string;
  unit?: string | null;
  higher_is_better: boolean;
  rows: LeaderboardRow[];
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 180)}` } };
  }
}

export default function PerformanceLabPage() {
  return (
    <AuthGate>
      <PerformanceLabInner />
    </AuthGate>
  );
}

function PerformanceLabInner() {
  const [role, setRole] = useState<string>("student");
  const [stats, setStats] = useState<StatRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [filterCategory, setFilterCategory] = useState("all");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedStats, setSelectedStats] = useState<string[]>([]);
  const [recordOpen, setRecordOpen] = useState(false);
  const [sessionPickerOpen, setSessionPickerOpen] = useState(false);
  const [studentQuery, setStudentQuery] = useState("");
  const [recentByStudent, setRecentByStudent] = useState<Record<string, Record<string, RecentRecord[]>>>({});
  const [labSessions, setLabSessions] = useState<LabSession[]>([]);
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [classSessions, setClassSessions] = useState<ClassSession[]>([]);
  const [classSessionId, setClassSessionId] = useState("");
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterMsg, setRosterMsg] = useState("");
  const [selectedStatId, setSelectedStatId] = useState<string>("");
  const [overlayStatId, setOverlayStatId] = useState<string>("");
  const [leaderboardA, setLeaderboardA] = useState<string>("");
  const [leaderboardB, setLeaderboardB] = useState<string>("");
  const [leaderboardDataA, setLeaderboardDataA] = useState<LeaderboardData | null>(null);
  const [leaderboardDataB, setLeaderboardDataB] = useState<LeaderboardData | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [quickLeaderboardOpen, setQuickLeaderboardOpen] = useState(false);
  const [quickLeaderboardData, setQuickLeaderboardData] = useState<LeaderboardData | null>(null);
  const [quickLeaderboardLoading, setQuickLeaderboardLoading] = useState(false);
  const canEdit = role === "admin" || role === "coach";
  const canView = canEdit || role === "classroom";

  useEffect(() => {
    (async () => {
      const meRes = await fetch("/api/auth/me", { cache: "no-store" });
      const me = await safeJson(meRes);
      if (me.ok) setRole(String(me.json?.role ?? "student"));

      const sRes = await fetch("/api/performance-lab/stats", { cache: "no-store" });
      const sJson = await safeJson(sRes);
      if (!sJson.ok) return setMsg(sJson.json?.error || "Failed to load stats");
      setStats((sJson.json?.stats ?? []) as StatRow[]);

      if (me.ok && ["admin", "coach"].includes(String(me.json?.role ?? "").toLowerCase())) {
        const r = await fetch("/api/students/list", { cache: "no-store" });
        const sj = await safeJson(r);
        if (sj.ok) {
          const list = (sj.json?.students ?? []) as StudentRow[];
          setStudents(list);
        }
        await loadTodayClasses();
        await loadSessions();
      }
    })();
  }, []);

  async function loadSessions() {
    const res = await fetch("/api/performance-lab/sessions", { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return;
    setLabSessions((sj.json?.sessions ?? []) as LabSession[]);
  }

  async function loadTodayClasses() {
    const res = await fetch("/api/class-sessions/today?include_ended=1", { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return;
    setClassSessions((sj.json?.sessions ?? []) as ClassSession[]);
  }

  useEffect(() => {
    if (!stats.length) return;
    setLeaderboardA((prev) => prev || stats[0]?.id || "");
    setLeaderboardB((prev) => prev || stats[1]?.id || "");
  }, [stats]);

  useEffect(() => {
    let alive = true;
    async function loadLeaderboard(statId: string, setter: (data: LeaderboardData | null) => void) {
      if (!statId) return setter(null);
      setLeaderboardLoading(true);
      const res = await fetch(`/api/performance-lab/leaderboard?stat_id=${encodeURIComponent(statId)}&limit=10`, {
        cache: "no-store",
      });
      const sj = await safeJson(res);
      if (!alive) return;
      if (!sj.ok) {
        setMsg(sj.json?.error || "Failed to load leaderboard");
        setter(null);
      } else {
        setter((sj.json?.leaderboard ?? null) as LeaderboardData | null);
      }
      setLeaderboardLoading(false);
    }
    loadLeaderboard(leaderboardA, setLeaderboardDataA);
    loadLeaderboard(leaderboardB, setLeaderboardDataB);
    return () => {
      alive = false;
    };
  }, [leaderboardA, leaderboardB]);

  useEffect(() => {
    if (!recordOpen || !selectedStudents.length || !selectedStats.length) return;
    let alive = true;
    (async () => {
      const statIds = selectedStats.join(",");
      const results = await Promise.all(
        selectedStudents.map(async (studentId) => {
          const res = await fetch(
            `/api/performance-lab/records/recent?student_id=${studentId}&stat_ids=${encodeURIComponent(statIds)}&limit=5`,
            { cache: "no-store" }
          );
          const sj = await safeJson(res);
          if (!sj.ok) return [studentId, {}] as const;
          return [studentId, (sj.json?.records ?? {}) as Record<string, RecentRecord[]>] as const;
        })
      );
      if (!alive) return;
      const next: Record<string, Record<string, RecentRecord[]>> = {};
      results.forEach(([sid, recs]) => {
        next[sid] = recs ?? {};
      });
      setRecentByStudent(next);
    })();
    return () => {
      alive = false;
    };
  }, [recordOpen, selectedStudents, selectedStats]);

  useEffect(() => {
    if (!recordOpen || !openSessionId) return;
    const session = labSessions.find((s) => s.id === openSessionId);
    if (!session) return;
    setSelectedStudents(session.student_ids);
    setSelectedStats(session.stat_ids);
  }, [recordOpen, openSessionId, labSessions]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    stats.forEach((s) => {
      statCategories(s).forEach((c) => set.add(c));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [stats]);

  const filteredStats = useMemo(() => {
    if (filterCategory === "all") return stats;
    return stats.filter((s) => statCategories(s).includes(filterCategory));
  }, [stats, filterCategory]);

  const studentSuggestions = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return [];
    return students
      .filter((s) => !selectedStudents.includes(s.id))
      .filter((s) => s.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [studentQuery, students, selectedStudents]);

  async function openQuickLeaderboard(statId: string) {
    if (!statId) return;
    setQuickLeaderboardLoading(true);
    setQuickLeaderboardOpen(true);
    const res = await fetch(`/api/performance-lab/leaderboard?stat_id=${encodeURIComponent(statId)}&limit=10`, {
      cache: "no-store",
    });
    const sj = await safeJson(res);
    setQuickLeaderboardLoading(false);
    if (!sj.ok) {
      setMsg(sj.json?.error || "Failed to load leaderboard");
      setQuickLeaderboardData(null);
      return;
    }
    setQuickLeaderboardData((sj.json?.leaderboard ?? null) as LeaderboardData | null);
  }

  async function saveStatValue(studentId: string, stat: StatRow) {
    const raw = (drafts[`${studentId}:${stat.id}`] ?? "").trim();
    if (!raw) return;
    const value = Number(raw);
    if (Number.isNaN(value)) return setMsg("Stat value must be a number.");

    const res = await fetch("/api/performance-lab/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId, stat_id: stat.id, value }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to save stat");
  }

  async function saveAll() {
    if (!selectedStudents.length) return setMsg("Select students first.");
    if (!selectedStats.length) return setMsg("Select at least one stat.");
    setMsg("");

    const pickedStats = stats.filter((s) => selectedStats.includes(s.id));
    const requests: Promise<void>[] = [];
    selectedStudents.forEach((studentId) => {
      pickedStats.forEach((stat) => {
        const key = `${studentId}:${stat.id}`;
        if (!String(drafts[key] ?? "").trim()) return;
        requests.push(saveStatValue(studentId, stat));
      });
    });

    if (!requests.length) return setMsg("Enter values before saving.");
    await Promise.all(requests);

    const payload = {
      id: openSessionId ?? undefined,
      label: buildSessionLabel(selectedStudents, selectedStats),
      student_ids: selectedStudents,
      stat_ids: selectedStats,
    };
    const sessionRes = await fetch("/api/performance-lab/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const sessionJson = await safeJson(sessionRes);
    if (sessionJson.ok) {
      const saved = sessionJson.json?.session as LabSession | undefined;
      if (saved) {
        setLabSessions((prev) => {
          const existing = prev.find((s) => s.id === saved.id);
          if (existing) {
            return prev.map((s) => (s.id === saved.id ? saved : s));
          }
          return [saved, ...prev];
        });
        setOpenSessionId(saved.id);
      }
    }

    setDrafts({});
    setMsg("Saved.");
  }

  function toggleStudent(id: string) {
    setSelectedStudents((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  async function loadRosterFromClass() {
    setRosterMsg("");
    if (!classSessionId) return setRosterMsg("Select a class first.");
    setRosterLoading(true);
    const res = await fetch("/api/classroom/roster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instance_id: classSessionId }),
    });
    const sj = await safeJson(res);
    setRosterLoading(false);
    if (!sj.ok) return setRosterMsg(sj.json?.error || "Failed to load roster.");
    const roster = (sj.json?.roster ?? []) as Array<{ student?: { id: string; name: string } }>;
    const rosterStudents = roster
      .map((r) => r.student)
      .filter(Boolean) as Array<{ id: string; name: string }>;
    const rosterIds = rosterStudents.map((s) => s.id);
    setStudents((prev) => {
      const map = new Map(prev.map((s) => [s.id, s]));
      rosterStudents.forEach((s) => {
        if (!map.has(s.id)) map.set(s.id, { id: s.id, name: s.name });
      });
      return Array.from(map.values());
    });
    setSelectedStudents(rosterIds);
    setRosterMsg(rosterIds.length ? `Loaded ${rosterIds.length} students from roster.` : "Roster is empty.");
  }

  function toggleStat(id: string) {
    setSelectedStats((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  function removeStat(id: string) {
    setSelectedStats((prev) => prev.filter((s) => s !== id));
  }

  function renderLeaderboard(data: LeaderboardData | null) {
    if (!data) {
      return <div style={leaderboardEmpty()}>Select a stat to view rankings.</div>;
    }
    const unit = data.unit ? ` ${data.unit}` : "";
    if (!data.rows.length) {
      return <div style={leaderboardEmpty()}>No records yet.</div>;
    }
    return (
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.7 }}>{data.stat_name}</div>
        <div style={{ display: "grid", gap: 6 }}>
          {data.rows.map((row) => (
            <div key={row.student_id} style={leaderboardRow()}>
              <div style={leaderboardRank()}>{row.rank}</div>
              <div style={{ fontWeight: 900, fontSize: 14 }}>{row.student_name}</div>
              <div style={{ fontWeight: 1000, fontSize: 15 }}>{row.value}{unit}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function buildSessionLabel(studentIds: string[], statIds: string[]) {
    const firstStudent = students.find((s) => s.id === studentIds[0])?.name ?? "Students";
    const firstStat = stats.find((s) => s.id === statIds[0])?.name ?? "Stats";
    return `${firstStudent} • ${statIds.length} stats`;
  }

  if (!canView) {
    return (
      <main style={{ display: "grid", gap: 12 }}>
        <div style={{ fontSize: 26, fontWeight: 1000 }}>Performance Lab</div>
        <div style={{ opacity: 0.75 }}>Admin access required.</div>
      </main>
    );
  }

  if (!canEdit) {
    return (
      <main style={{ display: "grid", gap: 16 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 1000 }}>Performance Lab</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            Classroom view: review performance stats on student dashboards.
          </div>
        </div>

        <div style={labGrid()}>
          <section style={labColumn()}>
            <div style={{ ...card(), ...leaderboardCard() }}>
              <div style={leaderboardParticles()} />
              <div style={leaderboardBody()}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div style={{ fontWeight: 1000 }}>Leaderboards</div>
                  {leaderboardLoading ? <span style={soonPill()}>Loading</span> : null}
                </div>
                <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                    <div style={selectWrap()}>
                      <select
                        value={leaderboardA}
                        onChange={(e) => setLeaderboardA(e.target.value)}
                        style={selectModern()}
                      >
                        <option value="">Select stat for Board 1</option>
                        {stats.map((stat) => (
                          <option key={stat.id} value={stat.id}>
                            {stat.name}
                          </option>
                        ))}
                      </select>
                      <span style={selectChevron()}>▾</span>
                    </div>
                    <div style={selectWrap()}>
                      <select
                        value={leaderboardB}
                        onChange={(e) => setLeaderboardB(e.target.value)}
                        style={selectModern()}
                      >
                        <option value="">Select stat for Board 2</option>
                        {stats.map((stat) => (
                          <option key={stat.id} value={stat.id}>
                            {stat.name}
                          </option>
                        ))}
                      </select>
                      <span style={selectChevron()}>▾</span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                    {renderLeaderboard(leaderboardDataA)}
                    {renderLeaderboard(leaderboardDataB)}
                  </div>
                </div>
              </div>
            </div>
          </section>
          <section style={labColumn()}>
            <div style={card()}>
              <div style={{ fontWeight: 1000, marginBottom: 8 }}>Stats Overview</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>
                Use student dashboards to view the latest recorded stats.
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <div>
        <div style={{ fontSize: 26, fontWeight: 1000 }}>Performance Lab</div>
        <div style={{ opacity: 0.7, fontSize: 12 }}>
          Track student metrics and log results for stats defined in the Performance Lab settings.
        </div>
      </div>

      {msg ? <div style={notice()}>{msg}</div> : null}
      {!canEdit ? (
        <div style={{ opacity: 0.7, fontSize: 12 }}>
          Classroom view: stats are read-only. Recording tools are disabled.
        </div>
      ) : null}

      <div style={labGrid()}>
        <section style={labColumn()}>
          <div style={{ ...card(), ...leaderboardCard() }}>
            <div style={leaderboardParticles()} />
            <div style={leaderboardBody()}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div style={{ fontWeight: 1000 }}>Leaderboards</div>
                {leaderboardLoading ? <span style={soonPill()}>Loading</span> : null}
              </div>
              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                  <div style={selectWrap()}>
                    <select
                      value={leaderboardA}
                      onChange={(e) => setLeaderboardA(e.target.value)}
                      style={selectModern()}
                    >
                      <option value="">Select stat for Board 1</option>
                      {stats.map((stat) => (
                        <option key={stat.id} value={stat.id}>
                          {stat.name}
                        </option>
                      ))}
                    </select>
                    <span style={selectChevron()}>▾</span>
                  </div>
                  <div style={selectWrap()}>
                    <select
                      value={leaderboardB}
                      onChange={(e) => setLeaderboardB(e.target.value)}
                      style={selectModern()}
                    >
                      <option value="">Select stat for Board 2</option>
                      {stats.map((stat) => (
                        <option key={stat.id} value={stat.id}>
                          {stat.name}
                        </option>
                      ))}
                    </select>
                    <span style={selectChevron()}>▾</span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                  {renderLeaderboard(leaderboardDataA)}
                  {renderLeaderboard(leaderboardDataB)}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section style={labColumn()}>
          <div style={card()}>
            <div style={{ fontWeight: 1000, marginBottom: 8 }}>Active Session</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>
              {selectedStudents.length} students • {selectedStats.length} stats
            </div>
            <TimerTool
              title="Session Timer"
              contextLabel="Timer ends by opening active sessions."
              selectable
              onComplete={() => {
                if (!labSessions.length) return;
                setSessionPickerOpen(true);
              }}
            />
          </div>
          <div style={card()}>
            <div style={{ fontWeight: 1000, marginBottom: 8 }}>Select Students</div>
            <input
              value={studentQuery}
              onChange={(e) => setStudentQuery(e.target.value)}
              placeholder="Type a name and press Enter"
              style={{ ...input(), width: "min(420px, 100%)" }}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const next = studentSuggestions[0];
                if (!next) return;
                toggleStudent(next.id);
                setStudentQuery("");
              }}
            />
            {studentSuggestions.length ? (
              <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
                {studentSuggestions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      toggleStudent(s.id);
                      setStudentQuery("");
                    }}
                    style={suggestionBtn()}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            ) : null}
            {canEdit ? (
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.8 }}>Pull roster from today</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                      <select value={classSessionId} onChange={(e) => setClassSessionId(e.target.value)} style={selectModern()}>
                    <option value="">Select a class</option>
                    {classSessions.map((session) => (
                      <option key={session.instance_id} value={session.instance_id}>
                        {session.class_name || "Class"} • {session.start_time || "TBD"} {session.room_name ? `• ${session.room_name}` : ""}
                      </option>
                    ))}
                  </select>
                  <button onClick={loadRosterFromClass} style={recordBtn()} disabled={rosterLoading}>
                    {rosterLoading ? "Loading..." : "Load Roster"}
                  </button>
                </div>
                {rosterMsg ? <div style={{ fontSize: 12, opacity: 0.7 }}>{rosterMsg}</div> : null}
              </div>
            ) : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              {selectedStudents.map((id) => {
                const student = students.find((s) => s.id === id);
                if (!student) return null;
                return (
                  <button key={id} onClick={() => toggleStudent(id)} style={pill(true)}>
                    {student.name}
                  </button>
                );
              })}
            </div>
          </div>

          {labSessions.length ? (
            <div style={card()}>
              <div style={{ fontWeight: 1000, marginBottom: 8 }}>Saved Sessions</div>
              <div style={{ display: "grid", gap: 8 }}>
                {labSessions.map((s) => (
                  <div key={s.id} style={sessionRow()}>
                    <button
                      onClick={() => {
                        setOpenSessionId(s.id);
                        setRecordOpen(true);
                      }}
                      style={sessionBtn()}
                    >
                      <div style={{ fontWeight: 1000 }}>{s.label}</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        {s.student_ids.length} students • {s.stat_ids.length} stats
                      </div>
                    </button>
                    <button
                      onClick={async () => {
                        const res = await fetch("/api/performance-lab/sessions", {
                          method: "DELETE",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: s.id }),
                        });
                        const sj = await safeJson(res);
                        if (!sj.ok) return setMsg(sj.json?.error || "Failed to remove session");
                        setLabSessions((prev) => prev.filter((row) => row.id !== s.id));
                      }}
                      style={sessionRemoveBtn()}
                      aria-label="Remove session"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div style={card()}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 1000 }}>Select Stats</div>
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={input()}>
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={selectWrap()}>
                  <select
                    value={selectedStatId}
                    onChange={(e) => setSelectedStatId(e.target.value)}
                    style={selectModern()}
                  >
                    <option value="">Select a stat</option>
                    {filteredStats.map((stat) => (
                      <option key={stat.id} value={stat.id}>
                        {stat.name}
                      </option>
                    ))}
                  </select>
                  <span style={selectChevron()}>▾</span>
                </div>
                <button
                  onClick={() => {
                    if (!selectedStatId) return;
                    if (!selectedStats.includes(selectedStatId)) {
                      setSelectedStats((prev) => [...prev, selectedStatId]);
                    }
                    setSelectedStatId("");
                  }}
                  style={btnGhost()}
                >
                  Add Stat
                </button>
              </div>
              {!filteredStats.length && <div style={{ opacity: 0.7 }}>No stats yet.</div>}
            </div>

            {selectedStats.length ? (
              <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                {selectedStats.map((id) => {
                  const stat = stats.find((s) => s.id === id);
                  if (!stat) return null;
                  return (
                    <div key={id} style={statRow()}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <div>
                          <div style={{ fontWeight: 1000 }}>{stat.name}</div>
                          <div style={{ opacity: 0.7, fontSize: 12 }}>
                            {statCategories(stat).length ? `${statCategories(stat).join(" • ")} • ` : ""}
                            {stat.unit ? `Unit: ${stat.unit}` : "No unit"}
                            {Number(stat.minimum_value_for_ranking ?? 0) > 0 ? ` • Min rank value: ${Number(stat.minimum_value_for_ranking)}` : ""}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <button onClick={() => void openQuickLeaderboard(id)} style={miniEmojiBtn()} title="Open leaderboard">
                            📊
                          </button>
                          <button onClick={() => removeStat(id)} style={chipRemove()} aria-label="Remove stat">
                            ×
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div style={recordPanel()}>
            <div style={{ fontWeight: 1000 }}>Record Stats</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>
              {selectedStudents.length} students • {selectedStats.length} stats per student
            </div>
            <button onClick={() => setRecordOpen(true)} style={recordBtn()} disabled={!selectedStudents.length || !selectedStats.length}>
              Record Stats
            </button>
            {!selectedStudents.length && <div style={{ opacity: 0.7 }}>Select at least one student.</div>}
            {!selectedStats.length && <div style={{ opacity: 0.7 }}>Select at least one stat.</div>}
          </div>
        </section>
      </div>

      {recordOpen && (
        <Overlay
          title="Record Stats"
          maxWidth={1260}
          onClose={() => {
            setRecordOpen(false);
            setOpenSessionId(null);
          }}
        >
          <div style={{ display: "grid", gap: 12, maxHeight: "74vh", overflowY: "auto", paddingRight: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 900 }}>Session Timer</div>
              <TimerTool mode="button" triggerLabel="Timer" />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
                placeholder="Add student in overlay..."
                style={{ ...input(), minWidth: 240 }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  const next = studentSuggestions[0];
                  if (!next) return;
                  toggleStudent(next.id);
                  setStudentQuery("");
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const next = studentSuggestions[0];
                  if (!next) return;
                  toggleStudent(next.id);
                  setStudentQuery("");
                }}
                style={btnGhost()}
              >
                Add Student
              </button>
              {selectedStats.map((id) => {
                const stat = stats.find((s) => s.id === id);
                if (!stat) return null;
                return (
                  <div key={id} style={chip()}>
                    <span>{stat.name}</span>
                    <button onClick={() => void openQuickLeaderboard(id)} style={miniEmojiBtn()} title="Open leaderboard">📊</button>
                    <button onClick={() => removeStat(id)} style={chipRemove()} aria-label="Remove stat">×</button>
                  </div>
                );
              })}
              <div style={selectWrap()}>
                <select
                  value={overlayStatId}
                  onChange={(e) => setOverlayStatId(e.target.value)}
                  style={selectModern()}
                >
                  <option value="">Select a stat</option>
                  {filteredStats.map((stat) => (
                    <option key={stat.id} value={stat.id}>
                      {stat.name}
                    </option>
                  ))}
                </select>
                <span style={selectChevron()}>▾</span>
              </div>
              <button
                onClick={() => {
                  if (!overlayStatId) return;
                  if (!selectedStats.includes(overlayStatId)) {
                    setSelectedStats((prev) => [...prev, overlayStatId]);
                  }
                  setOverlayStatId("");
                }}
                style={btnGhost()}
              >
                Add Stat
              </button>
            </div>

            <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
              {selectedStudents.map((studentId, idx) => {
                const student = students.find((s) => s.id === studentId);
                return (
                  <div key={studentId} style={recordCard(idx)}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontWeight: 1000 }}>{student?.name ?? "Student"}</div>
                      <button onClick={() => toggleStudent(studentId)} style={chipRemove()} aria-label="Remove student">
                        ×
                      </button>
                    </div>
                    <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", maxHeight: 320, overflowY: "auto", paddingRight: 4 }}>
                      {selectedStats.map((statId) => {
                        const stat = stats.find((s) => s.id === statId);
                        if (!stat) return null;
                        const key = `${studentId}:${statId}`;
                        const recent = recentByStudent[studentId]?.[statId] ?? [];
                        return (
                          <label key={statId} style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 900 }}>
                            <span>{stat.name}{stat.unit ? ` (${stat.unit})` : ""}</span>
                            <input
                              value={drafts[key] ?? ""}
                              onChange={(e) => setDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                              placeholder="Enter value"
                              style={input()}
                            />
                            {recent.length ? (
                              <div style={recentRow()}>
                                {recent.map((r) => (
                                  <span key={r.recorded_at} style={recentPill()}>
                                    {r.value}{stat.unit ? ` ${stat.unit}` : ""} • {new Date(r.recorded_at).toLocaleDateString()}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ opacity: 0.6 }}>No recent entries</span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setRecordOpen(false)} style={btnGhost()}>Close</button>
              <button onClick={saveAll} style={btn()}>Save</button>
            </div>
          </div>
        </Overlay>
      )}

      {sessionPickerOpen && (
        <Overlay title="Active Sessions" maxWidth={720} onClose={() => setSessionPickerOpen(false)}>
          <div style={{ display: "grid", gap: 10 }}>
            {labSessions.length ? (
              labSessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setOpenSessionId(s.id);
                    setSessionPickerOpen(false);
                    setRecordOpen(true);
                  }}
                  style={sessionBtn()}
                >
                  <div style={{ fontWeight: 1000 }}>{s.label}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    {s.student_ids.length} students • {s.stat_ids.length} stats
                  </div>
                </button>
              ))
            ) : (
              <div style={{ opacity: 0.7 }}>No active sessions.</div>
            )}
          </div>
        </Overlay>
      )}
      {quickLeaderboardOpen && (
        <Overlay title="Stat Leaderboard" maxWidth={640} onClose={() => setQuickLeaderboardOpen(false)}>
          <div style={{ display: "grid", gap: 10 }}>
            {quickLeaderboardLoading ? <div style={leaderboardEmpty()}>Loading leaderboard...</div> : null}
            {!quickLeaderboardLoading ? renderLeaderboard(quickLeaderboardData) : null}
          </div>
        </Overlay>
      )}
      <style>{`
        @keyframes leaderboardDrift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        select option {
          color: #0f172a;
          background: #f8fafc;
        }
      `}</style>
    </main>
  );
}

function card(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    display: "grid",
    gap: 10,
  };
}

function recordCard(index: number): React.CSSProperties {
  const colors = [
    "rgba(59,130,246,0.18)",
    "rgba(34,197,94,0.18)",
    "rgba(249,115,22,0.18)",
    "rgba(168,85,247,0.18)",
    "rgba(236,72,153,0.18)",
    "rgba(14,165,233,0.18)",
  ];
  const tint = colors[index % colors.length];
  return {
    borderRadius: 16,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: `linear-gradient(150deg, ${tint}, rgba(255,255,255,0.04))`,
    display: "grid",
    gap: 10,
    boxShadow: "0 14px 30px rgba(0,0,0,0.25)",
  };
}

function labGrid(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "0.9fr 1.1fr",
    gap: 16,
    alignItems: "start",
  };
}

function labColumn(): React.CSSProperties {
  return {
    display: "grid",
    gap: 12,
  };
}

function statRow(): React.CSSProperties {
  return {
    display: "grid",
    gap: 4,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
  };
}

function soonPill(): React.CSSProperties {
  return {
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.45)",
    background: "rgba(148,163,184,0.16)",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  };
}

function input(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.28)",
    color: "white",
    fontWeight: 900,
    minWidth: 180,
  };
}

function pill(active: boolean): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.16)",
    background: active ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  };
}

function chip(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(59,130,246,0.18)",
    fontWeight: 900,
    fontSize: 12,
  };
}

function chipRemove(): React.CSSProperties {
  return {
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(0,0,0,0.35)",
    color: "white",
    width: 20,
    height: 20,
    lineHeight: "18px",
    textAlign: "center",
    cursor: "pointer",
    fontWeight: 900,
  };
}

function btnGhost(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function suggestionBtn(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    textAlign: "left",
  };
}

function btn(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(59,130,246,0.35)",
    background: "rgba(59,130,246,0.25)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function selectWrap(): React.CSSProperties {
  return {
    position: "relative",
    minWidth: 220,
  };
}

function selectModern(): React.CSSProperties {
  return {
    padding: "10px 36px 10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.5)",
    background: "linear-gradient(135deg, rgba(248,250,252,0.98), rgba(226,232,240,0.96))",
    color: "#0f172a",
    fontWeight: 900,
    width: "100%",
    appearance: "none",
    outline: "none",
    cursor: "pointer",
  };
}

function selectChevron(): React.CSSProperties {
  return {
    position: "absolute",
    right: 12,
    top: "50%",
    transform: "translateY(-50%)",
    pointerEvents: "none",
    opacity: 0.7,
    fontSize: 12,
  };
}

function sessionRow(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 8,
    alignItems: "center",
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
  };
}

function sessionBtn(): React.CSSProperties {
  return {
    textAlign: "left",
    padding: "6px 8px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "white",
    cursor: "pointer",
  };
}

function sessionRemoveBtn(): React.CSSProperties {
  return {
    width: 30,
    height: 30,
    borderRadius: 999,
    border: "1px solid rgba(239,68,68,0.4)",
    background: "rgba(239,68,68,0.12)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
  };
}

function leaderboardRow(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "26px 1fr auto",
    gap: 8,
    alignItems: "center",
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    fontSize: 13,
  };
}

function leaderboardRank(): React.CSSProperties {
  return {
    fontWeight: 1000,
    textAlign: "center",
    color: "rgba(148,163,184,0.9)",
  };
}

function leaderboardEmpty(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px dashed rgba(255,255,255,0.2)",
    color: "rgba(148,163,184,0.85)",
    fontSize: 13,
  };
}

function leaderboardCard(): React.CSSProperties {
  return {
    position: "relative",
    overflow: "hidden",
    minHeight: 260,
    border: "1px solid rgba(59,130,246,0.3)",
    background: "linear-gradient(140deg, rgba(30,41,59,0.9), rgba(15,23,42,0.85))",
    boxShadow: "0 18px 40px rgba(15,23,42,0.45)",
  };
}

function leaderboardParticles(): React.CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "radial-gradient(circle at 20% 20%, rgba(59,130,246,0.25), transparent 55%), radial-gradient(circle at 80% 10%, rgba(34,197,94,0.2), transparent 60%), radial-gradient(circle at 15% 80%, rgba(236,72,153,0.18), transparent 60%), radial-gradient(circle at 85% 80%, rgba(250,204,21,0.22), transparent 55%)",
    opacity: 0.65,
    animation: "leaderboardDrift 10s linear infinite",
    pointerEvents: "none",
    zIndex: 0,
  };
}

function leaderboardBody(): React.CSSProperties {
  return {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gap: 10,
  };
}

function recordPanel(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 18,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "linear-gradient(135deg, rgba(15,23,42,0.9), rgba(2,6,23,0.95))",
    display: "grid",
    gap: 10,
    alignItems: "center",
    justifyItems: "center",
    minHeight: 140,
  };
}

function recordBtn(): React.CSSProperties {
  return {
    padding: "12px 18px",
    borderRadius: 14,
    border: "1px solid rgba(34,197,94,0.45)",
    background: "linear-gradient(90deg, rgba(34,197,94,0.95), rgba(16,185,129,0.8))",
    color: "white",
    fontWeight: 1000,
    cursor: "pointer",
    fontSize: 16,
    minWidth: 180,
    boxShadow: "0 14px 30px rgba(16,185,129,0.25)",
  };
}

function notice(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(239,68,68,0.3)",
    background: "rgba(239,68,68,0.12)",
    color: "white",
    fontWeight: 900,
    fontSize: 12,
  };
}

function recentRow(): React.CSSProperties {
  return {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  };
}

function recentPill(): React.CSSProperties {
  return {
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.08)",
    fontSize: 11,
    fontWeight: 900,
  };
}

function miniEmojiBtn(): React.CSSProperties {
  return {
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.45)",
    background: "rgba(2,132,199,0.22)",
    color: "white",
    width: 24,
    height: 24,
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    fontSize: 12,
    lineHeight: 1,
  };
}

function statCategories(stat: StatRow): string[] {
  return String(stat.category ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

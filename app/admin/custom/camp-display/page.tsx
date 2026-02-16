"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type StudentPick = { id: string; name: string; level?: number; points_total?: number };

type Roster = {
  id: string;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  enabled: boolean;
  sort_order: number;
};

type Group = {
  id: string;
  roster_id: string;
  name: string;
  enabled: boolean;
  sort_order: number;
};

type Member = {
  id: string;
  roster_id: string;
  group_id: string | null;
  student_id: string;
  display_role: string;
  secondary_role?: string;
  secondary_role_days?: string[];
  faction_id?: string | null;
  enabled: boolean;
  sort_order: number;
  student?: {
    id: string;
    name: string;
    level?: number;
    points_total?: number;
  } | null;
};
type Faction = { id: string; name: string; color?: string; icon?: string; enabled?: boolean; sort_order?: number };

type ScreenConfig = {
  id: number;
  title: string;
  roster_id: string | null;
  group_id: string | null;
  show_all_groups: boolean;
  enabled: boolean;
};
type TodayClassSession = {
  instance_id: string;
  class_name?: string;
  start_time?: string;
  end_time?: string;
  instructor_name?: string;
  room_name?: string;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: text.slice(0, 220) } };
  }
}

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function plusDaysIso(baseIso: string, days: number) {
  const d = new Date(`${baseIso}T00:00:00.000Z`);
  if (!Number.isFinite(d.getTime())) return baseIso;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const ROLE_DAY_OPTIONS = [
  { key: "m", label: "M" },
  { key: "t", label: "T" },
  { key: "w", label: "W" },
  { key: "r", label: "R" },
  { key: "f", label: "F" },
  { key: "sa", label: "SA" },
  { key: "su", label: "SU" },
] as const;

export default function CampDisplayAdminPage() {
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [screens, setScreens] = useState<ScreenConfig[]>([]);
  const [factions, setFactions] = useState<Faction[]>([]);

  const [activeRosterId, setActiveRosterId] = useState("");
  const [newRosterName, setNewRosterName] = useState("");
  const [newGroupName, setNewGroupName] = useState("");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudentPick[]>([]);
  const [dragMemberId, setDragMemberId] = useState<string | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickFirstName, setQuickFirstName] = useState("");
  const [quickLastName, setQuickLastName] = useState("");
  const [quickCompetition, setQuickCompetition] = useState(false);
  const [todaySessions, setTodaySessions] = useState<TodayClassSession[]>([]);
  const [selectedSessionInstanceId, setSelectedSessionInstanceId] = useState("");
  const [autosaveTick, setAutosaveTick] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  const [msg, setMsg] = useState("");

  async function load() {
    setMsg("");
    const res = await fetch("/api/camp/display-roster", { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(String(sj.json?.error ?? "Failed to load"));

    if (Number(sj.json?.version ?? 1) < 2) {
      const legacyRows = Array.isArray(sj.json?.roster) ? sj.json.roster : [];
      const defaultRosterId = uid();
      const migratedMembers: Member[] = legacyRows.map((row: any, idx: number) => ({
        id: String(row?.id ?? uid()),
        roster_id: defaultRosterId,
        group_id: null,
        student_id: String(row?.student_id ?? ""),
        display_role: String(row?.display_role ?? "camper"),
        secondary_role: "",
        secondary_role_days: [],
        enabled: row?.enabled !== false,
        sort_order: Number(row?.sort_order ?? idx),
        student: row?.student ?? null,
      }));
      const start = todayIso();
      setRosters([{ id: defaultRosterId, name: "Main Camp", start_date: start, end_date: plusDaysIso(start, 6), enabled: true, sort_order: 0 }]);
      setGroups([]);
      setMembers(migratedMembers);
      setFactions([]);
      setScreens([
        { id: 1, title: "Camp Display 1", roster_id: defaultRosterId, group_id: null, show_all_groups: true, enabled: true },
        { id: 2, title: "Camp Display 2", roster_id: defaultRosterId, group_id: null, show_all_groups: true, enabled: true },
        { id: 3, title: "Camp Display 3", roster_id: defaultRosterId, group_id: null, show_all_groups: true, enabled: true },
      ]);
      setActiveRosterId(defaultRosterId);
      setHydrated(true);
      return;
    }

    const loadedRosters = (sj.json?.rosters ?? []) as Roster[];
    const loadedGroups = (sj.json?.groups ?? []) as Group[];
    const loadedMembers = (sj.json?.members ?? []) as Member[];
    const loadedScreens = (sj.json?.screens ?? []) as ScreenConfig[];
    const loadedFactions = (sj.json?.factions ?? []) as Faction[];

    const hydrated = Array.isArray(sj.json?.members_hydrated) ? sj.json.members_hydrated : [];
    const memberById = new Map<string, any>(hydrated.map((row: any) => [String(row.id), row]));
    const mergedMembers = loadedMembers.map((m) => {
      const full = memberById.get(String(m.id));
      return {
        ...m,
        group_id: m.group_id ?? null,
        secondary_role: String(m.secondary_role ?? ""),
        secondary_role_days: Array.isArray((m as any).secondary_role_days) ? (m as any).secondary_role_days : [],
        student: full?.student ?? m.student ?? null,
      };
    });

    setRosters(loadedRosters);
    setGroups(loadedGroups);
    setMembers(mergedMembers);
    setFactions(loadedFactions);
    setScreens(
      [1, 2, 3].map((id) => {
        const found = loadedScreens.find((s) => Number(s.id) === id);
        return found ?? {
          id,
          title: `Camp Display ${id}`,
          roster_id: loadedRosters[0]?.id ?? null,
          group_id: null,
          show_all_groups: true,
          enabled: true,
        };
      })
    );
    setActiveRosterId((prev) => prev || loadedRosters[0]?.id || "");
    setHydrated(true);
  }

  useEffect(() => {
    load();
    loadTodaySessions();
  }, []);

  async function loadTodaySessions() {
    const res = await fetch("/api/class-sessions/today", { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return;
    const sessions = Array.isArray(sj.json?.sessions) ? (sj.json.sessions as TodayClassSession[]) : [];
    setTodaySessions(sessions);
    setSelectedSessionInstanceId((prev) => (prev ? prev : String(sessions[0]?.instance_id ?? "")));
  }

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch("/api/students/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      const sj = await safeJson(res);
      if (sj.ok) setResults((sj.json?.students ?? []) as StudentPick[]);
    }, 180);
    return () => clearTimeout(t);
  }, [query]);

  const groupsForRoster = useMemo(
    () => groups.filter((g) => g.roster_id === activeRosterId).sort((a, b) => a.sort_order - b.sort_order),
    [groups, activeRosterId]
  );

  const membersForRoster = useMemo(
    () => members.filter((m) => m.roster_id === activeRosterId).sort((a, b) => a.sort_order - b.sort_order),
    [members, activeRosterId]
  );

  function addRoster() {
    const name = newRosterName.trim() || `Camp Roster ${rosters.length + 1}`;
    const id = uid();
    const start = todayIso();
    const next: Roster = { id, name, start_date: start, end_date: plusDaysIso(start, 6), enabled: true, sort_order: rosters.length };
    setRosters((prev) => [...prev, next]);
    setActiveRosterId(id);
    setNewRosterName("");
    setAutosaveTick((t) => t + 1);
  }

  function addGroup() {
    if (!activeRosterId) return;
    const name = newGroupName.trim() || `Group ${groupsForRoster.length + 1}`;
    const next: Group = {
      id: uid(),
      roster_id: activeRosterId,
      name,
      enabled: true,
      sort_order: groupsForRoster.length,
    };
    setGroups((prev) => [...prev, next]);
    setNewGroupName("");
    setAutosaveTick((t) => t + 1);
  }

  function addStudent(s: StudentPick) {
    if (!activeRosterId) return;
    const exists = members.some((m) => m.roster_id === activeRosterId && m.student_id === s.id);
    if (exists) return;
    setMembers((prev) => [
      ...prev,
      {
        id: uid(),
        roster_id: activeRosterId,
        group_id: null,
        student_id: s.id,
        display_role: "camper",
        secondary_role: "",
        secondary_role_days: [],
        enabled: true,
        sort_order: prev.filter((m) => m.roster_id === activeRosterId).length,
        student: { id: s.id, name: s.name, level: s.level, points_total: s.points_total },
      },
    ]);
    setQuery("");
    setResults([]);
    setAutosaveTick((t) => t + 1);
  }

  function moveMember(memberId: string, toGroupId: string | null) {
    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId
          ? {
              ...m,
              group_id: toGroupId,
            }
          : m
      )
    );
    setAutosaveTick((t) => t + 1);
  }

  function setSecondaryRole(memberId: string, secondary: string) {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id !== memberId) return m;
        if (!secondary) return { ...m, secondary_role: "", secondary_role_days: [] };
        const existingDays = Array.isArray(m.secondary_role_days) ? m.secondary_role_days : [];
        const nextDays = existingDays.length ? existingDays : ROLE_DAY_OPTIONS.map((d) => d.key);
        return { ...m, secondary_role: secondary, secondary_role_days: nextDays };
      })
    );
    setAutosaveTick((t) => t + 1);
  }

  function removeRoster(rosterId: string) {
    setRosters((prev) => prev.filter((r) => r.id !== rosterId));
    setGroups((prev) => prev.filter((g) => g.roster_id !== rosterId));
    setMembers((prev) => prev.filter((m) => m.roster_id !== rosterId));
    setScreens((prev) =>
      prev.map((s) =>
        s.roster_id === rosterId
          ? { ...s, roster_id: null, group_id: null, show_all_groups: true }
          : s
      )
    );
    setActiveRosterId((prev) => (prev === rosterId ? rosters.find((r) => r.id !== rosterId)?.id ?? "" : prev));
    setAutosaveTick((t) => t + 1);
  }

  function removeGroup(groupId: string) {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    setMembers((prev) =>
      prev.map((m) => (m.group_id === groupId ? { ...m, group_id: null } : m))
    );
    setScreens((prev) =>
      prev.map((s) =>
        s.group_id === groupId ? { ...s, group_id: null, show_all_groups: true } : s
      )
    );
    setAutosaveTick((t) => t + 1);
  }

  async function save(silent = false) {
    if (!silent) setMsg("");
    const rosterPayload = rosters.map((r, idx) => ({ ...r, sort_order: idx }));
    const groupPayload = groups.map((g, idx) => ({ ...g, sort_order: idx }));
    const memberPayload = members.map((m, idx) => ({ ...m, sort_order: idx }));
    const factionPayload = factions.map((f, idx) => ({ ...f, sort_order: idx }));

    const res = await fetch("/api/camp/display-roster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rosters: rosterPayload,
        groups: groupPayload,
        members: memberPayload,
        screens,
        factions: factionPayload,
      }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) {
      if (!silent) setMsg(String(sj.json?.error ?? "Failed to save"));
      return;
    }
    if (!silent) {
      setMsg("Camp display settings saved.");
      await load();
    } else {
      setMsg("Autosaved");
    }
  }

  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => {
      save(true);
    }, 600);
    return () => clearTimeout(t);
  }, [autosaveTick, hydrated]);

  async function quickCreateStudent() {
    const first_name = quickFirstName.trim();
    const last_name = quickLastName.trim();
    if (!first_name || !last_name) {
      setMsg("First and last name are required.");
      return;
    }
    const res = await fetch("/api/admin/students/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ first_name, last_name, is_competition_team: quickCompetition }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(String(sj.json?.error ?? "Failed to create student"));
    const created = sj.json?.student;
    if (created?.id) {
      addStudent({
        id: String(created.id),
        name: String(created.name ?? `${first_name} ${last_name}`),
        level: Number(created.level ?? 1),
        points_total: Number(created.points_total ?? 0),
      });
    }
    setQuickFirstName("");
    setQuickLastName("");
    setQuickCompetition(false);
    setQuickAddOpen(false);
  }

  async function importFromClassroomCheckin() {
    const instanceId = selectedSessionInstanceId.trim();
    if (!activeRosterId) {
      setMsg("Pick an active roster first.");
      return;
    }
    if (!instanceId) {
      setMsg("Pick one of today's classes first.");
      return;
    }

    const res = await fetch(`/api/camp/display-roster?screen=1&instance_id=${encodeURIComponent(instanceId)}`, { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) {
      setMsg(String(sj.json?.error ?? "Failed to import from classroom check-in."));
      return;
    }

    const incoming = Array.isArray(sj.json?.display_members) ? sj.json.display_members : [];
    const existingStudentIds = new Set(
      members.filter((m) => m.roster_id === activeRosterId).map((m) => String(m.student_id))
    );

    const additions: Member[] = [];
    for (const row of incoming) {
      const studentId = String(row?.student_id ?? "").trim();
      if (!studentId || existingStudentIds.has(studentId)) continue;
      existingStudentIds.add(studentId);
      additions.push({
        id: uid(),
        roster_id: activeRosterId,
        group_id: null,
        student_id: studentId,
        display_role: "camper",
        secondary_role: "",
        faction_id: null,
        enabled: true,
        sort_order: 0,
        student: row?.student ?? null,
      });
    }

    if (!additions.length) {
      setMsg("No new students to import from that classroom roster.");
      return;
    }

    setMembers((prev) => {
      const base = prev.filter((m) => m.roster_id === activeRosterId).length;
      return [
        ...prev,
        ...additions.map((m, idx) => ({
          ...m,
          sort_order: base + idx,
        })),
      ];
    });
    setAutosaveTick((t) => t + 1);
    setMsg(`Imported ${additions.length} student${additions.length === 1 ? "" : "s"} from classroom check-in.`);
  }

  return (
    <main style={{ padding: 16, display: "grid", gap: 14, maxWidth: 1320 }}>
      <Link href="/admin/custom/camp" style={{ fontSize: 12, fontWeight: 900, opacity: 0.8 }}>
        Back to Camp Settings
      </Link>

      <div style={{ fontSize: 30, fontWeight: 1000 }}>Camp Display Roster Builder</div>
      <div style={{ opacity: 0.75 }}>Create roster lists, group students, and map each display screen.</div>
      {msg ? <div style={notice()}>{msg}</div> : null}

      <section style={card()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={secTitle()}>Quick Add Student</div>
          <button type="button" onClick={() => setQuickAddOpen(true)} style={btn()}>
            Quick Add
          </button>
        </div>
        <div style={{ fontSize: 12, opacity: 0.78 }}>Creates a student and auto-adds them to this roster as <strong>camper</strong>.</div>
      </section>

      <section style={card()}>
        <div style={secTitle()}>Display Assignment (Top Screens)</div>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
          {screens.map((screen) => {
            const rosterGroups = groups.filter((g) => g.roster_id === String(screen.roster_id ?? ""));
            return (
              <div key={screen.id} style={screenCard()}>
                <div style={{ fontWeight: 1000 }}>Display {screen.id}</div>
                <input
                  value={screen.title}
                  onChange={(e) => {
                    setScreens((prev) => prev.map((s) => (s.id === screen.id ? { ...s, title: e.target.value } : s)));
                    setAutosaveTick((t) => t + 1);
                  }}
                  style={inp()}
                  placeholder="Display title"
                />
                <select
                  value={screen.roster_id ?? ""}
                  onChange={(e) =>
                    {
                      setScreens((prev) =>
                        prev.map((s) => (s.id === screen.id ? { ...s, roster_id: e.target.value || null, group_id: null } : s))
                      );
                      setAutosaveTick((t) => t + 1);
                    }
                  }
                  style={inp()}
                >
                  <option value="">No roster</option>
                  {rosters.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 800 }}>
                  <input
                    type="checkbox"
                    checked={screen.show_all_groups !== false}
                    onChange={(e) =>
                      {
                        setScreens((prev) =>
                          prev.map((s) => (s.id === screen.id ? { ...s, show_all_groups: e.target.checked, group_id: e.target.checked ? null : s.group_id } : s))
                        );
                        setAutosaveTick((t) => t + 1);
                      }
                    }
                  />
                  Show all groups
                </label>
                {screen.show_all_groups ? null : (
                  <select
                    value={screen.group_id ?? ""}
                    onChange={(e) =>
                      {
                        setScreens((prev) => prev.map((s) => (s.id === screen.id ? { ...s, group_id: e.target.value || null } : s)));
                        setAutosaveTick((t) => t + 1);
                      }
                    }
                    style={inp()}
                  >
                    <option value="">Pick group</option>
                    {rosterGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                )}
                <Link href={`/display/camp?screen=${screen.id}`} style={btnGhost()}>
                  Open Display {screen.id}
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      <section style={card()}>
        <div style={secTitle()}>Roster Lists</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {rosters.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setActiveRosterId(r.id)}
              style={r.id === activeRosterId ? chipActive() : chip()}
            >
              {r.name}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={newRosterName} onChange={(e) => setNewRosterName(e.target.value)} placeholder="New roster name" style={inp()} />
          <button type="button" onClick={addRoster} style={btn()}>Add roster</button>
          {activeRosterId ? (
            <button type="button" onClick={() => removeRoster(activeRosterId)} style={btnDanger()}>
              Remove active roster
            </button>
          ) : null}
        </div>
        {activeRosterId ? (
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(180px,220px))", alignItems: "end" }}>
            <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 900 }}>
              Start Date
              <input
                type="date"
                value={String(rosters.find((r) => r.id === activeRosterId)?.start_date ?? "")}
                onChange={(e) => {
                  const next = e.target.value;
                  setRosters((prev) => prev.map((r) => (r.id === activeRosterId ? { ...r, start_date: next } : r)));
                  setAutosaveTick((t) => t + 1);
                }}
                style={inp()}
              />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 900 }}>
              End Date
              <input
                type="date"
                value={String(rosters.find((r) => r.id === activeRosterId)?.end_date ?? "")}
                onChange={(e) => {
                  const next = e.target.value;
                  setRosters((prev) => prev.map((r) => (r.id === activeRosterId ? { ...r, end_date: next } : r)));
                  setAutosaveTick((t) => t + 1);
                }}
                style={inp()}
              />
            </label>
          </div>
        ) : null}
      </section>

      <section style={card()}>
        <div style={secTitle()}>Add Students</div>
        <div style={{ display: "grid", gap: 8 }}>
          <input
            placeholder="Search student in this roster..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              const top = results[0];
              if (top) addStudent(top);
            }}
            style={inp()}
          />
          {results.length ? (
            <div style={{ display: "grid", gap: 6, maxHeight: 220, overflow: "auto" }}>
              {results.slice(0, 12).map((s) => (
                <button key={s.id} type="button" onClick={() => addStudent(s)} style={pickBtn()}>
                  <span style={{ fontWeight: 900 }}>{s.name}</span>
                  <span style={{ opacity: 0.75 }}>Lv {s.level ?? 1}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section style={card()}>
        <div style={secTitle()}>Import From Today's Classes</div>
        <div style={{ fontSize: 12, opacity: 0.78 }}>
          Select one of today&apos;s classes and import its classroom check-in roster into the active camp roster.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select
            value={selectedSessionInstanceId}
            onChange={(e) => setSelectedSessionInstanceId(e.target.value)}
            style={inp()}
          >
            <option value="">Select class</option>
            {todaySessions.map((s) => (
              <option key={String(s.instance_id)} value={String(s.instance_id)}>
                {String(s.class_name ?? "Class")} {s.start_time ? `• ${s.start_time}` : ""}
                {s.room_name ? ` • ${s.room_name}` : ""}
              </option>
            ))}
          </select>
          <button type="button" onClick={importFromClassroomCheckin} style={btn()} disabled={!activeRosterId}>
            Import roster
          </button>
          <Link href="/classroom/checkin" style={btnGhost()}>Open Classroom Check-In</Link>
        </div>
      </section>

      <section style={card()}>
        <div style={secTitle()}>Groups (Drag Cards Between Columns)</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="New group name" style={inp()} />
          <button type="button" onClick={addGroup} style={btn()} disabled={!activeRosterId}>
            Add group
          </button>
        </div>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))" }}>
          <GroupColumn
            title="Ungrouped"
            members={membersForRoster.filter((m) => !m.group_id)}
            onDropMember={(id) => moveMember(id, null)}
            dragMemberId={dragMemberId}
            setDragMemberId={setDragMemberId}
            onRoleChange={(id, role) => {
              setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, display_role: role } : m)));
              setAutosaveTick((t) => t + 1);
            }}
            onSecondaryRoleChange={(id, secondary) => {
              setSecondaryRole(id, secondary);
            }}
            onSecondaryRoleDaysChange={(id, dayKey, enabled) => {
              setMembers((prev) =>
                prev.map((m) => {
                  if (m.id !== id) return m;
                  const current = Array.isArray(m.secondary_role_days) ? m.secondary_role_days : [];
                  const next = enabled
                    ? Array.from(new Set([...current, dayKey]))
                    : current.filter((d) => d !== dayKey);
                  return { ...m, secondary_role_days: next };
                })
              );
              setAutosaveTick((t) => t + 1);
            }}
            onFactionChange={(id, factionId) => {
              setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, faction_id: factionId } : m)));
              setAutosaveTick((t) => t + 1);
            }}
            factions={factions}
            onRemoveMember={(id) => {
              setMembers((prev) => prev.filter((m) => m.id !== id));
              setAutosaveTick((t) => t + 1);
            }}
          />
          {groupsForRoster.map((group) => (
            <GroupColumn
              key={group.id}
              title={group.name}
              onRemoveGroup={() => removeGroup(group.id)}
              members={membersForRoster.filter((m) => m.group_id === group.id)}
              onDropMember={(id) => moveMember(id, group.id)}
              dragMemberId={dragMemberId}
              setDragMemberId={setDragMemberId}
              onRoleChange={(id, role) => {
                setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, display_role: role } : m)));
                setAutosaveTick((t) => t + 1);
              }}
              onSecondaryRoleChange={(id, secondary) => {
                setSecondaryRole(id, secondary);
            }}
              onSecondaryRoleDaysChange={(id, dayKey, enabled) => {
                setMembers((prev) =>
                  prev.map((m) => {
                    if (m.id !== id) return m;
                    const current = Array.isArray(m.secondary_role_days) ? m.secondary_role_days : [];
                    const next = enabled
                      ? Array.from(new Set([...current, dayKey]))
                      : current.filter((d) => d !== dayKey);
                    return { ...m, secondary_role_days: next };
                  })
                );
                setAutosaveTick((t) => t + 1);
              }}
              onFactionChange={(id, factionId) => {
                setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, faction_id: factionId } : m)));
                setAutosaveTick((t) => t + 1);
              }}
              factions={factions}
              onRemoveMember={(id) => {
                setMembers((prev) => prev.filter((m) => m.id !== id));
                setAutosaveTick((t) => t + 1);
              }}
            />
          ))}
        </div>
      </section>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" style={btn()} onClick={() => save(false)}>Save Camp Roster Config</button>
        <Link href="/admin/custom/camp-factions" style={btnGhost()}>Camp Factions</Link>
        <Link href="/camp/classroom" style={btnGhost()}>Open Camp Classroom</Link>
      </div>

      {quickAddOpen ? (
        <div style={overlay()} onClick={() => setQuickAddOpen(false)}>
          <div style={modalCard()} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ fontWeight: 1000 }}>Quick Add Student</div>
              <button type="button" style={btnDangerSmall()} onClick={() => setQuickAddOpen(false)}>Close</button>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <input
                placeholder="First name"
                value={quickFirstName}
                onChange={(e) => setQuickFirstName(e.target.value)}
                style={inp()}
              />
              <input
                placeholder="Last name"
                value={quickLastName}
                onChange={(e) => setQuickLastName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  quickCreateStudent();
                }}
                style={inp()}
              />
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 900 }}>
                <input
                  type="checkbox"
                  checked={quickCompetition}
                  onChange={(e) => setQuickCompetition(e.target.checked)}
                />
                Competition Team
              </label>
            </div>
            <button type="button" style={btn()} onClick={quickCreateStudent}>
              Create + Add as Camper
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function GroupColumn({
  title,
  onRemoveGroup,
  members,
  onDropMember,
  dragMemberId,
  setDragMemberId,
  onRoleChange,
  onSecondaryRoleChange,
  onSecondaryRoleDaysChange,
  onFactionChange,
  factions,
  onRemoveMember,
}: {
  title: string;
  onRemoveGroup?: () => void;
  members: Member[];
  onDropMember: (memberId: string) => void;
  dragMemberId: string | null;
  setDragMemberId: (v: string | null) => void;
  onRoleChange: (memberId: string, role: string) => void;
  onSecondaryRoleChange: (memberId: string, secondary: string) => void;
  onSecondaryRoleDaysChange: (memberId: string, dayKey: string, enabled: boolean) => void;
  onFactionChange: (memberId: string, factionId: string | null) => void;
  factions: Faction[];
  onRemoveMember: (memberId: string) => void;
}) {
  return (
    <div
      style={groupCol()}
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (dragMemberId) onDropMember(dragMemberId);
        setDragMemberId(null);
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ fontWeight: 1000, fontSize: 14 }}>{title}</div>
        {onRemoveGroup ? (
          <button type="button" onClick={onRemoveGroup} style={btnDangerSmall()}>
            Delete group
          </button>
        ) : null}
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {members.map((member) => (
          <div
            key={member.id}
            draggable
            onDragStart={() => setDragMemberId(member.id)}
            onDragEnd={() => setDragMemberId(null)}
            style={{ ...memberCard(), opacity: dragMemberId === member.id ? 0.55 : 1 }}
          >
            <div style={{ display: "grid", gap: 2 }}>
              <div style={{ fontWeight: 900 }}>{member.student?.name ?? member.student_id}</div>
              <div style={{ fontSize: 12, opacity: 0.72 }}>
                Lv {member.student?.level ?? 1} • {Number(member.student?.points_total ?? 0).toLocaleString()} pts
              </div>
            </div>
            <input
              value={member.display_role}
              onChange={(e) => onRoleChange(member.id, e.target.value)}
              style={{ ...inp(), padding: "6px 8px", fontSize: 12 }}
            />
            <select
              value={member.secondary_role ?? ""}
              onChange={(e) => onSecondaryRoleChange(member.id, e.target.value)}
              style={{ ...inp(), padding: "6px 8px", fontSize: 12 }}
            >
              <option value="">No 2nd role</option>
              <option value="cleaner">Cleaner</option>
              <option value="seller">Seller</option>
            </select>
            {member.secondary_role ? (
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {ROLE_DAY_OPTIONS.map((day) => {
                  const selected = (member.secondary_role_days ?? []).includes(day.key);
                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => onSecondaryRoleDaysChange(member.id, day.key, !selected)}
                      style={{
                        borderRadius: 999,
                        border: selected ? "1px solid rgba(56,189,248,0.72)" : "1px solid rgba(148,163,184,0.35)",
                        background: selected ? "rgba(14,165,233,0.25)" : "rgba(15,23,42,0.6)",
                        color: "white",
                        padding: "2px 7px",
                        fontSize: 11,
                        fontWeight: 900,
                        lineHeight: 1.2,
                      }}
                      title={selected ? "Role active on this day" : "Role inactive on this day"}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
            <select
              value={member.faction_id ?? ""}
              onChange={(e) => onFactionChange(member.id, e.target.value || null)}
              style={{ ...inp(), padding: "6px 8px", fontSize: 12 }}
            >
              <option value="">No faction</option>
              {factions.map((f) => (
                <option key={f.id} value={f.id}>{f.icon ?? "🏕️"} {f.name}</option>
              ))}
            </select>
            <button type="button" onClick={() => onRemoveMember(member.id)} style={btnDangerSmall()}>
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function inp(): React.CSSProperties {
  return {
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.35)",
    background: "rgba(2,6,23,0.6)",
    color: "white",
    padding: "10px 12px",
    minWidth: 180,
  };
}
function btn(): React.CSSProperties {
  return {
    borderRadius: 10,
    border: "1px solid rgba(56,189,248,0.45)",
    background: "rgba(14,165,233,0.2)",
    color: "white",
    padding: "8px 12px",
    fontWeight: 900,
  };
}
function btnGhost(): React.CSSProperties {
  return {
    borderRadius: 10,
    border: "1px solid rgba(125,211,252,0.35)",
    background: "rgba(15,23,42,0.48)",
    color: "white",
    padding: "8px 12px",
    fontWeight: 900,
    textDecoration: "none",
  };
}
function btnDanger(): React.CSSProperties {
  return {
    borderRadius: 10,
    border: "1px solid rgba(239,68,68,0.45)",
    background: "rgba(239,68,68,0.16)",
    color: "white",
    padding: "8px 12px",
    fontWeight: 900,
  };
}
function btnDangerSmall(): React.CSSProperties {
  return {
    borderRadius: 8,
    border: "1px solid rgba(239,68,68,0.45)",
    background: "rgba(239,68,68,0.16)",
    color: "white",
    padding: "6px 8px",
    fontWeight: 900,
    fontSize: 12,
  };
}
function pickBtn(): React.CSSProperties {
  return {
    borderRadius: 10,
    border: "1px solid rgba(125,211,252,0.4)",
    background: "rgba(2,132,199,0.18)",
    color: "white",
    padding: "8px 10px",
    display: "flex",
    justifyContent: "space-between",
  };
}
function card(): React.CSSProperties {
  return {
    borderRadius: 14,
    border: "1px solid rgba(125,211,252,0.26)",
    background: "rgba(2,6,23,0.6)",
    padding: 12,
    display: "grid",
    gap: 10,
  };
}
function notice(): React.CSSProperties {
  return {
    borderRadius: 10,
    padding: "8px 12px",
    border: "1px solid rgba(125,211,252,0.35)",
    background: "rgba(14,116,144,0.28)",
    fontWeight: 900,
  };
}
function secTitle(): React.CSSProperties {
  return { fontWeight: 1000, fontSize: 16 };
}
function chip(): React.CSSProperties {
  return {
    borderRadius: 999,
    border: "1px solid rgba(125,211,252,0.32)",
    background: "rgba(15,23,42,0.6)",
    color: "white",
    padding: "6px 12px",
    fontWeight: 900,
  };
}
function chipActive(): React.CSSProperties {
  return {
    ...chip(),
    border: "1px solid rgba(34,211,238,0.7)",
    background: "rgba(8,47,73,0.7)",
  };
}
function screenCard(): React.CSSProperties {
  return {
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.3)",
    background: "rgba(15,23,42,0.65)",
    padding: 10,
    display: "grid",
    gap: 8,
  };
}
function groupCol(): React.CSSProperties {
  return {
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.3)",
    background: "rgba(15,23,42,0.58)",
    padding: 10,
    display: "grid",
    gap: 8,
    alignContent: "start",
    minHeight: 220,
  };
}
function memberCard(): React.CSSProperties {
  return {
    borderRadius: 10,
    border: "1px solid rgba(125,211,252,0.35)",
    background: "rgba(2,6,23,0.6)",
    padding: 8,
    display: "grid",
    gap: 6,
    cursor: "grab",
  };
}

function overlay(): React.CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    background: "rgba(2,6,23,0.58)",
    display: "grid",
    placeItems: "center",
    zIndex: 60,
    padding: 12,
  };
}

function modalCard(): React.CSSProperties {
  return {
    width: "min(460px, 96vw)",
    borderRadius: 14,
    border: "1px solid rgba(125,211,252,0.35)",
    background: "rgba(2,6,23,0.95)",
    padding: 12,
    display: "grid",
    gap: 10,
  };
}

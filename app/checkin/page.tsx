"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CompetitionPrestigeFrame from "../../components/CompetitionPrestigeFrame";
import { supabaseClient } from "@/lib/supabase/client";

type ClassRow = { id: string; name: string; class_color?: string | null };
type StudentRow = {
  id: string;
  name: string;
  level: number;
  is_competition_team: boolean;
  age: number | null;
  rank: string | null;
  checkin_count?: number;
};
type RosterItem = {
  id: string;
  name: string;
  is_competition_team: boolean;
  checkin_id?: string;
};
type ScheduleCard = {
  id: string;
  schedule_entry_id?: string | null;
  class_id: string;
  name: string;
  time: string;
  instructors: string[];
  image_url?: string | null;
  pass_names?: string[];
  class_color?: string | null;
  entry_type?: string | null;
};
type ScheduleEntry = {
  id: string;
  schedule_entry_id?: string | null;
  class_id: string;
  session_date?: string | null;
  start_time: string;
  end_time?: string | null;
  instructor_name?: string | null;
  class_name?: string | null;
  location_name?: string | null;
  entry_type?: string | null;
};

function toLocalDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        borderRadius: 18,
        padding: 14,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <div style={{ fontWeight: 950, marginBottom: 10, fontSize: 16 }}>{title}</div>
      {children}
    </div>
  );
}

export default function CheckinPage() {
  const [studentBlocked, setStudentBlocked] = useState(false);
  const [adminBlocked, setAdminBlocked] = useState(false);
  const [viewerRole, setViewerRole] = useState("student");
  const isAdmin = viewerRole === "admin";
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [instanceId, setInstanceId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState("");
  const [query, setQuery] = useState<string>("");
  const [results, setResults] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [msg, setMsg] = useState<string>("");
  const [okMsg, setOkMsg] = useState<string>("");
  const [lastCheckin, setLastCheckin] = useState<{ name: string; className: string; instanceId: string } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [classCounts, setClassCounts] = useState<Record<string, number>>({});
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [roster, setRoster] = useState<RosterItem[]>([]);
  const [giftCountsByStudent, setGiftCountsByStudent] = useState<Record<string, number>>({});
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(true);
  const rosterRequestId = useRef(0);
  const latestInstanceIdRef = useRef("");
  const activeRosterCount = useMemo(() => {
    const uniqueIds = new Set(roster.map((r) => String(r.id ?? "")).filter(Boolean));
    return uniqueIds.size;
  }, [roster]);
  const giftLookupIds = useMemo(() => {
    const ids = new Set<string>();
    roster.forEach((r) => {
      const id = String(r.id ?? "").trim();
      if (id) ids.add(id);
    });
    results.forEach((r) => {
      const id = String(r.id ?? "").trim();
      if (id) ids.add(id);
    });
    return Array.from(ids);
  }, [roster, results]);
  const [passAccess, setPassAccess] = useState<Record<string, string[]>>({});
  const scheduleOverrides: Record<string, Omit<ScheduleCard, "id" | "name">> = {
    class_a: { class_id: "class_a", time: "4:30 PM", instructors: ["Coach Mia"] },
    class_b: { class_id: "class_b", time: "6:00 PM", instructors: ["Coach Leo"] },
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json();
        if (data?.ok) setViewerRole(String(data?.role ?? "student"));
        if (data?.ok && data?.role === "student") setStudentBlocked(true);
        if (data?.ok && !["admin", "classroom"].includes(String(data?.role ?? ""))) setAdminBlocked(true);
      } catch {}
    })();
  }, []);

  const blockedView = studentBlocked ? (
    <main style={{ padding: 18, paddingTop: 28 }}>
      <div style={{ fontSize: 22, fontWeight: 900 }}>Check-in is coach-only.</div>
      <div style={{ opacity: 0.7, marginTop: 6 }}>Student accounts cannot access this page.</div>
    </main>
  ) : adminBlocked ? (
    <main style={{ padding: 18, paddingTop: 28 }}>
      <div style={{ fontSize: 22, fontWeight: 900 }}>Check-in is admin-only.</div>
      <div style={{ opacity: 0.7, marginTop: 6 }}>Admin or classroom accounts can access check-in.</div>
    </main>
  ) : null;

  // Load classes
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/classes/list", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) {
          setMsg(data?.error || "Failed to load classes");
          return;
        }
        const list: ClassRow[] = data.classes ?? [];
        setClasses(list);
      } catch (e: any) {
        setMsg(e?.message || "Failed to load classes");
      }
    })();
  }, []);

  const loadScheduleForDate = async (date: string) => {
    try {
      const res = await fetch(`/api/schedule/list?date=${date}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        const entries = (data.entries ?? []) as ScheduleEntry[];
        const cleaned = entries.filter((e) => {
          const id = String(e.id ?? "").trim();
          return id && id !== "null" && id !== "undefined";
        });
        setScheduleEntries(cleaned);
        setInstanceId("");
        setRoster([]);
        setClassCounts({});
      }
    } catch {}
  };

  useEffect(() => {
    if (!selectedDate) return;
    setClassCounts({});
    loadScheduleForDate(selectedDate);
  }, [selectedDate]);
  useEffect(() => {
    if (selectedDate) return;
    (async () => {
      try {
        const res = await fetch("/api/class-sessions/today", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        const today = String(data?.today ?? "").trim();
        if (today) return setSelectedDate(today);
      } catch {}
      setSelectedDate(toLocalDateKey(new Date()));
    })();
  }, [selectedDate]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/classes/pass-access", { cache: "no-store" });
        const data = await res.json();
        if (res.ok) setPassAccess((data.access ?? {}) as Record<string, string[]>);
      } catch {}
    })();
  }, []);

  // Debounced search
  useEffect(() => {
    setMsg("");
    if (query.trim()) setOkMsg("");

    const q = query.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }

    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/students/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q }),
        });
        const data = await res.json();
        if (!res.ok) {
          setMsg(data?.error || "Search failed");
          setResults([]);
          return;
        }
        setResults(data.students ?? []);
      } catch (e: any) {
        setMsg(e?.message || "Search failed");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [query]);

  const displayClasses = useMemo(() => classes, [classes]);
  const scheduleCards = useMemo(() => {
    return [...scheduleEntries]
      .sort((a, b) => timeSort(a.start_time, b.start_time))
      .map((entry) => {
        const className = entry.class_name || displayClasses.find((c) => c.id === entry.class_id)?.name || "Class";
        const classColor = displayClasses.find((c) => c.id === entry.class_id)?.class_color ?? null;
        const base = scheduleOverrides[entry.class_id] ?? scheduleOverrides[className.toLowerCase()] ?? null;
        return {
          id: entry.id,
          schedule_entry_id: entry.schedule_entry_id ?? null,
          class_id: entry.class_id,
          name: className,
          time: entry.start_time ? formatTime(entry.start_time) : base?.time ?? "TBD",
          instructors: entry.instructor_name ? [entry.instructor_name] : base?.instructors ?? ["Coach Kai"],
          image_url: base?.image_url ?? null,
          pass_names: passAccess[entry.class_id] ?? [],
          class_color: classColor,
          entry_type: entry.entry_type ?? null,
        } as ScheduleCard;
      });
  }, [displayClasses, scheduleEntries, passAccess]);
  const selectedEntry = useMemo(
    () => scheduleEntries.find((entry) => entry.id === instanceId),
    [scheduleEntries, instanceId]
  );
  const selectedClassName = useMemo(() => {
    return (
      selectedEntry?.class_name ||
      displayClasses.find((c) => c.id === selectedEntry?.class_id)?.name ||
      ""
    );
  }, [displayClasses, selectedEntry]);
  const activeClassColor = useMemo(() => {
    const match = scheduleCards.find((c) => c.id === instanceId) ?? scheduleCards[0];
    return match?.class_color ?? "#2563eb";
  }, [instanceId, scheduleCards]);

  useEffect(() => {
    if (!scheduleEntries.length) return;
    const validIds = scheduleEntries.map((entry) => String(entry.id ?? "").trim()).filter((id) => id && id !== "null" && id !== "undefined");
    if (!validIds.length) return;
    if (!instanceId || !validIds.includes(instanceId)) {
      setInstanceId(validIds[0]);
    }
  }, [instanceId, scheduleEntries]);

  useEffect(() => {
    if (!displayClasses.length) return;
    (async () => {
      try {
        const res = await fetch(`/api/classroom/counts?date=${selectedDate}`, { cache: "no-store" });
        const data = await res.json();
        if (res.ok) {
          setClassCounts((data.counts_by_instance ?? {}) as Record<string, number>);
        }
      } catch {}
    })();
  }, [displayClasses, selectedDate]);

  useEffect(() => {
    if (!instanceId) return;
    latestInstanceIdRef.current = instanceId;
    setRoster([]);
    setRosterLoading(true);
    loadRoster(instanceId);
  }, [instanceId]);

  useEffect(() => {
    if (!giftLookupIds.length) {
      setGiftCountsByStudent({});
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/student/gifts/pending-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_ids: giftLookupIds }),
      });
      const sj = await res.json().catch(() => ({}));
      if (!cancelled && res.ok) setGiftCountsByStudent((sj?.counts ?? {}) as Record<string, number>);
    })();
    return () => {
      cancelled = true;
    };
  }, [giftLookupIds]);
  useEffect(() => {
    setQuery("");
    setResults([]);
    setMsg("");
  }, [instanceId]);
  useEffect(() => {
    if (!instanceId) return;
    const supabase = supabaseClient();
    const channel = supabase
      .channel(`checkin-roster-${instanceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_checkins", filter: `instance_id=eq.${instanceId}` },
        () => {
          loadRoster(instanceId);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [instanceId]);

  async function loadRoster(selectedInstanceId: string) {
    const requestId = (rosterRequestId.current += 1);
    setRosterLoading(true);
    try {
      const res = await fetch("/api/classroom/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instance_id: selectedInstanceId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      if (requestId !== rosterRequestId.current || selectedInstanceId !== latestInstanceIdRef.current) return;
      const rows = (data.roster ?? []) as any[];
      const items = rows.map((r) => ({
        id: r.student?.id ?? r.student_id ?? r.checkin_id ?? String(Math.random()),
        name: r.student?.name ?? r.student_name ?? "Student",
        is_competition_team: !!r.student?.is_competition_team,
        checkin_id: r.checkin_id ?? undefined,
      }));
      setRoster(items);
      const uniqueIds = new Set(items.map((r) => String(r.id ?? "")).filter(Boolean));
      setClassCounts((prev) => ({ ...prev, [selectedInstanceId]: uniqueIds.size }));
    } catch {}
    finally {
      if (requestId === rosterRequestId.current && selectedInstanceId === latestInstanceIdRef.current) {
        setRosterLoading(false);
      }
    }
  }

  async function checkIn(student: StudentRow) {
    setMsg("");
    setOkMsg("");

    if (!instanceId) {
      setMsg("Please select a class first.");
      return;
    }
    if (!student?.id || student.id === "null" || student.id === "undefined") {
      setMsg("Student record is missing an ID. Please refresh and try again.");
      return;
    }

    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instance_id: instanceId, student_id: student.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        const debug = data?.debug ? ` (${JSON.stringify(data.debug)})` : "";
        setMsg(`${data?.error || "Check-in failed"}${debug}`);
        return;
      }

      setOkMsg(`✅ ${student.name} checked in to ${selectedClassName || "class"}.`);
      setLastCheckin({ name: student.name, className: selectedClassName || "class", instanceId });
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setLastCheckin(null), 1800);
      setQuery("");
      setResults([]);
      setLoading(false);
      loadRoster(instanceId);
      try {
      const countsRes = await fetch(`/api/classroom/counts?date=${selectedDate}`, { cache: "no-store" });
        const countsData = await countsRes.json().catch(() => ({}));
        if (countsRes.ok) {
          setClassCounts((countsData.counts_by_instance ?? {}) as Record<string, number>);
        }
      } catch {}
    } catch (e: any) {
      setMsg(e?.message || "Check-in failed");
    }
  }

  return (
    <main style={{ padding: 18, paddingTop: 28 }}>
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 18, alignItems: "start" }}>
      <div
        style={{
          position: "sticky",
          top: 18,
          display: "grid",
          gap: 10,
          padding: 12,
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(5,7,11,0.92)",
          boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
          maxHeight: "calc(100vh - 36px)",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 1000, fontSize: 13 }}>Current roster</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => instanceId && loadRoster(instanceId)} style={btnGhost()}>
              Refresh
            </button>
            <button onClick={() => setRosterOpen((v) => !v)} style={btnGhost()}>
              {rosterOpen ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        <div style={{ opacity: 0.7, fontSize: 11 }}>
          {selectedClassName ? selectedClassName : "Select a class"}
        </div>
        {rosterOpen ? (
          <div style={{ display: "grid", gap: 20, overflowY: "auto", paddingRight: 4 }}>
            {rosterLoading ? (
              <div style={{ opacity: 0.7, fontSize: 12 }}>Loading roster…</div>
            ) : !roster.length ? (
              <div style={{ opacity: 0.7, fontSize: 12 }}>No students checked in yet.</div>
            ) : null}
            {roster.map((s) => (
              <div key={s.id} style={rosterPill(s.is_competition_team, activeClassColor)}>
                {s.is_competition_team ? (
                  <img
                    src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/badges/prestige/compteam.png`}
                    alt="Comp team"
                    style={{ width: 14, height: 14, objectFit: "contain" }}
                  />
                ) : null}
                <span>{s.name}</span>
                {(giftCountsByStudent[String(s.id)] ?? 0) > 0 ? <span style={giftPing()}>🎁</span> : null}
                {isAdmin && s.checkin_id ? (
                  <span style={{ marginLeft: "auto", fontSize: 10, opacity: 0.6 }}>#{shortId(s.checkin_id)}</span>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div style={{ display: "grid", gap: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <div style={{ fontSize: 30, fontWeight: 1000 }}>Check-in</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => setSelectedDate((d) => shiftDate(d, -1))} style={btnGhost()}>
              ←
            </button>
            <div
              style={{
                fontWeight: 1000,
                fontSize: 20,
                padding: "6px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.08)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
              }}
            >
              {formatDateLabel(selectedDate)}
            </div>
            <button onClick={() => setSelectedDate((d) => shiftDate(d, 1))} style={btnGhost()}>
              →
            </button>
            <button onClick={() => setSelectedDate(toLocalDateKey(new Date()))} style={btnGhost()}>
              Today
            </button>
          </div>
          <a href="/admin/schedule" style={adminLink()}>
            Schedule
          </a>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontWeight: 1000, fontSize: 16, opacity: 0.9 }}>Select a class</div>
            <button onClick={() => loadScheduleForDate(selectedDate)} style={btnGhost()}>
              Refresh
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            {scheduleCards.map((c) => {
              const isActive = c.id === instanceId;
              const count = c.id === instanceId ? activeRosterCount : classCounts[c.id] ?? 0;
              const classColor = c.class_color ?? "#2563eb";
            const typeLabel = String(c.entry_type ?? "Class").toUpperCase();
              return (
                <button
                  key={c.id}
                  onClick={() => setInstanceId(c.id)}
                style={{
                  textAlign: "left",
                  borderRadius: 20,
                  padding: 14,
                  userSelect: "text",
                  WebkitUserSelect: "text",
                  border: isActive ? `1px solid ${withAlpha(classColor, 0.6)}` : "1px solid rgba(255,255,255,0.12)",
                  background: isActive
                    ? `linear-gradient(135deg, ${withAlpha(classColor, 0.35)}, rgba(15,23,42,0.92))`
                    : `linear-gradient(135deg, ${withAlpha(classColor, 0.18)}, rgba(255,255,255,0.04))`,
                  boxShadow:
                    lastCheckin?.instanceId === c.id
                      ? "0 0 0 2px rgba(34,197,94,0.55), 0 0 40px rgba(34,197,94,0.30)"
                      : isActive
                      ? `0 16px 50px ${withAlpha(classColor, 0.35)}`
                      : "0 14px 40px rgba(0,0,0,0.28)",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "96px 1fr", gap: 12, alignItems: "center" }}>
                  <div
                    style={{
                      width: 96,
                      height: 96,
                      borderRadius: 14,
                      border: `1px solid ${withAlpha(classColor, 0.35)}`,
                      background: c.image_url
                        ? `url(${c.image_url}) center/cover no-repeat`
                        : `linear-gradient(135deg, ${withAlpha(classColor, 0.45)}, rgba(15,23,42,0.92))`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 1000,
                      fontSize: 11,
                      letterSpacing: 0.4,
                      textTransform: "uppercase",
                    }}
                  >
                    {!c.image_url ? "Class" : null}
                  </div>

                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontWeight: 1000, fontSize: 16, letterSpacing: 1 }}>{typeLabel}</div>
                    <div style={{ fontSize: 20, fontWeight: 1000 }}>{c.time}</div>
                    <div style={{ fontWeight: 1000, fontSize: 16 }}>{c.name}</div>
                    <div style={{ opacity: 0.8, fontSize: 12 }}>{c.instructors.join(", ")}</div>
                    {c.pass_names?.length ? (
                      <div style={{ fontWeight: 900, fontSize: 11, opacity: 0.85 }}>
                        Pass required: {c.pass_names.join(", ")}
                      </div>
                    ) : null}
                    {isAdmin ? (
                      <div style={{ fontSize: 11, opacity: 0.7 }}>
                        ID #{shortId(c.id)} {c.schedule_entry_id ? `• Schedule ${shortId(c.schedule_entry_id)}` : ""}
                      </div>
                    ) : null}
                    <div style={{ fontWeight: 1000, fontSize: 12 }}>{count} checked in</div>
                    {lastCheckin?.instanceId === c.id ? (
                      <div style={{ fontWeight: 1000, fontSize: 11, color: "#22c55e" }}>Checked in</div>
                    ) : null}
                  </div>
                </div>

                {isActive ? (
                  <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                    <div style={{ opacity: 0.8, fontSize: 12 }}>
                      Scan NFC or type a student name.
                    </div>
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        if (results.length === 1) {
                          e.preventDefault();
                          checkIn(results[0]);
                        }
                      }}
                      placeholder='Type a name (ex: "Evalina")'
                      style={bigInput()}
                    />
                    <div style={{ opacity: 0.8, fontSize: 12 }}>
                      {loading ? "Searching…" : results.length ? `${results.length} suggestion(s)` : "Waiting for input."}
                    </div>
                  </div>
                ) : null}
              </button>
            );
          })}
          {!scheduleCards.length && (
            <div style={{ opacity: 0.7 }}>
              No classes yet. Add classes and schedule entries in <b>Schedule</b>.
            </div>
          )}
        </div>
      </div>

      {msg && (
        <div
          style={{
            padding: 10,
            borderRadius: 14,
            background: "rgba(239,68,68,0.15)",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          {msg}
        </div>
      )}

      {okMsg && lastCheckin && (
        <div
          style={{
            position: "fixed",
            left: 16,
            right: 16,
            top: 86,
            zIndex: 60,
            padding: 12,
            borderRadius: 16,
            background: "rgba(34,197,94,0.16)",
            border: "1px solid rgba(255,255,255,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
            boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
          }}
        >
          <div>{`${lastCheckin.name} checked in to ${lastCheckin.className}.`}</div>
          <a href="/classroom" style={linkBtn()}>
            Go to Classroom →
          </a>
        </div>
      )}

      {okMsg && lastCheckin ? (
        <div
          style={{
            position: "fixed",
            left: 16,
            right: 16,
            bottom: 20,
            zIndex: 60,
            padding: "8px 12px",
            borderRadius: 999,
            background: "rgba(15,23,42,0.82)",
            border: "1px solid rgba(255,255,255,0.16)",
            fontSize: 12,
            textAlign: "center",
          }}
        >
          {`Checked in: ${lastCheckin.name} → ${lastCheckin.className}`}
        </div>
      ) : null}

      {(query.trim() || results.length) && (
        <div
          style={{
            position: "fixed",
            left: 16,
            right: 16,
            bottom: 16,
            zIndex: 50,
            borderRadius: 20,
            padding: 14,
            border: "1px solid rgba(255,255,255,0.16)",
            background: "rgba(5,7,11,0.92)",
            boxShadow: "0 18px 70px rgba(0,0,0,0.45)",
            maxHeight: "45vh",
            overflowY: "auto",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <div style={{ fontWeight: 1000 }}>Suggestions</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>
              {loading ? "Searching…" : results.length ? `${results.length} found` : "No matches yet"}
            </div>
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            {!results.length && (
              <div style={{ opacity: 0.75 }}>
                Tip: If you don’t see someone, it means they aren’t in the <code>students</code> table yet.
              </div>
            )}

            {results.map((s) => {
              const isComp = !!s.is_competition_team;
              return (
                <CompetitionPrestigeFrame key={s.id} show={isComp} masterStars={Number(s.level ?? 0)}>
                  <div
                    style={{
                      padding: "12px 12px",
                      borderRadius: 18,
                      border: `1px solid ${withAlpha(activeClassColor, 0.35)}`,
                      background: `linear-gradient(135deg, ${withAlpha(activeClassColor, 0.18)}, rgba(0,0,0,0.22))`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {isComp ? <span style={{ fontSize: 18 }}>⭐</span> : <span style={{ width: 18 }} />}
                      <div>
                        <div style={{ fontWeight: 950, fontSize: 16 }}>{s.name}</div>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>
                        Level {s.level}
                        {s.age ? ` • Age ${s.age}` : ""}
                        {s.rank ? ` • ${s.rank}` : ""}
                        {typeof s.checkin_count === "number" ? ` • Check-ins ${s.checkin_count}` : ""}
                      </div>
                      </div>
                      {(giftCountsByStudent[String(s.id)] ?? 0) > 0 ? <span style={giftPing()}>🎁</span> : null}
                    </div>

                    <button onClick={() => checkIn(s)} style={btnPrimary()}>
                      Check In
                    </button>
                  </div>
                </CompetitionPrestigeFrame>
              );
            })}
          </div>
        </div>
      )}

      </div>
      </div>
    </main>
  );
}

function inp(): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.24)",
    color: "white",
    outline: "none",
  };
}

function bigInput(): React.CSSProperties {
  return {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.20)",
    background: "rgba(0,0,0,0.32)",
    color: "white",
    outline: "none",
    fontSize: 18,
    fontWeight: 900,
  };
}

function rosterPill(isComp: boolean, classColor: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 12,
    border: `1px solid ${withAlpha(classColor, 0.28)}`,
    background: isComp
      ? `linear-gradient(135deg, ${withAlpha(classColor, 0.3)}, rgba(15,23,42,0.75))`
      : `linear-gradient(135deg, ${withAlpha(classColor, 0.18)}, rgba(255,255,255,0.06))`,
    color: "white",
    fontSize: 12,
    fontWeight: 900,
  };
}

function giftPing(): React.CSSProperties {
  return {
    fontSize: 16,
    lineHeight: 1,
    marginLeft: 4,
    filter: "drop-shadow(0 0 8px rgba(250,204,21,0.7))",
  };
}

function withAlpha(hex: string, alpha: number) {
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6) return `rgba(37,99,235,${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function btnGhost(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  };
}

function formatTime(input: string) {
  const parts = String(input ?? "").split(":").map(Number);
  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return input;
  const h = parts[0];
  const m = parts[1];
  const suffix = h >= 12 ? "PM" : "AM";
  const hr = ((h + 11) % 12) + 1;
  return `${hr}:${String(m).padStart(2, "0")} ${suffix}`;
}

function shiftDate(value: string, deltaDays: number) {
  const base = new Date(`${value}T00:00:00`);
  if (Number.isNaN(base.getTime())) return value;
  base.setDate(base.getDate() + deltaDays);
  return base.toISOString().slice(0, 10);
}

function formatDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function shortId(value?: string | null) {
  const v = String(value ?? "").trim();
  if (v.length <= 8) return v || "—";
  return v.slice(0, 4) + "…" + v.slice(-4);
}

function timeSort(a: string, b: string) {
  const toMin = (v: string) => {
    const parts = String(v ?? "").split(":").map(Number);
    if (parts.length < 2) return 0;
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  };
  return toMin(a) - toMin(b);
}

function adminLink(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.04)",
    color: "white",
    fontWeight: 900,
    fontSize: 11,
    textDecoration: "none",
    opacity: 0.5,
  };
}

function btnPrimary(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "linear-gradient(90deg, rgba(59,130,246,0.85), rgba(34,197,94,0.70))",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

function linkBtn(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.22)",
    color: "white",
    fontWeight: 950,
    textDecoration: "none",
  };
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import StudentTopBar from "@/components/StudentTopBar";
import CriticalNoticeBar from "@/components/CriticalNoticeBar";
import { fireFx } from "@/components/GlobalFx";
import { playGlobalSfx, setGlobalSounds } from "@/lib/globalAudio";

type SkillRow = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  level: number;
  points: number | null;
  enabled: boolean;
  set_id: string | null;
  set_name: string | null;
  sort_in_level: number | null; // from alias sort_order
};

type StudentTopBarRow = {
  id: string;
  name: string;
  level: number;
  points_total: number;
  is_competition_team: boolean;
  avatar_storage_path?: string | null;
};

type CompletedRow = { skill_id: string; completed_at: string | null };

type Box = { id: string; x: number; y: number; w: number; h: number };
type LevelBox = { id: string; x: number; y: number; w: number; h: number };

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 180)}` } };
  }
}

function chunkSnake<T>(arr: T[], perRow: number) {
  const rows: T[][] = [];
  for (let i = 0; i < arr.length; i += perRow) {
    const row = arr.slice(i, i + perRow);
    rows.push(row);
  }
  return rows;
}

function skillTopBar(): React.CSSProperties {
  return {
    marginTop: 12,
    display: "flex",
    gap: 12,
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    borderRadius: 18,
    padding: "10px 12px",
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
  };
}

function skillSelect(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.28)",
    color: "white",
    fontWeight: 900,
    outline: "none",
  };
}

function skillSearchInput(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.28)",
    color: "white",
    fontWeight: 800,
    outline: "none",
    minWidth: 220,
  };
}

function skillSearchButton(active: boolean): React.CSSProperties {
  return {
    padding: "9px 12px",
    borderRadius: 12,
    border: active ? "1px solid rgba(59,130,246,0.6)" : "1px solid rgba(255,255,255,0.14)",
    background: active ? "rgba(59,130,246,0.22)" : "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function filterPill(active: boolean): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 999,
    border: active ? "1px solid rgba(34,197,94,0.5)" : "1px solid rgba(255,255,255,0.14)",
    background: active ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
  };
}

function pointsStat(): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.25)",
    textAlign: "right",
    minWidth: 160,
  };
}

export default function SkillsPage() {
  const isEmbed = useSearchParams().get("embed") === "1";
  const [msg, setMsg] = useState("");

  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [category, setCategory] = useState("All");
  const [setFilter, setSetFilter] = useState<"all" | "completed" | "not_completed" | "almost">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilter, setSearchFilter] = useState("");

  const [students, setStudents] = useState<StudentTopBarRow[]>([]);
  const [studentId, setStudentId] = useState<string>("");
  const [viewerRole, setViewerRole] = useState("coach");
  const [viewerStudentId, setViewerStudentId] = useState("");

  const [completed, setCompleted] = useState<CompletedRow[]>([]);
  const [pendingComplete, setPendingComplete] = useState<Record<string, boolean>>({});

  // arrows measurement per set
  const setRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [boxesBySet, setBoxesBySet] = useState<Record<string, Record<string, Box>>>({});
  const [levelBoxesBySet, setLevelBoxesBySet] = useState<Record<string, Record<string, LevelBox>>>({});

  const completedSet = useMemo(() => new Set(completed.map((r) => r.skill_id)), [completed]);

  async function refreshStudents(preserveSelected = true) {
    const r = await fetch("/api/students/list", { cache: "no-store" });
    const sj = await safeJson(r);
    if (!sj.ok) {
      setMsg(sj.json?.error || "Failed to load students");
      return;
    }
    const list = (sj.json?.students ?? []) as StudentTopBarRow[];
    setStudents(list);

    if (!preserveSelected) return;

    setStudentId((prev) => {
      if (viewerRole === "student" && viewerStudentId) {
        if (list.some((s) => s.id === viewerStudentId)) return viewerStudentId;
      }
      if (prev && list.some((s) => s.id === prev)) return prev;
      // try remembered
      const saved = (() => {
        try {
          return localStorage.getItem("active_student_id") || "";
        } catch {
          return "";
        }
      })();
      if (saved && list.some((s) => s.id === saved)) return saved;
      return list[0]?.id || "";
    });
  }

  useEffect(() => {
    refreshStudents(true);
  }, [viewerRole]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await safeJson(res);
      if (!data.ok) return;
      setViewerRole(String(data.json?.role ?? "coach"));
      setViewerStudentId(String(data.json?.student_id ?? ""));
    })();
  }, []);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== "active_student_id") return;
      if (viewerRole === "student") return;
      const next = String(e.newValue ?? "").trim();
      if (!next) return;
      setStudentId(next);
    }
    function onActive(e: Event) {
      if (viewerRole === "student") return;
      const ev = e as CustomEvent<{ student_id?: string }>;
      const next = String(ev.detail?.student_id ?? "").trim();
      if (!next) return;
      setStudentId(next);
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener("active-student-changed", onActive as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("active-student-changed", onActive as EventListener);
    };
  }, []);

  useEffect(() => {
    (async () => {
      const sfxRes = await fetch("/api/sound-effects/list", { cache: "no-store" });
      const sfxJson = await safeJson(sfxRes);
      if (sfxJson.ok) {
        const map: Record<string, { url: string; volume: number }> = {};
        (sfxJson.json?.effects ?? []).forEach((row: any) => {
          const key = String(row?.key ?? "");
          const url = String(row?.audio_url ?? "");
          if (!key || !url) return;
          map[key] = { url, volume: Math.min(1, Math.max(0, Number(row?.volume ?? 1))) };
        });
        setGlobalSounds(map);
      }
      setMsg("");
      const r = await fetch("/api/skills/list", { cache: "no-store" });
      const sj = await safeJson(r);
      if (!sj.ok) return setMsg(sj.json?.error || "Failed to load skills");
      setSkills((sj.json?.skills ?? []) as SkillRow[]);
    })();
  }, []);

  async function refreshProgress(sid: string) {
    const r = await fetch("/api/skills/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: sid }),
    });
    const sj = await safeJson(r);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to load progress");
    setCompleted((sj.json?.completed ?? []) as CompletedRow[]);
  }

  async function addOrRemovePoints(delta: number) {
    if (!studentId) return;
    if (viewerRole === "student" || viewerRole === "classroom") return setMsg("View-only access.");
    setMsg("");

    const res = await fetch("/api/ledger/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id: studentId,
        points: delta,
        note: `Skills quick ${delta > 0 ? "+" : ""}${delta}`,
        category: "manual",
      }),
    });

    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to update points");

    fireFx(delta > 0 ? "add" : "remove");
    if (delta > 0) playGlobalSfx("points_add");
    await refreshStudents(true);
  }

  useEffect(() => {
    if (!studentId) return;
    try {
      localStorage.setItem("active_student_id", studentId);
    } catch {}
    refreshProgress(studentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    skills.forEach((s) => set.add(s.category));
    return ["All", ...Array.from(set).sort()];
  }, [skills]);

  const skillsFiltered = useMemo(() => {
    if (category === "All") return skills.filter((s) => s.enabled);
    return skills.filter((s) => s.enabled && s.category === category);
  }, [skills, category]);

  // group by set
  const sets = useMemo(() => {
    const map = new Map<string, SkillRow[]>();
    for (const n of skillsFiltered) {
      const key = (n.set_name || n.set_id || "Unsorted") as string;
      map.set(key, [...(map.get(key) ?? []), n]);
    }

    const list = Array.from(map.entries()).map(([setName, nodes]) => {
      const levelMap = new Map<number, SkillRow[]>();
      nodes.forEach((n) => levelMap.set(n.level, [...(levelMap.get(n.level) ?? []), n]));

      const levels = Array.from(levelMap.keys())
        .sort((a, b) => a - b)
        .map((lvl) => {
          const arr = (levelMap.get(lvl) ?? []).slice().sort((a, b) => {
            const ao = Number(a.sort_in_level ?? 0);
            const bo = Number(b.sort_in_level ?? 0);
            if (ao !== bo) return ao - bo;
            return String(a.name).localeCompare(String(b.name));
          });
          return { level: lvl, nodes: arr };
        });

      const allIds = nodes.map((n) => n.id);
      const isSetComplete = allIds.length > 0 && allIds.every((id) => completedSet.has(id));
      const remainingLevels = levels.filter((lvl) => !lvl.nodes.every((n) => completedSet.has(n.id))).length;
      const isAlmostComplete = !isSetComplete && remainingLevels <= 2;
      return { setName, nodes, levels, isSetComplete, remainingLevels, isAlmostComplete };
    });

    return list.sort((a, b) => a.setName.localeCompare(b.setName));
  }, [skillsFiltered, completedSet]);

  const filteredSets = useMemo(() => {
    let next = sets;
    if (setFilter === "completed") next = next.filter((s) => s.isSetComplete);
    if (setFilter === "not_completed") next = next.filter((s) => !s.isSetComplete);
    if (setFilter === "almost") next = next.filter((s) => s.isAlmostComplete);
    const q = searchFilter.trim().toLowerCase();
    if (!q) return next;
    return next.filter((s) => {
      if (s.setName.toLowerCase().includes(q)) return true;
      return s.nodes.some((n) => String(n.name ?? "").toLowerCase().includes(q));
    });
  }, [sets, setFilter, searchFilter]);

  const setCounts = useMemo(() => {
    const completedCount = sets.filter((s) => s.isSetComplete).length;
    const almostCount = sets.filter((s) => s.isAlmostComplete).length;
    const notCompletedCount = Math.max(0, sets.length - completedCount);
    return { completedCount, almostCount, notCompletedCount };
  }, [sets]);

  const pointsEarned = useMemo(() => {
    return skills.reduce((sum, s) => {
      if (!completedSet.has(s.id)) return sum;
      return sum + Number(s.points ?? 0);
    }, 0);
  }, [skills, completedSet]);

  // prereqs determined by level: must complete all skills from previous existing level in set
  function canComplete(node: SkillRow, setName: string) {
    const set = sets.find((s) => s.setName === setName);
    if (!set) return true;

    const prevLevels = set.nodes.map((n) => n.level).filter((lvl) => lvl < node.level);
    const prevLevel = prevLevels.length ? Math.max(...prevLevels) : null;
    if (prevLevel == null) return true;

    const prevNodes = set.nodes.filter((n) => n.level === prevLevel);
    return prevNodes.every((n) => completedSet.has(n.id));
  }

  async function doComplete(node: SkillRow, setName: string) {
    if (!studentId) return;
    if (viewerRole === "student" || viewerRole === "classroom") return setMsg("View-only access.");
    if (completedSet.has(node.id)) return;
    if (!canComplete(node, setName)) return;
    if (pendingComplete[node.id]) return;

    setMsg("");
    setPendingComplete((prev) => ({ ...prev, [node.id]: true }));
    try {
      const r = await fetch("/api/skills/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId, skill_id: node.id }),
      });
      const sj = await safeJson(r);
      if (!sj.ok) return setMsg(sj.json?.error || "Failed to complete skill");

      if (!sj.json?.already) {
        fireFx("add");
      }
      await refreshProgress(studentId);
      await refreshStudents(true); // ✅ realtime points update
      try {
        localStorage.setItem("students_refresh_ts", String(Date.now()));
        window.dispatchEvent(new CustomEvent("students-refresh"));
      } catch {}
    } finally {
      setPendingComplete((prev) => ({ ...prev, [node.id]: false }));
    }
  }

  async function doUncheck(node: SkillRow) {
    if (!studentId) return;
    if (viewerRole === "student" || viewerRole === "classroom") return setMsg("View-only access.");
    if (!completedSet.has(node.id)) return;

    // Let SERVER compute downstream + points removal.
    const ok = window.confirm(`Uncheck "${node.name}"?\n\nThis will also uncheck downstream skills in the same set and remove points.\n\nContinue?`);
    if (!ok) return;

    setMsg("");
    const r = await fetch("/api/skills/uncheck", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId, skill_id: node.id }),
    });
    const sj = await safeJson(r);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to uncheck");

    fireFx("remove");
    await refreshProgress(studentId);
    await refreshStudents(true); // ✅ realtime points update
    try {
      localStorage.setItem("students_refresh_ts", String(Date.now()));
      window.dispatchEvent(new CustomEvent("students-refresh"));
    } catch {}
  }

  // Measure per set for arrows
  useEffect(() => {
    const observers: ResizeObserver[] = [];
    const removeScroll: Array<() => void> = [];

    const measureSet = (setName: string) => {
      const el = setRefs.current[setName];
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const nextBoxes: Record<string, Box> = {};
      const nextLevels: Record<string, LevelBox> = {};
      const cards = el.querySelectorAll<HTMLElement>("[data-skill-id]");
      const levels = el.querySelectorAll<HTMLElement>("[data-level-id]");

      cards.forEach((c) => {
        const id = c.dataset.skillId!;
        const r = c.getBoundingClientRect();
        nextBoxes[id] = { id, x: r.left - rect.left, y: r.top - rect.top, w: r.width, h: r.height };
      });

      levels.forEach((c) => {
        const id = c.dataset.levelId!;
        const r = c.getBoundingClientRect();
        nextLevels[id] = { id, x: r.left - rect.left, y: r.top - rect.top, w: r.width, h: r.height };
      });

      setBoxesBySet((prev) => ({ ...prev, [setName]: nextBoxes }));
      setLevelBoxesBySet((prev) => ({ ...prev, [setName]: nextLevels }));
    };

    sets.forEach((s) => measureSet(s.setName));

    sets.forEach((s) => {
      const el = setRefs.current[s.setName];
      if (!el) return;

      const ro = new ResizeObserver(() => measureSet(s.setName));
      ro.observe(el);
      observers.push(ro);

      const onScroll = () => measureSet(s.setName);
      window.addEventListener("scroll", onScroll, true);
      removeScroll.push(() => window.removeEventListener("scroll", onScroll, true));
    });

    return () => {
      observers.forEach((o) => o.disconnect());
      removeScroll.forEach((fn) => fn());
    };
  }, [sets.length]);

  function levelLines(
    setName: string,
    orderedLevels: number[],
    levelMeta: Map<number, { rowIdx: number; dir: "ltr" | "rtl" }>,
    levelDone: Map<number, boolean>
  ) {
    const boxes = levelBoxesBySet[setName] ?? {};
    const segs: { x1: number; y1: number; x2: number; y2: number; done: boolean; bend: number }[] = [];

    for (let i = 0; i < orderedLevels.length - 1; i += 1) {
      const aLvl = orderedLevels[i];
      const bLvl = orderedLevels[i + 1];
      const a = boxes[String(aLvl)];
      const b = boxes[String(bLvl)];
      if (!a || !b) continue;

      const metaA = levelMeta.get(aLvl);
      const metaB = levelMeta.get(bLvl);
      const sameRow = metaA?.rowIdx === metaB?.rowIdx;
      const dir = metaA?.dir ?? "ltr";
      const nextDir = metaB?.dir ?? "ltr";

      let x1 = a.x + a.w;
      let x2 = b.x;
      let bend = 28;

      if (sameRow) {
        if (dir === "rtl") {
          x1 = a.x;
          x2 = b.x + b.w;
          bend = -28;
        }
      } else {
        if (nextDir === "rtl") {
          x1 = a.x + a.w;
          x2 = b.x + b.w;
          bend = 28;
        } else {
          x1 = a.x;
          x2 = b.x;
          bend = -28;
        }
      }

      segs.push({
        x1,
        y1: a.y + a.h / 2,
        x2,
        y2: b.y + b.h / 2,
        done: (levelDone.get(aLvl) ?? false) && (levelDone.get(bLvl) ?? false),
        bend,
      });
    }

    return segs;
  }

  const isStudentView = viewerRole === "student" || viewerRole === "classroom";

  return (
    <main>
      {!isEmbed && (
        <div style={{ position: "fixed", left: 12, top: 150, width: 320, zIndex: 120, display: "grid", gap: 12 }}>
          <StudentTopBar
            students={students}
            activeStudentId={studentId}
            onChangeStudent={setStudentId}
            sticky={false}
            dock="left"
            autoHide={false}
            quickPoints={isStudentView ? undefined : [1, 2, 5, 10, 15, -1, -2, -5, -10, -15]}
            onQuickPoints={isStudentView ? undefined : addOrRemovePoints}
            readonly={isStudentView}
          />
          <CriticalNoticeBar dock="left" />
        </div>
      )}

      {msg ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 18,
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 18px 50px rgba(0,0,0,0.25)",
            fontWeight: 900,
          }}
        >
          {msg}
        </div>
      ) : null}

      <div style={skillTopBar()}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setSearchFilter(searchQuery);
            }}
            placeholder="Search skill trees..."
            style={skillSearchInput()}
          />
          <button onClick={() => setSearchFilter(searchQuery)} style={skillSearchButton(!!searchFilter)}>
            Search
          </button>
          {searchFilter ? (
            <button
              onClick={() => {
                setSearchQuery("");
                setSearchFilter("");
              }}
              style={skillSearchButton(false)}
            >
              Clear
            </button>
          ) : null}
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={skillSelect()}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button onClick={() => setSetFilter("all")} style={filterPill(setFilter === "all")}>
            All Trees ({sets.length})
          </button>
          <button onClick={() => setSetFilter("completed")} style={filterPill(setFilter === "completed")}>
            Completed ({setCounts.completedCount})
          </button>
          <button onClick={() => setSetFilter("not_completed")} style={filterPill(setFilter === "not_completed")}>
            Not Completed ({setCounts.notCompletedCount})
          </button>
          <button onClick={() => setSetFilter("almost")} style={filterPill(setFilter === "almost")}>
            Almost Complete ({setCounts.almostCount})
          </button>
        </div>
        <div style={pointsStat()}>
          <div style={{ opacity: 0.75, fontSize: 11 }}>Skill Tree Points</div>
          <div style={{ fontSize: 20, fontWeight: 1000 }}>{pointsEarned}</div>
        </div>
      </div>

      <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
        {filteredSets.map((s) => {
          const levelBlocks = s.levels.map(({ level, nodes }) => ({ level, nodes }));
          const rows = chunkSnake(levelBlocks, 4);
          const levelMeta = new Map<number, { rowIdx: number; dir: "ltr" | "rtl" }>();
          const levelDone = new Map<number, boolean>();
          rows.forEach((row, rowIdx) => {
            const dir: "ltr" | "rtl" = rowIdx % 2 === 1 ? "rtl" : "ltr";
            row.forEach((block) => {
              levelMeta.set(block.level, { rowIdx, dir });
              levelDone.set(block.level, block.nodes.every((n) => completedSet.has(n.id)));
            });
          });
          const orderedLevels = rows.flatMap((row) => row.map((block) => block.level));
          const lines = levelLines(s.setName, orderedLevels, levelMeta, levelDone);

          return (
            <div
              key={s.setName}
              style={{
                borderRadius: 28,
                padding: 14,
                position: "relative",
                overflow: "hidden",
                background: "rgba(255,255,255,0.04)",
                border: s.isSetComplete ? "1px solid rgba(34,197,94,0.55)" : "1px solid rgba(255,255,255,0.10)",
                boxShadow: s.isSetComplete ? "0 0 0 2px rgba(34,197,94,0.18), 0 18px 50px rgba(0,0,0,0.30)" : "0 18px 50px rgba(0,0,0,0.25)",
              }}
            >
              <div style={{ fontWeight: 1100, fontSize: 18 }}>
                {s.setName}{" "}
                <span style={{ opacity: 0.65, fontSize: 12 }}>
                  • {s.nodes.length} skills {s.isSetComplete ? "• ✅ COMPLETE" : ""}
                </span>
              </div>

              <div
                ref={(el) => {
                  setRefs.current[s.setName] = el;
                }}
                style={{
                  marginTop: 12,
                  position: "relative",
                  borderRadius: 22,
                  padding: 12,
                  background: "rgba(0,0,0,0.18)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  overflow: "hidden",
                }}
              >
                <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                  {lines.map((l, i) => (
                    <path
                      key={i}
                      d={`M ${l.x1} ${l.y1} C ${l.x1 + l.bend} ${l.y1}, ${l.x2 - l.bend} ${l.y2}, ${l.x2} ${l.y2}`}
                      stroke={l.done ? "rgba(34,197,94,0.75)" : "rgba(255,255,255,0.14)"}
                      strokeWidth={2}
                      fill="none"
                    />
                  ))}
                </svg>

                <div style={{ display: "grid", gap: 14 }}>
                  {rows.map((row, rowIdx) => (
                    <div
                      key={`row-${rowIdx}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, minmax(220px, 1fr))",
                        gap: 12,
                        alignItems: "start",
                        direction: rowIdx % 2 === 1 ? "rtl" : "ltr",
                      }}
                    >
                      {row.map(({ level, nodes }) => (
                        <div
                          key={level}
                          data-level-id={String(level)}
                          style={{ display: "grid", gap: 10, alignContent: "start", direction: "ltr" }}
                        >
                          <div
                            style={{
                              justifyContent: "center",
                              borderRadius: 16,
                              padding: "10px 12px",
                              fontWeight: 1100,
                              background: "rgba(255,255,255,0.06)",
                              border: "1px solid rgba(255,255,255,0.10)",
                              textAlign: "center",
                            }}
                          >
                            Level {level}
                          </div>

                          {nodes.map((n) => {
                            const done = completedSet.has(n.id);
                            const ready = canComplete(n, s.setName) && !done;

                            return (
                              <div
                                key={n.id}
                                data-skill-id={n.id}
                                style={{
                                  borderRadius: 18,
                                  padding: 12,
                                  border: done
                                    ? "1px solid rgba(34,197,94,0.35)"
                                    : ready
                                    ? "1px solid rgba(59,130,246,0.30)"
                                    : "1px solid rgba(255,255,255,0.10)",
                                  background: done ? "rgba(34,197,94,0.10)" : ready ? "rgba(59,130,246,0.10)" : "rgba(255,255,255,0.04)",
                                  boxShadow: "0 14px 30px rgba(0,0,0,0.28)",
                                  display: "grid",
                                  gap: 8,
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                                  <div style={{ fontWeight: 980, fontSize: 14, color: "#fff" }}>◆ {n.name}</div>
                                  <div
                                    style={{
                                      fontWeight: 980,
                                      fontSize: 12,
                                      padding: "5px 10px",
                                      borderRadius: 999,
                                      color: "#fff",
                                      background: "rgba(255,255,255,0.10)",
                                      border: "1px solid rgba(255,255,255,0.12)",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    +{Number(n.points ?? 0)} pts
                                  </div>
                                </div>

                                {n.description ? <div style={{ fontSize: 12, opacity: 0.85 }}>{n.description}</div> : null}

                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  {!done ? (
                                    <button
                                      onClick={() => doComplete(n, s.setName)}
                                      disabled={!ready || !!pendingComplete[n.id]}
                                      style={{
                                        padding: "9px 12px",
                                        borderRadius: 14,
                                        border: "1px solid rgba(255,255,255,0.14)",
                                        color: "white",
                                        fontWeight: 950,
                                        cursor: ready && !pendingComplete[n.id] ? "pointer" : "not-allowed",
                                        background: ready
                                          ? "linear-gradient(90deg, rgba(34,197,94,0.85), rgba(59,130,246,0.70))"
                                          : "rgba(255,255,255,0.06)",
                                        opacity: ready && !pendingComplete[n.id] ? 1 : 0.55,
                                      }}
                                    >
                                      ✅ Complete
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => doUncheck(n)}
                                      style={{
                                        padding: "9px 12px",
                                        borderRadius: 14,
                                        border: "1px solid rgba(255,255,255,0.14)",
                                        color: "white",
                                        fontWeight: 950,
                                        background: "linear-gradient(90deg, rgba(239,68,68,0.78), rgba(124,58,237,0.60))",
                                        cursor: "pointer",
                                      }}
                                    >
                                      ↩ Uncheck
                                    </button>
                                  )}

                                  <div style={{ fontSize: 12, opacity: 0.8, alignSelf: "center" }}>
                                    {done ? "✅ done" : ready ? "ready" : "locked"}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}

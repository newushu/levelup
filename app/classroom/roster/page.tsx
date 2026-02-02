"use client";


import React, { useEffect, useMemo, useState } from "react";
import { StudentRosterCard, StudentRoster } from "@/components/StudentRosterCard";
import { playGlobalSfx, setGlobalSounds } from "@/lib/globalAudio";

type SkillRow = {
  id: string;
  name: string;
  category?: string | null;
  enabled?: boolean | null;
};


async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 180)}` } };
  }
}


export default function ClassroomRosterPage() {
  const [students, setStudents] = useState<StudentRoster[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<string>("student");
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillSearch, setSkillSearch] = useState("");
  const [groupSkillId, setGroupSkillId] = useState("");
  const [groupReps, setGroupReps] = useState<number>(5);
  const [groupSelectedIds, setGroupSelectedIds] = useState<string[]>([]);
  const [groupBusy, setGroupBusy] = useState(false);
  const [groupMsg, setGroupMsg] = useState("");


  // per-student flash border
  const [flashById, setFlashById] = useState<Record<string, null | "add" | "remove">>({});


  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/roster", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load roster");
      setStudents(json.students ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function loadSkills() {
    setSkillsLoading(true);
    try {
      const res = await fetch("/api/tracker-skills/list", { cache: "no-store" });
      const sj = await safeJson(res);
      if (sj.ok) {
        const rows = (sj.json?.skills ?? []) as SkillRow[];
        setSkills(rows.filter((s) => s.enabled !== false));
      }
    } finally {
      setSkillsLoading(false);
    }
  }


  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json();
        if (data?.ok) setRole(String(data?.role ?? "student"));
      } catch {
        setRole("student");
      }
    })();
    (async () => {
      const resSounds = await fetch("/api/sound-effects/list", { cache: "no-store" });
      const sjSounds = await safeJson(resSounds);
      if (sjSounds.ok) {
        const map: Record<string, { url: string; volume: number }> = {};
        (sjSounds.json?.effects ?? []).forEach((row: any) => {
          const key = String(row?.key ?? "");
          const url = String(row?.audio_url ?? "");
          if (!key || !url) return;
          map[key] = { url, volume: Math.min(1, Math.max(0, Number(row?.volume ?? 1))) };
        });
        setGlobalSounds(map);
      }
    })();
    load();
    loadSkills();
  }, []);

  useEffect(() => {
    const rosterIds = students.map((s) => s.id).filter(Boolean);
    setGroupSelectedIds((prev) => {
      if (!prev.length) return rosterIds;
      const next = prev.filter((id) => rosterIds.includes(id));
      return next.length ? next : rosterIds;
    });
  }, [students]);


  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s: any) => `${s.firstName ?? ""} ${s.lastName ?? ""}`.toLowerCase().includes(q));
  }, [students, query]);

  const filteredSkills = useMemo(() => {
    const q = skillSearch.trim().toLowerCase();
    if (!q) return skills;
    return skills.filter((s) => `${s.name ?? ""} ${s.category ?? ""}`.toLowerCase().includes(q));
  }, [skills, skillSearch]);

  const skillsByCategory = useMemo(() => {
    const map = new Map<string, SkillRow[]>();
    filteredSkills.forEach((s) => {
      const key = String(s.category ?? "Skills").trim() || "Skills";
      map.set(key, [...(map.get(key) ?? []), s]);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredSkills]);

  const groupSelectedCount = groupSelectedIds.length;


  function pulse(studentId: string, kind: "add" | "remove") {
    setFlashById((m) => ({ ...m, [studentId]: kind }));
    window.setTimeout(() => {
      setFlashById((m) => ({ ...m, [studentId]: null }));
    }, 520);
  }

  function toggleGroupStudent(id: string) {
    setGroupSelectedIds((prev) => (prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]));
  }

  function selectAllGroup() {
    setGroupSelectedIds(students.map((s) => s.id).filter(Boolean));
  }

  function clearGroupSelection() {
    setGroupSelectedIds([]);
  }

  async function createGroupTracker() {
    setGroupMsg("");
    if (!groupSkillId) return setGroupMsg("Select a skill first.");
    if (!groupSelectedIds.length) return setGroupMsg("Select at least one student.");
    setGroupBusy(true);
    const res = await fetch("/api/skill-tracker/group/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_ids: groupSelectedIds,
        skill_id: groupSkillId,
        repetitions_target: groupReps,
      }),
    });
    const sj = await safeJson(res);
    setGroupBusy(false);
    if (!sj.ok) return setGroupMsg(sj.json?.error || "Failed to create group tracker");
    setGroupMsg(`Created group tracker for ${groupSelectedIds.length} students.`);
  }


  async function applyPoints(studentId: string, delta: number) {
    setErr(null);
    if (!["admin", "coach"].includes(role)) return;


    const res = await fetch("/api/ledger/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id: studentId,
        points: delta,
        note: `Roster ${delta > 0 ? "+" : ""}${delta}`,
        category: "manual",
      }),
    });


    const sj = await safeJson(res);
    if (!sj.ok) throw new Error(sj.json?.error ?? "Failed to update points");
    if (delta > 0) playGlobalSfx("points_add");
  }


  async function onAddPoint(studentId: string) {
    try {
      await applyPoints(studentId, +1);
      pulse(studentId, "add");
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Failed");
    }
  }


  async function onRemovePoint(studentId: string) {
    try {
      await applyPoints(studentId, -1);
      pulse(studentId, "remove");
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Failed");
    }
  }


  if (!["admin", "coach", "classroom", "display"].includes(role)) {
    return (
      <div style={{ padding: 18 }}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>Display access only.</div>
        <div style={{ opacity: 0.7, marginTop: 6 }}>This login does not have roster access.</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "18px 0", maxWidth: 1640, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Classroom Roster</h1>
        <button onClick={load} disabled={loading} style={{ padding: "8px 12px" }}>
          Refresh
        </button>
      </div>


      <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search student..."
          style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid rgba(0,0,0,0.2)" }}
        />
      </div>

      <div
        style={{
          marginTop: 14,
          padding: 12,
          borderRadius: 14,
          border: "1px solid rgba(0,0,0,0.12)",
          background: "rgba(255,255,255,0.6)",
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <div style={{ fontWeight: 800 }}>Quick Group Tracker</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{groupSelectedCount} selected</div>
        </div>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "minmax(220px, 1fr) minmax(140px, 180px)" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <input
              value={skillSearch}
              onChange={(e) => setSkillSearch(e.target.value)}
              placeholder="Search skill..."
              style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(0,0,0,0.2)" }}
            />
            <select
              value={groupSkillId}
              onChange={(e) => setGroupSkillId(e.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(0,0,0,0.2)" }}
            >
              <option value="">{skillsLoading ? "Loading skills..." : "Select skill"}</option>
              {skillsByCategory.map(([cat, rows]) => (
                <optgroup key={cat} label={cat}>
                  {rows.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <input
              type="number"
              min={1}
              max={20}
              value={groupReps}
              onChange={(e) => setGroupReps(Math.max(1, Math.min(20, Number(e.target.value))))}
              style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(0,0,0,0.2)" }}
              placeholder="Reps"
            />
            <button onClick={createGroupTracker} disabled={groupBusy} style={{ padding: "10px 12px" }}>
              {groupBusy ? "Creating..." : "Create Group Tracker"}
            </button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={selectAllGroup} style={{ padding: "6px 10px" }} type="button">
            Select all
          </button>
          <button onClick={clearGroupSelection} style={{ padding: "6px 10px" }} type="button">
            Clear
          </button>
          {groupMsg ? <div style={{ fontSize: 12, opacity: 0.7 }}>{groupMsg}</div> : null}
        </div>
        <div
          style={{
            display: "grid",
            gap: 8,
            maxHeight: 260,
            overflowY: "auto",
            padding: 8,
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.08)",
            background: "rgba(255,255,255,0.5)",
          }}
        >
          {filtered.map((s: any) => {
            const label = `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim() || "Student";
            const checked = groupSelectedIds.includes(s.id);
            return (
              <label key={`group-${s.id}`} style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleGroupStudent(s.id)}
                />
                <span>{label}</span>
              </label>
            );
          })}
          {!filtered.length && <div style={{ opacity: 0.7 }}>No roster students found.</div>}
        </div>
      </div>


      {loading ? <p style={{ opacity: 0.7 }}>Loading…</p> : null}
      {err ? <p style={{ color: "crimson", fontWeight: 700 }}>{err}</p> : null}


      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          columnGap: 12,
          rowGap: 20,
        }}
      >
        {filtered.map((s: any) => (
          <div key={s.id} style={rosterCard(flashById[s.id] ?? null)}>
            <StudentRosterCard
              student={s}
              onAddPoint={onAddPoint}
              onRemovePoint={onRemovePoint}
              allowPoints={["admin", "coach"].includes(role)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}


function rosterCard(flash: null | "add" | "remove"): React.CSSProperties {
  const glow =
    flash === "add"
      ? "0 0 0 2px rgba(34,197,94,0.55), 0 0 40px rgba(34,197,94,0.22)"
      : flash === "remove"
      ? "0 0 0 2px rgba(239,68,68,0.55), 0 0 40px rgba(239,68,68,0.20)"
      : "0 12px 40px rgba(0,0,0,0.18)";


  const border =
    flash === "add"
      ? "2px solid rgba(34,197,94,0.40)"
      : flash === "remove"
      ? "2px solid rgba(239,68,68,0.40)"
      : "2px solid rgba(0,0,0,0.10)";


  return {
    borderRadius: 16,
    border,
    boxShadow: glow,
    transition: "box-shadow 160ms ease",
    overflow: "hidden",
    background: "transparent",
  };
}

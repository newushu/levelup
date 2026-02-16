"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CriteriaDef = {
  key: string;
  label: string;
  description?: string | null;
  enabled?: boolean;
};

type StudentRow = { id: string; name?: string | null };
type RequirementRow = { item_type: string; item_key: string; criteria_key: string };
type StudentCriteriaRow = { student_id: string; criteria_key: string; fulfilled?: boolean | null };
type AvatarRow = {
  id: string;
  name: string;
  storage_path?: string | null;
  enabled?: boolean | null;
  unlock_level?: number | null;
  unlock_points?: number | null;
  limited_event_only?: boolean | null;
  limited_event_name?: string | null;
  limited_event_description?: string | null;
  is_secondary?: boolean | null;
  rule_keeper_multiplier?: number | null;
  rule_breaker_multiplier?: number | null;
  skill_pulse_multiplier?: number | null;
  spotlight_multiplier?: number | null;
  daily_free_points?: number | null;
  challenge_completion_bonus_pct?: number | null;
  mvp_bonus_pct?: number | null;
  zoom_pct?: number | null;
  competition_only?: boolean | null;
  competition_discount_pct?: number | null;
};
type EffectRow = {
  id?: string | null;
  key: string;
  name: string;
  enabled?: boolean | null;
  unlock_level?: number | null;
  unlock_points?: number | null;
  config?: any;
  render_mode?: string | null;
  z_layer?: string | null;
  html?: string | null;
  css?: string | null;
  js?: string | null;
  limited_event_only?: boolean | null;
  limited_event_name?: string | null;
  limited_event_description?: string | null;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, json: JSON.parse(text) };
  } catch {
    return { ok: false, json: { error: text.slice(0, 200) } };
  }
}

function slugify(raw: string) {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

export default function LimitedEventsPage() {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [criteria, setCriteria] = useState<CriteriaDef[]>([]);
  const [requirements, setRequirements] = useState<RequirementRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [studentCriteria, setStudentCriteria] = useState<StudentCriteriaRow[]>([]);
  const [avatars, setAvatars] = useState<AvatarRow[]>([]);
  const [effects, setEffects] = useState<EffectRow[]>([]);
  const [selectedEventKey, setSelectedEventKey] = useState("");
  const [newEventName, setNewEventName] = useState("");
  const [newEventDesc, setNewEventDesc] = useState("");
  const [studentQuery, setStudentQuery] = useState("");

  const eventCriteria = useMemo(
    () => criteria.filter((c) => String(c.key ?? "").startsWith("event_")),
    [criteria]
  );

  const requirementSet = useMemo(() => {
    const s = new Set<string>();
    requirements.forEach((r) => {
      if (!selectedEventKey) return;
      if (String(r.criteria_key) !== selectedEventKey) return;
      s.add(`${r.item_type}:${r.item_key}`);
    });
    return s;
  }, [requirements, selectedEventKey]);

  const fulfilledStudentSet = useMemo(() => {
    const s = new Set<string>();
    studentCriteria.forEach((row) => {
      if (!selectedEventKey) return;
      if (String(row.criteria_key) !== selectedEventKey) return;
      if (row.fulfilled !== false) s.add(String(row.student_id));
    });
    return s;
  }, [studentCriteria, selectedEventKey]);

  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => String(s.name ?? "").toLowerCase().includes(q));
  }, [students, studentQuery]);

  async function loadAll(studentId?: string) {
    const criteriaRes = await fetch(
      studentId ? `/api/admin/unlock-criteria?student_id=${encodeURIComponent(studentId)}` : "/api/admin/unlock-criteria",
      { cache: "no-store" }
    );
    const criteriaJson = await safeJson(criteriaRes);
    if (!criteriaJson.ok) {
      setMsg(String(criteriaJson.json?.error ?? "Failed to load limited events"));
      return;
    }
    setCriteria((criteriaJson.json?.criteria ?? []) as CriteriaDef[]);
    setRequirements((criteriaJson.json?.requirements ?? []) as RequirementRow[]);
    setStudents((criteriaJson.json?.students ?? []) as StudentRow[]);
    if (Array.isArray(criteriaJson.json?.student_criteria)) {
      setStudentCriteria(criteriaJson.json.student_criteria as StudentCriteriaRow[]);
    }

    const [avatarRes, effectRes] = await Promise.all([
      fetch("/api/admin/avatars", { cache: "no-store" }),
      fetch("/api/admin/avatar-effects", { cache: "no-store" }),
    ]);
    const avatarJson = await safeJson(avatarRes);
    const effectJson = await safeJson(effectRes);
    if (avatarJson.ok) setAvatars((avatarJson.json?.avatars ?? []) as AvatarRow[]);
    if (effectJson.ok) setEffects((effectJson.json?.effects ?? []) as EffectRow[]);
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!selectedEventKey && eventCriteria[0]?.key) {
      setSelectedEventKey(String(eventCriteria[0].key));
    }
  }, [eventCriteria, selectedEventKey]);

  async function createEvent() {
    const name = newEventName.trim();
    if (!name) return;
    const key = `event_${slugify(name)}`;
    setBusy(true);
    const res = await fetch("/api/admin/unlock-criteria", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsert_criteria",
        key,
        label: name,
        description: newEventDesc.trim(),
        enabled: true,
      }),
    });
    const sj = await safeJson(res);
    setBusy(false);
    if (!sj.ok) return setMsg(String(sj.json?.error ?? "Failed to create event"));
    setNewEventName("");
    setNewEventDesc("");
    await loadAll();
    setSelectedEventKey(key);
    setMsg("Event created.");
  }

  async function setRequirement(itemType: "avatar" | "effect", itemKey: string, required: boolean) {
    if (!selectedEventKey) return;
    setBusy(true);
    const res = await fetch("/api/admin/unlock-criteria", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "set_requirement",
        item_type: itemType,
        item_key: itemKey,
        criteria_key: selectedEventKey,
        required,
      }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) {
      setBusy(false);
      return setMsg(String(sj.json?.error ?? "Failed updating requirement"));
    }

    if (required) {
      const chosen = eventCriteria.find((e) => e.key === selectedEventKey);
      if (itemType === "avatar") {
        const row = avatars.find((a) => String(a.id) === itemKey);
        if (row) {
          await fetch("/api/admin/avatars", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...row,
              limited_event_only: true,
              limited_event_name: chosen?.label ?? "",
              limited_event_description: chosen?.description ?? "",
            }),
          });
        }
      } else {
        const row = effects.find((a) => String(a.key) === itemKey);
        if (row) {
          await fetch("/api/admin/avatar-effects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...row,
              limited_event_only: true,
              limited_event_name: chosen?.label ?? "",
              limited_event_description: chosen?.description ?? "",
            }),
          });
        }
      }
    }

    await loadAll();
    setBusy(false);
  }

  async function toggleStudent(studentId: string, fulfilled: boolean) {
    if (!selectedEventKey) return;
    setBusy(true);
    const res = await fetch("/api/admin/unlock-criteria", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "set_student_criteria",
        student_id: studentId,
        criteria_key: selectedEventKey,
        fulfilled,
      }),
    });
    const sj = await safeJson(res);
    setBusy(false);
    if (!sj.ok) return setMsg(String(sj.json?.error ?? "Failed to update student eligibility"));
    await loadAll(studentId);
  }

  const selectedEvent = eventCriteria.find((e) => e.key === selectedEventKey) ?? null;

  return (
    <main style={{ display: "grid", gap: 14 }}>
      <Link href="/admin/custom" style={backLink()}>← Back To Admin Workspace</Link>
      <div style={{ fontSize: 28, fontWeight: 1000 }}>Limited Events</div>
      <div style={{ opacity: 0.75, fontSize: 13 }}>
        Create event unlocks, attach special avatars/effects, and assign eligible students.
      </div>
      {msg ? <div style={notice()}>{msg}</div> : null}

      <section style={card()}>
        <div style={{ fontWeight: 1000 }}>Create Event</div>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr auto" }}>
          <input value={newEventName} onChange={(e) => setNewEventName(e.target.value)} placeholder="Event name" style={input()} />
          <input value={newEventDesc} onChange={(e) => setNewEventDesc(e.target.value)} placeholder="Event description" style={input()} />
          <button type="button" onClick={createEvent} disabled={busy} style={btn()}>{busy ? "Saving..." : "Create"}</button>
        </div>
      </section>

      <section style={card()}>
        <div style={{ fontWeight: 1000 }}>Active Event</div>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "320px 1fr" }}>
          <select value={selectedEventKey} onChange={(e) => setSelectedEventKey(e.target.value)} style={input()}>
            <option value="">Select event</option>
            {eventCriteria.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
          </select>
          <div style={{ fontSize: 12, opacity: 0.78 }}>
            {selectedEvent ? `${selectedEvent.label} — ${selectedEvent.description ?? ""}` : "Pick an event to edit assignments."}
          </div>
        </div>
      </section>

      <section style={card()}>
        <div style={{ fontWeight: 1000 }}>Special Event Avatars</div>
        <div style={grid()}>
          {avatars
            .filter((a) => a.enabled !== false)
            .map((a) => {
              const on = requirementSet.has(`avatar:${a.id}`);
              return (
                <button key={a.id} type="button" onClick={() => setRequirement("avatar", a.id, !on)} disabled={!selectedEventKey || busy} style={toggle(on)}>
                  {a.name}
                </button>
              );
            })}
        </div>
      </section>

      <section style={card()}>
        <div style={{ fontWeight: 1000 }}>Special Event Avatar Effects</div>
        <div style={grid()}>
          {effects
            .filter((e) => e.enabled !== false)
            .map((e) => {
              const on = requirementSet.has(`effect:${e.key}`);
              return (
                <button key={e.key} type="button" onClick={() => setRequirement("effect", e.key, !on)} disabled={!selectedEventKey || busy} style={toggle(on)}>
                  {e.name}
                </button>
              );
            })}
        </div>
      </section>

      <section style={card()}>
        <div style={{ fontWeight: 1000 }}>Eligible Students</div>
        <input value={studentQuery} onChange={(e) => setStudentQuery(e.target.value)} placeholder="Search students..." style={input()} />
        <div style={grid()}>
          {filteredStudents.map((s) => {
            const on = fulfilledStudentSet.has(String(s.id));
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleStudent(String(s.id), !on)}
                disabled={!selectedEventKey || busy}
                style={toggle(on)}
              >
                {on ? "✓ " : ""}{s.name ?? s.id}
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function card(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    display: "grid",
    gap: 10,
  };
}

function input(): React.CSSProperties {
  return {
    padding: "9px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.25)",
    color: "white",
    fontWeight: 800,
  };
}

function btn(): React.CSSProperties {
  return {
    padding: "9px 12px",
    borderRadius: 10,
    border: "1px solid rgba(59,130,246,0.4)",
    background: "rgba(59,130,246,0.25)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function grid(): React.CSSProperties {
  return {
    display: "grid",
    gap: 8,
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  };
}

function toggle(on: boolean): React.CSSProperties {
  return {
    padding: "9px 10px",
    borderRadius: 10,
    border: on ? "1px solid rgba(34,197,94,0.45)" : "1px solid rgba(148,163,184,0.35)",
    background: on
      ? "linear-gradient(145deg, rgba(21,128,61,0.42), rgba(22,163,74,0.28))"
      : "rgba(30,41,59,0.6)",
    color: "white",
    fontWeight: 900,
    textAlign: "left",
    cursor: "pointer",
  };
}

function notice(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(34,197,94,0.35)",
    background: "rgba(34,197,94,0.15)",
    fontWeight: 900,
    fontSize: 12,
  };
}

function backLink(): React.CSSProperties {
  return {
    color: "rgba(255,255,255,0.8)",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 900,
  };
}

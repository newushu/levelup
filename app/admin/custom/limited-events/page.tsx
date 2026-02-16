"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CriteriaDef = {
  key: string;
  label: string;
  description?: string | null;
  enabled?: boolean;
  start_date?: string | null;
  end_date?: string | null;
  daily_free_points?: number | null;
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
  rule_keeper_multiplier?: number | null;
  rule_breaker_multiplier?: number | null;
  skill_pulse_multiplier?: number | null;
  spotlight_multiplier?: number | null;
  daily_free_points?: number | null;
  challenge_completion_bonus_pct?: number | null;
  mvp_bonus_pct?: number | null;
  limited_event_only?: boolean | null;
  limited_event_name?: string | null;
  limited_event_description?: string | null;
};
type BorderRow = {
  id?: string | null;
  key: string;
  name: string;
  image_url?: string | null;
  render_mode?: string | null;
  z_layer?: string | null;
  html?: string | null;
  css?: string | null;
  js?: string | null;
  unlock_level?: number | null;
  unlock_points?: number | null;
  enabled?: boolean | null;
  rule_keeper_multiplier?: number | null;
  rule_breaker_multiplier?: number | null;
  skill_pulse_multiplier?: number | null;
  spotlight_multiplier?: number | null;
  daily_free_points?: number | null;
  challenge_completion_bonus_pct?: number | null;
  mvp_bonus_pct?: number | null;
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

function num(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
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
  const [borders, setBorders] = useState<BorderRow[]>([]);
  const [selectedEventKey, setSelectedEventKey] = useState("");
  const [newEventName, setNewEventName] = useState("");
  const [newEventDesc, setNewEventDesc] = useState("");
  const [editEventName, setEditEventName] = useState("");
  const [editEventDesc, setEditEventDesc] = useState("");
  const [editEventStartDate, setEditEventStartDate] = useState("");
  const [editEventEndDate, setEditEventEndDate] = useState("");
  const [editEventDailyPoints, setEditEventDailyPoints] = useState(0);
  const [studentQuery, setStudentQuery] = useState("");
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [avatarDrafts, setAvatarDrafts] = useState<Record<string, Partial<AvatarRow>>>({});
  const [effectDrafts, setEffectDrafts] = useState<Record<string, Partial<EffectRow>>>({});
  const [borderDrafts, setBorderDrafts] = useState<Record<string, Partial<BorderRow>>>({});
  const [newEffectName, setNewEffectName] = useState("");
  const [newEffectKey, setNewEffectKey] = useState("");
  const [newBorderName, setNewBorderName] = useState("");
  const [newBorderKey, setNewBorderKey] = useState("");
  const [autoSaveEligible, setAutoSaveEligible] = useState(true);
  const [eligibleDraftSet, setEligibleDraftSet] = useState<Set<string>>(new Set());
  const [eligibleDirty, setEligibleDirty] = useState(false);

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

  const selectedEvent = useMemo(
    () => eventCriteria.find((e) => e.key === selectedEventKey) ?? null,
    [eventCriteria, selectedEventKey]
  );

  useEffect(() => {
    setEditEventName(selectedEvent?.label ?? "");
    setEditEventDesc(selectedEvent?.description ?? "");
    setEditEventStartDate(String(selectedEvent?.start_date ?? ""));
    setEditEventEndDate(String(selectedEvent?.end_date ?? ""));
    setEditEventDailyPoints(Math.max(0, Math.floor(Number(selectedEvent?.daily_free_points ?? 0))));
  }, [selectedEvent?.key]);

  const fulfilledStudentSet = useMemo(() => {
    const s = new Set<string>();
    studentCriteria.forEach((row) => {
      if (!selectedEventKey) return;
      if (String(row.criteria_key) !== selectedEventKey) return;
      if (row.fulfilled === true) s.add(String(row.student_id));
    });
    return s;
  }, [studentCriteria, selectedEventKey]);

  useEffect(() => {
    setEligibleDraftSet(new Set(Array.from(fulfilledStudentSet)));
    setEligibleDirty(false);
  }, [fulfilledStudentSet, selectedEventKey]);

  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => String(s.name ?? "").toLowerCase().includes(q));
  }, [students, studentQuery]);

  const activeEligibleSet = useMemo(
    () => (autoSaveEligible ? fulfilledStudentSet : eligibleDraftSet),
    [autoSaveEligible, fulfilledStudentSet, eligibleDraftSet]
  );

  const eligibleStudents = useMemo(() => {
    const rows = students
      .filter((s) => activeEligibleSet.has(String(s.id)))
      .map((s) => ({ id: String(s.id), name: String(s.name ?? s.id) }));
    rows.sort((a, b) => a.name.localeCompare(b.name));
    return rows;
  }, [students, activeEligibleSet]);

  const eventAvatars = useMemo(
    () => avatars.filter((a) => requirementSet.has(`avatar:${a.id}`)),
    [avatars, requirementSet]
  );

  const eventEffects = useMemo(
    () => effects.filter((e) => requirementSet.has(`effect:${e.key}`)),
    [effects, requirementSet]
  );
  const eventBorders = useMemo(
    () => borders.filter((b) => requirementSet.has(`corner_border:${b.key}`)),
    [borders, requirementSet]
  );
  const avatarBase = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previewAvatarPath = eventAvatars[0]?.storage_path ?? avatars[0]?.storage_path ?? null;
  const previewAvatarSrc = previewAvatarPath && avatarBase
    ? `${avatarBase}/storage/v1/object/public/avatars/${previewAvatarPath}`
    : "";

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

    const [avatarRes, effectRes, borderRes] = await Promise.all([
      fetch("/api/admin/avatars", { cache: "no-store" }),
      fetch("/api/admin/avatar-effects", { cache: "no-store" }),
      fetch("/api/admin/corner-borders", { cache: "no-store" }),
    ]);
    const avatarJson = await safeJson(avatarRes);
    const effectJson = await safeJson(effectRes);
    const borderJson = await safeJson(borderRes);
    if (avatarJson.ok) setAvatars((avatarJson.json?.avatars ?? []) as AvatarRow[]);
    if (effectJson.ok) setEffects((effectJson.json?.effects ?? []) as EffectRow[]);
    if (borderJson.ok) setBorders((borderJson.json?.borders ?? []) as BorderRow[]);
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!selectedEventKey && eventCriteria[0]?.key) {
      setSelectedEventKey(String(eventCriteria[0].key));
    }
  }, [eventCriteria, selectedEventKey]);

  async function writeRequirement(itemType: "avatar" | "effect" | "corner_border", itemKey: string, required: boolean) {
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
    return sj.ok;
  }

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
        start_date: null,
        end_date: null,
        daily_free_points: 0,
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

  async function saveEventMeta() {
    if (!selectedEventKey) return;
    setBusy(true);
    const res = await fetch("/api/admin/unlock-criteria", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsert_criteria",
        key: selectedEventKey,
        label: editEventName.trim() || selectedEvent?.label || "Event",
        description: editEventDesc.trim(),
        enabled: true,
        start_date: editEventStartDate || null,
        end_date: editEventEndDate || null,
        daily_free_points: Math.max(0, Math.floor(Number(editEventDailyPoints ?? 0))),
      }),
    });
    const sj = await safeJson(res);
    setBusy(false);
    if (!sj.ok) return setMsg(String(sj.json?.error ?? "Failed to save event details"));
    await loadAll();
    setMsg("Event details saved.");
  }

  async function uploadAvatarsToEvent() {
    if (!selectedEventKey || !selectedEvent || !uploadFiles.length) return;
    setBusy(true);
    const form = new FormData();
    form.append("bulk", "1");
    uploadFiles.forEach((file) => form.append("files", file));
    const uploadRes = await fetch("/api/admin/avatars/upload", { method: "POST", body: form });
    const uploadJson = await safeJson(uploadRes);
    if (!uploadJson.ok) {
      setBusy(false);
      return setMsg(String(uploadJson.json?.error ?? "Upload failed"));
    }
    const created = Array.isArray(uploadJson.json?.created) ? (uploadJson.json.created as AvatarRow[]) : [];
    for (const row of created) {
      const id = String(row.id ?? "");
      if (!id) continue;
      await fetch("/api/admin/avatars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...row,
          enabled: true,
          limited_event_only: true,
          limited_event_name: selectedEvent.label ?? "",
          limited_event_description: selectedEvent.description ?? "",
        }),
      });
      await writeRequirement("avatar", id, true);
    }
    setUploadFiles([]);
    await loadAll();
    setBusy(false);
    setMsg(`Uploaded ${created.length} avatar${created.length === 1 ? "" : "s"} into this event.`);
  }

  async function createEventEffect() {
    if (!selectedEventKey || !selectedEvent) return;
    const name = newEffectName.trim();
    if (!name) return;
    const keyBase = newEffectKey.trim() || `event_fx_${slugify(name)}`;
    const key = keyBase.toLowerCase();
    setBusy(true);
    const res = await fetch("/api/admin/avatar-effects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key,
        name,
        enabled: true,
        unlock_level: 1,
        unlock_points: 0,
        config: {},
        render_mode: "particles",
        z_layer: "behind_avatar",
        html: "",
        css: "",
        js: "",
        rule_keeper_multiplier: 1,
        rule_breaker_multiplier: 1,
        skill_pulse_multiplier: 1,
        spotlight_multiplier: 1,
        daily_free_points: 0,
        challenge_completion_bonus_pct: 0,
        mvp_bonus_pct: 0,
        limited_event_only: true,
        limited_event_name: selectedEvent.label ?? "",
        limited_event_description: selectedEvent.description ?? "",
      }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) {
      setBusy(false);
      return setMsg(String(sj.json?.error ?? "Failed to create effect"));
    }
    await writeRequirement("effect", key, true);
    setNewEffectName("");
    setNewEffectKey("");
    await loadAll();
    setBusy(false);
    setMsg("Event effect created.");
  }

  async function createEventBorder() {
    if (!selectedEventKey || !selectedEvent) return;
    const name = newBorderName.trim();
    if (!name) return;
    const keyBase = newBorderKey.trim() || `event_border_${slugify(name)}`;
    const key = keyBase.toLowerCase();
    setBusy(true);
    const res = await fetch("/api/admin/corner-borders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key,
        name,
        render_mode: "code",
        z_layer: "above_avatar",
        image_url: "",
        html: "<div class='event-border'></div>",
        css: ".event-border{position:absolute;inset:2px;border:2px solid rgba(56,189,248,.95);border-radius:14px;box-shadow:0 0 14px rgba(56,189,248,.55);}",
        js: "",
        unlock_level: 1,
        unlock_points: 0,
        enabled: true,
        rule_keeper_multiplier: 1,
        rule_breaker_multiplier: 1,
        skill_pulse_multiplier: 1,
        spotlight_multiplier: 1,
        daily_free_points: 0,
        challenge_completion_bonus_pct: 0,
        mvp_bonus_pct: 0,
        limited_event_only: true,
        limited_event_name: selectedEvent.label ?? "",
        limited_event_description: selectedEvent.description ?? "",
      }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) {
      setBusy(false);
      return setMsg(String(sj.json?.error ?? "Failed to create border effect"));
    }
    await writeRequirement("corner_border", key, true);
    setNewBorderName("");
    setNewBorderKey("");
    await loadAll();
    setBusy(false);
    setMsg("Event border effect created.");
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
    await loadAll();
  }

  async function saveEligibleStudents() {
    if (!selectedEventKey) return;
    const current = new Set(Array.from(fulfilledStudentSet));
    const next = eligibleDraftSet;
    const toEnable = Array.from(next).filter((id) => !current.has(id));
    const toDisable = Array.from(current).filter((id) => !next.has(id));
    if (!toEnable.length && !toDisable.length) {
      setEligibleDirty(false);
      setMsg("No eligibility changes to save.");
      return;
    }
    setBusy(true);
    for (const sid of toEnable) {
      const res = await fetch("/api/admin/unlock-criteria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_student_criteria",
          student_id: sid,
          criteria_key: selectedEventKey,
          fulfilled: true,
        }),
      });
      const sj = await safeJson(res);
      if (!sj.ok) {
        setBusy(false);
        return setMsg(String(sj.json?.error ?? "Failed to save student eligibility"));
      }
    }
    for (const sid of toDisable) {
      const res = await fetch("/api/admin/unlock-criteria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_student_criteria",
          student_id: sid,
          criteria_key: selectedEventKey,
          fulfilled: false,
        }),
      });
      const sj = await safeJson(res);
      if (!sj.ok) {
        setBusy(false);
        return setMsg(String(sj.json?.error ?? "Failed to save student eligibility"));
      }
    }
    await loadAll();
    setBusy(false);
    setEligibleDirty(false);
    setMsg("Eligible students saved.");
  }

  async function saveAvatarForEvent(row: AvatarRow) {
    if (!selectedEventKey || !selectedEvent) return;
    const draft = avatarDrafts[row.id] ?? {};
    const payload = { ...row, ...draft };
    setBusy(true);
    const res = await fetch("/api/admin/avatars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        unlock_level: Math.max(1, Math.floor(num(payload.unlock_level, 1))),
        unlock_points: Math.max(0, Math.floor(num(payload.unlock_points, 0))),
        daily_free_points: Math.max(0, Math.floor(num(payload.daily_free_points, 0))),
        zoom_pct: Math.max(50, Math.min(200, Math.floor(num(payload.zoom_pct, 100)))),
        limited_event_only: true,
        limited_event_name: selectedEvent.label ?? "",
        limited_event_description: selectedEvent.description ?? "",
      }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) {
      setBusy(false);
      return setMsg(String(sj.json?.error ?? "Failed to save avatar"));
    }
    await writeRequirement("avatar", row.id, true);
    await loadAll();
    setBusy(false);
    setMsg(`Saved ${payload.name}.`);
  }

  async function saveEffectForEvent(row: EffectRow) {
    if (!selectedEventKey || !selectedEvent) return;
    const draft = effectDrafts[row.key] ?? {};
    const payload = { ...row, ...draft };
    setBusy(true);
    const res = await fetch("/api/admin/avatar-effects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        unlock_level: Math.max(1, Math.floor(num(payload.unlock_level, 1))),
        unlock_points: Math.max(0, Math.floor(num(payload.unlock_points, 0))),
        limited_event_only: true,
        limited_event_name: selectedEvent.label ?? "",
        limited_event_description: selectedEvent.description ?? "",
      }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) {
      setBusy(false);
      return setMsg(String(sj.json?.error ?? "Failed to save effect"));
    }
    await writeRequirement("effect", row.key, true);
    await loadAll();
    setBusy(false);
    setMsg(`Saved ${payload.name}.`);
  }

  async function saveBorderForEvent(row: BorderRow) {
    if (!selectedEventKey || !selectedEvent) return;
    const draft = borderDrafts[row.key] ?? {};
    const payload = { ...row, ...draft };
    setBusy(true);
    const res = await fetch("/api/admin/corner-borders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        unlock_level: Math.max(1, Math.floor(num(payload.unlock_level, 1))),
        unlock_points: Math.max(0, Math.floor(num(payload.unlock_points, 0))),
        daily_free_points: Math.max(0, Math.floor(num(payload.daily_free_points, 0))),
        limited_event_only: true,
        limited_event_name: selectedEvent.label ?? "",
        limited_event_description: selectedEvent.description ?? "",
      }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) {
      setBusy(false);
      return setMsg(String(sj.json?.error ?? "Failed to save border effect"));
    }
    await writeRequirement("corner_border", row.key, true);
    await loadAll();
    setBusy(false);
    setMsg(`Saved ${payload.name}.`);
  }

  async function removeFromEvent(itemType: "avatar" | "effect" | "corner_border", itemKey: string) {
    if (!selectedEventKey) return;
    setBusy(true);
    const ok = await writeRequirement(itemType, itemKey, false);
    if (!ok) {
      setBusy(false);
      return setMsg("Failed to remove item from event.");
    }
    await loadAll();
    setBusy(false);
  }

  return (
    <main style={{ display: "grid", gap: 14 }}>
      <Link href="/admin/custom" style={backLink()}>← Back To Admin Workspace</Link>
      <div style={{ fontSize: 28, fontWeight: 1000 }}>Limited Events</div>
      <div style={{ opacity: 0.75, fontSize: 13 }}>
        Create event-limited avatars, effects, and border effects directly here, then assign eligible students.
      </div>
      {msg ? <div style={notice()}>{msg}</div> : null}

      <section style={card()}>
        <div style={{ fontWeight: 1000 }}>Create Event</div>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr auto" }}>
          <label style={fieldWrap()}>
            <div style={fieldName()}>Event Name</div>
            <input value={newEventName} onChange={(e) => setNewEventName(e.target.value)} placeholder="Event name" style={input()} />
          </label>
          <label style={fieldWrap()}>
            <div style={fieldName()}>Event Description</div>
            <input value={newEventDesc} onChange={(e) => setNewEventDesc(e.target.value)} placeholder="Event description" style={input()} />
          </label>
          <button type="button" onClick={createEvent} disabled={busy} style={btn()}>{busy ? "Saving..." : "Create"}</button>
        </div>
      </section>

      <section style={card()}>
        <div style={{ fontWeight: 1000 }}>Events</div>
        <div style={tabsWrap()}>
          {eventCriteria.map((e) => (
            <button
              key={e.key}
              type="button"
              style={eventTab(e.key === selectedEventKey)}
              onClick={() => setSelectedEventKey(e.key)}
            >
              {e.label}
            </button>
          ))}
          {!eventCriteria.length ? <div style={{ opacity: 0.75, fontSize: 12 }}>No events yet.</div> : null}
        </div>
        {selectedEvent ? (
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr 170px 170px 130px auto" }}>
            <label style={fieldWrap()}>
              <div style={fieldName()}>Event Label</div>
              <input value={editEventName} onChange={(e) => setEditEventName(e.target.value)} placeholder="Event label" style={input()} />
            </label>
            <label style={fieldWrap()}>
              <div style={fieldName()}>Event Description</div>
              <input value={editEventDesc} onChange={(e) => setEditEventDesc(e.target.value)} placeholder="Event description" style={input()} />
            </label>
            <label style={fieldWrap()}>
              <div style={fieldName()}>Start Date</div>
              <input type="date" value={editEventStartDate} onChange={(e) => setEditEventStartDate(e.target.value)} style={input()} title="Event start date" />
            </label>
            <label style={fieldWrap()}>
              <div style={fieldName()}>End Date</div>
              <input type="date" value={editEventEndDate} onChange={(e) => setEditEventEndDate(e.target.value)} style={input()} title="Event end date" />
            </label>
            <label style={fieldWrap()}>
              <div style={fieldName()}>Event Daily Free Points</div>
              <input
                value={String(editEventDailyPoints)}
                onChange={(e) => setEditEventDailyPoints(Math.max(0, Math.floor(num(e.target.value, 0))))}
                placeholder="0"
                style={input()}
              />
            </label>
            <button type="button" onClick={saveEventMeta} disabled={busy} style={btn()}>
              Save Event
            </button>
          </div>
        ) : null}
      </section>

      <section style={card()}>
        <div style={{ fontWeight: 1000 }}>Upload Event Avatars</div>
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          Upload single or multiple avatar files. Name is taken from each file name. Then edit modifiers below.
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => setUploadFiles(Array.from(e.target.files ?? []))}
          />
          <button type="button" onClick={uploadAvatarsToEvent} disabled={!selectedEventKey || busy || !uploadFiles.length} style={btn()}>
            {busy ? "Uploading..." : `Upload ${uploadFiles.length ? `(${uploadFiles.length})` : ""}`}
          </button>
        </div>
      </section>

      <section style={card()}>
        <div style={{ fontWeight: 1000 }}>Event Avatars ({eventAvatars.length})</div>
        <div style={eventAvatarGrid()}>
          {eventAvatars.map((row) => {
            const draft = avatarDrafts[row.id] ?? {};
            const merged = { ...row, ...draft };
            const src = merged.storage_path && avatarBase
              ? `${avatarBase}/storage/v1/object/public/avatars/${merged.storage_path}`
              : "";
            return (
              <div key={row.id} style={{ ...itemCard(), display: "grid", gap: 10, alignContent: "start" }}>
                <div style={eventAvatarPreview()}>
                  {src ? (
                    <img src={src} alt={String(merged.name ?? "Avatar")} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  ) : (
                    <div style={{ opacity: 0.72, fontSize: 12 }}>No preview image</div>
                  )}
                </div>
                <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
                  <label style={{ ...fieldWrap(), gridColumn: "1 / -1" }}>
                    <div style={fieldName()}>Avatar Name</div>
                    <input
                      value={String(merged.name ?? "")}
                      onChange={(e) => setAvatarDrafts((prev) => ({ ...prev, [row.id]: { ...(prev[row.id] ?? {}), name: e.target.value } }))}
                      style={input()}
                      placeholder="Avatar name"
                    />
                  </label>
                  <label style={fieldWrap()}>
                    <div style={fieldName()}>Unlock Level</div>
                    <input
                      value={String(num(merged.unlock_level, 1))}
                      onChange={(e) => setAvatarDrafts((prev) => ({ ...prev, [row.id]: { ...(prev[row.id] ?? {}), unlock_level: Math.floor(num(e.target.value, 1)) } }))}
                      style={input()}
                      placeholder="Unlock level"
                    />
                  </label>
                  <label style={fieldWrap()}>
                    <div style={fieldName()}>Unlock Points</div>
                    <input
                      value={String(num(merged.unlock_points, 0))}
                      onChange={(e) => setAvatarDrafts((prev) => ({ ...prev, [row.id]: { ...(prev[row.id] ?? {}), unlock_points: Math.floor(num(e.target.value, 0)) } }))}
                      style={input()}
                      placeholder="Unlock points"
                    />
                  </label>
                  <label style={fieldWrap()}>
                    <div style={fieldName()}>Rule Keeper Multiplier</div>
                    <input
                      value={String(num(merged.rule_keeper_multiplier, 1))}
                      onChange={(e) => setAvatarDrafts((prev) => ({ ...prev, [row.id]: { ...(prev[row.id] ?? {}), rule_keeper_multiplier: num(e.target.value, 1) } }))}
                      style={input()}
                      placeholder="1.00"
                    />
                  </label>
                  <label style={fieldWrap()}>
                    <div style={fieldName()}>Rule Breaker Multiplier</div>
                    <input
                      value={String(num(merged.rule_breaker_multiplier, 1))}
                      onChange={(e) => setAvatarDrafts((prev) => ({ ...prev, [row.id]: { ...(prev[row.id] ?? {}), rule_breaker_multiplier: num(e.target.value, 1) } }))}
                      style={input()}
                      placeholder="1.00"
                    />
                  </label>
                  <label style={fieldWrap()}>
                    <div style={fieldName()}>Skill Pulse Multiplier</div>
                    <input
                      value={String(num(merged.skill_pulse_multiplier, 1))}
                      onChange={(e) => setAvatarDrafts((prev) => ({ ...prev, [row.id]: { ...(prev[row.id] ?? {}), skill_pulse_multiplier: num(e.target.value, 1) } }))}
                      style={input()}
                      placeholder="1.00"
                    />
                  </label>
                  <label style={fieldWrap()}>
                    <div style={fieldName()}>Spotlight Multiplier</div>
                    <input
                      value={String(num(merged.spotlight_multiplier, 1))}
                      onChange={(e) => setAvatarDrafts((prev) => ({ ...prev, [row.id]: { ...(prev[row.id] ?? {}), spotlight_multiplier: num(e.target.value, 1) } }))}
                      style={input()}
                      placeholder="1.00"
                    />
                  </label>
                  <label style={fieldWrap()}>
                    <div style={fieldName()}>Daily Free Points</div>
                    <input
                      value={String(num(merged.daily_free_points, 0))}
                      onChange={(e) => setAvatarDrafts((prev) => ({ ...prev, [row.id]: { ...(prev[row.id] ?? {}), daily_free_points: Math.floor(num(e.target.value, 0)) } }))}
                      style={input()}
                      placeholder="0"
                    />
                  </label>
                  <label style={fieldWrap()}>
                    <div style={fieldName()}>MVP Bonus %</div>
                    <input
                      value={String(num(merged.mvp_bonus_pct, 0))}
                      onChange={(e) => setAvatarDrafts((prev) => ({ ...prev, [row.id]: { ...(prev[row.id] ?? {}), mvp_bonus_pct: num(e.target.value, 0) } }))}
                      style={input()}
                      placeholder="0"
                    />
                  </label>
                  <label style={fieldWrap()}>
                    <div style={fieldName()}>Challenge Bonus %</div>
                    <input
                      value={String(num(merged.challenge_completion_bonus_pct, 0))}
                      onChange={(e) => setAvatarDrafts((prev) => ({ ...prev, [row.id]: { ...(prev[row.id] ?? {}), challenge_completion_bonus_pct: num(e.target.value, 0) } }))}
                      style={input()}
                      placeholder="0"
                    />
                  </label>
                  <label style={fieldWrap()}>
                    <div style={fieldName()}>Avatar Zoom %</div>
                    <input
                      value={String(num(merged.zoom_pct, 100))}
                      onChange={(e) => setAvatarDrafts((prev) => ({ ...prev, [row.id]: { ...(prev[row.id] ?? {}), zoom_pct: Math.floor(num(e.target.value, 100)) } }))}
                      style={input()}
                      placeholder="Zoom %"
                    />
                  </label>
                  <label style={fieldWrap()}>
                    <div style={fieldName()}>Competition Discount %</div>
                    <input
                      value={String(num(merged.competition_discount_pct, 0))}
                      onChange={(e) => setAvatarDrafts((prev) => ({ ...prev, [row.id]: { ...(prev[row.id] ?? {}), competition_discount_pct: Math.floor(num(e.target.value, 0)) } }))}
                      style={input()}
                      placeholder="Comp discount %"
                    />
                  </label>
                  <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 800, fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={merged.competition_only === true}
                      onChange={(e) => setAvatarDrafts((prev) => ({ ...prev, [row.id]: { ...(prev[row.id] ?? {}), competition_only: e.target.checked } }))}
                    />
                    Competition only
                  </label>
                  <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 800, fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={merged.enabled !== false}
                      onChange={(e) => setAvatarDrafts((prev) => ({ ...prev, [row.id]: { ...(prev[row.id] ?? {}), enabled: e.target.checked } }))}
                    />
                    Enabled
                  </label>
                  <div style={{ display: "flex", gap: 8, gridColumn: "1 / -1" }}>
                    <button type="button" onClick={() => saveAvatarForEvent(row)} disabled={busy} style={{ ...btn(), flex: 1 }}>
                      Save
                    </button>
                    <button type="button" onClick={() => removeFromEvent("avatar", row.id)} disabled={busy} style={{ ...btnDanger(), flex: 1 }}>
                      Remove
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 11, opacity: 0.72 }}>ID: {row.id} • {row.storage_path || "No storage path"}</div>
              </div>
            );
          })}
          {!eventAvatars.length ? <div style={{ opacity: 0.72, fontSize: 12 }}>No avatars attached to this event yet.</div> : null}
        </div>
      </section>

      <section style={card()}>
        <div style={{ fontWeight: 1000 }}>Create Event Effect</div>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr auto" }}>
          <label style={fieldWrap()}>
            <div style={fieldName()}>Effect Name</div>
            <input value={newEffectName} onChange={(e) => setNewEffectName(e.target.value)} style={input()} placeholder="Effect name" />
          </label>
          <label style={fieldWrap()}>
            <div style={fieldName()}>Effect Key (optional)</div>
            <input value={newEffectKey} onChange={(e) => setNewEffectKey(e.target.value)} style={input()} placeholder="Effect key (optional)" />
          </label>
          <button type="button" onClick={createEventEffect} disabled={busy || !selectedEventKey || !newEffectName.trim()} style={btn()}>
            Create Effect
          </button>
        </div>
      </section>

      <section style={card()}>
        <div style={{ fontWeight: 1000 }}>Event Effects ({eventEffects.length})</div>
        <div style={listCol()}>
          {eventEffects.map((row) => {
            const draft = effectDrafts[row.key] ?? {};
            const merged = { ...row, ...draft };
            return (
              <div key={row.key} style={itemCard()}>
                <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
                  <label style={fieldWrap()}>
                    <div style={fieldName()}>Effect Name</div>
                    <input
                      value={String(merged.name ?? "")}
                      onChange={(e) => setEffectDrafts((prev) => ({ ...prev, [row.key]: { ...(prev[row.key] ?? {}), name: e.target.value } }))}
                      style={input()}
                      placeholder="Name"
                    />
                  </label>
                  <label style={fieldWrap()}>
                    <div style={fieldName()}>Unlock Level</div>
                    <input
                      value={String(num(merged.unlock_level, 1))}
                      onChange={(e) => setEffectDrafts((prev) => ({ ...prev, [row.key]: { ...(prev[row.key] ?? {}), unlock_level: Math.floor(num(e.target.value, 1)) } }))}
                      style={input()}
                      placeholder="Level"
                    />
                  </label>
                  <label style={fieldWrap()}>
                    <div style={fieldName()}>Unlock Points</div>
                    <input
                      value={String(num(merged.unlock_points, 0))}
                      onChange={(e) => setEffectDrafts((prev) => ({ ...prev, [row.key]: { ...(prev[row.key] ?? {}), unlock_points: Math.floor(num(e.target.value, 0)) } }))}
                      style={input()}
                      placeholder="Points"
                    />
                  </label>
                  <label style={fieldWrap()}>
                    <div style={fieldName()}>Render Mode</div>
                    <select
                      value={String(merged.render_mode ?? "particles")}
                      onChange={(e) => setEffectDrafts((prev) => ({ ...prev, [row.key]: { ...(prev[row.key] ?? {}), render_mode: e.target.value } }))}
                      style={input()}
                    >
                      <option value="particles">particles</option>
                      <option value="html">html</option>
                    </select>
                  </label>
                  <label style={fieldWrap()}>
                    <div style={fieldName()}>Rule Keeper Multiplier</div>
                    <input
                      value={String(num(merged.rule_keeper_multiplier, 1))}
                      onChange={(e) => setEffectDrafts((prev) => ({ ...prev, [row.key]: { ...(prev[row.key] ?? {}), rule_keeper_multiplier: num(e.target.value, 1) } }))}
                      style={input()}
                      placeholder="Keeper x"
                    />
                  </label>
                  <label style={fieldWrap()}>
                    <div style={fieldName()}>Rule Breaker Multiplier</div>
                    <input
                      value={String(num(merged.rule_breaker_multiplier, 1))}
                      onChange={(e) => setEffectDrafts((prev) => ({ ...prev, [row.key]: { ...(prev[row.key] ?? {}), rule_breaker_multiplier: num(e.target.value, 1) } }))}
                      style={input()}
                      placeholder="Breaker x"
                    />
                  </label>
                  <label style={fieldWrap()}>
                    <div style={fieldName()}>Skill Pulse Multiplier</div>
                    <input
                      value={String(num(merged.skill_pulse_multiplier, 1))}
                      onChange={(e) => setEffectDrafts((prev) => ({ ...prev, [row.key]: { ...(prev[row.key] ?? {}), skill_pulse_multiplier: num(e.target.value, 1) } }))}
                      style={input()}
                      placeholder="Skill x"
                    />
                  </label>
                  <label style={fieldWrap()}>
                    <div style={fieldName()}>Spotlight Multiplier</div>
                    <input
                      value={String(num(merged.spotlight_multiplier, 1))}
                      onChange={(e) => setEffectDrafts((prev) => ({ ...prev, [row.key]: { ...(prev[row.key] ?? {}), spotlight_multiplier: num(e.target.value, 1) } }))}
                      style={input()}
                      placeholder="Star x"
                    />
                  </label>
                  <label style={fieldWrap()}>
                    <div style={fieldName()}>Daily Free Points</div>
                    <input
                      value={String(num(merged.daily_free_points, 0))}
                      onChange={(e) => setEffectDrafts((prev) => ({ ...prev, [row.key]: { ...(prev[row.key] ?? {}), daily_free_points: Math.floor(num(e.target.value, 0)) } }))}
                      style={input()}
                      placeholder="Daily"
                    />
                  </label>
                  <label style={fieldWrap()}>
                    <div style={fieldName()}>Challenge Bonus %</div>
                    <input
                      value={String(num(merged.challenge_completion_bonus_pct, 0))}
                      onChange={(e) => setEffectDrafts((prev) => ({ ...prev, [row.key]: { ...(prev[row.key] ?? {}), challenge_completion_bonus_pct: num(e.target.value, 0) } }))}
                      style={input()}
                      placeholder="Challenge %"
                    />
                  </label>
                  <label style={fieldWrap()}>
                    <div style={fieldName()}>MVP Bonus %</div>
                    <input
                      value={String(num(merged.mvp_bonus_pct, 0))}
                      onChange={(e) => setEffectDrafts((prev) => ({ ...prev, [row.key]: { ...(prev[row.key] ?? {}), mvp_bonus_pct: num(e.target.value, 0) } }))}
                      style={input()}
                      placeholder="MVP %"
                    />
                  </label>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => saveEffectForEvent(row)} disabled={busy} style={btn()}>
                    Save
                  </button>
                  <button type="button" onClick={() => removeFromEvent("effect", row.key)} disabled={busy} style={btnDanger()}>
                    Remove
                  </button>
                </div>
                <div style={{ fontSize: 11, opacity: 0.72 }}>Key: {row.key}</div>
              </div>
            );
          })}
          {!eventEffects.length ? <div style={{ opacity: 0.72, fontSize: 12 }}>No effects attached to this event yet.</div> : null}
        </div>
      </section>

      <section style={card()}>
        <div style={{ fontWeight: 1000 }}>Create Event Border Effect</div>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr auto" }}>
          <label style={fieldWrap()}>
            <div style={fieldName()}>Border Effect Name</div>
            <input value={newBorderName} onChange={(e) => setNewBorderName(e.target.value)} style={input()} placeholder="Border effect name" />
          </label>
          <label style={fieldWrap()}>
            <div style={fieldName()}>Border Key (optional)</div>
            <input value={newBorderKey} onChange={(e) => setNewBorderKey(e.target.value)} style={input()} placeholder="Border key (optional)" />
          </label>
          <button type="button" onClick={createEventBorder} disabled={busy || !selectedEventKey || !newBorderName.trim()} style={btn()}>
            Create Border
          </button>
        </div>
      </section>

      <section style={card()}>
        <div style={{ fontWeight: 1000 }}>Event Border Effects ({eventBorders.length})</div>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          {eventBorders.map((row) => {
            const draft = borderDrafts[row.key] ?? {};
            const merged = { ...row, ...draft };
            const codePreview = `<style>${String(merged.css ?? "")}</style>${String(merged.html ?? "")}`;
            return (
              <div key={row.key} style={itemCard()}>
                <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
                  {["student_info", "skill_pulse_display", "roster_card"].map((ctx) => (
                    <div key={`${row.key}-${ctx}`} style={{ borderRadius: 10, border: "1px solid rgba(148,163,184,0.35)", minHeight: 94, background: "rgba(2,6,23,0.75)", position: "relative", overflow: "hidden", display: "grid", placeItems: "center" }}>
                      {previewAvatarSrc ? <img src={previewAvatarSrc} alt="preview avatar" style={{ width: 64, height: 64, objectFit: "contain", zIndex: 1 }} /> : <div style={{ fontSize: 11, opacity: 0.65 }}>No avatar</div>}
                      {String(merged.render_mode ?? "image") === "code" ? (
                        <div style={{ position: "absolute", inset: 4, pointerEvents: "none" }} dangerouslySetInnerHTML={{ __html: codePreview }} />
                      ) : merged.image_url ? (
                        <>
                          <img src={String(merged.image_url)} alt="" style={{ position: "absolute", top: -6, left: -6, width: 48, height: 48, objectFit: "contain", pointerEvents: "none" }} />
                          <img src={String(merged.image_url)} alt="" style={{ position: "absolute", bottom: -6, right: -6, width: 48, height: 48, objectFit: "contain", transform: "rotate(180deg)", pointerEvents: "none" }} />
                        </>
                      ) : null}
                      <div style={{ position: "absolute", left: 6, bottom: 5, fontSize: 10, opacity: 0.7 }}>{ctx}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
                  <label style={{ ...fieldWrap(), gridColumn: "1 / -1" }}>
                    <div style={fieldName()}>Border Name</div>
                    <input
                      value={String(merged.name ?? "")}
                      onChange={(e) => setBorderDrafts((prev) => ({ ...prev, [row.key]: { ...(prev[row.key] ?? {}), name: e.target.value } }))}
                      style={input()}
                      placeholder="Border name"
                    />
                  </label>
                  <label style={fieldWrap()}>
                    <div style={fieldName()}>Render Mode</div>
                    <select
                      value={String(merged.render_mode ?? "image")}
                      onChange={(e) => setBorderDrafts((prev) => ({ ...prev, [row.key]: { ...(prev[row.key] ?? {}), render_mode: e.target.value } }))}
                      style={input()}
                    >
                      <option value="image">image</option>
                      <option value="code">code</option>
                    </select>
                  </label>
                  <label style={fieldWrap()}>
                    <div style={fieldName()}>Image URL</div>
                    <input
                      value={String(merged.image_url ?? "")}
                      onChange={(e) => setBorderDrafts((prev) => ({ ...prev, [row.key]: { ...(prev[row.key] ?? {}), image_url: e.target.value } }))}
                      style={input()}
                      placeholder="Image URL"
                    />
                  </label>
                  {String(merged.render_mode ?? "image") === "code" ? (
                    <>
                      <label style={{ ...fieldWrap(), gridColumn: "1 / -1" }}>
                        <div style={fieldName()}>HTML Code</div>
                        <textarea
                          value={String(merged.html ?? "")}
                          onChange={(e) => setBorderDrafts((prev) => ({ ...prev, [row.key]: { ...(prev[row.key] ?? {}), html: e.target.value } }))}
                          style={{ ...input(), minHeight: 70, resize: "vertical", fontFamily: "monospace" }}
                          placeholder="HTML"
                        />
                      </label>
                      <label style={{ ...fieldWrap(), gridColumn: "1 / -1" }}>
                        <div style={fieldName()}>CSS Code</div>
                        <textarea
                          value={String(merged.css ?? "")}
                          onChange={(e) => setBorderDrafts((prev) => ({ ...prev, [row.key]: { ...(prev[row.key] ?? {}), css: e.target.value } }))}
                          style={{ ...input(), minHeight: 84, resize: "vertical", fontFamily: "monospace" }}
                          placeholder="CSS"
                        />
                      </label>
                      <label style={{ ...fieldWrap(), gridColumn: "1 / -1" }}>
                        <div style={fieldName()}>JS Code</div>
                        <textarea
                          value={String(merged.js ?? "")}
                          onChange={(e) => setBorderDrafts((prev) => ({ ...prev, [row.key]: { ...(prev[row.key] ?? {}), js: e.target.value } }))}
                          style={{ ...input(), minHeight: 70, resize: "vertical", fontFamily: "monospace" }}
                          placeholder="JS"
                        />
                      </label>
                    </>
                  ) : null}
                  <label style={fieldWrap()}>
                    <div style={fieldName()}>Unlock Level</div>
                    <input
                      value={String(num(merged.unlock_level, 1))}
                      onChange={(e) => setBorderDrafts((prev) => ({ ...prev, [row.key]: { ...(prev[row.key] ?? {}), unlock_level: Math.floor(num(e.target.value, 1)) } }))}
                      style={input()}
                      placeholder="Unlock level"
                    />
                  </label>
                  <label style={fieldWrap()}>
                    <div style={fieldName()}>Unlock Points</div>
                    <input
                      value={String(num(merged.unlock_points, 0))}
                      onChange={(e) => setBorderDrafts((prev) => ({ ...prev, [row.key]: { ...(prev[row.key] ?? {}), unlock_points: Math.floor(num(e.target.value, 0)) } }))}
                      style={input()}
                      placeholder="Unlock points"
                    />
                  </label>
                  <label style={fieldWrap()}>
                    <div style={fieldName()}>Rule Keeper Multiplier</div>
                    <input
                      value={String(num(merged.rule_keeper_multiplier, 1))}
                      onChange={(e) => setBorderDrafts((prev) => ({ ...prev, [row.key]: { ...(prev[row.key] ?? {}), rule_keeper_multiplier: num(e.target.value, 1) } }))}
                      style={input()}
                      placeholder="1.00"
                    />
                  </label>
                  <label style={fieldWrap()}>
                    <div style={fieldName()}>Rule Breaker Multiplier</div>
                    <input
                      value={String(num(merged.rule_breaker_multiplier, 1))}
                      onChange={(e) => setBorderDrafts((prev) => ({ ...prev, [row.key]: { ...(prev[row.key] ?? {}), rule_breaker_multiplier: num(e.target.value, 1) } }))}
                      style={input()}
                      placeholder="1.00"
                    />
                  </label>
                  <label style={fieldWrap()}>
                    <div style={fieldName()}>Skill Pulse Multiplier</div>
                    <input
                      value={String(num(merged.skill_pulse_multiplier, 1))}
                      onChange={(e) => setBorderDrafts((prev) => ({ ...prev, [row.key]: { ...(prev[row.key] ?? {}), skill_pulse_multiplier: num(e.target.value, 1) } }))}
                      style={input()}
                      placeholder="1.00"
                    />
                  </label>
                  <label style={fieldWrap()}>
                    <div style={fieldName()}>Spotlight Multiplier</div>
                    <input
                      value={String(num(merged.spotlight_multiplier, 1))}
                      onChange={(e) => setBorderDrafts((prev) => ({ ...prev, [row.key]: { ...(prev[row.key] ?? {}), spotlight_multiplier: num(e.target.value, 1) } }))}
                      style={input()}
                      placeholder="1.00"
                    />
                  </label>
                  <label style={fieldWrap()}>
                    <div style={fieldName()}>Daily Free Points</div>
                    <input
                      value={String(num(merged.daily_free_points, 0))}
                      onChange={(e) => setBorderDrafts((prev) => ({ ...prev, [row.key]: { ...(prev[row.key] ?? {}), daily_free_points: Math.floor(num(e.target.value, 0)) } }))}
                      style={input()}
                      placeholder="0"
                    />
                  </label>
                  <label style={fieldWrap()}>
                    <div style={fieldName()}>Challenge Bonus %</div>
                    <input
                      value={String(num(merged.challenge_completion_bonus_pct, 0))}
                      onChange={(e) => setBorderDrafts((prev) => ({ ...prev, [row.key]: { ...(prev[row.key] ?? {}), challenge_completion_bonus_pct: num(e.target.value, 0) } }))}
                      style={input()}
                      placeholder="0"
                    />
                  </label>
                  <label style={fieldWrap()}>
                    <div style={fieldName()}>MVP Bonus %</div>
                    <input
                      value={String(num(merged.mvp_bonus_pct, 0))}
                      onChange={(e) => setBorderDrafts((prev) => ({ ...prev, [row.key]: { ...(prev[row.key] ?? {}), mvp_bonus_pct: num(e.target.value, 0) } }))}
                      style={input()}
                      placeholder="0"
                    />
                  </label>
                  <div style={{ display: "flex", gap: 8, gridColumn: "1 / -1" }}>
                    <button type="button" onClick={() => saveBorderForEvent(row)} disabled={busy} style={{ ...btn(), flex: 1 }}>
                      Save
                    </button>
                    <button type="button" onClick={() => removeFromEvent("corner_border", row.key)} disabled={busy} style={{ ...btnDanger(), flex: 1 }}>
                      Remove
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 11, opacity: 0.72 }}>Key: {row.key}</div>
              </div>
            );
          })}
          {!eventBorders.length ? <div style={{ opacity: 0.72, fontSize: 12 }}>No border effects attached to this event yet.</div> : null}
        </div>
      </section>

      <section style={card()}>
        <div style={{ fontWeight: 1000 }}>Eligible Students</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, fontWeight: 900 }}>
            <input
              type="checkbox"
              checked={autoSaveEligible}
              onChange={(e) => setAutoSaveEligible(e.target.checked)}
            />
            Auto-save on click
          </label>
          {!autoSaveEligible ? (
            <button
              type="button"
              onClick={saveEligibleStudents}
              disabled={busy || !selectedEventKey || !eligibleDirty}
              style={btn()}
            >
              {busy ? "Saving..." : "Save Eligibility"}
            </button>
          ) : null}
        </div>
        {!autoSaveEligible && eligibleDirty ? (
          <div style={warningNotice()}>
            You have unsaved eligibility changes. Click "Save Eligibility" so this list matches who gets event daily bonus.
          </div>
        ) : null}
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.85 }}>
            Eligible list ({eligibleStudents.length})
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {eligibleStudents.length ? (
              eligibleStudents.map((s) => (
                <button
                  key={`eligible-${s.id}`}
                  type="button"
                  disabled={!selectedEventKey || busy}
                  onClick={() => {
                    if (autoSaveEligible) {
                      toggleStudent(s.id, false);
                      return;
                    }
                    setEligibleDraftSet((prev) => {
                      const next = new Set(prev);
                      next.delete(s.id);
                      return next;
                    });
                    setEligibleDirty(true);
                  }}
                  style={eligibleChip()}
                  title="Remove from eligible list"
                >
                  {s.name} ×
                </button>
              ))
            ) : (
              <div style={{ fontSize: 12, opacity: 0.7 }}>No eligible students selected yet.</div>
            )}
          </div>
        </div>
        <input value={studentQuery} onChange={(e) => setStudentQuery(e.target.value)} placeholder="Search students..." style={input()} />
        <div style={grid()}>
          {filteredStudents.map((s) => {
            const sid = String(s.id);
            const on = activeEligibleSet.has(sid);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  if (autoSaveEligible) {
                    toggleStudent(sid, !on);
                    return;
                  }
                  setEligibleDraftSet((prev) => {
                    const next = new Set(prev);
                    if (next.has(sid)) next.delete(sid);
                    else next.add(sid);
                    return next;
                  });
                  setEligibleDirty(true);
                }}
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

function fieldWrap(): React.CSSProperties {
  return {
    display: "grid",
    gap: 4,
  };
}

function fieldName(): React.CSSProperties {
  return {
    fontSize: 10,
    fontWeight: 900,
    opacity: 0.78,
    letterSpacing: 0.2,
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

function btnDanger(): React.CSSProperties {
  return {
    padding: "9px 12px",
    borderRadius: 10,
    border: "1px solid rgba(248,113,113,0.4)",
    background: "rgba(153,27,27,0.3)",
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

function listCol(): React.CSSProperties {
  return {
    display: "grid",
    gap: 8,
  };
}

function eventAvatarGrid(): React.CSSProperties {
  return {
    display: "grid",
    gap: 10,
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    alignItems: "start",
  };
}

function eventAvatarPreview(): React.CSSProperties {
  return {
    width: "100%",
    aspectRatio: "1 / 1",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.35)",
    background: "radial-gradient(circle at 30% 25%, rgba(30,64,175,0.25), rgba(15,23,42,0.78))",
    overflow: "hidden",
    display: "grid",
    placeItems: "center",
  };
}

function itemCard(): React.CSSProperties {
  return {
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.35)",
    background: "rgba(2,6,23,0.42)",
    padding: 10,
    display: "grid",
    gap: 8,
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

function eligibleChip(): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(16,185,129,0.45)",
    background: "rgba(6,95,70,0.34)",
    color: "#d1fae5",
    fontWeight: 900,
    fontSize: 12,
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

function warningNotice(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(245,158,11,0.55)",
    background: "rgba(120,53,15,0.35)",
    fontWeight: 900,
    fontSize: 12,
    color: "#fde68a",
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

function tabsWrap(): React.CSSProperties {
  return {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  };
}

function eventTab(active: boolean): React.CSSProperties {
  return {
    borderRadius: 999,
    border: active ? "1px solid rgba(56,189,248,0.7)" : "1px solid rgba(148,163,184,0.4)",
    background: active ? "rgba(14,165,233,0.24)" : "rgba(15,23,42,0.62)",
    color: "white",
    padding: "6px 10px",
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
  };
}

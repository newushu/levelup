"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type TrackerSkill = {
  id: string;
  name: string;
  category?: string | null;
  enabled?: boolean | null;
  failure_reasons?: string[];
  base_name?: string | null;
  quality?: string | null;
  supplement?: string | null;
  landing?: string | null;
  rotation?: string | null;
  combo_key?: string | null;
  created_at?: string | null;
};

type SkillElement = {
  id: string;
  element_type: string;
  label: string;
  is_skill_name?: boolean | null;
  enabled?: boolean | null;
  sort_order?: number | null;
  readonly?: boolean;
};

const LEGACY_CUTOFF = new Date("2026-01-17T23:59:59.999Z");

export default function SkillTrackerAdminPage() {
  const [skills, setSkills] = useState<TrackerSkill[]>([]);
  const [elements, setElements] = useState<SkillElement[]>([]);
  const [msg, setMsg] = useState("");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [visibilityFilter, setVisibilityFilter] = useState("All");
  const [elementFilters, setElementFilters] = useState({
    base_name: "",
    quality: "",
    supplement: "",
    rotation: "",
    landing: "",
  });
  const [newElementDrafts, setNewElementDrafts] = useState<Record<string, string>>({});
  const [addDraft, setAddDraft] = useState({
    base_name: "",
    quality: "",
    supplement: "",
    rotation: "",
    landing: "",
    category: "",
  });
  const [editDraft, setEditDraft] = useState({
    skill_id: "",
    base_name: "",
    quality: "",
    supplement: "",
    rotation: "",
    landing: "",
    category: "",
  });
  const [creating, setCreating] = useState(false);
  const [editNameDraft, setEditNameDraft] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [pinSet, setPinSet] = useState(false);
  const [pinMsg, setPinMsg] = useState("");
  const [pinSaving, setPinSaving] = useState(false);

  async function loadSkills() {
    setMsg("");
    const res = await fetch("/api/tracker-skills/list", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data?.error || "Failed to load tracker skills");
    const list = (data.skills ?? []) as TrackerSkill[];
    setSkills(list);
    return list;
  }

  useEffect(() => {
    loadSkills();
    loadElements();
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/skill-tracker/settings", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setPinSet(Boolean(data?.settings?.admin_pin_set));
    })();
  }, []);

  async function loadElements() {
    const res = await fetch("/api/tracker-skill-elements/list", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data?.error || "Failed to load skill elements");
    setElements((data.elements ?? []) as SkillElement[]);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = skills;
    const hasElements = (s: TrackerSkill) =>
      [s.base_name, s.quality, s.supplement, s.rotation, s.landing].some((v) => String(v ?? "").trim());
    if (visibilityFilter === "Visible") {
      list = list.filter((s) => s.enabled !== false && hasElements(s));
    } else if (visibilityFilter === "Hidden") {
      list = list.filter((s) => s.enabled === false || !hasElements(s));
    }
    if (categoryFilter !== "All Categories") {
      list = list.filter((s) => String(s.category ?? "Uncategorized") === categoryFilter);
    }
    if (elementFilters.base_name) {
      list = list.filter(
        (s) => String(s.base_name ?? s.name ?? "").trim() === elementFilters.base_name
      );
    }
    if (elementFilters.quality) {
      list = list.filter((s) => String(s.quality ?? "").trim() === elementFilters.quality);
    }
    if (elementFilters.supplement) {
      list = list.filter((s) => String(s.supplement ?? "").trim() === elementFilters.supplement);
    }
    if (elementFilters.rotation) {
      list = list.filter((s) => String(s.rotation ?? "").trim() === elementFilters.rotation);
    }
    if (elementFilters.landing) {
      list = list.filter((s) => String(s.landing ?? "").trim() === elementFilters.landing);
    }
    if (!q) return list;
    return list.filter((s) => `${s.name ?? ""} ${s.category ?? ""}`.toLowerCase().includes(q));
  }, [skills, query, categoryFilter, visibilityFilter, elementFilters]);

  const categories = useMemo(() => {
    const names = new Set<string>();
    skills.forEach((s) => names.add(String(s.category ?? "Uncategorized")));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [skills]);

  const elementTypes = useMemo(
    () => [
      { key: "name", label: "Skill Name" },
      { key: "quality", label: "Skill Quality" },
      { key: "supplement", label: "Skill Supplement" },
      { key: "rotation", label: "Rotation" },
      { key: "landing", label: "Landing" },
    ],
    []
  );

  const elementsByType = useMemo(() => {
    const map = new Map<string, SkillElement[]>();
    elements.forEach((el) => {
      const type = String(el.element_type ?? "");
      if (type === "name" && el.is_skill_name === false) return;
      if (!map.has(type)) map.set(type, []);
      map.get(type)!.push({ ...el, readonly: false });
    });
    map.forEach((list) => list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.label.localeCompare(b.label)));
    return map;
  }, [elements]);

  const nameOptions = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ id: string; label: string }> = [];
    (elementsByType.get("name") ?? []).forEach((el) => {
      const label = String(el.label ?? "").trim();
      if (!label || seen.has(label.toLowerCase())) return;
      seen.add(label.toLowerCase());
      list.push({ id: el.id, label });
    });
    return list.sort((a, b) => a.label.localeCompare(b.label));
  }, [elementsByType]);

  const editingSkill = useMemo(
    () => skills.find((skill) => skill.id === editDraft.skill_id),
    [editDraft.skill_id, skills]
  );

  const isLegacyEdit = useMemo(() => {
    if (!editingSkill?.created_at) return false;
    return new Date(editingSkill.created_at) <= LEGACY_CUTOFF;
  }, [editingSkill]);

  const editNameOptions = useMemo(() => {
    const label = editDraft.base_name.trim();
    if (!label) return nameOptions;
    const exists = nameOptions.some((opt) => opt.label.toLowerCase() === label.toLowerCase());
    if (exists) return nameOptions;
    return [{ id: `legacy:${label.toLowerCase()}`, label }, ...nameOptions];
  }, [editDraft.base_name, nameOptions]);

  const selectedSkills = useMemo(
    () => selectedIds.map((id) => skills.find((s) => s.id === id)).filter(Boolean) as TrackerSkill[],
    [selectedIds, skills]
  );

  async function saveAddSkill() {
    const baseName = addDraft.base_name.trim();
    if (!baseName) return setMsg("Select a skill name.");
    const hasElements = [addDraft.quality, addDraft.supplement, addDraft.rotation, addDraft.landing].some((v) =>
      String(v ?? "").trim()
    );
    if (!hasElements) return setMsg("Select at least one element to create a skill.");
    setCreating(true);
    setMsg("");
    const payload = {
      base_name: addDraft.base_name.trim(),
      quality: addDraft.quality.trim(),
      supplement: addDraft.supplement.trim(),
      rotation: addDraft.rotation.trim(),
      landing: addDraft.landing.trim(),
      category: addDraft.category.trim(),
    };
    const res = await fetch("/api/tracker-skills/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setCreating(false);
      return setMsg(data?.error || "Failed to save skill");
    }
    setAddDraft({
      base_name: "",
      quality: "",
      supplement: "",
      rotation: "",
      landing: "",
      category: "",
    });
    await loadSkills();
    setCreating(false);
  }

  async function saveEditSkill() {
    const skillId = editDraft.skill_id;
    const baseName = editDraft.base_name.trim();
    if (!skillId) return setMsg("Select a skill to edit.");
    if (!baseName) return setMsg("Select a skill name.");
    const hasElements = [editDraft.quality, editDraft.supplement, editDraft.rotation, editDraft.landing].some((v) =>
      String(v ?? "").trim()
    );
    if (!hasElements && !isLegacyEdit) {
      return setMsg("New skills need at least one element.");
    }
    setCreating(true);
    setMsg("");
    const payload = {
      skill_id: skillId,
      base_name: editDraft.base_name.trim(),
      quality: editDraft.quality.trim(),
      supplement: editDraft.supplement.trim(),
      rotation: editDraft.rotation.trim(),
      landing: editDraft.landing.trim(),
      category: editDraft.category.trim(),
    };
    const res = await fetch("/api/tracker-skills/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setCreating(false);
      return setMsg(data?.error || "Failed to save skill");
    }
    const list = await loadSkills();
    applyEditSkill(skillId, list);
    setCreating(false);
  }

  async function addElementOption(elementType: string) {
    const label = String(newElementDrafts[elementType] ?? "").trim();
    if (!label) return;
    const res = await fetch("/api/tracker-skill-elements/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ element_type: elementType, label }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data?.error || "Failed to add element");
    setNewElementDrafts((prev) => ({ ...prev, [elementType]: "" }));
    await loadElements();
  }

  async function toggleElement(el: SkillElement) {
    const res = await fetch("/api/tracker-skill-elements/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ element_id: el.id, enabled: !el.enabled }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data?.error || "Failed to update element");
    await loadElements();
  }

  function applyEditSkill(skillId: string, list: TrackerSkill[] = skills) {
    const skill = list.find((s) => s.id === skillId);
    if (!skill) {
      setEditDraft({
        skill_id: "",
        base_name: "",
        quality: "",
        supplement: "",
        rotation: "",
        landing: "",
        category: "",
      });
      setEditNameDraft("");
      return;
    }
    setEditDraft({
      skill_id: skill.id,
      base_name: skill.base_name ?? skill.name ?? "",
      quality: skill.quality ?? "",
      supplement: skill.supplement ?? "",
      rotation: skill.rotation ?? "",
      landing: skill.landing ?? "",
      category: skill.category ?? "",
    });
    setEditNameDraft(skill.name ?? "");
  }

  async function toggleSkill(skill: TrackerSkill) {
    setSaving((prev) => ({ ...prev, [skill.id]: true }));
    const res = await fetch("/api/tracker-skills/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skill_id: skill.id, enabled: !skill.enabled }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(data?.error || "Failed to update skill");
    await loadSkills();
    setSaving((prev) => ({ ...prev, [skill.id]: false }));
  }

  async function saveReasons(skill: TrackerSkill) {
    const raw = drafts[skill.id] ?? (skill.failure_reasons ?? []).join(", ");
    const reasons = raw
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);
    const key = String(skill.base_name ?? skill.name ?? "").trim().toLowerCase();
    const targetIds = skills
      .filter((s) => String(s.base_name ?? s.name ?? "").trim().toLowerCase() === key)
      .map((s) => s.id);
    setSaving((prev) => {
      const next = { ...prev };
      targetIds.forEach((id) => {
        next[id] = true;
      });
      return next;
    });
    const results = await Promise.all(
      targetIds.map(async (id) => {
        const res = await fetch("/api/tracker-skills/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skill_id: id, failure_reasons: reasons }),
        });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, error: data?.error };
      })
    );
    const failed = results.find((r) => !r.ok);
    if (failed) setMsg(failed.error || "Failed to save reasons");
    await loadSkills();
    setSaving((prev) => {
      const next = { ...prev };
      targetIds.forEach((id) => {
        next[id] = false;
      });
      return next;
    });
  }

  async function saveNameOverride() {
    const skillId = editDraft.skill_id;
    if (!skillId) return;
    const name = editNameDraft.trim();
    if (!name) return setMsg("Enter a skill name.");
    setRenaming(true);
    setMsg("");
    const res = await fetch("/api/tracker-skills/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skill_id: skillId, name }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setRenaming(false);
      return setMsg(data?.error || "Failed to rename skill");
    }
    const list = await loadSkills();
    applyEditSkill(skillId, list);
    setRenaming(false);
  }

  async function saveAdminPin() {
    setPinMsg("");
    if (!pinValue.trim()) return setPinMsg("Enter a new admin PIN.");
    setPinSaving(true);
    const res = await fetch("/api/skill-tracker/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ admin_pin: pinValue.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setPinSaving(false);
      return setPinMsg(data?.error || "Failed to save admin PIN");
    }
    setPinSet(true);
    setPinValue("");
    setPinSaving(false);
    setPinMsg("Admin PIN saved.");
  }

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 1000 }}>Skill Tracker</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Failure reasons show up in the rep annotate overlay.</div>
        </div>
        <Link href="/admin/custom" style={backLink()}>
          Return to Custom
        </Link>
      </div>

      {msg && (
        <div style={{ padding: 10, borderRadius: 14, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(255,255,255,0.10)" }}>
          {msg}
        </div>
      )}

      <div style={card()}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 1000 }}>Admin Edit PIN</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {pinSet ? "PIN is set." : "No PIN set yet."} This PIN unlocks admin edits on completed trackers.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
            <input
              type="password"
              value={pinValue}
              onChange={(e) => setPinValue(e.target.value)}
              placeholder="Set admin PIN"
              style={inputLarge()}
            />
            <button onClick={saveAdminPin} style={btn()} disabled={pinSaving}>
              {pinSaving ? "Saving..." : "Save PIN"}
            </button>
          </div>
          {pinMsg ? <div style={{ fontSize: 12, color: pinMsg.includes("saved") ? "rgba(34,197,94,0.9)" : "rgba(239,68,68,0.9)" }}>{pinMsg}</div> : null}
        </div>
      </div>

      <div style={card()}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 1000 }}>Skill Elements</div>
          <div style={{ display: "grid", gap: 12 }}>
            {elementTypes.map((type) => {
              const list = elementsByType.get(type.key) ?? [];
              return (
                <div key={type.key} style={elementRow()}>
                  <div style={{ fontWeight: 900 }}>{type.label}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                    <input
                      value={newElementDrafts[type.key] ?? ""}
                      onChange={(e) => setNewElementDrafts((prev) => ({ ...prev, [type.key]: e.target.value }))}
                      placeholder={`Add ${type.label.toLowerCase()}`}
                      style={inputLarge()}
                    />
                    <button onClick={() => addElementOption(type.key)} style={btn()}>
                      Add
                    </button>
                  </div>
                  {list.length ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {list.map((el) => (
                        <button
                          key={el.id}
                          onClick={() => {
                            if (el.readonly) return;
                            toggleElement(el);
                          }}
                          style={elementChip(el.enabled !== false, !!el.readonly)}
                          title={el.readonly ? "From tracker skills" : el.enabled === false ? "Click to enable" : "Click to disable"}
                          disabled={!!el.readonly}
                        >
                          {el.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div style={{ opacity: 0.6, fontSize: 12 }}>No options yet.</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={card()}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 1000 }}>Add Skill Combination</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            <select
              value={addDraft.base_name}
              onChange={(e) => setAddDraft((prev) => ({ ...prev, base_name: e.target.value }))}
              style={inputLarge()}
            >
              <option value="">Skill name</option>
              {nameOptions.map((el) => (
                <option key={el.id} value={el.label}>
                  {el.label}
                </option>
              ))}
            </select>
            <select
              value={addDraft.quality}
              onChange={(e) => setAddDraft((prev) => ({ ...prev, quality: e.target.value }))}
              style={inputLarge()}
            >
              <option value="">Quality</option>
              {(elementsByType.get("quality") ?? []).map((el) => (
                <option key={el.id} value={el.label}>
                  {el.label}
                </option>
              ))}
            </select>
            <select
              value={addDraft.supplement}
              onChange={(e) => setAddDraft((prev) => ({ ...prev, supplement: e.target.value }))}
              style={inputLarge()}
            >
              <option value="">Supplement</option>
              {(elementsByType.get("supplement") ?? []).map((el) => (
                <option key={el.id} value={el.label}>
                  {el.label}
                </option>
              ))}
            </select>
            <select
              value={addDraft.rotation}
              onChange={(e) => setAddDraft((prev) => ({ ...prev, rotation: e.target.value }))}
              style={inputLarge()}
            >
              <option value="">Rotation</option>
              {(elementsByType.get("rotation") ?? []).map((el) => (
                <option key={el.id} value={el.label}>
                  {el.label}
                </option>
              ))}
            </select>
            <select
              value={addDraft.landing}
              onChange={(e) => setAddDraft((prev) => ({ ...prev, landing: e.target.value }))}
              style={inputLarge()}
            >
              <option value="">Landing</option>
              {(elementsByType.get("landing") ?? []).map((el) => (
                <option key={el.id} value={el.label}>
                  {el.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
            <select
              value={addDraft.category}
              onChange={(e) => setAddDraft((prev) => ({ ...prev, category: e.target.value }))}
              style={inputLarge()}
            >
              <option value="">Category</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={saveAddSkill} style={btn()} disabled={creating}>
              {creating ? "Saving..." : "Add Skill"}
            </button>
          </div>
        </div>
      </div>

      <div style={card()}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 1000 }}>Edit Skill</div>
          <select
            value={editDraft.skill_id}
            onChange={(e) => applyEditSkill(e.target.value)}
            style={inputLarge()}
          >
            <option value="">Select a skill</option>
            {skills.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.name}{skill.category ? ` (${skill.category})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {editDraft.skill_id ? (
        <div style={card()}>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 1000 }}>Edit Skill Combination</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              {isLegacyEdit
                ? "Legacy skill: you can split the old name into elements and keep the same ID."
                : "New skills require at least one element beyond the skill name."}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
              <select
                value={editDraft.base_name}
                onChange={(e) => setEditDraft((prev) => ({ ...prev, base_name: e.target.value }))}
                style={inputLarge()}
              >
                <option value="">Skill name</option>
                {editNameOptions.map((el) => (
                  <option key={el.id} value={el.label}>
                    {el.label}
                  </option>
                ))}
              </select>
              <select
                value={editDraft.quality}
                onChange={(e) => setEditDraft((prev) => ({ ...prev, quality: e.target.value }))}
                style={inputLarge()}
              >
                <option value="">Quality</option>
                {(elementsByType.get("quality") ?? []).map((el) => (
                  <option key={el.id} value={el.label}>
                    {el.label}
                  </option>
                ))}
              </select>
              <select
                value={editDraft.supplement}
                onChange={(e) => setEditDraft((prev) => ({ ...prev, supplement: e.target.value }))}
                style={inputLarge()}
              >
                <option value="">Supplement</option>
                {(elementsByType.get("supplement") ?? []).map((el) => (
                  <option key={el.id} value={el.label}>
                    {el.label}
                  </option>
                ))}
              </select>
              <select
                value={editDraft.rotation}
                onChange={(e) => setEditDraft((prev) => ({ ...prev, rotation: e.target.value }))}
                style={inputLarge()}
              >
                <option value="">Rotation</option>
                {(elementsByType.get("rotation") ?? []).map((el) => (
                  <option key={el.id} value={el.label}>
                    {el.label}
                  </option>
                ))}
              </select>
              <select
                value={editDraft.landing}
                onChange={(e) => setEditDraft((prev) => ({ ...prev, landing: e.target.value }))}
                style={inputLarge()}
              >
                <option value="">Landing</option>
                {(elementsByType.get("landing") ?? []).map((el) => (
                  <option key={el.id} value={el.label}>
                    {el.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
              <select
                value={editDraft.category}
                onChange={(e) => setEditDraft((prev) => ({ ...prev, category: e.target.value }))}
                style={inputLarge()}
              >
                <option value="">Category</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => applyEditSkill("")}
                style={btnGhost()}
              >
                Clear
              </button>
              <button onClick={saveEditSkill} style={btn()} disabled={creating}>
                {creating ? "Saving..." : "Update Skill"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editDraft.skill_id ? (
        <div style={card()}>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 1000 }}>Edit Skill Name</div>
            <input
              value={editNameDraft}
              onChange={(e) => setEditNameDraft(e.target.value)}
              placeholder="Type a new skill name"
              style={inputLarge()}
            />
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={saveNameOverride} style={btn()} disabled={renaming}>
                {renaming ? "Saving..." : "Rename Skill"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div style={card()}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 1000 }}>Filters</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tracker skills..."
              style={inputLarge()}
            />
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={inputLarge()}>
              <option value="All Categories">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <select value={visibilityFilter} onChange={(e) => setVisibilityFilter(e.target.value)} style={inputLarge()}>
              <option value="All">All visibility</option>
              <option value="Visible">Visible</option>
              <option value="Hidden">Hidden</option>
            </select>
            <select
              value={elementFilters.base_name}
              onChange={(e) => setElementFilters((prev) => ({ ...prev, base_name: e.target.value }))}
              style={inputLarge()}
            >
              <option value="">Any skill name</option>
              {(elementsByType.get("name") ?? []).map((el) => (
                <option key={el.id} value={el.label}>
                  {el.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            <select
              value={elementFilters.quality}
              onChange={(e) => setElementFilters((prev) => ({ ...prev, quality: e.target.value }))}
              style={inputLarge()}
            >
              <option value="">Any quality</option>
              {(elementsByType.get("quality") ?? []).map((el) => (
                <option key={el.id} value={el.label}>
                  {el.label}
                </option>
              ))}
            </select>
            <select
              value={elementFilters.supplement}
              onChange={(e) => setElementFilters((prev) => ({ ...prev, supplement: e.target.value }))}
              style={inputLarge()}
            >
              <option value="">Any supplement</option>
              {(elementsByType.get("supplement") ?? []).map((el) => (
                <option key={el.id} value={el.label}>
                  {el.label}
                </option>
              ))}
            </select>
            <select
              value={elementFilters.rotation}
              onChange={(e) => setElementFilters((prev) => ({ ...prev, rotation: e.target.value }))}
              style={inputLarge()}
            >
              <option value="">Any rotation</option>
              {(elementsByType.get("rotation") ?? []).map((el) => (
                <option key={el.id} value={el.label}>
                  {el.label}
                </option>
              ))}
            </select>
            <select
              value={elementFilters.landing}
              onChange={(e) => setElementFilters((prev) => ({ ...prev, landing: e.target.value }))}
              style={inputLarge()}
            >
              <option value="">Any landing</option>
              {(elementsByType.get("landing") ?? []).map((el) => (
                <option key={el.id} value={el.label}>
                  {el.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div style={card()}>
        <div style={{ fontWeight: 1000, marginBottom: 10 }}>Choose Skills</div>
        <div style={choiceGrid()}>
          {filtered.map((skill) => {
            const selected = selectedIds.includes(skill.id);
            const reasonCount = (skill.failure_reasons ?? []).length;
            const hasElements = [
              skill.base_name,
              skill.quality,
              skill.supplement,
              skill.rotation,
              skill.landing,
            ].some((v) => String(v ?? "").trim());
            const hiddenByElements = !hasElements;
            const hiddenByToggle = skill.enabled === false;
            const isHidden = hiddenByToggle || hiddenByElements;
            return (
              <div
                key={skill.id}
                role="button"
                tabIndex={0}
                onClick={() =>
                  setSelectedIds((prev) =>
                    prev.includes(skill.id) ? prev.filter((id) => id !== skill.id) : [...prev, skill.id]
                  )
                }
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  setSelectedIds((prev) =>
                    prev.includes(skill.id) ? prev.filter((id) => id !== skill.id) : [...prev, skill.id]
                  );
                }}
                style={choiceCard(selected, isHidden)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div style={{ fontWeight: 1000 }}>{skill.name}</div>
                  <span style={reasonPill(reasonCount)}>{reasonCount} reasons</span>
                </div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>{skill.category ?? "Uncategorized"}</div>
                <div style={{ opacity: 0.7, fontSize: 11, marginTop: 4 }}>
                  {[skill.base_name, skill.quality, skill.supplement, skill.rotation, skill.landing]
                    .map((v) => String(v ?? "").trim())
                    .filter(Boolean)
                    .join(" • ")}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                  <div style={{ fontSize: 11, opacity: 0.65 }}>
                    {hiddenByElements ? "Hidden (needs elements)" : isHidden ? "Hidden" : "Visible"}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedIds((prev) =>
                          prev.includes(skill.id) ? prev : [...prev, skill.id]
                        );
                      }}
                      style={chipBtn()}
                    >
                      Reasons
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (hiddenByElements && !hiddenByToggle) return;
                        toggleSkill(skill);
                      }}
                      style={chipBtn()}
                      disabled={hiddenByElements && !hiddenByToggle}
                    >
                      {hiddenByToggle ? "Unhide" : hiddenByElements ? "Needs elements" : "Hide"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {!filtered.length && <div style={{ opacity: 0.7 }}>No tracker skills found.</div>}
        </div>
      </div>

      {!!selectedSkills.length && (
        <div style={cardWide()}>
          <div style={{ fontWeight: 1000, marginBottom: 10 }}>Failure Reasons</div>
          <div style={{ display: "grid", gap: 12 }}>
            {selectedSkills.map((skill) => {
              const defaultText = (skill.failure_reasons ?? []).join(", ");
              return (
                <div key={skill.id} style={editorCard()}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 1000 }}>{skill.name}</div>
                    <div style={{ opacity: 0.7, fontSize: 12 }}>{skill.category ?? "Uncategorized"}</div>
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>
                    {skill.enabled ? "Visible" : "Hidden"}
                  </div>
                </div>
                  <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                      Failure reasons (comma-separated)
                    </div>
                    <textarea
                      value={drafts[skill.id] ?? defaultText}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [skill.id]: e.target.value }))}
                      placeholder="Too low, Off balance, Wrong arm..."
                      style={textareaLarge()}
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button onClick={() => saveReasons(skill)} style={btn()} disabled={!!saving[skill.id]}>
                        {saving[skill.id] ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}

function card(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: 14,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
  };
}

function cardWide(): React.CSSProperties {
  return {
    ...card(),
    padding: 18,
  };
}

function editorCard(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 16,
    background: "rgba(9,12,19,0.75)",
    border: "1px solid rgba(255,255,255,0.12)",
  };
}

function inputLarge(): React.CSSProperties {
  return {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.24)",
    color: "white",
    outline: "none",
    fontSize: 15,
  };
}

function textareaLarge(): React.CSSProperties {
  return {
    ...inputLarge(),
    minHeight: 110,
    resize: "vertical",
    lineHeight: 1.5,
  };
}

function btn(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "linear-gradient(90deg, rgba(59,130,246,0.85), rgba(34,197,94,0.70))",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
  };
}

function btnGhost(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(15,23,42,0.45)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function choiceGrid(): React.CSSProperties {
  return {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  };
}

function choiceCard(active: boolean, hidden: boolean): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 12,
    border: active ? "1px solid rgba(59,130,246,0.6)" : "1px solid rgba(255,255,255,0.12)",
    background: hidden ? "rgba(15,23,42,0.3)" : "rgba(15,23,42,0.6)",
    color: "white",
    cursor: "pointer",
    textAlign: "left",
    boxShadow: active ? "0 10px 24px rgba(59,130,246,0.15)" : "none",
  };
}

function reasonPill(count: number): React.CSSProperties {
  return {
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 999,
    background: count ? "rgba(34,197,94,0.2)" : "rgba(148,163,184,0.2)",
    border: "1px solid rgba(255,255,255,0.14)",
    color: "white",
  };
}

function chipBtn(): React.CSSProperties {
  return {
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 800,
    fontSize: 11,
    cursor: "pointer",
  };
}

function elementRow(): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.35)",
    display: "grid",
    gap: 8,
  };
}

function elementChip(active: boolean, readonly = false): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: active ? "1px solid rgba(59,130,246,0.6)" : "1px solid rgba(255,255,255,0.12)",
    background: active ? "rgba(59,130,246,0.18)" : "rgba(15,23,42,0.45)",
    color: "white",
    fontWeight: 800,
    fontSize: 11,
    cursor: readonly ? "default" : "pointer",
    opacity: readonly ? 0.75 : 1,
  };
}

function backLink(): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 12,
  };
}

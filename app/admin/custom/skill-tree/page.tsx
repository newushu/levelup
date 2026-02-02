"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type SkillRow = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  level: number;
  points: number;
  points_award?: number | null;
  enabled: boolean;
  set_name?: string | null;
  set_id?: string | null;
  sort_order?: number | null;
};

type DraftRow = SkillRow & { isDraft: boolean; draftSet?: string };

export default function SkillTreeAdminPage() {
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [msg, setMsg] = useState("");
  const [newSetName, setNewSetName] = useState("");
  const [newSetLevels, setNewSetLevels] = useState(5);
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [rowNewSetNames, setRowNewSetNames] = useState<Record<string, string>>({});
  const [selectedSet, setSelectedSet] = useState("");
  const [hideCards, setHideCards] = useState(true);
  const [activeOnly, setActiveOnly] = useState(false);
  const [saveAllBusy, setSaveAllBusy] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [openPreview, setOpenPreview] = useState(false);
  const [savedIds, setSavedIds] = useState<Record<string, boolean>>({});
  const [renameInputs, setRenameInputs] = useState<Record<string, string>>({});
  const [rowNewCategories, setRowNewCategories] = useState<Record<string, string>>({});
  const [extraCategories, setExtraCategories] = useState<string[]>([]);

  async function loadSkills() {
    setMsg("");
    const res = await fetch("/api/skills/admin/list", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data?.error || "Failed to load skills");
    const list = (data.skills ?? []) as SkillRow[];
    setSkills(list);
    if (list.length && !selectedSet) setSelectedSet("All Sets");
  }

  useEffect(() => {
    loadSkills();
  }, []);

  const allSetNames = useMemo(() => {
    const names = new Set<string>();
    skills.forEach((s) => {
      if (s.set_name) names.add(String(s.set_name));
    });
    drafts.forEach((d) => {
      if (d.set_name) names.add(String(d.set_name));
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [skills, drafts]);

  const grouped = useMemo(() => {
    const map = new Map<string, DraftRow[]>();
    const merged: DraftRow[] = [
      ...skills.map((s) => ({ ...s, isDraft: false })),
      ...drafts,
    ];
    merged.forEach((row) => {
      const key = row.set_name || "Unsorted";
      map.set(key, [...(map.get(key) ?? []), row]);
    });
    const groups = Array.from(map.entries()).map(([setName, rows]) => {
      const sorted = rows.slice().sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
      return { setName, rows: sorted };
    });
    let filtered = groups;
    if (selectedSet && selectedSet !== "All Sets") {
      filtered = groups.filter((g) => g.setName === selectedSet);
    } else if (!selectedSet) {
      filtered = [];
    }
    if (activeOnly) {
      filtered = filtered.map((g) => ({ ...g, rows: g.rows.filter((r) => r.enabled) }));
    }
    if (categoryFilter !== "All Categories") {
      filtered = filtered.map((g) => ({
        ...g,
        rows: g.rows.filter((r) => String(r.category ?? "Uncategorized") === categoryFilter),
      }));
    }
    return filtered;
  }, [skills, drafts, selectedSet, activeOnly, categoryFilter]);

  const allCategories = useMemo(() => {
    const names = new Set<string>();
    skills.forEach((s) => names.add(String(s.category ?? "Uncategorized")));
    drafts.forEach((d) => names.add(String(d.category ?? "Uncategorized")));
    extraCategories.forEach((c) => names.add(c));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [skills, drafts, extraCategories]);

  function addSetDraft() {
    const name = newSetName.trim();
    if (!name) return setMsg("Enter a set name.");
    if (allSetNames.some((n) => n.toLowerCase() === name.toLowerCase())) {
      return setMsg("Set already exists.");
    }
    const levels = Math.max(1, Math.min(30, Number(newSetLevels)));
    const nextDrafts: DraftRow[] = [];
    for (let i = 1; i <= levels; i += 1) {
      nextDrafts.push({
        id: `draft-${name}-${i}-${Date.now()}`,
        name: "",
        description: "",
        category: "",
        level: i,
        points: 0,
        points_award: 0,
        enabled: true,
        set_name: name,
        sort_order: i,
        isDraft: true,
        draftSet: name,
      });
    }
    setDrafts((prev) => [...prev, ...nextDrafts]);
    setNewSetName("");
  }

  function addLevel(setName: string) {
    const existing = [
      ...skills.filter((s) => s.set_name === setName),
      ...drafts.filter((d) => d.set_name === setName),
    ];
    const maxLevel = existing.reduce((max, row) => Math.max(max, row.level ?? 0), 0);
    const nextLevel = maxLevel + 1;
    const draft: DraftRow = {
      id: `draft-${setName}-${nextLevel}-${Date.now()}`,
      name: "",
      description: "",
      category: "",
      level: nextLevel,
      points: 0,
      points_award: 0,
      enabled: true,
      set_name: setName,
      sort_order: nextLevel,
      isDraft: true,
      draftSet: setName,
    };
    setDrafts((prev) => [...prev, draft]);
  }

  function updateRow(id: string, patch: Partial<DraftRow>) {
    setDrafts((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    setSkills((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  async function saveRow(row: DraftRow) {
    if (!row.name.trim()) return setMsg("Skill name is required.");
    let setName = row.set_name?.trim() ?? "";
    const newSetName = String(rowNewSetNames[row.id] ?? "").trim();
    if (setName === "__new__") {
      if (!newSetName) return setMsg("Enter a new set name.");
      if (allSetNames.some((n) => n.toLowerCase() === newSetName.toLowerCase())) {
        return setMsg("Set already exists.");
      }
      setName = newSetName;
    }
    if (!setName) return setMsg("Set name is required.");
    setMsg("");
    setSavingIds((p) => ({ ...p, [row.id]: true }));

    const res = await fetch("/api/skills/admin/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: row.isDraft ? "" : row.id,
        name: row.name,
        description: row.description ?? "",
        category: row.category ?? "",
        level: row.level,
        points: row.points,
        enabled: row.enabled,
        set_name: setName,
        sort_order: row.sort_order ?? row.level,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSavingIds((p) => ({ ...p, [row.id]: false }));
      return setMsg(data?.error || "Failed to save skill");
    }

    const saved = data.skill as SkillRow;
    setSkills((prev) => {
      const without = prev.filter((s) => s.id !== saved.id);
      return [...without, saved];
    });
    setDrafts((prev) => prev.filter((d) => d.id !== row.id));
    setRowNewSetNames((prev) => {
      const next = { ...prev };
      delete next[row.id];
      return next;
    });
    setSavingIds((p) => ({ ...p, [row.id]: false }));
    setSavedIds((p) => ({ ...p, [saved.id]: true }));
    window.setTimeout(() => {
      setSavedIds((p) => {
        const next = { ...p };
        delete next[saved.id];
        return next;
      });
    }, 1600);
    await loadSkills();
  }

  async function saveAll() {
    const allRows = [
      ...skills.map((s) => ({ ...s, isDraft: false } as DraftRow)),
      ...drafts,
    ];
    if (!allRows.length) return;
    const invalid = allRows.find((r) => !r.name.trim() || !r.set_name);
    if (invalid) {
      setMsg("Each card must have a name and set before saving all.");
      return;
    }
    setSaveAllBusy(true);
    for (const row of allRows) {
      await saveRow(row);
    }
    setSaveAllBusy(false);
  }

  async function saveSet(setName: string) {
    const rows = [
      ...skills.filter((s) => s.set_name === setName).map((s) => ({ ...s, isDraft: false } as DraftRow)),
      ...drafts.filter((d) => d.set_name === setName),
    ];
    if (!rows.length) return;
    const invalid = rows.find((r) => !r.name.trim() || !r.set_name);
    if (invalid) return setMsg("Each card must have a name and set before saving.");
    for (const row of rows) {
      await saveRow(row);
    }
  }

  async function renameSet(oldName: string, nextName: string, rows: DraftRow[]) {
    const clean = nextName.trim();
    if (!clean) return setMsg("Enter a new set name.");
    if (allSetNames.some((n) => n.toLowerCase() === clean.toLowerCase())) {
      return setMsg("Set already exists.");
    }
    for (const row of rows) {
      await saveRow({ ...row, set_name: clean });
    }
    setRenameInputs((prev) => {
      const next = { ...prev };
      delete next[oldName];
      return next;
    });
    setSelectedSet(clean);
    setMsg(`Renamed ${oldName} to ${clean}.`);
  }

  async function hideRow(row: DraftRow) {
    if (row.isDraft) {
      setDrafts((prev) => prev.filter((d) => d.id !== row.id));
      return;
    }
    updateRow(row.id, { enabled: false });
    await saveRow({ ...row, enabled: false });
  }

  async function toggleRowEnabled(row: DraftRow) {
    if (row.isDraft) return;
    const next = !row.enabled;
    updateRow(row.id, { enabled: next });
    await saveRow({ ...row, enabled: next });
  }

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 1000 }}>Skill Tree Builder</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Create skill sets and edit levels. Save each card.</div>
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
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>Skill Tree Controls</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={label()}>Select Set</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {["All Sets", ...allSetNames].map((name) => (
                <button
                  key={name}
                  onClick={() => {
                    setSelectedSet(name);
                    setHideCards(false);
                  }}
                  style={setChip(selectedSet === name)}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={label()}>Filters</div>
            <div style={{ display: "grid", gap: 10 }}>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={input()}>
                <option value="All Categories">All Categories</option>
                {allCategories.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={() => setHideCards((v) => !v)} style={btnGhost()}>
                  {hideCards ? "Show Cards" : "Hide Cards"}
                </button>
                <button onClick={() => setActiveOnly((v) => !v)} style={btnGhost()}>
                  {activeOnly ? "Showing Active" : "Show Active Only"}
                </button>
                <button onClick={saveAll} style={btn()} disabled={saveAllBusy}>
                  {saveAllBusy ? "Saving..." : "Save All Sets"}
                </button>
                <button onClick={() => setOpenPreview(true)} style={btnGhost()}>
                  Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={card()}>
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>Create New Skill Tree</div>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.5fr auto", gap: 8 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={label()}>New Set Name</div>
            <input
              value={newSetName}
              onChange={(e) => setNewSetName(e.target.value)}
              placeholder="Left Splits"
              style={input()}
            />
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={label()}>Levels</div>
            <input
              value={String(newSetLevels)}
              onChange={(e) => setNewSetLevels(Number(e.target.value))}
              placeholder="Levels"
              style={input()}
              type="number"
              min={1}
              max={30}
            />
          </div>
          <div style={{ display: "grid", alignItems: "end" }}>
            <button onClick={addSetDraft} style={btn()}>
              Add Set
            </button>
          </div>
        </div>
      </div>

      {grouped.map((set) => (
        <div key={set.setName} style={card()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontWeight: 1000 }}>{set.setName}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  value={renameInputs[set.setName] ?? ""}
                  onChange={(e) => setRenameInputs((prev) => ({ ...prev, [set.setName]: e.target.value }))}
                  placeholder="Rename set"
                  style={input()}
                />
                <button onClick={() => renameSet(set.setName, renameInputs[set.setName] ?? "", set.rows)} style={btnGhost()}>
                  Rename
                </button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => addLevel(set.setName)} style={btnGhost()}>
                + Add Level
              </button>
              <button onClick={() => saveSet(set.setName)} style={btnGhost()}>
                Save Set
              </button>
            </div>
          </div>
          {!hideCards ? (
            <div style={{ marginTop: 12, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
              {set.rows.map((row) => (
                <div key={row.id} style={skillCard(row.enabled)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div style={{ fontWeight: 900 }}>
                      Level {row.level}
                      {!row.enabled && " • Hidden"}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {!row.isDraft && (
                        <button onClick={() => toggleRowEnabled(row)} style={chipGhost()}>
                          {row.enabled ? "Hide" : "Unhide"}
                        </button>
                      )}
                      <button onClick={() => hideRow(row)} style={chipDanger()} title="Remove">
                        ×
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={label()}>Skill Name</div>
                      <input
                        value={row.name}
                        onChange={(e) => updateRow(row.id, { name: e.target.value })}
                        placeholder="Skill name"
                        style={input()}
                      />
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={label()}>Level (order in set)</div>
                      <input
                        value={String(row.level)}
                        onChange={(e) => updateRow(row.id, { level: Number(e.target.value) })}
                        placeholder="Level"
                        type="number"
                        min={1}
                        style={input()}
                      />
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={label()}>Points (display + award)</div>
                      <input
                        value={String(row.points)}
                        onChange={(e) => updateRow(row.id, { points: Number(e.target.value) })}
                        placeholder="Points"
                        type="number"
                        min={0}
                        style={input()}
                      />
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={label()}>Category</div>
                      <select
                        value={row.category ?? ""}
                        onChange={(e) => updateRow(row.id, { category: e.target.value })}
                        style={input()}
                      >
                        <option value="">Select category</option>
                        {allCategories.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                        <option value="__new__">+ New category</option>
                      </select>
                      {row.category === "__new__" && (
                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            value={rowNewCategories[row.id] ?? ""}
                            onChange={(e) =>
                              setRowNewCategories((prev) => ({ ...prev, [row.id]: e.target.value }))
                            }
                            placeholder="New category"
                            style={input()}
                          />
                          <button
                            onClick={() => {
                              const next = String(rowNewCategories[row.id] ?? "").trim();
                              if (!next) return;
                              setExtraCategories((prev) => (prev.includes(next) ? prev : [...prev, next]));
                              updateRow(row.id, { category: next });
                              setRowNewCategories((prev) => {
                                const copy = { ...prev };
                                delete copy[row.id];
                                return copy;
                              });
                            }}
                            style={btnGhost()}
                          >
                            Add
                          </button>
                        </div>
                      )}
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={label()}>Description</div>
                      <textarea
                        value={row.description ?? ""}
                        onChange={(e) => updateRow(row.id, { description: e.target.value })}
                        placeholder="Description"
                        style={textarea()}
                      />
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={label()}>Set Name</div>
                      <select
                        value={row.set_name ?? ""}
                        onChange={(e) => updateRow(row.id, { set_name: e.target.value })}
                        style={input()}
                      >
                        <option value="">Select set</option>
                        {allSetNames.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                        <option value="__new__">+ New set</option>
                      </select>
                      {row.set_name === "__new__" && (
                        <input
                          value={rowNewSetNames[row.id] ?? ""}
                          onChange={(e) => setRowNewSetNames((prev) => ({ ...prev, [row.id]: e.target.value }))}
                          placeholder="New set name"
                          style={input()}
                        />
                      )}
                    </div>
                  </div>

                  <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    {savedIds[row.id] ? <div style={{ fontSize: 12, opacity: 0.8 }}>Saved</div> : <div />}
                    <button onClick={() => saveRow(row)} style={btn()} disabled={!!savingIds[row.id]}>
                      {savingIds[row.id] ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              ))}
              {!set.rows.length && <div style={{ opacity: 0.7 }}>No skills in this set yet.</div>}
            </div>
          ) : (
            <div style={{ marginTop: 10, opacity: 0.7 }}>
              Cards hidden. {set.rows.length} skills in this set.
            </div>
          )}
        </div>
      ))}
      {openPreview && (
        <div style={overlayBackdrop()} onClick={() => setOpenPreview(false)}>
          <div style={overlayPanel()} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 1000, marginBottom: 10 }}>Skill Tree Preview</div>
            <div style={{ height: "70vh", borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.12)" }}>
              <iframe
                src="/skills?embed=1"
                title="Skill Tree Preview"
                style={{ width: "100%", height: "100%", border: "none" }}
              />
            </div>
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

function skillCard(enabled = true): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 8,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "linear-gradient(135deg, rgba(15,23,42,0.45), rgba(2,6,23,0.55))",
    display: "grid",
    opacity: enabled ? 1 : 0.55,
  };
}

function input(): React.CSSProperties {
  return {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.24)",
    color: "white",
    outline: "none",
    fontSize: 15,
    fontWeight: 900,
  };
}

function setChip(active: boolean): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 10,
    border: active ? "1px solid rgba(59,130,246,0.7)" : "1px solid rgba(255,255,255,0.14)",
    background: active ? "rgba(59,130,246,0.18)" : "rgba(0,0,0,0.28)",
    color: "white",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  };
}

function chipGhost(): React.CSSProperties {
  return {
    padding: "4px 8px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.28)",
    color: "white",
    fontSize: 11,
    cursor: "pointer",
  };
}

function chipDanger(): React.CSSProperties {
  return {
    padding: "4px 8px",
    borderRadius: 8,
    border: "1px solid rgba(239,68,68,0.45)",
    background: "rgba(239,68,68,0.16)",
    color: "white",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    lineHeight: 1,
  };
}

function textarea(): React.CSSProperties {
  return {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.24)",
    color: "white",
    outline: "none",
    minHeight: 110,
    resize: "vertical",
    fontSize: 15,
    fontWeight: 900,
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
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  };
}

function overlayBackdrop(): React.CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.72)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 120,
  };
}

function overlayPanel(): React.CSSProperties {
  return {
    width: "min(1100px, 100%)",
    background: "rgba(5,7,11,0.96)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
  };
}

function label(): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.85,
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

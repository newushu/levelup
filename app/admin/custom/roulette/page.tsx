"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type RouletteWheel = {
  id?: string;
  name: string;
  wheel_type: "prize" | "task";
  enabled: boolean;
};

type RouletteSegment = {
  id?: string;
  local_id?: string;
  wheel_id: string;
  label: string;
  segment_type: "points_add" | "points_subtract" | "prize" | "item" | "task";
  points_value: number | string;
  prize_text?: string | null;
  item_key?: string | null;
  color?: string | null;
  sort_order: number | string;
};

type WheelBundle = RouletteWheel & { segments: RouletteSegment[] };

const SEGMENT_TYPES: Array<RouletteSegment["segment_type"]> = [
  "points_add",
  "points_subtract",
  "prize",
  "item",
  "task",
];

const SEGMENT_PALETTES = [
  ["#22c55e", "#f97316", "#38bdf8", "#facc15", "#f87171", "#a78bfa", "#14b8a6", "#e879f9"],
  ["#ef4444", "#f59e0b", "#facc15", "#10b981", "#22d3ee", "#3b82f6", "#8b5cf6", "#ec4899"],
  ["#0ea5e9", "#22d3ee", "#38bdf8", "#60a5fa", "#818cf8", "#14b8a6", "#06b6d4", "#0284c7"],
  ["#fb7185", "#f97316", "#f59e0b", "#facc15", "#f472b6", "#f43f5e", "#fda4af", "#fcd34d"],
];

export default function AdminRoulettePage() {
  const [wheels, setWheels] = useState<WheelBundle[]>([]);
  const [newWheel, setNewWheel] = useState<RouletteWheel>({ name: "", wheel_type: "prize", enabled: true });
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadWheels();
  }, []);

  async function loadWheels() {
    setMsg("");
    const res = await fetch("/api/admin/roulette/wheels", { cache: "no-store" });
    const sj = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(sj?.error || "Failed to load wheels");
      return;
    }
    const list = (sj?.wheels ?? []) as WheelBundle[];
    setWheels(list);
  }

  async function saveWheel(wheel: WheelBundle) {
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/admin/roulette/wheels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: wheel.id ?? null,
        name: wheel.name,
        wheel_type: wheel.wheel_type,
        enabled: wheel.enabled !== false,
      }),
    });
    const sj = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSaving(false);
      return setMsg(sj?.error || "Failed to save wheel");
    }

    const updated = sj?.wheel as RouletteWheel;
    const segmentResults: RouletteSegment[] = [];
    if (wheel.id && wheel.segments.length) {
      for (const segment of wheel.segments) {
        const label = segmentLabel(segment);
        const segRes = await fetch("/api/admin/roulette/segments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: segment.id ?? null,
            wheel_id: wheel.id,
            label,
            segment_type: segment.segment_type,
            points_value: Number(segment.points_value ?? 0),
            prize_text: segment.prize_text ?? null,
            item_key: segment.item_key ?? null,
            color: segment.color ?? null,
            sort_order: Number(segment.sort_order ?? 0),
          }),
        });
        const segJson = await segRes.json().catch(() => ({}));
        if (!segRes.ok) {
          setSaving(false);
          return setMsg(segJson?.error || "Failed to save segments");
        }
        const saved = segJson?.segment as RouletteSegment;
        segmentResults.push({ ...segment, label, ...saved });
      }
    }
    setSaving(false);
    setWheels((prev) =>
      prev.map((w) =>
        w.id === wheel.id ? { ...w, ...updated, segments: segmentResults.length ? segmentResults : w.segments } : w
      )
    );
  }

  async function createWheel() {
    if (!newWheel.name.trim()) return setMsg("Enter a wheel name.");
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/admin/roulette/wheels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newWheel),
    });
    const sj = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setMsg(sj?.error || "Failed to create wheel");
    const created = sj?.wheel as RouletteWheel;
    setWheels((prev) => [{ ...created, segments: [] }, ...prev]);
    setNewWheel({ name: "", wheel_type: "prize", enabled: true });
  }

  async function removeWheel(wheelId?: string) {
    if (!wheelId) return;
    if (!window.confirm("Delete this wheel and all its segments?")) return;
    const res = await fetch(`/api/admin/roulette/wheels?id=${encodeURIComponent(wheelId)}`, {
      method: "DELETE",
    });
    const sj = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(sj?.error || "Failed to delete wheel");
    setWheels((prev) => prev.filter((w) => w.id !== wheelId));
  }

  async function saveSegment(segment: RouletteSegment) {
    setSaving(true);
    setMsg("");
    const label = segmentLabel(segment);
    const res = await fetch("/api/admin/roulette/segments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: segment.id ?? null,
        wheel_id: segment.wheel_id,
        label,
        segment_type: segment.segment_type,
        points_value: Number(segment.points_value ?? 0),
        prize_text: segment.prize_text ?? null,
        item_key: segment.item_key ?? null,
        color: segment.color ?? null,
        sort_order: Number(segment.sort_order ?? 0),
      }),
    });
    const sj = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setMsg(sj?.error || "Failed to save segment");
    const updated = sj?.segment as RouletteSegment;
    setWheels((prev) =>
      prev.map((w) =>
        w.id === segment.wheel_id
          ? {
              ...w,
              segments: w.segments.map((s) =>
                s.id
                  ? s.id === segment.id
                    ? { ...s, ...updated, label }
                    : s
                  : s.local_id === segment.local_id
                  ? { ...s, ...updated, label }
                  : s
              ),
            }
          : w
      )
    );
  }

  async function removeSegment(segment: RouletteSegment) {
    if (!window.confirm("Delete this segment?")) return;
    if (segment.id) {
      const res = await fetch(`/api/admin/roulette/segments?id=${encodeURIComponent(segment.id)}`, {
        method: "DELETE",
      });
      const sj = await res.json().catch(() => ({}));
      if (!res.ok) return setMsg(sj?.error || "Failed to delete segment");
    }
    setWheels((prev) =>
      prev.map((w) => ({
        ...w,
        segments: w.segments.filter((s) =>
          segment.id ? s.id !== segment.id : s.local_id !== segment.local_id
        ),
      }))
    );
  }

  function addSegment(wheel: WheelBundle) {
    if (!wheel.id) return;
    const next: RouletteSegment = {
      local_id: `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      wheel_id: wheel.id,
      label: "Earn Points +0",
      segment_type: "points_add",
      points_value: 0,
      prize_text: "",
      item_key: "",
      color: "",
      sort_order: wheel.segments.length + 1,
    };
    setWheels((prev) =>
      prev.map((w) => (w.id === wheel.id ? { ...w, segments: [...w.segments, next] } : w))
    );
  }

  const wheelList = useMemo(() => wheels.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")), [wheels]);

  function updateSegment(wheelId: string | undefined, segment: RouletteSegment, updates: Partial<RouletteSegment>) {
    if (!wheelId) return;
    setWheels((prev) =>
      prev.map((w) =>
        w.id === wheelId
          ? {
              ...w,
              segments: w.segments.map((s) =>
                s === segment ? applySegmentLabel({ ...s, ...updates }) : s
              ),
            }
          : w
      )
    );
  }

  return (
    <main style={{ display: "grid", gap: 16, maxWidth: 1100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 1000 }}>Roulette Wheel Builder</div>
          <div style={{ opacity: 0.75, fontSize: 13 }}>
            Create prize and task wheels with point, prize, or item outcomes.
          </div>
        </div>
        <Link href="/admin/custom" style={{ fontWeight: 900, fontSize: 12, opacity: 0.8 }}>
          Back to Admin Custom
        </Link>
      </div>

      {msg ? <div style={{ fontSize: 12, opacity: 0.8 }}>{msg}</div> : null}

      <section style={card()}>
        <div style={cardTitle()}>Create new wheel</div>
        <div style={row()}>
          <div style={field()}>
            <label style={fieldLabel()}>Wheel name</label>
            <input
              value={newWheel.name}
              onChange={(e) => setNewWheel((prev) => ({ ...prev, name: e.target.value }))}
              onFocus={(e) => e.currentTarget.select()}
              placeholder="e.g. Prize Wheel"
              style={input()}
            />
          </div>
          <div style={field()}>
            <label style={fieldLabel()}>Wheel type</label>
            <select
              value={newWheel.wheel_type}
              onChange={(e) => setNewWheel((prev) => ({ ...prev, wheel_type: e.target.value as RouletteWheel["wheel_type"] }))}
              style={input()}
            >
              <option value="prize">Prize wheel</option>
              <option value="task">Task wheel</option>
            </select>
          </div>
          <div style={field()}>
            <label style={fieldLabel()}>Enabled</label>
            <label style={checkbox()}>
              <input
                type="checkbox"
                checked={newWheel.enabled}
                onChange={(e) => setNewWheel((prev) => ({ ...prev, enabled: e.target.checked }))}
              />
              Active
            </label>
          </div>
          <button style={saveBtn(saving)} onClick={createWheel} disabled={saving}>
            {saving ? "Saving..." : "Create Wheel"}
          </button>
        </div>
      </section>

      {wheelList.length ? (
        wheelList.map((wheel) => (
          <section key={wheel.id ?? wheel.name} style={card()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div>
                <div style={cardTitle()}>{wheel.name}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {wheel.wheel_type === "prize" ? "Prize wheel" : "Task wheel"} • {wheel.enabled ? "Enabled" : "Disabled"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={ghostBtn()} onClick={() => addSegment(wheel)}>
                  Add segment
                </button>
                <button style={deleteBtn()} onClick={() => removeWheel(wheel.id)}>
                  Delete wheel
                </button>
              </div>
            </div>

            <div style={row({ columns: "repeat(4, minmax(0, 1fr))" })}>
              <div style={field()}>
                <label style={fieldLabel()}>Name</label>
                <input
                  value={wheel.name}
                  onChange={(e) =>
                    setWheels((prev) => prev.map((w) => (w.id === wheel.id ? { ...w, name: e.target.value } : w)))
                  }
                  onFocus={(e) => e.currentTarget.select()}
                  style={input()}
                />
              </div>
              <div style={field()}>
                <label style={fieldLabel()}>Wheel type</label>
                <select
                  value={wheel.wheel_type}
                  onChange={(e) =>
                    setWheels((prev) =>
                      prev.map((w) =>
                        w.id === wheel.id ? { ...w, wheel_type: e.target.value as RouletteWheel["wheel_type"] } : w
                      )
                    )
                  }
                  style={input()}
                >
                  <option value="prize">Prize wheel</option>
                  <option value="task">Task wheel</option>
                </select>
              </div>
              <div style={field()}>
                <label style={fieldLabel()}>Enabled</label>
                <label style={checkbox()}>
                  <input
                    type="checkbox"
                    checked={wheel.enabled}
                    onChange={(e) =>
                      setWheels((prev) =>
                        prev.map((w) => (w.id === wheel.id ? { ...w, enabled: e.target.checked } : w))
                      )
                    }
                  />
                  Active
                </label>
              </div>
              <button style={saveBtn(saving)} onClick={() => saveWheel(wheel)} disabled={saving}>
                {saving ? "Saving..." : "Save wheel"}
              </button>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {wheel.segments.length ? (
                wheel.segments
                  .slice()
                  .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
                  .map((segment, idx) => (
                    <div key={segment.id ?? segment.local_id ?? `${wheel.id}-seg-${idx}`} style={segmentRow()}>
                      <div style={segmentCell()}>
                        <label style={fieldLabel()}>Label</label>
                        <input
                          value={segmentLabel(segment)}
                          onFocus={(e) => e.currentTarget.select()}
                          disabled
                          style={{ ...input(), opacity: 0.65, cursor: "not-allowed" }}
                        />
                      </div>
                      <div style={segmentCell()}>
                        <label style={fieldLabel()}>Type</label>
                        <select
                          value={segment.segment_type}
                          onChange={(e) =>
                            updateSegment(wheel.id, segment, {
                              segment_type: e.target.value as RouletteSegment["segment_type"],
                            })
                          }
                          style={input()}
                        >
                          {SEGMENT_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type.replace("_", " ")}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div style={segmentCell()}>
                        <label style={fieldLabel()}>Points</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={displayNumber(segment.points_value)}
                          onChange={(e) =>
                            updateSegment(wheel.id, segment, { points_value: digitsOnly(e.target.value) })
                          }
                          onFocus={(e) => e.currentTarget.select()}
                          disabled={segment.segment_type === "task"}
                          style={input()}
                        />
                      </div>
                      <div style={segmentCell()}>
                        <label style={fieldLabel()}>
                          {segment.segment_type === "task" ? "Task text" : "Prize text"}
                        </label>
                        <input
                          value={segment.prize_text ?? ""}
                          onChange={(e) =>
                            updateSegment(wheel.id, segment, { prize_text: e.target.value })
                          }
                          onFocus={(e) => e.currentTarget.select()}
                          style={input()}
                        />
                      </div>
                      <div style={segmentCell()}>
                        <label style={fieldLabel()}>Item key</label>
                        <input
                          value={segment.item_key ?? ""}
                          onChange={(e) =>
                            updateSegment(wheel.id, segment, { item_key: e.target.value })
                          }
                          onFocus={(e) => e.currentTarget.select()}
                          style={input()}
                        />
                        {segment.segment_type === "item" ? (
                          <div style={itemPreview()}>
                            <div style={{ fontSize: 11, fontWeight: 800 }}>Item preview</div>
                            <div style={{ fontSize: 12, fontWeight: 900 }}>
                              {segment.item_key?.trim() ? segment.item_key : "New item"}
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <div style={segmentCell()}>
                        <label style={fieldLabel()}>Color</label>
                        <div style={{ display: "grid", gap: 8 }}>
                          <input
                            type="color"
                            value={segment.color || "#22c55e"}
                          onChange={(e) =>
                              updateSegment(wheel.id, segment, { color: e.target.value })
                            }
                            style={colorPicker()}
                          />
                          <div style={paletteRow()}>
                            {SEGMENT_PALETTES.flat().map((c, idx) => (
                              <button
                                key={`${segment.id ?? segment.local_id}-${c}-${idx}`}
                                type="button"
                                onClick={() =>
                                  updateSegment(wheel.id, segment, { color: c })
                                }
                                style={paletteSwatch(c, segment.color)}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      <div style={segmentCell()}>
                        <label style={fieldLabel()}>Order</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={displayNumber(segment.sort_order)}
                          onChange={(e) =>
                            updateSegment(wheel.id, segment, { sort_order: digitsOnly(e.target.value) })
                          }
                          onFocus={(e) => e.currentTarget.select()}
                          style={input()}
                        />
                      </div>
                      <div style={segmentActions()}>
                        <button style={saveBtn(saving)} onClick={() => saveSegment(segment)} disabled={saving}>
                          {saving ? "Saving..." : "Save"}
                        </button>
                        <button style={deleteBtn()} onClick={() => removeSegment(segment)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
              ) : (
                <div style={{ fontSize: 12, opacity: 0.65 }}>No segments yet. Add segments to build the wheel.</div>
              )}
            </div>
          </section>
        ))
      ) : (
        <div style={{ fontSize: 12, opacity: 0.7 }}>No wheels yet.</div>
      )}
    </main>
  );
}

function card(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.55)",
    display: "grid",
    gap: 12,
  };
}

function cardTitle(): React.CSSProperties {
  return { fontWeight: 1000, fontSize: 16 };
}

function row(options?: { columns?: string }): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: options?.columns ?? "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
    alignItems: "end",
  };
}

function field(): React.CSSProperties {
  return { display: "grid", gap: 6 };
}

function fieldLabel(): React.CSSProperties {
  return { fontSize: 12, fontWeight: 900, opacity: 0.85 };
}

function input(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.55)",
    color: "white",
    fontSize: 13,
    width: "100%",
  };
}

function checkbox(): React.CSSProperties {
  return {
    display: "flex",
    gap: 8,
    alignItems: "center",
    fontSize: 12,
    fontWeight: 800,
  };
}

function segmentRow(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "2fr repeat(6, minmax(120px, 1fr)) auto",
    gap: 10,
    padding: 10,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(2,6,23,0.55)",
  };
}

function segmentCell(): React.CSSProperties {
  return { display: "grid", gap: 6 };
}

function segmentActions(): React.CSSProperties {
  return { display: "grid", gap: 8, alignContent: "end" };
}

function saveBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(59,130,246,0.35)",
    background: disabled ? "rgba(59,130,246,0.3)" : "linear-gradient(90deg, rgba(59,130,246,0.85), rgba(14,165,233,0.65))",
    color: "white",
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

function ghostBtn(): React.CSSProperties {
  return {
    padding: "9px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function deleteBtn(): React.CSSProperties {
  return {
    padding: "9px 14px",
    borderRadius: 12,
    border: "1px solid rgba(239,68,68,0.4)",
    background: "rgba(239,68,68,0.1)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function colorPicker(): React.CSSProperties {
  return {
    width: "100%",
    height: 42,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.55)",
    padding: 4,
    cursor: "pointer",
  };
}

function paletteRow(): React.CSSProperties {
  return { display: "flex", flexWrap: "wrap", gap: 6 };
}

function paletteSwatch(color: string, current?: string | null): React.CSSProperties {
  const active = color.toLowerCase() === String(current ?? "").toLowerCase();
  return {
    width: 18,
    height: 18,
    borderRadius: 6,
    border: active ? "2px solid rgba(255,255,255,0.95)" : "1px solid rgba(255,255,255,0.3)",
    background: color,
    cursor: "pointer",
  };
}

function itemPreview(): React.CSSProperties {
  return {
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    padding: "8px 10px",
    background:
      "radial-gradient(circle at top, rgba(59,130,246,0.35), rgba(15,23,42,0.85)), rgba(15,23,42,0.45)",
    display: "grid",
    gap: 4,
    marginTop: 6,
  };
}

function digitsOnly(value: string): string {
  return value.replace(/[^\d]/g, "");
}

function displayNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value === "" ? "" : value;
  return Number.isFinite(value) ? String(value) : "";
}

function applySegmentLabel(segment: RouletteSegment): RouletteSegment {
  return { ...segment, label: segmentLabel(segment) };
}

function segmentLabel(segment: RouletteSegment): string {
  const points = Number(segment.points_value || 0);
  if (segment.segment_type === "points_add") {
    return `Earn Points +${Number.isFinite(points) ? points : 0}`;
  }
  if (segment.segment_type === "points_subtract") {
    return `Lose Points -${Number.isFinite(points) ? points : 0}`;
  }
  if (segment.segment_type === "prize") {
    const prize = (segment.prize_text ?? "").trim() || "Prize";
    return `Free Prize: ${prize}`;
  }
  if (segment.segment_type === "item") {
    const item = (segment.item_key ?? "").trim() || "Item";
    return `Free Item: ${item}`;
  }
  const task = (segment.prize_text ?? "").trim() || "Complete Task";
  return `Task: ${task}`;
}

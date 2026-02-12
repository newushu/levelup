"use client";

import { useEffect, useMemo, useState } from "react";

type Plan = {
  id: string;
  name: string;
  description?: string | null;
};

type Section = {
  id?: string;
  plan_id?: string;
  label: string;
  duration_minutes: number;
  color: string;
  sort_order: number;
};

type Assignment = {
  id: string;
  plan_id: string;
  class_id: string;
};

type ClassRow = {
  id: string;
  name: string;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status})` } };
  }
}

export default function ClassTimePlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [planSections, setPlanSections] = useState<Section[]>([]);
  const [classIds, setClassIds] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    refreshAll();
  }, []);

  async function refreshAll() {
    setLoading(true);
    const res = await fetch("/api/admin/class-time-plans", { cache: "no-store" });
    const sj = await safeJson(res);
    setLoading(false);
    if (!sj.ok) {
      setMsg(sj.json?.error || "Failed to load class time plans.");
      return;
    }
    setPlans((sj.json?.plans ?? []) as Plan[]);
    setSections((sj.json?.sections ?? []) as Section[]);
    setAssignments((sj.json?.assignments ?? []) as Assignment[]);
    setClasses((sj.json?.classes ?? []) as ClassRow[]);
  }

  useEffect(() => {
    if (!selectedId) {
      setName("");
      setDescription("");
      setPlanSections([]);
      setClassIds([]);
      return;
    }
    const plan = plans.find((p) => p.id === selectedId);
    setName(plan?.name ?? "");
    setDescription(plan?.description ?? "");
    const nextSections = sections
      .filter((s) => s.plan_id === selectedId)
      .map((s) => ({
        id: s.id,
        label: s.label,
        duration_minutes: Number(s.duration_minutes ?? 5),
        color: s.color || "#60a5fa",
        sort_order: Number(s.sort_order ?? 0),
      }))
      .sort((a, b) => a.sort_order - b.sort_order);
    setPlanSections(nextSections.length ? nextSections : [{ label: "Warm Up", duration_minutes: 5, color: "#60a5fa", sort_order: 0 }]);
    const assigned = assignments.filter((a) => a.plan_id === selectedId).map((a) => a.class_id);
    setClassIds(assigned);
  }, [selectedId, plans, sections, assignments]);

  const planTotal = useMemo(() => {
    return planSections.reduce((acc, s) => acc + Math.max(1, Number(s.duration_minutes || 0)), 0);
  }, [planSections]);

  function addSection() {
    setPlanSections((prev) => [
      ...prev,
      {
        label: `Section ${prev.length + 1}`,
        duration_minutes: 5,
        color: "#60a5fa",
        sort_order: prev.length,
      },
    ]);
  }

  function removeSection(idx: number) {
    setPlanSections((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, sort_order: i })));
  }

  async function savePlan() {
    setMsg("");
    if (!name.trim()) return setMsg("Plan name required.");
    if (!planSections.length) return setMsg("Add at least one section.");
    setSaving(true);
    const res = await fetch("/api/admin/class-time-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: selectedId || undefined,
        name: name.trim(),
        description: description.trim() || null,
        sections: planSections.map((s, idx) => ({
          label: s.label,
          duration_minutes: Math.max(1, Number(s.duration_minutes || 0)),
          color: s.color || "#60a5fa",
          sort_order: idx,
        })),
        class_ids: classIds,
      }),
    });
    const sj = await safeJson(res);
    setSaving(false);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to save plan.");
    setMsg("Plan saved.");
    await refreshAll();
    if (!selectedId && sj.json?.plan_id) setSelectedId(String(sj.json.plan_id));
  }

  async function deletePlan() {
    if (!selectedId) return;
    if (!window.confirm("Delete this class time plan?")) return;
    setSaving(true);
    const res = await fetch("/api/admin/class-time-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delete_id: selectedId }),
    });
    const sj = await safeJson(res);
    setSaving(false);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to delete plan.");
    setSelectedId("");
    setMsg("Plan deleted.");
    await refreshAll();
  }

  const filteredPlans = useMemo(() => plans.sort((a, b) => a.name.localeCompare(b.name)), [plans]);

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <div>
        <div style={{ fontSize: 26, fontWeight: 1000 }}>Class Time Plans</div>
        <div style={{ opacity: 0.7, fontSize: 12 }}>
          Define the class timeline sections and assign them to class types.
        </div>
      </div>

      {msg ? <div style={notice()}>{msg}</div> : null}

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "280px 1fr" }}>
        <section style={card()}>
          <div style={{ fontWeight: 900 }}>Plans</div>
          <button
            style={btn()}
            onClick={() => {
              setSelectedId("");
              setName("New Plan");
              setDescription("");
              setPlanSections([{ label: "Warm Up", duration_minutes: 5, color: "#60a5fa", sort_order: 0 }]);
              setClassIds([]);
            }}
          >
            New Plan
          </button>
          <div style={{ display: "grid", gap: 8 }}>
            {filteredPlans.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelectedId(plan.id)}
                style={tabChip(selectedId === plan.id)}
              >
                {plan.name}
              </button>
            ))}
            {!filteredPlans.length && !loading ? <div style={{ opacity: 0.6, fontSize: 12 }}>No plans yet.</div> : null}
          </div>
        </section>

        <section style={card()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div style={{ fontWeight: 900 }}>{selectedId ? "Edit Plan" : "Create Plan"}</div>
            {selectedId ? (
              <button style={dangerBtn()} onClick={deletePlan} disabled={saving}>
                Delete Plan
              </button>
            ) : null}
          </div>

          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <label style={fieldLabel()}>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} style={input()} />
            </label>
            <label style={fieldLabel()}>
              Description
              <input value={description} onChange={(e) => setDescription(e.target.value)} style={input()} />
            </label>
          </div>

          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Total minutes: <b>{planTotal}</b>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 900 }}>Sections</div>
            {planSections.map((section, idx) => (
              <div key={`${section.label}-${idx}`} style={rowCard()}>
                <div style={{ display: "grid", gap: 6, gridTemplateColumns: "1.5fr 0.6fr 0.6fr auto", alignItems: "center" }}>
                  <input
                    value={section.label}
                    onChange={(e) =>
                      setPlanSections((prev) =>
                        prev.map((s, i) => (i === idx ? { ...s, label: e.target.value } : s))
                      )
                    }
                    style={input()}
                    placeholder="Section name"
                  />
                  <input
                    type="number"
                    min={1}
                    value={section.duration_minutes}
                    onChange={(e) =>
                      setPlanSections((prev) =>
                        prev.map((s, i) =>
                          i === idx ? { ...s, duration_minutes: Number(e.target.value || 1) } : s
                        )
                      )
                    }
                    style={input()}
                    placeholder="Minutes"
                  />
                  <input
                    type="color"
                    value={section.color || "#60a5fa"}
                    onChange={(e) =>
                      setPlanSections((prev) => prev.map((s, i) => (i === idx ? { ...s, color: e.target.value } : s)))
                    }
                    style={colorInput()}
                  />
                  <button style={dangerBtn()} onClick={() => removeSection(idx)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <button style={btnGhost()} onClick={addSection}>
              Add Section
            </button>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 900 }}>Assign to Classes</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {classes.map((c) => {
                const active = classIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      setClassIds((prev) => (active ? prev.filter((id) => id !== c.id) : [...prev, c.id]))
                    }
                    style={chip(active)}
                  >
                    {c.name}
                  </button>
                );
              })}
              {!classes.length ? <div style={{ fontSize: 12, opacity: 0.6 }}>No classes found.</div> : null}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button style={btn()} onClick={savePlan} disabled={saving}>
              {saving ? "Saving..." : "Save Plan"}
            </button>
            <button style={btnGhost()} onClick={refreshAll} disabled={saving}>
              Refresh
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function card(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    display: "grid",
    gap: 12,
  };
}

function fieldLabel(): React.CSSProperties {
  return {
    display: "grid",
    gap: 6,
    fontSize: 12,
    fontWeight: 900,
  };
}

function input(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.25)",
    color: "white",
    fontWeight: 900,
    outline: "none",
  };
}

function colorInput(): React.CSSProperties {
  return {
    height: 42,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.25)",
    padding: 0,
    cursor: "pointer",
  };
}

function btn(): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(59,130,246,0.35)",
    background: "rgba(59,130,246,0.25)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    width: "fit-content",
  };
}

function btnGhost(): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function rowCard(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.2)",
    display: "grid",
    gap: 6,
  };
}

function chip(active: boolean): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: active ? "1px solid rgba(59,130,246,0.6)" : "1px solid rgba(255,255,255,0.18)",
    background: active ? "rgba(59,130,246,0.22)" : "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    fontSize: 11,
    cursor: "pointer",
  };
}

function tabChip(active: boolean): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: active ? "1px solid rgba(59,130,246,0.6)" : "1px solid rgba(255,255,255,0.18)",
    background: active ? "rgba(59,130,246,0.28)" : "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
    textAlign: "left",
  };
}

function dangerBtn(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid rgba(239,68,68,0.5)",
    background: "rgba(239,68,68,0.2)",
    color: "white",
    fontWeight: 900,
    fontSize: 11,
    cursor: "pointer",
  };
}

function notice(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(59,130,246,0.3)",
    background: "rgba(59,130,246,0.12)",
    color: "white",
    fontWeight: 900,
    fontSize: 12,
  };
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type AgeGroup = {
  id?: string;
  name: string;
  min_age?: number | null;
  max_age?: number | null;
};

type TaoluForm = {
  id?: string;
  name: string;
  age_group_id?: string | null;
  sections_count: number;
  video_links?: string[];
  is_active?: boolean;
};

type CodeRow = {
  id?: string;
  event_type?: string;
  code_number: string;
  name: string;
  description?: string | null;
  deduction_amount?: number;
};

type WindowRow = {
  id?: string;
  label: string;
  days: number;
  sort_order?: number;
  is_active?: boolean;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 180)}` } };
  }
}

export default function IwufScoringAdminPage() {
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [forms, setForms] = useState<TaoluForm[]>([]);
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [windows, setWindows] = useState<WindowRow[]>([]);
  const [msg, setMsg] = useState("");

  const [newGroup, setNewGroup] = useState<AgeGroup>({ name: "", min_age: null, max_age: null });
  const [newForm, setNewForm] = useState<TaoluForm>({ name: "", age_group_id: "", sections_count: 4, video_links: [], is_active: true });
  const [newCode, setNewCode] = useState<CodeRow>({ event_type: "taolu", code_number: "", name: "", description: "", deduction_amount: 0 });
  const [newWindow, setNewWindow] = useState<WindowRow>({ label: "Last 30 Days", days: 30, sort_order: 1, is_active: true });

  async function loadAll() {
    const [gRes, fRes, cRes, wRes] = await Promise.all([
      fetch("/api/admin/iwuf/age-groups", { cache: "no-store" }),
      fetch("/api/admin/iwuf/forms", { cache: "no-store" }),
      fetch("/api/admin/iwuf/codes", { cache: "no-store" }),
      fetch("/api/admin/iwuf/report-windows", { cache: "no-store" }),
    ]);
    const gJson = await safeJson(gRes);
    const fJson = await safeJson(fRes);
    const cJson = await safeJson(cRes);
    const wJson = await safeJson(wRes);
    if (!gJson.ok) return setMsg(gJson.json?.error || "Failed to load age groups");
    if (!fJson.ok) return setMsg(fJson.json?.error || "Failed to load forms");
    if (!cJson.ok) return setMsg(cJson.json?.error || "Failed to load codes");
    if (!wJson.ok) return setMsg(wJson.json?.error || "Failed to load report windows");
    setAgeGroups((gJson.json?.groups ?? []) as AgeGroup[]);
    setForms((fJson.json?.forms ?? []) as TaoluForm[]);
    setCodes((cJson.json?.codes ?? []) as CodeRow[]);
    setWindows((wJson.json?.windows ?? []) as WindowRow[]);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function saveGroup(row: AgeGroup) {
    const res = await fetch("/api/admin/iwuf/age-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
    const sj = await safeJson(res);
    if (!sj.ok) {
      setMsg(sj.json?.error || "Failed to save age group");
      return false;
    }
    await loadAll();
    return true;
  }

  async function saveForm(row: TaoluForm) {
    const res = await fetch("/api/admin/iwuf/forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
    const sj = await safeJson(res);
    if (!sj.ok) {
      setMsg(sj.json?.error || "Failed to save form");
      return false;
    }
    await loadAll();
    return true;
  }

  async function saveCode(row: CodeRow) {
    const res = await fetch("/api/admin/iwuf/codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
    const sj = await safeJson(res);
    if (!sj.ok) {
      setMsg(sj.json?.error || "Failed to save code");
      return false;
    }
    await loadAll();
    return true;
  }

  async function saveWindow(row: WindowRow) {
    const res = await fetch("/api/admin/iwuf/report-windows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
    const sj = await safeJson(res);
    if (!sj.ok) {
      setMsg(sj.json?.error || "Failed to save window");
      return false;
    }
    await loadAll();
    return true;
  }

  async function addGroup() {
    const saved = await saveGroup(newGroup);
    if (saved) setNewGroup({ name: "", min_age: null, max_age: null });
  }

  async function addForm() {
    const saved = await saveForm(newForm);
    if (saved) setNewForm({ name: "", age_group_id: "", sections_count: 4, video_links: [], is_active: true });
  }

  async function addCode() {
    const saved = await saveCode(newCode);
    if (saved) setNewCode({ event_type: "taolu", code_number: "", name: "", description: "", deduction_amount: 0 });
  }

  async function addWindow() {
    const saved = await saveWindow(newWindow);
    if (saved) setNewWindow({ label: "Last 30 Days", days: 30, sort_order: 1, is_active: true });
  }

  const groupById = useMemo(() => new Map(ageGroups.map((g) => [g.id, g])), [ageGroups]);

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <Link href="/admin/custom" style={backLink()}>← Back to Admin Workspace</Link>
      <div style={{ fontSize: 28, fontWeight: 1000 }}>IWUF Scoring Rules</div>
      <div style={{ opacity: 0.75, fontSize: 13 }}>
        Manage age groups, Taolu forms, deduction codes, and reporting windows for Form Forge.
      </div>

      {msg ? <div style={errorBox()}>{msg}</div> : null}

      <section style={card()}>
        <div style={{ fontWeight: 1000 }}>Age Groups</div>
        <div style={helperText()}>
          Define age bands used to group Taolu forms. These ranges are used for filtering and reporting.
        </div>
        <div style={fieldGuide()}>
          <div><b>Name</b> = the age group label shown in filters and reports.</div>
          <div><b>Min/Max</b> = optional age range limits used for filtering.</div>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {ageGroups.map((g) => (
            <div key={g.id} style={rowExisting()}>
              <input
                value={g.name}
                onChange={(e) => setAgeGroups((prev) => prev.map((r) => (r.id === g.id ? { ...r, name: e.target.value } : r)))}
                style={input()}
              />
              <input
                value={g.min_age ?? ""}
                onChange={(e) => setAgeGroups((prev) => prev.map((r) => (r.id === g.id ? { ...r, min_age: Number(e.target.value) || null } : r)))}
                placeholder="Min"
                style={input()}
              />
              <input
                value={g.max_age ?? ""}
                onChange={(e) => setAgeGroups((prev) => prev.map((r) => (r.id === g.id ? { ...r, max_age: Number(e.target.value) || null } : r)))}
                placeholder="Max"
                style={input()}
              />
              <button onClick={() => saveGroup(g)} style={btn()}>Save</button>
            </div>
          ))}
          <div style={separator()} />
          <div style={rowAdd()}>
            <input
              value={newGroup.name}
              onChange={(e) => setNewGroup((p) => ({ ...p, name: e.target.value }))}
              placeholder="New group"
              style={input()}
            />
            <input
              value={newGroup.min_age ?? ""}
              onChange={(e) => setNewGroup((p) => ({ ...p, min_age: Number(e.target.value) || null }))}
              placeholder="Min"
              style={input()}
            />
              <input
                value={newGroup.max_age ?? ""}
                onChange={(e) => setNewGroup((p) => ({ ...p, max_age: Number(e.target.value) || null }))}
                placeholder="Max"
                style={input()}
            />
            <button onClick={addGroup} style={btn()}>Add</button>
          </div>
        </div>
      </section>

      <section style={card()}>
        <div style={{ fontWeight: 1000 }}>Taolu Forms</div>
        <div style={helperText()}>
          Configure each Taolu form, its age group, number of sections, and reference video links.
        </div>
        <div style={fieldGuide()}>
          <div><b>Form name</b> = how the Taolu appears in trackers and dashboards.</div>
          <div><b>Age group</b> = optional filter label (use All ages if not grouped).</div>
          <div><b>Sections</b> = number of sections available for tracking.</div>
          <div><b>Video links</b> = comma-separated reference URLs.</div>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {forms.map((f) => (
            <div key={f.id} style={rowExisting()}>
              <input
                value={f.name}
                onChange={(e) => setForms((prev) => prev.map((r) => (r.id === f.id ? { ...r, name: e.target.value } : r)))}
                style={input()}
              />
              <select
                value={f.age_group_id ?? ""}
                onChange={(e) => setForms((prev) => prev.map((r) => (r.id === f.id ? { ...r, age_group_id: e.target.value } : r)))}
                style={input()}
              >
                <option value="">All ages</option>
                {ageGroups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <input
                value={f.sections_count ?? 4}
                onChange={(e) => setForms((prev) => prev.map((r) => (r.id === f.id ? { ...r, sections_count: Number(e.target.value) || 4 } : r)))}
                style={input()}
              />
              <input
                value={(f.video_links ?? []).join(", ")}
                onChange={(e) => setForms((prev) => prev.map((r) => (r.id === f.id ? { ...r, video_links: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) } : r)))}
                placeholder="Video links (comma separated)"
                style={inputWide()}
              />
              <button onClick={() => saveForm(f)} style={btn()}>Save</button>
            </div>
          ))}
          <div style={separator()} />
          <div style={rowAdd()}>
            <input
              value={newForm.name}
              onChange={(e) => setNewForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="New form"
              style={input()}
            />
            <select
              value={newForm.age_group_id ?? ""}
              onChange={(e) => setNewForm((p) => ({ ...p, age_group_id: e.target.value }))}
              style={input()}
            >
              <option value="">All ages</option>
              {ageGroups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <input
              value={newForm.sections_count ?? 4}
              onChange={(e) => setNewForm((p) => ({ ...p, sections_count: Number(e.target.value) || 4 }))}
              style={input()}
            />
            <input
              value={(newForm.video_links ?? []).join(", ")}
              onChange={(e) => setNewForm((p) => ({ ...p, video_links: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) }))}
              placeholder="Video links"
              style={inputWide()}
            />
            <button onClick={addForm} style={btn()}>Add</button>
          </div>
        </div>
      </section>

      <section style={card()}>
        <div style={{ fontWeight: 1000 }}>Deduction Codes</div>
        <div style={helperText()}>
          Create IWUF deduction codes used to label each logged deduction. Use code number, name, description, and amount.
        </div>
        <div style={fieldGuide()}>
          <div><b>Code #</b> = official IWUF code identifier (or your custom code).</div>
          <div><b>Name</b> = short label for the deduction type.</div>
          <div><b>Deduction</b> = point value subtracted when assigned.</div>
          <div><b>Description</b> = details or reasons tied to the code.</div>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {codes.map((c) => (
            <div key={c.id} style={rowExisting()}>
              <input
                value={c.code_number}
                onChange={(e) => setCodes((prev) => prev.map((r) => (r.id === c.id ? { ...r, code_number: e.target.value } : r)))}
                placeholder="Code #"
                style={input()}
              />
              <input
                value={c.name}
                onChange={(e) => setCodes((prev) => prev.map((r) => (r.id === c.id ? { ...r, name: e.target.value } : r)))}
                placeholder="Name"
                style={input()}
              />
              <input
                type="number"
                step="0.1"
                value={c.deduction_amount ?? ""}
                onChange={(e) =>
                  setCodes((prev) =>
                    prev.map((r) =>
                      r.id === c.id
                        ? { ...r, deduction_amount: e.target.value === "" ? undefined : Number(e.target.value) }
                        : r
                    )
                  )
                }
                placeholder="Deduction"
                style={input()}
              />
              <input
                value={c.description ?? ""}
                onChange={(e) => setCodes((prev) => prev.map((r) => (r.id === c.id ? { ...r, description: e.target.value } : r)))}
                placeholder="Reason / description"
                style={inputWide()}
              />
              <button onClick={() => saveCode(c)} style={btn()}>Save</button>
            </div>
          ))}
          <div style={separator()} />
          <div style={rowAdd()}>
            <input
              value={newCode.code_number}
              onChange={(e) => setNewCode((p) => ({ ...p, code_number: e.target.value }))}
              placeholder="Code #"
              style={input()}
            />
            <input
              value={newCode.name}
              onChange={(e) => setNewCode((p) => ({ ...p, name: e.target.value }))}
              placeholder="Name"
              style={input()}
            />
            <input
              type="number"
              step="0.1"
              value={newCode.deduction_amount ?? ""}
              onChange={(e) =>
                setNewCode((p) => ({ ...p, deduction_amount: e.target.value === "" ? undefined : Number(e.target.value) }))
              }
              placeholder="Deduction"
              style={input()}
            />
            <input
              value={newCode.description ?? ""}
              onChange={(e) => setNewCode((p) => ({ ...p, description: e.target.value }))}
              placeholder="Reason / description"
              style={inputWide()}
            />
            <button onClick={addCode} style={btn()}>Add</button>
          </div>
        </div>
      </section>

      <section style={card()}>
        <div style={{ fontWeight: 1000 }}>Report Windows</div>
        <div style={helperText()}>
          Choose the time ranges used in student Taolu reports (e.g., last 30/60/90 days).
        </div>
        <div style={fieldGuide()}>
          <div><b>Label</b> = the report filter name shown to users.</div>
          <div><b>Days</b> = how far back to count deductions.</div>
          <div><b>Order</b> = display order in dashboards (lower shows first).</div>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {windows.map((w) => (
            <div key={w.id} style={rowExisting()}>
              <input
                value={w.label}
                onChange={(e) => setWindows((prev) => prev.map((r) => (r.id === w.id ? { ...r, label: e.target.value } : r)))}
                placeholder="Label"
                style={input()}
              />
              <input
                value={w.days}
                onChange={(e) => setWindows((prev) => prev.map((r) => (r.id === w.id ? { ...r, days: Number(e.target.value) || 0 } : r)))}
                placeholder="Days"
                style={input()}
              />
              <input
                value={w.sort_order ?? 0}
                onChange={(e) => setWindows((prev) => prev.map((r) => (r.id === w.id ? { ...r, sort_order: Number(e.target.value) || 0 } : r)))}
                placeholder="Order"
                style={input()}
              />
              <button onClick={() => saveWindow(w)} style={btn()}>Save</button>
            </div>
          ))}
          <div style={separator()} />
          <div style={rowAdd()}>
            <input
              value={newWindow.label}
              onChange={(e) => setNewWindow((p) => ({ ...p, label: e.target.value }))}
              placeholder="Label"
              style={input()}
            />
            <input
              value={newWindow.days}
              onChange={(e) => setNewWindow((p) => ({ ...p, days: Number(e.target.value) || 0 }))}
              placeholder="Days"
              style={input()}
            />
            <input
              value={newWindow.sort_order ?? 0}
              onChange={(e) => setNewWindow((p) => ({ ...p, sort_order: Number(e.target.value) || 0 }))}
              placeholder="Order"
              style={input()}
            />
            <button onClick={addWindow} style={btn()}>Add</button>
          </div>
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

function helperText(): React.CSSProperties {
  return {
    fontSize: 12,
    opacity: 0.7,
  };
}

function fieldGuide(): React.CSSProperties {
  return {
    fontSize: 11,
    opacity: 0.75,
    display: "grid",
    gap: 4,
  };
}

function separator(): React.CSSProperties {
  return {
    height: 1,
    background: "rgba(255,255,255,0.08)",
    margin: "6px 0 2px",
  };
}

function rowBase(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "1.1fr 1fr 0.7fr 2fr auto",
    gap: 8,
    alignItems: "center",
    padding: 6,
    borderRadius: 12,
  };
}

function rowExisting(): React.CSSProperties {
  return {
    ...rowBase(),
    background: "rgba(15,23,42,0.35)",
    border: "1px solid rgba(255,255,255,0.08)",
  };
}

function rowAdd(): React.CSSProperties {
  return {
    ...rowBase(),
    background: "rgba(34,197,94,0.12)",
    border: "1px solid rgba(34,197,94,0.35)",
  };
}

function input(): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.25)",
    color: "white",
    fontWeight: 900,
  };
}

function inputWide(): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.25)",
    color: "white",
    fontWeight: 900,
  };
}

function btn(): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid rgba(59,130,246,0.35)",
    background: "rgba(59,130,246,0.25)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function errorBox(): React.CSSProperties {
  return {
    padding: 10,
    borderRadius: 14,
    background: "rgba(239,68,68,0.15)",
    border: "1px solid rgba(255,255,255,0.10)",
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

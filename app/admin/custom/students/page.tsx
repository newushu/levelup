"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type StudentRow = {
  id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email?: string | null;
  phone?: string | null;
  emergency_contact?: string | null;
  goals?: string | null;
  notes?: string | null;
  enrollment_info?: any;
  is_competition_team?: boolean | null;
};
type UnlockCriteriaDef = {
  key: string;
  label: string;
  description?: string | null;
  enabled?: boolean;
};
type UnlockRequirement = {
  id?: string;
  item_type: string;
  item_key: string;
  criteria_key: string;
};
type AvatarOption = { id: string; name: string; enabled?: boolean | null };
type EffectOption = { key: string; name: string; enabled?: boolean | null };

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 180)}` } };
  }
}

export default function StudentsAdminPage() {
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [msg, setMsg] = useState("");
  const [loginMsg, setLoginMsg] = useState("");
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    emergency_contact: "",
    goals: "",
    notes: "",
    enrollment_info: "",
  });
  const [loginForm, setLoginForm] = useState({
    email: "",
    username: "",
    password: "",
    role: "classroom",
  });
  const [criteria, setCriteria] = useState<UnlockCriteriaDef[]>([]);
  const [requirements, setRequirements] = useState<UnlockRequirement[]>([]);
  const [avatarOptions, setAvatarOptions] = useState<AvatarOption[]>([]);
  const [effectOptions, setEffectOptions] = useState<EffectOption[]>([]);
  const [criteriaStudentId, setCriteriaStudentId] = useState("");
  const [studentCriteriaMap, setStudentCriteriaMap] = useState<Record<string, { fulfilled: boolean; note?: string }>>({});
  const [newCriteria, setNewCriteria] = useState({ key: "", label: "", description: "" });
  const [assignForm, setAssignForm] = useState({ item_type: "avatar", item_key: "", criteria_key: "" });

  async function loadStudents() {
    const res = await fetch("/api/students/list", { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to load students");
    setRows((sj.json?.students ?? []) as StudentRow[]);
    const all = (sj.json?.students ?? []) as StudentRow[];
    if (!criteriaStudentId && all[0]?.id) setCriteriaStudentId(String(all[0].id));
  }

  async function loadUnlockCriteria(studentId?: string) {
    const url = studentId ? `/api/admin/unlock-criteria?student_id=${encodeURIComponent(studentId)}` : "/api/admin/unlock-criteria";
    const res = await fetch(url, { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to load unlock criteria");
    setCriteria((sj.json?.criteria ?? []) as UnlockCriteriaDef[]);
    setRequirements((sj.json?.requirements ?? []) as UnlockRequirement[]);
    setAvatarOptions((sj.json?.avatars ?? []) as AvatarOption[]);
    setEffectOptions((sj.json?.effects ?? []) as EffectOption[]);
    const map: Record<string, { fulfilled: boolean; note?: string }> = {};
    ((sj.json?.student_criteria ?? []) as Array<{ criteria_key: string; fulfilled?: boolean; note?: string }>).forEach((row) => {
      map[String(row.criteria_key)] = { fulfilled: row.fulfilled !== false, note: row.note ?? "" };
    });
    setStudentCriteriaMap(map);
  }

  useEffect(() => {
    loadStudents();
    loadUnlockCriteria();
  }, []);

  useEffect(() => {
    if (!criteriaStudentId) return;
    loadUnlockCriteria(criteriaStudentId);
  }, [criteriaStudentId]);

  async function createStudent() {
    setMsg("");
    let enrollment_info: any = null;
    if (form.enrollment_info.trim()) {
      try {
        enrollment_info = JSON.parse(form.enrollment_info);
      } catch {
        return setMsg("Enrollment info must be valid JSON.");
      }
    }
    const res = await fetch("/api/admin/students/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        emergency_contact: form.emergency_contact.trim(),
        goals: form.goals.trim(),
        notes: form.notes.trim(),
        enrollment_info,
      }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to create student");
    setForm({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      emergency_contact: "",
      goals: "",
      notes: "",
      enrollment_info: "",
    });
    loadStudents();
  }

  async function createRoleLogin() {
    setLoginMsg("");
    const res = await fetch("/api/admin/create-role-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: loginForm.email.trim(),
        username: loginForm.username.trim(),
        password: loginForm.password.trim(),
        role: loginForm.role,
      }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setLoginMsg(sj.json?.error || "Failed to create login");
    setLoginMsg("Login created.");
    setLoginForm({ email: "", username: "", password: "", role: "classroom" });
  }

  async function updateCompetition(id: string, value: boolean) {
    setMsg("");
    const res = await fetch("/api/students/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: id, is_competition_team: value }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to update student");
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, is_competition_team: value } : row)));
  }

  async function upsertCriteria() {
    if (!newCriteria.key.trim() || !newCriteria.label.trim()) return;
    const res = await fetch("/api/admin/unlock-criteria", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsert_criteria",
        key: newCriteria.key.trim().toLowerCase(),
        label: newCriteria.label.trim(),
        description: newCriteria.description.trim(),
        enabled: true,
      }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to save criteria");
    setNewCriteria({ key: "", label: "", description: "" });
    await loadUnlockCriteria(criteriaStudentId || undefined);
  }

  async function setRequirement(required: boolean) {
    if (!assignForm.criteria_key || !assignForm.item_key) return;
    const res = await fetch("/api/admin/unlock-criteria", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "set_requirement",
        item_type: assignForm.item_type,
        item_key: assignForm.item_key,
        criteria_key: assignForm.criteria_key,
        required,
      }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to update requirement");
    await loadUnlockCriteria(criteriaStudentId || undefined);
  }

  async function toggleStudentCriteria(criteriaKey: string, fulfilled: boolean) {
    if (!criteriaStudentId) return;
    const res = await fetch("/api/admin/unlock-criteria", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "set_student_criteria",
        student_id: criteriaStudentId,
        criteria_key: criteriaKey,
        fulfilled,
      }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to update student criteria");
    await loadUnlockCriteria(criteriaStudentId);
  }

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <Link href="/admin/custom" style={backLink()}>← Back to Admin Workspace</Link>
      <div style={{ fontSize: 28, fontWeight: 1000 }}>Student Directory</div>
      <div style={{ opacity: 0.75, fontSize: 13 }}>
        Add students with just first and last name. Contact info and goals can be updated later in the profile tab.
      </div>

      {msg ? <div style={errorBox()}>{msg}</div> : null}

      <section style={card()}>
        <div style={{ fontWeight: 1000 }}>Add Student</div>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <input
              value={form.first_name}
              onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
              placeholder="First name *"
              style={input()}
            />
            <input
              value={form.last_name}
              onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))}
              placeholder="Last name *"
              style={input()}
            />
            <input
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              placeholder="Email"
              style={input()}
            />
            <input
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              placeholder="Phone"
              style={input()}
            />
            <input
              value={form.emergency_contact}
              onChange={(e) => setForm((p) => ({ ...p, emergency_contact: e.target.value }))}
              placeholder="Emergency contact"
              style={input()}
            />
          </div>
          <textarea
            value={form.goals}
            onChange={(e) => setForm((p) => ({ ...p, goals: e.target.value }))}
            placeholder="Goals"
            style={textarea()}
          />
          <textarea
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            placeholder="Notes"
            style={textarea()}
          />
          <textarea
            value={form.enrollment_info}
            onChange={(e) => setForm((p) => ({ ...p, enrollment_info: e.target.value }))}
            placeholder="Enrollment info (JSON optional)"
            style={textarea()}
          />
          <button onClick={createStudent} style={btn()}>Create Student</button>
        </div>
      </section>

      <section style={card()}>
        <div style={{ fontWeight: 1000 }}>Avatar Unlock Criteria</div>
        <div style={{ opacity: 0.72, fontSize: 12 }}>
          Create yes/no criteria, attach them to avatars/effects, and mark fulfillment per student.
        </div>

        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <input
              value={newCriteria.key}
              onChange={(e) => setNewCriteria((p) => ({ ...p, key: e.target.value }))}
              placeholder="criteria_key (hardworking)"
              style={input()}
            />
            <input
              value={newCriteria.label}
              onChange={(e) => setNewCriteria((p) => ({ ...p, label: e.target.value }))}
              placeholder="Label (Hard Working)"
              style={input()}
            />
            <input
              value={newCriteria.description}
              onChange={(e) => setNewCriteria((p) => ({ ...p, description: e.target.value }))}
              placeholder="Description"
              style={input()}
            />
            <button onClick={upsertCriteria} style={btn()}>Add Criteria</button>
          </div>

          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <select
              value={assignForm.item_type}
              onChange={(e) => setAssignForm((p) => ({ ...p, item_type: e.target.value, item_key: "" }))}
              style={input()}
            >
              <option value="avatar">Avatar</option>
              <option value="effect">Avatar Effect</option>
            </select>
            <select
              value={assignForm.item_key}
              onChange={(e) => setAssignForm((p) => ({ ...p, item_key: e.target.value }))}
              style={input()}
            >
              <option value="">Select item</option>
              {assignForm.item_type === "avatar"
                ? avatarOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)
                : effectOptions.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}
            </select>
            <select
              value={assignForm.criteria_key}
              onChange={(e) => setAssignForm((p) => ({ ...p, criteria_key: e.target.value }))}
              style={input()}
            >
              <option value="">Select criteria</option>
              {criteria.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setRequirement(true)} style={btn()}>Require</button>
              <button onClick={() => setRequirement(false)} style={btn()}>Remove</button>
            </div>
          </div>

          <div style={{ fontSize: 12, opacity: 0.82 }}>
            Current requirements: {requirements.length ? requirements.map((r) => `${r.item_type}:${r.item_key} -> ${r.criteria_key}`).join(" • ") : "none"}
          </div>

          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "240px 1fr" }}>
            <select value={criteriaStudentId} onChange={(e) => setCriteriaStudentId(e.target.value)} style={input()}>
              <option value="">Select student</option>
              {rows.map((s) => <option key={s.id} value={s.id}>{s.name ?? `${s.first_name ?? ""} ${s.last_name ?? ""}`}</option>)}
            </select>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {criteria.map((c) => {
                const on = studentCriteriaMap[c.key]?.fulfilled === true;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => toggleStudentCriteria(c.key, !on)}
                    style={{
                      ...btn(),
                      background: on ? "rgba(34,197,94,0.22)" : "rgba(59,130,246,0.2)",
                      borderColor: on ? "rgba(34,197,94,0.42)" : "rgba(59,130,246,0.35)",
                    }}
                  >
                    {on ? "✓ " : ""}{c.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section style={card()}>
        <div style={{ fontWeight: 1000 }}>Create Special Login</div>
        <div style={{ opacity: 0.7, fontSize: 12 }}>
          Classroom = check-in only. Skill Pulse = Skill Pulse page only. Display = roster display only.
        </div>
        {loginMsg ? <div style={notice()}>{loginMsg}</div> : null}
        <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <input
              value={loginForm.email}
              onChange={(e) => setLoginForm((p) => ({ ...p, email: e.target.value }))}
              placeholder="Email *"
              style={input()}
            />
            <input
              value={loginForm.username}
              onChange={(e) => setLoginForm((p) => ({ ...p, username: e.target.value }))}
              placeholder="Username (optional)"
              style={input()}
            />
            <input
              value={loginForm.password}
              onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))}
              placeholder="Password *"
              type="password"
              style={input()}
            />
            <select
              value={loginForm.role}
              onChange={(e) => setLoginForm((p) => ({ ...p, role: e.target.value }))}
              style={input()}
            >
              <option value="classroom">Classroom (check-in)</option>
              <option value="skill_pulse">Skill Pulse</option>
              <option value="display">Display</option>
              <option value="camp">Camp</option>
            </select>
          </div>
          <button onClick={createRoleLogin} style={btn()}>Create Login</button>
        </div>
      </section>

      <section style={card()}>
        <div style={{ fontWeight: 1000 }}>Current Students</div>
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          {rows.map((s) => (
            <div key={s.id} style={row()}>
              <div style={{ fontWeight: 900 }}>{s.first_name} {s.last_name}</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>{s.email ?? "—"}</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>{s.phone ?? "—"}</div>
              <label style={toggleLabel()}>
                <input
                  type="checkbox"
                  checked={!!s.is_competition_team}
                  onChange={(e) => updateCompetition(s.id, e.target.checked)}
                />
                Competition Team
              </label>
            </div>
          ))}
          {!rows.length ? <div style={{ opacity: 0.7 }}>No students yet.</div> : null}
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

function textarea(): React.CSSProperties {
  return {
    minHeight: 80,
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.25)",
    color: "white",
    fontWeight: 600,
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

function row(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr 1fr 0.8fr",
    gap: 10,
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
  };
}

function toggleLabel(): React.CSSProperties {
  return {
    display: "flex",
    gap: 8,
    alignItems: "center",
    fontSize: 12,
    opacity: 0.8,
    fontWeight: 800,
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

function notice(): React.CSSProperties {
  return {
    padding: 10,
    borderRadius: 14,
    background: "rgba(34,197,94,0.15)",
    border: "1px solid rgba(255,255,255,0.10)",
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

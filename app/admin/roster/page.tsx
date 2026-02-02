"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type StudentRow = {
  id: string;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  is_competition_team?: boolean | null;
};

type SlotRow = {
  slot_key: string;
  label: string;
  coach_user_id?: string | null;
  coach_name?: string | null;
  coach_email?: string | null;
};

type CoachRow = { id: string; name?: string | null; email?: string | null };

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status})` } };
  }
}

export default function AdminRosterPage() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"students" | "users">("students");
  const [msg, setMsg] = useState("");

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [studentForm, setStudentForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
  });

  const [userMsg, setUserMsg] = useState("");
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    password: "",
    username: "",
    role: "coach",
    student_id: "",
  });
  const [lastTempPassword, setLastTempPassword] = useState<string>("");
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [coaches, setCoaches] = useState<CoachRow[]>([]);

  useEffect(() => {
    loadStudents();
    loadSlots();
    loadCoaches();
  }, []);

  useEffect(() => {
    const nextTab = String(searchParams.get("tab") ?? "").toLowerCase();
    if (nextTab === "users" || nextTab === "students") {
      setTab(nextTab as "students" | "users");
    }
  }, [searchParams]);

  async function loadStudents() {
    const res = await fetch("/api/students/list", { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to load students");
    setStudents((sj.json?.students ?? []) as StudentRow[]);
  }

  async function loadSlots() {
    const res = await fetch("/api/coach-display-slots", { cache: "no-store" });
    const sj = await safeJson(res);
    if (sj.ok) setSlots((sj.json?.slots ?? []) as SlotRow[]);
  }

  async function loadCoaches() {
    const res = await fetch("/api/admin/coaches/list", { cache: "no-store" });
    const sj = await safeJson(res);
    if (sj.ok) setCoaches((sj.json?.coaches ?? []) as CoachRow[]);
  }

  async function createStudent() {
    setMsg("");
    const res = await fetch("/api/admin/students/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: studentForm.first_name.trim(),
        last_name: studentForm.last_name.trim(),
        email: studentForm.email.trim(),
        phone: studentForm.phone.trim(),
      }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to create student");
    setStudentForm({ first_name: "", last_name: "", email: "", phone: "" });
    loadStudents();
  }

  async function createUser() {
    setUserMsg("");
    setLastTempPassword("");
    const res = await fetch("/api/admin/users/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: userForm.name.trim(),
        email: userForm.email.trim(),
        password: userForm.password.trim(),
        username: userForm.username.trim(),
        role: userForm.role,
        student_id: userForm.role === "student" ? userForm.student_id : null,
      }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setUserMsg(sj.json?.error || "Failed to create user");
    if (sj.json?.temp_password) {
      setLastTempPassword(String(sj.json.temp_password));
      setUserMsg("User created. Temporary password generated.");
    } else {
      setUserMsg("User created.");
    }
    setUserForm({ name: "", email: "", password: "", username: "", role: "coach", student_id: "" });
    loadCoaches();
  }

  async function saveSlot(slot_key: string, coach_user_id: string | null) {
    const res = await fetch("/api/admin/coach-display-slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot_key, coach_user_id }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setUserMsg(sj.json?.error || "Failed to update slot");
    await loadSlots();
  }

  const sortedStudents = useMemo(
    () => students.slice().sort((a, b) => String(a.name ?? `${a.first_name ?? ""} ${a.last_name ?? ""}`).localeCompare(String(b.name ?? ""))),
    [students]
  );

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <Link href="/admin" style={backLink()}>← Back to Admin</Link>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 1000 }}>Roster Account Management</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Create users, manage students, and assign coach displays.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={tabBtn(tab === "students")} onClick={() => setTab("students")}>Roster</button>
          <button style={tabBtn(tab === "users")} onClick={() => setTab("users")}>Users</button>
        </div>
      </div>

      {msg ? <div style={notice()}>{msg}</div> : null}

      {tab === "students" ? (
        <section style={card()}>
          <div style={{ fontWeight: 1000 }}>Student Directory</div>
          <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <input
                value={studentForm.first_name}
                onChange={(e) => setStudentForm((p) => ({ ...p, first_name: e.target.value }))}
                placeholder="First name *"
                style={input()}
              />
              <input
                value={studentForm.last_name}
                onChange={(e) => setStudentForm((p) => ({ ...p, last_name: e.target.value }))}
                placeholder="Last name *"
                style={input()}
              />
              <input
                value={studentForm.email}
                onChange={(e) => setStudentForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="Email"
                style={input()}
              />
              <input
                value={studentForm.phone}
                onChange={(e) => setStudentForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="Phone"
                style={input()}
              />
            </div>
            <button style={btn()} onClick={createStudent}>Create Student</button>
          </div>

          <div style={{ marginTop: 14, fontWeight: 900 }}>Current Students</div>
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            {sortedStudents.map((s) => (
              <div key={s.id} style={row()}>
                <div style={{ fontWeight: 900 }}>{s.name ?? `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim()}</div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>{s.email ?? "—"}</div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>{s.phone ?? "—"}</div>
              </div>
            ))}
            {!sortedStudents.length ? <div style={{ opacity: 0.7 }}>No students yet.</div> : null}
          </div>
        </section>
      ) : (
        <section style={card()}>
          <div style={{ fontWeight: 1000 }}>User Creation</div>
          <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
            {userMsg ? <div style={notice()}>{userMsg}</div> : null}
            {lastTempPassword ? (
              <div style={notice()}>
                Temp password: <span style={{ fontWeight: 1000 }}>{lastTempPassword}</span>
              </div>
            ) : null}
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <input
                value={userForm.name}
                onChange={(e) => setUserForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Full name *"
                style={input()}
              />
              <input
                value={userForm.email}
                onChange={(e) => setUserForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="Email *"
                style={input()}
              />
              <input
                value={userForm.password}
                onChange={(e) => setUserForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="Password (leave blank to auto-generate)"
                type="password"
                style={input()}
              />
              <input
                value={userForm.username}
                onChange={(e) => setUserForm((p) => ({ ...p, username: e.target.value }))}
                placeholder="Username (optional)"
                style={input()}
              />
              <select
                value={userForm.role}
                onChange={(e) => setUserForm((p) => ({ ...p, role: e.target.value }))}
                style={input()}
              >
                <option value="admin">Admin</option>
                <option value="coach">Coach</option>
                <option value="student">Student</option>
                <option value="parent">Parent</option>
                <option value="display">Display</option>
                <option value="skill_pulse">SkillPulse Tablet</option>
              </select>
              {userForm.role === "student" ? (
                <select
                  value={userForm.student_id}
                  onChange={(e) => setUserForm((p) => ({ ...p, student_id: e.target.value }))}
                  style={input()}
                >
                  <option value="">Select student</option>
                  {sortedStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name ?? `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim()}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
            <button style={btn()} onClick={createUser}>Create User</button>
          </div>

          <div style={{ marginTop: 20, fontWeight: 1000 }}>Coach Displays</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Assign each display to a coach account (Coach 1-4).
          </div>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            {slots.map((slot) => (
              <div key={slot.slot_key} style={row()}>
                <div style={{ fontWeight: 900 }}>{displayLabel(slot)}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {slot.coach_name || slot.coach_email || "Unassigned"}
                </div>
                <select
                  value={slot.coach_user_id ?? ""}
                  onChange={(e) => saveSlot(slot.slot_key, e.target.value || null)}
                  style={input()}
                >
                  <option value="">Unassigned</option>
                  {coaches.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.email || c.id}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>
      )}
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
    gap: 12,
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
    gridTemplateColumns: "1fr 1fr minmax(180px, 220px)",
    gap: 10,
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    alignItems: "center",
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

function tabBtn(active: boolean): React.CSSProperties {
  return {
    borderRadius: 999,
    padding: "6px 12px",
    border: active ? "1px solid rgba(59,130,246,0.6)" : "1px solid rgba(255,255,255,0.2)",
    background: active ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
  };
}

function displayLabel(slot: { slot_key: string; label?: string | null }) {
  const key = String(slot.slot_key ?? "");
  if (key.startsWith("coach_")) {
    const num = key.replace("coach_", "");
    if (num) return `Display ${num}`;
  }
  return String(slot.label ?? slot.slot_key ?? "Display");
}

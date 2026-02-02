"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";

type Student = {
  id: string;
  name: string;
  age: number | null;
  rank: string | null;
  level: number;
  is_competition_team: boolean;
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderRadius: 18, padding: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
      <div style={{ fontWeight: 950, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

export default function AdminPage() {
  const supabase = useMemo(() => supabaseClient(), []);
  const [meRole, setMeRole] = useState<string>("coach");
  const [students, setStudents] = useState<Student[]>([]);
  const [msg, setMsg] = useState<string>("");

  // Coach create
  const [coachEmail, setCoachEmail] = useState("");
  const [coachUsername, setCoachUsername] = useState("");
  const [coachPassword, setCoachPassword] = useState("");
  const [coachRole, setCoachRole] = useState<"coach" | "admin">("coach");

  // Student create
  const [sName, setSName] = useState("");
  const [sAge, setSAge] = useState<string>("");
  const [sRank, setSRank] = useState("");
  const [sLevel, setSLevel] = useState<string>("1");
  const [sComp, setSComp] = useState(false);

  // Parent create
  const [pName, setPName] = useState("");
  const [pEmail, setPEmail] = useState("");
  const [pPhone, setPPhone] = useState("");
  const [pPassword, setPPassword] = useState("");
  const [pStudentId, setPStudentId] = useState("");

  async function refresh() {
    setMsg("");

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    const { data: prof } = await supabase.from("profiles").select("role").eq("user_id", auth.user.id).maybeSingle();
    setMeRole(prof?.role ?? "coach");

    const { data: studs } = await supabase
      .from("students")
      .select("id,name,age,rank,level,is_competition_team")
      .order("created_at", { ascending: false })
      .limit(200);

    setStudents((studs as any) ?? []);
    if (!pStudentId && (studs as any)?.[0]?.id) setPStudentId((studs as any)[0].id);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function call(path: string, body: any) {
    setMsg("");
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data?.error || "Request failed");
      return null;
    }
    setMsg("✅ Success");
    await refresh();
    return data;
  }

  if (meRole !== "admin") {
    return (
      <div style={{ padding: 20, borderRadius: 18, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)" }}>
        Admin only. (Your role is: {meRole})
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ fontSize: 24, fontWeight: 950 }}>Admin Console</div>

      {msg && (
        <div style={{ borderRadius: 14, padding: "10px 12px", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)" }}>
          {msg}
        </div>
      )}

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <Card title="Create Coach Account (Username + Password)">
          <div style={{ display: "grid", gap: 8 }}>
            <input value={coachEmail} onChange={(e) => setCoachEmail(e.target.value)} placeholder="email" style={inp()} />
            <input value={coachUsername} onChange={(e) => setCoachUsername(e.target.value)} placeholder="username (e.g. calvin)" style={inp()} />
            <input value={coachPassword} onChange={(e) => setCoachPassword(e.target.value)} placeholder="password" type="password" style={inp()} />
            <select value={coachRole} onChange={(e) => setCoachRole(e.target.value as any)} style={inp()}>
              <option value="coach">coach</option>
              <option value="admin">admin</option>
            </select>
            <button
              onClick={() =>
                call("/api/admin/create-coach", {
                  email: coachEmail,
                  username: coachUsername,
                  password: coachPassword,
                  role: coachRole,
                })
              }
              style={btn()}
            >
              Create Coach
            </button>
          </div>
        </Card>

        <Card title="Create Student (Roster)">
          <div style={{ display: "grid", gap: 8 }}>
            <input value={sName} onChange={(e) => setSName(e.target.value)} placeholder="Student name" style={inp()} />
            <input value={sAge} onChange={(e) => setSAge(e.target.value)} placeholder="Age (optional)" style={inp()} />
            <input value={sRank} onChange={(e) => setSRank(e.target.value)} placeholder="Rank (optional)" style={inp()} />
            <input value={sLevel} onChange={(e) => setSLevel(e.target.value)} placeholder="Level" style={inp()} />
            <label style={{ display: "flex", gap: 10, alignItems: "center", opacity: 0.9 }}>
              <input type="checkbox" checked={sComp} onChange={(e) => setSComp(e.target.checked)} />
              Competition Team
            </label>
            <button
              onClick={() =>
                call("/api/admin/create-student", {
                  name: sName,
                  age: sAge ? Number(sAge) : null,
                  rank: sRank || null,
                  level: sLevel ? Number(sLevel) : 1,
                  is_competition_team: sComp,
                })
              }
              style={btn()}
            >
              Create Student
            </button>
          </div>
        </Card>

        <Card title="Create Parent Account + Link to Student">
          <div style={{ display: "grid", gap: 8 }}>
            <input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Parent name" style={inp()} />
            <input value={pEmail} onChange={(e) => setPEmail(e.target.value)} placeholder="Parent email" style={inp()} />
            <input value={pPhone} onChange={(e) => setPPhone(e.target.value)} placeholder="Phone (optional)" style={inp()} />
            <input value={pPassword} onChange={(e) => setPPassword(e.target.value)} placeholder="Password" type="password" style={inp()} />
            <select value={pStudentId} onChange={(e) => setPStudentId(e.target.value)} style={inp()}>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (Lv {s.level}){s.is_competition_team ? " ⭐" : ""}
                </option>
              ))}
            </select>
            <button
              onClick={() =>
                call("/api/admin/create-parent", {
                  name: pName,
                  email: pEmail,
                  phone: pPhone || null,
                  password: pPassword,
                  student_id: pStudentId,
                })
              }
              style={btn()}
            >
              Create Parent + Link
            </button>
          </div>
        </Card>
      </div>

      <Card title="Recent Students">
        <div style={{ display: "grid", gap: 8 }}>
          {students.slice(0, 12).map((s) => (
            <div
              key={s.id}
              style={{
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(0,0,0,0.20)",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <div style={{ fontWeight: 900 }}>
                {s.name} {s.is_competition_team ? "⭐" : ""}
              </div>
              <div style={{ opacity: 0.8 }}>Lv {s.level}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function inp(): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.24)",
    color: "white",
    outline: "none",
  };
}

function btn(): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "linear-gradient(90deg, rgba(59,130,246,0.85), rgba(34,197,94,0.70))",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
  };
}

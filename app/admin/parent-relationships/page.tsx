"use client";

import { useEffect, useMemo, useState } from "react";
import AuthGate from "@/components/AuthGate";

type StudentRow = {
  id: string;
  name: string;
};

type RelationshipRow = {
  id: string;
  student_id_a: string;
  student_id_b: string;
  relationship_type: string;
  created_at: string;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status})` } };
  }
}

export default function ParentRelationshipsPage() {
  return (
    <AuthGate>
      <ParentRelationshipsInner />
    </AuthGate>
  );
}

function ParentRelationshipsInner() {
  const [role, setRole] = useState("student");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [relationships, setRelationships] = useState<RelationshipRow[]>([]);
  const [studentA, setStudentA] = useState("");
  const [studentB, setStudentB] = useState("");
  const [relationshipType, setRelationshipType] = useState("sibling");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const sj = await safeJson(res);
      if (sj.ok) setRole(String(sj.json?.role ?? "student"));
    })();
  }, []);

  useEffect(() => {
    if (role !== "admin") return;
    (async () => {
      const stuRes = await fetch("/api/students/list", { cache: "no-store" });
      const stuJson = await safeJson(stuRes);
      if (stuJson.ok) setStudents((stuJson.json?.students ?? []) as StudentRow[]);

      await refreshRelationships();
    })();
  }, [role]);

  async function refreshRelationships() {
    const relRes = await fetch("/api/admin/parent-relationships/list", { cache: "no-store" });
    const relJson = await safeJson(relRes);
    if (!relJson.ok) return setMsg(relJson.json?.error || "Failed to load relationships");
    setRelationships((relJson.json?.relationships ?? []) as RelationshipRow[]);
  }

  const studentsById = useMemo(() => {
    const map = new Map<string, StudentRow>();
    students.forEach((s) => map.set(s.id, s));
    return map;
  }, [students]);

  const sortedStudents = useMemo(
    () => students.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [students]
  );

  async function createRelationship() {
    setMsg("");
    if (!studentA || !studentB) return setMsg("Select two students.");
    if (studentA === studentB) return setMsg("Pick two different students.");
    setSaving(true);
    const res = await fetch("/api/admin/parent-relationships/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id_a: studentA,
        student_id_b: studentB,
        relationship_type: relationshipType || "sibling",
      }),
    });
    const sj = await safeJson(res);
    setSaving(false);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to create relationship");
    setMsg("Relationship saved.");
    setStudentA("");
    setStudentB("");
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
    await refreshRelationships();
  }

  if (role !== "admin") {
    return (
      <main style={{ padding: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Admin access only.</div>
      </main>
    );
  }

  return (
    <main style={{ padding: 18, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ fontSize: 28, fontWeight: 1000 }}>Student Relationships</div>
      <div style={{ opacity: 0.7, marginTop: 6 }}>
        Create sibling or guardian relationships between student accounts.
      </div>
      {msg ? <div style={{ marginTop: 10, opacity: 0.8 }}>{msg}</div> : null}

      <div style={{ marginTop: 16, display: "grid", gap: 10, maxWidth: 560 }}>
        <label style={label()}>Student A</label>
        <select value={studentA} onChange={(e) => setStudentA(e.target.value)} style={select()}>
          <option value="">Select a student</option>
          {sortedStudents.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <label style={label()}>Student B</label>
        <select value={studentB} onChange={(e) => setStudentB(e.target.value)} style={select()}>
          <option value="">Select a student</option>
          {sortedStudents.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <label style={label()}>Relationship</label>
        <select value={relationshipType} onChange={(e) => setRelationshipType(e.target.value)} style={select()}>
          <option value="sibling">Sibling</option>
          <option value="close_friend">Close Friend</option>
          <option value="spouse">Spouse</option>
          <option value="parent_child">Parent / Child</option>
        </select>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          {relationshipText(studentA, studentB, relationshipType, studentsById)}
        </div>

        <button onClick={createRelationship} style={btn()} disabled={saving}>
          {saving ? "Saving..." : saved ? "Saved!" : "Create Relationship"}
        </button>
      </div>

      <div style={{ marginTop: 20, display: "grid", gap: 10 }}>
        {relationships.map((rel) => (
          <div key={rel.id} style={card()}>
            <div style={{ fontWeight: 900 }}>{rel.relationship_type.replace("_", " ")}</div>
            <div style={{ opacity: 0.8, fontSize: 13 }}>
              {relationshipText(rel.student_id_a, rel.student_id_b, rel.relationship_type, studentsById)}
            </div>
            <div style={{ opacity: 0.6, fontSize: 11 }}>{new Date(rel.created_at).toLocaleString()}</div>
          </div>
        ))}
        {!relationships.length && <div style={{ opacity: 0.7 }}>No relationships yet.</div>}
      </div>
    </main>
  );
}

function card(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(8,10,15,0.7)",
    display: "grid",
    gap: 6,
  };
}

function label(): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.8,
  };
}

function select(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.4)",
    color: "white",
    fontSize: 13,
  };
}

function relationshipText(
  studentA: string,
  studentB: string,
  relationshipType: string,
  studentsById: Map<string, StudentRow>
): string {
  if (!studentA || !studentB) return "Select Student A and Student B.";
  const aName = studentsById.get(studentA)?.name ?? "Student A";
  const bName = studentsById.get(studentB)?.name ?? "Student B";
  const type = String(relationshipType || "sibling").toLowerCase();
  if (type === "parent_child") return `${aName} is child of ${bName}.`;
  if (type === "spouse") return `${aName} is spouse of ${bName}.`;
  if (type === "close_friend") return `${aName} is close friend of ${bName}.`;
  return `${aName} is sibling of ${bName}.`;
}

function btn(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(59,130,246,0.6)",
    background: "linear-gradient(90deg, rgba(59,130,246,0.9), rgba(14,116,144,0.7))",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

"use client";

import { useEffect, useMemo, useState } from "react";

type PassType = { id: string; name: string; default_valid_days?: number | null };
type StudentPick = { id: string; name: string };

export default function AdminPassAssignPage() {
  const [role, setRole] = useState("student");
  const [passes, setPasses] = useState<PassType[]>([]);
  const [studentQuery, setStudentQuery] = useState("");
  const [studentResults, setStudentResults] = useState<StudentPick[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentPick | null>(null);
  const [studentPasses, setStudentPasses] = useState<any[]>([]);
  const [assignPassId, setAssignPassId] = useState("");
  const [assignStart, setAssignStart] = useState("");
  const [assignEnd, setAssignEnd] = useState("");
  const [assignPaid, setAssignPaid] = useState(false);
  const [msg, setMsg] = useState("");

  const [bulkPassId, setBulkPassId] = useState("");
  const [bulkStart, setBulkStart] = useState("");
  const [bulkEnd, setBulkEnd] = useState("");
  const [bulkPaid, setBulkPaid] = useState(false);
  const [bulkSelections, setBulkSelections] = useState<StudentPick[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json();
        if (data?.ok) setRole(String(data?.role ?? "student"));
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/passes/list", { cache: "no-store" });
        const data = await res.json();
        if (res.ok) setPasses((data.passes ?? []) as PassType[]);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!studentQuery.trim()) {
      setStudentResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/students/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: studentQuery.trim() }),
        });
        const data = await res.json();
        if (res.ok) setStudentResults((data.students ?? []).map((s: any) => ({ id: s.id, name: s.name })));
      } catch {}
    }, 200);
    return () => clearTimeout(t);
  }, [studentQuery]);

  useEffect(() => {
    if (!selectedStudent?.id) {
      setStudentPasses([]);
      return;
    }
    (async () => {
      const res = await fetch("/api/passes/student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: selectedStudent.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setStudentPasses((data.passes ?? []) as any[]);
    })();
  }, [selectedStudent]);

  useEffect(() => {
    if (!assignPassId || assignStart) return;
    const pass = passes.find((p) => p.id === assignPassId);
    if (!pass?.default_valid_days) return;
    const start = new Date().toISOString().slice(0, 10);
    const end = new Date();
    end.setDate(end.getDate() + pass.default_valid_days);
    setAssignStart(start);
    setAssignEnd(end.toISOString().slice(0, 10));
  }, [assignPassId, assignStart, passes]);

  async function assignPass() {
    if (!selectedStudent?.id || !assignPassId || !assignStart) return;
    setMsg("");
    const res = await fetch("/api/passes/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id: selectedStudent.id,
        pass_type_id: assignPassId,
        valid_from: assignStart,
        valid_to: assignEnd || null,
        payment_confirmed: assignPaid,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data?.error || "Failed to assign pass");
    const list = await fetch("/api/passes/student", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: selectedStudent.id }),
    }).then((r) => r.json());
    setStudentPasses((list.passes ?? []) as any[]);
  }

  async function bulkAssign() {
    if (!bulkSelections.length || !bulkPassId || !bulkStart) return;
    setMsg("");
    const res = await fetch("/api/passes/bulk-assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pass_type_id: bulkPassId,
        valid_from: bulkStart,
        valid_to: bulkEnd || null,
        student_ids: bulkSelections.map((s) => s.id),
        payment_confirmed: bulkPaid,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data?.error || "Failed to bulk assign");
    setMsg(`Assigned to ${data?.assigned ?? bulkSelections.length} students.`);
    setBulkSelections([]);
  }

  const bulkSelectedIds = useMemo(() => new Set(bulkSelections.map((s) => s.id)), [bulkSelections]);

  if (role !== "admin") {
    return (
      <main style={{ padding: 18 }}>
        <div style={{ fontSize: 24, fontWeight: 900 }}>Admin access required.</div>
      </main>
    );
  }

  return (
    <main style={{ padding: 18, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ fontSize: 28, fontWeight: 1000 }}>Pass Assignment</div>
      {msg ? <div style={{ marginTop: 8, color: "crimson", fontWeight: 700 }}>{msg}</div> : null}

      <section style={card()}>
        <div style={cardTitle()}>Assign to a Student</div>
        <div style={grid()}>
          <label style={label()}>
            Search student
            <input value={studentQuery} onChange={(e) => setStudentQuery(e.target.value)} style={input()} placeholder="Start typing a name..." />
          </label>
          <label style={label()}>
            Selected student
            <input value={selectedStudent?.name ?? ""} readOnly style={input()} />
          </label>
        </div>
        {studentResults.length ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {studentResults.slice(0, 8).map((s) => (
              <button key={s.id} onClick={() => setSelectedStudent(s)} style={chip()}>
                {s.name}
              </button>
            ))}
          </div>
        ) : null}

        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          <label style={label()}>
            Pass
            <select value={assignPassId} onChange={(e) => setAssignPassId(e.target.value)} style={input()}>
              <option value="">Select pass</option>
              {passes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label style={label()}>
            Valid from
            <input type="date" value={assignStart} onChange={(e) => setAssignStart(e.target.value)} style={input()} />
          </label>
          <label style={label()}>
            Valid to
            <input type="date" value={assignEnd} onChange={(e) => setAssignEnd(e.target.value)} style={input()} />
          </label>
          <label style={label()}>
            Mark as paid
            <input type="checkbox" checked={assignPaid} onChange={(e) => setAssignPaid(e.target.checked)} />
          </label>
        </div>
        <button onClick={assignPass} style={btnPrimary()}>
          Assign pass
        </button>

        <div style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Current passes</div>
          {!studentPasses.length ? <div style={{ opacity: 0.7 }}>No passes assigned.</div> : null}
          {studentPasses.map((p: any) => (
            <div key={p.id} style={{ opacity: 0.85, fontSize: 13 }}>
              {p.name} • {p.valid_from} → {p.valid_to ?? "open"} {p.active ? "" : "(inactive)"}{" "}
              {p.payment_confirmed === false ? "(unpaid)" : ""}
            </div>
          ))}
        </div>
      </section>

      <section style={card()}>
        <div style={cardTitle()}>Bulk Assign</div>
        <div style={grid()}>
          <label style={label()}>
            Pass
            <select value={bulkPassId} onChange={(e) => setBulkPassId(e.target.value)} style={input()}>
              <option value="">Select pass</option>
              {passes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label style={label()}>
            Valid from
            <input type="date" value={bulkStart} onChange={(e) => setBulkStart(e.target.value)} style={input()} />
          </label>
          <label style={label()}>
            Valid to
            <input type="date" value={bulkEnd} onChange={(e) => setBulkEnd(e.target.value)} style={input()} />
          </label>
          <label style={label()}>
            Mark as paid
            <input type="checkbox" checked={bulkPaid} onChange={(e) => setBulkPaid(e.target.checked)} />
          </label>
        </div>
        <div style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Add students</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {studentResults.slice(0, 8).map((s) => (
              <button
                key={s.id}
                onClick={() =>
                  setBulkSelections((prev) => (bulkSelectedIds.has(s.id) ? prev : [...prev, s]))
                }
                style={chip()}
              >
                {s.name}
              </button>
            ))}
          </div>
          {bulkSelections.length ? (
            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {bulkSelections.map((s) => (
                <button key={s.id} onClick={() => setBulkSelections((prev) => prev.filter((p) => p.id !== s.id))} style={chipActive()}>
                  {s.name} ×
                </button>
              ))}
            </div>
          ) : (
            <div style={{ opacity: 0.7, marginTop: 6 }}>No students selected.</div>
          )}
        </div>
        <button onClick={bulkAssign} style={btnPrimary()}>
          Apply to selected students
        </button>
      </section>
    </main>
  );
}

function card(): React.CSSProperties {
  return {
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.12)",
  };
}

function cardTitle(): React.CSSProperties {
  return { fontWeight: 900, marginBottom: 10 };
}

function grid(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 };
}

function label(): React.CSSProperties {
  return { display: "grid", gap: 6, fontSize: 12, opacity: 0.9 };
}

function input(): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(8,10,15,0.7)",
    color: "white",
  };
}

function btnPrimary(): React.CSSProperties {
  return {
    padding: "9px 14px",
    borderRadius: 10,
    border: "1px solid rgba(14,116,144,0.6)",
    background: "linear-gradient(135deg, rgba(14,116,144,0.9), rgba(2,132,199,0.6))",
    color: "white",
    fontWeight: 800,
    marginTop: 12,
    width: "fit-content",
  };
}

function chip(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontSize: 12,
    fontWeight: 700,
  };
}

function chipActive(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(34,197,94,0.4)",
    background: "rgba(34,197,94,0.14)",
    color: "white",
    fontSize: 12,
    fontWeight: 800,
  };
}

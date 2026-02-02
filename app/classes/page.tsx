"use client";

import { useEffect, useMemo, useState } from "react";
import { AppState, defaultStudent } from "../../lib/appState";
import { loadState, saveState } from "../../lib/storage";
import { useRouter } from "next/navigation";

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function ClassesPage() {
  const [app, setApp] = useState<AppState | null>(null);
  const [className, setClassName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [newStudentName, setNewStudentName] = useState("");

  const router = useRouter();

  useEffect(() => setApp(loadState()), []);

  const studentList = useMemo(() => (app ? Object.values(app.students) : []), [app]);

  function apply(next: AppState) {
    setApp(next);
    saveState(next);
  }

  if (!app) return <main>Loading…</main>;

  function toggleStudent(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function createStudent() {
    const name = newStudentName.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/\s+/g, "-") + "-" + makeId();

    const next: AppState = {
      ...app,
      students: {
        ...app.students,
        [id]: defaultStudent(id, name),
      },
    };

    apply(next);
    setNewStudentName("");
  }

  function createClass() {
    const name = className.trim();
    if (!name) return;

    const id = makeId();

    const next: AppState = {
      ...app,
      classes: {
        ...app.classes,
        [id]: { id, name, studentIds: selectedIds, createdAt: Date.now() },
      },
      classTabs: app.classTabs.includes(id) ? app.classTabs : [id, ...app.classTabs],
      activeClassId: id,
    };

    apply(next);

    // also set active student to first in class for Skills/Rewards pages
    const first = selectedIds[0];
    if (first) apply({ ...next, activeStudentId: first });

    setClassName("");
    setSelectedIds([]);
    router.push("/classroom");
  }

  function openClass(id: string) {
    apply({
      ...app,
      activeClassId: id,
      classTabs: app.classTabs.includes(id) ? app.classTabs : [id, ...app.classTabs],
    });
    router.push("/classroom");
  }

  function endClass(id: string) {
    const nextTabs = app.classTabs.filter((x) => x !== id);
    const nextActive = app.activeClassId === id ? (nextTabs[0] ?? null) : app.activeClassId;

    apply({
      ...app,
      classTabs: nextTabs,
      activeClassId: nextActive,
    });
  }

  return (
    <main>
      <h1 className="h1">Classes</h1>
      <p className="sub">Create a class session, select students, then run quick points in Classroom.</p>

      {/* Tabs */}
      <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
        {app.classTabs.length === 0 ? (
          <span className="pill">No active classes</span>
        ) : (
          app.classTabs.map((id) => (
            <div key={id} className="pill" style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button className="btn" style={{ padding: "6px 10px" }} onClick={() => openClass(id)}>
                {app.classes[id]?.name ?? "Class"}
              </button>
              <button className="btn" style={{ padding: "6px 10px" }} onClick={() => endClass(id)}>
                End
              </button>
            </div>
          ))
        )}
      </div>

      <div className="card cardPad" style={{ marginTop: 16, borderRadius: 24 }}>
        <div style={{ fontWeight: 950, fontSize: 18 }}>Create a Class</div>

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <input
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            placeholder='Example: "5PM Yellow"'
            style={{
              padding: 12,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.06)",
              color: "#fff",
              fontWeight: 800,
            }}
          />

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 900 }}>Select students</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {studentList.map((s) => (
                <button
                  key={s.id}
                  className="btn"
                  onClick={() => toggleStudent(s.id)}
                  style={{
                    borderRadius: 999,
                    background: selectedIds.includes(s.id) ? "rgba(59,130,246,0.25)" : "rgba(255,255,255,0.08)",
                  }}
                >
                  {selectedIds.includes(s.id) ? "✓ " : ""}{s.name}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input
              value={newStudentName}
              onChange={(e) => setNewStudentName(e.target.value)}
              placeholder="Add new student name"
              style={{
                padding: 12,
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.06)",
                color: "#fff",
                fontWeight: 800,
                flex: 1,
                minWidth: 220,
              }}
            />
            <button className="btn" onClick={createStudent}>Add Student</button>
          </div>

          <button className="btn btnPrimary" onClick={createClass}>
            Create Class
          </button>

          <div className="sub">
            Example class names you mentioned: <strong>5PM Yellow</strong> and <strong>5PM Competition Team</strong>
          </div>
        </div>
      </div>
    </main>
  );
}

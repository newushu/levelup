"use client";

import { useEffect, useMemo, useState } from "react";
import AuthGate from "@/components/AuthGate";

type ParentRequest = {
  id: string;
  auth_user_id?: string | null;
  parent_name: string;
  email: string;
  student_names: string[];
  request_note?: string | null;
  status: string;
  created_at: string;
  approved_at?: string | null;
};

type StudentRow = {
  id: string;
  name: string;
  level?: number;
  points_balance?: number;
  points_total?: number;
  is_competition_team?: boolean;
  dob?: string | null;
};

type ParentLink = {
  parent_id: string;
  student_id: string;
  relationship_type: string;
  parent: { id: string; auth_user_id?: string | null; name: string; email: string; phone?: string | null; dob?: string | null } | null;
  student: {
    id: string;
    name: string;
    level?: number;
    points_balance?: number;
    points_total?: number;
    lifetime_points?: number;
    email?: string | null;
    phone?: string | null;
    dob?: string | null;
    avatar_storage_path?: string | null;
    avatar_zoom_pct?: number;
  } | null;
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

export default function ParentPairingPage() {
  return (
    <AuthGate>
      <ParentPairingInner />
    </AuthGate>
  );
}

function ParentPairingInner() {
  const [role, setRole] = useState("student");
  const [tab, setTab] = useState<"requests" | "paired" | "relationships" | "activity">("requests");
  const [requests, setRequests] = useState<ParentRequest[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [links, setLinks] = useState<ParentLink[]>([]);
  const [relationships, setRelationships] = useState<RelationshipRow[]>([]);
  const [events, setEvents] = useState<Array<any>>([]);
  const [msg, setMsg] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [parentEdits, setParentEdits] = useState<Record<string, { name: string; email: string; phone: string; dob: string }>>({});
  const [studentEdits, setStudentEdits] = useState<Record<string, { name: string; email: string; phone: string; dob: string }>>({});
  const [selectedByRequest, setSelectedByRequest] = useState<Record<string, string[]>>({});
  const [relationshipByRequest, setRelationshipByRequest] = useState<Record<string, Record<string, string>>>({});
  const [busyByRequest, setBusyByRequest] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [linkSaving, setLinkSaving] = useState<Record<string, boolean>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, string>>({});
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [relationshipType, setRelationshipType] = useState("sibling");

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
      const reqRes = await fetch("/api/admin/parent-requests/list", { cache: "no-store" });
      const reqJson = await safeJson(reqRes);
      if (reqJson.ok) setRequests((reqJson.json?.requests ?? []) as ParentRequest[]);

      const stuRes = await fetch("/api/students/list", { cache: "no-store" });
      const stuJson = await safeJson(stuRes);
      if (stuJson.ok) setStudents((stuJson.json?.students ?? []) as StudentRow[]);

      await refreshPaired();
      await refreshRelationships();
      await refreshActivity();
    })();
  }, [role]);

  async function refreshPaired() {
    const res = await fetch("/api/admin/parent-pairing/paired", { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to load paired accounts");
    setLinks((sj.json?.links ?? []) as ParentLink[]);
  }

  async function refreshRelationships() {
    const res = await fetch("/api/admin/parent-relationships/list", { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to load relationships");
    setRelationships((sj.json?.relationships ?? []) as RelationshipRow[]);
  }

  async function refreshActivity() {
    const res = await fetch("/api/admin/parent-pairing/activity", { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to load activity");
    setEvents((sj.json?.events ?? []) as Array<any>);
  }

  const studentOptions = useMemo(
    () => students.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [students]
  );

  const parentsById = useMemo(() => {
    const map = new Map<string, ParentLink["parent"]>();
    links.forEach((link) => {
      if (link.parent?.id) map.set(link.parent.id, link.parent);
    });
    return map;
  }, [links]);

  const parentIdByAuth = useMemo(() => {
    const map = new Map<string, string>();
    links.forEach((link) => {
      const auth = link.parent?.auth_user_id;
      if (auth && link.parent?.id) map.set(String(auth), link.parent.id);
    });
    return map;
  }, [links]);

  const studentsById = useMemo(() => {
    const map = new Map<string, ParentLink["student"]>();
    links.forEach((link) => {
      if (link.student?.id) map.set(link.student.id, link.student);
    });
    return map;
  }, [links]);

  const studentsByIdFull = useMemo(() => {
    const map = new Map<string, StudentRow>();
    students.forEach((student) => map.set(student.id, student));
    return map;
  }, [students]);

  useEffect(() => {
    if (!links.length) return;
    setParentEdits((prev) => {
      const next = { ...prev };
      links.forEach((link) => {
        const parent = link.parent;
        if (!parent?.id || next[parent.id]) return;
        next[parent.id] = {
          name: parent.name ?? "",
          email: parent.email ?? "",
          phone: parent.phone ?? "",
          dob: parent.dob ?? "",
        };
      });
      return next;
    });
    setStudentEdits((prev) => {
      const next = { ...prev };
      links.forEach((link) => {
        const student = link.student;
        if (!student?.id || next[student.id]) return;
        next[student.id] = {
          name: student.name ?? "",
          email: student.email ?? "",
          phone: student.phone ?? "",
          dob: student.dob ?? "",
        };
      });
      return next;
    });
  }, [links]);

  useEffect(() => {
    if (!students.length) return;
    setStudentEdits((prev) => {
      const next = { ...prev };
      students.forEach((student) => {
        if (next[student.id]) return;
        next[student.id] = {
          name: student.name ?? "",
          email: "",
          phone: "",
          dob: student.dob ?? "",
        };
      });
      return next;
    });
  }, [students]);

  const households = useMemo(() => {
    const nodes = new Set<string>();
    const parentById = new Map<string, ParentLink["parent"]>();
    const studentById = new Map<string, ParentLink["student"] | StudentRow>();

    const keyParent = (id: string) => `parent:${id}`;
    const keyStudent = (id: string) => `student:${id}`;

    links.forEach((link) => {
      if (link.parent?.id) {
        parentById.set(link.parent.id, link.parent);
        nodes.add(keyParent(link.parent.id));
      }
      if (link.student?.id) {
        studentById.set(link.student.id, link.student);
        nodes.add(keyStudent(link.student.id));
      }
    });

    relationships.forEach((rel) => {
      if (rel.student_id_a) nodes.add(keyStudent(rel.student_id_a));
      if (rel.student_id_b) nodes.add(keyStudent(rel.student_id_b));
      if (rel.student_id_a && !studentById.has(rel.student_id_a)) {
        const s = studentsByIdFull.get(rel.student_id_a);
        if (s) studentById.set(rel.student_id_a, s);
      }
      if (rel.student_id_b && !studentById.has(rel.student_id_b)) {
        const s = studentsByIdFull.get(rel.student_id_b);
        if (s) studentById.set(rel.student_id_b, s);
      }
    });

    const parentMap = new Map<string, string>();
    const find = (node: string) => {
      const root = parentMap.get(node) ?? node;
      if (root === node) return root;
      const next = find(root);
      parentMap.set(node, next);
      return next;
    };
    const union = (a: string, b: string) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parentMap.set(ra, rb);
    };

    nodes.forEach((node) => parentMap.set(node, node));

    links.forEach((link) => {
      if (!link.parent_id || !link.student_id) return;
      union(keyParent(link.parent_id), keyStudent(link.student_id));
    });

    relationships.forEach((rel) => {
      if (!rel.student_id_a || !rel.student_id_b) return;
      union(keyStudent(rel.student_id_a), keyStudent(rel.student_id_b));
    });

    const grouped = new Map<
      string,
      {
        parents: ParentLink["parent"][];
        students: Array<ParentLink["student"] | StudentRow>;
        links: ParentLink[];
        relationships: RelationshipRow[];
      }
    >();

    const ensureGroup = (node: string) => {
      const root = find(node);
      if (!grouped.has(root)) {
        grouped.set(root, { parents: [], students: [], links: [], relationships: [] });
      }
      return grouped.get(root)!;
    };

    links.forEach((link) => {
      const sid = link.student_id;
      if (!sid) return;
      const group = ensureGroup(keyStudent(sid));
      group.links.push(link);
      if (link.parent?.id && !group.parents.find((p) => p?.id === link.parent?.id)) {
        group.parents.push(link.parent);
      }
      if (link.student?.id && !group.students.find((s) => s?.id === link.student?.id)) {
        group.students.push(link.student);
      }
    });

    studentById.forEach((student, id) => {
      const group = ensureGroup(keyStudent(id));
      if (!group.students.find((s) => s?.id === id)) {
        group.students.push(student);
      }
    });

    parentById.forEach((parent, id) => {
      const group = ensureGroup(keyParent(id));
      if (!group.parents.find((p) => p?.id === id)) {
        group.parents.push(parent);
      }
    });

    relationships.forEach((rel) => {
      const group = ensureGroup(keyStudent(rel.student_id_a));
      group.relationships.push(rel);
    });

    return Array.from(grouped.values()).sort((a, b) => {
      const aName = (a.students[0]?.name ?? "").toLowerCase();
      const bName = (b.students[0]?.name ?? "").toLowerCase();
      return aName.localeCompare(bName);
    });
  }, [links, relationships, studentsByIdFull]);

  const filteredHouseholds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return households.filter((household) => {
      const parentMatch = household.parents.some((p) =>
        `${p?.name ?? ""} ${p?.email ?? ""}`.toLowerCase().includes(q)
      );
      const studentMatch = household.students.some((s) =>
        `${s?.name ?? ""} ${(s as any)?.email ?? ""}`.toLowerCase().includes(q)
      );
      return parentMatch || studentMatch;
    });
  }, [households, searchQuery]);

  function toggleStudent(requestId: string, studentId: string) {
    setSelectedByRequest((prev) => {
      const list = prev[requestId] ?? [];
      const next = list.includes(studentId) ? list.filter((id) => id !== studentId) : [...list, studentId];
      return { ...prev, [requestId]: next };
    });
  }

  function setRelationshipForRequest(requestId: string, studentId: string, value: string) {
    setRelationshipByRequest((prev) => ({
      ...prev,
      [requestId]: { ...(prev[requestId] ?? {}), [studentId]: value },
    }));
  }

  async function approve(requestId: string) {
    const selected = selectedByRequest[requestId] ?? [];
    if (!selected.length) return setMsg("Pick at least one student to pair.");
    setBusyByRequest((prev) => ({ ...prev, [requestId]: true }));
    const relationship_types = relationshipByRequest[requestId] ?? {};
    const res = await fetch("/api/admin/parent-requests/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request_id: requestId, student_ids: selected, relationship_types }),
    });
    const sj = await safeJson(res);
    setBusyByRequest((prev) => ({ ...prev, [requestId]: false }));
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to approve.");
    setRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, status: "paired" } : r)));
    await refreshPaired();
    setSaveStatus((prev) => ({ ...prev, [`request:${requestId}`]: "Paired!" }));
    window.setTimeout(() => {
      setSaveStatus((prev) => {
        const next = { ...prev };
        delete next[`request:${requestId}`];
        return next;
      });
    }, 1600);
    setMsg("Pairing saved.");
  }

  async function saveParent(parentId: string, payload: { name: string; email: string; phone?: string; dob?: string }) {
    setSaving((prev) => ({ ...prev, [parentId]: true }));
    const res = await fetch("/api/admin/parents/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parent_id: parentId, ...payload }),
    });
    const sj = await safeJson(res);
    setSaving((prev) => ({ ...prev, [parentId]: false }));
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to update parent");
    await refreshPaired();
    setSaveStatus((prev) => ({ ...prev, [`parent:${parentId}`]: "Saved!" }));
    window.setTimeout(() => {
      setSaveStatus((prev) => {
        const next = { ...prev };
        delete next[`parent:${parentId}`];
        return next;
      });
    }, 1600);
    setMsg("Parent updated.");
  }

  async function saveStudent(studentId: string, payload: { name: string; email?: string; phone?: string; dob?: string }) {
    setSaving((prev) => ({ ...prev, [studentId]: true }));
    const res = await fetch("/api/admin/students/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId, ...payload }),
    });
    const sj = await safeJson(res);
    setSaving((prev) => ({ ...prev, [studentId]: false }));
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to update student");
    await refreshPaired();
    setSaveStatus((prev) => ({ ...prev, [`student:${studentId}`]: "Saved!" }));
    window.setTimeout(() => {
      setSaveStatus((prev) => {
        const next = { ...prev };
        delete next[`student:${studentId}`];
        return next;
      });
    }, 1600);
    setMsg("Student updated.");
  }

  async function updateParentLink(parentId: string, studentId: string, relationship_type: string) {
    const key = `${parentId}:${studentId}`;
    setLinkSaving((prev) => ({ ...prev, [key]: true }));
    const res = await fetch("/api/admin/parent-pairing/update-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parent_id: parentId, student_id: studentId, relationship_type }),
    });
    const sj = await safeJson(res);
    setLinkSaving((prev) => ({ ...prev, [key]: false }));
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to update relationship");
    await refreshPaired();
    setSaveStatus((prev) => ({ ...prev, [`link:${key}`]: "Updated!" }));
    window.setTimeout(() => {
      setSaveStatus((prev) => {
        const next = { ...prev };
        delete next[`link:${key}`];
        return next;
      });
    }, 1600);
    setMsg("Relationship updated.");
  }

  async function unpair(parentId: string, studentId?: string) {
    const key = studentId ? `${parentId}:${studentId}` : parentId;
    setSaving((prev) => ({ ...prev, [key]: true }));
    const res = await fetch("/api/admin/parent-pairing/unpair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parent_id: parentId, student_id: studentId }),
    });
    const sj = await safeJson(res);
    setSaving((prev) => ({ ...prev, [key]: false }));
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to unpair");
    await refreshPaired();
    setMsg("Unpaired.");
  }

  async function updateRelationship() {
    setMsg("");
    if (selectedPeople.length !== 2) return setMsg("Select two people.");
    const [student_id_a, student_id_b] = selectedPeople;
    const res = await fetch("/api/admin/parent-relationships/upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id_a,
        student_id_b,
        relationship_type: relationshipType,
      }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to create relationship");
    setSelectedPeople([]);
    setMsg("Relationship saved.");
    setSaveStatus((prev) => ({ ...prev, relationship: "Updated!" }));
    window.setTimeout(() => {
      setSaveStatus((prev) => {
        const next = { ...prev };
        delete next.relationship;
        return next;
      });
    }, 1600);
    await refreshRelationships();
  }

  function applySearch() {
    setSearchQuery(searchInput.trim());
  }

  function swapSelectedPeople() {
    if (selectedPeople.length !== 2) return;
    setSelectedPeople(([a, b]) => [b, a]);
  }

  if (role !== "admin") {
    return (
      <main style={{ padding: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Admin access only.</div>
      </main>
    );
  }

  return (
    <main style={{ padding: 18, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ fontSize: 28, fontWeight: 1000 }}>Parent Management</div>
      <div style={{ opacity: 0.7, marginTop: 6 }}>Pair accounts, manage relationships, and update details.</div>
      {msg ? <div style={{ marginTop: 10, opacity: 0.8 }}>{msg}</div> : null}

      <div style={tabRow()}>
        <button onClick={() => setTab("requests")} style={tabBtn(tab === "requests")}>Requests</button>
        <button onClick={() => setTab("paired")} style={tabBtn(tab === "paired")}>Household Map</button>
        <button onClick={() => setTab("relationships")} style={tabBtn(tab === "relationships")}>Relationships</button>
        <button onClick={() => setTab("activity")} style={tabBtn(tab === "activity")}>Activity Log</button>
      </div>

      {tab === "requests" ? (
        <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
          {requests.map((r) => {
            const selected = selectedByRequest[r.id] ?? [];
            const relMap = relationshipByRequest[r.id] ?? {};
            const parentIdForRequest = r.auth_user_id ? parentIdByAuth.get(String(r.auth_user_id)) : undefined;
            return (
              <div key={r.id} style={card()}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 900 }}>{r.parent_name}</div>
                    <div style={{ opacity: 0.7, fontSize: 12 }}>{r.email}</div>
                    <div style={{ opacity: 0.7, fontSize: 12 }}>
                      Requested students: {r.student_names?.length ? r.student_names.join(", ") : "—"}
                    </div>
                    {r.request_note ? (
                      <div style={{ opacity: 0.7, fontSize: 12 }}>Note: {r.request_note}</div>
                    ) : null}
                    <div style={{ opacity: 0.7, fontSize: 12 }}>
                      Requested on: {new Date(r.created_at).toLocaleString()}
                    </div>
                    {r.approved_at ? (
                      <div style={{ opacity: 0.7, fontSize: 12 }}>
                        Paired on: {new Date(r.approved_at).toLocaleString()}
                      </div>
                    ) : null}
                  </div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>{r.status}</div>
                </div>
                <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            <div style={{ fontWeight: 900, fontSize: 12 }}>Link students</div>
                  <div style={{ display: "grid", gap: 6, maxHeight: 200, overflowY: "auto" }}>
                    {studentOptions.map((s) => {
                      const checked = selected.includes(s.id);
                      return (
                        <div key={s.id} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center" }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleStudent(r.id, s.id)} />
                          <span style={{ fontWeight: 800 }}>
                            {s.name} (Lv {s.level ?? 0}){s.is_competition_team ? " ⭐" : ""}
                          </span>
                          <select
                            value={relMap[s.id] ?? "parent"}
                            onChange={(e) => setRelationshipForRequest(r.id, s.id, e.target.value)}
                            style={select()}
                          >
                            <option value="parent">Parent</option>
                            <option value="guardian">Guardian</option>
                            <option value="spouse">Spouse</option>
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  {r.status !== "paired" ? (
                    <button onClick={() => approve(r.id)} style={btn()} disabled={busyByRequest[r.id]}>
                      {busyByRequest[r.id] ? "Saving..." : saveStatus[`request:${r.id}`] ?? "Approve + Pair"}
                    </button>
                  ) : (
                    <button
                      onClick={() => parentIdForRequest && unpair(parentIdForRequest)}
                      style={btnDanger()}
                      disabled={!parentIdForRequest || saving[parentIdForRequest]}
                    >
                      {saving[parentIdForRequest] ? "Unpairing..." : "Unpair All"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {!requests.length && <div style={{ opacity: 0.7 }}>No parent requests yet.</div>}
        </div>
      ) : null}

      {tab === "paired" ? (
        <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
          <div style={searchRow()}>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applySearch();
              }}
              placeholder="Search by parent, email, or student"
              style={searchInputStyle()}
            />
            <button onClick={applySearch} style={btnSmall()} disabled={!searchInput.trim()}>
              Search
            </button>
          </div>
          {!searchQuery ? (
            <div style={{ opacity: 0.7 }}>Search to load a household map.</div>
          ) : null}
          {searchQuery
            ? filteredHouseholds.map((household, idx) => {
                const parents = household.parents;
                const studentsList = household.students;
                return (
                  <div key={`household-${idx}`} style={card()}>
                    <div style={{ fontWeight: 1000, marginBottom: 8 }}>Household Map</div>
                    <div style={treeWrap()}>
                      <div style={treeRow()}>
                        {parents.map((parent) => {
                          if (!parent) return null;
                          const parentId = parent.id;
                          const linksForParent = household.links.filter((row) => row.parent_id === parentId);
                          return (
                            <div key={parentId} style={personCard()}>
                              <div style={{ fontWeight: 900 }}>Parent/Guardian</div>
                              <div style={{ fontSize: 12, opacity: 0.7 }}>
                                Parent of: {linksForParent.map((row) => row.student?.name ?? "Student").join(", ")}
                              </div>
                              <div style={{ display: "grid", gap: 6 }}>
                                {linksForParent.map((row) => (
                                  <div key={`${row.parent_id}:${row.student_id}`} style={linkRow()}>
                                    <span style={{ fontWeight: 900 }}>{row.student?.name ?? "Student"}</span>
                                    <select
                                      value={row.relationship_type ?? "parent"}
                                      onChange={(e) => updateParentLink(parentId, row.student_id, e.target.value)}
                                      style={select()}
                                      disabled={linkSaving[`${parentId}:${row.student_id}`]}
                                    >
                                      <option value="parent">Parent</option>
                                      <option value="guardian">Guardian</option>
                                      <option value="spouse">Spouse</option>
                                    </select>
                                    <button
                                      onClick={() => unpair(parentId, row.student_id)}
                                      style={btnDanger()}
                                      disabled={saving[`${parentId}:${row.student_id}`]}
                                    >
                                      {saving[`${parentId}:${row.student_id}`] ? "Unpairing..." : "Unpair"}
                                    </button>
                                    {saveStatus[`link:${parentId}:${row.student_id}`] ? (
                                      <span style={savedPill()}>{saveStatus[`link:${parentId}:${row.student_id}`]}</span>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                              <input
                                value={parentEdits[parentId]?.name ?? ""}
                                onChange={(e) =>
                                  setParentEdits((prev) => ({
                                    ...prev,
                                    [parentId]: { ...(prev[parentId] ?? { name: "", email: "", phone: "", dob: "" }), name: e.target.value },
                                  }))
                                }
                                placeholder="Name"
                                style={input()}
                              />
                              <input
                                value={parentEdits[parentId]?.email ?? ""}
                                onChange={(e) =>
                                  setParentEdits((prev) => ({
                                    ...prev,
                                    [parentId]: { ...(prev[parentId] ?? { name: "", email: "", phone: "", dob: "" }), email: e.target.value },
                                  }))
                                }
                                placeholder="Email"
                                style={input()}
                              />
                              <input
                                value={parentEdits[parentId]?.phone ?? ""}
                                onChange={(e) =>
                                  setParentEdits((prev) => ({
                                    ...prev,
                                    [parentId]: { ...(prev[parentId] ?? { name: "", email: "", phone: "", dob: "" }), phone: e.target.value },
                                  }))
                                }
                                placeholder="Phone"
                                style={input()}
                              />
                              <input
                                value={parentEdits[parentId]?.dob ?? ""}
                                onChange={(e) =>
                                  setParentEdits((prev) => ({
                                    ...prev,
                                    [parentId]: { ...(prev[parentId] ?? { name: "", email: "", phone: "", dob: "" }), dob: e.target.value },
                                  }))
                                }
                                placeholder="DOB"
                                type="date"
                                style={input()}
                              />
                              <button
                                onClick={() =>
                                  saveParent(parentId, {
                                    name: parentEdits[parentId]?.name ?? "",
                                    email: parentEdits[parentId]?.email ?? "",
                                    phone: parentEdits[parentId]?.phone ?? "",
                                    dob: parentEdits[parentId]?.dob ?? "",
                                  })
                                }
                                style={btnSmall()}
                                disabled={saving[parentId]}
                              >
                                {saving[parentId] ? "Saving..." : saveStatus[`parent:${parentId}`] ?? "Save Parent"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      <div style={treeLine()} />
                      <div style={connectorRow()}>
                        {parents.map((parent, idx2) => (
                          <div key={parent?.id ?? `parent-${idx2}`} style={connectorTick()} />
                        ))}
                      </div>
                      <div style={connectorStem()} />
                      <div style={studentsRow()}>
                        {studentsList.map((student) => {
                          if (!student?.id) return null;
                          const studentId = student.id;
                          const edits = studentEdits[studentId] ?? { name: student.name ?? "", email: "", phone: "", dob: "" };
                          const parentsForStudent = household.links.filter((row) => row.student_id === studentId);
                          return (
                            <div key={studentId} style={studentCard()}>
                              <div style={{ fontWeight: 900 }}>Student</div>
                              <div style={{ fontSize: 12, opacity: 0.7 }}>ID: {studentId}</div>
                              <input
                                value={edits.name ?? ""}
                                onChange={(e) =>
                                  setStudentEdits((prev) => ({
                                    ...prev,
                                    [studentId]: { ...(prev[studentId] ?? { name: "", email: "", phone: "", dob: "" }), name: e.target.value },
                                  }))
                                }
                                placeholder="Name"
                                style={input()}
                              />
                              <input
                                value={edits.email ?? ""}
                                onChange={(e) =>
                                  setStudentEdits((prev) => ({
                                    ...prev,
                                    [studentId]: { ...(prev[studentId] ?? { name: "", email: "", phone: "", dob: "" }), email: e.target.value },
                                  }))
                                }
                                placeholder="Email"
                                style={input()}
                              />
                              <input
                                value={edits.phone ?? ""}
                                onChange={(e) =>
                                  setStudentEdits((prev) => ({
                                    ...prev,
                                    [studentId]: { ...(prev[studentId] ?? { name: "", email: "", phone: "", dob: "" }), phone: e.target.value },
                                  }))
                                }
                                placeholder="Phone"
                                style={input()}
                              />
                              <input
                                value={edits.dob ?? ""}
                                onChange={(e) =>
                                  setStudentEdits((prev) => ({
                                    ...prev,
                                    [studentId]: { ...(prev[studentId] ?? { name: "", email: "", phone: "", dob: "" }), dob: e.target.value },
                                  }))
                                }
                                placeholder="DOB"
                                type="date"
                                style={input()}
                              />
                              <div style={{ fontSize: 12, opacity: 0.7 }}>
                                Lv {(student as any).level ?? 0} • Balance {(student as any).points_balance ?? 0}
                              </div>
                              <div style={{ display: "grid", gap: 6 }}>
                                {parentsForStudent.map((row) => (
                                  <div key={`${row.parent_id}:${row.student_id}`} style={linkRow()}>
                                    <span style={{ fontWeight: 900 }}>{row.parent?.name ?? "Parent"}</span>
                                    <span style={relationshipPill(row.relationship_type ?? "parent")}>
                                      {row.relationship_type ?? "parent"}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <button
                                onClick={() =>
                                  saveStudent(studentId, {
                                    name: studentEdits[studentId]?.name ?? "",
                                    email: studentEdits[studentId]?.email ?? "",
                                    phone: studentEdits[studentId]?.phone ?? "",
                                    dob: studentEdits[studentId]?.dob ?? "",
                                  })
                                }
                                style={btnSmall()}
                                disabled={saving[studentId]}
                              >
                                {saving[studentId] ? "Saving..." : saveStatus[`student:${studentId}`] ?? "Save Student"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {household.relationships.length ? (
                      <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                        <div style={{ fontWeight: 900, fontSize: 12 }}>Student Relationships</div>
                    {household.relationships.map((rel) => (
                      <div key={rel.id} style={relationshipRow(rel.relationship_type)}>
                        <span style={{ fontWeight: 900 }}>
                          {relationshipDisplay(rel, studentsById, studentsByIdFull)}
                        </span>
                        <span style={relationshipPill(rel.relationship_type)}>
                          {rel.relationship_type.replace("_", " ")}
                        </span>
                      </div>
                    ))}
                      </div>
                    ) : null}
                  </div>
                );
              })
            : null}
          {searchQuery && !filteredHouseholds.length ? (
            <div style={{ opacity: 0.7 }}>No household map found.</div>
          ) : null}
        </div>
      ) : null}

      {tab === "relationships" ? (
        <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
          <div style={card()}>
            <div style={{ fontWeight: 900 }}>Update Relationships</div>
            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              <div style={peopleGrid()}>
                {studentOptions.map((s) => {
                  const active = selectedPeople.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSelectedPeople((prev) => {
                          if (prev.includes(s.id)) return prev.filter((id) => id !== s.id);
                          if (prev.length >= 2) return prev;
                          return [...prev, s.id];
                        });
                      }}
                      style={personChip(active)}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Student A: {studentsByIdFull.get(selectedPeople[0] ?? "")?.name ?? "—"} • Student B:{" "}
                {studentsByIdFull.get(selectedPeople[1] ?? "")?.name ?? "—"}
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <select
                  value={relationshipType}
                  onChange={(e) => setRelationshipType(e.target.value)}
                  style={select()}
                  disabled={selectedPeople.length !== 2}
                >
                  <option value="sibling">Sibling</option>
                  <option value="close_friend">Close Friend</option>
                  <option value="spouse">Spouse</option>
                  <option value="parent_child">Parent / Child</option>
                </select>
                <button onClick={swapSelectedPeople} style={btnSmall()} disabled={selectedPeople.length !== 2}>
                  Swap A/B
                </button>
                <button onClick={updateRelationship} style={btn()} disabled={selectedPeople.length !== 2}>
                  {saveStatus.relationship ?? "Update Relationship"}
                </button>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {relationshipDescription(selectedPeople, relationshipType, studentsByIdFull)}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {relationships.map((rel) => (
              <div key={rel.id} style={relationshipRow(rel.relationship_type)}>
                <span style={{ fontWeight: 900 }}>{relationshipDisplay(rel, studentsById, studentsByIdFull)}</span>
                <span style={relationshipPill(rel.relationship_type)}>{rel.relationship_type.replace("_", " ")}</span>
              </div>
            ))}
            {!relationships.length && <div style={{ opacity: 0.7 }}>No relationships yet.</div>}
          </div>
        </div>
      ) : null}

      {tab === "activity" ? (
        <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
          {events.map((evt) => (
            <div key={evt.id} style={activityRow()}>
              <div style={{ fontWeight: 900 }}>{evt.event_type.replaceAll("_", " ")}</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                Parent: {evt.parent?.name ?? "—"} • Student A: {evt.student?.name ?? "—"} • Student B:{" "}
                {evt.student_b?.name ?? "—"}
              </div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Relationship: {evt.relationship_type ?? "—"} • Actor: {evt.actor?.username ?? evt.actor?.email ?? "—"}
              </div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>{new Date(evt.created_at).toLocaleString()}</div>
            </div>
          ))}
          {!events.length && <div style={{ opacity: 0.7 }}>No activity yet.</div>}
        </div>
      ) : null}
    </main>
  );
}

function tabRow(): React.CSSProperties {
  return {
    display: "flex",
    gap: 8,
    marginTop: 16,
    flexWrap: "wrap",
  };
}

function tabBtn(active: boolean): React.CSSProperties {
  return {
    padding: "8px 14px",
    borderRadius: 999,
    border: active ? "1px solid rgba(59,130,246,0.7)" : "1px solid rgba(255,255,255,0.16)",
    background: active ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function searchRow(): React.CSSProperties {
  return {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  };
}

function card(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(8,10,15,0.7)",
  };
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

function btnDanger(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(248,113,113,0.6)",
    background: "rgba(248,113,113,0.18)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function btnSmall(): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid rgba(59,130,246,0.4)",
    background: "rgba(59,130,246,0.2)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  };
}

function select(): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.4)",
    color: "white",
    fontSize: 12,
  };
}

function input(): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.35)",
    color: "white",
    fontSize: 12,
  };
}

function searchInputStyle(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(15,23,42,0.45)",
    color: "white",
    fontSize: 13,
  };
}

function treeWrap(): React.CSSProperties {
  return {
    display: "grid",
    gap: 10,
    padding: 10,
    borderRadius: 16,
    background:
      "linear-gradient(135deg, rgba(30,41,59,0.6), rgba(15,23,42,0.8)), radial-gradient(circle at 10% 10%, rgba(59,130,246,0.25), transparent 55%)",
    border: "1px solid rgba(255,255,255,0.1)",
  };
}

function treeRow(): React.CSSProperties {
  return {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "flex-start",
  };
}

function treeLine(): React.CSSProperties {
  return {
    height: 24,
    borderLeft: "2px solid rgba(59,130,246,0.6)",
    marginLeft: 30,
    boxShadow: "0 0 12px rgba(59,130,246,0.4)",
  };
}

function connectorRow(): React.CSSProperties {
  return {
    display: "flex",
    gap: 12,
    alignItems: "center",
    paddingLeft: 26,
    borderTop: "2px solid rgba(59,130,246,0.5)",
  };
}

function connectorTick(): React.CSSProperties {
  return {
    width: 2,
    height: 18,
    background: "rgba(59,130,246,0.55)",
    boxShadow: "0 0 10px rgba(59,130,246,0.35)",
  };
}

function connectorStem(): React.CSSProperties {
  return {
    height: 18,
    width: 2,
    margin: "0 auto",
    background: "rgba(59,130,246,0.55)",
    boxShadow: "0 0 10px rgba(59,130,246,0.35)",
  };
}

function studentRow(): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "center",
    paddingLeft: 20,
  };
}

function studentsRow(): React.CSSProperties {
  return {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    justifyContent: "center",
    paddingLeft: 20,
  };
}

function studentCard(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.18)",
    background:
      "linear-gradient(145deg, rgba(15,23,42,0.92), rgba(2,6,23,0.88)), radial-gradient(circle at top right, rgba(124,58,237,0.2), transparent 60%)",
    display: "grid",
    gap: 8,
    minWidth: 240,
  };
}

function relationshipDescription(
  selectedPeople: string[],
  relationshipType: string,
  studentsByIdFull: Map<string, StudentRow>
): string {
  if (selectedPeople.length !== 2) return "Select two students (A then B) to describe the relationship.";
  const [aId, bId] = selectedPeople;
  const aName = studentsByIdFull.get(aId)?.name ?? "Student A";
  const bName = studentsByIdFull.get(bId)?.name ?? "Student B";
  const type = relationshipType.toLowerCase();
  if (type === "parent_child") return `${aName} is child of ${bName}.`;
  if (type === "spouse") return `${aName} is spouse of ${bName}.`;
  if (type === "close_friend") return `${aName} is close friend of ${bName}.`;
  return `${aName} is sibling of ${bName}.`;
}

function relationshipDisplay(
  rel: RelationshipRow,
  studentsById: Map<string, ParentLink["student"]>,
  studentsByIdFull: Map<string, StudentRow>
): string {
  const aName = studentsById.get(rel.student_id_a)?.name ?? studentsByIdFull.get(rel.student_id_a)?.name ?? rel.student_id_a;
  const bName = studentsById.get(rel.student_id_b)?.name ?? studentsByIdFull.get(rel.student_id_b)?.name ?? rel.student_id_b;
  const type = rel.relationship_type.toLowerCase();
  if (type === "parent_child") return `${aName} is child of ${bName}`;
  if (type === "spouse") return `${aName} is spouse of ${bName}`;
  if (type === "close_friend") return `${aName} is close friend of ${bName}`;
  return `${aName} is sibling of ${bName}`;
}

function relationshipPill(type: string): React.CSSProperties {
  const key = String(type || "parent").toLowerCase();
  const palette: Record<string, { border: string; background: string }> = {
    parent: {
      border: "1px solid rgba(34,197,94,0.6)",
      background: "rgba(34,197,94,0.2)",
    },
    guardian: {
      border: "1px solid rgba(16,185,129,0.6)",
      background: "rgba(16,185,129,0.18)",
    },
    spouse: {
      border: "1px solid rgba(249,115,22,0.6)",
      background: "rgba(249,115,22,0.2)",
    },
    sibling: {
      border: "1px solid rgba(59,130,246,0.6)",
      background: "rgba(59,130,246,0.2)",
    },
    close_friend: {
      border: "1px solid rgba(236,72,153,0.6)",
      background: "rgba(236,72,153,0.2)",
    },
    parent_child: {
      border: "1px solid rgba(249,115,22,0.6)",
      background: "rgba(249,115,22,0.2)",
    },
  };
  const style = palette[key] ?? palette.parent;
  return {
    width: "fit-content",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
    textTransform: "capitalize",
    border: style.border,
    background: style.background,
  };
}

function activityRow(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(8,10,15,0.7)",
    display: "grid",
    gap: 6,
  };
}

function personCard(): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background:
      "linear-gradient(145deg, rgba(15,23,42,0.9), rgba(2,6,23,0.85)), radial-gradient(circle at top right, rgba(34,197,94,0.18), transparent 60%)",
    display: "grid",
    gap: 6,
    minWidth: 220,
  };
}

function linkRow(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "1fr auto auto auto",
    gap: 8,
    alignItems: "center",
    fontSize: 12,
  };
}

function savedPill(): React.CSSProperties {
  return {
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 900,
    border: "1px solid rgba(34,197,94,0.5)",
    background: "rgba(34,197,94,0.18)",
    color: "white",
  };
}

function relationshipRow(_type: string): React.CSSProperties {
  return {
    display: "flex",
    gap: 10,
    alignItems: "center",
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(8,10,15,0.65)",
    fontSize: 12,
  };
}

function peopleGrid(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 8,
  };
}

function personChip(active: boolean): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: active ? "1px solid rgba(34,197,94,0.6)" : "1px solid rgba(255,255,255,0.12)",
    background: active ? "rgba(34,197,94,0.15)" : "rgba(15,23,42,0.6)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    textAlign: "left",
  };
}

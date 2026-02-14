"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ParentRow = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
};

type StaffRow = {
  user_id: string;
  email: string | null;
  username: string | null;
  role: string | null;
};

type UserRow = {
  user_id: string;
  email: string | null;
  username: string | null;
  role: string | null;
  roles?: string[];
  created_at?: string | null;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status})` } };
  }
}

export default function AccountDirectoryPage() {
  const [role, setRole] = useState("student");
  const [parents, setParents] = useState<ParentRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState<Record<string, boolean>>({});

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
      const pRes = await fetch("/api/admin/parents/list", { cache: "no-store" });
      const pJson = await safeJson(pRes);
      if (!pJson.ok) return setMsg(pJson.json?.error || "Failed to load parents");
      setParents((pJson.json?.parents ?? []) as ParentRow[]);

      const sRes = await fetch("/api/admin/staff/list", { cache: "no-store" });
      const sJson = await safeJson(sRes);
      if (!sJson.ok) return setMsg(sJson.json?.error || "Failed to load staff");
      setStaff((sJson.json?.staff ?? []) as StaffRow[]);

      const uRes = await fetch("/api/admin/users/list", { cache: "no-store" });
      const uJson = await safeJson(uRes);
      if (!uJson.ok) return setMsg(uJson.json?.error || "Failed to load users");
      setUsers((uJson.json?.users ?? []) as UserRow[]);
    })();
  }, [role]);

  async function saveParent(row: ParentRow) {
    setMsg("");
    setSaving((prev) => ({ ...prev, [row.id]: true }));
    const res = await fetch("/api/admin/parents/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parent_id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone ?? "",
      }),
    });
    const sj = await safeJson(res);
    setSaving((prev) => ({ ...prev, [row.id]: false }));
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to save parent");
    setMsg("Parent updated.");
  }

  async function saveStaff(row: StaffRow) {
    setMsg("");
    setSaving((prev) => ({ ...prev, [row.user_id]: true }));
    const res = await fetch("/api/admin/staff/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: row.user_id,
        username: row.username ?? "",
      }),
    });
    const sj = await safeJson(res);
    setSaving((prev) => ({ ...prev, [row.user_id]: false }));
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to save staff");
    setMsg("Staff updated.");
  }

  if (role !== "admin") {
    return (
      <main style={{ padding: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Admin access only.</div>
      </main>
    );
  }

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 1000 }}>Account Directory</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Manage display names for parents and staff.</div>
        </div>
        <Link href="/admin/custom" style={backLink()}>
          Return to Custom
        </Link>
      </div>

      {msg ? <div style={notice()}>{msg}</div> : null}

      <section style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 1000, fontSize: 16 }}>Parents</div>
        <div style={{ display: "grid", gap: 10 }}>
          {parents.map((p) => (
            <div key={p.id} style={rowCard()}>
              <div style={{ display: "grid", gap: 8 }}>
                <label style={label()}>Name</label>
                <input
                  value={p.name}
                  onChange={(e) =>
                    setParents((prev) => prev.map((row) => (row.id === p.id ? { ...row, name: e.target.value } : row)))
                  }
                  style={input()}
                />
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <label style={label()}>Email</label>
                <input
                  value={p.email}
                  onChange={(e) =>
                    setParents((prev) => prev.map((row) => (row.id === p.id ? { ...row, email: e.target.value } : row)))
                  }
                  style={input()}
                />
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <label style={label()}>Phone</label>
                <input
                  value={p.phone ?? ""}
                  onChange={(e) =>
                    setParents((prev) => prev.map((row) => (row.id === p.id ? { ...row, phone: e.target.value } : row)))
                  }
                  style={input()}
                />
              </div>
              <button onClick={() => saveParent(p)} style={btn()} disabled={saving[p.id]}>
                {saving[p.id] ? "Saving..." : "Save"}
              </button>
            </div>
          ))}
          {!parents.length && <div style={{ opacity: 0.7 }}>No parent accounts yet.</div>}
        </div>
      </section>

      <section style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 1000, fontSize: 16 }}>Staff (Admin/Coach)</div>
        <div style={{ display: "grid", gap: 10 }}>
          {staff.map((s) => (
            <div key={s.user_id} style={rowCard()}>
              <div style={{ display: "grid", gap: 8 }}>
                <label style={label()}>Name</label>
                <input
                  value={s.username ?? ""}
                  onChange={(e) =>
                    setStaff((prev) => prev.map((row) => (row.user_id === s.user_id ? { ...row, username: e.target.value } : row)))
                  }
                  style={input()}
                />
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <label style={label()}>Email</label>
                <div style={staticField()}>{s.email ?? "—"}</div>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <label style={label()}>Role</label>
                <div style={staticField()}>{s.role ?? "coach"}</div>
              </div>
              <button onClick={() => saveStaff(s)} style={btn()} disabled={saving[s.user_id]}>
                {saving[s.user_id] ? "Saving..." : "Save"}
              </button>
            </div>
          ))}
          {!staff.length && <div style={{ opacity: 0.7 }}>No staff accounts yet.</div>}
        </div>
      </section>

      <section style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 1000, fontSize: 16 }}>All Users (Roles, Email, Name)</div>
        <div style={{ display: "grid", gap: 10 }}>
          {users.map((u) => (
            <div key={u.user_id} style={rowCard()}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 900 }}>{u.username || "No name"}</div>
                <div style={{ fontSize: 12, opacity: 0.78 }}>{u.email || "No email"}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(u.roles?.length ? u.roles : [u.role || "—"]).map((r) => (
                    <span key={`${u.user_id}-${r}`} style={roleChip()}>{r}</span>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 11, opacity: 0.62 }}>
                Created {u.created_at ? new Date(u.created_at).toLocaleString() : "—"}
              </div>
            </div>
          ))}
          {!users.length && <div style={{ opacity: 0.7 }}>No users found.</div>}
        </div>
      </section>
    </main>
  );
}

function rowCard(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    display: "grid",
    gap: 10,
  };
}

function label(): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.8,
  };
}

function input(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(15,23,42,0.45)",
    color: "white",
    fontSize: 13,
  };
}

function staticField(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(15,23,42,0.2)",
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
  };
}

function btn(): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(59,130,246,0.5)",
    background: "rgba(59,130,246,0.2)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 13,
    width: "fit-content",
  };
}

function notice(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(34,197,94,0.18)",
    color: "white",
    fontWeight: 900,
    fontSize: 12,
  };
}

function backLink(): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 12,
  };
}

function roleChip(): React.CSSProperties {
  return {
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.4)",
    background: "rgba(14,116,144,0.24)",
    padding: "3px 8px",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  };
}

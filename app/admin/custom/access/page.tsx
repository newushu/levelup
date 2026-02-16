"use client";

import { useEffect, useMemo, useState } from "react";

type NfcTag = {
  id: string;
  label: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
};

type AccessPermission = {
  id: string;
  permission_key: string;
  allowed_roles: string[];
  description?: string | null;
  created_at: string;
  updated_at: string;
};

type UserRow = {
  user_id: string;
  email: string | null;
  username: string | null;
  role: string | null;
  roles?: string[];
  created_at: string;
};

type UserEdit = {
  email: string;
  username: string;
  password: string;
  roles: string[];
};

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "coach", label: "Coach" },
  { value: "camp_helper", label: "Camp Helper" },
] as const;

const ROUTE_ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "coach", label: "Coach" },
  { value: "classroom", label: "Classroom" },
  { value: "checkin", label: "Check-In" },
  { value: "camp", label: "Camp" },
  { value: "coach-dashboard", label: "Coach Dashboard" },
  { value: "skill-tablet", label: "Skill Tablet" },
  { value: "skill_pulse", label: "Skill Pulse" },
  { value: "display", label: "Display" },
  { value: "parent", label: "Parent" },
  { value: "student", label: "Student" },
] as const;

const USER_ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "coach", label: "Coach" },
  { value: "student", label: "Student" },
  { value: "parent", label: "Parent" },
  { value: "classroom", label: "Classroom" },
  { value: "checkin", label: "Check-In" },
  { value: "display", label: "Display" },
  { value: "skill_pulse", label: "Skill Pulse" },
  { value: "camp", label: "Camp" },
  { value: "coach-dashboard", label: "Coach Dashboard" },
  { value: "skill-tablet", label: "Skill Tablet" },
] as const;

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status})` } };
  }
}

export default function AccessAdminPage() {
  const [tab, setTab] = useState<"access" | "users" | "routes">("access");
  const [tags, setTags] = useState<NfcTag[]>([]);
  const [permissions, setPermissions] = useState<AccessPermission[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [routes, setRoutes] = useState<Array<{ route_path: string; description: string; allowed_roles: string[]; has_rules: boolean }>>([]);
  const [routeQuery, setRouteQuery] = useState("");
  const [routeSaving, setRouteSaving] = useState<Record<string, boolean>>({});
  const [routeSavingAll, setRouteSavingAll] = useState(false);
  const [routeRoleFilter, setRouteRoleFilter] = useState<"all" | (typeof ROUTE_ROLE_OPTIONS)[number]["value"]>("all");
  const [routeBaseline, setRouteBaseline] = useState<Record<string, string>>({});
  const [routeDirty, setRouteDirty] = useState<Record<string, boolean>>({});
  const [userQuery, setUserQuery] = useState("");
  const [userEditOpen, setUserEditOpen] = useState<Record<string, boolean>>({});
  const [userEdits, setUserEdits] = useState<Record<string, UserEdit>>({});
  const [userSaving, setUserSaving] = useState<Record<string, boolean>>({});
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditResults, setAuditResults] = useState<null | {
    totals?: {
      auth_users?: number;
      missing_profiles?: number;
      missing_roles?: number;
      orphan_profiles?: number;
      orphan_roles?: number;
    };
    missing_profiles?: Array<{ user_id: string; email: string | null }>;
    missing_roles?: Array<{ user_id: string; email: string | null }>;
    orphan_profiles?: Array<{ user_id: string; email: string | null }>;
    orphan_roles?: Array<{ user_id: string; role: string | null }>;
  }>(null);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [auditRoleSelections, setAuditRoleSelections] = useState<Record<string, string>>({});
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState("coach");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [nfcCode, setNfcCode] = useState("");
  const [nfcLabel, setNfcLabel] = useState("");
  const [nfcRole, setNfcRole] = useState("admin");
  const [busy, setBusy] = useState(false);
  const [permKey, setPermKey] = useState("");
  const [permDesc, setPermDesc] = useState("");
  const [permRoles, setPermRoles] = useState<string[]>(["admin"]);

  async function refreshAll() {
    const [tagRes, permRes] = await Promise.all([
      fetch("/api/nfc/tags", { cache: "no-store" }),
      fetch("/api/admin/access-permissions", { cache: "no-store" }),
    ]);
    const tagJson = await safeJson(tagRes);
    const permJson = await safeJson(permRes);
    if (!tagJson.ok) setMsg(tagJson.json?.error || "Failed to load NFC tags");
    if (!permJson.ok) setMsg(permJson.json?.error || "Failed to load permissions");
    setTags((tagJson.json?.tags ?? []) as NfcTag[]);
    setPermissions((permJson.json?.permissions ?? []) as AccessPermission[]);
  }

  useEffect(() => {
    refreshAll();
  }, []);

  async function refreshUsers() {
    const res = await fetch("/api/admin/users/list", { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to load users");
    const rows = (sj.json?.users ?? []) as UserRow[];
    setUsers(rows);
    setUserEdits((prev) => {
      const next = { ...prev };
      rows.forEach((u) => {
        if (next[u.user_id]) return;
        next[u.user_id] = {
          email: String(u.email ?? ""),
          username: String(u.username ?? ""),
          password: "",
          roles: (u.roles?.length ? u.roles : [String(u.role ?? "")]).filter(Boolean),
        };
      });
      return next;
    });
  }

  async function refreshRoutes() {
    const res = await fetch("/api/admin/route-permissions", { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to load routes");
    const nextRoutes = (sj.json?.routes ?? []) as any[];
    setRoutes(nextRoutes);
    const baseline: Record<string, string> = {};
    nextRoutes.forEach((route: any) => {
      baseline[String(route.route_path)] = normalizeRoles(route.allowed_roles);
    });
    setRouteBaseline(baseline);
    setRouteDirty({});
  }

  async function createTag() {
    setMsg("");
    if (!nfcCode.trim()) return setMsg("Scan an NFC code first.");
    setBusy(true);
    const res = await fetch("/api/nfc/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: nfcCode.trim(),
        role: nfcRole,
        label: nfcLabel.trim() || null,
      }),
    });
    const sj = await safeJson(res);
    setBusy(false);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to create NFC tag");
    setTags((prev) => [sj.json?.tag as NfcTag, ...prev]);
    setNfcCode("");
    setNfcLabel("");
  }

  async function updateTag(tag: NfcTag, updates: Partial<NfcTag>) {
    setMsg("");
    const res = await fetch("/api/nfc/tags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: tag.id, ...updates }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to update NFC tag");
    const updated = sj.json?.tag as NfcTag;
    setTags((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
  }

  async function deleteTag(tag: NfcTag) {
    if (!window.confirm(`Delete NFC tag "${tag.label || "Untitled NFC"}"?`)) return;
    const res = await fetch("/api/nfc/tags", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: tag.id }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to delete NFC tag");
    setTags((prev) => prev.filter((row) => row.id !== tag.id));
  }

  async function createPermission() {
    setMsg("");
    if (!permKey.trim()) return setMsg("Permission key required.");
    const res = await fetch("/api/admin/access-permissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        permission_key: permKey.trim(),
        description: permDesc.trim() || null,
        allowed_roles: permRoles,
      }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to create permission");
    setPermissions((prev) => [...prev, sj.json?.permission as AccessPermission]);
    setPermKey("");
    setPermDesc("");
  }

  async function updatePermission(row: AccessPermission, updates: Partial<AccessPermission>) {
    setMsg("");
    const res = await fetch("/api/admin/access-permissions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, ...updates }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to update permission");
    const updated = sj.json?.permission as AccessPermission;
    setPermissions((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  }

  async function deletePermission(row: AccessPermission) {
    if (!window.confirm(`Delete permission "${row.permission_key}"?`)) return;
    const res = await fetch("/api/admin/access-permissions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to delete permission");
    setPermissions((prev) => prev.filter((item) => item.id !== row.id));
  }

  async function createUser() {
    setMsg("");
    if (!newUserEmail.trim()) return setMsg("Email required.");
    if (!newUserName.trim()) return setMsg("Username required.");
    const res = await fetch("/api/admin/users/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: newUserEmail.trim(),
        username: newUserName.trim(),
        role: newUserRole,
        password: newUserPassword.trim() || undefined,
      }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to create user");
    if (sj.json?.temp_password) {
      setMsg(`User created. Temp password: ${sj.json.temp_password}`);
    } else if (sj.json?.existed) {
      setMsg("User already existed. Profile and roles were synced.");
    } else {
      setMsg("User created.");
    }
    setNewUserEmail("");
    setNewUserName("");
    setNewUserPassword("");
    await refreshUsers();
  }

  async function deleteUser(user: UserRow) {
    const label = user.email || user.username || user.user_id;
    if (!window.confirm(`Delete user "${label}"? This removes access completely.`)) return;
    setMsg("");
    const res = await fetch("/api/admin/users/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.user_id }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to delete user");
    setMsg("User deleted.");
    await refreshUsers();
    await runUserAudit();
  }

  async function saveUser(user: UserRow) {
    const edit = userEdits[user.user_id];
    if (!edit) return;
    if (!edit.email.trim()) return setMsg("Email required.");
    if (!edit.username.trim()) return setMsg("Username required.");
    if (!edit.roles.length) return setMsg("Select at least one role.");
    setMsg("");
    setUserSaving((prev) => ({ ...prev, [user.user_id]: true }));
    const res = await fetch("/api/admin/users/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: user.user_id,
        email: edit.email.trim(),
        username: edit.username.trim(),
        password: edit.password.trim() || undefined,
        roles: edit.roles,
        primary_role: edit.roles[0],
      }),
    });
    const sj = await safeJson(res);
    setUserSaving((prev) => ({ ...prev, [user.user_id]: false }));
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to update user");
    if (sj.json?.warning) {
      setMsg(String(sj.json.warning));
    } else {
      setMsg("User updated.");
    }
    setUserEdits((prev) => ({
      ...prev,
      [user.user_id]: { ...(prev[user.user_id] ?? edit), password: "" },
    }));
    await refreshUsers();
  }

  async function runUserAudit() {
    setMsg("");
    setAuditLoading(true);
    const res = await fetch("/api/admin/users/audit", { cache: "no-store" });
    const sj = await safeJson(res);
    setAuditLoading(false);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to run audit");
    setAuditResults(sj.json || null);
  }

  async function fixUserAudit() {
    setMsg("");
    setAuditLoading(true);
    const users = Object.entries(auditRoleSelections).map(([user_id, role]) => ({ user_id, role }));
    const res = await fetch("/api/admin/users/audit/fix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ users }),
    });
    const sj = await safeJson(res);
    setAuditLoading(false);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to fix audit");
    setMsg(`Fixed profiles: ${sj.json?.fixed_profiles ?? 0}. Fixed roles: ${sj.json?.fixed_roles ?? 0}.`);
    await refreshUsers();
    await runUserAudit();
    setAuditModalOpen(false);
  }

  const auditFixRows = useMemo(() => {
    const rows = new Map<string, { user_id: string; email: string | null; missing_profile: boolean; missing_role: boolean }>();
    (auditResults?.missing_profiles ?? []).forEach((row) => {
      rows.set(row.user_id, {
        user_id: row.user_id,
        email: row.email ?? null,
        missing_profile: true,
        missing_role: false,
      });
    });
    (auditResults?.missing_roles ?? []).forEach((row) => {
      const existing = rows.get(row.user_id);
      if (existing) {
        existing.missing_role = true;
      } else {
        rows.set(row.user_id, {
          user_id: row.user_id,
          email: row.email ?? null,
          missing_profile: false,
          missing_role: true,
        });
      }
    });
    return Array.from(rows.values());
  }, [auditResults]);

  useEffect(() => {
    if (!auditModalOpen) return;
    setAuditRoleSelections((prev) => {
      const next = { ...prev };
      auditFixRows.forEach((row) => {
        if (!next[row.user_id]) next[row.user_id] = "coach";
      });
      return next;
    });
  }, [auditModalOpen, auditFixRows]);

  async function saveRoute(route: { route_path: string; description: string; allowed_roles: string[] }) {
    setRouteSaving((prev) => ({ ...prev, [route.route_path]: true }));
    const res = await fetch("/api/admin/route-permissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        route_path: route.route_path,
        description: route.description,
        allowed_roles: route.allowed_roles,
      }),
    });
    const sj = await safeJson(res);
    setRouteSaving((prev) => ({ ...prev, [route.route_path]: false }));
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to save route");
    setRoutes((prev) =>
      prev.map((r) => (r.route_path === route.route_path ? { ...r, has_rules: true } : r))
    );
    setRouteBaseline((prev) => ({ ...prev, [route.route_path]: normalizeRoles(route.allowed_roles) }));
    setRouteDirty((prev) => ({ ...prev, [route.route_path]: false }));
  }

  async function saveAllRoutes() {
    const dirtyRoutes = routes.filter((r) => routeDirty[r.route_path]);
    if (!dirtyRoutes.length) return;
    setRouteSavingAll(true);
    for (const route of dirtyRoutes) {
      await saveRoute({
        route_path: route.route_path,
        description: route.description,
        allowed_roles: route.allowed_roles?.length ? route.allowed_roles : ["admin"],
      });
    }
    setRouteSavingAll(false);
  }

  function normalizeRoles(roles: string[] | null | undefined) {
    return [...(roles ?? [])].sort().join(",");
  }

  const sortedPermissions = useMemo(
    () => [...permissions].sort((a, b) => a.permission_key.localeCompare(b.permission_key)),
    [permissions]
  );
  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const hay = `${u.username ?? ""} ${u.email ?? ""} ${u.role ?? ""} ${(u.roles ?? []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [users, userQuery]);
  const filteredRoutes = useMemo(() => {
    const q = routeQuery.trim().toLowerCase();
    return routes.filter((r) => {
      const selected = r.allowed_roles?.length ? r.allowed_roles : ["admin"];
      if (routeRoleFilter !== "all" && !selected.includes(routeRoleFilter)) return false;
      if (!q) return true;
      const hay = `${r.route_path} ${r.description}`.toLowerCase();
      return hay.includes(q);
    });
  }, [routes, routeQuery, routeRoleFilter]);

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <div>
        <div style={{ fontSize: 26, fontWeight: 1000 }}>Access & Permissions</div>
        <div style={{ opacity: 0.7, fontSize: 12 }}>
          Admin has access to all by default. Permissions only override when a key is defined.
        </div>
      </div>

      {msg ? <div style={notice()}>{msg}</div> : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" style={tabChip(tab === "access")} onClick={() => setTab("access")}>
          Access
        </button>
        <button
          type="button"
          style={tabChip(tab === "users")}
          onClick={() => {
            setTab("users");
            refreshUsers();
          }}
        >
          Users
        </button>
        <button
          type="button"
          style={tabChip(tab === "routes")}
          onClick={() => {
            setTab("routes");
            refreshRoutes();
          }}
        >
          Routes
        </button>
      </div>

      {tab === "access" ? (
        <>
      <section style={card()}>
        <div style={{ fontWeight: 900 }}>NFC Creator</div>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <label style={fieldLabel()}>
            NFC Code (scan)
            <input
              type="password"
              value={nfcCode}
              onChange={(e) => setNfcCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
              }}
              placeholder="Scan tag"
              style={input()}
            />
          </label>
          <label style={fieldLabel()}>
            Label
            <input value={nfcLabel} onChange={(e) => setNfcLabel(e.target.value)} placeholder="Optional" style={input()} />
          </label>
          <label style={fieldLabel()}>
            Role
            <select value={nfcRole} onChange={(e) => setNfcRole(e.target.value)} style={input()}>
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button style={btn()} onClick={createTag} disabled={busy}>
          {busy ? "Saving..." : "Create NFC Tag"}
        </button>
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          {tags.map((tag) => (
            <div key={tag.id} style={rowCard()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 900 }}>{tag.label || "Untitled NFC"}</div>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>
                    {tag.role} • Created {new Date(tag.created_at).toLocaleDateString()}
                    {tag.last_used_at ? ` • Last used ${new Date(tag.last_used_at).toLocaleString()}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    style={pill(tag.is_active)}
                    onClick={() => updateTag(tag, { is_active: !tag.is_active })}
                  >
                    {tag.is_active ? "Active" : "Disabled"}
                  </button>
                  <button style={dangerBtn()} onClick={() => deleteTag(tag)}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!tags.length ? <div style={{ opacity: 0.6, fontSize: 12 }}>No NFC tags yet.</div> : null}
        </div>
      </section>

      <section style={card()}>
        <div style={{ fontWeight: 900 }}>Camp PIN Settings</div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          Manage camp access PINs and NFC access for camp tools.
        </div>
        <a href="/admin/custom/camp" style={linkCard()}>
          <div style={{ fontWeight: 900 }}>Open Camp Settings</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Camp PIN accepts the Admin PIN automatically.
          </div>
        </a>
      </section>

      <section style={card()}>
        <div style={{ fontWeight: 900 }}>Permissions Admin</div>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <label style={fieldLabel()}>
            Permission Key
            <input value={permKey} onChange={(e) => setPermKey(e.target.value)} placeholder="e.g. roulette_confirm" style={input()} />
          </label>
          <label style={fieldLabel()}>
            Description
            <input value={permDesc} onChange={(e) => setPermDesc(e.target.value)} placeholder="Optional" style={input()} />
          </label>
          <label style={fieldLabel()}>
            Allowed Roles
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {ROLE_OPTIONS.map((opt) => {
                const active = permRoles.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setPermRoles((prev) =>
                        active ? prev.filter((r) => r !== opt.value) : [...prev, opt.value]
                      )
                    }
                    style={chip(active)}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </label>
        </div>
        <button style={btn()} onClick={createPermission}>
          Add Permission
        </button>

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {sortedPermissions.map((perm) => (
            <div key={perm.id} style={rowCard()}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div style={{ fontWeight: 900 }}>{perm.permission_key}</div>
                <button style={dangerBtn()} onClick={() => deletePermission(perm)}>
                  Delete
                </button>
              </div>
              {perm.description ? <div style={{ fontSize: 12, opacity: 0.7 }}>{perm.description}</div> : null}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                {ROLE_OPTIONS.map((opt) => {
                  const active = (perm.allowed_roles ?? []).includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        const next = active
                          ? (perm.allowed_roles ?? []).filter((r) => r !== opt.value)
                          : [...(perm.allowed_roles ?? []), opt.value];
                        updatePermission(perm, { allowed_roles: next });
                      }}
                      style={chip(active)}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, opacity: 0.65, marginTop: 6 }}>
                If empty, admin-only applies.
              </div>
            </div>
          ))}
          {!permissions.length ? <div style={{ opacity: 0.6, fontSize: 12 }}>No permissions set yet.</div> : null}
        </div>
      </section>
        </>
      ) : (
        tab === "users" ? (
        <section style={card()}>
          <div style={{ fontWeight: 900 }}>Add User</div>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <label style={fieldLabel()}>
              Email
              <input value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} style={input()} />
            </label>
            <label style={fieldLabel()}>
              Username
              <input value={newUserName} onChange={(e) => setNewUserName(e.target.value)} style={input()} />
            </label>
            <label style={fieldLabel()}>
              Role
              <select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)} style={input()}>
                <option value="admin">Admin</option>
                <option value="coach">Coach</option>
                <option value="coach-dashboard">Coach Dashboard</option>
                <option value="skill-tablet">Skill Tablet</option>
                <option value="classroom">Classroom</option>
                <option value="checkin">Check-In</option>
                <option value="camp">Camp Helper</option>
                <option value="display">Display</option>
                <option value="skill_pulse">Skill Pulse</option>
              </select>
            </label>
            <label style={fieldLabel()}>
              Password (optional)
              <input
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                style={input()}
                placeholder="Leave blank for temp password"
              />
            </label>
          </div>
          <button style={btn()} onClick={createUser}>
            Create User
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <button style={btnGhost()} onClick={runUserAudit} disabled={auditLoading}>
              {auditLoading ? "Auditing..." : "Run Account Audit"}
            </button>
            <button
              style={btn()}
              onClick={() => setAuditModalOpen(true)}
              disabled={auditLoading || !auditFixRows.length}
            >
              Fix Missing Profiles/Roles
            </button>
            {auditResults?.totals ? (
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                Auth: {auditResults.totals.auth_users ?? 0} • Missing profiles:{" "}
                {auditResults.totals.missing_profiles ?? 0} • Missing roles:{" "}
                {auditResults.totals.missing_roles ?? 0} • Orphan profiles:{" "}
                {auditResults.totals.orphan_profiles ?? 0} • Orphan roles:{" "}
                {auditResults.totals.orphan_roles ?? 0}
              </div>
            ) : null}
          </div>
          {auditResults?.missing_profiles?.length ? (
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              Missing profiles:{" "}
              {auditResults.missing_profiles.map((row) => row.email || row.user_id).join(", ")}
            </div>
          ) : null}
          {auditResults?.missing_roles?.length ? (
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              Missing roles:{" "}
              {auditResults.missing_roles.map((row) => row.email || row.user_id).join(", ")}
            </div>
          ) : null}
          {auditResults?.orphan_profiles?.length ? (
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              Orphan profiles:{" "}
              {auditResults.orphan_profiles.map((row) => row.email || row.user_id).join(", ")}
            </div>
          ) : null}
          {auditResults?.orphan_roles?.length ? (
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              Orphan roles:{" "}
              {auditResults.orphan_roles.map((row) => row.user_id).join(", ")}
            </div>
          ) : null}

          <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <div style={{ fontWeight: 900 }}>All Users</div>
              <input
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Search users..."
                style={input()}
              />
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {filteredUsers.map((u) => (
                <div key={u.user_id} style={rowCard()}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 900 }}>{u.username || "User"}</div>
                      <div style={{ fontSize: 11, opacity: 0.7 }}>{u.email || "No email"}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {(u.roles?.length ? u.roles : [u.role || "—"]).map((r) => (
                          <div key={`${u.user_id}-${r}`} style={roleChip()}>{r}</div>
                        ))}
                      </div>
                      <button
                        style={btnGhost()}
                        onClick={() =>
                          setUserEditOpen((prev) => ({ ...prev, [u.user_id]: !prev[u.user_id] }))
                        }
                      >
                        {userEditOpen[u.user_id] ? "Close" : "Edit"}
                      </button>
                      <button style={dangerBtn()} onClick={() => deleteUser(u)}>
                        Delete
                      </button>
                    </div>
                  </div>
                  {userEditOpen[u.user_id] ? (
                    <div style={{ marginTop: 8, display: "grid", gap: 10 }}>
                      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                        <label style={fieldLabel()}>
                          Name
                          <input
                            value={userEdits[u.user_id]?.username ?? ""}
                            onChange={(e) =>
                              setUserEdits((prev) => ({
                                ...prev,
                                [u.user_id]: { ...(prev[u.user_id] ?? { email: "", username: "", password: "", roles: [] }), username: e.target.value },
                              }))
                            }
                            style={input()}
                          />
                        </label>
                        <label style={fieldLabel()}>
                          Email
                          <input
                            value={userEdits[u.user_id]?.email ?? ""}
                            onChange={(e) =>
                              setUserEdits((prev) => ({
                                ...prev,
                                [u.user_id]: { ...(prev[u.user_id] ?? { email: "", username: "", password: "", roles: [] }), email: e.target.value },
                              }))
                            }
                            style={input()}
                          />
                        </label>
                        <label style={fieldLabel()}>
                          New Password (optional)
                          <input
                            type="password"
                            value={userEdits[u.user_id]?.password ?? ""}
                            onChange={(e) =>
                              setUserEdits((prev) => ({
                                ...prev,
                                [u.user_id]: { ...(prev[u.user_id] ?? { email: "", username: "", password: "", roles: [] }), password: e.target.value },
                              }))
                            }
                            style={input()}
                          />
                        </label>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {USER_ROLE_OPTIONS.map((opt) => {
                          const selected = (userEdits[u.user_id]?.roles ?? []).includes(opt.value);
                          return (
                            <button
                              key={`${u.user_id}-${opt.value}`}
                              type="button"
                              onClick={() =>
                                setUserEdits((prev) => {
                                  const current = prev[u.user_id] ?? { email: "", username: "", password: "", roles: [] };
                                  const nextRoles = selected
                                    ? current.roles.filter((r) => r !== opt.value)
                                    : [...current.roles, opt.value];
                                  return { ...prev, [u.user_id]: { ...current, roles: nextRoles } };
                                })
                              }
                              style={chip(selected)}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button style={btn()} onClick={() => saveUser(u)} disabled={!!userSaving[u.user_id]}>
                          {userSaving[u.user_id] ? "Saving..." : "Save User"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
              {!filteredUsers.length ? <div style={{ opacity: 0.6, fontSize: 12 }}>No users found.</div> : null}
            </div>
          </div>
        </section>
        ) : (
          <section style={card()}>
            <div style={{ fontWeight: 900 }}>Route Permissions</div>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  value={routeQuery}
                  onChange={(e) => setRouteQuery(e.target.value)}
                  placeholder="Search routes..."
                  style={input()}
                />
                <button style={btnGhost()} onClick={refreshRoutes}>
                  Refresh
                </button>
                <button style={btn()} onClick={saveAllRoutes} disabled={routeSavingAll || !Object.values(routeDirty).some(Boolean)}>
                  {routeSavingAll ? "Saving..." : "Save All"}
                </button>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[{ value: "all", label: "All" }, ...ROUTE_ROLE_OPTIONS].map((opt) => {
                  const active = routeRoleFilter === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRouteRoleFilter(opt.value as any)}
                      style={chip(active)}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
              {filteredRoutes.map((route) => {
                const selected = route.allowed_roles?.length ? route.allowed_roles : ["admin"];
                return (
                  <div key={route.route_path} style={rowCard()}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 900 }}>{route.route_path}</div>
                        <div style={{ fontSize: 11, opacity: 0.7 }}>{route.description}</div>
                      </div>
                      <div style={roleChip()}>{route.has_rules ? "Custom" : "Default"}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {ROUTE_ROLE_OPTIONS.map((opt) => {
                        const active = selected.includes(opt.value);
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              const next = active
                                ? selected.filter((r) => r !== opt.value)
                                : [...selected, opt.value];
                              setRoutes((prev) =>
                                prev.map((r) =>
                                  r.route_path === route.route_path ? { ...r, allowed_roles: next } : r
                                )
                              );
                              setRouteDirty((prev) => ({
                                ...prev,
                                [route.route_path]: normalizeRoles(next) !== routeBaseline[route.route_path],
                              }));
                            }}
                            style={chip(active)}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      style={btn()}
                      onClick={() =>
                        saveRoute({
                          route_path: route.route_path,
                          description: route.description,
                          allowed_roles: selected,
                        })
                      }
                      disabled={routeSaving[route.route_path]}
                    >
                      {routeSaving[route.route_path] ? "Saving..." : "Save"}
                    </button>
                  </div>
                );
              })}
              {!filteredRoutes.length ? <div style={{ opacity: 0.6, fontSize: 12 }}>No routes found.</div> : null}
            </div>
          </section>
        )
      )}

      {auditModalOpen ? (
        <div style={modalBackdrop()}>
          <div style={modalCard()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>Fix Missing Profiles/Roles</div>
              <button type="button" style={btnGhost()} onClick={() => setAuditModalOpen(false)}>
                Close
              </button>
            </div>
            {!auditFixRows.length ? (
              <div style={{ fontSize: 12, opacity: 0.7 }}>No missing profiles or roles.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {auditFixRows.map((row) => {
                  const selectedRole = auditRoleSelections[row.user_id] || "coach";
                  return (
                    <div key={row.user_id} style={rowCard()}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                        <div>
                          <div style={{ fontWeight: 900 }}>{row.email || row.user_id}</div>
                          <div style={{ fontSize: 11, opacity: 0.7 }}>
                            {row.missing_profile ? "Missing profile" : null}
                            {row.missing_profile && row.missing_role ? " • " : null}
                            {row.missing_role ? "Missing role" : null}
                          </div>
                        </div>
                        <div style={roleChip()}>{selectedRole}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {USER_ROLE_OPTIONS.map((opt) => {
                          const active = selectedRole === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() =>
                                setAuditRoleSelections((prev) => ({ ...prev, [row.user_id]: opt.value }))
                              }
                              style={chip(active)}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
              <button style={btnGhost()} onClick={() => setAuditModalOpen(false)}>
                Cancel
              </button>
              <button style={btn()} onClick={fixUserAudit} disabled={auditLoading || !auditFixRows.length}>
                {auditLoading ? "Working..." : "Apply Fixes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
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

function pill(active: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 999,
    border: active ? "1px solid rgba(34,197,94,0.6)" : "1px solid rgba(239,68,68,0.5)",
    background: active ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 11,
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
    padding: "8px 12px",
    borderRadius: 999,
    border: active ? "1px solid rgba(59,130,246,0.6)" : "1px solid rgba(255,255,255,0.18)",
    background: active ? "rgba(59,130,246,0.28)" : "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    fontSize: 11,
    cursor: "pointer",
  };
}

function roleChip(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.08)",
    fontWeight: 900,
    fontSize: 11,
    textTransform: "uppercase",
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
    border: "1px solid rgba(239,68,68,0.3)",
    background: "rgba(239,68,68,0.12)",
    color: "white",
    fontWeight: 900,
    fontSize: 12,
  };
}

function linkCard(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    textDecoration: "none",
    display: "grid",
    gap: 6,
  };
}

function modalBackdrop(): React.CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 1000,
  };
}

function modalCard(): React.CSSProperties {
  return {
    width: "min(900px, 100%)",
    maxHeight: "80vh",
    overflowY: "auto",
    borderRadius: 16,
    padding: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(10,10,10,0.98)",
    display: "grid",
    gap: 12,
  };
}

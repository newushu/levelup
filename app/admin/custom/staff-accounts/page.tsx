"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status})` } };
  }
}

export default function StaffAccountsPage() {
  const [role, setRole] = useState("student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountRole, setAccountRole] = useState("coach");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const sj = await safeJson(res);
      if (sj.ok) setRole(String(sj.json?.role ?? "student"));
    })();
  }, []);

  async function createAccount() {
    setMsg("");
    if (!name.trim() || !email.trim() || !password.trim()) {
      return setMsg("Name, email, and password are required.");
    }
    setBusy(true);
    const res = await fetch("/api/admin/create-coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: name.trim(),
        email: email.trim(),
        password,
        role: accountRole,
      }),
    });
    const sj = await safeJson(res);
    setBusy(false);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to create account.");
    setMsg("Staff account created.");
    setName("");
    setEmail("");
    setPassword("");
    setAccountRole("coach");
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
          <div style={{ fontSize: 26, fontWeight: 1000 }}>Staff Accounts</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Create coach or admin logins (backend only).</div>
        </div>
        <Link href="/admin/custom" style={backLink()}>
          Return to Custom
        </Link>
      </div>

      <div style={card()}>
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>New Staff Account</div>
        <div style={{ display: "grid", gap: 10 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" style={input()} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" style={input()} />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" style={input()} />
          <select value={accountRole} onChange={(e) => setAccountRole(e.target.value)} style={select()}>
            <option value="coach">Coach</option>
            <option value="admin">Admin</option>
          </select>
          {msg ? <div style={{ fontSize: 12, opacity: 0.75 }}>{msg}</div> : null}
          <button onClick={createAccount} style={btn()} disabled={busy}>
            {busy ? "Creating..." : "Create Account"}
          </button>
        </div>
      </div>
    </main>
  );
}

function card(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: 14,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    maxWidth: 520,
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

function select(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(15,23,42,0.45)",
    color: "white",
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

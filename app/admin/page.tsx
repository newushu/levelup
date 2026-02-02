"use client";

import { useEffect, useState } from "react";
import AuthGate from "../../components/AuthGate";

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 180)}` } };
  }
}

export default function AdminGatePage() {
  return (
    <AuthGate>
      <AdminGateInner />
    </AuthGate>
  );
}

function AdminGateInner() {
  const [role, setRole] = useState<string>("student");
  const [pin, setPin] = useState("");
  const [nfcCode, setNfcCode] = useState("");
  const [pinSet, setPinSet] = useState<boolean | null>(null);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const isAdmin = role === "admin";

  useEffect(() => {
    (async () => {
      const meRes = await fetch("/api/auth/me", { cache: "no-store" });
      const me = await safeJson(meRes);
      if (me.ok) setRole(String(me.json?.role ?? "student"));

      const res = await fetch("/api/skill-tracker/settings", { cache: "no-store" });
      const sj = await safeJson(res);
      if (sj.ok) {
        setPinSet(Boolean(sj.json?.settings?.admin_pin_set));
      }
    })();
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    if (typeof window === "undefined") return;
    window.location.href = "/admin/custom";
  }, [isAdmin]);

  async function verifyPin() {
    setMsg("");
    if (!pin.trim()) return setMsg("Enter admin PIN.");
    setSaving(true);
    const res = await fetch("/api/skill-tracker/settings/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: pin.trim() }),
    });
    const sj = await safeJson(res);
    setSaving(false);
    if (!sj.ok) return setMsg(sj.json?.error || "Invalid PIN");
    window.sessionStorage.setItem("admin_pin_ok", "1");
    window.sessionStorage.setItem("admin_nfc_ok", "0");
    window.location.href = "/admin/custom";
  }

  async function verifyNfc() {
    setMsg("");
    if (!nfcCode.trim()) return setMsg("Scan NFC code.");
    setSaving(true);
    const res = await fetch("/api/nfc/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: nfcCode.trim(), permission_key: "admin_workspace" }),
    });
    const sj = await safeJson(res);
    setSaving(false);
    if (!sj.ok) return setMsg(sj.json?.error || "Invalid NFC code");
    window.sessionStorage.setItem("admin_pin_ok", "1");
    window.sessionStorage.setItem("admin_nfc_ok", "1");
    window.location.href = "/admin/custom";
  }

  async function setNewPin() {
    setMsg("");
    if (!pin.trim()) return setMsg("Enter a new PIN.");
    setSaving(true);
    const res = await fetch("/api/skill-tracker/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ admin_pin: pin.trim() }),
    });
    const sj = await safeJson(res);
    setSaving(false);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to set PIN");
    setPinSet(true);
    setMsg("PIN saved.");
    setPin("");
  }

  if (role !== "admin") {
    return (
      <main style={{ display: "grid", gap: 12 }}>
        <div style={{ fontSize: 26, fontWeight: 1000 }}>Admin Access</div>
        <div style={{ opacity: 0.75 }}>Admin role required.</div>
      </main>
    );
  }

  return null;
}

function card(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    display: "grid",
    gap: 10,
    maxWidth: 420,
  };
}

function input(): React.CSSProperties {
  return {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.35)",
    color: "white",
    fontWeight: 900,
    fontSize: 14,
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

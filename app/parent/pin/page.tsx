"use client";

import { useEffect, useState } from "react";
import AuthGate from "@/components/AuthGate";

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status})` } };
  }
}

export default function ParentPinPage() {
  return (
    <AuthGate>
      <ParentPinInner />
    </AuthGate>
  );
}

function ParentPinInner() {
  const [role, setRole] = useState("student");
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const sj = await safeJson(res);
      if (sj.ok) setRole(String(sj.json?.role ?? "student"));
    })();
  }, []);

  async function savePin() {
    setMsg("");
    if (!pin.trim()) return setMsg("Enter a PIN.");
    setBusy(true);
    const res = await fetch("/api/parent/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: pin.trim() }),
    });
    const sj = await safeJson(res);
    setBusy(false);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to save PIN");
    setPin("");
    setMsg("PIN saved.");
  }

  if (role !== "parent") {
    return (
      <main style={{ padding: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Parent access only.</div>
      </main>
    );
  }

  return (
    <main style={{ padding: 18, maxWidth: 520, margin: "0 auto" }}>
      <div style={{ fontSize: 28, fontWeight: 1000 }}>Parent PIN</div>
      <div style={{ opacity: 0.7, marginTop: 6 }}>Set a PIN to approve Home Quest tasks.</div>
      {msg ? <div style={{ marginTop: 10, opacity: 0.8 }}>{msg}</div> : null}

      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="New PIN"
          type="password"
          style={input()}
        />
        <button onClick={savePin} style={btn()} disabled={busy}>
          {busy ? "Saving..." : "Save PIN"}
        </button>
      </div>
    </main>
  );
}

function input(): React.CSSProperties {
  return {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.4)",
    color: "white",
    fontSize: 14,
    outline: "none",
  };
}

function btn(): React.CSSProperties {
  return {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(59,130,246,0.6)",
    background: "linear-gradient(90deg, rgba(59,130,246,0.9), rgba(14,116,144,0.7))",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

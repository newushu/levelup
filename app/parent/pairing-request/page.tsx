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

export default function ParentPairingRequestPage() {
  return (
    <AuthGate>
      <ParentPairingRequestInner />
    </AuthGate>
  );
}

function ParentPairingRequestInner() {
  const [role, setRole] = useState("student");
  const [studentName, setStudentName] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const sj = await safeJson(res);
      if (sj.ok) setRole(String(sj.json?.role ?? "student"));
    })();
  }, []);

  async function submit() {
    setMsg("");
    if (!studentName.trim()) return setMsg("Student name is required.");
    setBusy(true);
    const res = await fetch("/api/parent/pairing-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_name: studentName.trim(),
        note: note.trim(),
      }),
    });
    const sj = await safeJson(res);
    setBusy(false);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to submit request.");
    setStudentName("");
    setNote("");
    setMsg("Request submitted. We will review within 24 hours.");
    setSubmitted(true);
    window.setTimeout(() => setSubmitted(false), 1600);
  }

  if (role !== "parent") {
    return (
      <main style={{ padding: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Parent access only.</div>
      </main>
    );
  }

  return (
    <main style={page()}>
      <div style={card()}>
        <div style={{ fontSize: 24, fontWeight: 1000 }}>Request Student Pairing</div>
        <div style={{ opacity: 0.75, marginTop: 6 }}>
          Add another student by name. Include a note for the admin team if needed.
        </div>

        <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
          <input
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            placeholder="Student name"
            style={input()}
          />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note for admin (coach name, class time, etc.)"
            rows={4}
            style={textarea()}
          />
          {msg ? <div style={{ fontSize: 12, opacity: 0.75 }}>{msg}</div> : null}
          <button onClick={submit} style={btn()} disabled={busy}>
            {busy ? "Submitting..." : submitted ? "Submitted!" : "Submit Request"}
          </button>
        </div>
      </div>
    </main>
  );
}

function page(): React.CSSProperties {
  return {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 20,
    background: "radial-gradient(circle at top, rgba(59,130,246,0.18), transparent 60%), #05070b",
    color: "white",
  };
}

function card(): React.CSSProperties {
  return {
    width: "min(520px, 92vw)",
    borderRadius: 18,
    padding: 20,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(8,10,15,0.8)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
    display: "grid",
    gap: 8,
  };
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

function textarea(): React.CSSProperties {
  return {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.4)",
    color: "white",
    fontSize: 14,
    outline: "none",
    resize: "vertical",
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

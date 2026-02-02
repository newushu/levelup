"use client";

import { useState } from "react";

export default function ParentRequestPage() {
  const [parentName, setParentName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [studentNames, setStudentNames] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit() {
    setMsg("");
    if (!parentName.trim() || !email.trim() || !password.trim()) {
      return setMsg("Parent name, email, and password are required.");
    }
    setBusy(true);
    const res = await fetch("/api/parent/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parent_name: parentName.trim(),
        email: email.trim(),
        password,
        student_names: studentNames,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(data?.error || "Failed to submit request.");
    setMsg("Request submitted. You can log in now and wait for pairing.");
    setSubmitted(true);
    window.setTimeout(() => setSubmitted(false), 1600);
  }

  return (
    <main style={page()}>
      <div style={card()}>
        <div style={{ fontSize: 24, fontWeight: 1000 }}>Parent Account Request</div>
        <div style={{ opacity: 0.75, marginTop: 6 }}>
          Create your parent login and list the students you want to be linked with.
        </div>

        <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
          <input value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="Parent name" style={input()} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" style={input()} />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" style={input()} />
          <textarea
            value={studentNames}
            onChange={(e) => setStudentNames(e.target.value)}
            placeholder="Student names (comma separated)"
            rows={3}
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
    width: "min(480px, 92vw)",
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

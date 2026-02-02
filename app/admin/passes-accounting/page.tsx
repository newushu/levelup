"use client";

import { useEffect, useState } from "react";

type PassType = { id: string; name: string; price_usd?: number | null };
type StudentPick = { id: string; name: string };

export default function PassAccountingPage() {
  const [role, setRole] = useState("student");
  const [passes, setPasses] = useState<PassType[]>([]);
  const [studentQuery, setStudentQuery] = useState("");
  const [studentResults, setStudentResults] = useState<StudentPick[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentPick | null>(null);
  const [selectedPassIds, setSelectedPassIds] = useState<string[]>([]);
  const [amountUsd, setAmountUsd] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");

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
    if (!selectedPassIds.length) return;
    const total = passes
      .filter((p) => selectedPassIds.includes(p.id))
      .reduce((sum, p) => sum + (p.price_usd ?? 0), 0);
    if (total > 0 && !amountUsd) setAmountUsd(String(total));
  }, [amountUsd, passes, selectedPassIds]);

  async function recordPayment() {
    if (!selectedStudent?.id || !selectedPassIds.length || !amountUsd) return;
    setMsg("");
    const res = await fetch("/api/passes/payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id: selectedStudent.id,
        pass_type_ids: selectedPassIds,
        amount_usd: Number(amountUsd),
        note: note.trim() || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data?.error || "Failed to record payment");
    setMsg("Payment recorded.");
    setSelectedPassIds([]);
    setAmountUsd("");
    setNote("");
  }

  if (role !== "admin") {
    return (
      <main style={{ padding: 18 }}>
        <div style={{ fontSize: 24, fontWeight: 900 }}>Admin access required.</div>
      </main>
    );
  }

  return (
    <main style={{ padding: 18, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ fontSize: 28, fontWeight: 1000 }}>Pass Accounting</div>
      {msg ? <div style={{ marginTop: 8, color: "crimson", fontWeight: 700 }}>{msg}</div> : null}

      <section style={card()}>
        <div style={cardTitle()}>Record Payment</div>
        <div style={grid()}>
          <label style={label()}>
            Search student
            <input value={studentQuery} onChange={(e) => setStudentQuery(e.target.value)} style={input()} placeholder="Start typing a name..." />
          </label>
          <label style={label()}>
            Selected student
            <input value={selectedStudent?.name ?? ""} readOnly style={input()} />
          </label>
          <label style={label()}>
            Amount (USD)
            <input value={amountUsd} onChange={(e) => setAmountUsd(e.target.value)} style={input()} />
          </label>
          <label style={label()}>
            Note
            <input value={note} onChange={(e) => setNote(e.target.value)} style={input()} placeholder="Optional memo" />
          </label>
        </div>

        {studentResults.length ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            {studentResults.slice(0, 8).map((s) => (
              <button key={s.id} onClick={() => setSelectedStudent(s)} style={chip()}>
                {s.name}
              </button>
            ))}
          </div>
        ) : null}

        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Passes paid for</div>
          <div style={{ display: "grid", gap: 6 }}>
            {passes.map((p) => (
              <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={selectedPassIds.includes(p.id)}
                  onChange={(e) =>
                    setSelectedPassIds((prev) => (e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)))
                  }
                />
                {p.name} {p.price_usd ? <span style={{ opacity: 0.7 }}>(${p.price_usd})</span> : null}
              </label>
            ))}
          </div>
        </div>

        <button onClick={recordPayment} style={btnPrimary()}>
          Record payment
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

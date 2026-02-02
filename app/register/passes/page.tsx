"use client";

import { useEffect, useMemo, useState } from "react";

type PassType = {
  id: string;
  name: string;
  description?: string | null;
  price_usd?: number | null;
  discount_price_usd?: number | null;
  discount_start?: string | null;
  discount_end?: string | null;
  access_scope?: string | null;
};

function isDiscountActive(pass: PassType, today: string) {
  if (!pass.discount_price_usd) return false;
  const start = pass.discount_start ? String(pass.discount_start) : "";
  const end = pass.discount_end ? String(pass.discount_end) : "";
  if (start && today < start) return false;
  if (end && today > end) return false;
  return true;
}

export default function PassRegistrationPage() {
  const [passes, setPasses] = useState<PassType[]>([]);
  const [selectedPassIds, setSelectedPassIds] = useState<string[]>([]);
  const [studentName, setStudentName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [desiredStart, setDesiredStart] = useState("");
  const [desiredEnd, setDesiredEnd] = useState("");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/passes/public-list", { cache: "no-store" });
        const data = await res.json();
        if (res.ok) setPasses((data.passes ?? []) as PassType[]);
      } catch {}
    })();
  }, []);

  const totalUsd = useMemo(() => {
    return passes
      .filter((p) => selectedPassIds.includes(p.id))
      .reduce((sum, p) => {
        const discounted = isDiscountActive(p, today);
        const price = discounted ? p.discount_price_usd : p.price_usd;
        return sum + (price ?? 0);
      }, 0);
  }, [passes, selectedPassIds, today]);

  async function submit() {
    if (!studentName.trim() || !selectedPassIds.length) {
      setMsg("Select at least one pass and enter a student name.");
      return;
    }
    setMsg("");
    const res = await fetch("/api/passes/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_name: studentName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        desired_start_date: desiredStart || null,
        desired_end_date: desiredEnd || null,
        pass_type_ids: selectedPassIds,
        amount_usd: totalUsd || null,
        notes: notes.trim() || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data?.error || "Failed to submit registration");
    setMsg("Registration submitted. We will confirm your passes shortly.");
    setSelectedPassIds([]);
    setStudentName("");
    setEmail("");
    setPhone("");
    setDesiredStart("");
    setDesiredEnd("");
    setNotes("");
  }

  return (
    <main style={page()}>
      <div style={hero()}>
        <div style={{ fontSize: 34, fontWeight: 1000 }}>Student Pass Registration</div>
        <div style={{ opacity: 0.78, maxWidth: 540 }}>
          Choose the passes that fit your training plan. We will confirm availability and activate access.
        </div>
      </div>

      <section style={card()}>
        <div style={cardTitle()}>Select Passes</div>
        <div style={passGrid()}>
          {passes.map((p) => {
            const active = selectedPassIds.includes(p.id);
            const discounted = isDiscountActive(p, today);
            const price = discounted ? p.discount_price_usd : p.price_usd;
            return (
              <button
                key={p.id}
                onClick={() =>
                  setSelectedPassIds((prev) => (active ? prev.filter((id) => id !== p.id) : [...prev, p.id]))
                }
                style={passCard(active)}
              >
                <div style={thumbBox()}>
                  {p.use_text || !p.image_url ? (
                    <div style={{ fontWeight: 900, textAlign: "center", fontSize: 13 }}>
                      {p.image_text || p.name || "Pass"}
                    </div>
                  ) : (
                    <img src={p.image_url} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  )}
                </div>
                <div style={{ fontWeight: 900 }}>{p.name}</div>
                <div style={{ opacity: 0.8, fontSize: 12 }}>{p.description ?? "Access pass"}</div>
                <div style={{ marginTop: 10, fontWeight: 900 }}>
                  {price ? `$${Number(price).toFixed(2)}` : "Pricing set at desk"}
                </div>
                {discounted ? <div style={{ fontSize: 11, opacity: 0.8 }}>Discount active</div> : null}
              </button>
            );
          })}
          {!passes.length ? <div style={{ opacity: 0.7 }}>No passes available.</div> : null}
        </div>
        <div style={{ marginTop: 12, fontWeight: 900 }}>Estimated total: ${Number(totalUsd).toFixed(2)}</div>
      </section>

      <section style={card()}>
        <div style={cardTitle()}>Student Info</div>
        <div style={formGrid()}>
          <label style={label()}>
            Student name
            <input value={studentName} onChange={(e) => setStudentName(e.target.value)} style={input()} />
          </label>
          <label style={label()}>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} style={input()} />
          </label>
          <label style={label()}>
            Phone
            <input value={phone} onChange={(e) => setPhone(e.target.value)} style={input()} />
          </label>
          <label style={label()}>
            Desired start date
            <input type="date" value={desiredStart} onChange={(e) => setDesiredStart(e.target.value)} style={input()} />
          </label>
          <label style={label()}>
            Desired end date
            <input type="date" value={desiredEnd} onChange={(e) => setDesiredEnd(e.target.value)} style={input()} />
          </label>
          <label style={label()}>
            Notes
            <input value={notes} onChange={(e) => setNotes(e.target.value)} style={input()} placeholder="Special requests or notes" />
          </label>
        </div>
      </section>

      {msg ? <div style={{ marginTop: 12, color: "gold", fontWeight: 800 }}>{msg}</div> : null}

      <button onClick={submit} style={cta()}>
        Submit registration
      </button>
    </main>
  );
}

function page(): React.CSSProperties {
  return {
    minHeight: "100vh",
    padding: "28px 18px 60px",
    background: "radial-gradient(circle at 20% 20%, rgba(14,116,144,0.35), transparent 40%), radial-gradient(circle at 80% 0%, rgba(59,130,246,0.25), transparent 45%), #070a0f",
    color: "white",
  };
}

function hero(): React.CSSProperties {
  return { display: "grid", gap: 8, marginBottom: 18 };
}

function card(): React.CSSProperties {
  return {
    marginTop: 16,
    borderRadius: 18,
    padding: 16,
    background: "rgba(10,12,18,0.7)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
  };
}

function cardTitle(): React.CSSProperties {
  return { fontWeight: 900, marginBottom: 10 };
}

function passGrid(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 };
}

function passCard(active: boolean): React.CSSProperties {
  return {
    textAlign: "left",
    borderRadius: 14,
    padding: 14,
    border: active ? "1px solid rgba(34,197,94,0.7)" : "1px solid rgba(255,255,255,0.12)",
    background: active ? "linear-gradient(135deg, rgba(34,197,94,0.2), rgba(15,23,42,0.9))" : "rgba(8,10,15,0.8)",
    color: "white",
    display: "grid",
    gap: 6,
  };
}

function thumbBox(): React.CSSProperties {
  return {
    width: "100%",
    aspectRatio: "1 / 1",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(8,10,15,0.7)",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
  };
}

function formGrid(): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 };
}

function label(): React.CSSProperties {
  return { display: "grid", gap: 6, fontSize: 12, opacity: 0.9 };
}

function input(): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(8,10,15,0.7)",
    color: "white",
  };
}

function cta(): React.CSSProperties {
  return {
    marginTop: 16,
    padding: "12px 18px",
    borderRadius: 12,
    border: "1px solid rgba(14,116,144,0.7)",
    background: "linear-gradient(135deg, rgba(14,116,144,0.95), rgba(2,132,199,0.6))",
    color: "white",
    fontWeight: 900,
    fontSize: 16,
  };
}

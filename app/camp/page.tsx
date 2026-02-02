"use client";

import { useEffect, useState } from "react";

export default function CampHubPage() {
  const [role, setRole] = useState("student");
  const [pinOk, setPinOk] = useState(false);
  const [pin, setPin] = useState("");
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

  async function verifyPin() {
    setMsg("");
    if (!pin.trim()) return setMsg("Enter PIN or NFC code.");
    const res = await fetch("/api/camp/settings/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: pin.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data?.error || "PIN verification failed");
    setPinOk(true);
    setPin("");
  }

  if (!["admin", "coach", "camp"].includes(role)) {
    return (
      <main style={{ padding: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Camp access only.</div>
        <div style={{ opacity: 0.7, marginTop: 6 }}>Camp, coach, or admin accounts can access this page.</div>
      </main>
    );
  }

  return (
    <main style={{ padding: 18, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ fontSize: 28, fontWeight: 1000 }}>Camp Hub</div>
      <div style={{ opacity: 0.75, marginTop: 6 }}>Unlock with PIN or NFC to access camp tools.</div>

      {!pinOk ? (
        <div style={card()}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Camp PIN / NFC</div>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") verifyPin();
            }}
            placeholder="Enter PIN or scan NFC"
            style={input()}
          />
          {msg ? <div style={{ color: "crimson", marginTop: 6 }}>{msg}</div> : null}
          <button onClick={verifyPin} style={btnPrimary()}>
            Unlock
          </button>
        </div>
      ) : (
        <div style={card()}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Camp Pages</div>
          <div style={linkGrid()}>
            <a href="/camp/register" style={linkCard()}>
              <span style={linkEmoji()}>🧾</span>
              <div>
                <div style={{ fontWeight: 900 }}>Points POS</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Checkout and log camp points.</div>
              </div>
            </a>
            <a href="/camp/menu-editor" style={linkCard()}>
              <span style={linkEmoji()}>🛠️</span>
              <div>
                <div style={{ fontWeight: 900 }}>Menu Editor</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Manage items, prices, and images.</div>
              </div>
            </a>
            <a href="/camp/menu" style={linkCard()}>
              <span style={linkEmoji()}>📋</span>
              <div>
                <div style={{ fontWeight: 900 }}>Menu Display</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Display the live camp menu.</div>
              </div>
            </a>
            <a href="/camp/wager-manager" style={linkCard()}>
              <span style={linkEmoji()}>🎲</span>
              <div>
                <div style={{ fontWeight: 900 }}>Wager Manager</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Track blinds and settle round totals.</div>
              </div>
            </a>
            <a href="/spin" style={linkCard()}>
              <span style={linkEmoji()}>🎡</span>
              <div>
                <div style={{ fontWeight: 900 }}>Prize Wheel</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Spin for rewards and fun picks.</div>
              </div>
            </a>
          </div>
        </div>
      )}
    </main>
  );
}

function card(): React.CSSProperties {
  return {
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(8,10,15,0.7)",
  };
}

function input(): React.CSSProperties {
  return {
    width: "100%",
    padding: "16px 18px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(6,8,12,0.8)",
    color: "white",
    fontSize: 18,
    textAlign: "center",
    letterSpacing: 1,
  };
}

function btnPrimary(): React.CSSProperties {
  return {
    marginTop: 10,
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid rgba(14,116,144,0.6)",
    background: "linear-gradient(135deg, rgba(14,116,144,0.9), rgba(2,132,199,0.6))",
    color: "white",
    fontWeight: 800,
  };
}

function linkGrid(): React.CSSProperties {
  return {
    display: "grid",
    gap: 10,
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  };
}

function linkCard(): React.CSSProperties {
  return {
    display: "flex",
    gap: 12,
    alignItems: "center",
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    textDecoration: "none",
    fontWeight: 800,
  };
}

function linkEmoji(): React.CSSProperties {
  return {
    width: 38,
    height: 38,
    display: "grid",
    placeItems: "center",
    borderRadius: 12,
    background: "rgba(255,255,255,0.08)",
    fontSize: 18,
  };
}

"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "../../lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("calvin@newushu.com");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string>("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoZoom, setLogoZoom] = useState(1);
  const [loginMode, setLoginMode] = useState<"none" | "student" | "parent" | "coach">("none");
  const [parentStep, setParentStep] = useState<"choice" | "login">("choice");

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await fetch("/api/public/nav-logo", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!mounted) return;
      if (data?.logo_url) setLogoUrl(String(data.logo_url));
      if (data?.logo_zoom) setLogoZoom(Number(data.logo_zoom ?? 1));
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function onLogin() {
    setMsg("");
    const supabase = supabaseClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMsg(`Supabase error: ${error.message}`);
    else {
      try {
        localStorage.setItem("intro_after_login", "1");
      } catch {}
      let nextPath = "/";
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (data?.ok) {
          const role = String(data?.role ?? "");
          if (role === "parent") nextPath = "/parent";
          else if (role === "student") nextPath = "/student";
        }
      } catch {}
      window.location.href = nextPath;
    }
  }

  return (
    <div style={wrap()}>
      <style>{bgCss()}</style>
      <div className="bgOrb" />
      <div className="bgOrb2" />

      <div style={card()}>
        <img
          src={logoUrl ?? "https://newushu.com/uploads/1/1/1/3/111378341/newushu-black-transparent-2.png"}
          alt="Logo"
          style={{ width: Math.max(72, 72 * logoZoom), height: Math.max(72, 72 * logoZoom), objectFit: "contain", filter: "invert(1)" }}
        />

        <div style={{ fontWeight: 1000, fontSize: 26, marginTop: 12, letterSpacing: 1 }}>Lead &amp; Achieve</div>
        <div style={{ fontWeight: 800, fontSize: 18, opacity: 0.85, marginTop: 4, letterSpacing: 1 }}>Level Up</div>
        <div style={{ opacity: 0.75, marginTop: 4 }}>
          {loginMode === "none" ? "Choose a login type" : loginMode === "coach" ? "Coach / Admin Login" : "Student / Parent Login"}
        </div>

        {loginMode === "none" ? (
          <div style={{ display: "grid", gap: 10, marginTop: 18, width: "100%" }}>
            <button
              style={choiceCard()}
              onClick={() => {
                setLoginMode("student");
                setEmail("");
                setPassword("");
              }}
            >
              <span style={choiceEmoji()}>🎒</span>
              <span style={choiceLabel()}>Student</span>
            </button>
            <button
              style={choiceCard()}
              onClick={() => {
                setLoginMode("parent");
                setParentStep("choice");
                setEmail("");
                setPassword("");
              }}
            >
              <span style={choiceEmoji()}>👪</span>
              <span style={choiceLabel()}>Parent</span>
            </button>
            <button
              style={choiceCard()}
              onClick={() => {
                setLoginMode("coach");
                setEmail("");
                setPassword("");
              }}
            >
              <span style={choiceEmoji()}>🧭</span>
              <span style={choiceLabel()}>Coach / Admin</span>
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10, marginTop: 18, width: "100%" }}>
            {loginMode === "parent" && parentStep === "choice" ? (
              <>
                <button
                  style={choiceCard()}
                  onClick={() => {
                    setParentStep("login");
                    setEmail("");
                    setPassword("");
                  }}
                >
                  <span style={choiceEmoji()}>🔐</span>
                  <span style={choiceLabel()}>I have an account</span>
                </button>
                <a href="/parent/request" style={choiceCard()}>
                  <span style={choiceEmoji()}>📝</span>
                  <span style={choiceLabel()}>Create a parent account</span>
                </a>
                <button
                  onClick={() => {
                    setLoginMode("none");
                    setMsg("");
                  }}
                  style={btnGhost()}
                >
                  Back
                </button>
              </>
            ) : (
              <>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" style={inp()} />
                <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" style={inp()} />
                <button onClick={onLogin} style={btn()}>
                  Login
                </button>
                <button
                  onClick={() => {
                    if (loginMode === "parent") {
                      setParentStep("choice");
                    } else {
                      setLoginMode("none");
                    }
                    setMsg("");
                  }}
                  style={btnGhost()}
                >
                  Back
                </button>
              </>
            )}
          </div>
        )}

        {msg && (
          <div style={{ marginTop: 12, padding: 10, borderRadius: 14, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(255,255,255,0.10)" }}>
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}

function wrap(): React.CSSProperties {
  return {
    minHeight: "78vh",
    display: "grid",
    placeItems: "center",
    padding: "30px 12px",
    position: "relative",
    overflow: "hidden",
  };
}

function card(): React.CSSProperties {
  return {
    width: "min(460px, 92vw)",
    borderRadius: 22,
    padding: 18,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.58)",
    backdropFilter: "blur(16px)",
    boxShadow: "0 18px 70px rgba(0,0,0,0.60)",
    display: "grid",
    justifyItems: "center",
    textAlign: "center",
    position: "relative",
    zIndex: 2,
  };
}

function inp(): React.CSSProperties {
  return {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    outline: "none",
    fontSize: 14,
  };
}

function btn(): React.CSSProperties {
  return {
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "linear-gradient(90deg, rgba(124,58,237,0.95), rgba(59,130,246,0.80), rgba(34,197,94,0.65))",
    color: "white",
    fontWeight: 1000,
    cursor: "pointer",
    fontSize: 14,
  };
}

function btnGhost(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 14,
  };
}

function choiceCard(): React.CSSProperties {
  return {
    padding: "14px 16px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.45)",
    color: "white",
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    gap: 12,
    cursor: "pointer",
    fontSize: 16,
  };
}

function choiceEmoji(): React.CSSProperties {
  return {
    width: 42,
    height: 42,
    borderRadius: 12,
    display: "grid",
    placeItems: "center",
    background: "rgba(255,255,255,0.10)",
    fontSize: 20,
  };
}

function choiceLabel(): React.CSSProperties {
  return {
    letterSpacing: 0.4,
  };
}

function bgCss() {
  return `
    .bgOrb, .bgOrb2{
      position: absolute;
      inset: -30%;
      z-index: 0;
      filter: blur(12px);
      opacity: 0.9;
      transform: translateZ(0);
      pointer-events:none;
    }
    .bgOrb{
      background:
        radial-gradient(circle at 18% 30%, rgba(124,58,237,0.28), transparent 45%),
        radial-gradient(circle at 75% 35%, rgba(59,130,246,0.24), transparent 42%),
        radial-gradient(circle at 55% 82%, rgba(34,197,94,0.14), transparent 45%);
      animation: drift 10s ease-in-out infinite alternate;
    }
    .bgOrb2{
      background:
        radial-gradient(circle at 30% 70%, rgba(255,255,255,0.10), transparent 45%),
        radial-gradient(circle at 80% 75%, rgba(124,58,237,0.10), transparent 48%);
      animation: drift2 12s ease-in-out infinite alternate;
      opacity: 0.65;
    }
    @keyframes drift {
      from { transform: translate3d(-18px, -6px, 0) scale(1.03); }
      to   { transform: translate3d(20px, 14px, 0) scale(1.08); }
    }
    @keyframes drift2 {
      from { transform: translate3d(12px, -10px, 0) scale(1.00); }
      to   { transform: translate3d(-18px, 10px, 0) scale(1.06); }
    }
  `;
}

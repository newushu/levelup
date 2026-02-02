"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => supabaseClient(), []);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(hash);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (access_token && refresh_token) {
      supabase.auth
        .setSession({ access_token, refresh_token })
        .then(({ error }) => {
          if (error) setMsg(error.message || "Invalid reset link.");
          setReady(true);
        });
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) setMsg("Reset link is missing or expired.");
      setReady(true);
    });
  }, [supabase]);

  async function submit() {
    setMsg("");
    if (!password.trim()) return setMsg("Enter a new password.");
    if (password.length < 6) return setMsg("Password must be at least 6 characters.");
    if (password !== confirm) return setMsg("Passwords do not match.");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) return setMsg(error.message || "Failed to reset password.");
    setMsg("Password updated. Redirecting to login...");
    window.setTimeout(() => router.replace("/login"), 1200);
  }

  return (
    <main style={page()}>
      <div style={card()}>
        <div style={{ fontSize: 24, fontWeight: 1000 }}>Reset Password</div>
        <div style={{ opacity: 0.75, marginTop: 6 }}>Enter a new password for your account.</div>

        <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            style={input()}
            disabled={!ready || saving}
          />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm password"
            style={input()}
            disabled={!ready || saving}
          />
          {msg ? <div style={{ fontSize: 12, opacity: 0.75 }}>{msg}</div> : null}
          <button onClick={submit} style={btn()} disabled={!ready || saving}>
            {saving ? "Saving..." : "Update Password"}
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
    width: "min(420px, 92vw)",
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

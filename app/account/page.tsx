"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "../../lib/supabase/client";

export default function AccountPage() {
  const supabase = useMemo(() => supabaseClient(), []);
  const [email, setEmail] = useState<string>("(loading...)");
  const [userId, setUserId] = useState<string>("(loading...)");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        setEmail("(not logged in)");
        setUserId("-");
        return;
      }
      setEmail(data.user.email || "(no email)");
      setUserId(data.user.id);
    })();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div style={{ padding: 18, color: "white" }}>
      <h1 style={{ fontSize: 28, fontWeight: 950 }}>Account</h1>
      <div
        style={{
          marginTop: 12,
          padding: 14,
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(255,255,255,0.06)",
          maxWidth: 720,
        }}
      >
        <div><b>Email:</b> {email}</div>
        <div style={{ marginTop: 8 }}><b>User ID:</b> {userId}</div>

        <button
          onClick={signOut}
          style={{
            marginTop: 14,
            padding: "10px 12px",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,80,80,0.18)",
            color: "white",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

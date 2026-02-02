"use client";

import { useEffect } from "react";
import { supabaseClient } from "../../lib/supabase/client";

export default function LogoutPage() {
  useEffect(() => {
    (async () => {
      const supabase = supabaseClient();
      await supabase.auth.signOut();
      window.location.href = "/";
    })();
  }, []);

  return <div style={{ padding: 18, opacity: 0.85 }}>Logging out…</div>;
}

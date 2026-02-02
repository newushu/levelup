"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type OverlaySettings = {
  show_admin: boolean;
  show_coach: boolean;
  show_student: boolean;
  show_classroom: boolean;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status})` } };
  }
}

export default function BadgeOverlayAdminPage() {
  const [settings, setSettings] = useState<OverlaySettings>({
    show_admin: true,
    show_coach: true,
    show_student: true,
    show_classroom: false,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/badge-overlay-settings", { cache: "no-store" });
      const sj = await safeJson(res);
      if (!sj.ok) return setMsg(sj.json?.error || "Failed to load overlay settings");
      if (sj.json?.settings) {
        setSettings({
          show_admin: sj.json.settings.show_admin !== false,
          show_coach: sj.json.settings.show_coach !== false,
          show_student: sj.json.settings.show_student !== false,
          show_classroom: sj.json.settings.show_classroom === true,
        });
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/admin/badge-overlay-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const sj = await safeJson(res);
    setSaving(false);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to save settings");
    setSettings({
      show_admin: sj.json.settings.show_admin !== false,
      show_coach: sj.json.settings.show_coach !== false,
      show_student: sj.json.settings.show_student !== false,
      show_classroom: sj.json.settings.show_classroom === true,
    });
  }

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 1000 }}>Badge Overlay Access</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            Control which account types see badge overlays across the app (excluding Display pages).
          </div>
        </div>
        <Link href="/admin/custom" style={backLink()}>
          Back to Admin Custom
        </Link>
      </div>

      {msg ? <div style={{ color: "#fca5a5", fontSize: 12 }}>{msg}</div> : null}

      <div style={card()}>
        <div style={{ display: "grid", gap: 10 }}>
          {[
            { key: "show_admin", label: "Admins" },
            { key: "show_coach", label: "Coaches" },
            { key: "show_student", label: "Students" },
            { key: "show_classroom", label: "Classroom accounts" },
          ].map((row) => (
            <label key={row.key} style={checkboxRow()}>
              <input
                type="checkbox"
                checked={(settings as any)[row.key] === true}
                onChange={(e) => setSettings((prev) => ({ ...prev, [row.key]: e.target.checked }))}
              />
              <span>{row.label}</span>
            </label>
          ))}
        </div>

        <div style={{ marginTop: 12 }}>
          <button onClick={save} disabled={saving} style={btn()}>
            {saving ? "Saving..." : "Save Overlay Access"}
          </button>
        </div>
      </div>
    </main>
  );
}

function card(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
  };
}

function checkboxRow(): React.CSSProperties {
  return { display: "flex", alignItems: "center", gap: 10, fontWeight: 900 };
}

function btn(): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "linear-gradient(90deg, rgba(34,197,94,0.25), rgba(59,130,246,0.25))",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function backLink(): React.CSSProperties {
  return { color: "white", textDecoration: "underline", fontSize: 12 };
}

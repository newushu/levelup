"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SeasonSettings = {
  id?: number;
  name?: string | null;
  start_date?: string | null;
  weeks?: number | null;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status})` } };
  }
}

export default function SeasonAdminPage() {
  const [settings, setSettings] = useState<SeasonSettings>({});
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/season-settings", { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to load season settings");
    setSettings((sj.json?.settings ?? {}) as SeasonSettings);
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/admin/season-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: settings.name ?? "Season",
        start_date: settings.start_date ?? null,
        weeks: settings.weeks ?? 10,
      }),
    });
    const sj = await safeJson(res);
    setSaving(false);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to save season settings");
    setSettings((sj.json?.settings ?? {}) as SeasonSettings);
    setMsg("Saved.");
    window.setTimeout(() => setMsg(""), 1800);
  }

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 1000 }}>Season Settings</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Configure the semester start and duration for rule breakers.</div>
        </div>
        <Link href="/admin/custom" style={{ color: "white", textDecoration: "underline", fontSize: 12 }}>
          Back to Admin Custom
        </Link>
      </div>

      {msg ? <div style={notice()}>{msg}</div> : null}

      <div style={card()}>
        <label style={label()}>
          Season name
          <input
            value={settings.name ?? ""}
            onChange={(e) => setSettings((prev) => ({ ...prev, name: e.target.value }))}
            style={input()}
          />
        </label>
        <label style={label()}>
          Start date
          <input
            type="date"
            value={settings.start_date ?? ""}
            onChange={(e) => setSettings((prev) => ({ ...prev, start_date: e.target.value }))}
            style={input()}
          />
        </label>
        <label style={label()}>
          Weeks in season
          <input
            type="number"
            min={1}
            max={52}
            value={settings.weeks ?? 10}
            onChange={(e) => setSettings((prev) => ({ ...prev, weeks: Number(e.target.value) }))}
            style={input()}
          />
        </label>
        <button onClick={save} style={btn()} disabled={saving}>
          Save season
        </button>
      </div>
    </main>
  );
}

function card(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    display: "grid",
    gap: 10,
    maxWidth: 420,
  };
}

function label(): React.CSSProperties {
  return { display: "grid", gap: 6, fontSize: 12, fontWeight: 900 };
}

function input(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.25)",
    color: "white",
    outline: "none",
  };
}

function btn(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "linear-gradient(90deg, rgba(59,130,246,0.90), rgba(34,197,94,0.75))",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function notice(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: "8px 12px",
    border: "1px solid rgba(59,130,246,0.5)",
    background: "rgba(59,130,246,0.12)",
    fontSize: 12,
    fontWeight: 900,
  };
}

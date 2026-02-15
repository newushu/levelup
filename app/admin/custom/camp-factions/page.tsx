"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Faction = { id: string; name: string; color: string; icon: string; enabled: boolean; sort_order: number };

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, json: JSON.parse(text) };
  } catch {
    return { ok: false, json: { error: text.slice(0, 220) } };
  }
}

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function CampFactionsPage() {
  const [factions, setFactions] = useState<Faction[]>([]);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🏕️");
  const [color, setColor] = useState("#38bdf8");
  const [msg, setMsg] = useState("");

  async function load() {
    const res = await fetch("/api/camp/display-roster", { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(String(sj.json?.error ?? "Failed to load"));
    setFactions((sj.json?.factions ?? []) as Faction[]);
  }

  useEffect(() => { load(); }, []);

  async function save(next: Faction[]) {
    const res = await fetch("/api/camp/display-roster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ factions: next }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(String(sj.json?.error ?? "Failed to save factions"));
    setMsg("Factions saved.");
    await load();
  }

  return (
    <main style={{ padding: 16, display: "grid", gap: 12, maxWidth: 900 }}>
      <Link href="/admin/custom/camp-display" style={{ fontSize: 12, fontWeight: 900, opacity: 0.8 }}>Back to Camp Display Builder</Link>
      <div style={{ fontSize: 30, fontWeight: 1000 }}>Camp Factions</div>
      <div style={{ opacity: 0.76 }}>Create factions now. Rules/features can be added later.</div>
      {msg ? <div style={{ borderRadius: 10, border: "1px solid rgba(125,211,252,0.35)", background: "rgba(8,47,73,0.42)", padding: "8px 10px", fontWeight: 900 }}>{msg}</div> : null}

      <section style={{ borderRadius: 12, border: "1px solid rgba(148,163,184,0.3)", background: "rgba(2,6,23,0.6)", padding: 10, display: "grid", gap: 8 }}>
        <div style={{ fontWeight: 900 }}>Add Faction</div>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "minmax(0,1fr) 100px 120px auto" }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Faction name" style={inp()} />
          <input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="Icon" style={inp()} />
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ ...inp(), padding: 4 }} />
          <button
            type="button"
            style={btn()}
            onClick={() => {
              const n = name.trim();
              if (!n) return;
              const next = [...factions, { id: uid(), name: n, color, icon: icon || "🏕️", enabled: true, sort_order: factions.length }];
              setFactions(next);
              setName("");
              save(next);
            }}
          >
            Add
          </button>
        </div>
      </section>

      <section style={{ display: "grid", gap: 8 }}>
        {factions.map((f, idx) => (
          <div key={f.id} style={{ borderRadius: 12, border: "1px solid rgba(148,163,184,0.3)", background: "rgba(15,23,42,0.62)", padding: 10, display: "grid", gap: 8, gridTemplateColumns: "minmax(0,1fr) 100px 120px auto auto" }}>
            <input value={f.name} onChange={(e) => setFactions((prev) => prev.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))} style={inp()} />
            <input value={f.icon} onChange={(e) => setFactions((prev) => prev.map((x, i) => (i === idx ? { ...x, icon: e.target.value } : x)))} style={inp()} />
            <input type="color" value={f.color || "#38bdf8"} onChange={(e) => setFactions((prev) => prev.map((x, i) => (i === idx ? { ...x, color: e.target.value } : x)))} style={{ ...inp(), padding: 4 }} />
            <button type="button" style={btn()} onClick={() => save(factions)}>Save</button>
            <button type="button" style={dangerBtn()} onClick={() => {
              const next = factions.filter((x) => x.id !== f.id);
              setFactions(next);
              save(next);
            }}>Remove</button>
          </div>
        ))}
      </section>
    </main>
  );
}

function inp(): React.CSSProperties {
  return { borderRadius: 9, border: "1px solid rgba(148,163,184,0.35)", background: "rgba(2,6,23,0.65)", color: "white", padding: "8px 10px" };
}
function btn(): React.CSSProperties {
  return { borderRadius: 9, border: "1px solid rgba(56,189,248,0.5)", background: "rgba(14,165,233,0.2)", color: "white", padding: "8px 10px", fontWeight: 900 };
}
function dangerBtn(): React.CSSProperties {
  return { borderRadius: 9, border: "1px solid rgba(239,68,68,0.52)", background: "rgba(239,68,68,0.16)", color: "white", padding: "8px 10px", fontWeight: 900 };
}

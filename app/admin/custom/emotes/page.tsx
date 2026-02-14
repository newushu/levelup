"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Emote = {
  id: string;
  emote_key: string;
  label: string;
  emoji: string;
  image_url?: string | null;
  html?: string | null;
  css?: string | null;
  js?: string | null;
  points_cost: number;
  unlock_level: number;
  enabled: boolean;
  is_default: boolean;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: text.slice(0, 200) } };
  }
}

export default function EmotesAdminPage() {
  const [rows, setRows] = useState<Emote[]>([]);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState<Partial<Emote>>({
    emote_key: "",
    label: "",
    emoji: "✨",
    image_url: "",
    html: "",
    css: "",
    js: "",
    points_cost: 0,
    unlock_level: 1,
    enabled: true,
    is_default: false,
  });

  async function load() {
    const res = await fetch("/api/admin/emotes", { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(String(sj.json?.error ?? "Failed to load"));
    setRows((sj.json?.emotes ?? []) as Emote[]);
  }

  useEffect(() => {
    load();
  }, []);

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    setMsg("");
    const res = await fetch("/api/admin/emotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(String(sj.json?.error ?? "Failed to save"));
    setMsg("Saved emote.");
    setForm({ emote_key: "", label: "", emoji: "✨", image_url: "", html: "", css: "", js: "", points_cost: 0, unlock_level: 1, enabled: true, is_default: false });
    load();
  }

  return (
    <div style={{ padding: 16, display: "grid", gap: 14 }}>
      <Link href="/admin/custom" style={{ fontWeight: 900, fontSize: 12, opacity: 0.8 }}>
        Back to Admin Custom
      </Link>
      <div style={{ fontSize: 24, fontWeight: 1000 }}>Classroom Emotes</div>
      <div style={{ opacity: 0.78, fontSize: 12 }}>Set unlock level, point cost, and visual payload for check-in emotes.</div>
      {msg ? <div style={{ fontWeight: 900 }}>{msg}</div> : null}

      <form onSubmit={save} style={{ display: "grid", gap: 8, maxWidth: 980 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 8 }}>
          <input placeholder="key" value={String(form.emote_key ?? "")} onChange={(e) => setForm((p) => ({ ...p, emote_key: e.target.value }))} style={inp()} />
          <input placeholder="label" value={String(form.label ?? "")} onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))} style={inp()} />
          <input placeholder="emoji" value={String(form.emoji ?? "")} onChange={(e) => setForm((p) => ({ ...p, emoji: e.target.value }))} style={inp()} />
          <input placeholder="image url" value={String(form.image_url ?? "")} onChange={(e) => setForm((p) => ({ ...p, image_url: e.target.value }))} style={inp()} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8 }}>
          <input type="number" placeholder="points cost" value={Number(form.points_cost ?? 0)} onChange={(e) => setForm((p) => ({ ...p, points_cost: Number(e.target.value || 0) }))} style={inp()} />
          <input type="number" placeholder="unlock level" value={Number(form.unlock_level ?? 1)} onChange={(e) => setForm((p) => ({ ...p, unlock_level: Number(e.target.value || 1) }))} style={inp()} />
        </div>
        <textarea placeholder="html (optional)" value={String(form.html ?? "")} onChange={(e) => setForm((p) => ({ ...p, html: e.target.value }))} style={area()} />
        <textarea placeholder="css (optional)" value={String(form.css ?? "")} onChange={(e) => setForm((p) => ({ ...p, css: e.target.value }))} style={area()} />
        <textarea placeholder="js (optional)" value={String(form.js ?? "")} onChange={(e) => setForm((p) => ({ ...p, js: e.target.value }))} style={area()} />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={Boolean(form.enabled ?? true)} onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))} /> Enabled
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={Boolean(form.is_default ?? false)} onChange={(e) => setForm((p) => ({ ...p, is_default: e.target.checked }))} /> Default
          </label>
          <button type="submit" style={btn()}>Save Emote</button>
        </div>
      </form>

      <div style={{ display: "grid", gap: 8 }}>
        {rows.map((r) => (
          <button key={r.id} onClick={() => setForm(r)} style={{ textAlign: "left", borderRadius: 12, border: "1px solid rgba(148,163,184,0.26)", padding: 10, background: "rgba(15,23,42,0.65)", color: "white" }}>
            <div style={{ fontWeight: 1000 }}>{r.emoji} {r.label} ({r.emote_key})</div>
            <div style={{ opacity: 0.76, fontSize: 12 }}>Cost {r.points_cost} • Unlock Lv {r.unlock_level} • {r.enabled ? "Enabled" : "Disabled"}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function inp(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(148,163,184,0.35)", background: "rgba(2,6,23,0.6)", color: "white" };
}
function area(): React.CSSProperties {
  return { minHeight: 82, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(148,163,184,0.35)", background: "rgba(2,6,23,0.6)", color: "white" };
}
function btn(): React.CSSProperties {
  return { borderRadius: 10, padding: "8px 12px", border: "1px solid rgba(56,189,248,0.5)", background: "rgba(14,165,233,0.28)", color: "white", fontWeight: 900 };
}

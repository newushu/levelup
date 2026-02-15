"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Emote = {
  id: string;
  emote_key: string;
  label: string;
  emoji: string;
  image_url?: string | null;
  html?: string | null;
  css?: string | null;
  js?: string | null;
  scale?: number;
  duration_ms?: number;
  points_cost: number;
  unlock_level: number;
  enabled: boolean;
  is_default: boolean;
  code_bundle?: string;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: text.slice(0, 200) } };
  }
}

function buildEmoteSrcDoc(html?: string | null, css?: string | null, js?: string | null) {
  const bodyHtml = String(html ?? "");
  const styleCss = String(css ?? "");
  const scriptJs = String(js ?? "");
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: transparent;
    }
    * { box-sizing: border-box; }
  </style>
  <style>${styleCss}</style>
</head>
<body>
  ${bodyHtml}
  ${scriptJs ? `<script>${scriptJs}<\/script>` : ""}
</body>
</html>`;
}

function parseCombinedCode(raw: string) {
  const input = String(raw ?? "");
  if (!input.trim()) return { html: "", css: "", js: "" };
  let css = "";
  let js = "";
  let html = input;
  html = html.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_, body: string) => {
    css += `${body}\n`;
    return "";
  });
  html = html.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (_, body: string) => {
    js += `${body}\n`;
    return "";
  });
  html = html.replace(/<!doctype[^>]*>/gi, "");
  html = html.replace(/<head[\s\S]*?<\/head>/gi, "");
  html = html.replace(/<\/?html[^>]*>/gi, "");
  html = html.replace(/<\/?body[^>]*>/gi, "");
  return { html: html.trim(), css: css.trim(), js: js.trim() };
}

export default function EmotesAdminPage() {
  const [rows, setRows] = useState<Emote[]>([]);
  const [msg, setMsg] = useState("");
  const [previewActive, setPreviewActive] = useState(false);
  const [previewRunKey, setPreviewRunKey] = useState(0);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [form, setForm] = useState<Partial<Emote>>({
    emote_key: "",
    label: "",
    emoji: "✨",
    image_url: "",
    html: "",
    css: "",
    js: "",
    scale: 1,
    duration_ms: 3000,
    points_cost: 0,
    unlock_level: 1,
    enabled: true,
    is_default: false,
    code_bundle: "",
  });

  function combineCode(html?: string | null, css?: string | null, js?: string | null) {
    const h = String(html ?? "").trim();
    const c = String(css ?? "").trim();
    const j = String(js ?? "").trim();
    const out: string[] = [];
    if (h) out.push(h);
    if (c) out.push(`<style>\n${c}\n</style>`);
    if (j) out.push(`<script>\n${j}\n</script>`);
    return out.join("\n\n");
  }

  const previewParsed = parseCombinedCode(String(form.code_bundle ?? ""));
  const previewHtml = String(form.code_bundle ?? "").trim() ? previewParsed.html : String(form.html ?? "");
  const previewCss = String(form.code_bundle ?? "").trim() ? previewParsed.css : String(form.css ?? "");
  const previewJs = String(form.code_bundle ?? "").trim() ? previewParsed.js : String(form.js ?? "");
  const previewDurationMs = Math.max(500, Math.min(20000, Number(form.duration_ms ?? 3000) || 3000));

  async function load() {
    const res = await fetch("/api/admin/emotes", { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(String(sj.json?.error ?? "Failed to load"));
    const next = (sj.json?.emotes ?? []).map((row: Emote) => ({
      ...row,
      code_bundle: combineCode(row.html, row.css, row.js),
    }));
    setRows(next as Emote[]);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
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
    setForm({
      emote_key: "",
      label: "",
      emoji: "✨",
      image_url: "",
      html: "",
      css: "",
      js: "",
      scale: 1,
      duration_ms: 3000,
      code_bundle: "",
      points_cost: 0,
      unlock_level: 1,
      enabled: true,
      is_default: false,
    });
    load();
  }

  function playPreview() {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    setPreviewRunKey((k) => k + 1);
    setPreviewActive(true);
    previewTimerRef.current = setTimeout(() => {
      setPreviewActive(false);
    }, previewDurationMs);
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8 }}>
          <input
            type="number"
            step="0.1"
            min="0.2"
            max="4"
            placeholder="scale (1.0)"
            value={Number(form.scale ?? 1)}
            onChange={(e) => setForm((p) => ({ ...p, scale: Number(e.target.value || 1) }))}
            style={inp()}
          />
          <input
            type="number"
            min="500"
            max="20000"
            step="100"
            placeholder="duration ms (3000)"
            value={Number(form.duration_ms ?? 3000)}
            onChange={(e) => setForm((p) => ({ ...p, duration_ms: Number(e.target.value || 3000) }))}
            style={inp()}
          />
        </div>
        <textarea
          placeholder={"Combined code (optional): paste HTML, <style>...</style>, and <script>...</script> together"}
          value={String(form.code_bundle ?? "")}
          onChange={(e) =>
            setForm((p) => ({
              ...p,
              code_bundle: e.target.value,
            }))
          }
          style={{ ...area(), minHeight: 180 }}
        />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={Boolean(form.enabled ?? true)} onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))} /> Enabled
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={Boolean(form.is_default ?? false)} onChange={(e) => setForm((p) => ({ ...p, is_default: e.target.checked }))} /> Default
          </label>
          <button type="submit" style={btn()}>Save Emote</button>
          <button type="button" style={btn()} onClick={playPreview}>Preview Play</button>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.85 }}>Preview (centered)</div>
          <div
            style={{
              height: 320,
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.35)",
              background: "radial-gradient(circle at center, rgba(15,23,42,0.9), rgba(2,6,23,0.98))",
              overflow: "hidden",
              position: "relative",
              display: "grid",
              placeItems: "center",
            }}
          >
            <div
              style={{
                width: 260,
                height: 260,
                transform: `scale(${Math.max(0.2, Math.min(4, Number(form.scale ?? 1) || 1))})`,
                transformOrigin: "center center",
                borderRadius: 12,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.18)",
                background: "transparent",
              }}
            >
              {previewActive ? (
                <iframe
                  key={previewRunKey}
                  title="emote-preview"
                  srcDoc={buildEmoteSrcDoc(previewHtml, previewCss, previewJs)}
                  sandbox="allow-scripts"
                  style={{ width: "100%", height: "100%", border: "none", background: "transparent", pointerEvents: "none" }}
                />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: "rgba(226,232,240,0.72)", fontWeight: 900 }}>
                  Press Preview Play
                </div>
              )}
            </div>
          </div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Duration on check-in popup: {previewDurationMs} ms.
          </div>
        </div>
      </form>

      <div style={{ display: "grid", gap: 8 }}>
        {rows.map((r) => (
          <button
            key={r.id}
            onClick={() =>
              setForm({
                ...r,
                code_bundle: combineCode(r.html, r.css, r.js),
              })
            }
            style={{ textAlign: "left", borderRadius: 12, border: "1px solid rgba(148,163,184,0.26)", padding: 10, background: "rgba(15,23,42,0.65)", color: "white" }}
          >
            <div style={{ fontWeight: 1000 }}>{r.emoji} {r.label} ({r.emote_key})</div>
            <div style={{ opacity: 0.76, fontSize: 12 }}>
              Cost {r.points_cost} • Unlock Lv {r.unlock_level} • Scale {Number(r.scale ?? 1).toFixed(1)} • {Math.max(500, Math.min(20000, Number(r.duration_ms ?? 3000) || 3000))} ms • {r.enabled ? "Enabled" : "Disabled"}
            </div>
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

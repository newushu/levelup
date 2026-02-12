"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type TemplatePayload = {
  theme: string;
  discount_amount: string;
  discount_date: string;
  offer_title: string;
  offer_for: string;
  cta_text: string;
  cta_url: string;
  logo_url: string;
  logo_x: number;
  logo_y: number;
  logo_box_size: number;
  logo_image_scale: number;
  logo_invert: boolean;
  badge_x: number;
  badge_y: number;
  badge_scale: number;
  offer_x: number;
  offer_y: number;
  offer_scale: number;
  cta_x: number;
  cta_y: number;
  cta_scale: number;
};

type MarketingRow = {
  id?: string;
  title: string | null;
  message: string | null;
  image_url: string | null;
  image_preview_url?: string | null;
  image_scale?: number | null;
  image_x?: number | null;
  image_y?: number | null;
  image_rotate?: number | null;
  border_style?: string | null;
  border_color?: string | null;
  template_key?: string | null;
  template_payload?: Record<string, any> | null;
  enabled: boolean;
  created_at?: string | null;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status})` } };
  }
}

const emptyDraft: MarketingRow = {
  title: "",
  message: "",
  image_url: "",
  image_scale: 1,
  image_x: 0,
  image_y: 0,
  image_rotate: 0,
  border_style: "clean",
  border_color: "",
  template_key: null,
  template_payload: null,
  enabled: true,
};

const defaultTemplatePayload = {
  theme: "winter",
  discount_amount: "25% OFF",
  discount_date: "Ends Dec 20",
  offer_title: "What's it for",
  offer_for: "Winter Enrollment Pass",
  cta_text: "Enroll Now",
  cta_url: "https://",
  logo_url: "",
  logo_x: 18,
  logo_y: 18,
  logo_box_size: 70,
  logo_image_scale: 1,
  logo_invert: false,
  badge_x: 18,
  badge_y: 120,
  badge_scale: 1,
  offer_x: 18,
  offer_y: 260,
  offer_scale: 1,
  cta_x: 18,
  cta_y: 310,
  cta_scale: 1,
};

function normalizeTemplatePayload(row: MarketingRow): TemplatePayload {
  const payload = (row.template_payload ?? {}) as Partial<TemplatePayload>;
  return {
    ...defaultTemplatePayload,
    ...payload,
  };
}

function updateTemplatePayload(row: MarketingRow, patch: Partial<TemplatePayload>): MarketingRow {
  return { ...row, template_payload: { ...normalizeTemplatePayload(row), ...patch } };
}

export function MarketingAdminPanel({ embedded = false }: { embedded?: boolean }) {
  const [pinOk, setPinOk] = useState(false);
  const [rows, setRows] = useState<MarketingRow[]>([]);
  const [draft, setDraft] = useState<MarketingRow>(emptyDraft);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draftPreviewUrl, setDraftPreviewUrl] = useState("");
  const [academyLogoUrl, setAcademyLogoUrl] = useState("");
  const draftPayload = normalizeTemplatePayload(draft);
  const draftPreset = draft.template_key === "enroll_now";

  useEffect(() => {
    if (typeof window !== "undefined") {
      const ok = window.sessionStorage.getItem("admin_pin_ok") === "1";
      if (!ok) {
        window.location.href = "/admin";
        return;
      }
      setPinOk(true);
    }
  }, []);

  async function load() {
    const res = await fetch("/api/admin/marketing/list", { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to load announcements");
    setRows((sj.json?.announcements ?? []) as MarketingRow[]);
  }

  useEffect(() => {
    if (!pinOk) return;
    load();
  }, [pinOk]);

  useEffect(() => {
    if (!pinOk) return;
    (async () => {
      const res = await fetch("/api/public/nav-logo", { cache: "no-store" });
      const sj = await safeJson(res);
      if (!sj.ok) return;
      setAcademyLogoUrl(String(sj.json?.logo_url ?? ""));
    })();
  }, [pinOk]);

  async function saveRow(row: MarketingRow) {
    setSaving(true);
    const res = await fetch("/api/admin/marketing/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
    const sj = await safeJson(res);
    if (!sj.ok) {
      setSaving(false);
      return setMsg(sj.json?.error || "Failed to save announcement");
    }
    await load();
    setSaving(false);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  async function uploadImage(file: File | null, target: { type: "draft" | "row"; id?: string }) {
    if (!file) return;
    setUploading(true);
    const data = new FormData();
    data.append("file", file);
    const res = await fetch("/api/admin/marketing/upload", { method: "POST", body: data });
    const sj = await safeJson(res);
    setUploading(false);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to upload image");
    const path = String(sj.json?.path ?? "");
    const signedUrl = String(sj.json?.signed_url ?? "");
    if (!path) return setMsg("Missing uploaded image path");
    if (target.type === "draft") {
      setDraft((prev) => ({ ...prev, image_url: path }));
      setDraftPreviewUrl(signedUrl);
    } else if (target.id) {
      setRows((prev) =>
        prev.map((row) =>
          row.id === target.id ? { ...row, image_url: path, image_preview_url: signedUrl } : row
        )
      );
    }
  }

  if (!pinOk) return null;

  const Container: any = embedded ? "div" : "main";

  return (
    <Container style={{ display: "grid", gap: 16 }}>
      {!embedded ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 1000 }}>Marketing Hub</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>
              Control the home page announcements and promotional visuals.
            </div>
          </div>
          <Link href="/admin/custom" style={backLink()}>
            Return to Admin Workspace
          </Link>
        </div>
      ) : null}

      {msg ? <div style={notice()}>{msg}</div> : null}

      <div style={card()}>
        <div style={{ fontWeight: 1000, fontSize: 14 }}>Add Announcement</div>
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          <input
            value={draft.title ?? ""}
            onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Announcement title"
            style={input()}
          />
          <textarea
            value={draft.message ?? ""}
            onChange={(e) => setDraft((prev) => ({ ...prev, message: e.target.value }))}
            placeholder="Announcement message"
            style={textarea()}
          />
          <select
            value={draftPreset ? "preset" : "image"}
            onChange={(e) => {
              const mode = e.target.value;
              if (mode === "preset") {
                setDraft((prev) => ({
                  ...prev,
                  template_key: "enroll_now",
                  template_payload: normalizeTemplatePayload(prev),
                }));
              } else {
                setDraft((prev) => ({ ...prev, template_key: null }));
              }
            }}
            style={select()}
          >
            <option value="image">Image Upload</option>
            <option value="preset">Preset: Enroll Now</option>
          </select>
          {!draftPreset ? (
            <>
              <input
                value={draft.image_url ?? ""}
                onChange={(e) => setDraft((prev) => ({ ...prev, image_url: e.target.value }))}
                placeholder="Image URL (optional)"
                style={input()}
              />
              <label style={uploadLabel()}>
                <span>Upload image</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => uploadImage(e.target.files?.[0] ?? null, { type: "draft" })}
                  style={{ display: "none" }}
                />
              </label>
              <div style={controlGrid()}>
                <label style={controlLabel()}>Image scale</label>
                <input
                  type="range"
                  min="0.6"
                  max="2"
                  step="0.05"
                  value={Number(draft.image_scale ?? 1)}
                  onChange={(e) => setDraft((prev) => ({ ...prev, image_scale: Number(e.target.value) }))}
                />
                <label style={controlLabel()}>Image X</label>
                <input
                  type="range"
                  min="-80"
                  max="80"
                  step="2"
                  value={Number(draft.image_x ?? 0)}
                  onChange={(e) => setDraft((prev) => ({ ...prev, image_x: Number(e.target.value) }))}
                />
                <label style={controlLabel()}>Image Y</label>
                <input
                  type="range"
                  min="-80"
                  max="80"
                  step="2"
                  value={Number(draft.image_y ?? 0)}
                  onChange={(e) => setDraft((prev) => ({ ...prev, image_y: Number(e.target.value) }))}
                />
                <label style={controlLabel()}>Rotate</label>
                <input
                  type="range"
                  min="-30"
                  max="30"
                  step="1"
                  value={Number(draft.image_rotate ?? 0)}
                  onChange={(e) => setDraft((prev) => ({ ...prev, image_rotate: Number(e.target.value) }))}
                />
              </div>
            </>
          ) : null}
          {draftPreset ? (
            <div style={controlGrid()}>
              <label style={controlLabel()}>Theme</label>
              <select
                value={draftPayload.theme}
                onChange={(e) => setDraft((prev) => updateTemplatePayload(prev, { theme: e.target.value }))}
                style={select()}
              >
                <option value="winter">Winter</option>
                <option value="royal">Royal</option>
                <option value="sunset">Sunset</option>
                <option value="mint">Mint</option>
              </select>
              <label style={controlLabel()}>Discount amount</label>
              <input
                value={draftPayload.discount_amount}
                onChange={(e) => setDraft((prev) => updateTemplatePayload(prev, { discount_amount: e.target.value }))}
                style={input()}
              />
              <label style={controlLabel()}>Discount date</label>
              <input
                value={draftPayload.discount_date}
                onChange={(e) => setDraft((prev) => updateTemplatePayload(prev, { discount_date: e.target.value }))}
                style={input()}
              />
              <label style={controlLabel()}>Offer title</label>
              <input
                value={draftPayload.offer_title}
                onChange={(e) => setDraft((prev) => updateTemplatePayload(prev, { offer_title: e.target.value }))}
                style={input()}
              />
              <label style={controlLabel()}>What it&apos;s for</label>
              <input
                value={draftPayload.offer_for}
                onChange={(e) => setDraft((prev) => updateTemplatePayload(prev, { offer_for: e.target.value }))}
                style={input()}
              />
              <label style={controlLabel()}>CTA text</label>
              <input
                value={draftPayload.cta_text}
                onChange={(e) => setDraft((prev) => updateTemplatePayload(prev, { cta_text: e.target.value }))}
                style={input()}
              />
              <label style={controlLabel()}>CTA URL</label>
              <input
                value={draftPayload.cta_url}
                onChange={(e) => setDraft((prev) => updateTemplatePayload(prev, { cta_url: e.target.value }))}
                style={input()}
              />
              <label style={controlLabel()}>Logo URL</label>
              <input
                value={draftPayload.logo_url}
                onChange={(e) => setDraft((prev) => updateTemplatePayload(prev, { logo_url: e.target.value }))}
                placeholder="Leave blank to use academy logo"
                style={input()}
              />
              <label style={controlLabel()}>Logo box size</label>
              <input
                type="range"
                min="36"
                max="140"
                step="2"
                value={Number(draftPayload.logo_box_size)}
                onChange={(e) =>
                  setDraft((prev) => updateTemplatePayload(prev, { logo_box_size: Number(e.target.value) }))
                }
              />
              <label style={controlLabel()}>Logo image scale</label>
              <input
                type="range"
                min="0.6"
                max="1.6"
                step="0.05"
                value={Number(draftPayload.logo_image_scale)}
                onChange={(e) =>
                  setDraft((prev) => updateTemplatePayload(prev, { logo_image_scale: Number(e.target.value) }))
                }
              />
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, opacity: 0.8 }}>
                <input
                  type="checkbox"
                  checked={Boolean(draftPayload.logo_invert)}
                  onChange={(e) => setDraft((prev) => updateTemplatePayload(prev, { logo_invert: e.target.checked }))}
                />
                Invert logo colors
              </label>
              <label style={controlLabel()}>Logo X</label>
              <input
                type="range"
                min="-40"
                max="160"
                step="2"
                value={Number(draftPayload.logo_x)}
                onChange={(e) => setDraft((prev) => updateTemplatePayload(prev, { logo_x: Number(e.target.value) }))}
              />
              <label style={controlLabel()}>Logo Y</label>
              <input
                type="range"
                min="-20"
                max="200"
                step="2"
                value={Number(draftPayload.logo_y)}
                onChange={(e) => setDraft((prev) => updateTemplatePayload(prev, { logo_y: Number(e.target.value) }))}
              />
              <label style={controlLabel()}>Badge scale</label>
              <input
                type="range"
                min="0.8"
                max="1.6"
                step="0.05"
                value={Number(draftPayload.badge_scale)}
                onChange={(e) => setDraft((prev) => updateTemplatePayload(prev, { badge_scale: Number(e.target.value) }))}
              />
              <label style={controlLabel()}>Badge X</label>
              <input
                type="range"
                min="-20"
                max="200"
                step="2"
                value={Number(draftPayload.badge_x)}
                onChange={(e) => setDraft((prev) => updateTemplatePayload(prev, { badge_x: Number(e.target.value) }))}
              />
              <label style={controlLabel()}>Badge Y</label>
              <input
                type="range"
                min="60"
                max="260"
                step="2"
                value={Number(draftPayload.badge_y)}
                onChange={(e) => setDraft((prev) => updateTemplatePayload(prev, { badge_y: Number(e.target.value) }))}
              />
              <label style={controlLabel()}>Offer scale</label>
              <input
                type="range"
                min="0.8"
                max="1.6"
                step="0.05"
                value={Number(draftPayload.offer_scale)}
                onChange={(e) =>
                  setDraft((prev) => updateTemplatePayload(prev, { offer_scale: Number(e.target.value) }))
                }
              />
              <label style={controlLabel()}>Offer X</label>
              <input
                type="range"
                min="-10"
                max="220"
                step="2"
                value={Number(draftPayload.offer_x)}
                onChange={(e) => setDraft((prev) => updateTemplatePayload(prev, { offer_x: Number(e.target.value) }))}
              />
              <label style={controlLabel()}>Offer Y</label>
              <input
                type="range"
                min="200"
                max="320"
                step="2"
                value={Number(draftPayload.offer_y)}
                onChange={(e) => setDraft((prev) => updateTemplatePayload(prev, { offer_y: Number(e.target.value) }))}
              />
              <label style={controlLabel()}>CTA scale</label>
              <input
                type="range"
                min="0.8"
                max="1.6"
                step="0.05"
                value={Number(draftPayload.cta_scale)}
                onChange={(e) => setDraft((prev) => updateTemplatePayload(prev, { cta_scale: Number(e.target.value) }))}
              />
              <label style={controlLabel()}>CTA X</label>
              <input
                type="range"
                min="-10"
                max="220"
                step="2"
                value={Number(draftPayload.cta_x)}
                onChange={(e) => setDraft((prev) => updateTemplatePayload(prev, { cta_x: Number(e.target.value) }))}
              />
              <label style={controlLabel()}>CTA Y</label>
              <input
                type="range"
                min="240"
                max="360"
                step="2"
                value={Number(draftPayload.cta_y)}
                onChange={(e) => setDraft((prev) => updateTemplatePayload(prev, { cta_y: Number(e.target.value) }))}
              />
            </div>
          ) : null}
          <div style={controlGrid()}>
            <label style={controlLabel()}>Border style</label>
            <select
              value={draft.border_style ?? "clean"}
              onChange={(e) => setDraft((prev) => ({ ...prev, border_style: e.target.value }))}
              style={select()}
            >
              <option value="clean">Clean</option>
              <option value="neon">Neon</option>
              <option value="sunset">Sunset</option>
              <option value="mint">Mint</option>
              <option value="none">None</option>
            </select>
            <label style={controlLabel()}>Border color (optional)</label>
            <input
              value={draft.border_color ?? ""}
              onChange={(e) => setDraft((prev) => ({ ...prev, border_color: e.target.value }))}
              placeholder="#66f or rgba(...)"
              style={input()}
            />
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, opacity: 0.8 }}>
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => setDraft((prev) => ({ ...prev, enabled: e.target.checked }))}
            />
            Enabled
          </label>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={() => {
                saveRow(draft);
                setDraft(emptyDraft);
                setDraftPreviewUrl("");
              }}
              style={btn()}
              disabled={saving || uploading}
            >
              {saving ? "Saving..." : uploading ? "Uploading..." : "Save Announcement"}
            </button>
            {saved ? <div style={savedBadge()}>Saved</div> : null}
          </div>
        </div>
          <div style={previewWrap()}>
            <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.7 }}>Parent Card Preview</div>
            <div style={previewCard(resolveBorder(draft.border_style, draft.border_color))}>
              {draftPreset ? (
                renderEnrollTemplate(draftPayload, academyLogoUrl)
              ) : resolvePreviewUrl(draft.image_url, draftPreviewUrl) ? (
                <div style={previewImageFrame()}>
                  <img
                    src={resolvePreviewUrl(draft.image_url, draftPreviewUrl)}
                    alt="Preview"
                    style={previewImage(draft)}
                  />
                </div>
              ) : null}
              <div style={{ fontWeight: 900 }}>{draft.title || "Parent Spotlight"}</div>
              <div style={{ opacity: 0.75, fontSize: 12 }}>
                {draft.message || "Weekly updates, promos, and family highlights will appear here."}
              </div>
            </div>
          </div>
      </div>

      <div style={gridList()}>
        {rows.map((row) => (
          <div key={row.id} style={card()}>
            {(() => {
              const payload = normalizeTemplatePayload(row);
              const preset = row.template_key === "enroll_now";
              return (
                <>
            <div style={{ display: "grid", gap: 10 }}>
              <input
                value={row.title ?? ""}
                onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, title: e.target.value } : r)))}
                style={input()}
                placeholder="Title"
              />
              <textarea
                value={row.message ?? ""}
                onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, message: e.target.value } : r)))}
                style={textarea()}
                placeholder="Message"
              />
              <select
                value={preset ? "preset" : "image"}
                onChange={(e) => {
                  const mode = e.target.value;
                  if (mode === "preset") {
                    setRows((prev) =>
                      prev.map((r) =>
                        r.id === row.id
                          ? { ...r, template_key: "enroll_now", template_payload: normalizeTemplatePayload(r) }
                          : r
                      )
                    );
                  } else {
                    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, template_key: null } : r)));
                  }
                }}
                style={select()}
              >
                <option value="image">Image Upload</option>
                <option value="preset">Preset: Enroll Now</option>
              </select>
              {!preset ? (
                <>
                  <input
                    value={row.image_url ?? ""}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) => (r.id === row.id ? { ...r, image_url: e.target.value } : r))
                      )
                    }
                    style={input()}
                    placeholder="Image URL (optional)"
                  />
                  <label style={uploadLabel()}>
                    <span>Upload image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => uploadImage(e.target.files?.[0] ?? null, { type: "row", id: row.id })}
                      style={{ display: "none" }}
                    />
                  </label>
                </>
              ) : null}
              {preset ? (
                <div style={controlGrid()}>
                  <label style={controlLabel()}>Theme</label>
                  <select
                    value={payload.theme}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) => (r.id === row.id ? updateTemplatePayload(r, { theme: e.target.value }) : r))
                      )
                    }
                    style={select()}
                  >
                    <option value="winter">Winter</option>
                    <option value="royal">Royal</option>
                    <option value="sunset">Sunset</option>
                    <option value="mint">Mint</option>
                  </select>
                  <label style={controlLabel()}>Discount amount</label>
                  <input
                    value={payload.discount_amount}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) => (r.id === row.id ? updateTemplatePayload(r, { discount_amount: e.target.value }) : r))
                      )
                    }
                    style={input()}
                  />
                  <label style={controlLabel()}>Discount date</label>
                  <input
                    value={payload.discount_date}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) => (r.id === row.id ? updateTemplatePayload(r, { discount_date: e.target.value }) : r))
                      )
                    }
                    style={input()}
                  />
                  <label style={controlLabel()}>Offer title</label>
                  <input
                    value={payload.offer_title}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) => (r.id === row.id ? updateTemplatePayload(r, { offer_title: e.target.value }) : r))
                      )
                    }
                    style={input()}
                  />
                  <label style={controlLabel()}>What it&apos;s for</label>
                  <input
                    value={payload.offer_for}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) => (r.id === row.id ? updateTemplatePayload(r, { offer_for: e.target.value }) : r))
                      )
                    }
                    style={input()}
                  />
                  <label style={controlLabel()}>CTA text</label>
                  <input
                    value={payload.cta_text}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) => (r.id === row.id ? updateTemplatePayload(r, { cta_text: e.target.value }) : r))
                      )
                    }
                    style={input()}
                  />
                  <label style={controlLabel()}>CTA URL</label>
                  <input
                    value={payload.cta_url}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) => (r.id === row.id ? updateTemplatePayload(r, { cta_url: e.target.value }) : r))
                      )
                    }
                    style={input()}
                  />
                  <label style={controlLabel()}>Logo URL</label>
                  <input
                    value={payload.logo_url}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) => (r.id === row.id ? updateTemplatePayload(r, { logo_url: e.target.value }) : r))
                      )
                    }
                    placeholder="Leave blank to use academy logo"
                    style={input()}
                  />
                  <label style={controlLabel()}>Logo box size</label>
                  <input
                    type="range"
                    min="36"
                    max="140"
                    step="2"
                    value={Number(payload.logo_box_size)}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) =>
                          r.id === row.id ? updateTemplatePayload(r, { logo_box_size: Number(e.target.value) }) : r
                        )
                      )
                    }
                  />
                  <label style={controlLabel()}>Logo image scale</label>
                  <input
                    type="range"
                    min="0.6"
                    max="1.6"
                    step="0.05"
                    value={Number(payload.logo_image_scale)}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) =>
                          r.id === row.id
                            ? updateTemplatePayload(r, { logo_image_scale: Number(e.target.value) })
                            : r
                        )
                      )
                    }
                  />
                  <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, opacity: 0.8 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(payload.logo_invert)}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r) =>
                            r.id === row.id ? updateTemplatePayload(r, { logo_invert: e.target.checked }) : r
                          )
                        )
                      }
                    />
                    Invert logo colors
                  </label>
                  <label style={controlLabel()}>Logo X</label>
                  <input
                    type="range"
                    min="-40"
                    max="160"
                    step="2"
                    value={Number(payload.logo_x)}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) => (r.id === row.id ? updateTemplatePayload(r, { logo_x: Number(e.target.value) }) : r))
                      )
                    }
                  />
                  <label style={controlLabel()}>Logo Y</label>
                  <input
                    type="range"
                    min="-20"
                    max="200"
                    step="2"
                    value={Number(payload.logo_y)}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) => (r.id === row.id ? updateTemplatePayload(r, { logo_y: Number(e.target.value) }) : r))
                      )
                    }
                  />
                  <label style={controlLabel()}>Badge scale</label>
                  <input
                    type="range"
                    min="0.8"
                    max="1.6"
                    step="0.05"
                    value={Number(payload.badge_scale)}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) => (r.id === row.id ? updateTemplatePayload(r, { badge_scale: Number(e.target.value) }) : r))
                      )
                    }
                  />
                  <label style={controlLabel()}>Badge X</label>
                  <input
                    type="range"
                    min="-20"
                    max="200"
                    step="2"
                    value={Number(payload.badge_x)}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) => (r.id === row.id ? updateTemplatePayload(r, { badge_x: Number(e.target.value) }) : r))
                      )
                    }
                  />
                  <label style={controlLabel()}>Badge Y</label>
                  <input
                    type="range"
                    min="60"
                    max="260"
                    step="2"
                    value={Number(payload.badge_y)}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) => (r.id === row.id ? updateTemplatePayload(r, { badge_y: Number(e.target.value) }) : r))
                      )
                    }
                  />
                  <label style={controlLabel()}>Offer scale</label>
                  <input
                    type="range"
                    min="0.8"
                    max="1.6"
                    step="0.05"
                    value={Number(payload.offer_scale)}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) => (r.id === row.id ? updateTemplatePayload(r, { offer_scale: Number(e.target.value) }) : r))
                      )
                    }
                  />
                  <label style={controlLabel()}>Offer X</label>
                  <input
                    type="range"
                    min="-10"
                    max="220"
                    step="2"
                    value={Number(payload.offer_x)}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) => (r.id === row.id ? updateTemplatePayload(r, { offer_x: Number(e.target.value) }) : r))
                      )
                    }
                  />
                  <label style={controlLabel()}>Offer Y</label>
                  <input
                    type="range"
                    min="200"
                    max="320"
                    step="2"
                    value={Number(payload.offer_y)}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) => (r.id === row.id ? updateTemplatePayload(r, { offer_y: Number(e.target.value) }) : r))
                      )
                    }
                  />
                  <label style={controlLabel()}>CTA scale</label>
                  <input
                    type="range"
                    min="0.8"
                    max="1.6"
                    step="0.05"
                    value={Number(payload.cta_scale)}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) => (r.id === row.id ? updateTemplatePayload(r, { cta_scale: Number(e.target.value) }) : r))
                      )
                    }
                  />
                  <label style={controlLabel()}>CTA X</label>
                  <input
                    type="range"
                    min="-10"
                    max="220"
                    step="2"
                    value={Number(payload.cta_x)}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) => (r.id === row.id ? updateTemplatePayload(r, { cta_x: Number(e.target.value) }) : r))
                      )
                    }
                  />
                  <label style={controlLabel()}>CTA Y</label>
                  <input
                    type="range"
                    min="240"
                    max="360"
                    step="2"
                    value={Number(payload.cta_y)}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) => (r.id === row.id ? updateTemplatePayload(r, { cta_y: Number(e.target.value) }) : r))
                      )
                    }
                  />
                </div>
              ) : null}
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, opacity: 0.8 }}>
                <input
                  type="checkbox"
                  checked={row.enabled !== false}
                  onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, enabled: e.target.checked } : r)))}
                />
                Enabled
              </label>
              <button onClick={() => saveRow(row)} style={btn()} disabled={saving}>
                Save
              </button>
            </div>
            <div style={previewWrap()}>
              <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.7 }}>Parent Card Preview</div>
              <div style={previewCard(resolveBorder(row.border_style, row.border_color))}>
                {preset ? (
                  renderEnrollTemplate(payload, academyLogoUrl)
                ) : resolvePreviewUrl(row.image_url, row.image_preview_url) ? (
                  <div style={previewImageFrame()}>
                    <img
                      src={resolvePreviewUrl(row.image_url, row.image_preview_url)}
                      alt="Preview"
                      style={previewImage(row)}
                    />
                  </div>
                ) : null}
                <div style={{ fontWeight: 900 }}>{row.title || "Parent Spotlight"}</div>
                <div style={{ opacity: 0.75, fontSize: 12 }}>
                  {row.message || "Weekly updates, promos, and family highlights will appear here."}
                </div>
              </div>
            </div>
            {!preset ? (
            <div style={controlGrid()}>
              <label style={controlLabel()}>Image scale</label>
              <input
                type="range"
                min="0.6"
                max="2"
                step="0.05"
                value={Number(row.image_scale ?? 1)}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r) => (r.id === row.id ? { ...r, image_scale: Number(e.target.value) } : r))
                  )
                }
              />
              <label style={controlLabel()}>Image X</label>
              <input
                type="range"
                min="-80"
                max="80"
                step="2"
                value={Number(row.image_x ?? 0)}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r) => (r.id === row.id ? { ...r, image_x: Number(e.target.value) } : r))
                  )
                }
              />
              <label style={controlLabel()}>Image Y</label>
              <input
                type="range"
                min="-80"
                max="80"
                step="2"
                value={Number(row.image_y ?? 0)}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r) => (r.id === row.id ? { ...r, image_y: Number(e.target.value) } : r))
                  )
                }
              />
              <label style={controlLabel()}>Rotate</label>
              <input
                type="range"
                min="-30"
                max="30"
                step="1"
                value={Number(row.image_rotate ?? 0)}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r) => (r.id === row.id ? { ...r, image_rotate: Number(e.target.value) } : r))
                  )
                }
              />
            </div>
            ) : null}
            <div style={controlGrid()}>
              <label style={controlLabel()}>Border style</label>
              <select
                value={row.border_style ?? "clean"}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r) => (r.id === row.id ? { ...r, border_style: e.target.value } : r))
                  )
                }
                style={select()}
              >
                <option value="clean">Clean</option>
                <option value="neon">Neon</option>
                <option value="sunset">Sunset</option>
                <option value="mint">Mint</option>
                <option value="none">None</option>
              </select>
              <label style={controlLabel()}>Border color (optional)</label>
              <input
                value={row.border_color ?? ""}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r) => (r.id === row.id ? { ...r, border_color: e.target.value } : r))
                  )
                }
                placeholder="#66f or rgba(...)"
                style={input()}
              />
            </div>
                </>
              );
            })()}
          </div>
        ))}
        {!rows.length && <div style={{ opacity: 0.7 }}>No announcements yet.</div>}
      </div>
    </Container>
  );
}

export default function MarketingAdminPage() {
  return <MarketingAdminPanel />;
}

function card(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    display: "grid",
    gap: 10,
    maxWidth: "100%",
    width: "100%",
  };
}

function input(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(56,189,248,0.4)",
    background: "rgba(8,15,25,0.6)",
    color: "white",
    fontWeight: 900,
  };
}

function textarea(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(56,189,248,0.4)",
    background: "rgba(8,15,25,0.6)",
    color: "white",
    fontWeight: 900,
    minHeight: 80,
    resize: "vertical",
  };
}

function select(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(56,189,248,0.4)",
    background: "rgba(8,15,25,0.6)",
    color: "white",
    fontWeight: 900,
  };
}

function btn(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(59,130,246,0.35)",
    background: "rgba(59,130,246,0.25)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function savedBadge(): React.CSSProperties {
  return {
    padding: "4px 8px",
    borderRadius: 999,
    background: "rgba(16,185,129,0.2)",
    color: "#6ee7b7",
    fontSize: 11,
    fontWeight: 900,
  };
}

function notice(): React.CSSProperties {
  return {
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(248,113,113,0.4)",
    background: "rgba(248,113,113,0.12)",
    color: "white",
    fontWeight: 900,
  };
}

function uploadLabel(): React.CSSProperties {
  return {
    borderRadius: 10,
    border: "1px dashed rgba(255,255,255,0.3)",
    padding: "8px 10px",
    fontSize: 12,
    fontWeight: 800,
    color: "white",
    display: "inline-flex",
    gap: 8,
    alignItems: "center",
    cursor: "pointer",
    width: "fit-content",
  };
}

function previewWrap(): React.CSSProperties {
  return {
    display: "grid",
    gap: 8,
    marginTop: 6,
  };
}

function gridList(): React.CSSProperties {
  return {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "1fr",
    alignItems: "start",
  };
}

function previewCard(border?: React.CSSProperties): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: 14,
    width: 320,
    minHeight: 420,
    border: "1px solid rgba(255,255,255,0.12)",
    background:
      "linear-gradient(155deg, rgba(59,130,246,0.2), rgba(14,165,233,0.1)), rgba(10,14,20,0.92)",
    display: "grid",
    gap: 6,
    ...(border ?? {}),
  };
}

function previewImageFrame(): React.CSSProperties {
  return {
    width: "100%",
    height: 160,
    borderRadius: 12,
    overflow: "hidden",
    background: "rgba(0,0,0,0.35)",
  };
}

function previewImage(row: {
  image_scale?: number | null;
  image_x?: number | null;
  image_y?: number | null;
  image_rotate?: number | null;
}): React.CSSProperties {
  const scale = Number(row.image_scale ?? 1);
  const x = Number(row.image_x ?? 0);
  const y = Number(row.image_y ?? 0);
  const rotate = Number(row.image_rotate ?? 0);
  return {
    width: "100%",
    height: 160,
    objectFit: "cover",
    transform: `translate(${x}px, ${y}px) scale(${scale}) rotate(${rotate}deg)`,
    transformOrigin: "center",
  };
}

function resolvePreviewUrl(imageUrl?: string | null, signedUrl?: string | null) {
  if (signedUrl) return signedUrl;
  const raw = String(imageUrl ?? "");
  if (!raw) return "";
  return raw.startsWith("http") ? raw : "";
}

function controlGrid(): React.CSSProperties {
  return {
    display: "grid",
    gap: 8,
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(56,189,248,0.25)",
    background: "linear-gradient(180deg, rgba(14,116,144,0.15), rgba(2,6,23,0.4))",
  };
}

function controlLabel(): React.CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 900,
    opacity: 0.7,
  };
}

function resolveBorder(style?: string | null, color?: string | null): React.CSSProperties {
  const hue = (color && color.trim()) || "";
  if (style === "none") {
    return { border: "1px solid transparent", boxShadow: "none" };
  }
  if (style === "neon") {
    return {
      border: `1px solid ${hue || "rgba(59,130,246,0.6)"}`,
      boxShadow: "0 0 20px rgba(59,130,246,0.35)",
    };
  }
  if (style === "sunset") {
    return {
      border: `1px solid ${hue || "rgba(251,146,60,0.7)"}`,
      boxShadow: "0 0 24px rgba(249,115,22,0.35)",
    };
  }
  if (style === "mint") {
    return {
      border: `1px solid ${hue || "rgba(16,185,129,0.7)"}`,
      boxShadow: "0 0 18px rgba(16,185,129,0.3)",
    };
  }
  return {
    border: `1px solid ${hue || "rgba(255,255,255,0.12)"}`,
    boxShadow: "0 18px 36px rgba(0,0,0,0.4)",
  };
}

function renderEnrollTemplate(payload: TemplatePayload, academyLogoUrl: string) {
  const theme = themeStyles(payload.theme);
  const logoUrl = payload.logo_url || academyLogoUrl;
  return (
    <div style={templateShell(theme)}>
      <div style={templateGlow(theme)} />
      {theme.snow ? <div style={templateSnow()} /> : null}
      <div style={templateLogo(payload, theme)}>
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" style={templateLogoImage(payload)} />
        ) : (
          <div style={templateLogoFallback()}>Logo</div>
        )}
      </div>
      <div style={templateBadge(payload, theme)}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>{payload.discount_amount}</div>
        <div style={{ fontSize: 11, opacity: 0.8 }}>{payload.discount_date}</div>
      </div>
      <div style={templateOffer(payload, theme)}>
        <div style={offerTitle()}>{payload.offer_title}</div>
        <div>{payload.offer_for}</div>
      </div>
      <a href={payload.cta_url || "#"} style={templateCta(payload, theme)} target="_blank" rel="noreferrer">
        {payload.cta_text}
      </a>
    </div>
  );
}

function themeStyles(theme: string) {
  if (theme === "winter") {
    return {
      bg: "linear-gradient(135deg, rgba(59,130,246,0.4), rgba(14,165,233,0.28))",
      accent: "rgba(56,189,248,0.95)",
      glow: "rgba(59,130,246,0.45)",
      snow: true,
    };
  }
  if (theme === "sunset") {
    return {
      bg: "linear-gradient(135deg, rgba(249,115,22,0.35), rgba(236,72,153,0.25))",
      accent: "rgba(249,115,22,0.75)",
      glow: "rgba(249,115,22,0.3)",
      snow: false,
    };
  }
  if (theme === "mint") {
    return {
      bg: "linear-gradient(135deg, rgba(16,185,129,0.32), rgba(45,212,191,0.18))",
      accent: "rgba(16,185,129,0.75)",
      glow: "rgba(16,185,129,0.3)",
      snow: false,
    };
  }
  return {
    bg: "linear-gradient(135deg, rgba(59,130,246,0.35), rgba(99,102,241,0.2))",
    accent: "rgba(59,130,246,0.75)",
    glow: "rgba(59,130,246,0.3)",
    snow: false,
  };
}

function templateShell(theme: { bg: string; accent: string; snow?: boolean }) : React.CSSProperties {
  return {
    position: "relative",
    borderRadius: 14,
    padding: 14,
    minHeight: 220,
    background: theme.bg,
    overflow: "hidden",
    border: `2px solid ${theme.accent}`,
    boxShadow: theme.snow ? "0 0 22px rgba(56,189,248,0.45)" : "0 0 16px rgba(0,0,0,0.25)",
  };
}

function templateGlow(theme: { glow: string }): React.CSSProperties {
  return {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: "50%",
    right: -60,
    top: -60,
    background: theme.glow,
    filter: "blur(12px)",
  };
}

function templateSnow(): React.CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "radial-gradient(circle, rgba(255,255,255,0.7) 1px, transparent 1.5px), radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 2px), radial-gradient(circle, rgba(255,255,255,0.25) 2px, transparent 3px)",
    backgroundSize: "18px 18px, 32px 32px, 70px 70px",
    backgroundPosition: "0 0, 10px 12px, -10px -20px",
    opacity: 0.55,
    pointerEvents: "none",
  };
}

function templateLogo(payload: TemplatePayload, theme: { accent: string }): React.CSSProperties {
  return {
    position: "absolute",
    left: payload.logo_x,
    top: payload.logo_y,
    width: payload.logo_box_size,
    height: payload.logo_box_size,
    borderRadius: 12,
    border: `1px solid ${theme.accent}`,
    background: "rgba(0,0,0,0.35)",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
  };
}

function templateLogoImage(payload: TemplatePayload): React.CSSProperties {
  return {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transform: `scale(${payload.logo_image_scale})`,
    filter: payload.logo_invert ? "invert(1)" : "none",
  };
}

function templateLogoFallback(): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 900,
    color: "white",
  };
}

function templateBadge(payload: TemplatePayload, theme: { accent: string }): React.CSSProperties {
  return {
    position: "absolute",
    left: payload.badge_x,
    top: payload.badge_y,
    transform: `scale(${payload.badge_scale})`,
    transformOrigin: "left top",
    padding: "10px 12px",
    borderRadius: 14,
    border: `1px solid ${theme.accent}`,
    background: "rgba(0,0,0,0.35)",
    color: "white",
  };
}

function templateOffer(payload: TemplatePayload, theme: { accent: string }): React.CSSProperties {
  return {
    position: "absolute",
    left: payload.offer_x,
    top: payload.offer_y,
    transform: `scale(${payload.offer_scale})`,
    transformOrigin: "left top",
    fontSize: 12,
    fontWeight: 700,
    color: "white",
    textShadow: "0 4px 10px rgba(0,0,0,0.4)",
    borderLeft: `3px solid ${theme.accent}`,
    paddingLeft: 8,
  };
}

function offerTitle(): React.CSSProperties {
  return {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    opacity: 0.7,
  };
}

function templateCta(payload: TemplatePayload, theme: { accent: string }): React.CSSProperties {
  return {
    position: "absolute",
    left: payload.cta_x,
    top: payload.cta_y,
    transform: `scale(${payload.cta_scale})`,
    transformOrigin: "left top",
    padding: "8px 14px",
    borderRadius: 999,
    border: `1px solid ${theme.accent}`,
    background: theme.accent,
    color: "white",
    fontSize: 12,
    fontWeight: 900,
    textDecoration: "none",
    boxShadow: "0 10px 20px rgba(56,189,248,0.35)",
  };
}

function backLink(): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.2)",
    color: "white",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 12,
  };
}

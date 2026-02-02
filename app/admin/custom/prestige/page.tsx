"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type BadgeLibraryRow = {
  id?: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  category?: string | null;
  enabled?: boolean;
};

type AchievementRow = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  icon_path?: string | null;
  criteria_type?: string | null;
  criteria_json?: any;
  enabled?: boolean;
  points_award?: number | null;
  badge_library_id?: string | null;
  icon_zoom?: number | null;
};

const PRESTIGE_CRITERIA = [
  { id: "checkins", label: "Check-ins" },
  { id: "camp_checkins", label: "Camp check-ins" },
  { id: "challenges_completed", label: "Challenges completed" },
  { id: "battle_pulse_wins", label: "Battle Pulse wins" },
  { id: "spotlight_stars", label: "Spotlight Stars" },
  { id: "gold_medals", label: "Gold medals (competition)" },
  { id: "skill_trees_completed", label: "Skill trees completed" },
  { id: "tumble_skill_trees_completed", label: "Tumbling skill trees completed" },
  { id: "level", label: "Level reached" },
  { id: "taolu_trackers_completed", label: "Taolu trackers completed" },
  { id: "taolu_skill_trees_completed", label: "Taolu skill trees completed" },
  { id: "taolu_master", label: "Taolu Master (trackers + taolu trees)" },
  { id: "comp_team", label: "Competition team" },
  { id: "lifetime_points", label: "Lifetime points" },
  { id: "tumble_sets_completed", label: "Tumbling sets completed" },
];

const CRITERIA_WITH_MIN = new Set([
  "checkins",
  "camp_checkins",
  "challenges_completed",
  "battle_pulse_wins",
  "spotlight_stars",
  "gold_medals",
  "skill_trees_completed",
  "tumble_skill_trees_completed",
  "level",
  "taolu_trackers_completed",
  "taolu_skill_trees_completed",
  "lifetime_points",
  "tumble_sets_completed",
]);

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status})` } };
  }
}

function updateCriteriaJson<T extends Record<string, any>>(current: any, patch: T) {
  const next = { ...(current ?? {}), ...patch };
  Object.keys(next).forEach((k) => {
    if (next[k] === "" || next[k] === null) delete next[k];
  });
  return next;
}

export default function PrestigeAdminPage() {
  const [pinOk, setPinOk] = useState(false);
  const [library, setLibrary] = useState<BadgeLibraryRow[]>([]);
  const [achievements, setAchievements] = useState<AchievementRow[]>([]);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState("");
  const [pickerTarget, setPickerTarget] = useState<{ type: "new" | "row"; id?: string } | null>(null);
  const [bucketFiles, setBucketFiles] = useState<{ path: string; public_url: string }[]>([]);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadTarget, setUploadTarget] = useState<{ type: "new" | "row"; id?: string } | null>(null);

  const [newBadge, setNewBadge] = useState<AchievementRow>({
    id: "",
    name: "",
    description: "",
    category: "prestige",
    icon_path: "",
    criteria_type: "checkins",
    criteria_json: { min: 1 },
    enabled: true,
    points_award: 0,
    badge_library_id: "",
    icon_zoom: 1,
  });

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
    const res = await fetch("/api/admin/achievements/list", { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to load prestige badges");
    setAchievements((sj.json?.achievements ?? []) as AchievementRow[]);
    setLibrary((sj.json?.badgeLibrary ?? []) as BadgeLibraryRow[]);
  }

  useEffect(() => {
    if (!pinOk) return;
    load();
  }, [pinOk]);

  const prestigeLibrary = useMemo(() => {
    return library.filter((b) => {
      const cat = String(b.category ?? "").trim().toLowerCase();
      const url = String(b.image_url ?? "").toLowerCase();
      return cat === "prestige" || url.includes("/badges/prestige/");
    });
  }, [library]);

  const prestigeBadges = useMemo(() => {
    return achievements.filter((row) => String(row.category ?? "").trim() === "prestige");
  }, [achievements]);

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  function resolveIconUrl(iconPath?: string | null) {
    const clean = String(iconPath ?? "").trim().replace(/^\/+/, "");
    if (!clean || !baseUrl) return "";
    const fullPath = clean.startsWith("badges/") ? clean : `badges/${clean}`;
    return `${baseUrl}/storage/v1/object/public/${fullPath}`;
  }

  const newBadgeArt = library.find((b) => b.id === newBadge.badge_library_id)?.image_url ?? "";
  const newIconFallback = newBadgeArt ? "" : resolveIconUrl(newBadge.icon_path);
  const newZoom = Number(newBadge.icon_zoom ?? 1) || 1;

  function updateBadge(id: string, patch: Partial<AchievementRow>) {
    setAchievements((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  async function openPrestigePicker(target: { type: "new" | "row"; id?: string }) {
    setPickerTarget(target);
    setPickerError("");
    setPickerOpen(true);
    if (bucketFiles.length) return;
    setPickerLoading(true);
    const res = await fetch("/api/admin/badge-library/prestige-browse", { cache: "no-store" });
    const sj = await safeJson(res);
    setPickerLoading(false);
    if (!sj.ok) {
      setPickerError(sj.json?.error || "Failed to load prestige bucket");
      return;
    }
    setBucketFiles((sj.json?.items ?? []) as { path: string; public_url: string }[]);
  }

  function selectFromPrestigeBucket(file: { path: string; public_url: string }) {
    if (!pickerTarget) return;
    if (pickerTarget.type === "new") {
      setNewBadge((prev) => ({ ...prev, icon_path: file.path, badge_library_id: "" }));
    } else {
      updateBadge(pickerTarget.id ?? "", { icon_path: file.path, badge_library_id: "" });
    }
    setPickerOpen(false);
  }

  async function uploadPrestigeBadge(file: File | null, target: { type: "new" | "row"; id?: string }) {
    if (!file) return;
    setUploadStatus("Uploading...");
    setUploadTarget(target);
    const data = new FormData();
    data.append("file", file);
    const res = await fetch("/api/admin/badge-library/prestige-upload", { method: "POST", body: data });
    const sj = await safeJson(res);
    if (!sj.ok) {
      setUploadStatus(sj.json?.error || "Upload failed");
      return;
    }
    const badge = sj.json?.badge as BadgeLibraryRow | undefined;
    if (badge?.id) {
      setLibrary((prev) => [...prev, badge]);
      if (target.type === "new") {
        setNewBadge((prev) => ({ ...prev, badge_library_id: badge.id, icon_path: sj.json?.path ?? prev.icon_path }));
      } else {
        updateBadge(target.id ?? "", { badge_library_id: badge.id, icon_path: sj.json?.path ?? undefined });
      }
    }
    setUploadStatus("Uploaded");
    window.setTimeout(() => setUploadStatus(""), 1800);
  }

  async function saveBadge(row: AchievementRow) {
    if (!row.id || !row.name) {
      setMsg("Prestige badges need both an id and a name.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/admin/achievements/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...row, category: "prestige" }),
    });
    const sj = await safeJson(res);
    setSaving(false);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to save badge");
    setSavedId(row.id);
    window.setTimeout(() => setSavedId(null), 1600);
    await load();
  }

  async function saveNewBadge() {
    await saveBadge({ ...newBadge, category: "prestige" });
    setNewBadge({
      id: "",
      name: "",
      description: "",
      category: "prestige",
      icon_path: "",
      criteria_type: "checkins",
      criteria_json: { min: 1 },
      enabled: true,
      points_award: 0,
      badge_library_id: "",
    });
  }

  if (!pinOk) return null;

  return (
    <main style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 1000 }}>Prestige Badges</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            Customize prestige badge logic, labels, and tooltip descriptions.
          </div>
        </div>
        <Link href="/admin/custom" style={backLink()}>
          Return to Admin Workspace
        </Link>
      </div>

      {msg ? <div style={notice()}>{msg}</div> : null}

      <section style={{ display: "grid", gap: 12 }}>
        <div style={{ fontWeight: 1000, fontSize: 16 }}>Add Prestige Badge</div>
        <div style={card()}>
          <div style={{ display: "grid", gap: 10 }}>
            <label style={labelStyle()}>
              Badge id
              <input
                value={newBadge.id}
                onChange={(e) => setNewBadge((prev) => ({ ...prev, id: e.target.value }))}
                placeholder="prestige:spotlight_25"
                style={input()}
              />
            </label>
            <label style={labelStyle()}>
              Badge name
              <input
                value={newBadge.name}
                onChange={(e) => setNewBadge((prev) => ({ ...prev, name: e.target.value }))}
                style={input()}
              />
            </label>
            <label style={labelStyle()}>
              Tooltip description
              <textarea
                value={newBadge.description ?? ""}
                onChange={(e) => setNewBadge((prev) => ({ ...prev, description: e.target.value }))}
                style={textarea()}
              />
            </label>
            <div style={gridTwo()}>
              <label style={labelStyle()}>
                Criteria
                <select
                  value={String(newBadge.criteria_type ?? "checkins")}
                  onChange={(e) => {
                    const next = e.target.value;
                    const nextCriteria = CRITERIA_WITH_MIN.has(next)
                      ? updateCriteriaJson(newBadge.criteria_json, { min: Number(newBadge.criteria_json?.min ?? 1) })
                      : {};
                    setNewBadge((prev) => ({ ...prev, criteria_type: next, criteria_json: nextCriteria }));
                  }}
                  style={input()}
                >
                  {PRESTIGE_CRITERIA.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              {String(newBadge.criteria_type ?? "") === "taolu_master" ? (
                <div style={gridTwo()}>
                  <label style={labelStyle()}>
                    Taolu trackers (min)
                    <input
                      type="number"
                      min={0}
                      value={newBadge.criteria_json?.trackers_min ?? ""}
                      onChange={(e) =>
                        setNewBadge((prev) => ({
                          ...prev,
                          criteria_json: updateCriteriaJson(prev.criteria_json, {
                            trackers_min: e.target.value === "" ? "" : Number(e.target.value),
                          }),
                        }))
                      }
                      style={input()}
                    />
                  </label>
                  <label style={labelStyle()}>
                    Taolu skill trees (min)
                    <input
                      type="number"
                      min={0}
                      value={newBadge.criteria_json?.trees_min ?? ""}
                      onChange={(e) =>
                        setNewBadge((prev) => ({
                          ...prev,
                          criteria_json: updateCriteriaJson(prev.criteria_json, {
                            trees_min: e.target.value === "" ? "" : Number(e.target.value),
                          }),
                        }))
                      }
                      style={input()}
                    />
                  </label>
                </div>
              ) : CRITERIA_WITH_MIN.has(String(newBadge.criteria_type ?? "")) ? (
                <label style={labelStyle()}>
                  Minimum value
                  <input
                    type="number"
                    min={0}
                    value={newBadge.criteria_json?.min ?? ""}
                    onChange={(e) =>
                      setNewBadge((prev) => ({
                        ...prev,
                        criteria_json: updateCriteriaJson(prev.criteria_json, {
                          min: e.target.value === "" ? "" : Number(e.target.value),
                        }),
                      }))
                    }
                    style={input()}
                  />
                </label>
              ) : null}
            </div>
            <div style={gridTwo()}>
            <label style={labelStyle()}>
              Badge art (prestige bucket)
              <select
                value={newBadge.badge_library_id ?? ""}
                onChange={(e) => setNewBadge((prev) => ({ ...prev, badge_library_id: e.target.value }))}
                style={input()}
              >
                <option value="">No badge art</option>
                {prestigeLibrary.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            {newBadgeArt || newIconFallback ? (
              <div style={{ display: "grid", justifyItems: "start" }}>
                <div style={badgePreview()}>
                  <div style={badgeSafeArea()} />
                  <img
                    src={newBadgeArt || newIconFallback}
                    alt={newBadge.name || "Badge preview"}
                    style={{
                      width: 68,
                      height: 68,
                      objectFit: "contain",
                      transform: `scale(${newZoom})`,
                      transformOrigin: "center",
                    }}
                  />
                </div>
              </div>
            ) : null}
            <label style={labelStyle()}>
              Badge zoom
              <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 10, alignItems: "center" }}>
                <input
                  type="range"
                  min={0.5}
                  max={1.5}
                  step={0.005}
                  value={newZoom}
                  onChange={(e) => setNewBadge((prev) => ({ ...prev, icon_zoom: Number(e.target.value) }))}
                  style={range()}
                />
                <input
                  type="number"
                  min={0.5}
                  max={1.5}
                  step={0.005}
                  value={Number.isFinite(newZoom) ? newZoom : 1}
                  onChange={(e) =>
                    setNewBadge((prev) => ({ ...prev, icon_zoom: e.target.value === "" ? 1 : Number(e.target.value) }))
                  }
                  style={input()}
                />
              </div>
            </label>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.9 }}>Prestige bucket</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <button type="button" onClick={() => openPrestigePicker({ type: "new" })} style={btnGhost()}>
                  Browse bucket
                </button>
                <label style={btnGhost()}>
                  Upload badge
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => uploadPrestigeBadge(e.target.files?.[0] ?? null, { type: "new" })}
                    style={{ display: "none" }}
                  />
                </label>
                {uploadTarget?.type === "new" && uploadStatus ? (
                  <span style={{ fontSize: 11, opacity: 0.75 }}>{uploadStatus}</span>
                ) : null}
              </div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>Files come from `public/badges/prestige`.</div>
            </div>
            <label style={labelStyle()}>
              Icon path (legacy)
              <input
                value={newBadge.icon_path ?? ""}
                onChange={(e) => setNewBadge((prev) => ({ ...prev, icon_path: e.target.value }))}
                placeholder="prestige/your-badge.png"
                style={input()}
              />
            </label>
            <label style={labelStyle()}>
              Points awarded
              <input
                type="number"
                min={0}
                value={newBadge.points_award ?? ""}
                onChange={(e) =>
                  setNewBadge((prev) => ({
                    ...prev,
                    points_award: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                style={input()}
              />
            </label>
            </div>
            <label style={toggleWrap()}>
              <input
                type="checkbox"
                checked={newBadge.enabled !== false}
                onChange={(e) => setNewBadge((prev) => ({ ...prev, enabled: e.target.checked }))}
              />
              Enabled
            </label>
            <button type="button" onClick={saveNewBadge} style={btn()} disabled={saving}>
              Save new badge
            </button>
          </div>
        </div>
      </section>

      <section style={{ display: "grid", gap: 12 }}>
        <div style={{ fontWeight: 1000, fontSize: 16 }}>Prestige Badge Library</div>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {prestigeBadges.map((badge) => {
            const badgeArt = library.find((b) => b.id === badge.badge_library_id)?.image_url ?? "";
            const iconFallback = badgeArt ? "" : resolveIconUrl(badge.icon_path);
            const criteriaType = String(badge.criteria_type ?? "checkins");
            const zoom = Number(badge.icon_zoom ?? 1) || 1;
            return (
              <div key={badge.id} style={prestigeCard()}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  {badgeArt || iconFallback ? (
                    <div style={badgePreview()}>
                      <div style={badgeSafeArea()} />
                      <img
                        src={badgeArt || iconFallback}
                        alt={badge.name}
                        style={{
                          width: 68,
                          height: 68,
                          objectFit: "contain",
                          transform: `scale(${zoom})`,
                          transformOrigin: "center",
                        }}
                      />
                    </div>
                  ) : (
                    <div style={badgeEmpty()}>No badge</div>
                  )}
                  <div>
                    <div style={{ fontWeight: 900 }}>{badge.name}</div>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>{badge.id}</div>
                  </div>
                </div>

                <label style={labelStyle()}>
                  Badge name
                  <input
                    value={badge.name ?? ""}
                    onChange={(e) => updateBadge(badge.id, { name: e.target.value })}
                    style={input()}
                  />
                </label>
                <label style={labelStyle()}>
                  Tooltip description
                  <textarea
                    value={badge.description ?? ""}
                    onChange={(e) => updateBadge(badge.id, { description: e.target.value })}
                    style={textarea()}
                  />
                </label>
                <label style={labelStyle()}>
                  Badge zoom
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 10, alignItems: "center" }}>
                    <input
                      type="range"
                      min={0.5}
                      max={1.5}
                      step={0.005}
                      value={zoom}
                      onChange={(e) => updateBadge(badge.id, { icon_zoom: Number(e.target.value) })}
                      style={range()}
                    />
                    <input
                      type="number"
                      min={0.5}
                      max={1.5}
                      step={0.005}
                      value={Number.isFinite(zoom) ? zoom : 1}
                      onChange={(e) => updateBadge(badge.id, { icon_zoom: e.target.value === "" ? 1 : Number(e.target.value) })}
                      style={input()}
                    />
                  </div>
                </label>

                <label style={labelStyle()}>
                  Criteria
                  <select
                    value={criteriaType}
                    onChange={(e) => {
                      const nextType = e.target.value;
                      const nextCriteria = CRITERIA_WITH_MIN.has(nextType)
                        ? updateCriteriaJson(badge.criteria_json, { min: Number(badge.criteria_json?.min ?? 1) })
                        : {};
                      updateBadge(badge.id, { criteria_type: nextType, criteria_json: nextCriteria });
                    }}
                    style={input()}
                  >
                    {PRESTIGE_CRITERIA.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                {criteriaType === "taolu_master" ? (
                  <div style={gridTwo()}>
                    <label style={labelStyle()}>
                      Taolu trackers (min)
                      <input
                        type="number"
                        min={0}
                        value={badge.criteria_json?.trackers_min ?? ""}
                        onChange={(e) =>
                          updateBadge(badge.id, {
                            criteria_json: updateCriteriaJson(badge.criteria_json, {
                              trackers_min: e.target.value === "" ? "" : Number(e.target.value),
                            }),
                          })
                        }
                        style={input()}
                      />
                    </label>
                    <label style={labelStyle()}>
                      Taolu skill trees (min)
                      <input
                        type="number"
                        min={0}
                        value={badge.criteria_json?.trees_min ?? ""}
                        onChange={(e) =>
                          updateBadge(badge.id, {
                            criteria_json: updateCriteriaJson(badge.criteria_json, {
                              trees_min: e.target.value === "" ? "" : Number(e.target.value),
                            }),
                          })
                        }
                        style={input()}
                      />
                    </label>
                  </div>
                ) : CRITERIA_WITH_MIN.has(criteriaType) ? (
                  <label style={labelStyle()}>
                    Minimum value
                    <input
                      type="number"
                      min={0}
                    value={badge.criteria_json?.min ?? ""}
                    onChange={(e) =>
                      updateBadge(badge.id, {
                        criteria_json: updateCriteriaJson(badge.criteria_json, {
                          min: e.target.value === "" ? "" : Number(e.target.value),
                        }),
                      })
                    }
                    style={input()}
                  />
                </label>
                ) : null}
                <label style={labelStyle()}>
                  Badge art (prestige bucket)
                  <select
                    value={badge.badge_library_id ?? ""}
                    onChange={(e) => updateBadge(badge.id, { badge_library_id: e.target.value })}
                    style={input()}
                  >
                    <option value="">No badge art</option>
                    {prestigeLibrary.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.9 }}>Prestige bucket</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <button type="button" onClick={() => openPrestigePicker({ type: "row", id: badge.id })} style={btnGhost()}>
                      Browse bucket
                    </button>
                    <label style={btnGhost()}>
                      Upload badge
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => uploadPrestigeBadge(e.target.files?.[0] ?? null, { type: "row", id: badge.id })}
                        style={{ display: "none" }}
                      />
                    </label>
                    {uploadTarget?.type === "row" && uploadTarget.id === badge.id && uploadStatus ? (
                      <span style={{ fontSize: 11, opacity: 0.75 }}>{uploadStatus}</span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.6 }}>Files come from `public/badges/prestige`.</div>
                </div>
                <label style={labelStyle()}>
                  Icon path (legacy)
                  <input
                    value={badge.icon_path ?? ""}
                    onChange={(e) => updateBadge(badge.id, { icon_path: e.target.value })}
                    placeholder="prestige/your-badge.png"
                    style={input()}
                  />
                </label>
                <div style={gridTwo()}>
                  <label style={labelStyle()}>
                    Points awarded
                    <input
                      type="number"
                      min={0}
                      value={badge.points_award ?? ""}
                      onChange={(e) =>
                        updateBadge(badge.id, { points_award: e.target.value === "" ? null : Number(e.target.value) })
                      }
                      style={input()}
                    />
                  </label>
                  <label style={toggleWrap()}>
                    <input
                      type="checkbox"
                      checked={badge.enabled !== false}
                      onChange={(e) => updateBadge(badge.id, { enabled: e.target.checked })}
                    />
                    Enabled
                  </label>
                </div>
                <button type="button" onClick={() => saveBadge(badge)} style={btn()} disabled={saving}>
                  {savedId === badge.id ? "Saved" : "Save badge"}
                </button>
              </div>
            );
          })}
          {!prestigeBadges.length ? <div style={{ opacity: 0.7 }}>No prestige badges yet.</div> : null}
        </div>
      </section>

      {pickerOpen ? (
        <div style={pickerOverlay()}>
          <div style={pickerPanel()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 1000 }}>Prestige Bucket</div>
              <button onClick={() => setPickerOpen(false)} style={btnGhost()}>
                Close
              </button>
            </div>
            {pickerLoading ? <div style={{ fontSize: 12 }}>Loading...</div> : null}
            {pickerError ? <div style={{ color: "#fca5a5", fontSize: 12 }}>{pickerError}</div> : null}
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
              {bucketFiles.map((file) => (
                <button key={file.path} style={pickerItem()} onClick={() => selectFromPrestigeBucket(file)}>
                  <img src={file.public_url} alt={file.path} style={{ width: "100%", height: 90, objectFit: "contain" }} />
                  <div style={{ fontSize: 10, opacity: 0.7, marginTop: 6 }}>{file.path}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function card(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
  };
}

function prestigeCard(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "linear-gradient(140deg, rgba(59,130,246,0.18), rgba(15,23,42,0.5))",
    display: "grid",
    gap: 10,
    boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
  };
}

function labelStyle(): React.CSSProperties {
  return {
    display: "grid",
    gap: 6,
    fontSize: 12,
    fontWeight: 900,
    color: "rgba(255,255,255,0.85)",
  };
}

function gridTwo(): React.CSSProperties {
  return {
    display: "grid",
    gap: 10,
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  };
}

function input(): React.CSSProperties {
  return {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.4)",
    color: "white",
    outline: "none",
  };
}

function textarea(): React.CSSProperties {
  return {
    width: "100%",
    minHeight: 72,
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.4)",
    color: "white",
    outline: "none",
    resize: "vertical",
  };
}

function btn(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(34,197,94,0.4)",
    background: "rgba(34,197,94,0.12)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function btnGhost(): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function toggleWrap(): React.CSSProperties {
  return {
    display: "flex",
    gap: 8,
    alignItems: "center",
    fontSize: 12,
    fontWeight: 900,
  };
}

function badgePreview(): React.CSSProperties {
  return {
    width: 96,
    height: 96,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "radial-gradient(circle at top, rgba(59,130,246,0.12), transparent 60%), rgba(0,0,0,0.35)",
    display: "grid",
    placeItems: "center",
    position: "relative",
    overflow: "hidden",
  };
}

function badgeSafeArea(): React.CSSProperties {
  return {
    position: "absolute",
    inset: 14,
    borderRadius: 12,
    border: "1px dashed rgba(255,255,255,0.35)",
    boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.35)",
    pointerEvents: "none",
  };
}

function badgeEmpty(): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px dashed rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.05)",
    color: "white",
    fontSize: 12,
    fontWeight: 900,
  };
}

function range(): React.CSSProperties {
  return {
    width: "100%",
    accentColor: "#38bdf8",
  };
}

function notice(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: "8px 12px",
    border: "1px solid rgba(248,113,113,0.5)",
    background: "rgba(248,113,113,0.12)",
    fontSize: 12,
    fontWeight: 900,
  };
}

function backLink(): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 900,
    textDecoration: "none",
    color: "white",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.15)",
    padding: "8px 12px",
    background: "rgba(255,255,255,0.06)",
  };
}

function pickerOverlay(): React.CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "grid",
    placeItems: "center",
    zIndex: 80,
    padding: 20,
  };
}

function pickerPanel(): React.CSSProperties {
  return {
    width: "min(880px, 96vw)",
    maxHeight: "80vh",
    overflow: "auto",
    borderRadius: 18,
    padding: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(8,12,20,0.95)",
    display: "grid",
    gap: 12,
  };
}

function pickerItem(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: 8,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "white",
    cursor: "pointer",
    textAlign: "left",
  };
}

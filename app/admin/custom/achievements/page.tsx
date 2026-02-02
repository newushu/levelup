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
};

type DataPointRow = { key: string; label: string; description?: string | null; unit?: string | null; default_compare?: string | null; enabled?: boolean };

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status})` } };
  }
}

export default function AchievementsAdminPage() {
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
  const [badgeCategoryFilter, setBadgeCategoryFilter] = useState("all");
  const [badgePickerOpen, setBadgePickerOpen] = useState(false);
  const [badgePickerTarget, setBadgePickerTarget] = useState<{ type: "newAchievement" | "achievement"; id?: string } | null>(null);
  const [badgePickerCategory, setBadgePickerCategory] = useState("all");
  const [dataPoints, setDataPoints] = useState<DataPointRow[]>([]);
  const [achievementCategoryFilter, setAchievementCategoryFilter] = useState("all");
  const [achievementCriteriaFilter, setAchievementCriteriaFilter] = useState("all");
  const [criteriaDraft, setCriteriaDraft] = useState("");
  const criteriaTypes = [
    { id: "manual", label: "Manual award" },
    { id: "checkins", label: "Check-ins threshold" },
    { id: "times_completed", label: "Times completed" },
    { id: "skill_tree_complete", label: "Skill tree complete" },
    { id: "skill_tree_set_complete", label: "Skill tree set complete" },
    { id: "skill_tree_category_complete", label: "Skill tree category complete" },
    { id: "skill_tree_tumbling_complete", label: "Tumbling skill trees complete" },
    { id: "lifetime_points", label: "Lifetime points" },
    { id: "data_point", label: "Data point (catalog)" },
  ];

  const [newBadge, setNewBadge] = useState<BadgeLibraryRow>({
    name: "",
    description: "",
    image_url: "",
    category: "",
    enabled: true,
  });
  const [newAchievement, setNewAchievement] = useState<AchievementRow>({
    id: "",
    name: "",
    description: "",
    category: "",
    icon_path: "",
    criteria_type: "",
    criteria_json: {},
    enabled: true,
    points_award: 0,
    badge_library_id: "",
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
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to load achievements");
    setAchievements((sj.json?.achievements ?? []) as AchievementRow[]);
    setLibrary((sj.json?.badgeLibrary ?? []) as BadgeLibraryRow[]);
  }

  async function loadDataPoints() {
    const res = await fetch("/api/admin/data-points/list", { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to load data points");
    setDataPoints((sj.json?.data_points ?? []) as DataPointRow[]);
  }

  useEffect(() => {
    if (!pinOk) return;
    load();
    loadDataPoints();
  }, [pinOk]);

  async function openPicker(target: { type: "new" | "row"; id?: string }) {
    setPickerTarget(target);
    setPickerError("");
    setPickerOpen(true);
    if (bucketFiles.length) return;
    setPickerLoading(true);
    const res = await fetch("/api/admin/badge-library/browse", { cache: "no-store" });
    const sj = await safeJson(res);
    setPickerLoading(false);
    if (!sj.ok) {
      setPickerError(sj.json?.error || "Failed to load storage items");
      return;
    }
    setBucketFiles((sj.json?.items ?? []) as { path: string; public_url: string }[]);
  }

  function selectFromBucket(publicUrl: string) {
    if (!pickerTarget) return;
    if (pickerTarget.type === "new") {
      setNewBadge((prev) => ({ ...prev, image_url: publicUrl }));
    } else {
      setLibrary((prev) =>
        prev.map((row) => (row.id === pickerTarget.id ? { ...row, image_url: publicUrl } : row))
      );
    }
    setPickerOpen(false);
  }

  function openBadgePicker(target: { type: "newAchievement" | "achievement"; id?: string }) {
    setBadgePickerTarget(target);
    setBadgePickerCategory("all");
    setBadgePickerOpen(true);
  }

  function selectBadgeFromLibrary(badgeId: string) {
    if (!badgePickerTarget) return;
    if (badgePickerTarget.type === "newAchievement") {
      setNewAchievement((prev) => ({ ...prev, badge_library_id: badgeId }));
    } else {
      setAchievements((prev) => prev.map((row) => (row.id === badgePickerTarget.id ? { ...row, badge_library_id: badgeId } : row)));
    }
    setBadgePickerOpen(false);
  }

  async function saveBadgeLibrary(row: BadgeLibraryRow) {
    setSaving(true);
    const res = await fetch("/api/admin/badge-library/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
    const sj = await safeJson(res);
    setSaving(false);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to save badge");
    setSavedId(row.id ?? "new-badge");
    window.setTimeout(() => setSavedId(null), 1600);
    setNewBadge({ name: "", description: "", image_url: "", category: "", enabled: true });
    await load();
  }

  async function saveAchievement(row: AchievementRow) {
    setSaving(true);
    const res = await fetch("/api/admin/achievements/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
    const sj = await safeJson(res);
    setSaving(false);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to save achievement");
    setSavedId(row.id);
    window.setTimeout(() => setSavedId(null), 1600);
    setNewAchievement({
      id: "",
      name: "",
      description: "",
      category: "",
      icon_path: "",
      criteria_type: "",
      criteria_json: {},
      enabled: true,
      points_award: 0,
      badge_library_id: "",
    });
    await load();
  }

  async function applyRetroactive(badgeId: string) {
    if (!confirm("Apply retroactive point updates for this achievement? This adds ledger adjustments for all past awards.")) {
      return;
    }
    setSaving(true);
    const res = await fetch("/api/admin/achievements/retroactive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ badge_id: badgeId, confirm: true }),
    });
    const sj = await safeJson(res);
    setSaving(false);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to apply retroactive updates");
    setSavedId(badgeId);
    window.setTimeout(() => setSavedId(null), 1600);
  }

  const achievementCategories = useMemo(() => {
    return Array.from(
      new Set(
        achievements
          .map((row) => String(row.category ?? "").trim())
          .filter((cat) => cat && cat !== "prestige")
      )
    ).sort();
  }, [achievements]);

  const filteredAchievements = useMemo(() => {
    return achievements.filter((row) => {
      if (String(row.category ?? "").trim() === "prestige") return false;
      if (achievementCategoryFilter !== "all" && String(row.category ?? "") !== achievementCategoryFilter) return false;
      if (achievementCriteriaFilter !== "all" && String(row.criteria_type ?? "") !== achievementCriteriaFilter) return false;
      return true;
    });
  }, [achievements, achievementCategoryFilter, achievementCriteriaFilter]);

  function updateCriteriaJson<T extends Record<string, any>>(current: any, patch: T) {
    const next = { ...(current ?? {}), ...patch };
    Object.keys(next).forEach((k) => {
      if (next[k] === "" || next[k] === null) delete next[k];
    });
    return next;
  }

  if (!pinOk) return null;

  return (
    <main style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 1000 }}>Achievements & Badge Library</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            Map badges to achievements and control point awards.
          </div>
        </div>
        <Link href="/admin/custom" style={backLink()}>
          Return to Admin Workspace
        </Link>
      </div>

      {msg ? <div style={notice()}>{msg}</div> : null}

      <div style={callout()}>
        Prestige badges are now managed in the dedicated{" "}
        <Link href="/admin/custom/prestige" style={{ color: "white", textDecoration: "underline" }}>
          Prestige Badges
        </Link>{" "}
        workspace.
      </div>

      <section style={{ display: "grid", gap: 12 }}>
        <div style={{ fontWeight: 1000, fontSize: 16 }}>Badge Library</div>
        <div style={categoryRow()}>
          {[
            "all",
            ...Array.from(new Set(library.map((b) => String(b.category ?? "").trim()).filter(Boolean))).sort(),
          ].map((cat) => (
            <button
              key={cat || "uncategorized"}
              onClick={() => setBadgeCategoryFilter(cat || "all")}
              style={categoryChip(badgeCategoryFilter === (cat || "all"))}
            >
              {cat === "all" ? "All Categories" : cat}
            </button>
          ))}
        </div>
        <div style={card()}>
          <div style={{ display: "grid", gap: 10 }}>
            <label style={labelStyle()}>
              Badge name
              <input
                value={newBadge.name}
                onChange={(e) => setNewBadge((prev) => ({ ...prev, name: e.target.value }))}
                style={input()}
              />
            </label>
            <label style={labelStyle()}>
              Category
              <input
                value={newBadge.category ?? ""}
                onChange={(e) => setNewBadge((prev) => ({ ...prev, category: e.target.value }))}
                style={input()}
              />
            </label>
            <label style={labelStyle()}>
              Image URL
              <input
                value={newBadge.image_url ?? ""}
                onChange={(e) => setNewBadge((prev) => ({ ...prev, image_url: e.target.value }))}
                style={input()}
              />
            </label>
            <button type="button" onClick={() => openPicker({ type: "new" })} style={btnGhost()}>
              Browse badge library bucket
            </button>
            <label style={labelStyle()}>
              Description
              <textarea
                value={newBadge.description ?? ""}
                onChange={(e) => setNewBadge((prev) => ({ ...prev, description: e.target.value }))}
                style={textarea()}
              />
            </label>
            <label style={checkboxRow()}>
              <input
                type="checkbox"
                checked={newBadge.enabled !== false}
                onChange={(e) => setNewBadge((prev) => ({ ...prev, enabled: e.target.checked }))}
              />
              Enabled
            </label>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button onClick={() => saveBadgeLibrary(newBadge)} style={btn()} disabled={saving}>
                {saving ? "Saving..." : "Save Badge"}
              </button>
              {savedId === "new-badge" ? <div style={savedBadge()}>Saved</div> : null}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {library
            .filter((row) => badgeCategoryFilter === "all" || String(row.category ?? "").trim() === badgeCategoryFilter)
            .map((row) => (
            <div key={row.id} style={card()}>
              <div style={{ display: "grid", gap: 10 }}>
                <input
                  value={row.name}
                  onChange={(e) => setLibrary((prev) => prev.map((r) => (r.id === row.id ? { ...r, name: e.target.value } : r)))}
                  style={input()}
                />
                <input
                  value={row.category ?? ""}
                  onChange={(e) => setLibrary((prev) => prev.map((r) => (r.id === row.id ? { ...r, category: e.target.value } : r)))}
                  style={input()}
                />
                <input
                  value={row.image_url ?? ""}
                  onChange={(e) => setLibrary((prev) => prev.map((r) => (r.id === row.id ? { ...r, image_url: e.target.value } : r)))}
                  style={input()}
                />
                <button type="button" onClick={() => openPicker({ type: "row", id: row.id })} style={btnGhost()}>
                  Browse badge library bucket
                </button>
                {row.image_url ? (
                  <img src={row.image_url} alt={row.name} style={{ width: 120, height: 120, objectFit: "contain", borderRadius: 12 }} />
                ) : null}
                <textarea
                  value={row.description ?? ""}
                  onChange={(e) => setLibrary((prev) => prev.map((r) => (r.id === row.id ? { ...r, description: e.target.value } : r)))}
                  style={textarea()}
                />
                <label style={checkboxRow()}>
                  <input
                    type="checkbox"
                    checked={row.enabled !== false}
                    onChange={(e) => setLibrary((prev) => prev.map((r) => (r.id === row.id ? { ...r, enabled: e.target.checked } : r)))}
                  />
                  Enabled
                </label>
                <button onClick={() => saveBadgeLibrary(row)} style={btn()} disabled={saving}>
                  Save
                </button>
                {savedId === row.id ? <div style={savedBadge()}>Saved</div> : null}
              </div>
            </div>
          ))}
          {!library.length && <div style={{ opacity: 0.7 }}>No badge library entries yet.</div>}
        </div>
      </section>

      {pickerOpen ? (
        <div style={pickerOverlay()}>
          <div style={pickerCard()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div style={{ fontWeight: 1000 }}>Badge Library Files</div>
              <button onClick={() => setPickerOpen(false)} style={btnGhost()}>
                Close
              </button>
            </div>
            {pickerError ? <div style={notice()}>{pickerError}</div> : null}
            {pickerLoading ? <div style={{ opacity: 0.7 }}>Loading...</div> : null}
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", marginTop: 12 }}>
              {bucketFiles.map((f) => (
                <button
                  key={f.path}
                  onClick={() => selectFromBucket(f.public_url)}
                  style={pickerItem()}
                  title={f.path}
                >
                  <img src={f.public_url} alt={f.path} style={{ width: "100%", height: 110, objectFit: "contain" }} />
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 6 }}>{f.path.replace("library/", "")}</div>
                </button>
              ))}
              {!pickerLoading && !bucketFiles.length ? (
                <div style={{ opacity: 0.7 }}>No files found in badges/library.</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <section style={{ display: "grid", gap: 12 }}>
        <div style={{ fontWeight: 1000, fontSize: 16 }}>Achievements</div>
        <div style={categoryRow()}>
          <button
            onClick={() => setAchievementCategoryFilter("all")}
            style={categoryChip(achievementCategoryFilter === "all")}
          >
            All categories
          </button>
          {achievementCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setAchievementCategoryFilter(cat)}
              style={categoryChip(achievementCategoryFilter === cat)}
            >
              {cat}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <label style={labelInline()}>
            Criteria filter
            <select
              value={achievementCriteriaFilter}
              onChange={(e) => setAchievementCriteriaFilter(e.target.value)}
              style={input()}
            >
              <option value="all">All criteria</option>
              {criteriaTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label style={labelInline()}>
            Quick criteria
            <select
              value={criteriaDraft}
              onChange={(e) => {
                const value = e.target.value;
                setCriteriaDraft(value);
                if (value) setNewAchievement((prev) => ({ ...prev, criteria_type: value }));
              }}
              style={input()}
            >
              <option value="">Set new achievement criteria</option>
              {criteriaTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div style={card()}>
          <div style={{ display: "grid", gap: 10 }}>
            <label style={labelStyle()}>
              Achievement id (unique)
              <input
                value={newAchievement.id}
                onChange={(e) => setNewAchievement((prev) => ({ ...prev, id: e.target.value }))}
                style={input()}
              />
            </label>
            <label style={labelStyle()}>
              Achievement name
              <input
                value={newAchievement.name}
                onChange={(e) => setNewAchievement((prev) => ({ ...prev, name: e.target.value }))}
                style={input()}
              />
            </label>
            <label style={labelStyle()}>
              Category
              <input
                value={newAchievement.category ?? ""}
                onChange={(e) => setNewAchievement((prev) => ({ ...prev, category: e.target.value }))}
                style={input()}
              />
            </label>
            <label style={labelStyle()}>
              Legacy icon path (optional)
              <input
                value={newAchievement.icon_path ?? ""}
                onChange={(e) => setNewAchievement((prev) => ({ ...prev, icon_path: e.target.value }))}
                style={input()}
              />
            </label>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 900 }}>Badge image</div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                {newAchievement.badge_library_id ? (
                  <div style={badgePreview()}>
                    <img
                      src={library.find((b) => b.id === newAchievement.badge_library_id)?.image_url ?? ""}
                      alt="Selected badge"
                      style={{ width: 64, height: 64, objectFit: "contain" }}
                    />
                  </div>
                ) : (
                  <div style={badgeEmpty()}>No badge selected</div>
                )}
                <button type="button" onClick={() => openBadgePicker({ type: "newAchievement" })} style={btnGhost()}>
                  Choose from library
                </button>
              </div>
            </div>
            <label style={labelStyle()}>
              Points awarded
              <input
                type="number"
                value={newAchievement.points_award ?? 0}
                onChange={(e) => setNewAchievement((prev) => ({ ...prev, points_award: Number(e.target.value) }))}
                style={input()}
              />
            </label>
            <label style={labelStyle()}>
              Criteria type
              <select
                value={newAchievement.criteria_type ?? ""}
                onChange={(e) => setNewAchievement((prev) => ({ ...prev, criteria_type: e.target.value }))}
                style={input()}
              >
                <option value="">Select criteria type</option>
                {criteriaTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 11, opacity: 0.6 }}>Choose what data powers the award.</div>
            </label>
            {newAchievement.criteria_type === "data_point" ? (
              <div style={{ display: "grid", gap: 10 }}>
                <label style={labelStyle()}>
                  Data point
                  <select
                    value={String(newAchievement.criteria_json?.data_point_key ?? "")}
                    onChange={(e) =>
                      setNewAchievement((prev) => ({
                        ...prev,
                        criteria_json: updateCriteriaJson(prev.criteria_json, { data_point_key: e.target.value }),
                      }))
                    }
                    style={input()}
                  >
                    <option value="">Select data point</option>
                    {dataPoints.filter((d) => d.enabled !== false).map((d) => (
                      <option key={d.key} value={d.key}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                  <div style={{ fontSize: 11, opacity: 0.6 }}>
                    {dataPoints.find((d) => d.key === newAchievement.criteria_json?.data_point_key)?.description ??
                      "Choose a tracked metric."}
                  </div>
                </label>
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
                  <label style={labelStyle()}>
                    Compare
                    <select
                      value={String(newAchievement.criteria_json?.compare ?? ">=")}
                      onChange={(e) =>
                        setNewAchievement((prev) => ({
                          ...prev,
                          criteria_json: updateCriteriaJson(prev.criteria_json, { compare: e.target.value }),
                        }))
                      }
                      style={input()}
                    >
                      {compares.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label style={labelStyle()}>
                    Threshold
                    <input
                      type="number"
                      value={String(newAchievement.criteria_json?.threshold ?? "")}
                      onChange={(e) =>
                        setNewAchievement((prev) => ({
                          ...prev,
                          criteria_json: updateCriteriaJson(prev.criteria_json, {
                            threshold: e.target.value === "" ? "" : Number(e.target.value),
                          }),
                        }))
                      }
                      style={input()}
                    />
                  </label>
                  <label style={labelStyle()}>
                    Window days
                    <input
                      type="number"
                      value={String(newAchievement.criteria_json?.window_days ?? "")}
                      onChange={(e) =>
                        setNewAchievement((prev) => ({
                          ...prev,
                          criteria_json: updateCriteriaJson(prev.criteria_json, {
                            window_days: e.target.value === "" ? "" : Number(e.target.value),
                          }),
                        }))
                      }
                      style={input()}
                    />
                  </label>
                </div>
              </div>
            ) : null}
            <label style={labelStyle()}>
              Criteria JSON
              <textarea
                value={JSON.stringify(newAchievement.criteria_json ?? {}, null, 2)}
                onChange={(e) => {
                  try {
                    setNewAchievement((prev) => ({ ...prev, criteria_json: JSON.parse(e.target.value || "{}") }));
                  } catch {}
                }}
                style={textarea()}
              />
              <div style={{ fontSize: 11, opacity: 0.6 }}>Only needed for custom thresholds.</div>
            </label>
            <label style={checkboxRow()}>
              <input
                type="checkbox"
                checked={newAchievement.enabled !== false}
                onChange={(e) => setNewAchievement((prev) => ({ ...prev, enabled: e.target.checked }))}
              />
              Enabled
            </label>
            <button onClick={() => saveAchievement(newAchievement)} style={btn()} disabled={saving}>
              Save Achievement
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
          {filteredAchievements.map((row) => (
            <div key={row.id} style={card()}>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ fontWeight: 900 }}>{row.id}</div>
                <label style={labelStyle()}>
                  Achievement name
                  <input
                    value={row.name}
                    onChange={(e) => setAchievements((prev) => prev.map((r) => (r.id === row.id ? { ...r, name: e.target.value } : r)))}
                    style={input()}
                  />
                </label>
                <label style={labelStyle()}>
                  Category
                  <input
                    value={row.category ?? ""}
                    onChange={(e) => setAchievements((prev) => prev.map((r) => (r.id === row.id ? { ...r, category: e.target.value } : r)))}
                    style={input()}
                  />
                </label>
                <label style={labelStyle()}>
                  Legacy icon path
                  <input
                    value={row.icon_path ?? ""}
                    onChange={(e) => setAchievements((prev) => prev.map((r) => (r.id === row.id ? { ...r, icon_path: e.target.value } : r)))}
                    style={input()}
                  />
                </label>
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontWeight: 900 }}>Badge image</div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    {row.badge_library_id ? (
                      <div style={badgePreview()}>
                        <img
                          src={library.find((b) => b.id === row.badge_library_id)?.image_url ?? ""}
                          alt="Selected badge"
                          style={{ width: 64, height: 64, objectFit: "contain" }}
                        />
                      </div>
                    ) : (
                      <div style={badgeEmpty()}>No badge selected</div>
                    )}
                    <button type="button" onClick={() => openBadgePicker({ type: "achievement", id: row.id })} style={btnGhost()}>
                      Choose from library
                    </button>
                  </div>
                </div>
                <label style={labelStyle()}>
                  Points awarded
                  <input
                    type="number"
                    value={row.points_award ?? 0}
                    onChange={(e) => setAchievements((prev) => prev.map((r) => (r.id === row.id ? { ...r, points_award: Number(e.target.value) } : r)))}
                    style={input()}
                  />
                </label>
                <label style={labelStyle()}>
                  Criteria type
                  <select
                    value={row.criteria_type ?? ""}
                    onChange={(e) => setAchievements((prev) => prev.map((r) => (r.id === row.id ? { ...r, criteria_type: e.target.value } : r)))}
                    style={input()}
                  >
                    <option value="">Select criteria type</option>
                    {criteriaTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                {row.criteria_type === "data_point" ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    <label style={labelStyle()}>
                      Data point
                      <select
                        value={String(row.criteria_json?.data_point_key ?? "")}
                        onChange={(e) =>
                          setAchievements((prev) =>
                            prev.map((r) =>
                              r.id === row.id
                                ? { ...r, criteria_json: updateCriteriaJson(r.criteria_json, { data_point_key: e.target.value }) }
                                : r
                            )
                          )
                        }
                        style={input()}
                      >
                        <option value="">Select data point</option>
                        {dataPoints.filter((d) => d.enabled !== false).map((d) => (
                          <option key={d.key} value={d.key}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                      <div style={{ fontSize: 11, opacity: 0.6 }}>
                        {dataPoints.find((d) => d.key === row.criteria_json?.data_point_key)?.description ??
                          "Choose a tracked metric."}
                      </div>
                    </label>
                    <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
                      <label style={labelStyle()}>
                        Compare
                        <select
                          value={String(row.criteria_json?.compare ?? ">=")}
                          onChange={(e) =>
                            setAchievements((prev) =>
                              prev.map((r) =>
                                r.id === row.id
                                  ? { ...r, criteria_json: updateCriteriaJson(r.criteria_json, { compare: e.target.value }) }
                                  : r
                              )
                            )
                          }
                          style={input()}
                        >
                          {compares.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </label>
                      <label style={labelStyle()}>
                        Threshold
                        <input
                          type="number"
                          value={String(row.criteria_json?.threshold ?? "")}
                          onChange={(e) =>
                            setAchievements((prev) =>
                              prev.map((r) =>
                                r.id === row.id
                                  ? {
                                      ...r,
                                      criteria_json: updateCriteriaJson(r.criteria_json, {
                                        threshold: e.target.value === "" ? "" : Number(e.target.value),
                                      }),
                                    }
                                  : r
                              )
                            )
                          }
                          style={input()}
                        />
                      </label>
                      <label style={labelStyle()}>
                        Window days
                        <input
                          type="number"
                          value={String(row.criteria_json?.window_days ?? "")}
                          onChange={(e) =>
                            setAchievements((prev) =>
                              prev.map((r) =>
                                r.id === row.id
                                  ? {
                                      ...r,
                                      criteria_json: updateCriteriaJson(r.criteria_json, {
                                        window_days: e.target.value === "" ? "" : Number(e.target.value),
                                      }),
                                    }
                                  : r
                              )
                            )
                          }
                          style={input()}
                        />
                      </label>
                    </div>
                  </div>
                ) : null}
                <label style={labelStyle()}>
                  Criteria JSON
                  <textarea
                    value={JSON.stringify(row.criteria_json ?? {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const json = JSON.parse(e.target.value || "{}");
                        setAchievements((prev) => prev.map((r) => (r.id === row.id ? { ...r, criteria_json: json } : r)));
                      } catch {}
                    }}
                    style={textarea()}
                  />
                </label>
                <label style={checkboxRow()}>
                  <input
                    type="checkbox"
                    checked={row.enabled !== false}
                    onChange={(e) => setAchievements((prev) => prev.map((r) => (r.id === row.id ? { ...r, enabled: e.target.checked } : r)))}
                  />
                  Enabled
                </label>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button onClick={() => saveAchievement(row)} style={btn()} disabled={saving}>
                    Save
                  </button>
                  <button onClick={() => applyRetroactive(row.id)} style={btnGhost()} disabled={saving}>
                    Apply Retroactive Points
                  </button>
                  {savedId === row.id ? <div style={savedBadge()}>Saved</div> : null}
                </div>
              </div>
            </div>
          ))}
          {!achievements.length && <div style={{ opacity: 0.7 }}>No achievements yet.</div>}
        </div>
      </section>

      {badgePickerOpen ? (
        <div style={pickerOverlay()}>
          <div style={pickerCard()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div style={{ fontWeight: 1000 }}>Select a Badge Image</div>
              <button onClick={() => setBadgePickerOpen(false)} style={btnGhost()}>
                Close
              </button>
            </div>
            <div style={{ marginTop: 10, ...categoryRow() }}>
              {[
                "all",
                ...Array.from(new Set(library.map((b) => String(b.category ?? "").trim()).filter(Boolean))).sort(),
              ].map((cat) => (
                <button
                  key={cat || "uncategorized"}
                  onClick={() => setBadgePickerCategory(cat || "all")}
                  style={categoryChip(badgePickerCategory === (cat || "all"))}
                >
                  {cat === "all" ? "All Categories" : cat}
                </button>
              ))}
            </div>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", marginTop: 12 }}>
              {library
                .filter((b) => b.enabled !== false)
                .filter((b) => badgePickerCategory === "all" || String(b.category ?? "").trim() === badgePickerCategory)
                .map((b) => (
                  <button
                    key={b.id}
                    onClick={() => selectBadgeFromLibrary(String(b.id))}
                    style={pickerItem()}
                    title={b.name}
                  >
                    <img src={b.image_url ?? ""} alt={b.name} style={{ width: "100%", height: 110, objectFit: "contain" }} />
                    <div style={{ fontSize: 12, fontWeight: 900, marginTop: 6 }}>{b.name}</div>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>{b.category ?? "Uncategorized"}</div>
                  </button>
                ))}
              {!library.length ? <div style={{ opacity: 0.7 }}>No badges in the library yet.</div> : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function card(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    display: "grid",
    gap: 10,
  };
}

function input(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.35)",
    color: "white",
    fontWeight: 900,
  };
}

function textarea(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.35)",
    color: "white",
    fontWeight: 900,
    minHeight: 90,
    resize: "vertical",
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

function btnGhost(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.06)",
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

function checkboxRow(): React.CSSProperties {
  return {
    display: "flex",
    gap: 8,
    alignItems: "center",
    fontSize: 12,
    opacity: 0.8,
  };
}

function pickerOverlay(): React.CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    background: "rgba(2,6,23,0.65)",
    display: "grid",
    placeItems: "center",
    zIndex: 80,
    padding: 20,
  };
}

function pickerCard(): React.CSSProperties {
  return {
    width: "min(960px, 96vw)",
    maxHeight: "90vh",
    overflow: "auto",
    borderRadius: 18,
    padding: 16,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(7,10,16,0.95)",
    boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
  };
}

function pickerItem(): React.CSSProperties {
  return {
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
    padding: 10,
    textAlign: "left",
    cursor: "pointer",
  };
}

function categoryRow(): React.CSSProperties {
  return {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  };
}

function categoryChip(active: boolean): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 999,
    border: active ? "1px solid rgba(56,189,248,0.6)" : "1px solid rgba(255,255,255,0.18)",
    background: active ? "rgba(56,189,248,0.18)" : "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
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

function labelInline(): React.CSSProperties {
  return {
    display: "grid",
    gap: 6,
    fontSize: 12,
    fontWeight: 900,
    color: "rgba(255,255,255,0.85)",
  };
}

function badgePreview(): React.CSSProperties {
  return {
    width: 72,
    height: 72,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.3)",
    display: "grid",
    placeItems: "center",
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

function callout(): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: "10px 12px",
    border: "1px solid rgba(56,189,248,0.35)",
    background: "rgba(15,23,42,0.6)",
    fontSize: 12,
    fontWeight: 900,
  };
}

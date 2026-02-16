"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ChallengeRow = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  tier: string;
  enabled?: boolean;
  badge_id?: string | null;
  challenge_type?: string | null;
  quota_type?: string | null;
  quota_target?: number | null;
  stat_id?: string | null;
  stat_threshold?: number | null;
  stat_compare?: string | null;
  data_point_key?: string | null;
  data_point_window_days?: number | null;
  points_awarded?: number | null;
  limit_mode?: string | null;
  limit_count?: number | null;
  limit_window_days?: number | null;
  daily_limit_count?: number | null;
};

type StatRow = { id: string; name: string };
type DataPointRow = { key: string; label: string; description?: string | null; unit?: string | null; default_compare?: string | null; enabled?: boolean };
type BadgeRow = { id: string; name: string };
type MedalRow = { tier: string; badge_library_id: string | null };
type LibraryRow = { id: string; name: string; image_url: string | null; enabled?: boolean };

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 180)}` } };
  }
}

const tiers = ["bronze", "silver", "gold", "platinum", "diamond", "master"];
const defaultTierDefaults: Record<string, number> = {
  bronze: 15,
  silver: 30,
  gold: 60,
  platinum: 100,
  diamond: 200,
  master: 500,
};
const compares = [">=", "<=", ">", "<", "="];
const limitModes = ["once", "daily", "weekly", "monthly", "yearly", "lifetime", "custom"];
const challengeTypes = ["task", "quota", "stat", "data"];

export default function ChallengesAdminPage() {
  const [rows, setRows] = useState<ChallengeRow[]>([]);
  const [stats, setStats] = useState<StatRow[]>([]);
  const [dataPoints, setDataPoints] = useState<DataPointRow[]>([]);
  const [badges, setBadges] = useState<BadgeRow[]>([]);
  const [medals, setMedals] = useState<MedalRow[]>([]);
  const [library, setLibrary] = useState<LibraryRow[]>([]);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [filterTier, setFilterTier] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "editor">("cards");
  const [limitEditor, setLimitEditor] = useState<{
    rowId: string;
    challengeType: string;
    limitMode: string;
    limitCount: string;
    limitWindowDays: string;
    dailyLimitCount: string;
    quotaType: string;
    quotaTarget: string;
  } | null>(null);
  const [tab, setTab] = useState<"medals" | "challenges">("challenges");
  const [categoryDraft, setCategoryDraft] = useState("");
  const [extraCategories, setExtraCategories] = useState<string[]>([]);
  const [tierDefaults, setTierDefaults] = useState<Record<string, number>>({ ...defaultTierDefaults });

  const [draft, setDraft] = useState<ChallengeRow>({
    id: "",
    name: "",
    description: "",
    category: "",
    tier: "bronze",
    enabled: true,
    badge_id: "",
    challenge_type: "task",
    quota_type: "",
    quota_target: null,
    stat_id: "",
    stat_threshold: null,
    stat_compare: ">=",
    data_point_key: "",
    data_point_window_days: null,
    points_awarded: null,
    limit_mode: "once",
    limit_count: 1,
    limit_window_days: null,
    daily_limit_count: null,
  });

  async function loadAll() {
    const [cRes, sRes, bRes, dRes] = await Promise.all([
      fetch("/api/admin/challenges/list", { cache: "no-store" }),
      fetch("/api/admin/stats/list", { cache: "no-store" }),
      fetch("/api/achievements/badges", { cache: "no-store" }),
      fetch("/api/admin/data-points/list", { cache: "no-store" }),
    ]);

    const cJson = await safeJson(cRes);
    if (!cJson.ok) return setMsg(cJson.json?.error || "Failed to load challenges");
    setRows((cJson.json?.challenges ?? []) as ChallengeRow[]);

    const sJson = await safeJson(sRes);
    if (sJson.ok) setStats((sJson.json?.stats ?? []) as StatRow[]);

    const bJson = await safeJson(bRes);
    if (bJson.ok) setBadges((bJson.json?.badges ?? []) as BadgeRow[]);

    const dJson = await safeJson(dRes);
    if (dJson.ok) setDataPoints((dJson.json?.data_points ?? []) as DataPointRow[]);
  }

  async function loadTierDefaults() {
    const res = await fetch("/api/admin/challenges/tier-defaults", { cache: "no-store" });
    const sj = await safeJson(res);
    if (sj.ok) setTierDefaults((sj.json?.defaults ?? {}) as Record<string, number>);
  }

  async function saveTierDefaults() {
    const res = await fetch("/api/admin/challenges/tier-defaults", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaults: tierDefaults }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to save tier defaults");
    setMsg("Tier defaults saved.");
  }

  async function loadMedals() {
    const res = await fetch("/api/admin/challenges/medals", { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return;
    setMedals((sj.json?.medals ?? []) as MedalRow[]);
    setLibrary((sj.json?.badgeLibrary ?? []) as LibraryRow[]);
  }

  useEffect(() => {
    loadAll();
    loadMedals();
    loadTierDefaults();
  }, []);

  async function saveMedal(tier: string, badge_library_id: string | null) {
    const res = await fetch("/api/admin/challenges/medals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier, badge_library_id }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to save medal image");
    await loadMedals();
  }

  const categories = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      const c = String(r.category ?? "").trim();
      if (c) set.add(c);
    });
    extraCategories.forEach((c) => set.add(c));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows, extraCategories]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filterTier !== "all" && r.tier !== filterTier) return false;
      if (filterType !== "all" && (r.challenge_type ?? "task") !== filterType) return false;
      if (filterCategory !== "all" && (r.category ?? "") !== filterCategory) return false;
      if (q) {
        const hay = `${String(r.id ?? "")} ${String(r.name ?? "")} ${String(r.description ?? "")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filterTier, filterType, filterCategory, search]);

  function slugify(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  async function saveRow(row: ChallengeRow) {
    if (!row.id) return setMsg("Challenge ID required.");
    if (!row.name) return setMsg("Challenge name required.");
    setSaving((prev) => ({ ...prev, [row.id]: true }));
    const res = await fetch("/api/admin/challenges/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
    const sj = await safeJson(res);
    if (!sj.ok) {
      setSaving((prev) => ({ ...prev, [row.id]: false }));
      return setMsg(sj.json?.error || "Failed to save challenge");
    }
    await loadAll();
    setSaving((prev) => ({ ...prev, [row.id]: false }));
  }

  async function deleteRow(row: ChallengeRow) {
    const yes = window.confirm(`Delete challenge "${row.name}"?\n\nThis also removes related student completion rows.`);
    if (!yes) return;
    setDeleting((prev) => ({ ...prev, [row.id]: true }));
    const res = await fetch("/api/admin/challenges/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id }),
    });
    const sj = await safeJson(res);
    setDeleting((prev) => ({ ...prev, [row.id]: false }));
    if (!sj.ok) return setMsg(sj.json?.error || "Failed to delete challenge");
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    setMsg("Challenge deleted.");
  }

  function openLimitEditor(row: ChallengeRow) {
    setLimitEditor({
      rowId: row.id,
      challengeType: String(row.challenge_type ?? "task"),
      limitMode: String(row.limit_mode ?? "once"),
      limitCount: String(Number(row.limit_count ?? 1)),
      limitWindowDays: row.limit_window_days == null ? "" : String(Number(row.limit_window_days)),
      dailyLimitCount: row.daily_limit_count == null ? "" : String(Number(row.daily_limit_count)),
      quotaType: String(row.quota_type ?? ""),
      quotaTarget: row.quota_target == null ? "" : String(Number(row.quota_target)),
    });
  }

  function applyLimitEditor() {
    if (!limitEditor) return;
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== limitEditor.rowId) return r;
        const nextLimitCount = Number(limitEditor.limitCount);
        const nextWindow = limitEditor.limitWindowDays.trim() === "" ? null : Number(limitEditor.limitWindowDays);
        const nextDailyLimit = limitEditor.dailyLimitCount.trim() === "" ? null : Number(limitEditor.dailyLimitCount);
        const nextQuotaTarget = limitEditor.quotaTarget.trim() === "" ? null : Number(limitEditor.quotaTarget);
        return {
          ...r,
          limit_mode: limitEditor.limitMode,
          limit_count: Number.isFinite(nextLimitCount) && nextLimitCount > 0 ? nextLimitCount : 1,
          limit_window_days: Number.isFinite(Number(nextWindow)) ? nextWindow : null,
          daily_limit_count: Number.isFinite(Number(nextDailyLimit)) && Number(nextDailyLimit) > 0 ? nextDailyLimit : null,
          quota_type: limitEditor.quotaType,
          quota_target: Number.isFinite(Number(nextQuotaTarget)) ? nextQuotaTarget : null,
        };
      })
    );
    setLimitEditor(null);
  }

  async function createChallenge() {
    const id = draft.id.trim() || slugify(draft.name);
    if (!id) return setMsg("Challenge ID required.");
    await saveRow({ ...draft, id });
    setDraft({
      id: "",
      name: "",
      description: "",
      category: "",
      tier: "bronze",
      enabled: true,
      badge_id: "",
      challenge_type: "task",
      quota_type: "",
      quota_target: null,
      stat_id: "",
      stat_threshold: null,
      stat_compare: ">=",
      data_point_key: "",
      data_point_window_days: null,
      limit_mode: "once",
      limit_count: 1,
      limit_window_days: null,
      daily_limit_count: null,
      points_awarded: null,
    });
  }

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 1000 }}>Challenge Vault</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Create completion, quota, and stat-driven challenges.</div>
        </div>
        <Link href="/admin/custom" style={backLink()}>
          Return to Admin Workspace
        </Link>
      </div>

      {msg ? <div style={notice()}>{msg}</div> : null}

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => setTab("challenges")} style={tabBtn(tab === "challenges")}>Challenges</button>
        <button onClick={() => setTab("medals")} style={tabBtn(tab === "medals")}>Challenge Medal Images</button>
      </div>

      {tab === "medals" ? (
        <section style={card()}>
          <div style={{ fontWeight: 1000 }}>Challenge Medal Images</div>
          <div style={{ opacity: 0.7, fontSize: 12, marginTop: 6 }}>
            Pick medal art for each tier from Supabase storage (badges/challenge).
          </div>
          {!library.length ? (
            <div style={warningBox()}>
              No images found in <b>badges/challenge</b> storage. Upload files there (png/jpg/svg/webp) to populate the picker.
            </div>
          ) : null}
          <div style={medalGrid()}>
            {tiers.map((tier) => {
              const current = medals.find((m) => m.tier === tier)?.badge_library_id ?? "";
              const preview = library.find((b) => b.id === current)?.image_url ?? null;
              const options = library.filter((b) => b.enabled !== false);
              return (
                <div key={tier} style={medalTierCard()}>
                  <div style={medalTierTitle()}>{tier}</div>
                  <div style={medalPreview()}>
                    {preview ? <img src={preview} alt={`${tier} medal`} style={medalPreviewImg()} /> : <span>—</span>}
                  </div>
                  <div style={medalLibraryGrid()}>
                    <button type="button" onClick={() => saveMedal(tier, null)} style={medalOption(!current)}>
                      <div style={medalOptionThumb()}>None</div>
                      <div style={medalOptionLabel()}>No image</div>
                    </button>
                    {options.map((b) => (
                      <button key={b.id} type="button" onClick={() => saveMedal(tier, b.id)} style={medalOption(b.id === current)}>
                        <div style={medalOptionThumb()}>
                          {b.image_url ? (
                            <img src={b.image_url} alt={b.name} style={medalOptionImg()} />
                          ) : (
                            <span>?</span>
                          )}
                        </div>
                        <div style={medalOptionLabel()}>{b.name}</div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <>
          <section style={card()}>
            <div style={{ fontWeight: 1000 }}>Add New Category</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>
              Categories help filter challenges and organize dashboards.
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <label style={label()}>
                Category name
                <input
                  value={categoryDraft}
                  onChange={(e) => setCategoryDraft(e.target.value)}
                  style={input()}
                />
              </label>
              <button
                onClick={() => {
                  const next = categoryDraft.trim();
                  if (!next) return;
                  setExtraCategories((prev) => (prev.includes(next) ? prev : [...prev, next]));
                  setDraft((d) => ({ ...d, category: next }));
                  setCategoryDraft("");
                }}
                style={btn()}
              >
                Add Category
              </button>
            </div>
          </section>

          <div style={card()}>
            <div style={{ fontWeight: 1000 }}>Add Challenge</div>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1.2fr 1fr 1fr 1fr" }}>
              <label style={label()}>
                Challenge name
                <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} style={input()} />
              </label>
              <label style={label()}>
                Challenge ID
                <input value={draft.id} onChange={(e) => setDraft((d) => ({ ...d, id: e.target.value }))} style={input()} />
                <div style={hint()}>Auto-generated if blank.</div>
              </label>
              <label style={label()}>
                Tier
                <select
                  value={draft.tier}
                  onChange={(e) => {
                    const nextTier = e.target.value;
                    setDraft((d) => ({
                      ...d,
                      tier: nextTier,
                      points_awarded: d.points_awarded ?? tierDefaults[nextTier] ?? d.points_awarded,
                    }));
                  }}
                  style={input()}
                >
                  {tiers.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label style={label()}>
                Challenge type
                <select value={draft.challenge_type ?? "task"} onChange={(e) => setDraft((d) => ({ ...d, challenge_type: e.target.value }))} style={input()}>
                  {challengeTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr" }}>
              <label style={label()}>
                Category
                <input
                  list="challenge-category-list"
                  value={draft.category ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                  style={input()}
                />
              </label>
              <label style={label()}>
                Badge reward
                <select value={draft.badge_id ?? ""} onChange={(e) => setDraft((d) => ({ ...d, badge_id: e.target.value }))} style={input()}>
                  <option value="">No badge</option>
                  {badges.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </label>
              <label style={label()}>
                Limit mode
                <select value={draft.limit_mode ?? "once"} onChange={(e) => setDraft((d) => ({ ...d, limit_mode: e.target.value }))} style={input()}>
                  {limitModes.map((m) => (
                    <option key={m} value={m}>{m === "yearly" ? "annual" : m}</option>
                  ))}
                </select>
              </label>
            </div>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr" }}>
              <label style={label()}>
                Points awarded
                <input
                  type="number"
                  value={draft.points_awarded ?? tierDefaults[draft.tier] ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, points_awarded: Number(e.target.value) }))}
                  style={input()}
                />
              </label>
              <label style={label()}>
                Limit count
                <input type="number" value={draft.limit_count ?? 1} onChange={(e) => setDraft((d) => ({ ...d, limit_count: Number(e.target.value) }))} style={input()} />
              </label>
              <label style={label()}>
                Limit window (days)
                <input type="number" value={draft.limit_window_days ?? ""} onChange={(e) => setDraft((d) => ({ ...d, limit_window_days: Number(e.target.value) }))} style={input()} />
                <div style={hint()}>Used only for custom windows.</div>
              </label>
              <label style={label()}>
                Daily cap (optional)
                <input
                  type="number"
                  value={draft.daily_limit_count ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, daily_limit_count: Number(e.target.value) || null }))}
                  style={input()}
                />
                <div style={hint()}>Optional second limit. Example: monthly 5 + daily 1.</div>
              </label>
            </div>
            <label style={label()}>
              Description
              <textarea value={draft.description ?? ""} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} style={textarea()} />
            </label>

            {(draft.challenge_type === "quota") ? (
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
                <label style={label()}>
                  Quota type
                  <input value={draft.quota_type ?? ""} onChange={(e) => setDraft((d) => ({ ...d, quota_type: e.target.value }))} style={input()} />
                  <div style={hint()}>Examples: checkins, skills, points.</div>
                </label>
                <label style={label()}>
                  Quota target
                  <input type="number" value={draft.quota_target ?? ""} onChange={(e) => setDraft((d) => ({ ...d, quota_target: Number(e.target.value) }))} style={input()} />
                </label>
              </div>
            ) : null}

            {(draft.challenge_type === "stat") ? (
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr" }}>
                <label style={label()}>
                  Stat source
                  <select value={draft.stat_id ?? ""} onChange={(e) => setDraft((d) => ({ ...d, stat_id: e.target.value }))} style={input()}>
                    <option value="">Select stat</option>
                    {stats.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <div style={hint()}>Choose a tracked performance metric.</div>
                </label>
                <label style={label()}>
                  Comparison
                  <select value={draft.stat_compare ?? ">="} onChange={(e) => setDraft((d) => ({ ...d, stat_compare: e.target.value }))} style={input()}>
                    {compares.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label style={label()}>
                  Threshold value
                  <input type="number" value={draft.stat_threshold ?? ""} onChange={(e) => setDraft((d) => ({ ...d, stat_threshold: Number(e.target.value) }))} style={input()} />
                </label>
              </div>
            ) : null}

            {(draft.challenge_type === "data") ? (
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr" }}>
                <label style={label()}>
                  Data point
                  <select
                    value={draft.data_point_key ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, data_point_key: e.target.value }))}
                    style={input()}
                  >
                    <option value="">Select data point</option>
                    {dataPoints.filter((d) => d.enabled !== false).map((d) => (
                      <option key={d.key} value={d.key}>{d.label}</option>
                    ))}
                  </select>
                  <div style={hint()}>
                    {dataPoints.find((d) => d.key === draft.data_point_key)?.description ?? "Choose a tracked metric."}
                  </div>
                </label>
                <label style={label()}>
                  Comparison
                  <select value={draft.stat_compare ?? ">="} onChange={(e) => setDraft((d) => ({ ...d, stat_compare: e.target.value }))} style={input()}>
                    {compares.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label style={label()}>
                  Threshold value
                  <input type="number" value={draft.stat_threshold ?? ""} onChange={(e) => setDraft((d) => ({ ...d, stat_threshold: Number(e.target.value) }))} style={input()} />
                </label>
                <label style={label()}>
                  Window days (optional)
                  <input
                    type="number"
                    value={draft.data_point_window_days ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, data_point_window_days: Number(e.target.value) }))}
                    style={input()}
                  />
                </label>
              </div>
            ) : null}

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr auto" }}>
              <div />
              <button onClick={createChallenge} style={btn()}>Add Challenge</button>
            </div>
          </div>

          <section style={card()}>
            <div style={{ fontWeight: 1000 }}>Tier Default Points</div>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(6, minmax(120px, 1fr))" }}>
              {tiers.map((t) => (
                <label key={t} style={label()}>
                  {t}
                  <input
                    type="number"
                    value={tierDefaults[t] ?? ""}
                    onChange={(e) => setTierDefaults((prev) => ({ ...prev, [t]: Number(e.target.value) }))}
                    style={input()}
                  />
                </label>
              ))}
            </div>
            <div style={{ display: "grid", justifyContent: "end" }}>
              <button onClick={saveTierDefaults} style={btn()}>Save Defaults</button>
            </div>
          </section>

          <div style={chipWrap()}>
            <button type="button" onClick={() => setFilterCategory("all")} style={chipBtn(filterCategory === "all")}>
              All
            </button>
            {categories.map((c) => (
              <button key={c} type="button" onClick={() => setFilterCategory(c)} style={chipBtn(filterCategory === c)}>
                {c}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <select value={filterTier} onChange={(e) => setFilterTier(e.target.value)} style={input()}>
              <option value="all">All tiers</option>
              {tiers.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={input()}>
              <option value="all">All types</option>
              {challengeTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search challenge..."
              style={input()}
            />
            <button onClick={() => setSearch(searchInput)} style={btn()}>
              Search
            </button>
            <button onClick={() => setViewMode((v) => (v === "cards" ? "editor" : "cards"))} style={btn()}>
              {viewMode === "cards" ? "Switch to Full Editor" : "Switch to Card View"}
            </button>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <datalist id="challenge-category-list">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            {viewMode === "cards" ? (
              <div style={challengeCardGrid()}>
                {filtered.map((row, idx) => (
                  <div key={row.id} style={challengeCompactCard(idx % 2 === 1)}>
                    <div style={{ display: "grid", gap: 6 }}>
                      <input value={row.name} onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, name: e.target.value } : r)))} style={input()} />
                      <div style={hint()}>{row.id}</div>
                    </div>
                    <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
                      <select value={row.tier ?? "bronze"} onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, tier: e.target.value } : r)))} style={input()}>
                        {tiers.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      <select value={row.challenge_type ?? "task"} onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, challenge_type: e.target.value } : r)))} style={input()}>
                        {challengeTypes.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <input
                      list="challenge-category-list"
                      value={row.category ?? ""}
                      onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, category: e.target.value } : r)))}
                      placeholder="Category"
                      style={input()}
                    />
                    <input
                      type="number"
                      value={row.points_awarded ?? tierDefaults[String(row.tier ?? "bronze")] ?? ""}
                      onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, points_awarded: Number(e.target.value) } : r)))}
                      placeholder="Points awarded"
                      style={input()}
                    />
                    <button onClick={() => openLimitEditor(row)} style={btn()}>
                      Edit Limits + Quota
                    </button>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, opacity: 0.85 }}>
                      <input
                        type="checkbox"
                        checked={row.enabled !== false}
                        onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, enabled: e.target.checked } : r)))}
                      />
                      Enabled
                    </label>
                    <div style={challengeSummary()}>
                      {buildChallengeSummary(row)}
                    </div>
                    <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
                      <button onClick={() => saveRow(row)} style={btn()} disabled={!!saving[row.id]}>
                        {saving[row.id] ? "Saving..." : "Save"}
                      </button>
                      <button onClick={() => deleteRow(row)} style={dangerBtn()} disabled={!!deleting[row.id]}>
                        {deleting[row.id] ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              filtered.map((row, idx) => (
              <div key={row.id} style={smallCard(idx % 2 === 1)}>
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
                    <input value={row.name} onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, name: e.target.value } : r)))} style={input()} />
                    <input value={row.id} disabled style={input()} />
                    <select
                      value={row.tier ?? "bronze"}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r) =>
                            r.id === row.id
                              ? { ...r, tier: e.target.value, points_awarded: r.points_awarded ?? tierDefaults[e.target.value] ?? r.points_awarded }
                              : r
                          )
                        )
                      }
                      style={input()}
                    >
                      {tiers.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <select value={row.challenge_type ?? "task"} onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, challenge_type: e.target.value } : r)))} style={input()}>
                      {challengeTypes.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr" }}>
                    <input
                      list="challenge-category-list"
                      value={row.category ?? ""}
                      onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, category: e.target.value } : r)))}
                      placeholder="Category"
                      style={input()}
                    />
                    <select value={row.badge_id ?? ""} onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, badge_id: e.target.value } : r)))} style={input()}>
                      <option value="">No badge</option>
                      {badges.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    <select value={row.limit_mode ?? "once"} onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, limit_mode: e.target.value } : r)))} style={input()}>
                      {limitModes.map((m) => (
                        <option key={m} value={m}>{m === "yearly" ? "annual" : m}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr" }}>
                    <input
                      type="number"
                      value={row.points_awarded ?? tierDefaults[String(row.tier ?? "bronze")] ?? ""}
                      onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, points_awarded: Number(e.target.value) } : r)))}
                      placeholder="Points awarded"
                      style={input()}
                    />
                    <input
                      type="number"
                      value={row.daily_limit_count ?? ""}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r) => (r.id === row.id ? { ...r, daily_limit_count: Number(e.target.value) || null } : r))
                        )
                      }
                      placeholder="Daily cap (optional)"
                      style={input()}
                    />
                    <input type="number" value={row.limit_count ?? 1} onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, limit_count: Number(e.target.value) } : r)))} placeholder="Limit count" style={input()} />
                    <input type="number" value={row.limit_window_days ?? ""} onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, limit_window_days: Number(e.target.value) } : r)))} placeholder="Limit window (days)" style={input()} />
                  </div>

                  <textarea value={row.description ?? ""} onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, description: e.target.value } : r)))} style={textarea()} />

                  {row.challenge_type === "quota" ? (
                    <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
                      <input value={row.quota_type ?? ""} onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, quota_type: e.target.value } : r)))} placeholder="Quota type" style={input()} />
                      <input type="number" value={row.quota_target ?? ""} onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, quota_target: Number(e.target.value) } : r)))} placeholder="Quota target" style={input()} />
                    </div>
                  ) : null}

                  {row.challenge_type === "stat" ? (
                    <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr" }}>
                      <select value={row.stat_id ?? ""} onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, stat_id: e.target.value } : r)))} style={input()}>
                        <option value="">Select stat</option>
                        {stats.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      <select value={row.stat_compare ?? ">="} onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, stat_compare: e.target.value } : r)))} style={input()}>
                        {compares.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <input type="number" value={row.stat_threshold ?? ""} onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, stat_threshold: Number(e.target.value) } : r)))} placeholder="Threshold" style={input()} />
                    </div>
                  ) : null}

                  {row.challenge_type === "data" ? (
                    <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr" }}>
                      <label style={label()}>
                        Data point
                        <select
                          value={row.data_point_key ?? ""}
                          onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, data_point_key: e.target.value } : r)))}
                          style={input()}
                        >
                          <option value="">Select data point</option>
                          {dataPoints.filter((d) => d.enabled !== false).map((d) => (
                            <option key={d.key} value={d.key}>{d.label}</option>
                          ))}
                        </select>
                      </label>
                      <label style={label()}>
                        Comparison
                        <select value={row.stat_compare ?? ">="} onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, stat_compare: e.target.value } : r)))} style={input()}>
                          {compares.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </label>
                      <label style={label()}>
                        Threshold value
                        <input type="number" value={row.stat_threshold ?? ""} onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, stat_threshold: Number(e.target.value) } : r)))} style={input()} />
                      </label>
                      <label style={label()}>
                        Window days (optional)
                        <input
                          type="number"
                          value={row.data_point_window_days ?? ""}
                          onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, data_point_window_days: Number(e.target.value) } : r)))}
                          style={input()}
                        />
                      </label>
                    </div>
                  ) : null}

                  <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr auto" }}>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, opacity: 0.8 }}>
                      <input
                        type="checkbox"
                        checked={row.enabled !== false}
                        onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, enabled: e.target.checked } : r)))}
                      />
                      Enabled
                    </label>
                    <button onClick={() => saveRow(row)} style={btn()} disabled={!!saving[row.id]}>
                      {saving[row.id] ? "Saving..." : "Save"}
                    </button>
                    <button onClick={() => deleteRow(row)} style={dangerBtn()} disabled={!!deleting[row.id]}>
                      {deleting[row.id] ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                  <div style={challengeSummary()}>
                    {buildChallengeSummary(row)}
                  </div>
                </div>
              </div>
            ))
            )}
          </div>
        </>
      )}

      {limitEditor ? (
        <div style={overlayBackdrop()}>
          <div style={overlayCard()}>
            <div style={{ fontSize: 18, fontWeight: 1000 }}>Edit Limits + Quota</div>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
              <label style={label()}>
                Limit mode
                <select
                  value={limitEditor.limitMode}
                  onChange={(e) => setLimitEditor((prev) => (prev ? { ...prev, limitMode: e.target.value } : prev))}
                  style={input()}
                >
                  {limitModes.map((m) => (
                    <option key={m} value={m}>{m === "yearly" ? "annual" : m}</option>
                  ))}
                </select>
              </label>
              <label style={label()}>
                Limit count
                <input
                  type="number"
                  value={limitEditor.limitCount}
                  onChange={(e) => setLimitEditor((prev) => (prev ? { ...prev, limitCount: e.target.value } : prev))}
                  style={input()}
                />
              </label>
            </div>
            <label style={label()}>
              Time frame (days)
              <input
                type="number"
                value={limitEditor.limitWindowDays}
                onChange={(e) => setLimitEditor((prev) => (prev ? { ...prev, limitWindowDays: e.target.value } : prev))}
                placeholder="Only used for custom window"
                style={input()}
              />
            </label>
            <label style={label()}>
              Daily cap (optional)
              <input
                type="number"
                value={limitEditor.dailyLimitCount}
                onChange={(e) => setLimitEditor((prev) => (prev ? { ...prev, dailyLimitCount: e.target.value } : prev))}
                placeholder="Example: 1 means max once per day"
                style={input()}
              />
            </label>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
              <label style={label()}>
                Quota type
                <input
                  value={limitEditor.quotaType}
                  onChange={(e) => setLimitEditor((prev) => (prev ? { ...prev, quotaType: e.target.value } : prev))}
                  placeholder={limitEditor.challengeType === "quota" ? "Required for quota challenges" : "Optional"}
                  style={input()}
                />
              </label>
              <label style={label()}>
                Quota target
                <input
                  type="number"
                  value={limitEditor.quotaTarget}
                  onChange={(e) => setLimitEditor((prev) => (prev ? { ...prev, quotaTarget: e.target.value } : prev))}
                  placeholder={limitEditor.challengeType === "quota" ? "Required for quota challenges" : "Optional"}
                  style={input()}
                />
              </label>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setLimitEditor(null)} style={ghostBtn()}>
                Cancel
              </button>
              <button onClick={applyLimitEditor} style={btn()}>
                Apply
              </button>
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
    background: "rgba(255,255,255,0.06)",
    display: "grid",
    gap: 10,
    boxShadow: "0 18px 40px rgba(0,0,0,0.28)",
  };
}

function smallCard(alt = false): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 12,
    border: alt ? "1px solid rgba(56,189,248,0.25)" : "1px solid rgba(255,255,255,0.12)",
    background: alt ? "rgba(8,18,35,0.75)" : "rgba(15,23,42,0.55)",
    display: "grid",
    gap: 10,
    boxShadow: "0 12px 28px rgba(0,0,0,0.25)",
  };
}

function challengeCardGrid(): React.CSSProperties {
  return {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(4, minmax(220px, 1fr))",
  };
}

function challengeCompactCard(alt = false): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 12,
    border: alt ? "1px solid rgba(56,189,248,0.25)" : "1px solid rgba(255,255,255,0.12)",
    background: alt ? "rgba(8,18,35,0.75)" : "rgba(15,23,42,0.55)",
    display: "grid",
    gap: 10,
    boxShadow: "0 12px 28px rgba(0,0,0,0.25)",
    minHeight: 260,
    alignContent: "start",
  };
}

function chipWrap(): React.CSSProperties {
  return {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  };
}

function chipBtn(active = false): React.CSSProperties {
  return {
    padding: "7px 11px",
    borderRadius: 999,
    border: active ? "1px solid rgba(45,212,191,0.7)" : "1px solid rgba(255,255,255,0.22)",
    background: active ? "rgba(13,148,136,0.28)" : "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
  };
}

function challengeSummary(): React.CSSProperties {
  return {
    fontSize: 12,
    opacity: 0.8,
    paddingTop: 6,
    borderTop: "1px dashed rgba(255,255,255,0.18)",
  };
}

function buildLimitSummary(row: ChallengeRow): string {
  const count = Number(row.limit_count ?? 1);
  const mode = String(row.limit_mode ?? "once");
  const windowDays = Number(row.limit_window_days ?? 0);
  let primary = "";
  if (mode === "daily") primary = `${count} time${count === 1 ? "" : "s"} per day`;
  else if (mode === "weekly") primary = `${count} time${count === 1 ? "" : "s"} per week`;
  else if (mode === "monthly") primary = `${count} time${count === 1 ? "" : "s"} per month`;
  else if (mode === "yearly") primary = `${count} time${count === 1 ? "" : "s"} per year`;
  else if (mode === "lifetime" || mode === "once") primary = `${count} time${count === 1 ? "" : "s"} total`;
  else if (mode === "custom" && windowDays > 0) {
    primary = `${count} time${count === 1 ? "" : "s"} per ${windowDays} day${windowDays === 1 ? "" : "s"}`;
  } else if (mode === "custom") {
    primary = `${count} time${count === 1 ? "" : "s"} per custom window`;
  } else {
    primary = `${count} time${count === 1 ? "" : "s"}`;
  }
  const dailyCap = Math.max(0, Number(row.daily_limit_count ?? 0));
  if (dailyCap > 0 && mode !== "daily") {
    return `${primary}, max ${dailyCap}/day`;
  }
  return primary;
}

function buildChallengeSummary(row: ChallengeRow): string {
  const name = String(row.name ?? "Challenge");
  const tier = String(row.tier ?? "bronze");
  const points = Number(row.points_awarded ?? 0);
  const limit = buildLimitSummary(row);
  return `${name} is a ${tier} level challenge and earns ${points} points on completion and can be completed ${limit}.`;
}

function input(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.28)",
    color: "white",
    fontWeight: 900,
  };
}

function textarea(): React.CSSProperties {
  return {
    minHeight: 70,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.28)",
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

function dangerBtn(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(239,68,68,0.35)",
    background: "rgba(239,68,68,0.2)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function ghostBtn(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.24)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function overlayBackdrop(): React.CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    background: "rgba(2,6,23,0.74)",
    display: "grid",
    placeItems: "center",
    zIndex: 1000,
    padding: 16,
  };
}

function overlayCard(): React.CSSProperties {
  return {
    width: "min(560px, 100%)",
    borderRadius: 16,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(15,23,42,0.98)",
    boxShadow: "0 24px 50px rgba(0,0,0,0.45)",
    display: "grid",
    gap: 10,
  };
}

function tabBtn(active = false): React.CSSProperties {
  return {
    borderRadius: 999,
    padding: "8px 16px",
    border: active ? "1px solid rgba(59,130,246,0.7)" : "1px solid rgba(255,255,255,0.2)",
    background: active ? "rgba(59,130,246,0.3)" : "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function notice(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(239,68,68,0.3)",
    background: "rgba(239,68,68,0.12)",
    color: "white",
    fontWeight: 900,
    fontSize: 12,
  };
}

function backLink(): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 12,
  };
}

function label(): React.CSSProperties {
  return {
    display: "grid",
    gap: 6,
    fontSize: 12,
    fontWeight: 900,
  };
}

function hint(): React.CSSProperties {
  return {
    fontSize: 11,
    opacity: 0.6,
  };
}

function medalGrid(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
    marginTop: 12,
  };
}

function medalTierCard(): React.CSSProperties {
  return {
    borderRadius: 16,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    display: "grid",
    gap: 10,
  };
}

function medalTierTitle(): React.CSSProperties {
  return {
    fontWeight: 900,
    textTransform: "capitalize",
    letterSpacing: 0.2,
  };
}

function medalPreview(): React.CSSProperties {
  return {
    height: 64,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.35)",
    display: "grid",
    placeItems: "center",
  };
}

function medalPreviewImg(): React.CSSProperties {
  return {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  };
}

function medalLibraryGrid(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
  };
}

function medalOption(active: boolean): React.CSSProperties {
  return {
    borderRadius: 12,
    border: active ? "1px solid rgba(34,197,94,0.45)" : "1px solid rgba(255,255,255,0.12)",
    background: active ? "rgba(34,197,94,0.12)" : "rgba(0,0,0,0.25)",
    padding: 6,
    display: "grid",
    gap: 6,
    cursor: "pointer",
    color: "white",
    textAlign: "center",
  };
}

function medalOptionThumb(): React.CSSProperties {
  return {
    height: 40,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.35)",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    fontSize: 11,
    fontWeight: 900,
  };
}

function medalOptionImg(): React.CSSProperties {
  return {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  };
}

function medalOptionLabel(): React.CSSProperties {
  return {
    fontSize: 10,
    opacity: 0.75,
    fontWeight: 800,
    lineHeight: 1.2,
    minHeight: 22,
  };
}

function warningBox(): React.CSSProperties {
  return {
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(250,204,21,0.45)",
    background: "rgba(250,204,21,0.12)",
    fontSize: 12,
    fontWeight: 900,
  };
}

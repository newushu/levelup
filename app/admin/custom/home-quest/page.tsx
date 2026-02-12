"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type HomeQuestSettings = {
  max_points: number;
  features: {
    games: boolean;
    home_tracker: boolean;
    daily_checkin: boolean;
    quiz: boolean;
  };
  parent_pin_set: boolean;
};

type HomeChallengeRow = {
  id: string;
  name: string;
  category?: string | null;
  tier?: string | null;
  enabled?: boolean | null;
  home_available?: boolean | null;
  home_origin?: string | null;
};

type ParentChallengeRow = {
  id: string;
  name: string;
  description?: string | null;
  tier?: string | null;
  points_awarded?: number | null;
  enabled?: boolean | null;
  status?: string | null;
  parent_name?: string | null;
  created_at?: string | null;
};

export default function HomeQuestAdminPage() {
  const [settings, setSettings] = useState<HomeQuestSettings | null>(null);
  const [maxPoints, setMaxPoints] = useState(50);
  const [features, setFeatures] = useState({
    games: true,
    home_tracker: true,
    daily_checkin: true,
    quiz: true,
  });
  const [parentPin, setParentPin] = useState("");
  const [msg, setMsg] = useState("");
  const [questCategories, setQuestCategories] = useState<string[]>([
    "Strength",
    "Flexibility",
    "Forms",
    "Mindset",
  ]);
  const [questItems, setQuestItems] = useState<Array<{ id: string; title: string; category: string; type: string }>>([
    { id: "q1", title: "Horse stance holds", category: "Strength", type: "Checklist" },
    { id: "q2", title: "Front kick reps", category: "Forms", type: "Reps" },
    { id: "q3", title: "Breathing drill", category: "Mindset", type: "Timer" },
  ]);
  const [newCategory, setNewCategory] = useState("");
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("Strength");
  const [newItemType, setNewItemType] = useState("Checklist");
  const [homeChallenges, setHomeChallenges] = useState<HomeChallengeRow[]>([]);
  const [parentChallenges, setParentChallenges] = useState<ParentChallengeRow[]>([]);
  const [parentTierEdits, setParentTierEdits] = useState<Record<string, string>>({});
  const [parentPointsEdits, setParentPointsEdits] = useState<Record<string, string>>({});
  const [homeMsg, setHomeMsg] = useState("");

  async function loadSettings() {
    setMsg("");
    const res = await fetch("/api/home-quest/settings", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data?.error || "Failed to load settings");
    setSettings(data.settings as HomeQuestSettings);
    setMaxPoints(Number(data.settings?.max_points ?? 50));
    setFeatures({
      games: !!data.settings?.features?.games,
      home_tracker: !!data.settings?.features?.home_tracker,
      daily_checkin: !!data.settings?.features?.daily_checkin,
      quiz: !!data.settings?.features?.quiz,
    });
  }

  async function loadHomeChallenges() {
    setHomeMsg("");
    const res = await fetch("/api/admin/home-quest/home-available", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setHomeMsg(data?.error || "Failed to load home challenges");
    setHomeChallenges((data?.challenges ?? []) as HomeChallengeRow[]);
  }

  async function loadParentChallenges() {
    const res = await fetch("/api/admin/home-quest/parent-challenges", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setHomeMsg(data?.error || "Failed to load parent challenges");
    const rows = (data?.challenges ?? []) as ParentChallengeRow[];
    setParentChallenges(rows);
    const tierMap: Record<string, string> = {};
    const pointsMap: Record<string, string> = {};
    rows.forEach((row) => {
      if (row?.id) {
        tierMap[row.id] = String(row.tier ?? "bronze");
        pointsMap[row.id] = String(row.points_awarded ?? 15);
      }
    });
    setParentTierEdits(tierMap);
    setParentPointsEdits(pointsMap);
  }

  useEffect(() => {
    loadSettings();
    loadHomeChallenges();
    loadParentChallenges();
  }, []);

  async function saveSettings() {
    setMsg("");
    const res = await fetch("/api/home-quest/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        max_points: Number(maxPoints),
        features,
        parent_pin: parentPin.trim() || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data?.error || "Failed to save settings");
    setParentPin("");
    setMsg("Saved.");
    loadSettings();
  }

  async function toggleHomeAvailable(id: string, value: boolean) {
    setHomeMsg("");
    const res = await fetch("/api/admin/home-quest/home-available", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, home_available: value }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setHomeMsg(data?.error || "Failed to update");
    loadHomeChallenges();
  }

  async function approveParentChallenge(id: string) {
    setHomeMsg("");
    const tier = parentTierEdits[id] ?? "bronze";
    const points_awarded = Number(parentPointsEdits[id] ?? 15);
    const res = await fetch("/api/admin/home-quest/parent-challenges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, tier, points_awarded, approve: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setHomeMsg(data?.error || "Failed to approve");
    loadParentChallenges();
  }

  async function updateParentChallenge(id: string) {
    setHomeMsg("");
    const tier = parentTierEdits[id] ?? "bronze";
    const points_awarded = Number(parentPointsEdits[id] ?? 15);
    const res = await fetch("/api/admin/home-quest/parent-challenges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, tier, points_awarded, approve: false }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setHomeMsg(data?.error || "Failed to update");
    loadParentChallenges();
  }

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 1000 }}>Home Quest Settings</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Control at-home features and point limits.</div>
        </div>
        <Link href="/admin/custom" style={backLink()}>
          Return to Custom
        </Link>
      </div>

      {msg ? <div style={notice()}>{msg}</div> : null}

      <div style={card()}>
        <div style={{ fontWeight: 1000, marginBottom: 10 }}>Points Limit</div>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={label()}>Max points students can earn per week from Home Quest</div>
          <input
            type="number"
            min={0}
            value={maxPoints}
            onChange={(e) => setMaxPoints(Number(e.target.value))}
            style={input()}
          />
        </div>
      </div>

      <div style={card()}>
        <div style={{ fontWeight: 1000, marginBottom: 10 }}>Feature Cards</div>
        <div style={{ display: "grid", gap: 10 }}>
          <label style={toggleRow()}>
            <input
              type="checkbox"
              checked={features.games}
              onChange={(e) => setFeatures((p) => ({ ...p, games: e.target.checked }))}
            />
            Games
          </label>
          <label style={toggleRow()}>
            <input
              type="checkbox"
              checked={features.home_tracker}
              onChange={(e) => setFeatures((p) => ({ ...p, home_tracker: e.target.checked }))}
            />
            Home Tracker
          </label>
          <label style={toggleRow()}>
            <input
              type="checkbox"
              checked={features.daily_checkin}
              onChange={(e) => setFeatures((p) => ({ ...p, daily_checkin: e.target.checked }))}
            />
            Daily Check-in
          </label>
          <label style={toggleRow()}>
            <input
              type="checkbox"
              checked={features.quiz}
              onChange={(e) => setFeatures((p) => ({ ...p, quiz: e.target.checked }))}
            />
            Quiz
          </label>
        </div>
      </div>

      <div style={card()}>
        <div style={{ fontWeight: 1000, marginBottom: 10 }}>Parent PIN</div>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={label()}>
            {settings?.parent_pin_set ? "PIN is set." : "No PIN set yet."} Set a new PIN to update it.
          </div>
          <input
            type="password"
            value={parentPin}
            onChange={(e) => setParentPin(e.target.value)}
            placeholder="New PIN"
            style={input()}
          />
        </div>
      </div>

      <div style={card()}>
        <div style={{ fontWeight: 1000, marginBottom: 10 }}>Home Quest Challenge Options</div>
        <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 10 }}>
          Select which challenges are available on the Parent Home Quest page.
        </div>
        {homeMsg ? <div style={notice()}>{homeMsg}</div> : null}
        <div style={{ display: "grid", gap: 10 }}>
          {homeChallenges.map((row) => (
            <div key={row.id} style={rowCard()}>
              <div>
                <div style={{ fontWeight: 1000 }}>{row.name}</div>
                <div style={{ opacity: 0.65, fontSize: 12 }}>
                  {row.category ? `${row.category} • ` : ""}{row.tier ?? "—"}
                </div>
              </div>
              <label style={toggleRow()}>
                <input
                  type="checkbox"
                  checked={!!row.home_available}
                  onChange={(e) => toggleHomeAvailable(row.id, e.target.checked)}
                />
                Available at home
              </label>
            </div>
          ))}
          {!homeChallenges.length ? <div style={{ opacity: 0.7, fontSize: 12 }}>No challenges yet.</div> : null}
        </div>
      </div>

      <div style={card()}>
        <div style={{ fontWeight: 1000, marginBottom: 10 }}>Parent-Created Challenges (Approval)</div>
        <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 10 }}>
          Review and approve parent challenges. Points are capped at 15 for parent challenges.
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {parentChallenges.map((row) => (
            <div key={row.id} style={rowCard()}>
              <div>
                <div style={{ fontWeight: 1000 }}>{row.name}</div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>
                  {row.parent_name ? `From ${row.parent_name} • ` : ""}{row.status ?? "pending"}
                </div>
                {row.description ? <div style={{ opacity: 0.7, fontSize: 12 }}>{row.description}</div> : null}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <select
                  value={parentTierEdits[row.id] ?? "bronze"}
                  onChange={(e) => setParentTierEdits((prev) => ({ ...prev, [row.id]: e.target.value }))}
                  style={input()}
                >
                  <option value="bronze">Bronze</option>
                  <option value="silver">Silver</option>
                  <option value="gold">Gold</option>
                  <option value="platinum">Platinum</option>
                  <option value="diamond">Diamond</option>
                  <option value="master">Master</option>
                </select>
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={parentPointsEdits[row.id] ?? "15"}
                  onChange={(e) => setParentPointsEdits((prev) => ({ ...prev, [row.id]: e.target.value }))}
                  style={input()}
                />
                {row.enabled ? (
                  <button onClick={() => updateParentChallenge(row.id)} style={btnGhost()}>
                    Save
                  </button>
                ) : (
                  <button onClick={() => approveParentChallenge(row.id)} style={btn()}>
                    Approve
                  </button>
                )}
              </div>
            </div>
          ))}
          {!parentChallenges.length ? <div style={{ opacity: 0.7, fontSize: 12 }}>No parent challenges yet.</div> : null}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={saveSettings} style={btn()}>
          Save Settings
        </button>
      </div>

      <div style={card()}>
        <div style={{ fontWeight: 1000, marginBottom: 10 }}>Quest Items (placeholder)</div>
        <div style={{ opacity: 0.75, fontSize: 12, marginBottom: 12 }}>
          Placeholder list for now. We will wire up persistence later.
        </div>

        <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="New category name"
              style={input()}
            />
            <button
              type="button"
              onClick={() => {
                const trimmed = newCategory.trim();
                if (!trimmed) return;
                if (!questCategories.includes(trimmed)) {
                  setQuestCategories((prev) => [...prev, trimmed]);
                }
                setNewItemCategory(trimmed);
                setNewCategory("");
              }}
              style={btnGhost()}
            >
              Add Category
            </button>
          </div>

          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <input
              value={newItemTitle}
              onChange={(e) => setNewItemTitle(e.target.value)}
              placeholder="Quest item name"
              style={input()}
            />
            <select value={newItemCategory} onChange={(e) => setNewItemCategory(e.target.value)} style={input()}>
              {questCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <select value={newItemType} onChange={(e) => setNewItemType(e.target.value)} style={input()}>
              <option value="Checklist">Checklist</option>
              <option value="Reps">Reps</option>
              <option value="Timer">Timer</option>
              <option value="Quiz">Quiz</option>
              <option value="One-time">One-time</option>
            </select>
            <button
              type="button"
              onClick={() => {
                const title = newItemTitle.trim();
                if (!title) return;
                setQuestItems((prev) => [
                  ...prev,
                  { id: `q-${Date.now()}`, title, category: newItemCategory, type: newItemType },
                ]);
                setNewItemTitle("");
              }}
              style={btnGhost()}
            >
              Add Item
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {questItems.map((item) => (
            <div key={item.id} style={questCard()}>
              <div style={{ fontWeight: 1000 }}>{item.title}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                <span style={chip()}>{item.category}</span>
                <span style={chip()}>{item.type}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function card(): React.CSSProperties {
  return {
    borderRadius: 18,
    padding: 14,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
  };
}

function label(): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.85,
  };
}

function input(): React.CSSProperties {
  return {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.24)",
    color: "white",
    outline: "none",
    fontSize: 14,
    fontWeight: 900,
  };
}

function btn(): React.CSSProperties {
  return {
    padding: "10px 16px",
    borderRadius: 12,
    border: "1px solid rgba(59,130,246,0.35)",
    background: "linear-gradient(90deg, rgba(59,130,246,0.85), rgba(14,165,233,0.65))",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
  };
}

function btnGhost(): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  };
}

function notice(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(34,197,94,0.18)",
    color: "white",
    fontWeight: 900,
    fontSize: 12,
  };
}

function toggleRow(): React.CSSProperties {
  return {
    display: "flex",
    gap: 10,
    alignItems: "center",
    fontWeight: 900,
    fontSize: 13,
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

function questCard(): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(8,10,15,0.7)",
    display: "grid",
    gap: 8,
  };
}

function chip(): React.CSSProperties {
  return {
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(59,130,246,0.5)",
    background: "rgba(59,130,246,0.2)",
    fontSize: 11,
    fontWeight: 900,
  };
}

function rowCard(): React.CSSProperties {
  return {
    borderRadius: 14,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(8,10,15,0.7)",
    display: "grid",
    gap: 10,
  };
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const damages = [3, 4, 5, 6, 7];

type Settings = {
  id?: string;
  hp_default: number;
  max_team_size: number;
  max_effects_in_play: number;
};

type CardDef = {
  id?: string;
  card_type: "attack" | "shield" | "negate" | "joker";
  category?: string | null;
  damage?: number | null;
  shield_value?: number | null;
  copies: number;
  image_url?: string | null;
  enabled?: boolean | null;
};

type SkillRow = {
  id: string;
  name: string;
  category?: string | null;
  damage: number;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 180)}` } };
  }
}

export default function SkillStrikeAdminPage() {
  const [settings, setSettings] = useState<Settings>({
    hp_default: 50,
    max_team_size: 4,
    max_effects_in_play: 3,
  });
  const [defs, setDefs] = useState<CardDef[]>([]);
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [skillSearch, setSkillSearch] = useState("");
  const [skillCategory, setSkillCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const categories = useMemo(() => {
    const list = Array.from(new Set(skills.map((s) => String(s.category ?? "").trim()).filter(Boolean)));
    return list.sort((a, b) => a.localeCompare(b));
  }, [skills]);

  const attackDefs = defs.filter((d) => d.card_type === "attack");
  const shieldDefs = defs.filter((d) => d.card_type === "shield");
  const negateDef = defs.find((d) => d.card_type === "negate");
  const jokerDef = defs.find((d) => d.card_type === "joker");

  useEffect(() => {
    const load = async () => {
      const [settingsRes, defsRes, skillsRes] = await Promise.all([
        fetch("/api/skill-strike/settings", { cache: "no-store" }),
        fetch("/api/skill-strike/card-defs", { cache: "no-store" }),
        fetch(`/api/skill-strike/skills?search=${encodeURIComponent("")}`, { cache: "no-store" }),
      ]);
      const sj = await safeJson(settingsRes);
      if (sj.ok) setSettings(sj.json.settings);
      const dj = await safeJson(defsRes);
      if (dj.ok) setDefs(dj.json.defs ?? []);
      const kj = await safeJson(skillsRes);
      if (kj.ok) setSkills(kj.json.skills ?? []);
    };
    load();
  }, []);

  const ensureBaseDefs = () => {
    const next = [...defs];
    const ensure = (entry: CardDef) => {
      const exists = next.find(
        (d) =>
          d.card_type === entry.card_type &&
          (d.category ?? "") === (entry.category ?? "") &&
          Number(d.damage ?? 0) === Number(entry.damage ?? 0) &&
          Number(d.shield_value ?? 0) === Number(entry.shield_value ?? 0)
      );
      if (!exists) next.push(entry);
    };
    ensure({ card_type: "shield", shield_value: 1, copies: 40 });
    ensure({ card_type: "shield", shield_value: 2, copies: 30 });
    ensure({ card_type: "shield", shield_value: 3, copies: 20 });
    ensure({ card_type: "negate", copies: 10 });
    ensure({ card_type: "joker", copies: 10, damage: 5 });
    setDefs(next);
  };

  const saveSettings = async () => {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/skill-strike/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const sj = await safeJson(res);
    if (!sj.ok) setMsg(sj.json?.error ?? "Failed to save settings");
    else setSettings(sj.json.settings);
    setBusy(false);
  };

  const saveDefs = async () => {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/skill-strike/card-defs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defs }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) setMsg(sj.json?.error ?? "Failed to save card defs");
    else setDefs(sj.json.defs ?? []);
    setBusy(false);
  };

  const saveSkillDamage = async (skillId: string, damage: number) => {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/skill-strike/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: [{ skill_id: skillId, damage }] }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) setMsg(sj.json?.error ?? "Failed to save difficulty");
    else {
      setSkills((prev) => prev.map((s) => (s.id === skillId ? { ...s, damage } : s)));
    }
    setBusy(false);
  };

  const totalCards = defs.reduce((sum, d) => sum + Number(d.copies ?? 0), 0);

  return (
    <main style={{ padding: 24, color: "white" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <Link href="/admin/custom" style={{ color: "white", textDecoration: "underline", fontSize: 12 }}>
            ← Back to Admin Workspace
          </Link>
          <div style={{ fontSize: 28, fontWeight: 1000, marginTop: 8 }}>Skill Strike — Admin Custom</div>
          <div style={{ opacity: 0.7 }}>Configure deck composition, HP, and skill difficulty.</div>
        </div>
        <a href="/admin/skill-strike" style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.2)", textDecoration: "none", color: "white", fontWeight: 900 }}>
          Open Host Console
        </a>
      </div>

      {msg ? (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 12, background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.4)" }}>
          {msg}
        </div>
      ) : null}

      <div style={{ marginTop: 20, display: "grid", gap: 16 }}>
        <section style={panel()}>
          <div style={panelTitle()}>Game Defaults</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <label style={field()}>
              <span style={label()}>Default Team HP</span>
              <input
                type="number"
                value={settings.hp_default}
                onChange={(e) => setSettings((prev) => ({ ...prev, hp_default: Number(e.target.value) }))}
                style={input()}
              />
            </label>
            <label style={field()}>
              <span style={label()}>Max Team Size</span>
              <input
                type="number"
                value={settings.max_team_size}
                onChange={(e) => setSettings((prev) => ({ ...prev, max_team_size: Number(e.target.value) }))}
                style={input()}
              />
            </label>
            <label style={field()}>
              <span style={label()}>Max Effects In Play</span>
              <input
                type="number"
                value={settings.max_effects_in_play}
                onChange={(e) => setSettings((prev) => ({ ...prev, max_effects_in_play: Number(e.target.value) }))}
                style={input()}
              />
            </label>
          </div>
          <div style={{ marginTop: 12 }}>
            <button disabled={busy} onClick={saveSettings} style={primaryBtn()}>
              Save Defaults
            </button>
          </div>
        </section>

        <section style={panel()}>
          <div style={panelTitle()}>Deck Builder</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Total cards: {totalCards} / 500</div>
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={ensureBaseDefs} style={ghostBtn()}>
              Load Base Cards
            </button>
            <button disabled={busy} onClick={saveDefs} style={primaryBtn()}>
              Save Deck
            </button>
          </div>

          <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
            <div style={subTitle()}>Effect Cards</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
              {[1, 2, 3].map((val) => {
                const row = shieldDefs.find((d) => Number(d.shield_value ?? 0) === val) ?? {
                  card_type: "shield",
                  shield_value: val,
                  copies: 0,
                };
                return (
                  <label key={val} style={field()}>
                    <span style={label()}>Shield -{val}</span>
                    <input
                      type="number"
                      value={row.copies ?? 0}
                      onChange={(e) =>
                        setDefs((prev) =>
                          upsertDef(prev, {
                            ...row,
                            card_type: "shield",
                            shield_value: val,
                            copies: Number(e.target.value),
                          })
                        )
                      }
                      style={input()}
                    />
                  </label>
                );
              })}
              <label style={field()}>
                <span style={label()}>Negate Cards</span>
                <input
                  type="number"
                  value={negateDef?.copies ?? 0}
                  onChange={(e) =>
                    setDefs((prev) =>
                      upsertDef(prev, {
                        ...negateDef,
                        card_type: "negate",
                        copies: Number(e.target.value),
                      })
                    )
                  }
                  style={input()}
                />
              </label>
              <label style={field()}>
                <span style={label()}>Joker Cards</span>
                <input
                  type="number"
                  value={jokerDef?.copies ?? 0}
                  onChange={(e) =>
                    setDefs((prev) =>
                      upsertDef(prev, {
                        ...jokerDef,
                        card_type: "joker",
                        damage: 5,
                        copies: Number(e.target.value),
                      })
                    )
                  }
                  style={input()}
                />
              </label>
            </div>

            <div style={subTitle()}>Attack Cards by Category</div>
            {categories.length === 0 ? (
              <div style={{ opacity: 0.7 }}>No skill categories found.</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {categories.map((cat) => (
                  <div key={cat} style={categoryRow()}>
                    <div style={{ fontWeight: 900 }}>{cat}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(80px, 1fr))", gap: 10 }}>
                      {damages.map((dmg) => {
                        const row = attackDefs.find((d) => d.category === cat && Number(d.damage ?? 0) === dmg) ?? {
                          card_type: "attack",
                          category: cat,
                          damage: dmg,
                          copies: 0,
                        };
                        return (
                          <label key={dmg} style={field()}>
                            <span style={label()}>Dmg {dmg}</span>
                            <input
                              type="number"
                              value={row.copies ?? 0}
                              onChange={(e) =>
                                setDefs((prev) =>
                                  upsertDef(prev, {
                                    ...row,
                                    card_type: "attack",
                                    category: cat,
                                    damage: dmg,
                                    copies: Number(e.target.value),
                                  })
                                )
                              }
                              style={input()}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section style={panel()}>
          <div style={panelTitle()}>Skill Difficulty (3-7)</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              placeholder="Search skill"
              value={skillSearch}
              onChange={(e) => setSkillSearch(e.target.value)}
              style={input()}
            />
            <select value={skillCategory} onChange={(e) => setSkillCategory(e.target.value)} style={input()}>
              <option value="">All categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginTop: 12, display: "grid", gap: 8, maxHeight: 420, overflow: "auto" }}>
            {skills
              .filter((s) => (skillCategory ? s.category === skillCategory : true))
              .filter((s) => (skillSearch ? s.name.toLowerCase().includes(skillSearch.toLowerCase()) : true))
              .map((skill) => (
                <div key={skill.id} style={skillRow()}>
                  <div>
                    <div style={{ fontWeight: 900 }}>{skill.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{skill.category}</div>
                  </div>
                  <select
                    value={skill.damage}
                    onChange={(e) => saveSkillDamage(skill.id, Number(e.target.value))}
                    style={input()}
                  >
                    {damages.map((dmg) => (
                      <option key={dmg} value={dmg}>
                        Damage {dmg}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function upsertDef(list: CardDef[], next: CardDef) {
  const idx = list.findIndex(
    (d) =>
      d.card_type === next.card_type &&
      (d.category ?? "") === (next.category ?? "") &&
      Number(d.damage ?? 0) === Number(next.damage ?? 0) &&
      Number(d.shield_value ?? 0) === Number(next.shield_value ?? 0)
  );
  if (idx >= 0) {
    const copy = [...list];
    copy[idx] = { ...copy[idx], ...next };
    return copy;
  }
  return [...list, next];
}

function panel(): React.CSSProperties {
  return {
    padding: 16,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(15,23,42,0.55)",
    boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
  };
}

function panelTitle(): React.CSSProperties {
  return { fontWeight: 1000, fontSize: 18, marginBottom: 8 };
}

function subTitle(): React.CSSProperties {
  return { fontWeight: 900, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.12em", opacity: 0.7 };
}

function field(): React.CSSProperties {
  return { display: "grid", gap: 6 };
}

function label(): React.CSSProperties {
  return { fontSize: 12, opacity: 0.7, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" };
}

function input(): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.3)",
    color: "white",
    fontWeight: 700,
  };
}

function primaryBtn(): React.CSSProperties {
  return {
    padding: "8px 14px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "linear-gradient(135deg, rgba(59,130,246,0.55), rgba(34,197,94,0.55))",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function ghostBtn(): React.CSSProperties {
  return {
    padding: "8px 14px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function categoryRow(): React.CSSProperties {
  return {
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(2,6,23,0.45)",
    display: "grid",
    gap: 8,
  };
}

function skillRow(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "1fr 160px",
    gap: 12,
    alignItems: "center",
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(2,6,23,0.5)",
  };
}

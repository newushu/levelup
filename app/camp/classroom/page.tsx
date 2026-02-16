"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AvatarRender from "@/components/AvatarRender";

type Roster = { id: string; name: string };
type Group = { id: string; roster_id: string; name: string };
type Member = {
  id: string;
  roster_id: string;
  group_id: string | null;
  student_id: string;
  display_role: string;
  student?: {
    id: string;
    name: string;
    level?: number;
    points_total?: number;
    avatar_storage_path?: string | null;
    avatar_bg?: string | null;
    avatar_effect?: string | null;
    corner_border_url?: string | null;
    corner_border_render_mode?: string | null;
    corner_border_html?: string | null;
    corner_border_css?: string | null;
    corner_border_js?: string | null;
    corner_border_offset_x?: number | null;
    corner_border_offset_y?: number | null;
    corner_border_offsets_by_context?: Record<string, { x?: number | null; y?: number | null; scale?: number | null; rotate?: number | null }> | null;
  } | null;
  secondary_role?: string;
  last_change?: { points: number; note: string; category: string; created_at: string } | null;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: text.slice(0, 220) } };
  }
}

export default function CampClassroomPage() {
  const [role, setRole] = useState("");
  const [seasonSettings, setSeasonSettings] = useState<{ start_date?: string | null; weeks?: number | null }>({});
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  const [activeRosterId, setActiveRosterId] = useState("");
  const [activeGroupId, setActiveGroupId] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [amount, setAmount] = useState("5");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [lastActionMsg, setLastActionMsg] = useState("");
  const [selectedOverlayOpen, setSelectedOverlayOpen] = useState(false);
  const [amountOverlayOpen, setAmountOverlayOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [actionFlash, setActionFlash] = useState("");
  const actionLockUntilRef = useRef(0);

  useEffect(() => {
    (async () => {
      const meRes = await fetch("/api/auth/me", { cache: "no-store" });
      const me = await safeJson(meRes);
      if (me.ok) setRole(String(me.json?.role ?? ""));
      const seasonRes = await fetch("/api/season-settings", { cache: "no-store" });
      const season = await safeJson(seasonRes);
      if (season.ok) setSeasonSettings((season.json as any)?.settings ?? {});
    })();
  }, []);

  async function load() {
    setMsg("");
    const res = await fetch("/api/camp/display-roster?lite=camp_classroom", { cache: "no-store" });
    const sj = await safeJson(res);
    if (!sj.ok) return setMsg(String(sj.json?.error ?? "Failed to load camp classroom"));

    const nextRosters = (sj.json?.rosters ?? []) as Roster[];
    const nextGroups = (sj.json?.groups ?? []) as Group[];
    const nextMembers = (sj.json?.members_hydrated ?? sj.json?.display_members ?? []) as Member[];

    const storedRoster = typeof localStorage !== "undefined" ? localStorage.getItem("camp_classroom_roster_id") : "";
    const storedGroup = typeof localStorage !== "undefined" ? localStorage.getItem("camp_classroom_group_id") : "";
    const fallbackRoster = storedRoster && nextRosters.some((r) => r.id === storedRoster) ? storedRoster : nextRosters[0]?.id ?? "";
    const fallbackGroup = storedGroup || "all";

    setRosters(nextRosters);
    setGroups(nextGroups);
    setMembers(nextMembers.filter((m) => m.student));
    setActiveRosterId((prev) => prev || fallbackRoster);
    setActiveGroupId((prev) => prev || fallbackGroup);
    setSelectedIds([]);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!activeRosterId || typeof localStorage === "undefined") return;
    localStorage.setItem("camp_classroom_roster_id", activeRosterId);
  }, [activeRosterId]);

  useEffect(() => {
    if (!activeGroupId || typeof localStorage === "undefined") return;
    localStorage.setItem("camp_classroom_group_id", activeGroupId);
  }, [activeGroupId]);

  const rosterGroups = useMemo(
    () => groups.filter((g) => g.roster_id === activeRosterId),
    [groups, activeRosterId]
  );

  const visibleMembers = useMemo(
    () =>
      members
        .filter((m) => m.roster_id === activeRosterId)
        .filter((m) => (activeGroupId === "all" ? true : String(m.group_id ?? "") === activeGroupId))
        .sort((a, b) => String(a.student?.name ?? "").localeCompare(String(b.student?.name ?? ""))),
    [members, activeRosterId, activeGroupId]
  );

  const allow = ["admin", "coach", "classroom", "camp"].includes(role);
  const selectedMembers = useMemo(
    () => members.filter((m) => selectedIds.includes(m.student_id)),
    [members, selectedIds]
  );

  function avatarUrl(path?: string | null) {
    const p = String(path ?? "").trim();
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!p || !base) return "";
    if (p.startsWith("http")) return p;
    return `${base}/storage/v1/object/public/avatars/${p}`;
  }

  function currentWeek() {
    const start = seasonSettings.start_date ? new Date(`${seasonSettings.start_date}T00:00:00`) : null;
    if (!start || Number.isNaN(start.getTime())) return 1;
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
    return Math.max(1, diffWeeks);
  }

  function currentRulePoints() {
    const week = currentWeek();
    return Math.min(50, Math.max(5, week * 5));
  }

  async function awardBulk(points: number, category: string, note: string) {
    if (!selectedIds.length) return;
    if (busy || Date.now() < actionLockUntilRef.current) return;
    actionLockUntilRef.current = Date.now() + 900;
    setBusy(true);
    setMsg("");
    try {
      const payloads = selectedIds.map((student_id) =>
        fetch("/api/ledger/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            student_id,
            points,
            category,
            note,
          }),
        })
      );
      const all = await Promise.all(payloads);
      const failures: string[] = [];
      for (const res of all) {
        if (res.ok) continue;
        const sj = await safeJson(res);
        failures.push(String(sj.json?.error ?? `HTTP ${res.status}`));
      }
      const selectedNames = visibleMembers.filter((m) => selectedIds.includes(m.student_id)).map((m) => m.student?.name || "Student");
      const targetLabel = selectedNames.length === 1 ? selectedNames[0] : `${selectedNames.length} students`;
      if (failures.length) {
        setMsg(`Some updates failed: ${failures[0]}`);
      } else {
        setMsg(`Updated ${selectedIds.length} students.`);
        setLastActionMsg(`${note} ${points > 0 ? "+" : ""}${points} pts to ${targetLabel}`);
        setActionFlash(`${note} ${points > 0 ? "+" : ""}${points} pts`);
        window.setTimeout(() => setActionFlash(""), 1200);
      }
      await load();
      setSelectedIds([]);
      setSelectedOverlayOpen(false);
    } finally {
      setBusy(false);
    }
  }

  function applyAmount(value: number) {
    const safe = Math.max(1, Math.round(Number(value) || 1));
    setAmount(String(safe));
    setAmountOverlayOpen(false);
  }

  return (
    <main style={{ minHeight: "100vh", padding: "14px 14px 120px", background: "radial-gradient(circle at top, rgba(56,189,248,0.12), rgba(2,6,23,0.98) 58%)", color: "white", display: "grid", gap: 12 }}>
      <section style={{ ...card(), gridTemplateColumns: "1fr", alignItems: "end" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 30, fontWeight: 1000 }}>Camp Classroom</div>
          <div style={{ opacity: 0.76 }}>Select roster/group then multi-select students.</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {rosters.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setActiveRosterId(r.id)}
              style={activeRosterId === r.id ? chipOn() : chipOff()}
            >
              {r.name}
            </button>
          ))}
        </div>
        <select value={activeGroupId} onChange={(e) => setActiveGroupId(e.target.value)} style={inp()}>
          <option value="all">All Groups</option>
          {rosterGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </section>

      {!allow ? (
        <div style={warn()}>This page is for admin/coach/classroom roles.</div>
      ) : null}
      {msg ? <div style={warn()}>{msg}</div> : null}
      {lastActionMsg ? <div style={actionInfo()}>{lastActionMsg}</div> : null}

      <section style={{ ...card(), display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
        {visibleMembers.map((m) => {
          const selected = selectedIds.includes(m.student_id);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() =>
                setSelectedIds((prev) =>
                  prev.includes(m.student_id) ? prev.filter((id) => id !== m.student_id) : [...prev, m.student_id]
                )
              }
              style={{
                borderRadius: 12,
                border: selected ? "1px solid rgba(34,211,238,0.9)" : "1px solid rgba(148,163,184,0.35)",
                background: selected ? "rgba(8,47,73,0.75)" : "rgba(15,23,42,0.6)",
                color: "white",
                padding: 10,
                textAlign: "left",
                display: "grid",
                gap: 6,
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "auto auto 1fr", alignItems: "center", gap: 8 }}>
                <div style={levelBadge()}>Lv {Number(m.student?.level ?? 1)}</div>
                <div style={{ width: 66, height: 66 }}>
                  <AvatarRender
                    size={66}
                    bg={m.student?.avatar_bg || "rgba(15,23,42,0.5)"}
                    avatarSrc={avatarUrl(m.student?.avatar_storage_path)}
                    effect={{ key: m.student?.avatar_effect ?? null }}
                    border={{
                      image_url: m.student?.corner_border_url ?? null,
                      render_mode: m.student?.corner_border_render_mode ?? null,
                      html: m.student?.corner_border_html ?? null,
                      css: m.student?.corner_border_css ?? null,
                      js: m.student?.corner_border_js ?? null,
                      offset_x: m.student?.corner_border_offset_x ?? null,
                      offset_y: m.student?.corner_border_offset_y ?? null,
                      offsets_by_context: m.student?.corner_border_offsets_by_context ?? null,
                    }}
                    contextKey="camp_classroom"
                    bleed={12}
                  />
                </div>
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ fontWeight: 1000, fontSize: 20, lineHeight: 1 }}>{m.student?.name ?? "Student"}</div>
                  <div style={pointsCardChip()}>{Number(m.student?.points_total ?? 0).toLocaleString()} pts</div>
                </div>
              </div>
              <div style={{ opacity: 0.75, fontSize: 12, textTransform: "uppercase" }}>{m.display_role || "camper"}</div>
              {m.secondary_role ? <div style={{ opacity: 0.75, fontSize: 12, textTransform: "uppercase" }}>2nd Role: {m.secondary_role}</div> : null}
              {m.last_change ? (
                <div style={m.last_change.points >= 0 ? lastChangePos() : lastChangeNeg()}>
                  {m.last_change.points >= 0 ? "+" : ""}{m.last_change.points} • {(String(m.last_change.note ?? "").trim().toLowerCase() === "given" ? "Points Awarded" : (m.last_change.note || m.last_change.category))}
                </div>
              ) : null}
            </button>
          );
        })}
      </section>

      <div style={bottomBar()}>
        <button
          type="button"
          onClick={() => setSelectedOverlayOpen((v) => !v)}
          style={selectedCountBtn()}
        >
          {selectedIds.length} selected
        </button>
        <button
          type="button"
          onClick={() => setAmountOverlayOpen(true)}
          style={pointsPickBtn()}
        >
          {Math.max(1, Number(amount) || 1)} pts
        </button>
        <button type="button" style={actionBtn("green")} disabled={busy || !selectedIds.length} onClick={() => awardBulk(Math.max(1, Number(amount) || 1), "camp_bulk", "Points Awarded")}>+ Points</button>
        <button type="button" style={actionBtn("red")} disabled={busy || !selectedIds.length} onClick={() => awardBulk(-Math.max(1, Number(amount) || 1), "camp_bulk", "Points Awarded")}>- Points</button>
        <button type="button" style={actionBtn("spotlight")} disabled={busy || !selectedIds.length} onClick={() => awardBulk(20, "camp_spotlight", "Camp Spotlight star")}>Camp Star +20</button>
        <button
          type="button"
          style={actionBtn("keeper")}
          disabled={busy || !selectedIds.length}
          onClick={() => {
            const pts = currentRulePoints();
            const week = currentWeek();
            awardBulk(pts, "rule_keeper", `Rule Keeper Week ${week} (+${pts})`);
          }}
        >
          Rule Keeper
        </button>
        <button
          type="button"
          style={actionBtn("breaker")}
          disabled={busy || !selectedIds.length}
          onClick={() => {
            const pts = currentRulePoints();
            const week = currentWeek();
            awardBulk(-pts, "rule_breaker", `Rule Breaker Week ${week} (-${pts})`);
          }}
        >
          Rule Breaker
        </button>
      </div>

      {selectedOverlayOpen ? (
        <div style={overlayWrap()} onClick={() => setSelectedOverlayOpen(false)}>
          <div style={overlayCardSmall()} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ fontWeight: 1000 }}>Selected Students ({selectedMembers.length})</div>
              <button type="button" onClick={() => setSelectedOverlayOpen(false)} style={closeBtn()}>X</button>
            </div>
            <div style={{ display: "grid", gap: 4, maxHeight: 260, overflow: "auto" }}>
              {selectedMembers.map((m) => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, opacity: 0.98, lineHeight: 1.2 }}>
                    {m.student?.name ?? "Student"}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedIds((prev) => prev.filter((id) => id !== m.student_id))}
                    style={{
                      borderRadius: 8,
                      border: "1px solid rgba(248,113,113,0.62)",
                      background: "rgba(127,29,29,0.55)",
                      color: "white",
                      padding: "6px 10px",
                      fontWeight: 900,
                      fontSize: 12,
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
              {!selectedMembers.length ? <div style={{ opacity: 0.75 }}>No students selected.</div> : null}
            </div>
          </div>
        </div>
      ) : null}

      {amountOverlayOpen ? (
        <div style={overlayWrap()} onClick={() => setAmountOverlayOpen(false)}>
          <div style={overlayCardSmall()} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ fontWeight: 1000 }}>Pick Points</div>
              <button type="button" onClick={() => setAmountOverlayOpen(false)} style={closeBtn()}>X</button>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(4,minmax(0,1fr))" }}>
                {[1,2,3,4,5,6,7,8,9,10,15,20,25].map((n) => (
                  <button key={n} type="button" style={amountChip(Number(amount) === n)} onClick={() => applyAmount(n)}>
                    {n}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="Custom amount"
                  inputMode="numeric"
                  style={{ ...inp(), flex: 1, minWidth: 0 }}
                />
                <button
                  type="button"
                  style={actionBtn("green")}
                  onClick={() => applyAmount(Number(customAmount))}
                >
                  Use
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {actionFlash ? (
        <div style={quickOverlay()}>
          <div style={quickOverlayCard()}>{actionFlash}</div>
        </div>
      ) : null}
    </main>
  );
}

function card(): React.CSSProperties {
  return { borderRadius: 12, border: "1px solid rgba(125,211,252,0.25)", background: "rgba(2,6,23,0.62)", padding: 10, display: "grid", gap: 8 };
}
function chipOn(): React.CSSProperties {
  return { borderRadius: 999, border: "1px solid rgba(56,189,248,0.75)", background: "rgba(14,165,233,0.22)", color: "white", padding: "6px 10px", fontWeight: 900 };
}
function chipOff(): React.CSSProperties {
  return { borderRadius: 999, border: "1px solid rgba(148,163,184,0.45)", background: "rgba(15,23,42,0.65)", color: "white", padding: "6px 10px", fontWeight: 900 };
}
function ghostBtn(): React.CSSProperties {
  return { borderRadius: 10, border: "1px solid rgba(125,211,252,0.35)", background: "rgba(15,23,42,0.58)", color: "white", textDecoration: "none", padding: "8px 12px", fontWeight: 900 };
}
function inp(): React.CSSProperties {
  return { borderRadius: 9, border: "1px solid rgba(148,163,184,0.4)", background: "rgba(15,23,42,0.65)", color: "white", padding: "10px 12px" };
}
function warn(): React.CSSProperties {
  return { borderRadius: 10, border: "1px solid rgba(245,158,11,0.5)", background: "rgba(120,53,15,0.35)", padding: "8px 10px", fontWeight: 900 };
}
function actionInfo(): React.CSSProperties {
  return { borderRadius: 10, border: "1px solid rgba(52,211,153,0.55)", background: "rgba(6,78,59,0.45)", padding: "8px 10px", fontWeight: 900 };
}
function lastChangePos(): React.CSSProperties {
  return { borderRadius: 8, border: "1px solid rgba(74,222,128,0.48)", background: "rgba(20,83,45,0.5)", padding: "5px 8px", fontSize: 12, fontWeight: 900, textAlign: "center" };
}
function lastChangeNeg(): React.CSSProperties {
  return { borderRadius: 8, border: "1px solid rgba(248,113,113,0.52)", background: "rgba(127,29,29,0.5)", padding: "5px 8px", fontSize: 12, fontWeight: 900, textAlign: "center" };
}
function bottomBar(): React.CSSProperties {
  return {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    borderTop: "1px solid rgba(125,211,252,0.26)",
    background: "rgba(2,6,23,0.94)",
    padding: "10px 12px calc(10px + env(safe-area-inset-bottom))",
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "nowrap",
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
  };
}
function actionBtn(kind: "green" | "red" | "spotlight" | "keeper" | "breaker"): React.CSSProperties {
  const styles: Record<string, React.CSSProperties> = {
    green: { border: "1px solid rgba(74,222,128,0.62)", background: "rgba(20,83,45,0.58)" },
    red: { border: "1px solid rgba(248,113,113,0.65)", background: "rgba(127,29,29,0.55)" },
    spotlight: { border: "1px solid rgba(250,204,21,0.68)", background: "rgba(120,53,15,0.58)" },
    keeper: { border: "1px solid rgba(52,211,153,0.62)", background: "rgba(6,78,59,0.58)" },
    breaker: { border: "1px solid rgba(239,68,68,0.62)", background: "rgba(127,29,29,0.58)" },
  };
  return { borderRadius: 11, color: "white", padding: "12px 14px", minHeight: 50, fontWeight: 1000, whiteSpace: "nowrap", ...styles[kind] };
}
function selectedCountBtn(): React.CSSProperties {
  return {
    borderRadius: 11,
    border: "1px solid rgba(125,211,252,0.62)",
    background: "rgba(8,47,73,0.7)",
    color: "white",
    padding: "12px 14px",
    minHeight: 50,
    fontWeight: 1000,
    whiteSpace: "nowrap",
  };
}
function pointsPickBtn(): React.CSSProperties {
  return {
    borderRadius: 11,
    border: "1px solid rgba(250,204,21,0.68)",
    background: "rgba(120,53,15,0.58)",
    color: "white",
    padding: "12px 14px",
    minHeight: 50,
    fontWeight: 1000,
    whiteSpace: "nowrap",
  };
}
function overlayWrap(): React.CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    background: "rgba(2,6,23,0.58)",
    zIndex: 90,
    display: "grid",
    placeItems: "center",
    padding: 14,
  };
}
function overlayCardSmall(): React.CSSProperties {
  return {
    width: "min(560px, 100%)",
    borderRadius: 14,
    border: "1px solid rgba(125,211,252,0.4)",
    background: "rgba(2,6,23,0.95)",
    padding: 12,
    display: "grid",
    gap: 10,
  };
}
function closeBtn(): React.CSSProperties {
  return {
    borderRadius: 8,
    border: "1px solid rgba(148,163,184,0.5)",
    background: "rgba(15,23,42,0.75)",
    color: "white",
    padding: "6px 10px",
    fontWeight: 900,
  };
}
function amountChip(active: boolean): React.CSSProperties {
  return {
    borderRadius: 8,
    border: active ? "1px solid rgba(56,189,248,0.85)" : "1px solid rgba(148,163,184,0.45)",
    background: active ? "rgba(14,165,233,0.25)" : "rgba(15,23,42,0.7)",
    color: "white",
    padding: "8px 0",
    fontWeight: 900,
  };
}
function levelBadge(): React.CSSProperties {
  return {
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.45)",
    background: "rgba(15,23,42,0.7)",
    color: "white",
    fontWeight: 1000,
    fontSize: 14,
    padding: "8px 10px",
    minWidth: 58,
    textAlign: "center",
  };
}
function pointsCardChip(): React.CSSProperties {
  return {
    borderRadius: 999,
    border: "1px solid rgba(250,204,21,0.45)",
    background: "rgba(120,53,15,0.42)",
    color: "white",
    fontWeight: 1000,
    fontSize: 19,
    lineHeight: 1,
    padding: "7px 10px",
    textAlign: "center",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
}
function quickOverlay(): React.CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    pointerEvents: "none",
    zIndex: 95,
    display: "grid",
    placeItems: "center",
  };
}
function quickOverlayCard(): React.CSSProperties {
  return {
    borderRadius: 12,
    border: "1px solid rgba(52,211,153,0.62)",
    background: "rgba(2,6,23,0.9)",
    color: "#bbf7d0",
    padding: "10px 14px",
    fontWeight: 1000,
    fontSize: 16,
    boxShadow: "0 14px 30px rgba(0,0,0,0.35)",
  };
}

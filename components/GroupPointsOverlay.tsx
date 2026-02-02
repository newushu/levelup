"use client";

import React, { useEffect, useMemo, useState } from "react";
import confetti from "canvas-confetti";

type GroupPointsStudent = {
  id: string;
  name: string;
  level: number;
  points_total: number;
  is_competition_team?: boolean;
};

type ApplyResult = {
  student_id: string;
  ok: boolean;
  error?: string;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 180)}` } };
  }
}

export default function GroupPointsOverlay({
  open,
  onClose,
  students,
  title = "Squad Points",
  onApplied,
  loading = false,
  contextLabel,
}: {
  open: boolean;
  onClose: () => void;
  students: GroupPointsStudent[];
  title?: string;
  onApplied?: (result: ApplyResult[], delta: number, selectedIds: string[]) => void;
  loading?: boolean;
  contextLabel?: string;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [pin, setPin] = useState("");
  const [customPoints, setCustomPoints] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [awardedIds, setAwardedIds] = useState<string[]>([]);
  const [pointsOverrides, setPointsOverrides] = useState<Record<string, number>>({});

  const compCrestUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/badges/comp/competition-crest.png`
    : "";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.name.toLowerCase().includes(q));
  }, [students, query]);

  useEffect(() => {
    if (!open) return;
    setPointsOverrides({});
  }, [open, students]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function verifyPin(): Promise<boolean> {
    const res = await fetch("/api/skill-tracker/settings/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: pin.trim() }),
    });
    const sj = await safeJson(res);
    if (!sj.ok) {
      setMsg(sj.json?.error || "PIN verification failed");
      return false;
    }
    return true;
  }

  async function applyPoints(delta: number) {
    if (!selectedIds.length) return setMsg("Select at least one student.");
    if (!pin.trim()) return setMsg("Admin PIN required.");
    if (!Number.isFinite(delta) || delta === 0) return setMsg("Choose a non-zero points amount.");
    if (busy) return;

    setBusy(true);
    setMsg("");

    const okPin = await verifyPin();
    if (!okPin) {
      setBusy(false);
      return;
    }

    const results: ApplyResult[] = [];
    await Promise.all(
      selectedIds.map(async (student_id) => {
        const res = await fetch("/api/ledger/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            student_id,
            points: delta,
            note: `Group points ${delta > 0 ? "+" : ""}${delta}`,
            category: "group_points",
          }),
        });
        const sj = await safeJson(res);
        if (!sj.ok) {
          results.push({ student_id, ok: false, error: sj.json?.error || "Failed to add points" });
          return;
        }
        results.push({ student_id, ok: true });
      })
    );

    const okCount = results.filter((r) => r.ok).length;
    if (okCount) {
      setAwardedIds(selectedIds);
      window.setTimeout(() => setAwardedIds([]), 1400);
      window.setTimeout(() => fireCardConfetti(selectedIds), 80);
      setPointsOverrides((prev) => {
        const next = { ...prev };
        results
          .filter((r) => r.ok)
          .forEach((r) => {
            const base = next[r.student_id] ?? students.find((s) => s.id === r.student_id)?.points_total ?? 0;
            next[r.student_id] = base + delta;
          });
        return next;
      });
    }

    const failed = results.filter((r) => !r.ok);
    if (failed.length) {
      setMsg(`Applied ${okCount}/${results.length}. ${failed[0]?.error ?? "Some failed."}`);
    } else {
      setMsg(`Applied ${delta > 0 ? "+" : ""}${delta} to ${okCount} students.`);
    }
    setBusy(false);
    onApplied?.(results, delta, selectedIds);
  }

  function applyCustomPoints() {
    const val = Number(customPoints);
    if (!Number.isFinite(val)) return setMsg("Enter a valid points number.");
    applyPoints(val);
  }

  function fireCardConfetti(ids: string[]) {
    if (!ids.length) return;
    const width = window.innerWidth || 1;
    const height = window.innerHeight || 1;
    ids.forEach((id, i) => {
      const el = document.getElementById(`group-points-${id}`);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = (rect.left + rect.width / 2) / width;
      const y = (rect.top + rect.height / 2) / height;
      confetti({
        particleCount: 18,
        spread: 50,
        startVelocity: 18,
        gravity: 0.7,
        scalar: 0.8,
        origin: { x, y },
        zIndex: 10000 + i,
      });
    });
  }

  if (!open) return null;

  return (
    <div style={backdrop()} onClick={onClose}>
      <div style={panel()} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 20, fontWeight: 1000 }}>{title}</div>
            {contextLabel ? <div style={{ fontSize: 12, opacity: 0.7 }}>{contextLabel}</div> : null}
          </div>
          <button onClick={onClose} style={closeBtn()}>
            ✕
          </button>
        </div>

        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Search names (ex: "Ari")'
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              const pick = filtered.find((s) => !selectedIds.includes(s.id));
              if (!pick) return;
              e.preventDefault();
              setSelectedIds((prev) => (prev.includes(pick.id) ? prev : [...prev, pick.id]));
              setQuery("");
            }}
            style={input()}
          />
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Admin PIN"
              type="password"
              style={{ ...input(), maxWidth: 180 }}
            />
            <input
              value={customPoints}
              onChange={(e) => setCustomPoints(e.target.value)}
              placeholder="Custom points (ex: 7 or -3)"
              style={{ ...input(), maxWidth: 220 }}
            />
            <button onClick={applyCustomPoints} disabled={busy} style={applyBtn()}>
              Apply
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.85 }}>
            Select students ({selectedIds.length})
          </div>
          <div style={studentGrid()}>
            {loading ? (
              <div style={{ opacity: 0.7 }}>Loading students…</div>
            ) : filtered.length ? (
              filtered.map((s) => {
                const selected = selectedIds.includes(s.id);
                const awarded = awardedIds.includes(s.id);
                return (
                  <button
                    id={`group-points-${s.id}`}
                    key={s.id}
                    onClick={() => toggleSelect(s.id)}
                    style={studentCard(selected, awarded)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontWeight: 900 }}>{s.name}</div>
                      {s.is_competition_team && compCrestUrl ? (
                        <img src={compCrestUrl} alt="Comp Crest" style={crestBadge()} />
                      ) : null}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.75 }}>
                      Lv {s.level} • {pointsOverrides[s.id] ?? s.points_total} pts
                    </div>
                  </button>
                );
              })
            ) : (
              <div style={{ opacity: 0.7 }}>No matches.</div>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.8 }}>Quick add</div>
          <div style={chipRow()}>
            {Array.from({ length: 20 }, (_, i) => i + 1).map((p) => (
              <button key={`p-${p}`} onClick={() => applyPoints(p)} disabled={busy} style={chipBtn("good")}>
                +{p}
              </button>
            ))}
          </div>
          <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.7 }}>Remove</div>
          <div style={chipRow()}>
            {Array.from({ length: 20 }, (_, i) => i + 1).map((p) => (
              <button key={`m-${p}`} onClick={() => applyPoints(-p)} disabled={busy} style={chipBtn("bad")}>
                -{p}
              </button>
            ))}
          </div>
        </div>

        {msg ? <div style={{ fontSize: 12, color: msg.includes("Applied") ? "rgba(34,197,94,0.95)" : "rgba(239,68,68,0.9)" }}>{msg}</div> : null}
      </div>
    </div>
  );
}

function backdrop(): React.CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    background: "rgba(2,6,23,0.72)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: 24,
  };
}

function panel(): React.CSSProperties {
  return {
    width: "min(980px, 92vw)",
    maxHeight: "88vh",
    overflow: "auto",
    borderRadius: 20,
    padding: 18,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "linear-gradient(135deg, rgba(15,23,42,0.92), rgba(2,6,23,0.9))",
    boxShadow: "0 30px 90px rgba(0,0,0,0.5)",
    color: "white",
  };
}

function input(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.3)",
    color: "white",
    outline: "none",
    width: "100%",
  };
}

function closeBtn(): React.CSSProperties {
  return {
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    padding: "6px 10px",
  };
}

function applyBtn(): React.CSSProperties {
  return {
    padding: "10px 16px",
    borderRadius: 12,
    border: "1px solid rgba(34,197,94,0.4)",
    background: "linear-gradient(90deg, rgba(34,197,94,0.85), rgba(14,116,144,0.8))",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
  };
}

function studentGrid(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
  };
}

function studentCard(selected: boolean, awarded: boolean): React.CSSProperties {
  return {
    textAlign: "left",
    padding: "10px 12px",
    borderRadius: 12,
    border: selected ? "1px solid rgba(34,197,94,0.65)" : "1px solid rgba(255,255,255,0.12)",
    background: selected ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)",
    color: "white",
    cursor: "pointer",
    boxShadow: awarded ? "0 0 0 2px rgba(34,197,94,0.6), 0 0 18px rgba(34,197,94,0.35)" : "none",
    transition: "box-shadow 180ms ease, border 180ms ease",
  };
}

function chipRow(): React.CSSProperties {
  return {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  };
}

function chipBtn(kind: "good" | "bad"): React.CSSProperties {
  return {
    width: 32,
    height: 32,
    borderRadius: "999px",
    border: `1px solid ${kind === "good" ? "rgba(34,197,94,0.55)" : "rgba(239,68,68,0.5)"}`,
    background: kind === "good" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.12)",
    color: "white",
    fontWeight: 900,
    fontSize: 11,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  };
}

function crestBadge(): React.CSSProperties {
  return {
    width: 18,
    height: 18,
    objectFit: "contain",
    filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.5))",
  };
}

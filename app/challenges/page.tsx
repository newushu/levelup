"use client";

import React, { useEffect, useMemo, useState } from "react";

type Challenge = {
  id: string;
  name: string;
  theme: string | null;
  tier: string | null;
  points: number;
  is_repeatable: boolean;
  description: string | null;
  is_active: boolean;
};

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [studentId, setStudentId] = useState("");
  const [completedSet, setCompletedSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  async function loadChallenges() {
    const res = await fetch("/api/challenges/list", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error ?? "Failed to load challenges");
    setChallenges(json.challenges ?? []);
  }

  async function loadStudentCompleted(sid: string) {
    if (!sid) {
      setCompletedSet(new Set());
      return;
    }
    const res = await fetch(`/api/students/challenges?studentId=${encodeURIComponent(sid)}`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error ?? "Failed to load student challenges");
    const done = new Set<string>();
    for (const r of json.rows ?? []) {
      if (r.completed) done.add(r.challenge_id);
    }
    setCompletedSet(done);
  }

  async function loadAll() {
    setLoading(true);
    setErr(null);
    try {
      await loadChallenges();
      if (studentId) await loadStudentCompleted(studentId);
    } catch (e: any) {
      setErr(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // When studentId changes, refresh completion state
    (async () => {
      try {
        setErr(null);
        await loadStudentCompleted(studentId);
      } catch (e: any) {
        setErr(e?.message ?? "Unknown error");
      }
    })();
  }, [studentId]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return challenges;
    return challenges.filter((c) => `${c.name} ${c.theme ?? ""} ${c.tier ?? ""}`.toLowerCase().includes(q));
  }, [challenges, filter]);

  async function toggleComplete(challengeId: string) {
    if (!studentId) {
      alert("Enter a studentId first.");
      return;
    }
    const isDone = completedSet.has(challengeId);
    const res = await fetch("/api/challenges/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, challengeId, completed: !isDone }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json?.error ?? "Failed to update completion");
      return;
    }

    setCompletedSet((prev) => {
      const next = new Set(prev);
      if (isDone) next.delete(challengeId);
      else next.add(challengeId);
      return next;
    });

    if (json?.warning) console.warn(json.warning);
  }

  return (
    <div style={{ padding: 18, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0 }}>Challenge Vault</h1>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr", alignItems: "center" }}>
        <input
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          placeholder="studentId (uuid)"
          style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(0,0,0,0.2)" }}
        />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="filter challenges"
          style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(0,0,0,0.2)" }}
        />
      </div>

      <div style={{ marginTop: 10 }}>
        <button onClick={loadAll} disabled={loading} style={{ padding: "8px 12px" }}>
          Refresh
        </button>
      </div>

      {loading ? <p style={{ opacity: 0.7 }}>Loading…</p> : null}
      {err ? <p style={{ color: "crimson" }}>{err}</p> : null}

      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
        {filtered.map((c) => {
          const done = completedSet.has(c.id);
          return (
            <div
              key={c.id}
              style={{
                border: "1px solid rgba(0,0,0,0.12)",
                borderRadius: 12,
                padding: 12,
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 700 }}>{c.name}</div>
                <button onClick={() => toggleComplete(c.id)} style={{ padding: "6px 10px" }}>
                  {done ? "Mark Incomplete" : "Mark Complete"}
                </button>
              </div>

              <div style={{ opacity: 0.75, fontSize: 13 }}>
                Theme: {c.theme ?? "—"} | Tier: {c.tier ?? "—"} | Points: {c.points}
              </div>

              {c.description ? <div style={{ fontSize: 13 }}>{c.description}</div> : null}
              <div style={{ fontSize: 12, opacity: 0.65 }}>
                Active: {String(c.is_active)} | Repeatable: {String(c.is_repeatable)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

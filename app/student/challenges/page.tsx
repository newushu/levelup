"use client";

import { useEffect, useMemo, useState } from "react";
import AuthGate from "@/components/AuthGate";
import AvatarRender from "@/components/AvatarRender";
import StudentNavPanel, { studentNavStyles } from "@/components/StudentNavPanel";

type StudentRow = {
  id: string;
  name: string;
  level?: number | null;
  points_total?: number | null;
  points_balance?: number | null;
  avatar_storage_path?: string | null;
  avatar_zoom_pct?: number | null;
};

type ChallengeRow = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  tier?: string | null;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 180)}` } };
  }
}

export default function StudentChallengesPage() {
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [challenges, setChallenges] = useState<ChallengeRow[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const listRes = await fetch("/api/students/list", { cache: "no-store" });
      const listJson = await safeJson(listRes);
      if (!listJson.ok) return setMsg(listJson.json?.error || "Failed to load students");
      const list = (listJson.json?.students ?? []) as StudentRow[];
      let selectedId = "";
      try {
        selectedId = localStorage.getItem("active_student_id") || "";
      } catch {}
      const selected = list.find((s) => String(s.id) === String(selectedId));
      if (!selected) return setMsg("Please select student.");
      setStudent(selected);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/challenges/list", { cache: "no-store" });
      const sj = await safeJson(res);
      if (!sj.ok) return setMsg(sj.json?.error || "Failed to load challenges");
      setChallenges((sj.json?.challenges ?? []) as ChallengeRow[]);
    })();
  }, []);

  const avatarSrc = useMemo(() => {
    const path = String(student?.avatar_storage_path ?? "").trim();
    if (!path) return null;
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return base ? `${base}/storage/v1/object/public/avatars/${path}` : null;
  }, [student?.avatar_storage_path]);
  const avatarZoomPct = Math.max(50, Math.min(100, Number(student?.avatar_zoom_pct ?? 100)));
  const initials = (student?.name || "").trim().slice(0, 2).toUpperCase() || "LA";

  const grouped = useMemo(() => {
    const map = new Map<string, ChallengeRow[]>();
    challenges.forEach((c) => {
      const key = String(c.category ?? "Uncategorized");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [challenges]);

  return (
    <AuthGate>
      <div className="student-challenges">
        <style>{pageStyles()}</style>
        <style>{studentNavStyles()}</style>
        <StudentNavPanel />
        <div className="student-challenges__inner">
          <button className="back-btn" onClick={() => window.history.back()}>Back</button>
          <header className="student-challenges__header">
            <div className="student-challenges__meta">
              <div className="student-challenges__title">{student?.name ?? "Student"}</div>
              <div className="student-challenges__sub">Level {student?.level ?? 1} • {Number(student?.points_balance ?? student?.points_total ?? 0).toLocaleString()} pts</div>
            </div>
            <AvatarRender
              size={140}
              bg="rgba(15,23,42,0.6)"
              avatarSrc={avatarSrc}
              avatarZoomPct={avatarZoomPct}
              showImageBorder={false}
              style={{ borderRadius: 18 }}
              fallback={<div className="student-challenges__avatar-fallback">{initials}</div>}
            />
          </header>

          {msg ? <div className="notice">{msg}</div> : null}

          <div className="challenge-groups">
            {grouped.map(([category, rows]) => (
              <section key={category} className="challenge-group">
                <div className="challenge-group__title">{category}</div>
                <div className="challenge-grid">
                  {rows.map((c) => (
                    <div key={c.id} className="challenge-card">
                      <div className="challenge-card__name">{c.name}</div>
                      <div className="challenge-card__tier">{c.tier ?? "—"}</div>
                      {c.description ? <div className="challenge-card__desc">{c.description}</div> : null}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </AuthGate>
  );
}

function pageStyles() {
  return `
    .student-challenges {
      min-height: 80vh;
      padding: 36px 36px 60px 260px;
      display: flex;
      justify-content: flex-start;
      width: 100%;
    }
    .student-challenges__inner {
      width: 100%;
      display: grid;
      gap: 20px;
    }
    .back-btn {
      justify-self: start;
      padding: 8px 12px;
      border-radius: 12px;
      border: 1px solid rgba(148,163,184,0.2);
      background: rgba(30,41,59,0.7);
      color: inherit;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      font-size: 11px;
    }
    .student-challenges__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    .student-challenges__title {
      font-size: clamp(24px, 4vw, 36px);
      font-weight: 1000;
    }
    .student-challenges__sub {
      opacity: 0.7;
      font-size: 14px;
    }
    .student-challenges__avatar-fallback {
      width: 140px;
      height: 140px;
      border-radius: 18px;
      display: grid;
      place-items: center;
      font-weight: 900;
      font-size: 30px;
      background: rgba(30,41,59,0.8);
    }
    .notice {
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid rgba(239,68,68,0.3);
      background: rgba(239,68,68,0.12);
      color: white;
      font-weight: 900;
      font-size: 12px;
    }
    .challenge-groups {
      display: grid;
      gap: 20px;
    }
    .challenge-group__title {
      font-weight: 1000;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      opacity: 0.8;
      margin-bottom: 10px;
    }
    .challenge-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 12px;
    }
    .challenge-card {
      padding: 12px;
      border-radius: 14px;
      background: rgba(15,23,42,0.9);
      border: 1px solid rgba(148,163,184,0.18);
      display: grid;
      gap: 6px;
    }
    .challenge-card__name {
      font-weight: 1000;
    }
    .challenge-card__tier {
      font-size: 12px;
      opacity: 0.7;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .challenge-card__desc {
      font-size: 12px;
      opacity: 0.7;
    }
    @media (max-width: 1200px) {
      .challenge-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .student-challenges {
        padding: 30px 18px 50px;
      }
    }
  `;
}

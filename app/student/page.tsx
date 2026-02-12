"use client";

import { useEffect, useMemo, useState } from "react";
import AuthGate from "../../components/AuthGate";
import AvatarRender from "@/components/AvatarRender";

type StudentRow = {
  id: string;
  name: string;
  level?: number | null;
  points_total?: number | null;
  points_balance?: number | null;
  avatar_storage_path?: string | null;
  avatar_zoom_pct?: number | null;
};

const cards = [
  {
    title: "Student Info",
    subtitle: "Points, level, progress",
    href: "/student/info",
    artClass: "art-student",
  },
  {
    title: "At-Home Tasks",
    subtitle: "Home Quest and goals",
    href: "/home-quest",
    artClass: "art-home",
  },
  {
    title: "Redeem Rewards",
    subtitle: "Spend points & unlocks",
    href: "/rewards",
    artClass: "art-rewards",
  },
  {
    title: "Logs & Reports",
    subtitle: "History and metrics",
    href: "/my-metrics?tab=Taolu%20Tracker",
    artClass: "art-logs",
  },
  {
    title: "Challenge Vault",
    subtitle: "Complete and track challenges",
    href: "/student/challenges",
    artClass: "art-challenges",
  },
];

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, json: { error: `Non-JSON response (status ${res.status}): ${text.slice(0, 180)}` } };
  }
}

export default function StudentLandingPage() {
  const [checked, setChecked] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoZoom, setLogoZoom] = useState(1);
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [studentQuery, setStudentQuery] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await fetch("/api/public/nav-logo", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!mounted) return;
      if (data?.logo_url) setLogoUrl(String(data.logo_url));
      if (data?.logo_zoom) setLogoZoom(Number(data.logo_zoom ?? 1));
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const sj = await safeJson(res);
      if (!sj.ok) {
        window.location.href = "/login";
        return;
      }
      const role = String(sj.json?.role ?? "");
      const allowed = ["student", "admin", "coach", "classroom"].includes(role);
      if (!allowed) {
        window.location.href = "/";
        return;
      }
      setChecked(true);
    })();
  }, []);

  useEffect(() => {
    if (!checked) return;
    (async () => {
      const listRes = await fetch("/api/students/list", { cache: "no-store" });
      const listJson = await safeJson(listRes);
      if (!listJson.ok) return;
      const list = (listJson.json?.students ?? []) as StudentRow[];
      setStudents(list);
      try {
        const saved = localStorage.getItem("active_student_id") || "";
        if (saved) {
          const found = list.find((s) => String(s.id) === String(saved));
          if (found) setStudent(found);
        }
      } catch {}
    })();
  }, [checked]);

  const logoSize = useMemo(() => Math.max(240, 240 * logoZoom), [logoZoom]);
  const avatarSrc = useMemo(() => {
    const path = String(student?.avatar_storage_path ?? "").trim();
    if (!path) return null;
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return base ? `${base}/storage/v1/object/public/avatars/${path}` : null;
  }, [student?.avatar_storage_path]);
  const avatarZoomPct = Math.max(50, Math.min(200, Number(student?.avatar_zoom_pct ?? 100)));
  const pointsDisplay = Number(student?.points_balance ?? student?.points_total ?? 0);
  const levelDisplay = Number(student?.level ?? 1);
  const initials = (student?.name || "").trim().slice(0, 2).toUpperCase() || "LA";

  function selectStudentByName(name: string) {
    const match = students.find((s) => String(s.name ?? "").toLowerCase() === name.trim().toLowerCase());
    if (!match) return setNotice("Please select a student from the list.");
    setStudent(match);
    setStudentQuery("");
    setNotice("");
    try {
      localStorage.setItem("active_student_id", String(match.id));
    } catch {}
  }

  function clearSelectedStudent() {
    setStudent(null);
    setStudentQuery("");
    try {
      localStorage.removeItem("active_student_id");
    } catch {}
  }

  return (
    <AuthGate>
      <div className="student-landing">
        <style>{pageStyles()}</style>
        <div className="student-landing__halo" />
        <div className="student-landing__content">
          <button className="back-btn" onClick={() => window.history.back()}>Back</button>
          <div className="student-landing__selector">
            {!student ? (
              <>
                <div className="selector-label">Select Student</div>
                <input
                  className="selector-input"
                  list="student-list"
                  placeholder="Start typing a student name..."
                  value={studentQuery}
                  onChange={(e) => setStudentQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      selectStudentByName(studentQuery);
                    }
                  }}
                />
                <datalist id="student-list">
                  {students.map((s) => (
                    <option key={s.id} value={s.name} />
                  ))}
                </datalist>
                {notice ? <div className="selector-note">{notice}</div> : null}
              </>
            ) : (
              <div className="selector-selected">
                <div className="selector-selected__meta">
                  <div className="selector-selected__name">{student.name}</div>
                  <div className="selector-selected__sub">Level {levelDisplay} • {pointsDisplay.toLocaleString()} pts</div>
                </div>
                <AvatarRender
                  size={120}
                  bg="rgba(15,23,42,0.6)"
                  avatarSrc={avatarSrc}
                  avatarZoomPct={avatarZoomPct}
                  showImageBorder={false}
                  style={{ borderRadius: 18 }}
                  fallback={<div className="student-landing__avatar-fallback">{initials}</div>}
                />
                <button className="selector-clear" onClick={clearSelectedStudent}>Clear selected student</button>
              </div>
            )}
          </div>

          <header className="student-landing__header">
            <div className="student-landing__logo">
              <img
                src={logoUrl ?? "https://newushu.com/uploads/1/1/1/3/111378341/newushu-black-transparent-2.png"}
                alt="Logo"
                style={{ width: logoSize, height: logoSize, objectFit: "contain", filter: "invert(1)" }}
              />
            </div>
            <div className="student-landing__title">Lead &amp; Achieve</div>
            <div className="student-landing__subtitle">Level Up</div>
          </header>

          {checked ? (
            <section className="student-landing__grid">
              {cards.map((card) => (
                <a
                  key={card.title}
                  href={card.href}
                  className="student-landing__card"
                  onClick={(e) => {
                    if (!student) {
                      e.preventDefault();
                      setNotice("Please select student");
                    }
                  }}
                >
                  <div className={`student-landing__art ${card.artClass}`} />
                  <div className="student-landing__card-title">{card.title}</div>
                  <div className="student-landing__card-subtitle">{card.subtitle}</div>
                </a>
              ))}
            </section>
          ) : (
            <div className="student-landing__loading">Loading student home…</div>
          )}
        </div>
      </div>
    </AuthGate>
  );
}

function pageStyles() {
  return `
    .student-landing {
      min-height: 80vh;
      display: grid;
      place-items: center;
      padding: 40px 18px 60px;
      position: relative;
      overflow: visible;
    }

    .student-landing__halo {
      position: absolute;
      inset: -20% 10% auto 10%;
      height: 360px;
      background: radial-gradient(circle at top, rgba(56,189,248,0.30), rgba(2,8,23,0));
      filter: blur(20px);
      opacity: 0.75;
      z-index: 0;
    }

    .student-landing__content {
      width: min(1100px, 100%);
      display: grid;
      gap: 30px;
      position: relative;
      z-index: 1;
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

    .student-landing__selector {
      padding: 18px;
      border-radius: 20px;
      background: linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.85));
      border: 1px solid rgba(148,163,184,0.18);
      display: grid;
      gap: 10px;
    }

    .selector-label {
      font-size: 12px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.7;
    }

    .selector-input {
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid rgba(148,163,184,0.22);
      background: rgba(2,6,23,0.8);
      color: white;
      font-weight: 800;
      font-size: 14px;
    }

    .selector-note {
      font-size: 12px;
      opacity: 0.75;
    }

    .selector-selected {
      display: grid;
      gap: 10px;
      justify-items: center;
      text-align: center;
      width: 100%;
    }

    .selector-selected__name {
      font-size: 22px;
      font-weight: 1000;
    }

    .selector-selected__sub {
      font-size: 13px;
      opacity: 0.75;
    }

    .selector-selected__meta {
      display: grid;
      gap: 4px;
    }

    .selector-clear {
      margin-top: 6px;
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid rgba(148,163,184,0.22);
      background: rgba(30,41,59,0.7);
      color: inherit;
      font-weight: 900;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      font-size: 11px;
      justify-self: end;
    }

    .student-landing__header {
      display: grid;
      place-items: center;
      text-align: center;
      gap: 8px;
    }

    .student-landing__logo {
      width: 240px;
      height: 240px;
      border-radius: 26px;
      background: linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02));
      border: 1px solid rgba(255,255,255,0.12);
      display: grid;
      place-items: center;
      box-shadow: 0 18px 45px rgba(0,0,0,0.45);
    }

    .student-landing__title {
      font-size: clamp(30px, 5vw, 44px);
      font-weight: 1000;
      letter-spacing: 1.4px;
    }

    .student-landing__subtitle {
      font-size: clamp(16px, 3vw, 22px);
      font-weight: 800;
      opacity: 0.82;
      letter-spacing: 1px;
    }

    .student-landing__grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 22px;
    }

    .student-landing__card {
      position: relative;
      padding: 24px 22px 26px;
      border-radius: 22px;
      background: linear-gradient(150deg, rgba(15,23,42,0.98), rgba(2,6,23,0.92));
      border: 1px solid rgba(148,163,184,0.18);
      box-shadow: 0 14px 30px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.12);
      text-decoration: none;
      color: inherit;
      display: grid;
      gap: 12px;
      transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
    }

    .student-landing__card:hover {
      transform: translateY(-6px);
      border-color: rgba(56,189,248,0.35);
      box-shadow: 0 20px 38px rgba(0,0,0,0.5), 0 0 28px rgba(56,189,248,0.18);
    }

    .student-landing__art {
      height: 150px;
      border-radius: 18px;
      position: relative;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.12);
      background: radial-gradient(circle at 20% 20%, rgba(255,255,255,0.2), rgba(15,23,42,0.3));
      box-shadow: inset 0 0 18px rgba(0,0,0,0.4);
    }

    .student-landing__art::after {
      content: "";
      position: absolute;
      inset: 10% 30% 40% 10%;
      border-radius: 20px;
      background: rgba(255,255,255,0.12);
      filter: blur(1px);
      transform: rotate(-8deg);
    }

    .student-landing__card-title {
      font-size: 20px;
      font-weight: 900;
    }

    .student-landing__card-subtitle {
      font-size: 14px;
      opacity: 0.7;
    }

    .student-landing__loading {
      padding: 20px;
      text-align: center;
      opacity: 0.7;
    }

    .art-student {
      background: radial-gradient(circle at 15% 20%, rgba(56,189,248,0.45), rgba(2,6,23,0.8)),
        linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.7));
    }

    .art-home {
      background: radial-gradient(circle at 20% 20%, rgba(251,191,36,0.45), rgba(15,23,42,0.75)),
        linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.7));
    }

    .art-rewards {
      background: radial-gradient(circle at 20% 20%, rgba(16,185,129,0.45), rgba(15,23,42,0.75)),
        linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.7));
    }

    .art-logs {
      background: radial-gradient(circle at 20% 20%, rgba(244,114,182,0.45), rgba(15,23,42,0.75)),
        linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.7));
    }

    .art-challenges {
      background: radial-gradient(circle at 20% 20%, rgba(34,197,94,0.45), rgba(15,23,42,0.75)),
        linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.7));
    }

    @media (max-width: 720px) {
      .student-landing {
        padding: 30px 14px 50px;
      }

      .student-landing__grid {
        grid-template-columns: 1fr;
      }

      .student-landing__art {
        height: 120px;
      }

      .student-landing__logo {
        width: 180px;
        height: 180px;
      }
    }

    @media (max-width: 1200px) {
      .student-landing__grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `;
}

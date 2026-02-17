"use client";

import { useEffect, useMemo, useState } from "react";
import AvatarRender from "@/components/AvatarRender";

type StudentSummary = {
  id?: string;
  name?: string | null;
  level?: number | null;
  points_total?: number | null;
  points_balance?: number | null;
  avatar_storage_path?: string | null;
  avatar_zoom_pct?: number | null;
  is_competition_team?: boolean | null;
};

export default function StudentWorkspaceTopBar({
  student,
  onClearStudent,
  students = [],
  onSelectStudentByName,
  onSelectStudent,
  recentMvp = false,
  hasGift = false,
  hideWhenNoStudent = false,
}: {
  student: StudentSummary | null;
  onClearStudent?: () => void;
  students?: Array<{ id?: string | null; name?: string | null }>;
  onSelectStudentByName?: (name: string) => void;
  onSelectStudent?: () => void;
  recentMvp?: boolean;
  hasGift?: boolean;
  hideWhenNoStudent?: boolean;
}) {
  const [studentQuery, setStudentQuery] = useState("");
  const [avatarCatalog, setAvatarCatalog] = useState<Array<{ id: string; storage_path: string | null; enabled?: boolean | null }>>([]);
  const [avatarId, setAvatarId] = useState("");
  const [avatarBg, setAvatarBg] = useState("rgba(15,23,42,0.65)");
  const [avatarEffectKey, setAvatarEffectKey] = useState<string | null>(null);
  const [cornerBorderKey, setCornerBorderKey] = useState<string | null>(null);
  const [effectCatalog, setEffectCatalog] = useState<Array<{ key: string; config?: any; render_mode?: string | null; z_layer?: string | null; html?: string | null; css?: string | null; js?: string | null }>>([]);
  const [cornerBorders, setCornerBorders] = useState<Array<{ key: string; image_url?: string | null; render_mode?: string | null; z_layer?: string | null; html?: string | null; css?: string | null; js?: string | null; offset_x?: number | null; offset_y?: number | null; offsets_by_context?: Record<string, { x?: number | null; y?: number | null; scale?: number | null; rotate?: number | null }> | null; enabled?: boolean | null }>>([]);

  useEffect(() => {
    setStudentQuery(student?.name ?? "");
  }, [student?.name, student?.id]);

  useEffect(() => {
    (async () => {
      const [avatarsRes, effectsRes, bordersRes] = await Promise.all([
        fetch("/api/avatars/list", { cache: "no-store" }),
        fetch("/api/avatar-effects/list", { cache: "no-store" }),
        fetch("/api/corner-borders", { cache: "no-store" }),
      ]);
      const avatarsJson = await avatarsRes.json().catch(() => ({}));
      if (avatarsRes.ok) setAvatarCatalog((avatarsJson?.avatars ?? []) as any[]);
      const effectsJson = await effectsRes.json().catch(() => ({}));
      if (effectsRes.ok) setEffectCatalog((effectsJson?.effects ?? []) as any[]);
      const bordersJson = await bordersRes.json().catch(() => ({}));
      if (bordersRes.ok) setCornerBorders((bordersJson?.borders ?? []) as any[]);
    })();
  }, []);

  useEffect(() => {
    if (!student?.id) return;
    (async () => {
      const res = await fetch("/api/avatar/get", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: student.id }),
      });
      const sj = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const s = sj?.settings ?? null;
      setAvatarId(String(s?.avatar_id ?? "").trim());
      const bg = String(s?.bg_color ?? "").trim();
      setAvatarBg(bg || "rgba(15,23,42,0.65)");
      const effectKey = String(s?.particle_style ?? "").trim();
      setAvatarEffectKey(effectKey || null);
      const borderKey = String(s?.corner_border_key ?? "").trim();
      setCornerBorderKey(borderKey || null);
    })();
  }, [student?.id]);

  const avatarSrc = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!base) return null;
    if (avatarId) {
      const row = avatarCatalog.find((a) => String(a.id) === String(avatarId));
      const mapped = String(row?.storage_path ?? "").trim();
      if (mapped) return `${base}/storage/v1/object/public/avatars/${mapped}`;
    }
    const fallback = String(student?.avatar_storage_path ?? "").trim();
    if (!fallback) return null;
    return `${base}/storage/v1/object/public/avatars/${fallback}`;
  }, [avatarId, avatarCatalog, student?.avatar_storage_path]);

  const selectedEffect = useMemo(() => {
    if (!avatarEffectKey) return null;
    return effectCatalog.find((e) => String(e.key) === String(avatarEffectKey)) ?? { key: avatarEffectKey };
  }, [avatarEffectKey, effectCatalog]);

  const selectedBorder = useMemo(() => {
    if (!cornerBorderKey) return null;
    return cornerBorders.find((b) => String(b.key) === String(cornerBorderKey) && b.enabled !== false) ?? null;
  }, [cornerBorderKey, cornerBorders]);

  const avatarZoomPct = Math.max(50, Math.min(200, Number(student?.avatar_zoom_pct ?? 100)));
  const points = Number(student?.points_balance ?? student?.points_total ?? 0);
  const level = Number(student?.level ?? 1);
  const initials = (student?.name || "").trim().slice(0, 2).toUpperCase() || "LA";
  const competition = Boolean(student?.is_competition_team);

  if (!student && hideWhenNoStudent) return null;

  return (
    <section className={`student-workspace-topbar ${competition ? "student-workspace-topbar--competition" : ""}`}>
      <div className="student-workspace-topbar__left">
        <div className="student-workspace-topbar__avatar">
          <AvatarRender
            size={116}
            bg={avatarBg}
            avatarSrc={avatarSrc}
            avatarZoomPct={avatarZoomPct}
            effect={selectedEffect as any}
            border={selectedBorder as any}
            showImageBorder={false}
            style={{ borderRadius: 16 }}
            contextKey="student_workspace"
            fallback={<div className="student-workspace-topbar__avatar-fallback">{initials}</div>}
          />
        </div>
        <div className="student-workspace-topbar__meta">
          <div className="student-workspace-topbar__name-wrap">
            <div className="student-workspace-topbar__name">{student?.name ?? "No Student Selected"}</div>
            {hasGift ? <span className="student-workspace-topbar__gift" title="Has unopened gifts">🎁</span> : null}
          </div>
          <div className="student-workspace-topbar__chips">
            <span className="student-workspace-topbar__chip">Level {level}</span>
            <span className="student-workspace-topbar__chip student-workspace-topbar__chip--points">{points.toLocaleString()} pts</span>
            {competition ? <span className="student-workspace-topbar__chip student-workspace-topbar__chip--team">Competition Team</span> : null}
            {recentMvp ? <div className="student-workspace-topbar__recent-mvp">Recent <span>MVP</span></div> : null}
          </div>
        </div>
      </div>
      <div className="student-workspace-topbar__right">
        {onSelectStudentByName ? (
          <div className="student-workspace-topbar__picker">
            <input
              list="student-workspace-picker"
              value={studentQuery}
              onChange={(e) => setStudentQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSelectStudentByName(studentQuery);
                }
              }}
              placeholder="Pick student..."
            />
            <datalist id="student-workspace-picker">
              {students.map((s) => (
                <option key={String(s.id ?? "")} value={String(s.name ?? "")} />
              ))}
            </datalist>
            <button className="student-workspace-topbar__pick" onClick={() => onSelectStudentByName(studentQuery)}>
              Select
            </button>
          </div>
        ) : null}
        {onClearStudent ? (
          <button className="student-workspace-topbar__clear" onClick={onClearStudent}>
            Clear Student
          </button>
        ) : null}
        {!student && onSelectStudent ? (
          <button className="student-workspace-topbar__pick" onClick={onSelectStudent}>
            Select Student
          </button>
        ) : null}
      </div>
    </section>
  );
}

export function studentWorkspaceTopBarStyles() {
  return `
    .student-workspace-topbar {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      border-radius: 18px;
      padding: 12px 14px;
      border: 1px solid rgba(148,163,184,0.24);
      background: linear-gradient(150deg, rgba(15,23,42,0.98), rgba(2,6,23,0.88));
      box-shadow: 0 16px 34px rgba(0,0,0,0.35);
    }

    .student-workspace-topbar--competition {
      border-color: rgba(251,191,36,0.45);
      box-shadow: 0 16px 34px rgba(0,0,0,0.35), 0 0 26px rgba(251,191,36,0.2);
      background: linear-gradient(150deg, rgba(71,26,4,0.42), rgba(15,23,42,0.95));
    }

    .student-workspace-topbar__left {
      display: flex;
      align-items: center;
      gap: 14px;
      min-width: 0;
    }

    .student-workspace-topbar__avatar-fallback {
      width: 116px;
      height: 116px;
      border-radius: 16px;
      display: grid;
      place-items: center;
      font-size: 30px;
      font-weight: 1000;
      background: rgba(30,41,59,0.9);
    }

    .student-workspace-topbar__meta {
      display: grid;
      gap: 8px;
      min-width: 0;
    }

    .student-workspace-topbar__name {
      font-size: clamp(20px, 2.4vw, 34px);
      font-weight: 1000;
      line-height: 1.05;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: min(54vw, 560px);
    }

    .student-workspace-topbar__name-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .student-workspace-topbar__gift {
      font-size: 28px;
      line-height: 1;
      filter: drop-shadow(0 0 10px rgba(250,204,21,0.7));
      animation: topbarGiftPulse 1.4s ease-in-out infinite;
      flex: 0 0 auto;
    }
    @keyframes topbarGiftPulse {
      0% { transform: scale(1); opacity: 0.9; }
      50% { transform: scale(1.14); opacity: 1; }
      100% { transform: scale(1); opacity: 0.9; }
    }

    .student-workspace-topbar__chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }

    .student-workspace-topbar__chip {
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 14px;
      font-weight: 900;
      border: 1px solid rgba(148,163,184,0.35);
      background: rgba(30,41,59,0.7);
    }

    .student-workspace-topbar__chip--points {
      font-size: 18px;
      border-color: rgba(56,189,248,0.45);
      background: rgba(56,189,248,0.2);
    }

    .student-workspace-topbar__chip--team {
      border-color: rgba(251,191,36,0.55);
      background: rgba(251,191,36,0.22);
      color: #fde68a;
    }

    .student-workspace-topbar__right {
      display: grid;
      justify-items: end;
      gap: 10px;
      flex-shrink: 0;
    }

    .student-workspace-topbar__picker {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .student-workspace-topbar__picker input {
      min-width: 220px;
      border-radius: 10px;
      border: 1px solid rgba(148,163,184,0.35);
      background: rgba(15,23,42,0.74);
      color: #f8fafc;
      padding: 8px 10px;
      font-size: 12px;
      font-weight: 800;
    }

    .student-workspace-topbar__recent-mvp {
      position: relative;
      overflow: hidden;
      border-radius: 999px;
      border: 1px solid rgba(250,204,21,0.65);
      background: linear-gradient(140deg, rgba(250,204,21,0.24), rgba(253,224,71,0.08));
      color: #fef9c3;
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 1000;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      box-shadow: 0 0 18px rgba(250,204,21,0.28), inset 0 0 14px rgba(250,204,21,0.12);
    }

    .student-workspace-topbar__recent-mvp::before {
      content: "";
      position: absolute;
      inset: -30% -10%;
      background: linear-gradient(120deg, rgba(255,255,255,0), rgba(255,255,255,0.6), rgba(255,255,255,0));
      transform: translateX(-120%);
      animation: mvpShine 1.9s ease-in-out infinite;
      pointer-events: none;
    }

    .student-workspace-topbar__recent-mvp::after {
      content: "✦ ✧ ✦";
      position: absolute;
      right: 8px;
      top: -6px;
      font-size: 11px;
      color: rgba(255,255,255,0.95);
      text-shadow: 0 0 10px rgba(250,204,21,0.9);
      animation: mvpSparkle 1.4s ease-in-out infinite;
      pointer-events: none;
    }

    .student-workspace-topbar__recent-mvp span {
      color: #facc15;
      text-shadow: 0 0 10px rgba(250,204,21,0.65);
    }

    .student-workspace-topbar__clear {
      border-radius: 12px;
      padding: 8px 12px;
      border: 1px solid rgba(248,113,113,0.4);
      background: rgba(239,68,68,0.2);
      color: white;
      font-size: 12px;
      font-weight: 900;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .student-workspace-topbar__pick {
      border-radius: 12px;
      padding: 8px 12px;
      border: 1px solid rgba(56,189,248,0.5);
      background: rgba(14,165,233,0.22);
      color: white;
      font-size: 12px;
      font-weight: 900;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    @media (max-width: 860px) {
      .student-workspace-topbar {
        align-items: flex-start;
      }
      .student-workspace-topbar__avatar {
        display: none;
      }
      .student-workspace-topbar__name {
        max-width: 100%;
      }
      .student-workspace-topbar__picker {
        width: 100%;
      }
      .student-workspace-topbar__picker input {
        min-width: 0;
        flex: 1 1 auto;
      }
    }

    @keyframes mvpShine {
      0% { transform: translateX(-120%); }
      65% { transform: translateX(120%); }
      100% { transform: translateX(120%); }
    }

    @keyframes mvpSparkle {
      0% { transform: scale(1) rotate(0deg); opacity: 0.72; }
      50% { transform: scale(1.18) rotate(8deg); opacity: 1; }
      100% { transform: scale(1) rotate(0deg); opacity: 0.72; }
    }
  `;
}

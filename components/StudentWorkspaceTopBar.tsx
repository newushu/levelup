"use client";

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
  badgeUrl,
  hideWhenNoStudent = false,
}: {
  student: StudentSummary | null;
  onClearStudent?: () => void;
  badgeUrl?: string | null;
  hideWhenNoStudent?: boolean;
}) {
  if (!student && hideWhenNoStudent) return null;

  const path = String(student?.avatar_storage_path ?? "").trim();
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const avatarSrc = path && base ? `${base}/storage/v1/object/public/avatars/${path}` : null;
  const avatarZoomPct = Math.max(50, Math.min(200, Number(student?.avatar_zoom_pct ?? 100)));
  const points = Number(student?.points_balance ?? student?.points_total ?? 0);
  const level = Number(student?.level ?? 1);
  const initials = (student?.name || "").trim().slice(0, 2).toUpperCase() || "LA";
  const competition = Boolean(student?.is_competition_team);

  return (
    <section className={`student-workspace-topbar ${competition ? "student-workspace-topbar--competition" : ""}`}>
      <div className="student-workspace-topbar__left">
        <div className="student-workspace-topbar__avatar">
          <AvatarRender
            size={116}
            bg="rgba(15,23,42,0.65)"
            avatarSrc={avatarSrc}
            avatarZoomPct={avatarZoomPct}
            showImageBorder={false}
            style={{ borderRadius: 16 }}
            fallback={<div className="student-workspace-topbar__avatar-fallback">{initials}</div>}
          />
        </div>
        <div className="student-workspace-topbar__meta">
          <div className="student-workspace-topbar__name">{student?.name ?? "No Student Selected"}</div>
          <div className="student-workspace-topbar__chips">
            <span className="student-workspace-topbar__chip">Level {level}</span>
            <span className="student-workspace-topbar__chip student-workspace-topbar__chip--points">{points.toLocaleString()} pts</span>
            {competition ? <span className="student-workspace-topbar__chip student-workspace-topbar__chip--team">Competition Team</span> : null}
          </div>
        </div>
      </div>
      <div className="student-workspace-topbar__right">
        <div className="student-workspace-topbar__badge">
          {badgeUrl ? <img src={badgeUrl} alt="MVP badge" /> : <span>MVP</span>}
        </div>
        {onClearStudent ? (
          <button className="student-workspace-topbar__clear" onClick={onClearStudent}>
            Clear Student
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

    .student-workspace-topbar__badge {
      width: 72px;
      height: 72px;
      border-radius: 16px;
      border: 1px solid rgba(250,204,21,0.5);
      background: radial-gradient(circle at 40% 20%, rgba(250,204,21,0.25), rgba(15,23,42,0.9));
      display: grid;
      place-items: center;
      font-size: 14px;
      font-weight: 1000;
      box-shadow: 0 0 20px rgba(250,204,21,0.3);
    }

    .student-workspace-topbar__badge img {
      width: 90%;
      height: 90%;
      object-fit: contain;
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
      .student-workspace-topbar__badge {
        width: 58px;
        height: 58px;
      }
    }
  `;
}

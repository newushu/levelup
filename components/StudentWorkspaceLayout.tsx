"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import StudentNavPanel, { studentNavStyles } from "@/components/StudentNavPanel";
import StudentKioskControls from "@/components/StudentKioskControls";
import StudentWorkspaceTopBar, { studentWorkspaceTopBarStyles } from "@/components/StudentWorkspaceTopBar";

type StudentRow = {
  id: string;
  name: string;
  level?: number | null;
  points_total?: number | null;
  points_balance?: number | null;
  avatar_storage_path?: string | null;
  avatar_zoom_pct?: number | null;
  is_competition_team?: boolean | null;
};

export default function StudentWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showTopBar = useMemo(() => !String(pathname ?? "").startsWith("/student/info"), [pathname]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [student, setStudent] = useState<StudentRow | null>(null);

  useEffect(() => {
    if (!showTopBar) return;
    (async () => {
      const res = await fetch("/api/students/list", { cache: "no-store" });
      const sj = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const rows = (sj?.students ?? []) as StudentRow[];
      setStudents(rows);
      let activeId = "";
      try {
        activeId = localStorage.getItem("active_student_id") || "";
      } catch {}
      const selected = rows.find((r) => String(r.id) === String(activeId)) ?? null;
      setStudent(selected);
    })();
  }, [showTopBar]);

  function persistStudent(next: StudentRow | null) {
    setStudent(next);
    try {
      if (next?.id) localStorage.setItem("active_student_id", String(next.id));
      else localStorage.removeItem("active_student_id");
    } catch {}
  }

  function onSelectStudentByName(name: string) {
    const query = String(name ?? "").trim().toLowerCase();
    if (!query) return;
    const exact = students.find((s) => String(s.name ?? "").trim().toLowerCase() === query);
    const partial = students.find((s) => String(s.name ?? "").trim().toLowerCase().includes(query));
    persistStudent(exact ?? partial ?? null);
  }

  return (
    <>
      <style>{studentNavStyles()}</style>
      <style>{studentWorkspaceTopBarStyles()}</style>
      <style>{`
        .student-workspace-layout-topbar {
          margin-left: 252px;
          margin-right: 14px;
          padding-top: 10px;
          position: relative;
          z-index: 40;
        }
        @media (max-width: 1100px) {
          .student-workspace-layout-topbar {
            margin-left: 0;
            margin-right: 0;
            padding: 8px 8px 0;
          }
        }
      `}</style>
      <StudentKioskControls />
      <StudentNavPanel />
      {showTopBar ? (
        <div className="student-workspace-layout-topbar">
          <StudentWorkspaceTopBar
            student={student}
            students={students}
            onSelectStudentByName={onSelectStudentByName}
            onClearStudent={() => persistStudent(null)}
          />
        </div>
      ) : null}
      {children}
    </>
  );
}

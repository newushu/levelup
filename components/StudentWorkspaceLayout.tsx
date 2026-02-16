"use client";

import StudentNavPanel, { studentNavStyles } from "@/components/StudentNavPanel";
import StudentKioskControls from "@/components/StudentKioskControls";

export default function StudentWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{studentNavStyles()}</style>
      <StudentKioskControls />
      <StudentNavPanel />
      {children}
    </>
  );
}

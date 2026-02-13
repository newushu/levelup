"use client";

import StudentNavPanel, { studentNavStyles } from "@/components/StudentNavPanel";

export default function StudentWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{studentNavStyles()}</style>
      <StudentNavPanel />
      {children}
    </>
  );
}

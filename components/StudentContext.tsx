"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type SelectedStudent = {
  id: string;
  name: string;
  level: number;
  points_total: number;
  is_competition_team: boolean;
};

type Ctx = {
  selected: SelectedStudent | null;
  setSelected: (s: SelectedStudent | null) => void;
  refreshSelected: () => Promise<void>;
};

const StudentCtx = createContext<Ctx | null>(null);

export function StudentProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelectedState] = useState<SelectedStudent | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("selected_student");
    if (raw) {
      try {
        setSelectedState(JSON.parse(raw));
      } catch {}
    }
  }, []);

  const setSelected = (s: SelectedStudent | null) => {
    setSelectedState(s);
    if (!s) localStorage.removeItem("selected_student");
    else localStorage.setItem("selected_student", JSON.stringify(s));
  };

  const refreshSelected = async () => {
    if (!selected?.id) return;
    const res = await fetch(`/api/students/get?id=${encodeURIComponent(selected.id)}`, { cache: "no-store" });
    const data = await res.json();
    if (res.ok && data.student) setSelected(data.student);
  };

  const value = useMemo(() => ({ selected, setSelected, refreshSelected }), [selected]);

  return <StudentCtx.Provider value={value}>{children}</StudentCtx.Provider>;
}

export function useSelectedStudent() {
  const ctx = useContext(StudentCtx);
  if (!ctx) throw new Error("useSelectedStudent must be used within StudentProvider");
  return ctx;
}

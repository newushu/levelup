"use client";

import React from "react";

export type MedalCounts = { gold: number; silver: number; bronze: number; master: number };

export type StudentRoster = {
  id: string;
  firstName: string;
  lastName: string;
  points: number;
  medalCounts: MedalCounts;
  corner_border_url?: string | null;
};

function Stars({ count }: { count: number }) {
  const safe = Math.max(0, Math.min(10, count));
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {Array.from({ length: safe }).map((_, i) => (
        <span key={i} aria-label="star">⭐</span>
      ))}
      {safe === 0 ? <span style={{ opacity: 0.6 }}>No master stars</span> : null}
    </div>
  );
}

export function StudentRosterCard({
  student,
  onAddPoint,
  onRemovePoint,
  allowPoints = true,
}: {
  student: StudentRoster;
  onAddPoint: (studentId: string) => void;
  onRemovePoint: (studentId: string) => void;
  allowPoints?: boolean;
}) {
  const masterStars = Math.min(10, student.medalCounts?.master ?? 0);

  return (
    <div
      style={{
        border: "1px solid rgba(0,0,0,0.12)",
        borderRadius: 12,
        padding: 14,
        display: "grid",
        gap: 10,
        boxShadow: "0 6px 18px rgba(2,6,23,0.06)",
        borderLeft: `6px solid ${student.points > 0 ? "#06b6d4" : "#9ca3af"}`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>
            {student.firstName} {student.lastName}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
            <div style={{ opacity: 0.75, fontSize: 13 }}>Points: {student.points ?? 0}</div>
            <div style={{ padding: "4px 8px", borderRadius: 999, background: "rgba(6,182,212,0.10)", color: "#06b6d4", fontWeight: 800, fontSize: 12 }}>
              Total
            </div>
          </div>
        </div>

        {allowPoints ? (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => onRemovePoint(student.id)} style={{ padding: "6px 10px" }}>
              −
            </button>
            <button onClick={() => onAddPoint(student.id)} style={{ padding: "6px 10px" }}>
              +
            </button>
          </div>
        ) : (
          <div style={{ opacity: 0.6, fontSize: 12, fontWeight: 700 }}>Display only</div>
        )}
      </div>

      <div>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Master Stars</div>
        <Stars count={masterStars} />
        <div style={{ opacity: 0.6, fontSize: 12, marginTop: 6 }}>
          masterStars = min(10, medalCounts.master)
        </div>
      </div>
    </div>
  );
}

"use client";

import MyMetricsPage from "@/app/my-metrics/page";

export default function StudentLogsPage() {
  return (
    <div className="student-route-shell">
      <style>{`
        .student-route-shell {
          padding-left: 180px;
          min-height: 100vh;
        }
        @media (max-width: 1100px) {
          .student-route-shell {
            padding-left: 0;
            padding-bottom: 92px;
          }
        }
      `}</style>
      <MyMetricsPage />
    </div>
  );
}

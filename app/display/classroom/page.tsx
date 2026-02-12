import { Suspense } from "react";
import DisplayClassroomClient from "./DisplayClassroomClient";

export default function ClassroomDisplayPage() {
  return (
    <Suspense fallback={null}>
      <DisplayClassroomClient />
    </Suspense>
  );
}

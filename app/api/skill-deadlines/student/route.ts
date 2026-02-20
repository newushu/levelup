import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { fetchSkillCountdownSnapshot, processSkillCountdownPenalties } from "@/lib/skillCountdown";

export async function GET(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  const url = new URL(req.url);
  const studentId = String(url.searchParams.get("student_id") ?? "").trim();
  if (!studentId) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });

  const processed = await processSkillCountdownPenalties(studentId, auth.user.id);
  if (!processed.ok) return NextResponse.json({ ok: false, error: processed.error }, { status: 500 });

  const snapshot = await fetchSkillCountdownSnapshot(studentId);
  if (!snapshot.ok) return NextResponse.json({ ok: false, error: snapshot.error }, { status: 500 });

  return NextResponse.json({
    ok: true,
    rows: snapshot.rows,
    summary: snapshot.summary,
    penalties_applied: processed.penalties_applied,
  });
}

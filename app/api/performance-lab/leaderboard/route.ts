import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const gate = await requireUser();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const statId = String(searchParams.get("stat_id") ?? "").trim();
  const limit = Math.max(3, Math.min(20, Number(searchParams.get("limit") ?? 10)));
  if (!statId) return NextResponse.json({ ok: false, error: "Missing stat_id" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: stat, error: statErr } = await admin
    .from("stats")
    .select("id,name,unit,higher_is_better,minimum_value_for_ranking")
    .eq("id", statId)
    .single();
  if (statErr) return NextResponse.json({ ok: false, error: statErr.message }, { status: 500 });

  const { data, error } = await admin
    .from("student_stats")
    .select("student_id,value,recorded_at,students(id,name)")
    .eq("stat_id", statId)
    .order("recorded_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const higherIsBetter = !!(stat as any)?.higher_is_better;
  const bestByStudent = new Map<string, { student_id: string; student_name: string; value: number; recorded_at: string }>();
  for (const row of data ?? []) {
    const studentId = String((row as any)?.student_id ?? "");
    if (!studentId) continue;
    const value = Number((row as any)?.value ?? 0);
    const recordedAt = String((row as any)?.recorded_at ?? "");
    const existing = bestByStudent.get(studentId);
    if (!existing) {
      bestByStudent.set(studentId, {
        student_id: studentId,
        student_name: String((row as any)?.students?.name ?? "Student"),
        value,
        recorded_at: recordedAt,
      });
      continue;
    }
    const isBetter = higherIsBetter ? value > existing.value : value < existing.value;
    const isTie = value === existing.value;
    if (isBetter || (isTie && recordedAt > existing.recorded_at)) {
      bestByStudent.set(studentId, {
        student_id: studentId,
        student_name: String((row as any)?.students?.name ?? "Student"),
        value,
        recorded_at: recordedAt,
      });
    }
  }

  const rows = Array.from(bestByStudent.values());
  rows.sort((a, b) => {
    if (a.value === b.value) return String(b.recorded_at).localeCompare(String(a.recorded_at));
    return higherIsBetter ? b.value - a.value : a.value - b.value;
  });

  const minValue = Math.max(0, Number((stat as any)?.minimum_value_for_ranking ?? 0) || 0);
  const positiveRows = rows.filter((row) => Number(row.value ?? 0) > 0 && Number(row.value ?? 0) >= minValue);
  const leaderboard: Array<{ rank: number; student_id: string; student_name: string; value: number; recorded_at: string }> = [];
  let prevValue: number | null = null;
  let prevRank = 0;
  for (let i = 0; i < positiveRows.length; i += 1) {
    const row = positiveRows[i];
    const rank = prevValue !== null && row.value === prevValue ? prevRank : i + 1;
    prevValue = row.value;
    prevRank = rank;
    if (rank > limit) break;
    leaderboard.push({ rank, ...row });
  }

  return NextResponse.json({
    ok: true,
    leaderboard: {
      stat_id: statId,
      stat_name: (stat as any)?.name ?? "Stat",
      unit: (stat as any)?.unit ?? null,
      higher_is_better: higherIsBetter,
      rows: leaderboard,
    },
  });
}

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  if (!student_id) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });

  const admin = supabaseAdmin();
  const [{ data, error }, { data: statMeta, error: metaErr }] = await Promise.all([
    admin
      .from("student_stats")
      .select("student_id,stat_id,value,recorded_at")
      .order("recorded_at", { ascending: false }),
    admin
      .from("stats")
      .select("id,higher_is_better,minimum_value_for_ranking")
      .eq("enabled", true),
  ]);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (metaErr) return NextResponse.json({ ok: false, error: metaErr.message }, { status: 500 });

  const higherByStat = new Map<string, boolean>();
  const minByStat = new Map<string, number>();
  (statMeta ?? []).forEach((row: any) => {
    higherByStat.set(String(row.id), row.higher_is_better !== false);
    minByStat.set(String(row.id), Math.max(0, Number(row.minimum_value_for_ranking ?? 0) || 0));
  });

  const latestByStudentStat = new Map<string, { student_id: string; stat_id: string; value: number; recorded_at: string }>();
  (data ?? []).forEach((row: any) => {
    const sid = String(row.student_id ?? "");
    const statId = String(row.stat_id ?? "");
    if (!sid || !statId) return;
    const key = `${sid}::${statId}`;
    if (!latestByStudentStat.has(key)) {
      latestByStudentStat.set(key, {
        student_id: sid,
        stat_id: statId,
        value: Number(row.value ?? 0),
        recorded_at: String(row.recorded_at ?? ""),
      });
    }
  });

  const byStat = new Map<string, Array<{ student_id: string; value: number }>>();
  latestByStudentStat.forEach((row) => {
    const minValue = minByStat.get(row.stat_id) ?? 0;
    if (Number(row.value ?? 0) <= 0 || Number(row.value ?? 0) < minValue) return;
    if (!byStat.has(row.stat_id)) byStat.set(row.stat_id, []);
    byStat.get(row.stat_id)!.push({ student_id: row.student_id, value: row.value });
  });

  const ranks: Record<string, { rank: number | null; total: number; value: number | null }> = {};
  byStat.forEach((rows, statId) => {
    const higherIsBetter = higherByStat.get(statId) !== false;
    const sorted = [...rows].sort((a, b) => (higherIsBetter ? b.value - a.value : a.value - b.value));
    const total = sorted.length;
    let rank: number | null = null;
    let value: number | null = null;
    sorted.forEach((row, idx) => {
      if (row.student_id === student_id && value === null) {
        rank = idx + 1;
        value = row.value;
      }
    });
    ranks[statId] = { rank, total, value };
  });

  return NextResponse.json({ ok: true, ranks });
}

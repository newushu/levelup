import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServer();
    const admin = supabaseAdmin();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const skill_id = String(body?.skill_id ?? "").trim();
    const student_ids = Array.isArray(body?.student_ids) ? body.student_ids.map((id: any) => String(id ?? "").trim()) : [];
    const cleanIds = Array.from(new Set(student_ids.filter(Boolean)));

    if (!skill_id) return NextResponse.json({ ok: false, error: "Missing skill_id" }, { status: 400 });
    if (!cleanIds.length) return NextResponse.json({ ok: true, stats: [] });

    const { data: trackers, error: tErr } = await admin
      .from("skill_trackers")
      .select("id,student_id")
      .eq("skill_id", skill_id)
      .in("student_id", cleanIds);
    if (tErr) return NextResponse.json({ ok: false, error: tErr.message }, { status: 500 });

    const trackerRows = (trackers ?? []) as Array<{ id: string; student_id: string }>;
    const trackerIds = trackerRows.map((t) => t.id);
    const trackerToStudent = new Map(trackerRows.map((t) => [String(t.id), String(t.student_id)]));

    const { data: logs, error: lErr } = await admin
      .from("skill_tracker_logs")
      .select("tracker_id,success,created_at")
      .in("tracker_id", trackerIds.length ? trackerIds : [""])
      .order("created_at", { ascending: false });
    if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });

    const stats = new Map<string, { student_id: string; successes: number; attempts: number; last_at?: string | null }>();
    (logs ?? []).forEach((row: any) => {
      const trackerId = String(row?.tracker_id ?? "");
      const studentId = trackerToStudent.get(trackerId);
      if (!studentId) return;
      const prev = stats.get(studentId) ?? { student_id: studentId, successes: 0, attempts: 0, last_at: null };
      const createdAt = String(row?.created_at ?? "");
      const createdMs = createdAt ? Date.parse(createdAt) : 0;
      const prevMs = prev.last_at ? Date.parse(prev.last_at) : 0;
      stats.set(studentId, {
        student_id: studentId,
        successes: prev.successes + (row?.success ? 1 : 0),
        attempts: prev.attempts + 1,
        last_at: createdMs >= prevMs ? createdAt : prev.last_at,
      });
    });

    const { data: battles, error: bErr } = await admin
      .from("battle_trackers")
      .select("id")
      .eq("skill_id", skill_id);
    if (bErr) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 });

    const battleIds = (battles ?? []).map((b: any) => String(b.id)).filter(Boolean);
    if (battleIds.length) {
      const { data: battleLogs, error: blErr } = await admin
        .from("battle_tracker_logs")
        .select("battle_id,student_id,success,created_at")
        .in("battle_id", battleIds)
        .in("student_id", cleanIds)
        .order("created_at", { ascending: false });
      if (blErr) return NextResponse.json({ ok: false, error: blErr.message }, { status: 500 });

      (battleLogs ?? []).forEach((row: any) => {
        const studentId = String(row?.student_id ?? "");
        if (!studentId) return;
        const prev = stats.get(studentId) ?? { student_id: studentId, successes: 0, attempts: 0, last_at: null };
        const createdAt = String(row?.created_at ?? "");
        const createdMs = createdAt ? Date.parse(createdAt) : 0;
        const prevMs = prev.last_at ? Date.parse(prev.last_at) : 0;
        stats.set(studentId, {
          student_id: studentId,
          successes: prev.successes + (row?.success ? 1 : 0),
          attempts: prev.attempts + 1,
          last_at: createdMs >= prevMs ? createdAt : prev.last_at,
        });
      });
    }

    return NextResponse.json({ ok: true, stats: Array.from(stats.values()) });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Failed to load skill stats" }, { status: 500 });
  }
}

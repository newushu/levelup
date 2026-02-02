import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const today = new Date().toISOString().slice(0, 10);
  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");
  const date = dateParam || today;

  const { data: sessions, error: sErr } = await supabase
    .from("class_sessions")
    .select("id,class_id,instance_id,session_date")
    .eq("session_date", date);
  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });

  const sessionClassMap = new Map<string, string>();
  const sessionInstanceMap = new Map<string, string | null>();
  (sessions ?? []).forEach((s: any) => {
    const id = String(s.id);
    sessionClassMap.set(id, String(s.class_id));
    sessionInstanceMap.set(id, s.instance_id ? String(s.instance_id) : null);
  });

  const instancesByClass = new Map<string, Array<{ id: string; startMinutes: number }>>();
  const instanceClassMap = new Map<string, string>();
  const { data: instances } = await supabase
    .from("class_schedule_instances")
    .select("id,class_id,schedule_entry_id,session_date,start_time,is_cancelled")
    .eq("session_date", date);
  (instances ?? [])
    .filter((row: any) => !row.is_cancelled)
    .forEach((row: any) => {
      const startParts = String(row.start_time ?? "00:00:00").split(":").map((n) => Number(n));
      const startMinutes = (startParts[0] ?? 0) * 60 + (startParts[1] ?? 0);
      instanceClassMap.set(String(row.id), String(row.class_id));
      const list = instancesByClass.get(String(row.class_id)) ?? [];
      list.push({ id: String(row.id), startMinutes });
      instancesByClass.set(String(row.class_id), list);
    });
  instancesByClass.forEach((list) => list.sort((a, b) => a.startMinutes - b.startMinutes));

  const instanceIds = Array.from(instanceClassMap.keys());
  const sessionIds = Array.from(sessionInstanceMap.keys());
  const checkinsById = new Map<string, any>();
  if (instanceIds.length) {
    const { data: byInstance, error: iErr } = await supabase
      .from("attendance_checkins")
      .select("id,instance_id,session_id,class_id,student_id,checked_in_at")
      .in("instance_id", instanceIds);
    if (iErr) return NextResponse.json({ ok: false, error: iErr.message }, { status: 500 });
    (byInstance ?? []).forEach((row: any) => checkinsById.set(String(row.id), row));
  }
  if (sessionIds.length) {
    const { data: bySession, error: sErr } = await supabase
      .from("attendance_checkins")
      .select("id,instance_id,session_id,class_id,student_id,checked_in_at")
      .in("session_id", sessionIds);
    if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });
    (bySession ?? []).forEach((row: any) => checkinsById.set(String(row.id), row));
  }
  const checkins = Array.from(checkinsById.values());

  const classStudents = new Map<string, Set<string>>();
  const instanceStudents = new Map<string, Set<string>>();
  const addStudent = (map: Map<string, Set<string>>, key: string, studentKey: string) => {
    const set = map.get(key) ?? new Set<string>();
    set.add(studentKey);
    map.set(key, set);
  };

  (checkins ?? []).forEach((r: any) => {
    const sessionId = String(r.session_id ?? "");
    const instanceId = String(r.instance_id ?? "");
    let classId = String(r.class_id ?? "");
    const studentId = String(r.student_id ?? "").trim();
    const studentKey = studentId || `checkin:${String(r.id ?? "")}`.trim();
    if (!studentKey) return;
    if (!classId && sessionId && sessionClassMap.has(sessionId)) {
      classId = String(sessionClassMap.get(sessionId) ?? "");
    }
    if (!classId && instanceId && instanceClassMap.has(instanceId)) {
      classId = String(instanceClassMap.get(instanceId) ?? "");
    }
    if (classId) addStudent(classStudents, classId, studentKey);

    if (instanceId) {
      addStudent(instanceStudents, instanceId, studentKey);
      return;
    }
    if (sessionId && sessionClassMap.has(sessionId)) {
      const resolved = sessionInstanceMap.get(sessionId);
      if (resolved) {
        addStudent(instanceStudents, resolved, studentKey);
        if (!classId && instanceClassMap.has(resolved)) {
          addStudent(classStudents, String(instanceClassMap.get(resolved)), studentKey);
        }
        return;
      }
    }
    const list = instancesByClass.get(classId);
    if (!list?.length) return;
    const dt = new Date(String(r.checked_in_at));
    const minutes = dt.getHours() * 60 + dt.getMinutes();
    let best = list[0];
    let bestDiff = Math.abs(minutes - best.startMinutes);
    for (let i = 1; i < list.length; i += 1) {
      const diff = Math.abs(minutes - list[i].startMinutes);
      if (diff < bestDiff) {
        best = list[i];
        bestDiff = diff;
      }
    }
    addStudent(instanceStudents, best.id, studentKey);
  });

  const counts: Record<string, number> = {};
  classStudents.forEach((set, key) => {
    counts[key] = set.size;
  });
  const countsByInstance: Record<string, number> = {};
  instanceStudents.forEach((set, key) => {
    countsByInstance[key] = set.size;
  });

  return NextResponse.json({ ok: true, counts, counts_by_instance: countsByInstance });
}

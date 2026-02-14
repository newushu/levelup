import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

function shortName(fullName: string) {
  const clean = String(fullName ?? "").trim();
  if (!clean) return "Student";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function asTimeKey(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const parts = raw.split(":");
  if (parts.length < 2) return raw;
  return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });
  const isMissingColumn = (err: any, column: string) => {
    const msg = String(err?.message || "").toLowerCase();
    const key = column.toLowerCase();
    return (
      msg.includes(`column "${key}"`) ||
      msg.includes(`.${key}`) ||
      msg.includes(key)
    );
  };

  const body = await req.json().catch(() => ({}));
  const class_id = String(body?.class_id ?? "").trim();
  const start_time = asTimeKey(String(body?.start_time ?? "").trim());
  const selected_date = String(body?.selected_date ?? "").trim();

  if (!class_id || !start_time || !selected_date) {
    return NextResponse.json({ ok: false, error: "Missing class_id/start_time/selected_date" }, { status: 400 });
  }

  const { data: roles, error: roleErr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id);
  if (roleErr) return NextResponse.json({ ok: false, error: roleErr.message }, { status: 500 });
  const roleList = (roles ?? []).map((r) => String(r.role ?? "").toLowerCase());
  if (!roleList.some((r) => ["admin", "coach", "classroom"].includes(r))) {
    return NextResponse.json({ ok: false, error: "Not allowed" }, { status: 403 });
  }

  const targetDate = new Date(`${selected_date}T00:00:00`);
  if (Number.isNaN(targetDate.getTime())) {
    return NextResponse.json({ ok: false, error: "Invalid selected_date" }, { status: 400 });
  }
  const since = new Date(targetDate);
  since.setDate(since.getDate() - 90);
  const sinceKey = since.toISOString().slice(0, 10);
  const dayOfWeek = targetDate.getDay();

  const { data: instances, error: iErr } = await supabase
    .from("class_schedule_instances")
    .select("id,session_date,start_time,class_id")
    .eq("class_id", class_id)
    .gte("session_date", sinceKey)
    .lte("session_date", selected_date);
  if (iErr) return NextResponse.json({ ok: false, error: iErr.message }, { status: 500 });

  const matchedInstanceIds = (instances ?? [])
    .filter((row: any) => {
      const dateKey = String(row?.session_date ?? "").trim();
      const rowTime = asTimeKey(String(row?.start_time ?? ""));
      if (!dateKey || !rowTime) return false;
      const d = new Date(`${dateKey}T00:00:00`);
      if (Number.isNaN(d.getTime())) return false;
      return d.getDay() === dayOfWeek && rowTime === start_time;
    })
    .map((row: any) => String(row?.id ?? "").trim())
    .filter(Boolean);

  if (!matchedInstanceIds.length) {
    return NextResponse.json({ ok: true, suggestions: [] });
  }

  const { data: checkins, error: cErr } = await supabase
    .from("attendance_checkins")
    .select("student_id,instance_id")
    .in("instance_id", matchedInstanceIds);
  if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });

  const counts = new Map<string, number>();
  (checkins ?? []).forEach((row: any) => {
    const sid = String(row?.student_id ?? "").trim();
    if (!sid) return;
    counts.set(sid, (counts.get(sid) ?? 0) + 1);
  });
  const eligibleIds = Array.from(counts.entries())
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  if (!eligibleIds.length) {
    return NextResponse.json({ ok: true, suggestions: [] });
  }

  const primaryStudents = await supabase
    .from("students")
    .select("id,name,level,points_total,lifetime_points,avatar_storage_path")
    .in("id", eligibleIds);
  let students = (primaryStudents.data ?? []) as any[];
  let sErr = primaryStudents.error;
  if (sErr && isMissingColumn(sErr, "lifetime_points")) {
    const fallback = await supabase
      .from("students")
      .select("id,name,level,points_total,avatar_storage_path")
      .in("id", eligibleIds);
    students = (fallback.data ?? []) as any[];
    sErr = fallback.error;
  }
  if (sErr && isMissingColumn(sErr, "avatar_storage_path")) {
    const fallback = await supabase
      .from("students")
      .select("id,name,level,points_total,lifetime_points")
      .in("id", eligibleIds);
    students = (fallback.data ?? []) as any[];
    sErr = fallback.error;
  }
  if (sErr && isMissingColumn(sErr, "lifetime_points")) {
    const fallback = await supabase
      .from("students")
      .select("id,name,level,points_total")
      .in("id", eligibleIds);
    students = (fallback.data ?? []) as any[];
    sErr = fallback.error;
  }
  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });

  const { data: levelRows, error: levelErr } = await supabase
    .from("avatar_level_thresholds")
    .select("level,min_lifetime_points")
    .order("level", { ascending: true });
  const thresholds = (levelErr ? [] : (levelRows ?? []))
    .map((row: any) => ({ level: Number(row.level), min: Number(row.min_lifetime_points ?? 0) }))
    .filter((row: any) => Number.isFinite(row.level))
    .sort((a: any, b: any) => a.level - b.level);

  const byId = new Map((students ?? []).map((s: any) => [String(s.id), s]));
  const suggestions = eligibleIds
    .map((id) => {
      const s: any = byId.get(id);
      if (!s) return null;
      let computedLevel = Number(s.level ?? 1);
      if (thresholds.length) {
        const points = Number(s.lifetime_points ?? 0);
        thresholds.forEach((lvl: any) => {
          if (points >= lvl.min) computedLevel = lvl.level;
        });
      }
      return {
        id: String(s.id),
        name: String(s.name ?? ""),
        short_name: shortName(String(s.name ?? "")),
        level: computedLevel,
        points_total: Number(s.points_total ?? 0),
        avatar_storage_path: s.avatar_storage_path ?? null,
        visits: counts.get(id) ?? 0,
      };
    })
    .filter(Boolean);

  return NextResponse.json({ ok: true, suggestions });
}

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseServer } from "@/lib/supabase/server";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  const supabase = await supabaseServer();
  const body = await req.json().catch(() => ({}));
  const class_id = String(body?.class_id ?? "").trim();
  const day = String(body?.award_date ?? "").trim() || todayISO();

  if (!class_id) return NextResponse.json({ ok: false, error: "Missing class_id" }, { status: 400 });

  const { data: active, error: aErr } = await supabase
    .from("class_sessions")
    .select("id,ended_at,started_at")
    .eq("class_id", class_id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (aErr) return NextResponse.json({ ok: false, error: aErr.message }, { status: 500 });
  if (!active?.id) return NextResponse.json({ ok: true, awards: [] });

  const { data, error } = await supabase
    .from("class_awards")
    .select("id,award_type_id,student_id,points_awarded,award_date,students(name)")
    .eq("session_id", active.id)
    .eq("award_date", day);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const awards = (data ?? []).map((row: any) => ({
    id: row.id,
    award_type_id: row.award_type_id,
    student_id: row.student_id,
    student_name: row.students?.name ?? "",
    points_awarded: row.points_awarded,
    award_date: row.award_date,
  }));

  return NextResponse.json({ ok: true, awards });
}

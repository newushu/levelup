import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const { class_id, student_id } = await req.json();
  if (!class_id || !student_id) return NextResponse.json({ ok: false, error: "Missing class_id/student_id" }, { status: 400 });

  // Prevent duplicates: if already checked-in, do nothing
  const { data: existing, error: exErr } = await supabase
    .from("checkins")
    .select("id")
    .eq("class_id", class_id)
    .eq("student_id", student_id)
    .maybeSingle();

  if (exErr) return NextResponse.json({ ok: false, error: exErr.message }, { status: 500 });
  if (existing?.id) return NextResponse.json({ ok: true, added: false, reason: "Already in roster" });

  const { data, error } = await supabase
    .from("checkins")
    .insert({ class_id, student_id })
    .select("id")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, added: true, checkin_id: data.id });
}

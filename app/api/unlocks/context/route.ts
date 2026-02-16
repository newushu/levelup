import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  if (!student_id) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });

  const admin = supabaseAdmin();
  const [customUnlocksRes, defsRes, reqRes, studentCriteriaRes] = await Promise.all([
    admin.from("student_custom_unlocks").select("item_type,item_key").eq("student_id", student_id),
    admin.from("unlock_criteria_definitions").select("key,label,description,enabled"),
    admin.from("unlock_criteria_item_requirements").select("item_type,item_key,criteria_key"),
    admin.from("student_unlock_criteria").select("criteria_key,fulfilled,note,fulfilled_at").eq("student_id", student_id),
  ]);

  if (customUnlocksRes.error) return NextResponse.json({ ok: false, error: customUnlocksRes.error.message }, { status: 500 });
  if (defsRes.error) return NextResponse.json({ ok: false, error: defsRes.error.message }, { status: 500 });
  if (reqRes.error) return NextResponse.json({ ok: false, error: reqRes.error.message }, { status: 500 });
  if (studentCriteriaRes.error) return NextResponse.json({ ok: false, error: studentCriteriaRes.error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    custom_unlocks: customUnlocksRes.data ?? [],
    criteria_definitions: defsRes.data ?? [],
    item_requirements: reqRes.data ?? [],
    student_criteria: studentCriteriaRes.data ?? [],
  });
}

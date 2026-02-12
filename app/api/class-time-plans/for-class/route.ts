import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    return NextResponse.json({ ok: false, error: userErr?.message || "Not logged in" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const classId = String(searchParams.get("class_id") ?? "").trim();
  if (!classId) return NextResponse.json({ ok: false, error: "class_id required" }, { status: 400 });

  const { data: roles, error: rErr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);
  if (rErr) return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 });
  const roleList = (roles ?? []).map((r: any) => String(r.role ?? "").toLowerCase()).filter(Boolean);
  const allowed = roleList.includes("admin") || roleList.includes("coach") || roleList.includes("display");
  if (!allowed) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const { data: assignment, error: aErr } = await supabase
    .from("class_time_plan_assignments")
    .select("plan_id")
    .eq("class_id", classId)
    .maybeSingle();
  if (aErr) return NextResponse.json({ ok: false, error: aErr.message }, { status: 500 });
  if (!assignment?.plan_id) return NextResponse.json({ ok: true, plan: null, sections: [] });

  const { data: plan, error: pErr } = await supabase
    .from("class_time_plans")
    .select("id,name,description")
    .eq("id", assignment.plan_id)
    .maybeSingle();
  if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });

  const { data: sections, error: sErr } = await supabase
    .from("class_time_plan_sections")
    .select("id,plan_id,label,duration_minutes,color,sort_order")
    .eq("plan_id", assignment.plan_id)
    .order("sort_order", { ascending: true });
  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, plan, sections: sections ?? [] });
}

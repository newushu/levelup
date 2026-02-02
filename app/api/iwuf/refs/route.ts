import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const admin = supabaseAdmin();
  const [formsRes, groupsRes, codesRes, windowsRes] = await Promise.all([
    admin
      .from("iwuf_taolu_forms")
      .select("id,name,age_group_id,sections_count,video_links,is_active"),
    admin
      .from("iwuf_age_groups")
      .select("id,name,min_age,max_age")
      .order("min_age", { ascending: true }),
    admin
      .from("iwuf_codes")
      .select("id,event_type,code_number,name,description,deduction_amount"),
    admin
      .from("iwuf_report_windows")
      .select("id,label,days,sort_order,is_active")
      .order("sort_order", { ascending: true })
      .order("days", { ascending: true }),
  ]);

  if (formsRes.error) return NextResponse.json({ ok: false, error: formsRes.error.message }, { status: 500 });
  if (groupsRes.error) return NextResponse.json({ ok: false, error: groupsRes.error.message }, { status: 500 });
  if (codesRes.error) return NextResponse.json({ ok: false, error: codesRes.error.message }, { status: 500 });
  if (windowsRes.error) return NextResponse.json({ ok: false, error: windowsRes.error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    forms: formsRes.data ?? [],
    age_groups: groupsRes.data ?? [],
    codes: codesRes.data ?? [],
    report_windows: windowsRes.data ?? [],
  });
}

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const { data: roles, error: rErr } = await supabase
    .from("user_roles")
    .select("role,student_id")
    .eq("user_id", u.user.id);
  if (rErr) return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 });

  const leaderId = String(
    (roles ?? []).find((r) => String(r.role ?? "").toLowerCase() === "student")?.student_id ?? ""
  ).trim();
  if (!leaderId) return NextResponse.json({ ok: false, error: "Student account required" }, { status: 400 });

  const today = todayISO();
  const { data: leader } = await supabase
    .from("camp_leaders")
    .select("id")
    .eq("student_id", leaderId)
    .eq("enabled", true)
    .lte("start_date", today)
    .or(`end_date.is.null,end_date.gte.${today}`)
    .maybeSingle();
  if (!leader?.id) return NextResponse.json({ ok: false, error: "Not an active camp leader" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const helperIds = Array.isArray(body?.helper_ids) ? body.helper_ids : [];
  const cleanHelperIds = helperIds
    .map((id: any) => String(id ?? "").trim())
    .filter(Boolean)
    .slice(0, 5);
  if (!cleanHelperIds.length) return NextResponse.json({ ok: false, error: "No helpers selected" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: settings } = await supabase
    .from("camp_settings")
    .select("helper_points")
    .eq("id", "default")
    .maybeSingle();
  const helperPoints = Number(settings?.helper_points ?? 0);
  if (!helperPoints) return NextResponse.json({ ok: false, error: "Helper points not set" }, { status: 400 });

  const { data: existing } = await admin
    .from("camp_helper_entries")
    .select("helper_student_id")
    .in("helper_student_id", cleanHelperIds)
    .eq("entry_date", today);
  const existingIds = new Set((existing ?? []).map((row: any) => String(row.helper_student_id ?? "")));
  const newHelpers = cleanHelperIds.filter((id: string) => !existingIds.has(id));
  if (!newHelpers.length) return NextResponse.json({ ok: true, awarded: 0, helpers: [] });

  const entries = newHelpers.map((helperId: string) => ({
    leader_student_id: leaderId,
    helper_student_id: helperId,
    entry_date: today,
  }));
  const { error: eErr } = await admin
    .from("camp_helper_entries")
    .upsert(entries, { onConflict: "helper_student_id,entry_date", ignoreDuplicates: true });
  if (eErr) return NextResponse.json({ ok: false, error: eErr.message }, { status: 500 });

  const { data: accounts } = await admin
    .from("camp_accounts")
    .select("student_id,balance_points")
    .in("student_id", newHelpers);
  const balanceMap = new Map<string, number>();
  (accounts ?? []).forEach((row: any) => balanceMap.set(String(row.student_id), Number(row.balance_points ?? 0)));

  const updates = newHelpers.map((helperId: string) => ({
    student_id: helperId,
    balance_points: (balanceMap.get(helperId) ?? 0) + helperPoints,
    updated_at: new Date().toISOString(),
  }));
  const { error: uErr } = await admin.from("camp_accounts").upsert(updates, { onConflict: "student_id" });
  if (uErr) return NextResponse.json({ ok: false, error: uErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, awarded: newHelpers.length, helpers: newHelpers });
}

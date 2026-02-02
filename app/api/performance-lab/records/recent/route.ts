import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabase/server";

async function getUserScope() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { ok: false as const, error: "Not logged in" };

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role,student_id")
    .eq("user_id", u.user.id);

  if (error) return { ok: false as const, error: error.message };

  const roleList = (roles ?? []).map((r: any) => String(r.role ?? "").toLowerCase());
  const isAdmin = roleList.includes("admin");
  const isCoach = roleList.includes("coach");
  const studentId = String((roles ?? []).find((r: any) => String(r.role ?? "").toLowerCase() === "student")?.student_id ?? "");

  return { ok: true as const, isAdmin, isCoach, studentId };
}

export async function GET(req: Request) {
  const gate = await getUserScope();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const studentId = String(searchParams.get("student_id") ?? "").trim();
  const statIdsRaw = String(searchParams.get("stat_ids") ?? "").trim();
  const limit = Math.max(1, Math.min(5, Number(searchParams.get("limit") ?? 3)));

  if (!studentId) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });
  if (!statIdsRaw) return NextResponse.json({ ok: false, error: "Missing stat_ids" }, { status: 400 });
  if (!gate.isAdmin && !gate.isCoach && gate.studentId !== studentId) {
    return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 403 });
  }

  const statIds = statIdsRaw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (!statIds.length) return NextResponse.json({ ok: false, error: "Missing stat_ids" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("student_stats")
    .select("stat_id,value,recorded_at")
    .eq("student_id", studentId)
    .in("stat_id", statIds)
    .order("recorded_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const grouped: Record<string, any[]> = {};
  (data ?? []).forEach((row) => {
    const key = String(row.stat_id ?? "");
    if (!key) return;
    if (!grouped[key]) grouped[key] = [];
    if (grouped[key].length < limit) grouped[key].push(row);
  });

  return NextResponse.json({ ok: true, records: grouped });
}

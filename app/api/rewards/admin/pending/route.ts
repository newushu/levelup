import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";

async function requireAdmin() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { ok: false as const, error: "Not logged in" };

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id)
    .eq("role", "admin")
    .limit(1);

  if (error) return { ok: false as const, error: error.message };
  if (!roles || roles.length === 0) return { ok: false as const, error: "Admin access required" };

  return { ok: true as const, userId: u.user.id };
}

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const supabase = await supabaseServer();
  const { data: rows, error } = await supabase
    .from("reward_redemptions")
    .select("id,student_id,reward_id,cost,requested_at,hold_until,status,mode")
    .eq("status", "pending")
    .order("requested_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const studentIds = Array.from(new Set((rows ?? []).map((r: any) => String(r.student_id ?? "")))).filter(Boolean);
  const rewardIds = Array.from(new Set((rows ?? []).map((r: any) => String(r.reward_id ?? "")))).filter(Boolean);

  const [students, rewards] = await Promise.all([
    studentIds.length
      ? supabase.from("students").select("id,name").in("id", studentIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    rewardIds.length
      ? supabase.from("rewards").select("id,name,cost").in("id", rewardIds)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);

  if (students.error) return NextResponse.json({ ok: false, error: students.error.message }, { status: 500 });
  if (rewards.error) return NextResponse.json({ ok: false, error: rewards.error.message }, { status: 500 });

  const studentMap = new Map((students.data ?? []).map((s: any) => [String(s.id), s]));
  const rewardMap = new Map((rewards.data ?? []).map((r: any) => [String(r.id), r]));

  const pending = (rows ?? []).map((r: any) => ({
    id: r.id,
    student_id: r.student_id,
    student_name: studentMap.get(String(r.student_id))?.name ?? "Student",
    reward_id: r.reward_id,
    reward_name: rewardMap.get(String(r.reward_id))?.name ?? "Reward",
    cost: Number(r.cost ?? rewardMap.get(String(r.reward_id))?.cost ?? 0),
    requested_at: r.requested_at,
    hold_until: r.hold_until,
    status: r.status,
    mode: r.mode,
  }));

  return NextResponse.json({ ok: true, pending });
}

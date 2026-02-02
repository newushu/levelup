import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: parent, error: pErr } = await admin
    .from("parents")
    .select("id")
    .eq("auth_user_id", gate.user.id)
    .maybeSingle();
  if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });
  if (!parent?.id) return NextResponse.json({ ok: false, error: "Not a parent account" }, { status: 403 });

  const { data: links, error: lErr } = await admin
    .from("parent_students")
    .select("student_id")
    .eq("parent_id", parent.id);
  if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });
  const studentIds = (links ?? []).map((row: any) => String(row.student_id ?? "")).filter(Boolean);
  if (!studentIds.length) return NextResponse.json({ ok: true, coupons: [] });

  const { data: rows, error } = await admin
    .from("reward_redemptions")
    .select("id,student_id,reward_id,approved_at,rewards(name,category,cost)")
    .in("student_id", studentIds)
    .eq("status", "approved")
    .order("approved_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const coupons =
    (rows ?? [])
      .filter((row: any) => String(row?.rewards?.category ?? "").toLowerCase() === "discount")
      .map((row: any) => ({
        id: row.id,
        student_id: row.student_id,
        reward_id: row.reward_id,
        name: row?.rewards?.name ?? "Discount",
        cost: Number(row?.rewards?.cost ?? 0),
        approved_at: row.approved_at,
      })) ?? [];

  return NextResponse.json({ ok: true, coupons });
}

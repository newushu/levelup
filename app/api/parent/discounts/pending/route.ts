import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveParentContext } from "../../_parentContext";

export async function GET(req: Request) {
  const ctx = await resolveParentContext(req);
  if (!ctx.ok) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status });
  const parent = ctx.parent;

  const admin = supabaseAdmin();
  const { data: links, error: lErr } = await admin
    .from("parent_students")
    .select("student_id")
    .eq("parent_id", parent.id);
  if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });
  const studentIds = (links ?? []).map((row: any) => String(row.student_id ?? "")).filter(Boolean);
  if (!studentIds.length) return NextResponse.json({ ok: true, pending: [] });

  const { data: rows, error } = await admin
    .from("reward_redemptions")
    .select("id,student_id,reward_id,requested_at,rewards(name,category)")
    .in("student_id", studentIds)
    .eq("status", "pending")
    .order("requested_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const pending =
    (rows ?? [])
      .filter((row: any) => String(row?.rewards?.category ?? "").toLowerCase() === "discount")
      .map((row: any) => ({
        id: row.id,
        student_id: row.student_id,
        reward_id: row.reward_id,
        name: row?.rewards?.name ?? "Discount",
        requested_at: row.requested_at,
      })) ?? [];

  return NextResponse.json({ ok: true, pending });
}

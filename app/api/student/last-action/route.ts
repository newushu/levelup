import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const gate = await requireUser();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const url = new URL(req.url);
  const studentId = String(url.searchParams.get("student_id") ?? "").trim();
  if (!studentId) return NextResponse.json({ ok: false, error: "student_id required" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("ledger")
    .select("id,points,points_base,points_multiplier,note,category,created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, last_action: data ?? null });
}

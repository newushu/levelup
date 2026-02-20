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
    .from("gift_open_events")
    .select(`
      id,
      student_id,
      student_gift_id,
      gift_item_id,
      points_awarded,
      points_before_open,
      points_after_open,
      opened_at,
      gift_items(name,category,category_tags,gift_type,design_image_url,gift_designs(preview_image_url))
    `)
    .eq("student_id", studentId)
    .order("opened_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, logs: data ?? [] });
}

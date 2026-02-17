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
    .from("student_gifts")
    .select(`
      id,
      student_id,
      gift_item_id,
      qty,
      opened_qty,
      created_at,
      enabled,
      gift_items(
        id,
        name,
        category,
        category_tags,
        gift_type,
        design_id,
        design_image_url,
        design_html,
        design_css,
        design_js,
        points_value,
        enabled,
        gift_designs(id,name,preview_image_url,html,css,js)
      )
    `)
    .eq("student_id", studentId)
    .eq("enabled", true)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, gifts: data ?? [] });
}

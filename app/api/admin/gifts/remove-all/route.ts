import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const giftItemId = String(body?.gift_item_id ?? "").trim();
  const confirmed = body?.confirm === true;
  if (!giftItemId) return NextResponse.json({ ok: false, error: "gift_item_id required" }, { status: 400 });
  if (!confirmed) return NextResponse.json({ ok: false, error: "confirm=true required" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("student_gifts")
    .update({ enabled: false, updated_at: new Date().toISOString() })
    .eq("gift_item_id", giftItemId)
    .eq("enabled", true)
    .select("id");

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, removed_count: (data ?? []).length });
}

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/authz";

const ALLOWED_KEYS = new Set(["coach_1", "coach_2", "coach_3", "coach_4"]);

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const slot_key = String(body?.slot_key ?? "").trim();
  const coach_user_id = body?.coach_user_id ? String(body.coach_user_id).trim() : null;

  if (!ALLOWED_KEYS.has(slot_key)) {
    return NextResponse.json({ ok: false, error: "Invalid slot key" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { error } = await admin
    .from("coach_display_slots")
    .upsert({ slot_key, coach_user_id, updated_at: new Date().toISOString() }, { onConflict: "slot_key" });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

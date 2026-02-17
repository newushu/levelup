import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const DEFAULT_EMOJI = "🎁";
function isMissingRelation(err: any) {
  const msg = String(err?.message ?? "").toLowerCase();
  return msg.includes("does not exist") || msg.includes("relation") || msg.includes("not found");
}

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("gift_feature_settings")
    .select("id,student_button_design_id,student_button_image_url,student_button_emoji,updated_at")
    .eq("id", "default")
    .maybeSingle();

  if (error && !isMissingRelation(error)) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (error && isMissingRelation(error)) {
    return NextResponse.json({
      ok: true,
      settings: {
        id: "default",
        student_button_design_id: null,
        student_button_image_url: null,
        student_button_emoji: DEFAULT_EMOJI,
      },
    });
  }
  return NextResponse.json({
    ok: true,
    settings: data ?? {
      id: "default",
      student_button_design_id: null,
      student_button_image_url: null,
      student_button_emoji: DEFAULT_EMOJI,
    },
  });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const payload = {
    id: "default",
    student_button_design_id: String(body?.student_button_design_id ?? "").trim() || null,
    student_button_image_url: String(body?.student_button_image_url ?? "").trim() || null,
    student_button_emoji: String(body?.student_button_emoji ?? "").trim() || DEFAULT_EMOJI,
    updated_at: new Date().toISOString(),
  };

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("gift_feature_settings")
    .upsert(payload, { onConflict: "id" })
    .select("id,student_button_design_id,student_button_image_url,student_button_emoji,updated_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, settings: data });
}

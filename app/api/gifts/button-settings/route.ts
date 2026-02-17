import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const DEFAULT_EMOJI = "🎁";
function isMissingRelation(err: any) {
  const msg = String(err?.message ?? "").toLowerCase();
  return msg.includes("does not exist") || msg.includes("relation") || msg.includes("not found");
}

export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: settings, error } = await admin
    .from("gift_feature_settings")
    .select("student_button_design_id,student_button_image_url,student_button_emoji")
    .eq("id", "default")
    .maybeSingle();
  if (error && !isMissingRelation(error)) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (error && isMissingRelation(error)) {
    return NextResponse.json({
      ok: true,
      settings: { image_url: null, emoji: DEFAULT_EMOJI, design_id: null },
    });
  }

  const designId = String(settings?.student_button_design_id ?? "").trim();
  let designImageUrl: string | null = null;
  if (designId) {
    const { data: design } = await admin
      .from("gift_designs")
      .select("preview_image_url")
      .eq("id", designId)
      .maybeSingle();
    designImageUrl = String(design?.preview_image_url ?? "").trim() || null;
  }

  return NextResponse.json({
    ok: true,
    settings: {
      image_url: String(settings?.student_button_image_url ?? "").trim() || designImageUrl || null,
      emoji: String(settings?.student_button_emoji ?? "").trim() || DEFAULT_EMOJI,
      design_id: designId || null,
    },
  });
}

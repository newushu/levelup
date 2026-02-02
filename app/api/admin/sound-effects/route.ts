import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function clampVolume(raw: any) {
  const n = Number(raw);
  if (Number.isNaN(n)) return 1;
  return Math.max(0, Math.min(1, n));
}

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("ui_sound_effects")
    .select("id,key,label,audio_url,category,volume,enabled,loop")
    .order("key", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, effects: data ?? [] });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  const key = String(body?.key ?? "").trim().toLowerCase();
  const label = String(body?.label ?? "").trim();
  const audio_url = String(body?.audio_url ?? "").trim();
  const category = String(body?.category ?? "").trim() || "effect";
  const volume = clampVolume(body?.volume);
  const enabled = body?.enabled !== false;
  const loop = body?.loop === true;

  if (!key) return NextResponse.json({ ok: false, error: "Key is required" }, { status: 400 });
  if (!label) return NextResponse.json({ ok: false, error: "Label is required" }, { status: 400 });

  const payload: any = {
    key,
    label,
    audio_url: audio_url || null,
    category,
    volume,
    enabled,
    loop,
  };

  const admin = supabaseAdmin();
  if (id) {
    const { data, error } = await admin
      .from("ui_sound_effects")
      .upsert({ id, ...payload }, { onConflict: "id" })
      .select("id,key,label,audio_url,category,volume,enabled,loop")
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, effect: data });
  }

  const { data, error } = await admin
    .from("ui_sound_effects")
    .upsert(payload, { onConflict: "key" })
    .select("id,key,label,audio_url,category,volume,enabled,loop")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, effect: data });
}

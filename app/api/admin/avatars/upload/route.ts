import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const AVATAR_BUCKET = process.env.NEXT_PUBLIC_AVATAR_BUCKET || "avatars";

function titleFromFileName(fileName: string) {
  const base = fileName.replace(/\.[^.]+$/, "");
  const cleaned = base.replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "Avatar";
  return cleaned
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : ""))
    .join(" ");
}

async function uploadOne(file: File) {
  const rawName = String(file.name || "avatar.png");
  const safeName = rawName.replace(/[^\w.\-]+/g, "_");
  const path = `custom/${Date.now()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const admin = supabaseAdmin();
  const { error } = await admin.storage.from(AVATAR_BUCKET).upload(path, buffer, {
    upsert: true,
    contentType: file.type || "image/png",
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, path, name: titleFromFileName(rawName) };
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ ok: false, error: "Missing form data" }, { status: 400 });

  const bulk = String(formData.get("bulk") ?? "").toLowerCase() === "1";
  const files = formData
    .getAll("files")
    .filter((value): value is File => value instanceof File && value.size > 0);
  const single = formData.get("file");
  if (single instanceof File && single.size > 0) files.push(single);
  if (!files.length) {
    return NextResponse.json({ ok: false, error: "Missing file upload(s)" }, { status: 400 });
  }
  const admin = supabaseAdmin();
  if (!bulk) {
    const uploaded = await uploadOne(files[0]);
    if (!uploaded.ok) return NextResponse.json({ ok: false, error: uploaded.error }, { status: 500 });
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const public_url = base ? `${base}/storage/v1/object/public/${AVATAR_BUCKET}/${uploaded.path}` : "";
    return NextResponse.json({ ok: true, path: uploaded.path, public_url });
  }

  const uploadedRows: Array<{ path: string; name: string }> = [];
  for (const file of files) {
    const uploaded = await uploadOne(file);
    if (!uploaded.ok) return NextResponse.json({ ok: false, error: uploaded.error }, { status: 500 });
    uploadedRows.push({ path: uploaded.path, name: uploaded.name });
  }

  const payload = uploadedRows.map((row) => ({
    id: crypto.randomUUID(),
    name: row.name,
    storage_path: row.path,
    enabled: false,
    is_secondary: false,
    unlock_level: 1,
    unlock_points: 0,
    rule_keeper_multiplier: 1,
    rule_breaker_multiplier: 1,
    skill_pulse_multiplier: 1,
    spotlight_multiplier: 1,
    daily_free_points: 0,
    challenge_completion_bonus_pct: 0,
    mvp_bonus_pct: 0,
    zoom_pct: 100,
    competition_only: false,
    competition_discount_pct: 0,
  }));
  const { data, error } = await admin
    .from("avatars")
    .insert(payload)
    .select(
      "id,name,storage_path,enabled,is_secondary,unlock_level,unlock_points,rule_keeper_multiplier,rule_breaker_multiplier,skill_pulse_multiplier,spotlight_multiplier,daily_free_points,challenge_completion_bonus_pct,mvp_bonus_pct,zoom_pct,competition_only,competition_discount_pct,created_at,updated_at"
    );
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, created: data ?? [] });
}

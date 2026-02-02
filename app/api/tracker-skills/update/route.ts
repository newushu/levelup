import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const skill_id = String(body?.skill_id ?? "").trim();
  const failure_reasons = Array.isArray(body?.failure_reasons) ? body.failure_reasons.map(String) : [];
  const enabled = typeof body?.enabled === "boolean" ? body.enabled : undefined;
  const base_name = body?.base_name !== undefined ? String(body?.base_name ?? "").trim() : undefined;
  const quality = body?.quality !== undefined ? String(body?.quality ?? "").trim() : undefined;
  const supplement = body?.supplement !== undefined ? String(body?.supplement ?? "").trim() : undefined;
  const landing = body?.landing !== undefined ? String(body?.landing ?? "").trim() : undefined;
  const rotation = body?.rotation !== undefined ? String(body?.rotation ?? "").trim() : undefined;
  const name = body?.name !== undefined ? String(body?.name ?? "").trim() : undefined;
  const category = body?.category !== undefined ? String(body?.category ?? "").trim() : undefined;

  if (!skill_id) return NextResponse.json({ ok: false, error: "Missing skill_id" }, { status: 400 });

  const clean = failure_reasons.map((r: string) => r.trim()).filter(Boolean);
  const payload: Record<string, any> = {};
  if (failure_reasons.length) payload.failure_reasons = clean;
  if (typeof enabled === "boolean") payload.enabled = enabled;
  if (base_name !== undefined) payload.base_name = base_name || null;
  if (quality !== undefined) payload.quality = quality || null;
  if (supplement !== undefined) payload.supplement = supplement || null;
  if (landing !== undefined) payload.landing = landing || null;
  if (rotation !== undefined) payload.rotation = rotation || null;
  if (name !== undefined) payload.name = name;
  if (category !== undefined) payload.category = category || null;

  const needsComboUpdate =
    base_name !== undefined ||
    quality !== undefined ||
    supplement !== undefined ||
    landing !== undefined ||
    rotation !== undefined ||
    name !== undefined;

  if (needsComboUpdate) {
    const { data: current, error: currentErr } = await supabase
      .from("tracker_skills")
      .select("id,name,base_name,quality,supplement,landing,rotation,created_at")
      .eq("id", skill_id)
      .single();
    if (currentErr) return NextResponse.json({ ok: false, error: currentErr.message }, { status: 500 });

    const nextBase = base_name !== undefined ? base_name : String(current?.base_name ?? "");
    const nextQuality = quality !== undefined ? quality : String(current?.quality ?? "");
    const nextSupplement = supplement !== undefined ? supplement : String(current?.supplement ?? "");
    const nextLanding = landing !== undefined ? landing : String(current?.landing ?? "");
    const nextRotation = rotation !== undefined ? rotation : String(current?.rotation ?? "");
    const nextHasElements = [nextQuality, nextSupplement, nextLanding, nextRotation].some((v) =>
      String(v ?? "").trim()
    );

    const cutoff = new Date("2026-01-17T23:59:59.999Z");
    const isLegacy = current?.created_at ? new Date(current.created_at) <= cutoff : false;
    if (!nextHasElements && !isLegacy) {
      return NextResponse.json({ ok: false, error: "New skills need at least one element" }, { status: 400 });
    }

    const baseForCombo = nextBase || (name !== undefined ? name : String(current?.name ?? ""));
    const comboKey = buildComboKey({
      base_name: baseForCombo,
      quality: nextQuality,
      supplement: nextSupplement,
      landing: nextLanding,
      rotation: nextRotation,
    });
    if (comboKey) {
      const { data: dupes, error: dErr } = await supabase
        .from("tracker_skills")
        .select("id")
        .eq("combo_key", comboKey)
        .neq("id", skill_id)
        .limit(1);
      if (dErr) return NextResponse.json({ ok: false, error: dErr.message }, { status: 500 });
      if ((dupes ?? []).length) {
        return NextResponse.json({ ok: false, error: "Skill combination already exists" }, { status: 400 });
      }
      payload.combo_key = comboKey;
      if (name === undefined || !name) {
        payload.name = buildDisplayName({
          base_name: baseForCombo,
          quality: nextQuality,
          supplement: nextSupplement,
          rotation: nextRotation,
          landing: nextLanding,
        });
      }
    }

    const { error: elementErr } = await ensureSkillNameElement(supabase, baseForCombo);
    if (elementErr) return NextResponse.json({ ok: false, error: elementErr.message }, { status: 500 });
  }

  if (!Object.keys(payload).length) {
    return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });
  }
  const { error } = await supabase
    .from("tracker_skills")
    .update(payload)
    .eq("id", skill_id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

async function ensureSkillNameElement(supabase: Awaited<ReturnType<typeof supabaseServer>>, label: string) {
  const clean = String(label ?? "").trim();
  if (!clean) return { error: null as Error | null };
  const { data, error } = await supabase
    .from("tracker_skill_elements")
    .select("id")
    .eq("element_type", "name")
    .ilike("label", clean)
    .limit(1);
  if (error) return { error };
  if ((data ?? []).length) return { error: null };
  const { error: insertErr } = await supabase
    .from("tracker_skill_elements")
    .insert({ element_type: "name", label: clean, enabled: true, sort_order: 0, is_skill_name: true });
  if (insertErr) return { error: insertErr };
  return { error: null };
}

function buildComboKey(parts: {
  base_name: string;
  quality: string;
  supplement: string;
  landing: string;
  rotation: string;
}) {
  const base = parts.base_name.trim();
  if (!base) return null;
  const keyParts = [base, parts.quality, parts.supplement, parts.rotation, parts.landing]
    .map((p) => String(p ?? "").trim().toLowerCase());
  return keyParts.join("|");
}

function buildDisplayName(parts: {
  base_name: string;
  quality: string;
  supplement: string;
  landing: string;
  rotation: string;
}) {
  const base = String(parts.base_name ?? "").trim();
  const rotation = String(parts.rotation ?? "").trim();
  const landing = String(parts.landing ?? "").trim();
  const extras = [parts.supplement, parts.quality].map((p) => String(p ?? "").trim()).filter(Boolean);
  if (!base) return "";
  const prefix = rotation ? `(${rotation}) ` : "";
  const suffix = landing ? ` (${landing})` : "";
  const bracketed = extras.length ? ` [${extras.join(", ")}]` : "";
  return `${prefix}${base}${suffix}${bracketed}`.trim();
}

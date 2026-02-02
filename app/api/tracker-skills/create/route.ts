import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const base_name = String(body?.base_name ?? "").trim();
  const quality = String(body?.quality ?? "").trim();
  const supplement = String(body?.supplement ?? "").trim();
  const landing = String(body?.landing ?? "").trim();
  const rotation = String(body?.rotation ?? "").trim();
  const manualName = String(body?.name ?? "").trim();
  const category = String(body?.category ?? "").trim();
  const baseLabel = base_name || manualName;
  const hasElements = [quality, supplement, landing, rotation].some((v) => String(v ?? "").trim());
  if (!baseLabel) {
    return NextResponse.json({ ok: false, error: "Missing skill name" }, { status: 400 });
  }
  if (!hasElements) {
    return NextResponse.json({ ok: false, error: "Select at least one element" }, { status: 400 });
  }

  const comboKey = buildComboKey({
    base_name: baseLabel,
    quality,
    supplement,
    landing,
    rotation,
  });
  if (comboKey) {
    const { data: dupes, error: dErr } = await supabase
      .from("tracker_skills")
      .select("id")
      .eq("combo_key", comboKey)
      .limit(1);
    if (dErr) return NextResponse.json({ ok: false, error: dErr.message }, { status: 500 });
    if ((dupes ?? []).length) {
      return NextResponse.json({ ok: false, error: "Skill combination already exists" }, { status: 400 });
    }
  }

  const { error: elementErr } = await ensureSkillNameElement(supabase, baseLabel);
  if (elementErr) {
    return NextResponse.json({ ok: false, error: elementErr.message }, { status: 500 });
  }

  const name = manualName || buildDisplayName({ base_name: baseLabel, quality, supplement, rotation, landing });

  const { data, error } = await supabase
    .from("tracker_skills")
    .insert({
      name,
      category: category || null,
      enabled: true,
      failure_reasons: [],
      base_name: baseLabel,
      quality: quality || null,
      supplement: supplement || null,
      landing: landing || null,
      rotation: rotation || null,
      combo_key: comboKey,
    })
    .select("id,name,category,enabled,failure_reasons,base_name,quality,supplement,landing,rotation,combo_key")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, skill: data });
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

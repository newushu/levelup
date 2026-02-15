import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function parseCombinedCode(raw: string) {
  const input = String(raw ?? "");
  if (!input.trim()) return { html: "", css: "", js: "" };

  let css = "";
  let js = "";
  let html = input;

  html = html.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_, body: string) => {
    css += `${body}\n`;
    return "";
  });
  html = html.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (_, body: string) => {
    js += `${body}\n`;
    return "";
  });

  // If user pasted a full HTML document, keep only body content for storage.
  html = html.replace(/<!doctype[^>]*>/gi, "");
  html = html.replace(/<head[\s\S]*?<\/head>/gi, "");
  html = html.replace(/<\/?html[^>]*>/gi, "");
  html = html.replace(/<\/?body[^>]*>/gi, "");

  return {
    html: html.trim(),
    css: css.trim(),
    js: js.trim(),
  };
}

async function isAdmin(userId: string) {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) return { ok: false as const, error: error.message };
  const roleList = (data ?? []).map((r: any) => String(r.role ?? "").toLowerCase());
  return { ok: roleList.includes("admin") };
}

export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });
  const allow = await isAdmin(gate.user.id);
  if (!allow.ok) return NextResponse.json({ ok: false, error: allow.error || "Admin only" }, { status: 403 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("class_emotes")
    .select("id,emote_key,label,emoji,image_url,html,css,js,scale,duration_ms,points_cost,unlock_level,enabled,is_default,created_at")
    .order("is_default", { ascending: false })
    .order("label", { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, emotes: data ?? [] });
}

export async function POST(req: Request) {
  const gate = await requireUser();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });
  const allow = await isAdmin(gate.user.id);
  if (!allow.ok) return NextResponse.json({ ok: false, error: allow.error || "Admin only" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  const combinedCode = String(body?.code_bundle ?? "").trim();
  const parsed = parseCombinedCode(combinedCode);
  const hasCombinedCode = combinedCode.length > 0;
  const payload = {
    emote_key: String(body?.emote_key ?? "").trim(),
    label: String(body?.label ?? "").trim(),
    emoji: String(body?.emoji ?? "✨").trim() || "✨",
    image_url: String(body?.image_url ?? "").trim() || null,
    html: hasCombinedCode ? parsed.html : String(body?.html ?? ""),
    css: hasCombinedCode ? parsed.css : String(body?.css ?? ""),
    js: hasCombinedCode ? parsed.js : String(body?.js ?? ""),
    scale: Math.max(0.2, Math.min(4, Number(body?.scale ?? 1) || 1)),
    duration_ms: Math.max(500, Math.min(20000, Number(body?.duration_ms ?? 3000) || 3000)),
    points_cost: Math.max(0, Number(body?.points_cost ?? 0)),
    unlock_level: Math.max(1, Number(body?.unlock_level ?? 1)),
    enabled: body?.enabled !== false,
    is_default: body?.is_default === true,
  };
  if (!payload.emote_key || !payload.label) {
    return NextResponse.json({ ok: false, error: "emote_key and label required" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const query = admin.from("class_emotes");
  const result = id
    ? await query.update(payload).eq("id", id).select("id,emote_key,label,emoji,image_url,html,css,js,scale,duration_ms,points_cost,unlock_level,enabled,is_default").single()
    : await query.insert(payload).select("id,emote_key,label,emoji,image_url,html,css,js,scale,duration_ms,points_cost,unlock_level,enabled,is_default").single();

  if (result.error) return NextResponse.json({ ok: false, error: result.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, emote: result.data });
}

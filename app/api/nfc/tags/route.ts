import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { hashAccessCode } from "@/lib/nfc";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("nfc_access_tags")
    .select("id,label,role,is_active,created_at,last_used_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, tags: data ?? [] });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const code = String(body?.code ?? "").trim();
  const role = String(body?.role ?? "").trim().toLowerCase();
  const label = String(body?.label ?? "").trim() || null;
  if (!code) return NextResponse.json({ ok: false, error: "NFC code required" }, { status: 400 });
  if (!role) return NextResponse.json({ ok: false, error: "Role required" }, { status: 400 });

  const admin = supabaseAdmin();
  const codeHash = await hashAccessCode(code);
  const { data: existing, error: exErr } = await admin
    .from("nfc_access_tags")
    .select("id")
    .eq("code_hash", codeHash)
    .maybeSingle();
  if (exErr) return NextResponse.json({ ok: false, error: exErr.message }, { status: 500 });
  if (existing) return NextResponse.json({ ok: false, error: "NFC code already exists" }, { status: 400 });

  const { data, error } = await admin
    .from("nfc_access_tags")
    .insert({ code_hash: codeHash, role, label })
    .select("id,label,role,is_active,created_at,last_used_at")
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, tag: data });
}

export async function PATCH(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  const updates: Record<string, any> = {};
  if (body?.label !== undefined) updates.label = String(body.label || "").trim() || null;
  if (body?.role !== undefined) updates.role = String(body.role || "").trim().toLowerCase();
  if (body?.is_active !== undefined) updates.is_active = Boolean(body.is_active);

  if (!Object.keys(updates).length) {
    return NextResponse.json({ ok: false, error: "No updates provided" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("nfc_access_tags")
    .update(updates)
    .eq("id", id)
    .select("id,label,role,is_active,created_at,last_used_at")
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, tag: data });
}

export async function DELETE(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

  const admin = supabaseAdmin();
  const { error } = await admin.from("nfc_access_tags").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

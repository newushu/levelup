import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("access_permissions")
    .select("id,permission_key,allowed_roles,description,created_at,updated_at")
    .order("permission_key", { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, permissions: data ?? [] });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const key = String(body?.permission_key ?? "").trim();
  const description = String(body?.description ?? "").trim() || null;
  const allowedRoles = Array.isArray(body?.allowed_roles)
    ? body.allowed_roles.map((r: any) => String(r).toLowerCase()).filter(Boolean)
    : [];
  if (!key) return NextResponse.json({ ok: false, error: "permission_key required" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("access_permissions")
    .insert({
      permission_key: key,
      allowed_roles: allowedRoles,
      description,
      updated_at: new Date().toISOString(),
    })
    .select("id,permission_key,allowed_roles,description,created_at,updated_at")
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, permission: data });
}

export async function PATCH(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  const updates: Record<string, any> = {};
  if (body?.permission_key !== undefined) updates.permission_key = String(body.permission_key || "").trim();
  if (body?.description !== undefined) updates.description = String(body.description || "").trim() || null;
  if (body?.allowed_roles !== undefined) {
    updates.allowed_roles = Array.isArray(body.allowed_roles)
      ? body.allowed_roles.map((r: any) => String(r).toLowerCase()).filter(Boolean)
      : [];
  }
  updates.updated_at = new Date().toISOString();

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("access_permissions")
    .update(updates)
    .eq("id", id)
    .select("id,permission_key,allowed_roles,description,created_at,updated_at")
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, permission: data });
}

export async function DELETE(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  const admin = supabaseAdmin();
  const { error } = await admin.from("access_permissions").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

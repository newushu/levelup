import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("announcements")
    .select("id,title,body,status,starts_at,ends_at,created_at,created_by,announcement_type,announcement_kind,discount_label,discount_ends_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, announcements: data ?? [] });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const title = String(body?.title ?? "").trim();
  const message = String(body?.body ?? "").trim();
  const status = String(body?.status ?? "active").trim().toLowerCase() || "active";
  const announcement_type = String(body?.announcement_type ?? "banner").trim().toLowerCase() || "banner";
  const announcement_kind = String(body?.announcement_kind ?? "general").trim().toLowerCase() || "general";
  const discount_label = String(body?.discount_label ?? "").trim();
  const discount_ends_at = String(body?.discount_ends_at ?? "").trim();
  const starts_at = String(body?.starts_at ?? "").trim();
  const ends_at = String(body?.ends_at ?? "").trim();

  if (!title || !message) {
    return NextResponse.json({ ok: false, error: "title and body required" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("announcements")
    .insert({
      title,
      body: message,
      status,
      announcement_type,
      announcement_kind,
      discount_label: discount_label || null,
      discount_ends_at: discount_ends_at || null,
      starts_at: starts_at || null,
      ends_at: ends_at || null,
      created_by: gate.user.id,
    })
    .select("id,title,body,status,starts_at,ends_at,created_at,created_by,announcement_type,announcement_kind,discount_label,discount_ends_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, announcement: data });
}

export async function PATCH(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });

  const payload: Record<string, any> = {};
  if (Object.prototype.hasOwnProperty.call(body, "title")) payload.title = String(body?.title ?? "").trim();
  if (Object.prototype.hasOwnProperty.call(body, "body")) payload.body = String(body?.body ?? "").trim();
  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    payload.status = String(body?.status ?? "active").trim().toLowerCase() || "active";
  }
  if (Object.prototype.hasOwnProperty.call(body, "announcement_type")) {
    payload.announcement_type = String(body?.announcement_type ?? "banner").trim().toLowerCase() || "banner";
  }
  if (Object.prototype.hasOwnProperty.call(body, "announcement_kind")) {
    payload.announcement_kind = String(body?.announcement_kind ?? "general").trim().toLowerCase() || "general";
  }
  if (Object.prototype.hasOwnProperty.call(body, "discount_label")) {
    payload.discount_label = String(body?.discount_label ?? "").trim() || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "discount_ends_at")) {
    payload.discount_ends_at = String(body?.discount_ends_at ?? "").trim() || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "starts_at")) {
    payload.starts_at = String(body?.starts_at ?? "").trim() || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "ends_at")) {
    payload.ends_at = String(body?.ends_at ?? "").trim() || null;
  }

  if (!Object.keys(payload).length) {
    return NextResponse.json({ ok: false, error: "No updates provided" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("announcements")
    .update(payload)
    .eq("id", id)
    .select("id,title,body,status,starts_at,ends_at,created_at,created_by,announcement_type,announcement_kind,discount_label,discount_ends_at")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, announcement: data });
}

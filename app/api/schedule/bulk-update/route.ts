import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function requireAdmin() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { ok: false as const, error: "Not logged in" };

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id)
    .eq("role", "admin")
    .limit(1);
  if (error) return { ok: false as const, error: error.message };
  if (!roles || roles.length === 0) return { ok: false as const, error: "Admin access required" };

  return { ok: true as const };
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const admin = supabaseAdmin();
  const body = await req.json().catch(() => ({}));
  const class_id = String(body?.class_id ?? "").trim();
  const start_date = String(body?.start_date ?? "").trim();
  const end_date = String(body?.end_date ?? "").trim();
  const patch = (body?.patch ?? {}) as Record<string, any>;
  const exceptions = Array.isArray(body?.exceptions)
    ? (body.exceptions as string[]).map((d) => String(d).trim()).filter(Boolean)
    : [];

  if (!class_id || !start_date || !end_date) {
    return NextResponse.json({ ok: false, error: "Missing class_id or date range" }, { status: 400 });
  }

  const update: Record<string, any> = {};
  if (patch.start_time) update.start_time = String(patch.start_time).trim();
  if (patch.end_time !== undefined) update.end_time = patch.end_time ? String(patch.end_time).trim() : null;
  if (patch.instructor_name !== undefined) update.instructor_name = String(patch.instructor_name ?? "").trim() || null;
  if (patch.room_name !== undefined) update.room_name = String(patch.room_name ?? "").trim() || null;
  if (patch.is_cancelled !== undefined) update.is_cancelled = Boolean(patch.is_cancelled);

  if (!Object.keys(update).length) {
    return NextResponse.json({ ok: false, error: "No updates provided" }, { status: 400 });
  }

  let query = admin
    .from("class_schedule_instances")
    .update(update)
    .eq("class_id", class_id)
    .gte("session_date", start_date)
    .lte("session_date", end_date);

  if (exceptions.length) {
    const encoded = `(${exceptions.map((d) => `"${d}"`).join(",")})`;
    query = query.not("session_date", "in", encoded);
  }

  const { error } = await query;

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

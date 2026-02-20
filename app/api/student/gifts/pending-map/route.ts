import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const gate = await requireUser();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body?.student_ids)
    ? body.student_ids.map((v: any) => String(v ?? "").trim()).filter(Boolean)
    : [];

  if (!ids.length) return NextResponse.json({ ok: true, counts: {} });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("student_gifts")
    .select("student_id,qty,opened_qty,enabled,expires_at,expired_at")
    .in("student_id", ids)
    .eq("enabled", true);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const counts: Record<string, number> = {};
  const now = Date.now();
  (data ?? []).forEach((row: any) => {
    const sid = String(row?.student_id ?? "").trim();
    if (!sid) return;
    const expiresMs = Date.parse(String(row?.expires_at ?? ""));
    const isExpired = Boolean(row?.expired_at) || (Number.isFinite(expiresMs) && expiresMs <= now);
    if (isExpired) return;
    const remain = Math.max(0, Number(row?.qty ?? 0) - Number(row?.opened_qty ?? 0));
    if (!remain) return;
    counts[sid] = (counts[sid] ?? 0) + remain;
  });

  return NextResponse.json({ ok: true, counts });
}

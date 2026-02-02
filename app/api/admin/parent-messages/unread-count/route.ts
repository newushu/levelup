import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const since = String(searchParams.get("since") ?? "").trim();

  const admin = supabaseAdmin();
  let query = admin
    .from("parent_messages")
    .select("id", { count: "exact", head: true })
    .eq("is_from_admin", false);

  if (since) {
    query = query.gt("created_at", since);
  }

  const { count, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, count: count ?? 0 });
}

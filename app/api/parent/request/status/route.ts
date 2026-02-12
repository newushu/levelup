import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveParentContext } from "../../_parentContext";

export async function GET(req: Request) {
  const ctx = await resolveParentContext(req);
  if (!ctx.ok) {
    const { error, status } = ctx as { ok: false; status: number; error: string };
    return NextResponse.json({ ok: false, error }, { status });
  }
  const parent = ctx.parent;

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("parent_requests")
    .select("id,status,student_names,created_at")
    .eq("auth_user_id", parent.auth_user_id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    request: data
      ? {
          id: data.id,
          status: data.status,
          student_names: data.student_names ?? [],
          created_at: data.created_at,
        }
      : null,
  });
}

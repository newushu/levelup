import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveParentContext } from "../_parentContext";

export async function GET(req: Request) {
  const ctx = await resolveParentContext(req);
  if (!ctx.ok) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status });

  const admin = supabaseAdmin();
  const { data: roles, error: rErr } = await admin.from("user_roles").select("user_id").eq("role", "coach");
  if (rErr) return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 });

  const coachIds = (roles ?? []).map((row: any) => String(row.user_id)).filter(Boolean);
  if (!coachIds.length) return NextResponse.json({ ok: true, coaches: [] });

  const { data: profiles, error: profErr } = await admin
    .from("profiles")
    .select("user_id,username,email")
    .in("user_id", coachIds);
  if (profErr) return NextResponse.json({ ok: false, error: profErr.message }, { status: 500 });

  const coaches = (profiles ?? [])
    .map((profile: any) => ({
      id: String(profile.user_id),
      name: String(profile.username || profile.email || "Coach"),
      email: String(profile.email || ""),
    }))
    .sort((a: any, b: any) => a.name.localeCompare(b.name));

  return NextResponse.json({ ok: true, coaches });
}

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: parent, error: pErr } = await admin
    .from("parents")
    .select("id")
    .eq("auth_user_id", gate.user.id)
    .maybeSingle();
  if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });
  if (!parent?.id) return NextResponse.json({ ok: false, error: "Not a parent account" }, { status: 403 });

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

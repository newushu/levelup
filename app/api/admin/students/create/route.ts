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

  const body = await req.json().catch(() => ({}));
  const first_name = String(body?.first_name ?? "").trim();
  const last_name = String(body?.last_name ?? "").trim();
  if (!first_name || !last_name) {
    return NextResponse.json({ ok: false, error: "First and last name are required." }, { status: 400 });
  }

  const name = `${first_name} ${last_name}`.trim();
  const email = String(body?.email ?? "").trim() || null;
  const phone = String(body?.phone ?? "").trim() || null;
  const emergency_contact = String(body?.emergency_contact ?? "").trim() || null;
  const goals = String(body?.goals ?? "").trim() || null;
  const notes = String(body?.notes ?? "").trim() || null;
  const enrollment_info = body?.enrollment_info ?? null;
  const is_competition_team = body?.is_competition_team === true;
  const rawGender = String(body?.gender ?? "").trim().toLowerCase();
  const gender = rawGender === "female" ? "female" : rawGender === "male" ? "male" : null;

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("students")
    .insert({
      name,
      first_name,
      last_name,
      is_competition_team,
      email,
      phone,
      emergency_contact,
      goals,
      notes,
      enrollment_info,
      gender,
    })
    .select("id,name,first_name,last_name,gender,is_competition_team,level,points_total,email,phone,emergency_contact,goals,notes,enrollment_info")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, student: data });
}

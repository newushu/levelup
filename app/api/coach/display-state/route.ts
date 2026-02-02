import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const TOOL_KEYS = new Set(["default", "lesson_forge", "timers", "warmup", "classroom_roster"]);

async function getRoles() {
  const supabase = await supabaseServer();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) return { ok: false as const, error: userErr?.message || "Not logged in" };
  const user = userData.user;

  const { data: roles, error: rErr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  if (rErr) return { ok: false as const, error: rErr.message };
  let roleList = (roles ?? []).map((r: any) => String(r.role ?? "").toLowerCase()).filter(Boolean);
  if (!roleList.length) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profile?.role) roleList = [String(profile.role).toLowerCase()];
  }
  return { ok: true as const, user, roleList };
}

export async function GET(req: Request) {
  const gate = await getRoles();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });
  const isAdmin = gate.roleList.includes("admin");
  const isCoach = gate.roleList.includes("coach");
  if (!isAdmin && !isCoach) return NextResponse.json({ ok: false, error: "Coach access required" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const requestedId = String(searchParams.get("coach_user_id") ?? "").trim();
  const coachUserId = isAdmin && requestedId ? requestedId : gate.user.id;

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("coach_display_state")
    .select("coach_user_id,tool_key,tool_payload,updated_at")
    .eq("coach_user_id", coachUserId)
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    state: data ?? {
      coach_user_id: coachUserId,
      tool_key: "default",
      tool_payload: null,
      updated_at: new Date().toISOString(),
    },
  });
}

export async function POST(req: Request) {
  const gate = await getRoles();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 401 });
  const isAdmin = gate.roleList.includes("admin");
  const isCoach = gate.roleList.includes("coach");
  if (!isAdmin && !isCoach) return NextResponse.json({ ok: false, error: "Coach access required" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const tool_key = String(body?.tool_key ?? "default").trim();
  if (!TOOL_KEYS.has(tool_key)) {
    return NextResponse.json({ ok: false, error: "Invalid tool_key" }, { status: 400 });
  }
  const requestedId = String(body?.coach_user_id ?? "").trim();
  const coachUserId = isAdmin && requestedId ? requestedId : gate.user.id;
  const tool_payload = body?.tool_payload ?? null;

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("coach_display_state")
    .upsert(
      {
        coach_user_id: coachUserId,
        tool_key,
        tool_payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "coach_user_id" }
    )
    .select("coach_user_id,tool_key,tool_payload,updated_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, state: data });
}

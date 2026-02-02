import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const { data: roles, error: rErr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id);
  if (rErr) return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 });
  const roleList = (roles ?? []).map((r: any) => String(r.role ?? "").toLowerCase());
  const allowed = roleList.some((r) => ["admin", "coach", "display"].includes(r));
  if (!allowed) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const admin = supabaseAdmin();
  const { data: slots, error } = await admin
    .from("coach_display_slots")
    .select("slot_key,label,coach_user_id,updated_at")
    .order("slot_key", { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const coachIds = Array.from(new Set((slots ?? []).map((s: any) => String(s.coach_user_id ?? "")).filter(Boolean)));
  let profileMap = new Map<string, { name: string; email: string | null }>();
  if (coachIds.length) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("user_id,display_name,email,username")
      .in("user_id", coachIds);
    (profiles ?? []).forEach((p: any) => {
      const name = String(p.display_name || p.username || p.email || "").trim();
      profileMap.set(String(p.user_id), { name, email: p.email ?? null });
    });
  }

  const list = (slots ?? []).map((s: any) => {
    const coachId = String(s.coach_user_id ?? "");
    const profile = coachId ? profileMap.get(coachId) : null;
    return {
      slot_key: String(s.slot_key),
      label: String(s.label ?? s.slot_key),
      coach_user_id: coachId || null,
      coach_name: profile?.name ?? "",
      coach_email: profile?.email ?? null,
    };
  });

  return NextResponse.json({ ok: true, slots: list });
}

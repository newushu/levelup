import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function getRoleList() {
  const supabase = await supabaseServer();
  const admin = supabaseAdmin();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { ok: false as const, status: 401, error: "Not logged in", roles: [] as string[] };
  const { data: roles, error } = await admin.from("user_roles").select("role").eq("user_id", user.user.id);
  if (error) return { ok: false as const, status: 500, error: error.message, roles: [] as string[] };
  return {
    ok: true as const,
    status: 200,
    roles: (roles ?? []).map((r: any) => String(r.role ?? "").toLowerCase()).filter(Boolean),
    userId: String(user.user.id),
  };
}

export async function POST(req: Request) {
  const auth = await getRoleList();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body?.student_ids)
    ? body.student_ids.map((v: any) => String(v ?? "").trim()).filter(Boolean)
    : [];
  if (!ids.length) return NextResponse.json({ ok: true, factions: {} });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("camp_display_members")
    .select("student_id,faction_id,sort_order,enabled,camp_factions(id,name,color,icon,logo_url)")
    .in("student_id", ids)
    .eq("enabled", true)
    .not("faction_id", "is", null)
    .order("sort_order", { ascending: true });

  if (error) {
    const msg = String(error.message || "");
    if (msg.toLowerCase().includes("does not exist") || msg.toLowerCase().includes("relation")) {
      return NextResponse.json({ ok: true, factions: {} });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const out: Record<string, any> = {};
  for (const row of data ?? []) {
    const sid = String((row as any).student_id ?? "");
    if (!sid || out[sid]) continue;
    const faction = (row as any).camp_factions;
    out[sid] = faction
      ? {
          id: String((faction as any).id ?? ""),
          name: String((faction as any).name ?? "Faction"),
          color: String((faction as any).color ?? "#38bdf8"),
          icon: String((faction as any).icon ?? "🏕️"),
          logo_url: String((faction as any).logo_url ?? ""),
        }
      : null;
  }

  return NextResponse.json({ ok: true, factions: out });
}
